// Three.js first-person renderer for 3D Mode. Owns persistent scene geometry,
// camera setup, entity billboards, and continuous free-look movement.

const WEBGL_WALL_HEIGHT_TILES = 1;
const WEBGL_FOV_DEGREES = 66;
const MOVE_SPEED_TILES_PER_SEC = 4;
const PLAYER_COLLISION_RADIUS_TILES = 0.2;

// Facing/yaw convention shared with the original renderer and Player:
// facing 0=up, 1=right, 2=down, 3=left; yaw 0deg=+X and 90deg=+Z/south.
const FACING_TO_YAW_DEG = [270, 0, 90, 180];
const YAW_TO_FACING = { 0: 1, 90: 2, 180: 3, 270: 0 };
const WEBGL_BILLBOARD_FACING_INDEX = 2;
const WEBGL_BILLBOARD_ENTITY_CLASSES = [
    'MovableEntity', 'NPC', 'Robot', 'FarmRobot', 'GridMoveEntity',
    'FreeMoveEntity', 'LightMoveEntity', 'PayToMoveEntity',
    'Shop', 'Chest', 'AirBallon', 'Plant'
];
const WEBGL_FLOOR_TILE_NAMES = new Set([
    'concrete', 'grass', 'plot', 'dirt', 'Bridge', 'bridge2',
    'park_grass', 'park_path', 'park_path_vert', 'park_path_cross',
    'park_path_up_t', 'swamp_grass', 'water', 'water12',
    'kitchen_tile', 'dirt_path', 'sand', 'towel'
]);

function normalizeAngleDeg0to360(angleDeg) {
    let a = angleDeg % 360;
    if (a < 0) a += 360;
    return a;
}

function nearestCardinalFacingFromYaw(yawDeg) {
    const normalized = normalizeAngleDeg0to360(yawDeg);
    const rounded = Math.round(normalized / 90) * 90;
    const wrapped = rounded === 360 ? 0 : rounded;
    return YAW_TO_FACING[wrapped];
}

function isWebglBillboardEntityCell(cell) {
    return !!cell && WEBGL_BILLBOARD_ENTITY_CLASSES.indexOf(cell.class) !== -1;
}

// Only the active room's derived descriptors are retained. A cheap signature
// scan also catches in-place edits (placing/removing tiles or changing a
// variant) so cached geometry cannot silently drift from the live room map.
let webglRoomGeometryCache = {
    levelX: null,
    levelY: null,
    mapRef: null,
    signature: null,
    walls: [],
    floors: [],
    staticBillboards: [],
    wallBatches: [],
    floorBatches: []
};

let three3DRenderer = null;
let three3DScene = null;
let three3DCamera = null;
let three3DBillboardGroup = null;
let three3DActiveRoom = null;
let three3DWallGeometry = null;
let three3DFloorGeometry = null;
const three3DTextureCache = new WeakMap();
const three3DMaterialCache = new WeakMap();
const three3DBillboardGeometryCache = new Map();
const three3DFallbackMaterials = new Map();

function isValidWebglTextureSource(sprite) {
    return !!sprite && Number.isFinite(sprite.width) && sprite.width > 0 &&
        Number.isFinite(sprite.height) && sprite.height > 0;
}

function getTileSprite(cell) {
    if (!cell || !all_imgs[cell.png]) return null;
    const sprites = all_imgs[cell.png];
    if (isValidWebglTextureSource(sprites)) return sprites;

    let sprite = sprites[cell.variant] || sprites[0] || null;
    if (Array.isArray(sprite)) sprite = sprite[0] || null;
    return isValidWebglTextureSource(sprite) ? sprite : null;
}

function getFloorTileSprite(cell) {
    if (!cell) return null;
    if (isWebglBillboardEntityCell(cell)) {
        return cell.under_tile && typeof cell.under_tile === 'object'
            ? getTileSprite(cell.under_tile)
            : null;
    }
    return getTileSprite(cell);
}

function isWebglStructuralWallCell(cell) {
    if (!cell || cell.class !== 'Tile') return false;
    if (cell.name === 'wall') return true;
    // Preserve the pure-helper contract for old saves/tests whose Tile objects
    // predate the name field.
    return !cell.name && cell.collide === true;
}

function isWebglFloorSurfaceCell(cell) {
    if (!cell || cell.class !== 'Tile') return false;
    if (!cell.name) return cell.collide !== true;
    return WEBGL_FLOOR_TILE_NAMES.has(cell.name);
}

function isWebglStaticBillboardCell(cell) {
    return !!cell && cell.class === 'Tile' && !!cell.name &&
        !isWebglStructuralWallCell(cell) && !isWebglFloorSurfaceCell(cell);
}

function getDominantFloorSprite(map) {
    const counts = new Map();
    let dominantSprite = null;
    let dominantCount = 0;
    for (const row of map) {
        if (!Array.isArray(row)) continue;
        for (const cell of row) {
            if (!isWebglFloorSurfaceCell(cell)) continue;
            const sprite = getTileSprite(cell);
            if (!isValidWebglTextureSource(sprite)) continue;
            const nextCount = (counts.get(sprite) || 0) + 1;
            counts.set(sprite, nextCount);
            if (nextCount > dominantCount) {
                dominantCount = nextCount;
                dominantSprite = sprite;
            }
        }
    }
    return dominantSprite;
}

function buildRoomGeometryDescriptors(map) {
    const walls = [];
    const floors = [];
    const staticBillboards = [];
    if (!Array.isArray(map)) return { walls, floors, staticBillboards };
    const dominantFloorSprite = getDominantFloorSprite(map);

    for (let row = 0; row < map.length; row++) {
        const mapRow = map[row];
        if (!Array.isArray(mapRow)) continue;

        for (let column = 0; column < mapRow.length; column++) {
            const cell = mapRow[column];
            if (!cell) continue;

            if (isWebglStructuralWallCell(cell)) {
                walls.push({
                    xTiles: column,
                    yTiles: row,
                    sprite: getTileSprite(cell)
                });
            } else {
                const isStaticBillboard = isWebglStaticBillboardCell(cell);
                const underSprite = cell.under_tile && typeof cell.under_tile === 'object'
                    ? getTileSprite(cell.under_tile)
                    : null;
                floors.push({
                    xTiles: column,
                    yTiles: row,
                    sprite: isStaticBillboard
                        ? (underSprite || dominantFloorSprite)
                        : getFloorTileSprite(cell)
                });
                if (isStaticBillboard) {
                    const sprite = getTileSprite(cell);
                    if (isValidWebglTextureSource(sprite)) {
                        staticBillboards.push({
                            worldX: column * tileSize + tileSize / 2,
                            worldZ: row * tileSize + tileSize / 2,
                            width: sprite.width || tileSize,
                            height: sprite.height || tileSize,
                            sprite
                        });
                    }
                }
            }
        }
    }

    return { walls, floors, staticBillboards };
}

function roomGeometrySignature(map) {
    if (!Array.isArray(map)) return 'invalid';
    const tokens = [map.length];
    for (const row of map) {
        if (!Array.isArray(row)) {
            tokens.push('x');
            continue;
        }
        tokens.push(row.length);
        for (const cell of row) {
            if (!cell) {
                tokens.push('0');
                continue;
            }
            const under = isWebglBillboardEntityCell(cell) && cell.under_tile &&
                typeof cell.under_tile === 'object' ? cell.under_tile : null;
            tokens.push(
                cell.class || '', cell.name || '', cell.collide === true ? 1 : 0,
                cell.png ?? '', cell.variant ?? '', cell.age ?? '',
                under ? under.png ?? '' : '', under ? under.variant ?? '' : ''
            );
        }
    }
    return tokens.join('|');
}

function addTriangle(vertices, a, b, c) {
    vertices.push(...a, ...b, ...c);
}

function addQuad(vertices, a, b, c, d) {
    addTriangle(vertices, [...a, 0, 0], [...b, 1, 0], [...c, 1, 1]);
    addTriangle(vertices, [...a, 0, 0], [...c, 1, 1], [...d, 0, 1]);
}

function getOrCreateTextureBatch(batchesBySprite, sprite) {
    const key = isValidWebglTextureSource(sprite) ? sprite : null;
    let batch = batchesBySprite.get(key);
    if (!batch) {
        batch = { sprite: key, vertices: [] };
        batchesBySprite.set(key, batch);
    }
    return batch;
}

function buildFloorBatches(floors) {
    const batches = new Map();
    for (const floor of floors) {
        const vertices = getOrCreateTextureBatch(batches, floor.sprite).vertices;
        const x0 = floor.xTiles * tileSize;
        const x1 = x0 + tileSize;
        const z0 = floor.yTiles * tileSize;
        const z1 = z0 + tileSize;
        addQuad(vertices, [x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]);
    }
    return Array.from(batches.values());
}

function isSolidWebglWall(map, row, column) {
    const cell = map[row] && map[row][column];
    return isWebglStructuralWallCell(cell);
}

function buildWallBatches(walls, map) {
    const batches = new Map();
    const topY = -tileSize * WEBGL_WALL_HEIGHT_TILES;
    const bottomY = 0;

    for (const wall of walls) {
        const vertices = getOrCreateTextureBatch(batches, wall.sprite).vertices;
        const column = wall.xTiles;
        const row = wall.yTiles;
        const x0 = column * tileSize;
        const x1 = x0 + tileSize;
        const z0 = row * tileSize;
        const z1 = z0 + tileSize;

        // Only emit faces visible from open cells. Adjacent wall faces could
        // never be seen, but full box() calls used to submit them every frame.
        if (!isSolidWebglWall(map, row - 1, column)) {
            addQuad(vertices, [x1, topY, z0], [x0, topY, z0], [x0, bottomY, z0], [x1, bottomY, z0]);
        }
        if (!isSolidWebglWall(map, row + 1, column)) {
            addQuad(vertices, [x0, topY, z1], [x1, topY, z1], [x1, bottomY, z1], [x0, bottomY, z1]);
        }
        if (!isSolidWebglWall(map, row, column - 1)) {
            addQuad(vertices, [x0, topY, z0], [x0, topY, z1], [x0, bottomY, z1], [x0, bottomY, z0]);
        }
        if (!isSolidWebglWall(map, row, column + 1)) {
            addQuad(vertices, [x1, topY, z1], [x1, topY, z0], [x1, bottomY, z0], [x1, bottomY, z1]);
        }
    }
    return Array.from(batches.values());
}

function getRoomGeometryForRoom(currentLvl, levelX, levelY) {
    const map = currentLvl && currentLvl.map;
    const signature = roomGeometrySignature(map);
    if (webglRoomGeometryCache.levelX !== levelX ||
        webglRoomGeometryCache.levelY !== levelY ||
        webglRoomGeometryCache.mapRef !== map ||
        webglRoomGeometryCache.signature !== signature) {
        const geometry = buildRoomGeometryDescriptors(map);
        webglRoomGeometryCache = {
            levelX,
            levelY,
            mapRef: map,
            signature,
            walls: geometry.walls,
            floors: geometry.floors,
            staticBillboards: geometry.staticBillboards,
            wallBatches: buildWallBatches(geometry.walls, map),
            floorBatches: buildFloorBatches(geometry.floors)
        };
    }

    return webglRoomGeometryCache;
}

function getActiveCameraYawDeg(playerObj) {
    return pointerLockEngaged
        ? playerObj.lookYawDeg
        : (FACING_TO_YAW_DEG[playerObj.facing] ?? 0);
}

function getWebglBillboardSprite(tile) {
    if (!tile || !all_imgs[tile.png]) return null;

    if (tile.class === 'Plant') {
        return all_imgs[tile.png][tile.age] || null;
    }

    const facingIndexed = all_imgs[tile.png][WEBGL_BILLBOARD_FACING_INDEX];
    if (Array.isArray(facingIndexed)) {
        return facingIndexed[0] || null;
    }

    if (typeof all_imgs[tile.png].width === 'number' || typeof all_imgs[tile.png].get === 'function') {
        return all_imgs[tile.png];
    }

    return all_imgs[tile.png][tile.variant] || all_imgs[tile.png][0] || null;
}

function collectBillboardDescriptors(currentLvl) {
    const billboards = [];
    if (!currentLvl || !Array.isArray(currentLvl.map)) return billboards;

    for (const row of currentLvl.map) {
        if (!Array.isArray(row)) continue;
        for (const tile of row) {
            if (!isWebglBillboardEntityCell(tile) || !tile.pos) continue;

            const sprite = getWebglBillboardSprite(tile);
            if (!isValidWebglTextureSource(sprite)) continue;

            billboards.push({
                worldX: tile.pos.x + tileSize / 2,
                worldZ: tile.pos.y + tileSize / 2,
                width: sprite.width || tileSize,
                height: sprite.height || tileSize,
                sprite
            });
        }
    }

    return billboards;
}

function initializeThree3DRenderer() {
    if (three3DRenderer) return true;
    if (typeof THREE === 'undefined' || typeof document === 'undefined') return false;

    const renderCanvas = document.createElement('canvas');
    three3DRenderer = new THREE.WebGLRenderer({
        canvas: renderCanvas,
        antialias: false,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance'
    });
    three3DRenderer.setPixelRatio(1);
    three3DRenderer.setSize(canvasWidth, canvasHeight, false);
    three3DRenderer.setClearColor(0x87ceeb, 1);
    three3DRenderer.outputColorSpace = THREE.SRGBColorSpace;

    three3DScene = new THREE.Scene();
    three3DScene.background = new THREE.Color(0x87ceeb);
    three3DCamera = new THREE.PerspectiveCamera(
        WEBGL_FOV_DEGREES,
        canvasWidth / canvasHeight,
        0.1,
        Math.max(canvasWidth, canvasHeight) * 5
    );
    three3DCamera.up.set(0, 1, 0);
    three3DBillboardGroup = new THREE.Group();
    three3DScene.add(three3DBillboardGroup);

    three3DWallGeometry = new THREE.BoxGeometry(
        tileSize,
        tileSize * WEBGL_WALL_HEIGHT_TILES,
        tileSize
    );
    three3DFloorGeometry = new THREE.PlaneGeometry(tileSize, tileSize);
    three3DFloorGeometry.rotateX(-Math.PI / 2);
    return true;
}

function getThreeTexture(sprite) {
    if (!isValidWebglTextureSource(sprite)) return null;
    const cached = three3DTextureCache.get(sprite);
    if (cached) return cached;

    const source = sprite.canvas || sprite.elt || sprite;
    const texture = new THREE.Texture(source);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    three3DTextureCache.set(sprite, texture);
    return texture;
}

function getThreeFallbackMaterial(color, billboard) {
    const key = `${color}|${billboard ? 1 : 0}`;
    if (!three3DFallbackMaterials.has(key)) {
        three3DFallbackMaterials.set(key, new THREE.MeshBasicMaterial({
            color,
            side: billboard ? THREE.DoubleSide : THREE.FrontSide
        }));
    }
    return three3DFallbackMaterials.get(key);
}

function getThreeMaterial(sprite, kind, useTextures = true) {
    if (!useTextures || !isValidWebglTextureSource(sprite)) {
        return getThreeFallbackMaterial(kind === 'wall' ? 0xcd5c48 : 0x563c28, kind === 'billboard');
    }

    let materials = three3DMaterialCache.get(sprite);
    if (!materials) {
        materials = {};
        three3DMaterialCache.set(sprite, materials);
    }
    if (materials[kind]) return materials[kind];

    const billboard = kind === 'billboard';
    materials[kind] = new THREE.MeshBasicMaterial({
        map: getThreeTexture(sprite),
        transparent: billboard,
        alphaTest: 0.08,
        side: billboard ? THREE.DoubleSide : THREE.FrontSide,
        depthTest: true,
        depthWrite: true
    });
    return materials[kind];
}

function groupDescriptorsBySprite(descriptors) {
    const groups = new Map();
    for (const descriptor of descriptors) {
        const sprite = isValidWebglTextureSource(descriptor.sprite) ? descriptor.sprite : null;
        if (!groups.has(sprite)) groups.set(sprite, []);
        groups.get(sprite).push(descriptor);
    }
    return groups;
}

function addThreeInstancedTiles(group, descriptors, kind, useTextures) {
    const descriptorGroups = groupDescriptorsBySprite(descriptors);
    const dummy = new THREE.Object3D();
    const geometry = kind === 'wall' ? three3DWallGeometry : three3DFloorGeometry;

    for (const [sprite, entries] of descriptorGroups) {
        const mesh = new THREE.InstancedMesh(
            geometry,
            getThreeMaterial(sprite, kind, useTextures),
            entries.length
        );
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            dummy.position.set(
                entry.xTiles * tileSize + tileSize / 2,
                kind === 'wall' ? tileSize * WEBGL_WALL_HEIGHT_TILES / 2 : 0,
                entry.yTiles * tileSize + tileSize / 2
            );
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        group.add(mesh);
    }
}

function buildThreeRoomGroup(currentLvl, geometry, useTextures) {
    const roomGroup = new THREE.Group();
    const rows = currentLvl.map.length;
    const columns = currentLvl.map.reduce((width, row) => Math.max(width, row.length), 0);

    if (rows && columns) {
        const baseGeometry = new THREE.PlaneGeometry(columns * tileSize, rows * tileSize);
        baseGeometry.rotateX(-Math.PI / 2);
        const baseFloor = new THREE.Mesh(
            baseGeometry,
            getThreeFallbackMaterial(0x563c28, false)
        );
        baseFloor.position.set(columns * tileSize / 2, -0.02, rows * tileSize / 2);
        roomGroup.add(baseFloor);
    }

    addThreeInstancedTiles(roomGroup, geometry.floors, 'floor', useTextures);
    addThreeInstancedTiles(roomGroup, geometry.walls, 'wall', useTextures);
    return roomGroup;
}

function getThreeRoomGroup(currentLvl, levelX, levelY, useTextures) {
    const geometry = getRoomGeometryForRoom(currentLvl, levelX, levelY);
    if (!three3DActiveRoom ||
        three3DActiveRoom.geometry !== geometry ||
        three3DActiveRoom.useTextures !== useTextures) {
        if (three3DActiveRoom) {
            three3DScene.remove(three3DActiveRoom.group);
            for (const child of three3DActiveRoom.group.children) {
                if (child.geometry && child.geometry !== three3DWallGeometry &&
                    child.geometry !== three3DFloorGeometry) child.geometry.dispose();
            }
        }
        const group = buildThreeRoomGroup(currentLvl, geometry, useTextures);
        three3DScene.add(group);
        three3DActiveRoom = { geometry, group, useTextures };
    }
    return three3DActiveRoom.group;
}

function configureThreePlayerCamera(playerObj, currentLvl) {
    const rows = currentLvl.map.length;
    const columns = currentLvl.map.reduce((width, row) => Math.max(width, row.length), 0);
    const maxDimension = Math.max(columns * tileSize, rows * tileSize, tileSize);
    const eyeX = playerObj.pos.x + tileSize / 2;
    const eyeY = tileSize * WEBGL_WALL_HEIGHT_TILES / 2;
    const eyeZ = playerObj.pos.y + tileSize / 2;
    const yawRad = getActiveCameraYawDeg(playerObj) * Math.PI / 180;

    three3DCamera.fov = WEBGL_FOV_DEGREES;
    three3DCamera.aspect = canvasWidth / canvasHeight;
    three3DCamera.near = 0.1;
    three3DCamera.far = maxDimension * 5;
    three3DCamera.updateProjectionMatrix();
    three3DCamera.position.set(eyeX, eyeY, eyeZ);
    three3DCamera.lookAt(
        eyeX + Math.cos(yawRad),
        eyeY,
        eyeZ + Math.sin(yawRad)
    );
    three3DCamera.updateMatrixWorld();
}

function getThreeBillboardGeometry(width, height) {
    const key = `${width}x${height}`;
    if (!three3DBillboardGeometryCache.has(key)) {
        three3DBillboardGeometryCache.set(key, new THREE.PlaneGeometry(width, height));
    }
    return three3DBillboardGeometryCache.get(key);
}

function renderThreeBillboards(billboards, useTextures) {
    three3DBillboardGroup.clear();
    for (const billboard of billboards) {
        const mesh = new THREE.Mesh(
            getThreeBillboardGeometry(billboard.width, billboard.height),
            getThreeMaterial(billboard.sprite, 'billboard', useTextures)
        );
        mesh.position.set(billboard.worldX, billboard.height / 2, billboard.worldZ);
        mesh.lookAt(three3DCamera.position.x, mesh.position.y, three3DCamera.position.z);
        three3DBillboardGroup.add(mesh);
    }
}

function compositeThreeCanvas() {
    push();
    resetMatrix();
    noTint();
    drawingContext.drawImage(three3DRenderer.domElement, 0, 0, canvasWidth, canvasHeight);
    pop();
}

function render3DViewWebgl(playerObj, currentLvl, levelX, levelY, useTextures = true) {
    if (!playerObj || !currentLvl || !Array.isArray(currentLvl.map)) return;
    if (!initializeThree3DRenderer()) return;

    getThreeRoomGroup(currentLvl, levelX, levelY, useTextures);
    configureThreePlayerCamera(playerObj, currentLvl);
    renderThreeBillboards(
        three3DActiveRoom.geometry.staticBillboards.concat(collectBillboardDescriptors(currentLvl)),
        useTextures
    );
    three3DRenderer.render(three3DScene, three3DCamera);
    compositeThreeCanvas();
}

// Point-collision test in continuous tile-space coordinates. Returns 'edge'
// outside the room, 'wall' for a solid in-room tile, and false for open floor.
function isPointBlocked(map, xTiles, yTiles) {
    const col = Math.floor(xTiles);
    const row = Math.floor(yTiles);
    const mapRow = map[row];
    const cell = mapRow ? mapRow[col] : undefined;
    if (cell === undefined) return 'edge';
    if (cell !== 0 && cell.collide === true) return 'wall';
    return false;
}

// Keeps a small first-person camera radius away from wall faces. Room edges
// still use the center point so cross-room wrapping happens only after the
// player actually leaves the map, not when the radius merely touches it.
function testMovementPosition(map, xTiles, yTiles, radiusTiles) {
    const center = isPointBlocked(map, xTiles, yTiles);
    if (center !== false || radiusTiles <= 0) return center;

    const offsets = [
        [-radiusTiles, 0], [radiusTiles, 0],
        [0, -radiusTiles], [0, radiusTiles],
        [-radiusTiles, -radiusTiles], [radiusTiles, -radiusTiles],
        [-radiusTiles, radiusTiles], [radiusTiles, radiusTiles]
    ];
    for (const [offsetX, offsetY] of offsets) {
        // An offset crossing the room edge is not a collision; the center
        // point above remains authoritative for level transitions.
        if (isPointBlocked(map, xTiles + offsetX, yTiles + offsetY) === 'wall') {
            return 'wall';
        }
    }
    return false;
}

function moveWithSliding(map, xTiles, yTiles, deltaXTiles, deltaYTiles, radiusTiles = 0) {
    let newX = xTiles;
    let newY = yTiles;
    let hitEdgeX = false;
    let hitEdgeY = false;

    if (deltaXTiles !== 0) {
        const xTest = testMovementPosition(map, xTiles + deltaXTiles, yTiles, radiusTiles);
        if (xTest === 'edge') {
            hitEdgeX = true;
            newX = xTiles + deltaXTiles;
        } else if (xTest === false) {
            newX = xTiles + deltaXTiles;
        }
    }

    if (deltaYTiles !== 0) {
        const yTest = testMovementPosition(map, newX, yTiles + deltaYTiles, radiusTiles);
        if (yTest === 'edge') {
            hitEdgeY = true;
            newY = yTiles + deltaYTiles;
        } else if (yTest === false) {
            newY = yTiles + deltaYTiles;
        }
    }

    return { x: newX, y: newY, hitEdgeX, hitEdgeY };
}

function wrapPositionAcrossEdge(valueTiles, limitTiles, direction) {
    if (direction > 0) return valueTiles - limitTiles;
    return limitTiles + valueTiles;
}

function resetLevelTransitionAnim(levelY, levelX) {
    const lvl = levels[levelY] ? levels[levelY][levelX] : null;
    if (!lvl || typeof lvl !== 'object') return;
    lvl.level_name_popup = false;
    lvl.y = -50;
    lvl.done = false;
    lvl.movephase = 0;
    lvl.ticks = 0;
}

function ensureLevelExists(levelY, levelX) {
    if (!levels[levelY] || levelY < 0 || levelX < 0) return false;
    const existing = levels[levelY][levelX];
    if (existing && typeof existing === 'object') return true;
    if (existing === 0) return false;
    if (typeof extra_lvls === 'undefined') return false;

    extraCount++;
    levels[levelY][levelX] = new Level(
        'Extra y:' + levelY + ' x:' + (levelX - 6),
        JSON.parse(JSON.stringify(extra_lvls.map)),
        JSON.parse(JSON.stringify(extra_lvls.fore))
    );
    return true;
}

function updatePlayer3DMovementWebgl(playerObj) {
    const currentLvl = levels[currentLevel_y] ? levels[currentLevel_y][currentLevel_x] : null;
    if (!currentLvl || typeof currentLvl !== 'object' || !currentLvl.map) return;

    const stepTiles = MOVE_SPEED_TILES_PER_SEC * (deltaTime / 1000);
    const yawRad = (playerObj.lookYawDeg * Math.PI) / 180;
    const forwardX = Math.cos(yawRad);
    const forwardY = Math.sin(yawRad);
    const rightX = Math.cos(yawRad + Math.PI / 2);
    const rightY = Math.sin(yawRad + Math.PI / 2);

    let moveX = 0;
    let moveY = 0;
    if (keyIsDown(move_up_button) || virtualInput.up) { moveX += forwardX; moveY += forwardY; }
    if (keyIsDown(move_down_button) || virtualInput.down) { moveX -= forwardX; moveY -= forwardY; }
    if (keyIsDown(move_right_button) || virtualInput.right) { moveX += rightX; moveY += rightY; }
    if (keyIsDown(move_left_button) || virtualInput.left) { moveX -= rightX; moveY -= rightY; }

    if (moveX === 0 && moveY === 0) return;

    // Keyboard diagonals should not move sqrt(2) times faster.
    const moveLength = Math.hypot(moveX, moveY);
    if (moveLength > 1) {
        moveX /= moveLength;
        moveY /= moveLength;
    }

    const originXTiles = (playerObj.pos.x + tileSize / 2) / tileSize;
    const originYTiles = (playerObj.pos.y + tileSize / 2) / tileSize;
    const result = moveWithSliding(
        currentLvl.map,
        originXTiles,
        originYTiles,
        moveX * stepTiles,
        moveY * stepTiles,
        PLAYER_COLLISION_RADIUS_TILES
    );

    let finalXTiles = result.x;
    let finalYTiles = result.y;
    const roomWidthTiles = canvasWidth / tileSize;
    const roomHeightTiles = canvasHeight / tileSize;
    const originLevelY = currentLevel_y;
    const originLevelX = currentLevel_x;

    if (result.hitEdgeX) {
        const dir = moveX > 0 ? 1 : -1;
        if (ensureLevelExists(originLevelY, originLevelX + dir)) {
            resetLevelTransitionAnim(originLevelY, originLevelX);
            currentLevel_x += dir;
            finalXTiles = wrapPositionAcrossEdge(result.x, roomWidthTiles, dir);
        } else {
            finalXTiles = dir > 0 ? roomWidthTiles - 0.05 : 0.05;
        }
    }

    if (result.hitEdgeY) {
        const dir = moveY > 0 ? 1 : -1;
        if (ensureLevelExists(originLevelY + dir, currentLevel_x)) {
            resetLevelTransitionAnim(originLevelY, originLevelX);
            currentLevel_y += dir;
            finalYTiles = wrapPositionAcrossEdge(result.y, roomHeightTiles, dir);
        } else {
            finalYTiles = dir > 0 ? roomHeightTiles - 0.05 : 0.05;
        }
    }

    playerObj.pos.x = finalXTiles * tileSize - tileSize / 2;
    playerObj.pos.y = finalYTiles * tileSize - tileSize / 2;
}
