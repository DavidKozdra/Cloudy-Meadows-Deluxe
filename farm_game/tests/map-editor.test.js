'use strict';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { installBaseGlobals, resetWorld } = require('./support/mocks');
const { installGameHelpers } = require('./support/game-helpers');
const { loadClasses, readPublic } = require('./support/load');

installBaseGlobals();
installGameHelpers();
loadClasses([
    'classes/tile_classes/tile.js',
    'classes/tile_classes/entity.js',
    'classes/tile_classes/plant.js',
    'classes/tile_classes/moveable-entity.js',
    'classes/tile_classes/grid-move-entity.js',
    'classes/tile_classes/farm-robot.js',
    'classes/tile_classes/air_ballon.js',
    'classes/level.js'
], ['Tile', 'Entity', 'Plant', 'MoveableEntity', 'GridMoveEntity', 'FarmRobot', 'AirBallon', 'Level']);
vm.runInThisContext(readPublic('classes/custom-rules.js').replace(/^(const|let) /gm, 'var '));

const sprite = (label, width = 32, height = 32) => ({
    canvas: { label, width, height }, pause() {}, play() {}
});

beforeEach(() => {
    resetWorld();
    global.CENTER = 'center';
    global.window.customRules = null;
    global.mapEditsDraft = {};
    global.baseLevelMaps = {};
    global.baseLevelAppearance = {};
    global.mapEditorState = { level: 'Test', tile: 2, tool: 'paint', painting: false };
    global.all_imgs = Array.from({ length: 200 }, (_, png) =>
        Array.from({ length: 4 }, (_, variant) => sprite(png + ':' + variant)));
});

test('every editor sprite uses the same tile ID as the game, including the first and last tiles', () => {
    all_tiles.forEach((def, index) => {
        const id = index + 1;
        assert.equal(ruleTileDefinition(id).name, def.name);
        assert.equal(tileDrawable(id), all_imgs[def.png][0].canvas, def.name);
    });
    assert.equal(ruleTileDefinition(0), undefined, 'zero is empty, not a tile');
    assert.equal(ruleTileDefinition(1).name, 'concrete');
    assert.equal(ruleTileDefinition(all_tiles.length).name, 'WaterBot');
});

test('map edits preserve factory IDs through validation, placement, picking and restoration', () => {
    const level = new Level('Test', [[2, 2, 2, 2]], [[0, 0, 0, 0]]);
    global.levels = [[level]];
    captureBaseLevelMaps();
    setMapCell(0, 0, 1);
    setMapCell(0, 1, 6);
    setMapCell(0, 2, 12);
    setMapCell(0, 3, all_tiles.length);
    const rules = normalizeExtendedRules({ mapEdits: mapEditsDraft });
    assert.deepEqual(rules.mapEdits, { Test: { '0,0': 1, '0,1': 6, '0,2': 12, '0,3': 125 } });
    applyMapEditRules(rules);
    assert.deepEqual(level.map[0].map(tile => tile.name), ['concrete', 'wall', 'lamppost', 'WaterBot']);
    level.map[0].forEach((tile, col) => assert.equal(ruleTileDefinition(mapCellNum('Test', 0, col)).name, tile.name));
    setMapCell(0, 0, null);
    assert.equal(mapCellNum('Test', 0, 0), 2, 'Restore uses the pristine map');
    assert.equal(normalizeExtendedRules({ mapEdits: { Test: { '0,0': 126 } } }).mapEdits.Test, undefined);
});

test('terrain and crop preview layers match the real tile renderer', () => {
    const names = ['concrete', 'grass', 'wall', 'bed', 'lamppost', 'sprinkler', 'junk',
        'compost_tile', 'Flower_Done', 'hori_fence', 'corn'];
    names.forEach(name => {
        const id = tile_name_to_num(name);
        const tile = new_tile_from_num(id, 0, 0);
        const expected = [];
        global.image = img => expected.push(img.canvas);
        tile.render();
        const actual = [];
        drawTile({ drawImage: img => actual.push(img) }, id, 0, 0, 24, captureMapTileAppearance(tile));
        assert.deepEqual(actual, expected, name + ' draws the same sprites in the same order');
    });
});

test('captured previews retain variants, facing, ground and scenery after live world changes', () => {
    const ground = new_tile_from_num(2, 0, 0);
    ground.variant = 3;
    const robot = new_tile_from_num(all_tiles.length, 32, 0);
    robot.facing = 1;
    robot.under_tile.variant = 2;
    all_imgs[robot.png] = [0, 1, 2, 3].map(face => [sprite('robot:' + face)]);
    const level = { name: 'Test', map: [[ground, robot]], fore: [[{ png: 90, variant: 2, type: 1, dim: 0 }]] };
    global.levels = [[level]];
    captureBaseLevelMaps();
    ground.variant = 0;
    robot.facing = 3;
    robot.under_tile.variant = 0;
    level.fore[0][0].variant = 0;
    const saved = baseLevelAppearance.Test;
    assert.equal(tileDrawable(2, saved.map[0][0]), all_imgs[1][3].canvas);
    assert.equal(tileDrawable(125, saved.map[0][1]), all_imgs[robot.png][1][0].canvas);
    assert.equal(saved.map[0][1].under_tile.variant, 2);
    assert.equal(saved.fore[0][0].variant, 2);
});

test('map preview paints the skyline and scenery behind tiles and canopies last', () => {
    const canopy = new_tile_from_num(69, 0, 0);
    const grass = new_tile_from_num(2, 32, 0);
    global.levels = [[{ name: 'Test', map: [[canopy, grass]], fore: [[{ png: 90, type: 1, variant: 2 }]] }]];
    captureBaseLevelMaps();
    global.background_img = sprite('skyline', 800, 128);
    const drawn = [];
    const ctx = { drawImage: (...args) => drawn.push(args), fillRect() {}, strokeRect() {} };
    const canvas = { width: 552, height: 456, getContext: () => ctx };
    const originalGet = document.getElementById;
    document.getElementById = id => id === 'cfg-map-canvas' ? canvas : null;
    try { renderMapCanvas(); } finally { document.getElementById = originalGet; }
    assert.deepEqual(drawn.map(args => args[0].label), ['skyline', '90:2', '1:2', '106:2']);
    assert.deepEqual(drawn[0].slice(1), [0, 0, 600, 96], 'skyline keeps its game scale');
    assert.deepEqual(drawn[1].slice(1), [0, 0, 24, 24], 'scenery uses a top-left anchor');
});

test('large map sprites keep the same scale and anchor as the game', () => {
    const id = tile_name_to_num('Air Ship');
    all_imgs[all_tiles[id - 1].png] = [sprite('airship', 96, 96)];
    const tile = new_tile_from_num(id, 64, 96);
    const calls = [];
    drawTile({ drawImage: (...args) => calls.push(args) }, id, 48, 72, 24, captureMapTileAppearance(tile));
    assert.deepEqual(calls.at(-1).slice(1), [12, 24, 72, 72]);
});
