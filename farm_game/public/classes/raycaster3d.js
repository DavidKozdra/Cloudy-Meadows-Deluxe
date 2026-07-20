// GPU-rendered (WEBGL) first-person renderer for 3D Mode. During the staged
// rewrite this loads beside classes/raycaster.js so its movement helpers and
// entity classification remain available until the final cutover.

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

// Only the active room's derived descriptors are retained. Walls and floors
// are classified together in one scan when the level coordinates change, not
// once per rendered frame.
let webglRoomGeometryCache = {
    levelX: null,
    levelY: null,
    walls: [],
    floors: []
};

function getTileSprite(cell) {
    if (!cell || !all_imgs[cell.png]) return null;
    return all_imgs[cell.png][cell.variant] || all_imgs[cell.png][0] || null;
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

function getRoomGeometryForRoom(currentLvl, levelX, levelY) {
    if (webglRoomGeometryCache.levelX !== levelX || webglRoomGeometryCache.levelY !== levelY) {
        const geometry = buildRoomGeometryDescriptors(currentLvl && currentLvl.map);
        webglRoomGeometryCache = {
            levelX,
            levelY,
            walls: geometry.walls,
            floors: geometry.floors
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

function renderWallGeometry(walls, useTextures = true) {
    const wallHeight = tileSize * WEBGL_WALL_HEIGHT_TILES;

    webgl3DBuffer.noStroke();
    for (const wall of walls) {
        webgl3DBuffer.push();
        webgl3DBuffer.translate(
            (wall.xTiles + 0.5) * tileSize,
            -wallHeight / 2,
            (wall.yTiles + 0.5) * tileSize
        );

        if (useTextures && wall.sprite) {
            webgl3DBuffer.texture(wall.sprite);
        } else {
            webgl3DBuffer.fill(205, 92, 72);
        }
        webgl3DBuffer.box(tileSize, wallHeight, tileSize);
        webgl3DBuffer.pop();
    }
}

function renderFloorGeometry(floors, useTextures = true) {
    webgl3DBuffer.noStroke();
    for (const floorTile of floors) {
        webgl3DBuffer.push();
        webgl3DBuffer.translate(
            (floorTile.xTiles + 0.5) * tileSize,
            0,
            (floorTile.yTiles + 0.5) * tileSize
        );
        webgl3DBuffer.rotateX(Math.PI / 2);

        if (useTextures && floorTile.sprite) {
            webgl3DBuffer.texture(floorTile.sprite);
        } else {
            webgl3DBuffer.fill(86, 60, 40);
        }
        webgl3DBuffer.plane(tileSize, tileSize);
        webgl3DBuffer.pop();
    }
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
            if (!sprite || typeof sprite.width !== 'number' || typeof sprite.height !== 'number') continue;

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
    renderFloorGeometry(geometry.floors, useTextures);
    renderWallGeometry(geometry.walls, useTextures);
    renderBillboardGeometry(billboards, cameraYawDeg);
    webgl3DBuffer.pop();

    image(webgl3DBuffer, 0, 0);
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
