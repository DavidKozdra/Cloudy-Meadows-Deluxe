/**
 * Item Definitions for Cloudy Meadows
 * Extracted from preload.js
 * 
 * Item Classes:
 * - Item: Basic items (can be sold/stored)
 * - Tool: Tools for farming (Hoe, Shovel, etc.)
 * - Eat: Consumable food items
 * - Seed: Seeds that can be planted
 * - Placeable: Items that place tiles/entities
 * - Command: Robot commands
 * - Backpack: Storage item
 */

const ITEM_DEFINITIONS = [
    /*0*/  0, // Empty slot
    /*1*/  { name: 'Hoe', png: 56, class: 'Tool' },
    /*2*/  { name: 'Corn', png: 57, price: 4, hunger: 2, hunger_timer: 2000, seed_num: 3, class: 'Eat' },
    /*3*/  { name: 'Corn Seed', png: 58, plant_num: 21, class: 'Seed' },
    /*4*/  { name: 'Junk', png: 59, price: 0, class: 'Item' },
    /*5*/  { name: 'Sweet Potatoes', png: 60, price: 3, hunger: 1, hunger_timer: 3000, seed_num: 6, class: 'Eat' },
    /*6*/  { name: 'Sweet Potato Seed', png: 61, plant_num: 22, class: 'Seed' },
    /*7*/  { name: 'Strawberries', png: 62, price: 2, hunger: 1, hunger_timer: 1700, seed_num: 8, class: 'Eat' },
    /*8*/  { name: 'Strawberry Seed', png: 63, plant_num: 23, class: 'Seed' },
    /*9*/  { name: 'Compost', png: 64, price: 2, tile_num: 13, tile_need_num: 4, class: 'Placeable' },
    /*10*/ { name: 'Ladybugs', png: 65, price: 100, tile_num: 26, tile_need_num: 2, class: 'Placeable' },
    /*11*/ { name: 'Flower Seed', png: 66, plant_num: 25, class: 'Seed'},
    /*12*/ { name: 'Sprinkler', png: 67, price: 9, tile_num: 20, tile_need_num: 2, class: 'Placeable' },
    /*13*/ { name: 'Full Course', png: 68, price: 20, hunger: 100, hunger_timer: 4000, seed_num: 0, class: 'Eat' },
    /*14*/ { name: 'Tomato Seed', png: 69, plant_num: 24, class: 'Seed'},
    /*15*/ { name: 'Tomato', png: 70, price: 3, hunger: 1, hunger_timer: 1800, seed_num: 14, class: 'Eat'},
    /*16*/ { name: 'Watermelon Seed', png: 71, plant_num: 41, class: 'Seed'},
    /*17*/ { name: 'Watermelon', png: 72, price: 8, hunger: 2, hunger_timer: 2000, seed_num: 16, class: 'Eat'},
    /*18*/ { name: 'Robot3', png: 73, price: 150, tile_num: 42, tile_need_num: 0, class: 'Placeable'},
    /*19*/ { name: 'Up Command', png: 74, command: 'up', class: 'Command'},
    /*20*/ { name: 'Right Command', png: 75, command: 'right', class: 'Command'},
    /*21*/ { name: 'Down Command', png: 76, command: 'down', class: 'Command'},
    /*22*/ { name: 'Left Command', png: 77, command: 'left', class: 'Command'},
    /*23*/ { name: 'Interact Command', png: 78, command: 'interact', class: 'Command'},
    /*24*/ { name: 'Hemp Seed', png: 79, plant_num: 45, class: 'Seed'},
    /*25*/ { name: 'Hemp Flower', png: 80, price: 20, hunger: -2, hunger_timer: 100, seed_num: 24, class: 'Eat'},
    /*26*/ { name: 'Restart Command', png: 81, command: 'restart', class: 'Command'},
    /*27*/ { name: 'Robot1', png: 82, price: 70, tile_num: 46, tile_need_num: 0, class: 'Placeable'},
    /*28*/ { name: 'Robot2', png: 83, price: 110, tile_num: 47, tile_need_num: 0, class: 'Placeable'},
    /*29*/ { name: 'Add to Chest Command', png: 84, command: 'add_to_chest', class: 'Command'},
    /*30*/ { name: 'Add from Chest Command', png: 85, command: 'add_from_chest', class: 'Command'},
    /*31*/ { name: 'Veggie Oil', png: 86, price: 7, class: 'Item'},
    /*32*/ { name: 'Shovel', png: 87, class: 'Tool'},
    /*33*/ { name: 'Backpack', png: 88, inv: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], class: 'Backpack'},
    /*34*/ { name: '1 Day Pause Command', png: 89, command: '1day_pause', class: 'Command'},
    /*35*/ { name: 'Hotdog', png: 107, price: 20, hunger: 100, hunger_timer: 4000, seed_num: 0, class: 'Eat' },
    /*36*/ { name: 'Chest', png: 120, price: 20, tile_num: 40, tile_need_num: 0, class: 'Placeable'},
    /*37*/ { name: 'Grinder', png: 121, price: 50, tile_num: 83, tile_need_num: 1, class: 'Placeable'},
    /*38*/ { name: 'Veggie Press', png: 125, price: 130, tile_num: 48, tile_need_num: 1, class: 'Placeable'},
    /*39*/ { name: 'Carrot', png: 136, price: 4, hunger: 1, hunger_timer: 2000, seed_num: 40, class: 'Eat' },
    /*40*/ { name: 'Carrot Seed', png: 137, plant_num: 92, class: 'Seed'},
    /*41*/ { name: 'Pumpkin', png: 144, price: 3, hunger: 3, hunger_timer: 2000, seed_num: 42, class: 'Eat'},
    /*42*/ { name: 'Pumpkin Seed', png: 145, plant_num: 99, class: 'Seed'}
];

/*
Property Reference:
- name: Item display name
- png: Image index number
- price: Sell price at shops
- hunger: How much hunger it restores (negative = drains)
- hunger_timer: Time in ms before hunger changes
- seed_num: Item index of corresponding seed
- plant_num: Tile index of planted crop
- tile_num: Tile index when placed
- tile_need_num: Required tile index to place on
- command: Robot command type
- inv: Inventory array for backpack
- class: Item class determining behavior
*/
