'use strict';

// Real game helper functions backed by the shipped config.
//
// Rather than hand-roll fake item/tile factories (which drift from the real
// ones), we load the actual Item class hierarchy, the real config/items.js and
// config/tiles.js definitions, and the real helper functions extracted from
// miscfunctions.js. Tests then exercise `new_item_from_num`, `addItem`,
// `checkForSpace`, `item_name_to_num`, `tile_name_to_num`, and friends exactly
// as the game does.
//
// Tile construction (`new_tile_from_num`) instantiates whatever tile class a
// definition names, so callers must first load the tile classes they intend to
// build via loadClasses(). The unit suites that only need items don't pay for
// that.

const { loadClasses, loadDefinition, readPublic, extractFunction } = require('./load');

const HELPER_NAMES = [
    'isValidItemNum', 'item_name_to_num', 'tile_name_to_num',
    'new_item_from_num', 'new_tile_from_num', 'addItem', 'checkForSpace'
];

// Load the Item class hierarchy and install `all_items` from the real config.
// Also evaluates the real helper functions so item/tile creation matches the
// game. Idempotent-ish: safe to call once per suite after installBaseGlobals().
function installGameHelpers() {
    loadClasses('classes/item.js', ['Item', 'Seed', 'Eat', 'Tool', 'Placeable', 'Command', 'Backpack']);

    global.all_items = loadDefinition('config/items.js', 'ITEM_DEFINITIONS');
    global.all_tiles = loadDefinition('config/tiles.js', 'TILE_DEFINITIONS', { kiahTileNum: 122 });

    const misc = readPublic('miscfunctions.js');
    const helperSource = HELPER_NAMES.map(name => extractFunction(misc, name)).join('\n');
    require('node:vm').runInThisContext(
        `${helperSource}\nObject.assign(globalThis, { ${HELPER_NAMES.join(', ')} });`
    );

    return {
        all_items: global.all_items,
        all_tiles: global.all_tiles
    };
}

module.exports = { installGameHelpers, HELPER_NAMES };
