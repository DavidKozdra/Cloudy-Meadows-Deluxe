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
    'Entity', 'MovableEntity', 'NPC', 'Robot', 'FarmRobot', 'GridMoveEntity',
    'FreeMoveEntity', 'LightMoveEntity', 'PayToMoveEntity',
    'Shop', 'Chest', 'AirBallon', 'Plant'
];
const WEBGL_FLOOR_TILE_NAMES = new Set([
    'concrete', 'grass', 'plot', 'dirt', 'Bridge', 'bridge2',
    'park_grass', 'park_path', 'park_path_vert', 'park_path_cross',
    'park_path_up_t', 'swamp_grass', 'water', 'water12',
    'kitchen_tile', 'dirt_path', 'sand', 'towel'
]);
const WEBGL_FLAT_PROP_NAMES = new Set(['bed']);
const WEBGL_INTERACTION_CLASSES = new Set([
    'NPC', 'Shop', 'Chest', 'Robot', 'AirBallon'
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
    flatProps: [],
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
let three3DViewModelScene = null;
let three3DViewModelCamera = null;
let three3DViewModelGroup = null;
let three3DViewModelItemMesh = null;
let three3DViewModelItemSprite = null;
let three3DViewModelActionHeld = false;
let three3DViewModelSwingStartedAt = -Infinity;
const three3DBillboardPool = [];
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

function getRememberedUnderTileSprite(cell) {
    if (!cell) return null;
    if (cell.under_tile && typeof cell.under_tile === 'object') {
        return getTileSprite(cell.under_tile);
    }
    if (Number.isInteger(cell.last_under_png)) {
        return getTileSprite({
            png: cell.last_under_png,
            variant: Number.isInteger(cell.last_under_variant) ? cell.last_under_variant : 0
        });
    }
    return null;
}

function getFloorTileSprite(cell) {
    if (!cell) return null;
    if (cell.class === 'Plant') {
        const isWet = cell.waterneeded > 0 && cell.watermet === true;
        return getTileSprite({ png: isWet ? 93 : 2, variant: 0 });
    }
    if (isWebglBillboardEntityCell(cell)) {
        return getRememberedUnderTileSprite(cell);
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

function isWebglFlatPropCell(cell) {
    return !!cell && cell.class === 'Tile' && WEBGL_FLAT_PROP_NAMES.has(cell.name);
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
    const flatProps = [];
    const staticBillboards = [];
    if (!Array.isArray(map)) return { walls, floors, flatProps, staticBillboards };
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
                const isFlatProp = isWebglFlatPropCell(cell);
                const isStaticBillboard = !isFlatProp && isWebglStaticBillboardCell(cell);
                const underSprite = getRememberedUnderTileSprite(cell);
                floors.push({
                    xTiles: column,
                    yTiles: row,
                    sprite: (isStaticBillboard || isFlatProp)
                        ? (underSprite || dominantFloorSprite)
                        : getFloorTileSprite(cell)
                });
                if (isFlatProp) {
                    const sprite = getTileSprite(cell);
                    if (isValidWebglTextureSource(sprite)) {
                        flatProps.push({ xTiles: column, yTiles: row, sprite });
                    }
                }
                if (isStaticBillboard) {
                    const sprite = getTileSprite(cell);
                    if (isValidWebglTextureSource(sprite)) {
                        const pairedTreeBottom = cell.name === 'tree_top' &&
                            map[row + 1] && map[row + 1][column] &&
                            map[row + 1][column].name === 'tree_bottom';
                        staticBillboards.push({
                            worldX: column * tileSize + tileSize / 2,
                            // A 2D tree occupies two map rows for draw order. In
                            // first person those images are one vertical object:
                            // trunk on the ground, then canopy directly above it.
                            worldY: pairedTreeBottom
                                ? tileSize + sprite.height / 2
                                : undefined,
                            worldZ: (pairedTreeBottom ? row + 1 : row) * tileSize + tileSize / 2,
                            width: sprite.width || tileSize,
                            height: sprite.height || tileSize,
                            sprite
                        });
                    }
                }
            }
        }
    }

    return { walls, floors, flatProps, staticBillboards };
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
            // Moving entities are rendered from the live map every frame. For
            // cached room geometry, their under-tile is the effective cell.
            // This keeps NPC movement from rebuilding every floor/wall mesh.
            const isDynamicBillboard = isWebglBillboardEntityCell(cell);
            const under = cell.under_tile && typeof cell.under_tile === 'object'
                ? cell.under_tile
                : null;
            const geometryCell = isDynamicBillboard ? under : cell;
            const staticUnder = isDynamicBillboard ? null : under;
            if (!geometryCell) {
                if (cell.class === 'Plant') {
                    tokens.push(
                        'plant-floor',
                        cell.waterneeded > 0 && cell.watermet === true ? 'wet' : 'dry'
                    );
                } else {
                    tokens.push('dynamic-floor');
                }
                continue;
            }
            tokens.push(
                geometryCell.class || '', geometryCell.name || '',
                isWebglStructuralWallCell(geometryCell) ? 1 : 0,
                geometryCell.png ?? '', geometryCell.variant ?? '',
                staticUnder ? staticUnder.png ?? '' : '',
                staticUnder ? staticUnder.variant ?? '' : '',
                !staticUnder ? cell.last_under_png ?? '' : '',
                !staticUnder ? cell.last_under_variant ?? '' : ''
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
            flatProps: geometry.flatProps,
            staticBillboards: geometry.staticBillboards,
            wallBatches: buildWallBatches(geometry.walls, map),
            floorBatches: buildFloorBatches(geometry.floors)
        };
    }

    return webglRoomGeometryCache;
}

function getActiveCameraYawDeg(playerObj) {
    return pointerLockEngaged || (typeof isMobile !== 'undefined' && isMobile)
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

function collect3DStatusMarkerDescriptors(currentLvl, playerObj) {
    const markers = [];
    if (!currentLvl || !Array.isArray(currentLvl.map)) return markers;

    for (const row of currentLvl.map) {
        if (!Array.isArray(row)) continue;
        for (const tile of row) {
            if (!tile || !tile.pos) continue;

            let markerSprite = null;
            if (tile.class === 'Plant') {
                const growthSprites = all_imgs[tile.png];
                if (Array.isArray(growthSprites) && tile.age === growthSprites.length - 2 &&
                    typeof done_dot !== 'undefined') markerSprite = done_dot;
            } else if (tile.class === 'NPC' && playerObj && playerObj.talking === 0) {
                const highlightedQuest = typeof shouldHighlightMrCInWorld === 'function' &&
                    shouldHighlightMrCInWorld(tile);
                const hasQuest = typeof tile.hasQuestForPlayer === 'function' && tile.hasQuestForPlayer();
                const hasGift = typeof tile.hasGiftForPlayer === 'function' && tile.hasGiftForPlayer();
                if ((highlightedQuest || hasQuest) && typeof quest_marker_img !== 'undefined') {
                    markerSprite = quest_marker_img;
                } else if (hasGift && typeof gift_indication_img !== 'undefined') {
                    markerSprite = gift_indication_img;
                }
            }

            if (!isValidWebglTextureSource(markerSprite)) continue;
            const entitySprite = getWebglBillboardSprite(tile);
            const entityHeight = isValidWebglTextureSource(entitySprite)
                ? entitySprite.height
                : tileSize;
            markers.push({
                worldX: tile.pos.x + tileSize / 2,
                worldY: entityHeight + markerSprite.height / 2,
                worldZ: tile.pos.y + tileSize / 2,
                width: markerSprite.width,
                height: markerSprite.height,
                sprite: markerSprite,
                statusMarker: true
            });
        }
    }

    return markers;
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
    three3DRenderer.autoClear = false;

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
    initializeThreeViewModel();
    return true;
}

function initializeThreeViewModel() {
    three3DViewModelScene = new THREE.Scene();
    three3DViewModelCamera = new THREE.PerspectiveCamera(
        52,
        canvasWidth / canvasHeight,
        0.05,
        10
    );
    three3DViewModelGroup = new THREE.Group();

    const skinMaterial = new THREE.MeshBasicMaterial({ color: 0xd89a70 });
    const skinSideMaterial = new THREE.MeshBasicMaterial({ color: 0xb96f52 });
    const sleeveMaterial = new THREE.MeshBasicMaterial({ color: 0x3477a8 });
    const armGeometry = new THREE.BoxGeometry(0.34, 0.34, 0.92);
    const hand = new THREE.Mesh(armGeometry, [
        skinSideMaterial, skinSideMaterial, skinMaterial,
        skinSideMaterial, skinMaterial, skinSideMaterial
    ]);
    hand.position.z = 0.08;
    three3DViewModelGroup.add(hand);

    const sleeve = new THREE.Mesh(
        new THREE.BoxGeometry(0.39, 0.39, 0.48),
        sleeveMaterial
    );
    sleeve.position.z = -0.56;
    three3DViewModelGroup.add(sleeve);

    three3DViewModelItemMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
    );
    three3DViewModelItemMesh.position.set(-0.12, 0.34, 0.34);
    three3DViewModelItemMesh.rotation.set(-0.16, 0.12, 0.17);
    three3DViewModelItemMesh.renderOrder = 2;
    three3DViewModelGroup.add(three3DViewModelItemMesh);
    three3DViewModelScene.add(three3DViewModelGroup);
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

function isAnimatedWebglSprite(sprite) {
    const gif = sprite && sprite.gifProperties;
    return !!gif && (
        (Array.isArray(gif.frames) && gif.frames.length > 1) ||
        (Number.isFinite(gif.numFrames) && gif.numFrames > 1)
    );
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
    const transparentSurface = kind === 'billboard' || kind === 'flatProp';
    if (!useTextures || !isValidWebglTextureSource(sprite)) {
        return getThreeFallbackMaterial(kind === 'wall' ? 0xcd5c48 : 0x563c28, transparentSurface);
    }

    let materials = three3DMaterialCache.get(sprite);
    if (!materials) {
        materials = {};
        three3DMaterialCache.set(sprite, materials);
    }
    if (materials[kind]) return materials[kind];

    materials[kind] = new THREE.MeshBasicMaterial({
        map: getThreeTexture(sprite),
        transparent: transparentSurface,
        alphaTest: 0.08,
        side: transparentSurface ? THREE.DoubleSide : THREE.FrontSide,
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
                kind === 'wall'
                    ? tileSize * WEBGL_WALL_HEIGHT_TILES / 2
                    : (kind === 'flatProp' ? tileSize * 0.06 : 0),
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
    addThreeInstancedTiles(roomGroup, geometry.flatProps, 'flatProp', useTextures);
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
    for (let i = 0; i < billboards.length; i++) {
        const billboard = billboards[i];
        let mesh = three3DBillboardPool[i];
        if (!mesh) {
            mesh = new THREE.Mesh();
            three3DBillboardPool.push(mesh);
            three3DBillboardGroup.add(mesh);
        }
        mesh.geometry = getThreeBillboardGeometry(billboard.width, billboard.height);
        mesh.material = getThreeMaterial(billboard.sprite, 'billboard', useTextures);
        // p5 advances an animated GIF on its backing canvas. Three.js does not
        // know that canvas changed, so explicitly upload the current GIF frame.
        if (useTextures && isAnimatedWebglSprite(billboard.sprite)) {
            const texture = getThreeTexture(billboard.sprite);
            if (texture) texture.needsUpdate = true;
        }
        mesh.visible = true;
        const centerY = Number.isFinite(billboard.worldY)
            ? billboard.worldY
            : billboard.height / 2;
        mesh.position.set(billboard.worldX, centerY, billboard.worldZ);
        mesh.lookAt(three3DCamera.position.x, mesh.position.y, three3DCamera.position.z);
    }
    for (let i = billboards.length; i < three3DBillboardPool.length; i++) {
        three3DBillboardPool[i].visible = false;
    }
}

function compositeThreeCanvas() {
    push();
    resetMatrix();
    noTint();
    drawingContext.drawImage(three3DRenderer.domElement, 0, 0, canvasWidth, canvasHeight);
    pop();
}

function get3DInteractionTarget(playerObj, levelX, levelY) {
    if (!playerObj || playerObj.talking != 0 || typeof playerObj.looking !== 'function') return null;
    const target = playerObj.looking(levelX, levelY);
    if (!target || !target.pos) return null;
    if (WEBGL_INTERACTION_CLASSES.has(target.class) || target.name === 'Job Board') return target;
    return null;
}

function render3DInteractionPrompt(playerObj, levelX, levelY) {
    const target = get3DInteractionTarget(playerObj, levelX, levelY);
    if (!target || typeof chat_icon === 'undefined' || !chat_icon ||
        !three3DCamera || typeof THREE === 'undefined') return;

    const sprite = getWebglBillboardSprite(target);
    const targetHeight = isValidWebglTextureSource(sprite) ? sprite.height : tileSize;
    const projected = new THREE.Vector3(
        target.pos.x + tileSize / 2,
        Math.min(tileSize * 0.8, targetHeight * 0.75),
        target.pos.y + tileSize / 2
    ).project(three3DCamera);
    if (projected.z < -1 || projected.z > 1) return;

    const screenX = Math.min(canvasWidth - 18, Math.max(18, (projected.x + 1) * canvasWidth / 2));
    const screenY = Math.min(canvasHeight - 18, Math.max(18, (1 - projected.y) * canvasHeight / 2));
    const keyLabel = String(
        typeof Controls_Interact_button_key !== 'undefined' && Controls_Interact_button_key
            ? Controls_Interact_button_key
            : 'E'
    );
    const promptWidth = 20 + Math.max(0, keyLabel.length - 1) * 12;
    const promptHeight = 20 + Math.max(0, keyLabel.length - 1) * 5;

    push();
    resetMatrix();
    imageMode(CENTER);
    noTint();
    image(chat_icon, screenX, screenY, promptWidth, promptHeight);
    fill(0);
    noStroke();
    textSize(10);
    textAlign(CENTER, CENTER);
    text(keyLabel, screenX, screenY - 1);
    pop();
}

function get3DHeldItemSprite(playerObj) {
    if (!playerObj || !Array.isArray(playerObj.inv)) return null;
    const heldItem = playerObj.inv[playerObj.hand];
    if (!heldItem || typeof heldItem.png !== 'number') return null;
    const sprite = all_imgs[heldItem.png];
    return isValidWebglTextureSource(sprite) ? sprite : null;
}

function isThreeViewModelMoving() {
    const keyboardMoving = typeof keyIsDown === 'function' &&
        typeof move_up_button !== 'undefined' &&
        (keyIsDown(move_up_button) || keyIsDown(move_down_button) ||
         keyIsDown(move_left_button) || keyIsDown(move_right_button));
    const virtualMoving = typeof virtualInput !== 'undefined' && virtualInput &&
        (virtualInput.up || virtualInput.down || virtualInput.left || virtualInput.right);
    return keyboardMoving || virtualMoving;
}

function isThreeViewModelUsingItem() {
    const keyboardUsing = typeof keyIsDown === 'function' &&
        typeof interact_button !== 'undefined' && keyIsDown(interact_button);
    const virtualUsing = typeof virtualInput !== 'undefined' && virtualInput &&
        virtualInput.interact;
    return keyboardUsing || virtualUsing;
}

function updateThreeViewModelItem(playerObj) {
    const sprite = get3DHeldItemSprite(playerObj);
    if (sprite === three3DViewModelItemSprite) return;
    three3DViewModelItemSprite = sprite;
    if (three3DViewModelItemMesh.material) three3DViewModelItemMesh.material.dispose();
    if (!sprite) {
        three3DViewModelItemMesh.visible = false;
        return;
    }

    three3DViewModelItemMesh.material = new THREE.MeshBasicMaterial({
        map: getThreeTexture(sprite),
        transparent: true,
        alphaTest: 0.08,
        side: THREE.DoubleSide,
        depthTest: true,
        depthWrite: true
    });
    const aspect = sprite.width / sprite.height;
    three3DViewModelItemMesh.scale.set(
        aspect >= 1 ? 0.82 : 0.82 * aspect,
        aspect >= 1 ? 0.82 / aspect : 0.82,
        1
    );
    three3DViewModelItemMesh.visible = true;
}

// Render a separate perspective hand/item scene after clearing only the world
// depth buffer. The arm and item therefore have real 3D foreshortening and can
// occlude each other, but walls can never cut through the player's hand.
function renderThreeViewModel(playerObj) {
    if (!three3DViewModelScene || !three3DViewModelGroup || !playerObj ||
        playerObj.dead || playerObj.talking ||
        (typeof paused !== 'undefined' && paused)) return false;

    updateThreeViewModelItem(playerObj);
    const now = typeof millis === 'function' ? millis() : 0;
    const reduceMotion = typeof shouldReduceMotion === 'function' && shouldReduceMotion();
    const actionHeld = isThreeViewModelUsingItem();
    if (actionHeld && !three3DViewModelActionHeld) three3DViewModelSwingStartedAt = now;
    three3DViewModelActionHeld = actionHeld;

    const moving = !reduceMotion && isThreeViewModelMoving();
    const walkPhase = moving ? now * 0.009 : 0;
    const swingProgress = reduceMotion
        ? 1
        : Math.min(1, Math.max(0, (now - three3DViewModelSwingStartedAt) / 280));
    const swing = swingProgress < 1 ? Math.sin(swingProgress * Math.PI) : 0;
    const bobX = moving ? Math.sin(walkPhase) * 0.045 : 0;
    const bobY = moving ? Math.abs(Math.cos(walkPhase)) * 0.05 : 0;

    three3DViewModelGroup.visible = true;
    three3DViewModelGroup.position.set(0.72 + bobX, -0.62 - bobY - swing * 0.2, -1.5 + swing * 0.16);
    three3DViewModelGroup.rotation.set(
        -0.48 - swing * 0.72,
        -0.34 + swing * 0.45,
        -0.24 - swing * 0.5 + (moving ? Math.sin(walkPhase) * 0.025 : 0)
    );

    three3DRenderer.clearDepth();
    three3DRenderer.render(three3DViewModelScene, three3DViewModelCamera);
    return true;
}

function render3DViewWebgl(playerObj, currentLvl, levelX, levelY, useTextures = true) {
    if (!playerObj || !currentLvl || !Array.isArray(currentLvl.map)) return;
    if (!initializeThree3DRenderer()) return;

    getThreeRoomGroup(currentLvl, levelX, levelY, useTextures);
    configureThreePlayerCamera(playerObj, currentLvl);
    renderThreeBillboards(
        three3DActiveRoom.geometry.staticBillboards
            .concat(collectBillboardDescriptors(currentLvl))
            .concat(collect3DStatusMarkerDescriptors(currentLvl, playerObj)),
        useTextures
    );
    three3DRenderer.clear(true, true, true);
    three3DRenderer.render(three3DScene, three3DCamera);
    renderThreeViewModel(playerObj);
    compositeThreeCanvas();
    render3DInteractionPrompt(playerObj, levelX, levelY);
}

// Point-collision test in continuous tile-space coordinates. Returns 'edge'
// outside the room, 'wall' for a solid in-room tile, and false for open floor.
function isPointBlocked(map, xTiles, yTiles, ignoredCell = null) {
    const col = Math.floor(xTiles);
    const row = Math.floor(yTiles);
    const mapRow = map[row];
    const cell = mapRow ? mapRow[col] : undefined;
    if (cell === undefined) return 'edge';
    // Numeric zero is empty/void in the authored maps, not traversable floor.
    // The 2D mover also requires a real tile object before allowing a step.
    if (cell === 0 || cell === null) return 'wall';
    // The 2D movement system marks the tile occupied by the player as solid
    // so NPCs cannot walk into it. Continuous 3D movement must ignore that
    // one exact object or every sub-tile step is rejected as self-collision.
    if (cell === ignoredCell) return false;
    if (cell !== 0 && cell.collide === true) return 'wall';
    return false;
}

// Keeps a small first-person camera radius away from wall faces. Room edges
// still use the center point so cross-room wrapping happens only after the
// camera reaches an entrance tile center, not when its radius touches one.
function testMovementPosition(map, xTiles, yTiles, radiusTiles, ignoredCell = null) {
    const center = isPointBlocked(map, xTiles, yTiles, ignoredCell);
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
        if (isPointBlocked(map, xTiles + offsetX, yTiles + offsetY, ignoredCell) === 'wall') {
            return 'wall';
        }
    }
    return false;
}

function moveWithSliding(map, xTiles, yTiles, deltaXTiles, deltaYTiles, radiusTiles = 0, ignoredCell = null) {
    let newX = xTiles;
    let newY = yTiles;
    let hitEdgeX = false;
    let hitEdgeY = false;

    if (deltaXTiles !== 0) {
        const xTest = testMovementPosition(map, xTiles + deltaXTiles, yTiles, radiusTiles, ignoredCell);
        if (xTest === 'edge') {
            hitEdgeX = true;
            newX = xTiles + deltaXTiles;
        } else if (xTest === false) {
            newX = xTiles + deltaXTiles;
        }
    }

    if (deltaYTiles !== 0) {
        const yTest = testMovementPosition(map, newX, yTiles + deltaYTiles, radiusTiles, ignoredCell);
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
    // Player positions are tile top-lefts, while 3D collision uses the camera
    // center. Cross at the final tile center and arrive at the corresponding
    // entrance tile center, preserving only the small transition overshoot.
    if (direction > 0) return valueTiles - limitTiles + 1;
    return limitTiles - 1 + valueTiles;
}

function snapToTileCenter(valueTiles, limitTiles) {
    const tileIndex = Math.floor(valueTiles);
    return Math.min(limitTiles - 0.5, Math.max(0.5, tileIndex + 0.5));
}

function findNearestWalkableGridCell(map, xTiles, yTiles, ignoredCell = null) {
    if (!Array.isArray(map)) return null;

    let best = null;
    for (let row = 0; row < map.length; row++) {
        if (!Array.isArray(map[row])) continue;
        for (let col = 0; col < map[row].length; col++) {
            const cell = map[row][col];
            if (!cell || (cell !== ignoredCell && cell.collide === true)) continue;

            const distanceSquared = ((col - xTiles) ** 2) + ((row - yTiles) ** 2);
            const cardinalDistance = Math.abs(col - xTiles) + Math.abs(row - yTiles);
            if (!best || distanceSquared < best.distanceSquared ||
                (distanceSquared === best.distanceSquared && cardinalDistance < best.cardinalDistance)) {
                best = { row, col, cell, distanceSquared, cardinalDistance };
            }
        }
    }
    return best;
}

function snapPlayerTo2DGrid(playerObj, level) {
    if (!playerObj || !playerObj.pos || !level || !Array.isArray(level.map)) return null;

    const occupiedCell = playerObj.touching && typeof playerObj.touching === 'object'
        ? playerObj.touching
        : null;
    const xTiles = playerObj.pos.x / tileSize;
    const yTiles = playerObj.pos.y / tileSize;
    const destination = findNearestWalkableGridCell(level.map, xTiles, yTiles, occupiedCell);
    if (!destination) return null;

    // Story-mode Player marks its occupied tile as collidable. Release that
    // marker before moving it; AutoFarm does not use an occupancy marker.
    if (occupiedCell && typeof playerObj.tileTouching === 'function') occupiedCell.collide = false;
    playerObj.pos.x = destination.col * tileSize;
    playerObj.pos.y = destination.row * tileSize;

    if (typeof playerObj.tileTouching === 'function') {
        playerObj.touching = playerObj.tileTouching(currentLevel_x, currentLevel_y);
        if (playerObj.touching && typeof playerObj.touching === 'object') {
            playerObj.touching.collide = true;
        }
    }
    return destination;
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

function configureGeneratedRightBridge(level, levelY) {
    if (!level || !Array.isArray(level.map)) return;

    // Match Player.move(): a room generated to the right always receives an
    // open entrance on its left edge, plus one randomized future exit.
    level.map[8][0] = new_tile_from_num(8, 0, 8 * tileSize);
    level.map[8][1] = new_tile_from_num(8, tileSize, 8 * tileSize);

    let randomBridge = floor(random(0, 3));
    if (levelY === 0) randomBridge = floor(random(1, 3));
    if (levelY === 2) randomBridge = floor(random(0, 2));

    if (randomBridge === 0) {
        level.map[0][11] = new_tile_from_num(94, 11 * tileSize, 0);
        level.map[1][11] = new_tile_from_num(9, 11 * tileSize, tileSize);
    } else if (randomBridge === 1) {
        level.map[8][22] = new_tile_from_num(93, 22 * tileSize, 8 * tileSize);
        level.map[8][21] = new_tile_from_num(8, 21 * tileSize, 8 * tileSize);
    } else {
        level.map[18][11] = new_tile_from_num(9, 11 * tileSize, 18 * tileSize);
        level.map[17][11] = new_tile_from_num(9, 11 * tileSize, 17 * tileSize);
        level.map[16][11] = new_tile_from_num(94, 11 * tileSize, 16 * tileSize);
        level.map[15][11] = new_tile_from_num(9, 11 * tileSize, 15 * tileSize);
    }
}

function ensureLevelExists(levelY, levelX, transitionAxis, direction) {
    if (!levels[levelY] || levelY < 0 || levelX < 0) return false;
    const existing = levels[levelY][levelX];
    if (existing && typeof existing === 'object') return true;
    if (existing === 0) return false;
    if (typeof extra_lvls === 'undefined') return false;

    // The original game only generates new rooms while moving right. Missing
    // vertical/left neighbors are blocked; generating them here was allowing
    // 3D players to leave the authored world and appear in unrelated areas.
    if (transitionAxis !== 'x' || direction <= 0) return false;

    extraCount++;
    levels[levelY][levelX] = new Level(
        'Extra y:' + levelY + ' x:' + (levelX - 6),
        JSON.parse(JSON.stringify(extra_lvls.map)),
        JSON.parse(JSON.stringify(extra_lvls.fore))
    );
    configureGeneratedRightBridge(levels[levelY][levelX], levelY);
    return true;
}

function getLevelEntryCell(level, transitionAxis, direction, lateralTiles) {
    if (!level || !Array.isArray(level.map) || level.map.length === 0) return undefined;
    if (transitionAxis === 'x') {
        const row = Math.min(level.map.length - 1, Math.max(0, Math.floor(lateralTiles)));
        const mapRow = level.map[row];
        if (!Array.isArray(mapRow) || mapRow.length === 0) return undefined;
        const column = direction > 0 ? 0 : mapRow.length - 1;
        return mapRow[column];
    }

    const row = direction > 0 ? 0 : level.map.length - 1;
    const mapRow = level.map[row];
    if (!Array.isArray(mapRow) || mapRow.length === 0) return undefined;
    const column = Math.min(mapRow.length - 1, Math.max(0, Math.floor(lateralTiles)));
    return mapRow[column];
}

function isOpenLevelEntry(level, transitionAxis, direction, lateralTiles) {
    const cell = getLevelEntryCell(level, transitionAxis, direction, lateralTiles);
    return !!cell && cell.collide !== true;
}

function updatePlayer3DMovementWebgl(playerObj) {
    const currentLvl = levels[currentLevel_y] ? levels[currentLevel_y][currentLevel_x] : null;
    if (!currentLvl || typeof currentLvl !== 'object' || !currentLvl.map) return;

    const stepTiles = MOVE_SPEED_TILES_PER_SEC * (deltaTime / 1000);
    // Keep movement aligned with the camera. Outside pointer lock (including
    // touch devices), the renderer uses the cardinal-facing fallback.
    const yawRad = (getActiveCameraYawDeg(playerObj) * Math.PI) / 180;
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
    const occupiedCell = playerObj.touching && typeof playerObj.touching === 'object'
        ? playerObj.touching
        : null;
    const result = moveWithSliding(
        currentLvl.map,
        originXTiles,
        originYTiles,
        moveX * stepTiles,
        moveY * stepTiles,
        PLAYER_COLLISION_RADIUS_TILES,
        occupiedCell
    );

    let finalXTiles = result.x;
    let finalYTiles = result.y;
    const roomWidthTiles = currentLvl.map.reduce(
        (width, row) => Math.max(width, Array.isArray(row) ? row.length : 0),
        0
    );
    const roomHeightTiles = currentLvl.map.length;
    const originLevelY = currentLevel_y;
    const originLevelX = currentLevel_x;

    let crossEdgeX = (moveX < 0 && result.x < 0.5) ||
        (moveX > 0 && result.x > roomWidthTiles - 0.5);
    let crossEdgeY = (moveY < 0 && result.y < 0.5) ||
        (moveY > 0 && result.y > roomHeightTiles - 0.5);

    // A diagonal step at a corner must never jump two rooms in one frame.
    if (crossEdgeX && crossEdgeY) {
        const xPenetration = moveX > 0
            ? result.x - (roomWidthTiles - 0.5)
            : 0.5 - result.x;
        const yPenetration = moveY > 0
            ? result.y - (roomHeightTiles - 0.5)
            : 0.5 - result.y;
        if (xPenetration >= yPenetration) crossEdgeY = false;
        else crossEdgeX = false;
    }

    if (crossEdgeX) {
        const dir = moveX > 0 ? 1 : -1;
        const targetY = originLevelY;
        const targetX = originLevelX + dir;
        const snappedY = snapToTileCenter(result.y, roomHeightTiles);
        if (ensureLevelExists(targetY, targetX, 'x', dir) &&
            isOpenLevelEntry(levels[targetY][targetX], 'x', dir, snappedY)) {
            resetLevelTransitionAnim(originLevelY, originLevelX);
            currentLevel_x = targetX;
            finalXTiles = wrapPositionAcrossEdge(result.x, roomWidthTiles, dir);
            finalYTiles = snappedY;
        } else {
            finalXTiles = dir > 0 ? roomWidthTiles - 0.5 : 0.5;
        }
    } else if (crossEdgeY) {
        const dir = moveY > 0 ? 1 : -1;
        const targetY = originLevelY + dir;
        const targetX = originLevelX;
        const snappedX = snapToTileCenter(result.x, roomWidthTiles);
        if (ensureLevelExists(targetY, targetX, 'y', dir) &&
            isOpenLevelEntry(levels[targetY][targetX], 'y', dir, snappedX)) {
            resetLevelTransitionAnim(originLevelY, originLevelX);
            currentLevel_y = targetY;
            finalYTiles = wrapPositionAcrossEdge(result.y, roomHeightTiles, dir);
            finalXTiles = snappedX;
        } else {
            finalYTiles = dir > 0 ? roomHeightTiles - 0.5 : 0.5;
        }
    }

    // Move the player occupancy marker without letting it participate in the
    // player collision query above. Other entities still see the new
    // occupied tile as solid, matching 2D-mode behavior.
    if (occupiedCell) occupiedCell.collide = false;
    playerObj.pos.x = finalXTiles * tileSize - tileSize / 2;
    playerObj.pos.y = finalYTiles * tileSize - tileSize / 2;
    if (typeof playerObj.tileTouching === 'function') {
        playerObj.touching = playerObj.tileTouching(currentLevel_x, currentLevel_y);
        if (playerObj.touching && typeof playerObj.touching === 'object') {
            playerObj.touching.collide = true;
        }
    }
}
