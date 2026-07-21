'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const { readPublic, extractFunction } = require('./support/load');

const source = readPublic('classes/raycaster3d.js');
const sandbox = { pointerLockEngaged: true };
vm.runInNewContext(
    [
        extractFunction(source, 'normalizeAngleDeg0to360'),
        extractFunction(source, 'nearestCardinalFacingFromYaw'),
        extractFunction(source, 'getActiveCameraYawDeg'),
        extractFunction(source, 'isPointBlocked'),
        extractFunction(source, 'testMovementPosition'),
        extractFunction(source, 'moveWithSliding'),
        extractFunction(source, 'wrapPositionAcrossEdge'),
        extractFunction(source, 'updatePlayer3DMovementWebgl'),
        // nearestCardinalFacingFromYaw() reads these two top-level consts.
        'const YAW_TO_FACING = { 0: 1, 90: 2, 180: 3, 270: 0 };',
        'const FACING_TO_YAW_DEG = [270, 0, 90, 180];',
        'const MOVE_SPEED_TILES_PER_SEC = 4;',
        'const PLAYER_COLLISION_RADIUS_TILES = 0.2;',
        'globalThis.normalizeAngleDeg0to360 = normalizeAngleDeg0to360;',
        'globalThis.nearestCardinalFacingFromYaw = nearestCardinalFacingFromYaw;',
        'globalThis.isPointBlocked = isPointBlocked;',
        'globalThis.moveWithSliding = moveWithSliding;',
        'globalThis.wrapPositionAcrossEdge = wrapPositionAcrossEdge;',
        'globalThis.updatePlayer3DMovementWebgl = updatePlayer3DMovementWebgl;'
    ].join('\n'),
    sandbox
);
const {
    normalizeAngleDeg0to360,
    nearestCardinalFacingFromYaw,
    isPointBlocked,
    moveWithSliding,
    wrapPositionAcrossEdge
} = sandbox;

const WALL = { collide: true };
const FLOOR = { collide: false };

function corridorMap(width, height) {
    const map = [];
    for (let row = 0; row < height; row++) {
        const rowTiles = [];
        for (let col = 0; col < width; col++) {
            const isBorder = row === 0 || row === height - 1 || col === 0 || col === width - 1;
            rowTiles.push(isBorder ? WALL : FLOOR);
        }
        map.push(rowTiles);
    }
    return map;
}

test('normalizeAngleDeg0to360 wraps negative and overflowing angles into [0, 360)', () => {
    assert.equal(normalizeAngleDeg0to360(-10), 350);
    assert.equal(normalizeAngleDeg0to360(370), 10);
    assert.equal(normalizeAngleDeg0to360(360), 0);
    assert.equal(normalizeAngleDeg0to360(180), 180);
});

test('nearestCardinalFacingFromYaw snaps to the closest of the 4 cardinal facings', () => {
    assert.equal(nearestCardinalFacingFromYaw(0), 1); // right
    assert.equal(nearestCardinalFacingFromYaw(90), 2); // down
    assert.equal(nearestCardinalFacingFromYaw(180), 3); // left
    assert.equal(nearestCardinalFacingFromYaw(270), 0); // up
    assert.equal(nearestCardinalFacingFromYaw(44), 1); // closer to 0 (right)
    assert.equal(nearestCardinalFacingFromYaw(46), 2); // closer to 90 (down)
    assert.equal(nearestCardinalFacingFromYaw(359), 1); // wraps to 0 (right)
});

test('isPointBlocked reports floor, wall, and edge cases', () => {
    const map = corridorMap(5, 5);
    assert.equal(isPointBlocked(map, 2.5, 2.5), false);
    assert.equal(isPointBlocked(map, 0.5, 0.5), 'wall');
    assert.equal(isPointBlocked(map, -0.5, 2.5), 'edge');
    assert.equal(isPointBlocked(map, 2.5, 10), 'edge');
});

test('moveWithSliding moves freely across open floor', () => {
    const map = corridorMap(7, 7);
    const result = moveWithSliding(map, 3, 3, 0.5, 0.5);
    assert.equal(result.x, 3.5);
    assert.equal(result.y, 3.5);
    assert.equal(result.hitEdgeX, false);
    assert.equal(result.hitEdgeY, false);
});

test('moveWithSliding cancels the blocked axis and slides along the wall', () => {
    // 5x5 room, walls on the border. Player near the right wall trying to
    // move right (blocked) and down (open) should slide down without being
    // blocked by the unrelated X collision.
    const map = corridorMap(5, 5);
    const result = moveWithSliding(map, 3.9, 2, 0.5, 0.5);
    assert.equal(result.x, 3.9, 'X movement into the wall is cancelled');
    assert.equal(result.y, 2.5, 'Y movement still slides through');
    assert.equal(result.hitEdgeX, false);
    assert.equal(result.hitEdgeY, false);
});

test('moveWithSliding stops fully in a corner when both axes are blocked', () => {
    const map = corridorMap(5, 5);
    const result = moveWithSliding(map, 3.9, 3.9, 0.5, 0.5);
    assert.equal(result.x, 3.9);
    assert.equal(result.y, 3.9);
});

test('moveWithSliding keeps the first-person camera radius away from a wall face', () => {
    const map = corridorMap(5, 5);
    const pointResult = moveWithSliding(map, 3.6, 2.5, 0.25, 0);
    const radiusResult = moveWithSliding(map, 3.6, 2.5, 0.25, 0, 0.2);

    assert.equal(pointResult.x, 3.85, 'point collision can approach the wall closely');
    assert.equal(radiusResult.x, 3.6, 'camera radius rejects the same near-wall step');
});

test('moveWithSliding reports hitEdgeX/hitEdgeY when a point runs off the map', () => {
    const map = corridorMap(5, 5).map(row => row.map(() => FLOOR));
    const result = moveWithSliding(map, 4.8, 2, 0.5, 0);
    assert.equal(result.hitEdgeX, true);
    assert.ok(result.x > 5, 'overshoot past the edge is preserved, not clamped');
});

test('wrapPositionAcrossEdge preserves overshoot when crossing the positive edge', () => {
    // Crossed the right edge (limit=5) by 0.3 tiles -> enters next room 0.3
    // tiles past its left edge.
    assert.ok(Math.abs(wrapPositionAcrossEdge(5.3, 5, 1) - 0.3) < 1e-9);
});

test('wrapPositionAcrossEdge preserves overshoot when crossing the negative edge', () => {
    // Crossed the left edge by 0.3 tiles (value went negative) -> enters the
    // previous room 0.3 tiles short of its right edge.
    assert.ok(Math.abs(wrapPositionAcrossEdge(-0.3, 5, -1) - 4.7) < 1e-9);
});

test('frame movement follows continuous yaw and updates player position', () => {
    const map = Array.from({ length: 5 }, () =>
        Array.from({ length: 5 }, () => FLOOR)
    );
    Object.assign(sandbox, {
        levels: [[{ map }]],
        currentLevel_x: 0,
        currentLevel_y: 0,
        deltaTime: 250,
        tileSize: 32,
        canvasWidth: 160,
        canvasHeight: 160,
        virtualInput: { up: true, down: false, left: false, right: false },
        move_up_button: 87,
        move_down_button: 83,
        move_left_button: 65,
        move_right_button: 68,
        keyIsDown: () => false
    });
    const player = { pos: { x: 32, y: 32 }, lookYawDeg: 0 };

    sandbox.updatePlayer3DMovementWebgl(player);

    assert.equal(player.pos.x, 64, 'yaw 0 forward movement advances one tile along +X');
    assert.equal(player.pos.y, 32);
});

test('3D movement ignores the player occupancy tile without ignoring real walls', () => {
    const map = Array.from({ length: 5 }, () =>
        Array.from({ length: 5 }, () => ({ collide: false }))
    );
    const occupiedCell = map[1][1];
    occupiedCell.collide = true;
    Object.assign(sandbox, {
        levels: [[{ map }]],
        currentLevel_x: 0,
        currentLevel_y: 0,
        deltaTime: 16,
        tileSize: 32,
        canvasWidth: 160,
        canvasHeight: 160,
        virtualInput: { up: true, down: false, left: false, right: false },
        move_up_button: 87,
        move_down_button: 83,
        move_left_button: 65,
        move_right_button: 68,
        keyIsDown: () => false,
        pointerLockEngaged: true
    });
    const player = {
        pos: { x: 32, y: 32 },
        facing: 1,
        lookYawDeg: 0,
        touching: occupiedCell,
        tileTouching() {
            return map[Math.round(this.pos.y / 32)][Math.round(this.pos.x / 32)];
        }
    };

    sandbox.updatePlayer3DMovementWebgl(player);

    assert.ok(player.pos.x > 32, 'a sub-tile step can leave the player-owned collision cell');
    assert.equal(player.touching.collide, true, 'the current tile remains occupied for NPC collision');

    map[1][2].collide = true;
    const blocked = sandbox.moveWithSliding(map, 1.75, 1.5, 0.1, 0, 0.2, occupiedCell);
    assert.equal(blocked.x, 1.75, 'an unrelated wall is still solid');
});

test('movement follows the visible cardinal camera when pointer lock is disengaged', () => {
    const map = Array.from({ length: 5 }, () =>
        Array.from({ length: 5 }, () => FLOOR)
    );
    Object.assign(sandbox, {
        levels: [[{ map }]],
        currentLevel_x: 0,
        currentLevel_y: 0,
        deltaTime: 250,
        tileSize: 32,
        canvasWidth: 160,
        canvasHeight: 160,
        virtualInput: { up: true, down: false, left: false, right: false },
        move_up_button: 87,
        move_down_button: 83,
        move_left_button: 65,
        move_right_button: 68,
        keyIsDown: () => false,
        pointerLockEngaged: false
    });
    const player = { pos: { x: 32, y: 32 }, facing: 2, lookYawDeg: 0 };

    sandbox.updatePlayer3DMovementWebgl(player);

    assert.equal(player.pos.x, 32, 'stale free-look yaw is ignored outside pointer lock');
    assert.equal(player.pos.y, 64, 'facing down moves forward along the visible +Y direction');
});
