// First-person raycasted renderer for 3D Mode.
//
// Most of this module is a pure rendering alternative to the game's default
// top-down view: it reads the same `Level.map` grid and entity instances the
// 2D renderer uses without mutating game state. Free-look movement now lives
// in classes/raycaster3d.js with the replacement renderer.
//
// Facing/yaw convention: player.facing is 0=up,1=right,2=down,3=left.
// FACING_TO_YAW_DEG maps that to a world-angle convention where 0deg points
// along +x (right) and 90deg points along +y (down), matching typical
// screen-space DDA math. Getting this table backwards mirrors/rotates every
// wall 90 degrees off, so it's called out here explicitly.
// NOTE: this file loads before sketch.js (see index.html), which is where
// canvasWidth/canvasHeight/tileSize are declared. Nothing in this file may
// read those globals at module-evaluation time (top-level code) — only from
// inside functions, which run later, after sketch.js has executed.
const RAYCAST_CONFIG = Object.freeze({
    fovDegrees: 66,
    maxDepthTiles: 24, // > the diagonal of any 19x23 level
    floorColor: [86, 60, 40],
    ceilingColor: [135, 206, 235], // matches the 2D mode's background(135,206,235)
    billboardFacingIndex: 2, // always draw the "facing down / toward viewer" sprite variant
    billboardFovMarginDegrees: 10,
    // Screen columns per cast ray for the wall pass (1 ray drawn as a
    // sliceWidth-px-wide slice instead of 1px). Cuts castRay()/image()/
    // tint() calls ~3x. The depth buffer is still filled at full column
    // resolution regardless (see render3DView), so billboard occlusion
    // accuracy is unaffected — only wall/texture visual resolution coarsens.
    wallRayStride: 3,
    // Screen-pixel grid size (both axes) for floor-casting sample blocks.
    // Full per-pixel floor-casting would be ~224,000 image() calls/frame;
    // this samples on an 8x8 grid instead (~3,500 calls/frame), matching
    // the same "reduce ray count" tradeoff already made for walls. Divides
    // both canvasWidth (736) and the floor height (304) evenly.
    floorSampleStride: 8
});

// Solid fallback wall colors keyed by tile name, used instead of texture
// sampling (the top-down art wasn't authored for FPS wall columns). Any
// collidable tile name not listed here falls back to a neutral gray.
const TILE_WALL_COLORS = {
    wall: [150, 130, 110],
    satilite: [90, 90, 110],
    solarpanel: [40, 60, 90],
    lamppost: [110, 100, 80],
    cart_s: [120, 90, 60],
    bush: [60, 110, 60],
    hori_fence: [140, 120, 90],
    vert_fence: [140, 120, 90],
    top_right_corner_fence: [140, 120, 90],
    bottom_right_corner_fence: [140, 120, 90],
    top_left_corner_fence: [140, 120, 90],
    bottom_left_corner_fence: [140, 120, 90],
    tree_bottom: [90, 60, 40],
    water: [50, 90, 160],
    water12: [50, 90, 160],
    kitchen_tile: [180, 180, 180],
    table: [120, 90, 60],
    kitchen_counter: [160, 140, 110],
    bar_counter: [110, 70, 50],
    'Job Board': [130, 110, 90]
};
const DEFAULT_WALL_COLOR = [120, 120, 120];

// Entity classes that should render as billboards in 3D mode. Matches the
// runtime `this.class` values assigned in each tile_classes/*.js constructor.
const BILLBOARD_ENTITY_CLASSES = [
    'MovableEntity', 'NPC', 'Robot', 'FarmRobot', 'GridMoveEntity',
    'FreeMoveEntity', 'LightMoveEntity', 'PayToMoveEntity',
    'Shop', 'Chest', 'AirBallon', 'Plant'
];

// Entity (entity.js) hardcodes collide=true on every instance regardless of
// tile class — it's the base class movement collision relies on, so NPCs
// still physically block the player. But that means castRay(), which just
// checks `.collide`, would otherwise treat every NPC/Shop/Chest/etc. as an
// opaque wall and draw it as a flat slab instead of (or self-occludingly
// alongside) its billboard sprite. Used as castRay's skipCell predicate for
// the wall-rendering pass only — movement collision (isPointBlocked) does
// not use this, entities should still block walking through them.
function isBillboardEntityCell(cell) {
    return BILLBOARD_ENTITY_CLASSES.indexOf(cell.class) !== -1;
}

// Reused across frames so render3DView() doesn't allocate a new typed array
// 60 times a second.
let raycastDepthBuffer = null;

// Pure DDA (Digital Differential Analysis) grid raycaster. Takes explicit
// parameters only (no reads of player/levels/tileSize) so it can be unit
// tested in isolation against hand-built mock maps.
//
// map: 2D array map[row][col], each cell 0 (empty) or an object with
//      `.collide` (boolean).
// originXTiles/originYTiles: ray origin in fractional tile-space coords.
// angleDeg: absolute world angle for this ray (same convention as
//      FACING_TO_YAW_DEG: 0=+x/right, 90=+y/down).
// maxDepthTiles: step cap so a buggy/open map can't spin forever.
//
// Returns { distance, hitTile, side, wallX } or null if nothing was hit
// within maxDepthTiles. `distance` is the perpendicular distance to the hit
// (not Euclidean), which avoids fisheye distortion when projecting to screen
// height. `side` is 0 for an X-side (vertical wall face) hit, 1 for a
// Y-side (horizontal wall face) hit, used for cheap two-tone shading.
// `wallX` is the fractional position (0-1) across the hit wall face, used to
// pick which column of the wall's texture to sample.
//
// `skipCell` is an optional (cell) => boolean predicate for cells that
// should NOT stop the ray even though `.collide === true` — used by the
// wall-rendering pass to pass through billboarded entities (NPCs, robots,
// etc: Entity's base constructor hardcodes collide=true on every entity
// regardless of the `class`, since it's also used for movement collision;
// without this, every NPC/entity would render as an opaque wall slab
// instead of (or in addition to, self-occludingly) its billboard sprite).
// Movement collision (isPointBlocked, below) intentionally does NOT use
// this — entities should still physically block walking through them.
function castRay(map, originXTiles, originYTiles, angleDeg, maxDepthTiles, skipCell) {
    const angleRad = (angleDeg * Math.PI) / 180;
    const dirX = Math.cos(angleRad);
    const dirY = Math.sin(angleRad);

    let mapX = Math.floor(originXTiles);
    let mapY = Math.floor(originYTiles);

    const deltaDistX = dirX === 0 ? Infinity : Math.abs(1 / dirX);
    const deltaDistY = dirY === 0 ? Infinity : Math.abs(1 / dirY);

    let stepX, sideDistX;
    if (dirX < 0) {
        stepX = -1;
        sideDistX = (originXTiles - mapX) * deltaDistX;
    } else {
        stepX = 1;
        sideDistX = (mapX + 1 - originXTiles) * deltaDistX;
    }

    let stepY, sideDistY;
    if (dirY < 0) {
        stepY = -1;
        sideDistY = (originYTiles - mapY) * deltaDistY;
    } else {
        stepY = 1;
        sideDistY = (mapY + 1 - originYTiles) * deltaDistY;
    }

    let side = 0;
    for (let steps = 0; steps < maxDepthTiles; steps++) {
        if (sideDistX < sideDistY) {
            sideDistX += deltaDistX;
            mapX += stepX;
            side = 0;
        } else {
            sideDistY += deltaDistY;
            mapY += stepY;
            side = 1;
        }

        const row = map[mapY];
        const cell = row ? row[mapX] : undefined;

        if (cell === undefined) {
            // Ran off the edge of the map: treat as a boundary wall so the
            // loop terminates instead of reading undefined rows forever.
            const distance = side === 0
                ? (mapX - originXTiles + (1 - stepX) / 2) / dirX
                : (mapY - originYTiles + (1 - stepY) / 2) / dirY;
            const wallX = wallXFraction(originXTiles, originYTiles, dirX, dirY, Math.abs(distance), side);
            return { distance: Math.abs(distance), hitTile: null, side, wallX };
        }

        if (cell !== 0 && cell.collide === true && !(skipCell && skipCell(cell))) {
            const perpDist = side === 0
                ? (mapX - originXTiles + (1 - stepX) / 2) / dirX
                : (mapY - originYTiles + (1 - stepY) / 2) / dirY;
            const wallX = wallXFraction(originXTiles, originYTiles, dirX, dirY, Math.abs(perpDist), side);
            return { distance: Math.abs(perpDist), hitTile: cell, side, wallX };
        }
    }

    return null;
}

// Fractional position (0-1) across the hit wall's face, i.e. which column of
// the wall tile's texture to sample. Computed from the exact hit point along
// whichever axis wasn't the crossed one.
function wallXFraction(originXTiles, originYTiles, dirX, dirY, perpDistance, side) {
    let wallX;
    if (side === 0) {
        wallX = originYTiles + perpDistance * dirY;
    } else {
        wallX = originXTiles + perpDistance * dirX;
    }
    wallX -= Math.floor(wallX);
    return wallX;
}

// Pure: world tile-space point under screen pixel (col, row), for
// floor-casting. Returns null for any row at or above the horizon (no floor
// projection there). Takes only explicit parameters (no p5/global reads),
// same discipline as castRay(), so it's directly unit-testable.
//
// Unlike classic camera-plane floorcasting, this codebase generates ray
// angles by per-column linear interpolation of the angle itself (see the
// wall loop's `rayAngleDeg` formula), not a camera-plane offset vector.
// That means the "distance is constant across a whole screen row" shortcut
// from Lodev-style floorcasting doesn't carry over unchanged: perpDist IS
// constant per row (by the same similar-triangles projection already used
// for wallHeight), but converting that to a world (tileX, tileY) point
// still requires each column's own ray angle — there's no linear world-step
// shortcut here, the trig below is per-column, not per-row.
function computeFloorSampleWorldPos(originXTiles, originYTiles, yawDeg, fovDegrees,
                                     col, row, canvasWidth, canvasHeight, horizonY) {
    if (row <= horizonY) return null;

    const relativeAngleDeg = -fovDegrees / 2 + (col / canvasWidth) * fovDegrees;
    const rayAngleDeg = yawDeg + relativeAngleDeg;
    const perpDist = (canvasHeight / 2) / (row - horizonY);
    // Undo the perpendicular-distance projection to get true Euclidean
    // distance along the ray angle for this specific column (inverse of the
    // correction renderBillboards applies the other direction).
    const euclidDist = perpDist / Math.cos((relativeAngleDeg * Math.PI) / 180);
    const rayAngleRad = (rayAngleDeg * Math.PI) / 180;

    return {
        tileX: originXTiles + euclidDist * Math.cos(rayAngleRad),
        tileY: originYTiles + euclidDist * Math.sin(rayAngleRad),
        perpDist
    };
}

function getWallColor(hitTile) {
    if (!hitTile || !hitTile.name) return DEFAULT_WALL_COLOR;
    return TILE_WALL_COLORS[hitTile.name] || DEFAULT_WALL_COLOR;
}

function shadeColor(rgb, factor) {
    return [rgb[0] * factor, rgb[1] * factor, rgb[2] * factor];
}

// The actual tile sprite for a wall hit, matching the same indexing
// Tile.render() uses in 2D mode (all_imgs[png][variant]), so 3D Mode walls
// look like the 2D tile art instead of a flat placeholder color.
function getWallSprite(hitTile) {
    if (!hitTile || !hitTile.name) return null;
    const variants = all_imgs[hitTile.png];
    if (!variants) return null;
    return variants[hitTile.variant] || variants[0] || null;
}

// Floor-casting pass: samples the walkable-tile art (grass, tilled plots,
// dirt paths, water, etc.) on a coarse screen-space grid and blits it under
// the player's feet, replacing the flat floorColor fill in that area. Not
// per-pixel (see computeFloorSampleWorldPos's header comment for why the
// classic per-row linear-increment optimization doesn't apply here) — a
// RAYCAST_CONFIG.floorSampleStride x floorSampleStride grid instead, same
// "reduce ray count" tradeoff already made for walls. Misses (off-map,
// empty cell, no sprite) simply leave the flat floorColor rect visible
// underneath, already drawn by render3DView before this runs.
function renderFloorCasting(currentLvl, originXTiles, originYTiles, yawDeg, horizonY) {
    const stride = RAYCAST_CONFIG.floorSampleStride;
    const fov = RAYCAST_CONFIG.fovDegrees;
    const half = stride / 2;

    for (let row = horizonY; row < canvasHeight; row += stride) {
        for (let col = 0; col < canvasWidth; col += stride) {
            const sample = computeFloorSampleWorldPos(
                originXTiles, originYTiles, yawDeg, fov,
                col + half, row + half, canvasWidth, canvasHeight, horizonY
            );
            if (!sample) continue;

            const mapRow = currentLvl.map[Math.floor(sample.tileY)];
            const cell = mapRow ? mapRow[Math.floor(sample.tileX)] : undefined;
            if (!cell) continue;

            const sprite = getWallSprite(cell);
            if (!sprite || !sprite.width) continue;

            const fracX = sample.tileX - Math.floor(sample.tileX);
            const fracY = sample.tileY - Math.floor(sample.tileY);
            const srcX = Math.min(sprite.width - 1, Math.floor(fracX * sprite.width));
            const srcY = Math.min(sprite.height - 1, Math.floor(fracY * sprite.height));
            const fogFactor = Math.max(0.3, 1 - sample.perpDist / RAYCAST_CONFIG.maxDepthTiles);

            tint(255 * fogFactor, 255 * fogFactor, 255 * fogFactor);
            image(sprite, col, row, stride, stride, srcX, srcY, 1, 1);
        }
    }
    noTint();
}

// Frame entry point: draws the full first-person view (sky, floor, walls,
// billboarded entities) for the given player and current level.
function render3DView(playerObj, currentLvl) {
    if (!currentLvl || !currentLvl.map) return;

    const originXTiles = (playerObj.pos.x + tileSize / 2) / tileSize;
    const originYTiles = (playerObj.pos.y + tileSize / 2) / tileSize;
    // Desktop mouse-look drives the camera continuously while pointer-locked;
    // otherwise (mobile, or desktop before first engaging pointer lock) fall
    // back to the grid-snapped facing, matching pre-mouse-look behavior.
    // window.pointerLockEngaged (rather than the bare identifier) because
    // this file loads before sketch.js declares that var — see the note above
    // about canvasWidth/canvasHeight/tileSize for why that's safe here.
    const yawDeg = (typeof isMobile !== 'undefined' && !isMobile && window.pointerLockEngaged)
        ? playerObj.lookYawDeg
        : (FACING_TO_YAW_DEG[playerObj.facing] ?? 0);
    const horizonY = canvasHeight / 2;

    if (!raycastDepthBuffer || raycastDepthBuffer.length !== canvasWidth) {
        raycastDepthBuffer = new Float32Array(canvasWidth);
    }

    push();
    noStroke();

    fill(RAYCAST_CONFIG.ceilingColor);
    rect(0, 0, canvasWidth, horizonY);
    fill(RAYCAST_CONFIG.floorColor);
    rect(0, horizonY, canvasWidth, canvasHeight - horizonY);

    // Floor-casting must run BEFORE the wall loop below: wall slices extend
    // from the horizon down to horizonY + wallHeight/2, so if floor blocks
    // were drawn after, they'd paint texture over the bottom portion of any
    // visible wall. Walls are drawn on top of the floor, same ordering the
    // flat floorColor rect above already relies on.
    renderFloorCasting(currentLvl, originXTiles, originYTiles, yawDeg, horizonY);

    const fov = RAYCAST_CONFIG.fovDegrees;
    const wallStride = RAYCAST_CONFIG.wallRayStride;
    for (let col = 0; col < canvasWidth; col += wallStride) {
        // Last slice may be narrower than the stride (canvasWidth isn't
        // guaranteed to divide evenly, e.g. 736 % 3 == 1).
        const sliceWidth = Math.min(wallStride, canvasWidth - col);
        const rayAngleDeg = yawDeg - fov / 2 + (col / canvasWidth) * fov;
        const hit = castRay(
            currentLvl.map, originXTiles, originYTiles, rayAngleDeg, RAYCAST_CONFIG.maxDepthTiles,
            isBillboardEntityCell
        );

        // Depth buffer stays at FULL column resolution regardless of the
        // wall ray stride — renderBillboards() reads it per exact column
        // for occlusion, and a native typed-array range-fill is cheap, so
        // there's no reason to let billboard occlusion accuracy degrade
        // along with wall visual resolution.
        const distance = hit ? hit.distance : RAYCAST_CONFIG.maxDepthTiles;
        raycastDepthBuffer.fill(distance, col, col + sliceWidth);

        if (!hit) continue;

        const wallHeight = Math.min(canvasHeight * 3, canvasHeight / Math.max(hit.distance, 0.0001));
        const sideShade = hit.side === 1 ? 0.75 : 1;
        const fogFactor = Math.max(0.3, 1 - hit.distance / RAYCAST_CONFIG.maxDepthTiles);
        const shadeFactor = sideShade * fogFactor;

        const sprite = getWallSprite(hit.hitTile);
        if (sprite && sprite.width) {
            const srcX = Math.min(sprite.width - 1, Math.floor(hit.wallX * sprite.width));
            tint(255 * shadeFactor, 255 * shadeFactor, 255 * shadeFactor);
            image(sprite, col, horizonY - wallHeight / 2, sliceWidth, wallHeight, srcX, 0, 1, sprite.height);
            noTint();
        } else {
            const color = shadeColor(getWallColor(hit.hitTile), shadeFactor);
            fill(color[0], color[1], color[2]);
            rect(col, horizonY - wallHeight / 2, sliceWidth, wallHeight);
        }
    }

    pop();

    renderBillboards(playerObj, currentLvl, originXTiles, originYTiles, yawDeg, raycastDepthBuffer, horizonY);

    // Desktop-only affordance: prompt for pointer lock when it isn't engaged
    // yet, drawn directly on the canvas rather than as a separate DOM overlay
    // (consistent with 3D Mode's pure-canvas rendering, no z-index concerns).
    if (typeof isMobile !== 'undefined' && !isMobile && !window.pointerLockEngaged) {
        push();
        noStroke();
        fill(0, 0, 0, 150);
        rect(0, canvasHeight - 40, canvasWidth, 40);
        fill(255);
        textAlign(CENTER, CENTER);
        textSize(16);
        text('Click to enable mouse look', canvasWidth / 2, canvasHeight - 20);
        pop();
    }
}

function normalizeAngleDeg(angleDeg) {
    let a = angleDeg % 360;
    if (a > 180) a -= 360;
    if (a < -180) a += 360;
    return a;
}

// Resolves the sprite image to draw for a billboarded entity, mirroring
// the indexing each entity class's own render() uses, but always sampling
// the fixed "facing toward viewer" variant instead of the entity's actual
// facing (these are 4-directional top-down sprites, not true 3D-consistent
// art, so a fixed viewer-facing frame reads better than trying to pick a
// relative angle-correct one).
function getBillboardSprite(tile) {
    if (!all_imgs[tile.png]) return null;

    if (tile.class === 'Plant') {
        return all_imgs[tile.png][tile.age] || null;
    }

    const facingIndexed = all_imgs[tile.png][RAYCAST_CONFIG.billboardFacingIndex];
    if (Array.isArray(facingIndexed)) {
        // MovableEntity-derived: all_imgs[png][facing][frame]
        return facingIndexed[0] || null;
    }

    // Static Entity-direct classes (Shop/Chest/AirBallon): all_imgs[png] is
    // the sprite itself, not an array indexed by facing.
    if (typeof all_imgs[tile.png].width === 'number' || typeof all_imgs[tile.png].get === 'function') {
        return all_imgs[tile.png];
    }

    // Tile-style variant array: all_imgs[png][variant]
    return all_imgs[tile.png][tile.variant] || all_imgs[tile.png][0] || null;
}

// Billboard sprite pass: projects every entity in the current level into
// the raycaster's screen space, culls anything outside the FOV, sorts
// back-to-front, and draws each as a screen-facing sprite occluded by the
// wall depth buffer from the same frame's render3DView() pass.
function renderBillboards(playerObj, currentLvl, originXTiles, originYTiles, yawDeg, depthBuffer, horizonY) {
    const fov = RAYCAST_CONFIG.fovDegrees;
    const halfFovWithMargin = fov / 2 + RAYCAST_CONFIG.billboardFovMarginDegrees;

    const candidates = [];
    for (let row = 0; row < currentLvl.map.length; row++) {
        for (let col = 0; col < currentLvl.map[row].length; col++) {
            const tile = currentLvl.map[row][col];
            if (!tile || tile === 0) continue;
            if (BILLBOARD_ENTITY_CLASSES.indexOf(tile.class) === -1) continue;

            const tileXTiles = (tile.pos.x + tileSize / 2) / tileSize;
            const tileYTiles = (tile.pos.y + tileSize / 2) / tileSize;
            const dx = tileXTiles - originXTiles;
            const dy = tileYTiles - originYTiles;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 0.0001) continue;

            const angleToTileDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
            const relativeAngle = normalizeAngleDeg(angleToTileDeg - yawDeg);
            if (Math.abs(relativeAngle) > halfFovWithMargin) continue;

            candidates.push({ tile, distance, relativeAngle });
        }
    }

    candidates.sort((a, b) => b.distance - a.distance);

    push();
    imageMode(CENTER);
    for (const candidate of candidates) {
        const { tile, distance, relativeAngle } = candidate;
        const screenX = ((relativeAngle + fov / 2) / fov) * canvasWidth;
        const col = Math.max(0, Math.min(canvasWidth - 1, Math.floor(screenX)));

        // depthBuffer holds PERPENDICULAR wall distance (castRay's fisheye
        // correction), but `distance` here is true Euclidean distance to the
        // entity. Comparing them directly under-occludes correctly-visible
        // entities off dead-center, since Euclidean > perpendicular for any
        // non-zero relative angle. Convert to the same convention before
        // comparing.
        const perpDistance = distance * Math.cos((relativeAngle * Math.PI) / 180);

        if (perpDistance >= depthBuffer[col]) continue;

        const sprite = getBillboardSprite(tile);
        if (!sprite) continue;

        const spriteScale = Math.min(canvasHeight * 3, canvasHeight / Math.max(perpDistance, 0.0001));
        image(sprite, screenX, horizonY, spriteScale, spriteScale);
    }
    pop();
}

// --- Free-look movement (desktop mouse-look only) ---------------------------
//
// Everything below this point is the exception to this file's "pure
// rendering" rule noted in the header comment: it mutates player.pos,
// player.facing, currentLevel_x/currentLevel_y, and levels[][], as an
// additive path used only when desktop pointer-lock mouse-look is active.
// Player.move() (the grid-snapped 2D equivalent) is never called from here
// and is never modified by this code.

const LEGACY_MOVE_SPEED_TILES_PER_SEC = 4;

// Point-collision test in continuous tile-space coordinates. Mirrors the
// `cell !== 0 && cell.collide === true` pattern castRay() already uses,
// extended with explicit tri-state bounds handling: 'edge' means the point
// fell outside this room's map array (caller decides whether that's a room
// transition or a refusal), 'wall' means an in-room solid tile, false means
// clear to move.
function isPointBlocked(map, xTiles, yTiles) {
    const col = Math.floor(xTiles);
    const row = Math.floor(yTiles);
    const mapRow = map[row];
    const cell = mapRow ? mapRow[col] : undefined;
    if (cell === undefined) return 'edge';
    if (cell !== 0 && cell.collide === true) return 'wall';
    return false;
}

// Per-axis sweep-and-slide: attempts the X move, then the Y move against the
// (possibly already-updated) X position. Correct and simplest given walls
// are always axis-aligned unit tiles — gives free wall-sliding with no
// swept-AABB math. Treats the player as a single point at cell-center
// (matching render3DView's originXTiles/YTiles convention), not a radius.
// 'edge' results are let through provisionally so the caller can read how
// far past the boundary the point travelled, for overshoot-preserving
// room-transition repositioning.
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
        // xTest === 'wall': newX stays unchanged (axis cancelled)
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

// Given a tile-space coordinate that has run past [0, limitTiles) in one
// direction, returns the equivalent coordinate just past the opposite edge
// of the neighboring room, preserving the overshoot so fast movement doesn't
// visibly snap at the boundary.
function wrapPositionAcrossEdge(valueTiles, limitTiles, direction) {
    if (direction > 0) {
        return valueTiles - limitTiles;
    }
    return limitTiles + valueTiles;
}

// Resets the per-level transition-animation state Player.move() clears on
// every room change (level.js fields driving the slide-in title-card
// animation), plus the level_name_popup toggle. Extracted since it's pure
// state reset with no branching, unlike Extra-level generation below.
function resetLevelTransitionAnim(levelY, levelX) {
    const lvl = levels[levelY] ? levels[levelY][levelX] : null;
    if (!lvl || typeof lvl !== 'object') return;
    lvl.level_name_popup = false;
    lvl.y = -50;
    lvl.done = false;
    lvl.movephase = 0;
    lvl.ticks = 0;
}

// Ensures levels[levelY][levelX] is a valid, enterable Level, auto-generating
// a filler "Extra" level (the same constructor call Player.move() uses) if
// the slot is undefined but in-bounds of the levels meta-array. Unlike
// move(), this is symmetric across all 4 directions (move() refuses to
// auto-generate when crossing left) — an intentional, more permissive
// behavior for free-look exploration, not a bug to match. Does not replicate
// move()'s per-direction randomized bridge-tile patches: a continuous
// free-look crossing point won't line up with where those tiles were placed
// anyway, so the generated Extra level is walkable but visually plainer at
// its bridge seams — a known, acceptable minor gap, not a correctness bug.
// Returns false if the slot is explicitly blocked (0) or out of the levels
// meta-array's bounds entirely.
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

// Called once per frame from takeInput() when desktop mouse-look free
// movement is active (is3DMode && !isMobile && pointerLockEngaged). Moves
// playerObj.pos continuously relative to playerObj.lookYawDeg, with per-axis
// wall-sliding collision and seamless room-to-room transitions at map edges.
function updatePlayer3DMovement(playerObj) {
    const currentLvl = levels[currentLevel_y] ? levels[currentLevel_y][currentLevel_x] : null;
    if (!currentLvl || typeof currentLvl !== 'object' || !currentLvl.map) return;

    const stepTiles = LEGACY_MOVE_SPEED_TILES_PER_SEC * (deltaTime / 1000);
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
    // Captured before either branch below can mutate currentLevel_x/y, so a
    // same-frame diagonal double-edge-cross resets the animation state of
    // the room the player was actually leaving, not a room already switched
    // into by the other axis's branch.
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
        // Use currentLevel_x (not originLevelX) as the column: if hitEdgeX
        // already ran above, currentLevel_x reflects the room the player is
        // actually standing in NOW, and this Y-transition must check/create
        // the neighbor of THAT room, not the pre-X-transition one — using
        // originLevelX here would check/create the wrong diagonal neighbor
        // and leave currentLevel_y/currentLevel_x pointing at a slot that
        // was never actually verified to exist (the crash this fixes).
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
