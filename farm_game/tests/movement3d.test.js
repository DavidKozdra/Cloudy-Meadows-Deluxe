'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const { readPublic, extractFunction } = require('./support/load');

const source = readPublic('classes/raycaster.js');
const sandbox = {};
vm.runInNewContext(
    [
        extractFunction(source, 'normalizeAngleDeg0to360'),
        extractFunction(source, 'nearestCardinalFacingFromYaw'),
        extractFunction(source, 'isPointBlocked'),
        extractFunction(source, 'moveWithSliding'),
        extractFunction(source, 'wrapPositionAcrossEdge'),
        // nearestCardinalFacingFromYaw() reads these two top-level consts.
        'const YAW_TO_FACING = { 0: 1, 90: 2, 180: 3, 270: 0 };',
        'globalThis.normalizeAngleDeg0to360 = normalizeAngleDeg0to360;',
        'globalThis.nearestCardinalFacingFromYaw = nearestCardinalFacingFromYaw;',
        'globalThis.isPointBlocked = isPointBlocked;',
        'globalThis.moveWithSliding = moveWithSliding;',
        'globalThis.wrapPositionAcrossEdge = wrapPositionAcrossEdge;'
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
