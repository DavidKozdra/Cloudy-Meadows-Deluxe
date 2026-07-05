'use strict';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { installBaseGlobals, resetWorld } = require('./support/mocks');
const { installGameHelpers } = require('./support/game-helpers');
const { loadClasses } = require('./support/load');

installBaseGlobals();
resetWorld();
installGameHelpers();

// Load the tile classes the real factory can construct, then Level itself
// (which also defines Foreground and Light).
loadClasses([
    'classes/tile_classes/tile.js',
    'classes/tile_classes/entity.js',
    'classes/tile_classes/plant.js',
    'classes/tile_classes/chest.js',
    'classes/level.js'
], ['Tile', 'Entity', 'Plant', 'Chest', 'Level']);

const GRASS = tile_name_to_num('grass');
const PLOT = tile_name_to_num('plot');
const COMPOST = tile_name_to_num('compost_tile');
const LAMPPOST = tile_name_to_num('lamppost');

// daily_update() reaches for a global `level17` (a specific authored level).
// Give it a throwaway grid so the call doesn't crash.
function stubLevel17() {
    global.level17 = { map: Array.from({ length: 8 }, () => Array.from({ length: 13 }, () => 0)) };
}

// A foreground grid of all-zeros (no decoration) sized to match `map`.
function emptyForeground(map) {
    return map.map(row => row.map(() => 0));
}

beforeEach(() => {
    resetWorld();
    stubLevel17();
});

test('the constructor instantiates every positive tile id into a tile object', () => {
    const map = [
        [GRASS, PLOT, 0],
        [GRASS, GRASS, GRASS]
    ];
    const level = new Level('Sample', map, emptyForeground(map));
    assert.equal(level.map[0][0].name, 'grass');
    assert.equal(level.map[0][1].name, 'plot');
    assert.equal(level.map[0][2], 0, 'a 0 in the source map stays an empty slot');
    assert.ok(level.map[1].every(tile => tile && tile.class === 'Tile'));
});

test('positions are assigned in tile-space from grid coordinates', () => {
    const map = [[GRASS, GRASS], [GRASS, GRASS]];
    const level = new Level('Coords', map, emptyForeground(map));
    assert.deepEqual(level.map[0][1].pos, { x: tileSize, y: 0 });
    assert.deepEqual(level.map[1][0].pos, { x: 0, y: tileSize });
});

test('an out-of-range tile id is dropped to an empty slot rather than crashing', () => {
    const bogus = all_tiles.length + 50;
    const map = [[GRASS, bogus]];
    const level = new Level('Bad', map, emptyForeground(map));
    assert.equal(level.map[0][0].name, 'grass');
    assert.equal(level.map[0][1], 0, 'an unknown tile id becomes an empty slot');
});

test('lampposts register a light source on the level', () => {
    const map = [[LAMPPOST, GRASS]];
    const level = new Level('Lit', map, emptyForeground(map));
    assert.equal(level.lights.length, 1, 'the lamppost contributes one light');
    assert.deepEqual(level.lights[0].pos, { x: 0, y: 0 });
});

test('getReadyForSave drops the transient lighting buffer', () => {
    const map = [[GRASS]];
    const level = new Level('Save', map, emptyForeground(map));
    level.lightingBuffer = { fake: true };
    level.getReadyForSave();
    assert.equal(level.lightingBuffer, undefined, 'the non-serializable buffer is removed before saving');
});

test('a level survives a name→id→reconstruct save round-trip', () => {
    // This mirrors loadLevel(): a saved level stores tile *names*, which are
    // mapped back to ids and rebuilt through the same Level constructor.
    const map = [
        [GRASS, PLOT],
        [LAMPPOST, GRASS]
    ];
    const original = new Level('Farm', map, emptyForeground(map));

    // Serialize to the shape saveAll() persists (plain objects with names).
    const savedMap = original.map.map(row => row.map(tile =>
        tile === 0 ? 0 : { name: tile.name, pos: tile.pos, age: tile.age, variant: tile.variant }));

    // Rebuild: names -> ids, then feed a fresh constructor (as loadLevel does).
    const rebuiltIds = savedMap.map(row => row.map(tile =>
        tile === 0 ? 0 : (tile_name_to_num(tile.name) || 0)));
    const restored = new Level('Farm', rebuiltIds, emptyForeground(rebuiltIds));

    assert.equal(restored.map[0][0].name, 'grass');
    assert.equal(restored.map[0][1].name, 'plot');
    assert.equal(restored.map[1][0].name, 'lamppost');
    assert.equal(restored.lights.length, 1, 'lights are rebuilt from the restored lamppost');
});

test('daily_update ages a plot into dirt after five days', () => {
    const map = [[PLOT]];
    const level = new Level('Aging', map, emptyForeground(map));
    assert.equal(level.map[0][0].name, 'plot');
    for (let day = 0; day < 5; day++) level.daily_update();
    assert.equal(level.map[0][0].name, 'dirt', 'a neglected plot reverts to dirt');
});

test('daily_update turns a finished compost tile back into base ground', () => {
    const map = [[COMPOST]];
    const level = new Level('Compost', map, emptyForeground(map));
    // daily_update() replaces a matured compost_tile with tile id 2 (grass).
    const groundName = all_tiles[2 - 1].name;
    for (let day = 0; day < 2; day++) level.daily_update();
    assert.equal(level.map[0][0].name, groundName, 'finished compost reverts to base ground');
    assert.notEqual(level.map[0][0].name, 'compost_tile');
});

test('daily_update leaves ageless tiles (grass) untouched', () => {
    const map = [[GRASS]];
    const level = new Level('Stable', map, emptyForeground(map));
    for (let day = 0; day < 20; day++) level.daily_update();
    assert.equal(level.map[0][0].name, 'grass', 'grass never ages away');
});

test('update() drives Plant growth for every plant tile in the map', () => {
    const map = [[GRASS, GRASS]];
    const level = new Level('Grow', map, emptyForeground(map));
    const plant = new Plant('corn', 20, tileSize, 0, false, 2, 0, 1);
    level.map[0][1] = plant;
    global.levels = [[level]];
    const before = plant.age;
    level.update(0, 0, 1); // growthTime 1 -> one tick advances it
    assert.ok(plant.age > before, 'update grows plants in place');
});
