'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const { readPublic, extractFunction } = require('./support/load');

const source = readPublic('classes/raycaster.js');
// castRay() calls wallXFraction() as a sibling helper, so both must be
// extracted and evaluated together.
const castRaySource = extractFunction(source, 'castRay');
const wallXFractionSource = extractFunction(source, 'wallXFraction');
const sandbox = {};
vm.runInNewContext(
    `${castRaySource}\n${wallXFractionSource}\nglobalThis.castRay = castRay;`,
    sandbox
);
const { castRay } = sandbox;

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

test('straight ray down a corridor hits the far wall at the expected distance', () => {
    // 5-wide corridor (rows 0 and 4 are walls), origin at col 2.5, row 2.5,
    // firing straight right (0deg) toward the wall at col 6 (border wall).
    const map = corridorMap(7, 5);
    const hit = castRay(map, 2.5, 2.5, 0, 24);
    assert.ok(hit, 'expected a hit');
    assert.equal(hit.hitTile, WALL);
    // wall face is at x=6, origin at x=2.5 -> perpendicular distance 3.5
    assert.ok(Math.abs(hit.distance - 3.5) < 1e-9, `expected distance ~3.5, got ${hit.distance}`);
    // dead-center perpendicular hit on row 2.5 lands mid-face (wallX ~0.5)
    assert.ok(Math.abs(hit.wallX - 0.5) < 1e-9, `expected wallX ~0.5, got ${hit.wallX}`);
});

test('wallX sweeps across the wall face as the ray origin moves along it', () => {
    // Firing straight along +x (angle 0deg), the ray's row never changes, so
    // wallX on the far (X-side) wall tracks the origin's fractional row --
    // sweep originYTiles to sweep which column of the wall texture is hit.
    const map = corridorMap(7, 5);
    const nearEdgeHit = castRay(map, 2.5, 2.1, 0, 24);
    const farEdgeHit = castRay(map, 2.5, 2.9, 0, 24);
    assert.ok(nearEdgeHit && farEdgeHit);
    assert.ok(Math.abs(nearEdgeHit.wallX - 0.1) < 1e-9, `expected wallX ~0.1, got ${nearEdgeHit.wallX}`);
    assert.ok(Math.abs(farEdgeHit.wallX - 0.9) < 1e-9, `expected wallX ~0.9, got ${farEdgeHit.wallX}`);
});

test('ray facing straight up hits the near wall at the expected distance', () => {
    const map = corridorMap(7, 5);
    const hit = castRay(map, 3.5, 2.5, 270, 24);
    assert.ok(hit);
    assert.equal(hit.hitTile, WALL);
    // wall face is at y=1 (border row 0's far edge), origin at y=2.5 -> distance 1.5
    assert.ok(Math.abs(hit.distance - 1.5) < 1e-9, `expected distance ~1.5, got ${hit.distance}`);
});

test('a single wall tile blocks a ray fired directly at it', () => {
    const map = [
        [FLOOR, FLOOR, FLOOR, FLOOR],
        [FLOOR, FLOOR, WALL, FLOOR],
        [FLOOR, FLOOR, FLOOR, FLOOR]
    ];
    const hit = castRay(map, 0.5, 1.5, 0, 24);
    assert.ok(hit);
    assert.equal(hit.hitTile, WALL);
    assert.ok(Math.abs(hit.distance - 1.5) < 1e-9, `expected distance ~1.5, got ${hit.distance}`);
});

test('a diagonal ray hits a corner wall and reports a side value', () => {
    const map = [
        [FLOOR, FLOOR, FLOOR],
        [FLOOR, FLOOR, WALL],
        [FLOOR, WALL, WALL]
    ];
    const hit = castRay(map, 0.5, 0.5, 45, 24);
    assert.ok(hit, 'expected a hit');
    assert.equal(hit.hitTile, WALL);
    assert.ok(hit.side === 0 || hit.side === 1);
});

test('an open map with no walls within range returns null', () => {
    // Large all-floor map so the ray exhausts maxDepthTiles before ever
    // reaching an edge (which would otherwise report a boundary hit).
    const map = corridorMap(50, 50).map(row => row.map(() => FLOOR));
    const hit = castRay(map, 25, 25, 0, 5);
    assert.equal(hit, null);
});

test('a ray that runs off the edge of the map is treated as a boundary hit', () => {
    const map = [[FLOOR, FLOOR], [FLOOR, FLOOR]];
    const hit = castRay(map, 1, 1, 0, 24);
    assert.ok(hit);
    assert.equal(hit.hitTile, null);
});
