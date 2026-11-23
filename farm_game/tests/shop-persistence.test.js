'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { installBaseGlobals, resetWorld } = require('./support/mocks');
const { installGameHelpers } = require('./support/game-helpers');
const { loadClasses } = require('./support/load');

installBaseGlobals(); resetWorld(); installGameHelpers();
loadClasses(['classes/tile_classes/tile.js', 'classes/tile_classes/entity.js', 'classes/tile_classes/shop.js'], ['Tile', 'Entity', 'Shop']);

test('shop reload preserves stock, prices, sales and the restock schedule', () => {
    global.days = 22;
    const original = new_tile_from_num(tile_name_to_num('Vegetables'), 0, 0);
    original.lastMarketUpdate = 22;
    original.itemsSold = { Corn: 9 };
    original.inv[0].amount = 8;
    original.inv[0].price = 17;
    const saved = JSON.parse(JSON.stringify(original));
    global.days = 0; // newWorld constructs shops before loading the saved calendar.
    const restored = new_tile_from_num(tile_name_to_num('Vegetables'), 0, 0);
    global.days = 22;
    restored.load(saved);
    assert.equal(restored.inv[0].amount, 8);
    assert.equal(restored.inv[0].price, 17);
    assert.deepEqual(restored.originalPrices, original.originalPrices);
    assert.deepEqual(restored.itemsSold, { Corn: 9 });
    assert.equal(restored.lastMarketUpdate, 22);
    restored.daily_update();
    assert.equal(restored.inv[0].amount, 8, 'reload must not trigger a premature bulk restock');
});
