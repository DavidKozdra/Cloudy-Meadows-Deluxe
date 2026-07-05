'use strict';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { installBaseGlobals, resetWorld } = require('./support/mocks');
const { installGameHelpers } = require('./support/game-helpers');
const { loadClasses } = require('./support/load');

installBaseGlobals();
resetWorld();
installGameHelpers();

// Chest -> Entity -> Tile; loaded on top of the real item/tile factories so
// construction and load() run the shipped code paths.
loadClasses([
    'classes/tile_classes/tile.js',
    'classes/tile_classes/entity.js',
    'classes/tile_classes/chest.js'
], ['Tile', 'Entity', 'Chest']);

const CHEST_TILE = tile_name_to_num('Chest'); // shipped registry id (40)
const CORN = item_name_to_num('Corn');

function newChest() {
    return new_tile_from_num(CHEST_TILE, 0, 0);
}

beforeEach(() => {
    resetWorld();
});

test('a freshly built chest exposes a 3x4 grid of empty slots', () => {
    const chest = newChest();
    assert.equal(chest.class, 'Chest');
    assert.equal(chest.inv.length, 3, 'three rows');
    assert.ok(chest.inv.every(row => row.length === 4), 'four columns each');
    assert.ok(chest.inv.flat().every(slot => slot === 0), 'every slot starts empty');
});

test('map-authored chests are world-owned until explicitly claimed', () => {
    const chest = newChest();
    assert.equal(chest.playerOwned, false, 'chests default to world ownership');
});

test('the constructor reshapes a flat 12-slot inventory into rows', () => {
    // Entity fills inv from item {num, amount} records; verify a seeded slot
    // lands in the expected grid cell after reshaping.
    const chest = new Chest('Chest', 39, 0, 0,
        [{ num: CORN, amount: 5 }, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 1);
    assert.equal(chest.inv[0][0].name, 'Corn');
    assert.equal(chest.inv[0][0].amount, 5);
    assert.equal(chest.inv[0][1], 0);
});

test('load() rebuilds stored items and drops emptied slots', () => {
    const chest = newChest();
    chest.inv[0][0] = new_item_from_num(CORN, 2); // pre-existing item to be cleared
    chest.load({
        age: -1, hand: 0, playerOwned: true,
        under_tile: { name: 'concrete', pos: { x: 0, y: 0 }, age: -1, variant: 0 },
        inv: [
            [0, { name: 'Corn', amount: 9 }, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ]
    });
    assert.equal(chest.playerOwned, true, 'ownership is restored from the save');
    assert.equal(chest.inv[0][0], 0, 'the previously filled slot is cleared to match the save');
    assert.equal(chest.inv[0][1].name, 'Corn');
    assert.equal(chest.inv[0][1].amount, 9, 'the saved amount is restored');
});

test('a load round-trip preserves item names and amounts', () => {
    const original = newChest();
    original.playerOwned = true;
    original.inv[0][0] = new_item_from_num(CORN, 3);
    original.inv[2][3] = new_item_from_num(CORN, 1);

    // Serialize the way saveAll would (plain JSON) then load into a fresh chest.
    const saved = JSON.parse(JSON.stringify({
        age: original.age, hand: original.hand, playerOwned: original.playerOwned,
        under_tile: { name: 'concrete', pos: { x: 0, y: 0 }, age: -1, variant: 0 },
        inv: original.inv
    }));

    const restored = newChest();
    restored.load(saved);
    assert.equal(restored.playerOwned, true);
    assert.equal(restored.inv[0][0].name, 'Corn');
    assert.equal(restored.inv[0][0].amount, 3);
    assert.equal(restored.inv[2][3].amount, 1);
    assert.ok(restored.inv[1].every(slot => slot === 0), 'untouched rows stay empty');
});
