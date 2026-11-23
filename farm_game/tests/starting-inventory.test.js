'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const { installBaseGlobals, resetWorld } = require('./support/mocks');
const { installGameHelpers } = require('./support/game-helpers');
const { readPublic, extractFunction } = require('./support/load');

// --- Environment ------------------------------------------------------------
installBaseGlobals();
resetWorld();
installGameHelpers();

// Pull the starting-inventory constants and helpers out of miscfunctions.js
// (the rest of the file needs the full browser sketch).
const misc = readPublic('miscfunctions.js');
const constantsStart = misc.indexOf('const STARTING_INVENTORY_SLOTS');
const constantsEnd = misc.indexOf('// Coerce any stored/drafted value');
assert.ok(constantsStart !== -1 && constantsEnd > constantsStart, 'Could not isolate starting inventory constants');
const helperNames = ['normalizeStartingInventory', 'buildStartingInventory', 'applyStartingInventory'];
vm.runInThisContext(
    misc.slice(constantsStart, constantsEnd).replace(/^const /gm, 'var ') + '\n' +
    helperNames.map(name => extractFunction(misc, name)).join('\n') +
    `\nObject.assign(globalThis, { ${helperNames.join(', ')} });`
);

test('normalize pads to 8 slots, drops unknown items, and clamps amounts', () => {
    const out = normalizeStartingInventory([
        { name: 'Hoe', amount: 1 },
        { name: 'Not A Real Item', amount: 3 },
        { name: 'Corn', amount: 0 },
        { name: 'Corn Seed', amount: 1e9 },
        0
    ]);
    assert.equal(out.length, 8);
    assert.deepEqual(out[0], { name: 'Hoe', amount: 1 });
    assert.equal(out[1], 0, 'unknown item becomes an empty slot');
    assert.deepEqual(out[2], { name: 'Corn', amount: 1 }, 'amount floors at 1');
    assert.deepEqual(out[3], { name: 'Corn Seed', amount: 9999 }, 'amount caps at 9999');
    assert.ok(out.slice(4).every(slot => slot === 0));
});

test('normalize tolerates null and truncates oversized lists', () => {
    assert.deepEqual(normalizeStartingInventory(null), [0, 0, 0, 0, 0, 0, 0, 0]);
    const ten = Array.from({ length: 10 }, () => ({ name: 'Junk', amount: 2 }));
    assert.equal(normalizeStartingInventory(ten).length, 8);
});

test('applyStartingInventory replaces the hotbar with real items in slot order', () => {
    const target = { inv: [new_item_from_num(1, 1), 0, 0, 0, 0, 0, 0, 0], hand: 3 };
    const applied = applyStartingInventory(target, {
        startingInventory: [0, { name: 'Time Watch', amount: 1 }, { name: 'Backpack', amount: 1 }, { name: 'Tomato', amount: 12 }]
    });
    assert.equal(applied, true);
    assert.equal(target.inv.length, 8);
    assert.equal(target.inv[0], 0, 'previous hotbar contents are cleared');
    assert.equal(target.inv[1].name, 'Time Watch');
    assert.equal(target.inv[2].class, 'Backpack');
    assert.ok(Array.isArray(target.inv[2].inv), 'backpack gets its own storage grid');
    assert.equal(target.inv[3].name, 'Tomato');
    assert.equal(target.inv[3].amount, 12);
    assert.equal(target.hand, 0, 'selection resets to the first slot');
});

test('applyStartingInventory leaves the default kit alone when no rule is set', () => {
    const hoe = new_item_from_num(1, 1);
    const target = { inv: [hoe, 0, 0, 0, 0, 0, 0, 0], hand: 0 };
    assert.equal(applyStartingInventory(target, { startingInventory: null }), false);
    assert.equal(applyStartingInventory(target, null), false);
    assert.equal(target.inv[0], hoe);
});
