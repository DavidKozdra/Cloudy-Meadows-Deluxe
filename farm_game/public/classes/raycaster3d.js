// GPU-rendered (WEBGL) first-person renderer for 3D Mode. Owns scene geometry,
// camera setup, entity billboards, and continuous free-look movement.

const WEBGL_WALL_HEIGHT_TILES = 1;
const WEBGL_FOV_DEGREES = 66;
const MOVE_SPEED_TILES_PER_SEC = 4;

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
    wallBatches: [],
    floorBatches: []
};

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

function buildRoomGeometryDescriptors(map) {
    const walls = [];
    const floors = [];
    if (!Array.isArray(map)) return { walls, floors };

    for (let row = 0; row < map.length; row++) {
        const mapRow = map[row];
        if (!Array.isArray(mapRow)) continue;

        for (let column = 0; column < mapRow.length; column++) {
            const cell = mapRow[column];
            if (!cell) continue;

            if (cell.collide === true && !isWebglBillboardEntityCell(cell)) {
                walls.push({
                    xTiles: column,
                    yTiles: row,
                    sprite: getTileSprite(cell)
                });
            } else {
                floors.push({
                    xTiles: column,
                    yTiles: row,
                    sprite: getFloorTileSprite(cell)
                });
            }
        }
    }

    return { walls, floors };
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
                cell.class || '', cell.collide === true ? 1 : 0,
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
    return !!cell && cell.collide === true && !isWebglBillboardEntityCell(cell);
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
            wallBatches: buildWallBatches(geometry.walls, map),
            floorBatches: buildFloorBatches(geometry.floors)
        };
    }

    return webglRoomGeometryCache;
}

function configurePlayerCamera(playerObj, currentLvl) {
    const rows = currentLvl.map.length;
    const columns = currentLvl.map.reduce((width, row) => Math.max(width, row.length), 0);
    const roomWidth = columns * tileSize;
    const roomDepth = rows * tileSize;
    const maxDimension = Math.max(roomWidth, roomDepth, tileSize);
    const eyeX = playerObj.pos.x + tileSize / 2;
    const eyeY = -tileSize * WEBGL_WALL_HEIGHT_TILES / 2;
    const eyeZ = playerObj.pos.y + tileSize / 2;
    const yawDeg = getActiveCameraYawDeg(playerObj);
    const yawRad = yawDeg * Math.PI / 180;

    webgl3DBuffer.perspective(
        WEBGL_FOV_DEGREES * Math.PI / 180,
        webgl3DBuffer.width / webgl3DBuffer.height,
        0.1,
        maxDimension * 5
    );
    webgl3DBuffer.camera(
        eyeX,
        eyeY,
        eyeZ,
        eyeX + Math.cos(yawRad),
        eyeY,
        eyeZ + Math.sin(yawRad),
        0,
        1,
        0
    );
}

function getActiveCameraYawDeg(playerObj) {
    return pointerLockEngaged
        ? playerObj.lookYawDeg
        : (FACING_TO_YAW_DEG[playerObj.facing] ?? 0);
}

function renderTriangleBatches(batches, useTextures, fallbackColor) {
    for (const batch of batches) {
        webgl3DBuffer.beginShape(TRIANGLES);
        if (useTextures && isValidWebglTextureSource(batch.sprite)) {
            webgl3DBuffer.texture(batch.sprite);
        } else {
            webgl3DBuffer.fill(...fallbackColor);
        }
        for (let i = 0; i < batch.vertices.length; i += 5) {
            webgl3DBuffer.vertex(
                batch.vertices[i], batch.vertices[i + 1], batch.vertices[i + 2],
                batch.vertices[i + 3], batch.vertices[i + 4]
            );
        }
        webgl3DBuffer.endShape();
    }
}

function renderBaseFloor(currentLvl) {
    const rows = currentLvl.map.length;
    const columns = currentLvl.map.reduce((width, row) => Math.max(width, row.length), 0);
    if (!rows || !columns) return;

    // The 2D game exposes the Skyline background wherever map cells are 0.
    // The old raycaster supplied a brown fallback floor beneath those gaps;
    // without this plane the WEBGL buffer showed only its blue clear color.
    webgl3DBuffer.push();
    webgl3DBuffer.fill(86, 60, 40);
    webgl3DBuffer.translate(columns * tileSize / 2, 0.05, rows * tileSize / 2);
    webgl3DBuffer.rotateX(Math.PI / 2);
    webgl3DBuffer.plane(columns * tileSize, rows * tileSize);
    webgl3DBuffer.pop();
}

function renderWallGeometry(wallBatches, useTextures = true) {
    webgl3DBuffer.noStroke();
    renderTriangleBatches(wallBatches, useTextures, [205, 92, 72]);
}

function renderFloorGeometry(floorBatches, useTextures = true) {
    webgl3DBuffer.noStroke();
    renderTriangleBatches(floorBatches, useTextures, [86, 60, 40]);
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

function renderBillboardGeometry(billboards, cameraYawDeg) {
    const cameraYawRad = cameraYawDeg * Math.PI / 180;

    webgl3DBuffer.noStroke();
    for (const billboard of billboards) {
        webgl3DBuffer.push();
        webgl3DBuffer.translate(
            billboard.worldX,
            -billboard.height / 2,
            billboard.worldZ
        );
        // A p5 plane starts in XY with its front normal along +Z. The first
        // quarter-turn makes it vertical-facing along -X at yaw 0; the yaw
        // turn keeps that front face aimed back toward the camera.
        webgl3DBuffer.rotateY(-Math.PI / 2);
        webgl3DBuffer.rotateY(-cameraYawRad);
        webgl3DBuffer.texture(billboard.sprite);
        webgl3DBuffer.plane(billboard.width, billboard.height);
        webgl3DBuffer.pop();
    }
}

function render3DViewWebgl(playerObj, currentLvl, levelX, levelY, useTextures = true) {
    if (!webgl3DBuffer || !playerObj || !currentLvl || !Array.isArray(currentLvl.map)) return;

    const geometry = getRoomGeometryForRoom(currentLvl, levelX, levelY);
    const cameraYawDeg = getActiveCameraYawDeg(playerObj);
    const billboards = collectBillboardDescriptors(currentLvl);

    webgl3DBuffer.background(135, 206, 235);
    webgl3DBuffer.push();
    configurePlayerCamera(playerObj, currentLvl);
    webgl3DBuffer.textureMode(NORMAL);
    renderBaseFloor(currentLvl);
    renderFloorGeometry(geometry.floorBatches, useTextures);
    renderWallGeometry(geometry.wallBatches, useTextures);
    renderBillboardGeometry(billboards, cameraYawDeg);
    webgl3DBuffer.textureMode(IMAGE);
    webgl3DBuffer.pop();

    // Composite through the main 2D renderer without depending on, or
    // mutating, any imageMode/tint state used by the screen-space overlays.
    push();
    imageMode(CORNER);
    noTint();
    image(webgl3DBuffer, 0, 0);
    pop();
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

function moveWithSliding(map, xTiles, yTiles, deltaXTiles, deltaYTiles) {
    let newX = xTiles;
    let newY = yTiles;
    let hitEdgeX = false;
    let hitEdgeY = false;

    if (deltaXTiles !== 0) {
        const xTest = isPointBlocked(map, xTiles + deltaXTiles, yTiles);
        if (xTest === 'edge') {
            hitEdgeX = true;
            newX = xTiles + deltaXTiles;
        } else if (xTest === false) {
            newX = xTiles + deltaXTiles;
        }
    }

    if (deltaYTiles !== 0) {
        const yTest = isPointBlocked(map, newX, yTiles + deltaYTiles);
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

    const originXTiles = (playerObj.pos.x + tileSize / 2) / tileSize;
    const originYTiles = (playerObj.pos.y + tileSize / 2) / tileSize;
    const result = moveWithSliding(currentLvl.map, originXTiles, originYTiles, moveX * stepTiles, moveY * stepTiles);

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
