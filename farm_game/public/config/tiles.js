/**
 * Tile Definitions for Cloudy Meadows
 * Extracted from preload.js
 * 
 * Tile Classes:
 * - Tile: Basic static tiles
 * - Plant: Growing crops
 * - Shop: Shop entities
 * - NPC: Non-player characters
 * - Entity: Basic entities
 * - Chest: Storage containers
 * - Robot: Programmable robots
 * - FreeMoveEntity: Entities that move freely
 * - LightMoveEntity: Light-based movement entities
 * - AirBallon: Air balloon transportation
 * - PayToMoveEntity: Tiles that cost money to move
 */

const TILE_DEFINITIONS = [
    /*1*/   { name: 'concrete', png: 0, collide: false, age: -1, class: 'Tile' },
    /*2*/   { name: 'grass', png: 1, collide: false, age: -1, class: 'Tile' },
    /*3*/   { name: 'plot', png: 2, collide: false, age: 0, class: 'Tile' },
    /*4*/   { name: 'dirt', png: 3, collide: false, age: -1, class: 'Tile' },
    /*5*/   { name: 'junk', png: 4, collide: false, age: -1, class: 'Tile' },
    /*6*/   { name: 'wall', png: 5, collide: true, age: -1, class: 'Tile' },
    /*7*/   { name: 'bed', png: 6, collide: false, age: -1, class: 'Tile' },
    /*8*/   { name: 'Bridge', png: 7, collide: false, age: -1, class: 'Tile' },
    /*9*/   { name: 'bridge2', png: 8, collide: false, age: -1, class: 'Tile' },
    /*10*/  { name: 'satilite', png: 9, collide: true, age: -1, class: 'Tile' },
    /*11*/  { name: 'solarpanel', png: 10, collide: true, age: -1, class: 'Tile' },
    /*12*/  { name: 'lamppost', png: 11, collide: true, age: -1, class: 'Tile' },
    /*13*/  { name: 'compost_tile', png: 12, collide: false, age: 0, class: 'Tile' },
    /*14*/  { name: 'compost_bucket', png: 13, collide: false, age: -1, class: 'Tile' },
    /*15*/  { name: 'cart_s', png: 14, collide: true, age: -1, class: 'Tile' },
    /*16*/  { name: 'Vegetables', png: 15, inv: [{ num: 2, amount: 7}, {num: 5, amount: 6}, {num: 39, amount: 1}], under_tile_num: 1, class: 'Shop' },
    /*17*/  { name: 'Ladybugs and Flowers', png: 16, inv: [{num: 10, amount: 6}, {num: 11, amount: 6}], under_tile_num: 1, class: 'Shop' },
    /*18*/  { name: 'Sprinklers', png: 17, inv: [{num: 12, amount: 6}], under_tile_num: 1, class: 'Shop' },
    /*19*/  { name: 'Veggie Seeds', png: 18, inv: [{ num: 3, amount: 7}, {num: 6, amount: 6}, {num: 40, amount: 0}], under_tile_num: 1, class: 'Shop' },
    /*20*/  { name: 'sprinkler', png: 19, collide: false, age: -1, class: 'Tile' },
    /*21*/  { name: 'corn', png: 20, collide: false, age: 0, eat_num: 2, waterneed: 0, growthTime: 2000, class: 'Plant' },
    /*22*/  { name: 'sweet_potato', png: 21, collide: false, age: 0, eat_num: 5, waterneed: 0, growthTime: 2200, class: 'Plant' },
    /*23*/  { name: 'strawberry', png: 22, collide: false, age: 0, eat_num: 7, waterneed: 1, growthTime: 1900, class: 'Plant' },
    /*24*/  { name: 'tomato', png: 23, collide: false, age: 0, eat_num: 15, waterneed: 1, growthTime: 1300, class: 'Plant' },
    /*25*/  { name: 'flower', png: 24, collide: false, age: 0, eat_num: 0, waterneed: 0, growthTime: 1000, class: 'Plant' },
    /*26*/  { name: 'ladybug', png: 25, collide: false, age: 0, inv: [0], hand: 0, under_tile_num: 2, class: 'Entity' },
    /*27*/  { name: 'Rick', png: 26, inv: [{ num: 7, amount: 2 }], hand: 0, facing: 2, under_tile_num: 1, instructions: ['left', 'left', 'left', 'left', 'left', 'left', 'left', 'up', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'down', 'left', 'left', 'left', 'left', 'left', 'left', 'left', 'left'], moving_timer: 100, class: 'NPC' },
    /*28*/  { name: 'Deb', png: 27, inv: [{num: 4, amount: 3}], hand: 0, facing: 2, under_tile_num: 1, instructions: [], moving_timer: 0, class: 'NPC' },
    /*29*/  { name: 'Mario', png: 28, inv: [{num: 12, amount: 1}], hand: 0, facing: 2, under_tile_num: 1, instructions: [], moving_timer: 100, class: 'NPC' },
    /*30*/  { name: 'Garry', png: 29, inv: [0], hand: 0, facing: 2, under_tile_num: 1, instructions: ['down', 'up'], moving_timer: 100, class: 'NPC' },
    /*31*/  { name: 'Mira', png: 30, inv: [0], hand: 0, facing: 2, under_tile_num: 1, instructions: ['down', 'left', 'up', 'right'], moving_timer: 100, class: 'NPC' },
    /*32*/  { name: 'OldManJ', png: 31, inv: [0], hand: 0, facing: 2, under_tile_num: 1, instructions: ['left', 'left', 'left', 'down', 'right', 'right', 'right', 'up'], moving_timer: 100, class: 'NPC' },
    /*33*/  { name: 'Brandon', png: 32, inv: [0], hand: 0, facing: 2, under_tile_num: 1, instructions: ['up', 'right', 'down', 'left'], moving_timer: 100, class: 'NPC' },
    /*34*/  { name: 'Brent', png: 33, inv: [0], hand: 0, facing: 2, under_tile_num: 1, instructions: [], moving_timer: 100, class: 'NPC' },
    /*35*/  { name: 'BlindPete', png: 34, inv: [0], hand: 0, facing: 2, under_tile_num: 1, instructions: ['up', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'down', 'down', 'down', 'down', 'down', 'down', 'down', 'down', 'down', 'down', 'down', 'down', 'down', 'down'], moving_timer: 100, class: 'NPC' },
    /*36*/  { name: 'James', png: 35, inv: [0], hand: 0, facing: 2, under_tile_num: 1, instructions: [], moving_timer: 100, class: 'NPC' },
    /*37*/  { name: 'Liam', png: 36, inv: [0], hand: 0, facing: 2, under_tile_num: 1, instructions: ['up', 'up', 'down', 'down'], moving_timer: 100, class: 'NPC' },
    /*38*/  { name: 'Meb', png: 37, inv: [0], hand: 0, facing: 2, under_tile_num: 1, instructions: [], moving_timer: 100, class: 'NPC' },
    /*39*/  { name: 'bush', png: 38, collide: true, age: -1, class: 'Tile' },
    /*40*/  { name: 'Chest', png: 39, inv: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], facing: 2, under_tile_num: 1, class: 'Chest'},
    /*41*/  { name: 'watermelon', png: 40, collide: false, age: 0, eat_num: 17, waterneed: 2, growthTime: 4000, class: 'Plant'},
    /*42*/  { name: 'Robot3', png: 41, inv: [0, 0, 0, 0, 0, 0, 0], under_tile_num: 1, instructions: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], moving_timer: 60, class: 'Robot'},
    /*43*/  { name: 'Fruits', png: 42, inv: [{num: 7, amount: 3}, {num: 15, amount: 3}, {num: 17, amount: 3}], under_tile_num: 1, class: 'Shop' },
    /*44*/  { name: 'Fruit Seeds', png: 43, inv: [{num: 8, amount: 4}, {num: 14, amount: 2}, {num: 16, amount: 1}], under_tile_num: 1, class: 'Shop' },
    /*45*/  { name: 'hemp', png: 44, collide: false, age: 0, eat_num: 25, waterneed: 2, growthTime: 2000, class: 'Plant'},
    /*46*/  { name: 'Robot1', png: 45, inv: [0, 0, 0, 0], under_tile_num: 1, instructions: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], moving_timer: 100, class: 'Robot'},
    /*47*/  { name: 'Robot2', png: 46, inv: [0, 0, 0, 0, 0, 0], under_tile_num: 1, instructions: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], moving_timer: 80, class: 'Robot'},
    /*48*/  { name: 'Veggie_Press', png: 47, collide: false, age: -1, class: 'Tile' },
    /*49*/  { name: 'Bees', png: 48, inv:[0], under_tile_num: 0, instructions: [], moving_timer: 50, class: 'FreeMoveEntity' },
    /*50*/  { name: 'Flower_Done', png: 49, collide: false, age: 0, class: 'Tile'},
    /*51*/  { name: 'Guy', png: 50, inv: [0], hand: 0, facing: 2, under_tile_num: 1, instructions: [], moving_timer: 100, class: 'NPC'},
    /*52*/  { name: 'Ishmil', png: 51, inv: [0], hand: 0, facing: 2, under_tile_num: 57, instructions: [], moving_timer: 100, class: 'NPC' },
    /*53*/  { name: 'Kenny', png: 52, inv: [0], hand: 0, facing: 2, under_tile_num: 71, instructions: [], moving_timer: 100, class: 'NPC' },
    /*54*/  { name: 'Super Tina', png: 53, inv: [0], hand: 0, facing: 2, under_tile_num: 57, instructions: [], moving_timer: 100, class: 'NPC' },
    /*55*/  { name: 'Vinny', png: 54, inv: [0], hand: 0, facing: 2, under_tile_num: 1, instructions: [], moving_timer: 100, class: 'NPC' },
    /*56*/  { name: 'Chef', png: 55, inv: [{num: 13, amount: 1}], under_tile_num: 1, class: 'Shop' },
    /*57*/  { name: 'park_grass', png: 94, collide: false, age: -1, class: 'Tile'},
    /*58*/  { name: 'hori_fence', png: 95, collide: true, age: -1, class: 'Tile'},
    /*59*/  { name: 'vert_fence', png: 96, collide: true, age: -1, class: 'Tile'},
    /*60*/  { name: 'top_right_corner_fence', png: 97, collide: true, age: -1, class: 'Tile'},
    /*61*/  { name: 'park_path', png: 98, collide: false, age: -1, class: 'Tile'},
    /*62*/  { name: 'park_path_vert', png: 99, collide: false, age: -1, class: 'Tile'},
    /*63*/  { name: 'park_path_cross', png: 103, collide: false, age: -1, class: 'Tile'},
    /*64*/  { name: 'park_path_up_t', png: 104, collide: false, age: -1, class: 'Tile'},
    /*65*/  { name: 'bottom_right_corner_fence', png: 100, collide: true, age: -1, class: 'Tile'},
    /*66*/  { name: 'bottom_left_corner_fence', png: 101, collide: true, age: -1, class: 'Tile'},
    /*67*/  { name: 'top_left_corner_fence', png: 102, collide: true, age: -1, class: 'Tile'},
    /*68*/  { name: 'tree_bottom', png: 105, collide: true, age: -1, class: 'Tile'},
    /*69*/  { name: 'tree_top', png: 106, collide: true, age: -1, class: 'Tile'},
    /*70*/  { name: 'Hotdog Stand', png: 108, inv: [{num: 35, amount: 4}], under_tile_num: 57, class: 'Shop' },
    /*71*/  { name: 'swamp_grass', png: 110, collide: false, age: -1, class: 'Tile'},
    /*72*/  { name: 'water', png: 109, collide: true, age: -1, class: 'Tile'},
    /*73*/  { name: 'Chef', png: 111, inv:[{num:13, amount: 1}], under_tile_num: 74, class: 'Shop'},
    /*74*/  { name: 'kitchen_tile', png: 112, collide: false, age: -1, class: 'Tile'},
    /*75*/  { name: 'table', png: 113, collide: true, age: -1, class: 'Tile'},
    /*76*/  { name: 'dirt_path', png: 114, collide: false, age: -1, class: 'Tile'},
    /*77*/  { name: 'Frog', png: 115, inv: [0], under_tile_num: 71, instructions: [], moving_timer: 80, class: 'FreeMoveEntity'},
    /*78*/  { name: 'LightBug', png: 134, inv: [0], under_tile_num: 71, instructions: [], moving_timer: 30, class: 'LightMoveEntity'},
    /*79*/  { name: 'Air Ship', png: 116, under_tile_num: 1, class: 'AirBallon'},
    /*80*/  { name: 'Zoda', png: 117, inv: [0], hand: 0, facing: 2, under_tile_num: 1, instructions: [], moving_timer: 100, class: 'NPC' },
    /*81*/  { name: 'kitchen_counter', png: 118, collide: true, age: -1, class: 'Tile'},
    /*82*/  { name: 'bar_counter', png: 119, collide: true, age: -1, class: 'Tile'},
    /*83*/  { name: 'grinder', png: 122, collide: false, age: -1, class: 'Tile' },
    /*84*/  { name: 'Tile Shop', png: 123, inv: [{num: 36, amount: 3}, {num: 37, amount: 1}, {num: 38, amount: 0}], under_tile_num: 1, class: 'Shop' },
    /*85*/  { name: 'computer', png: 124, collide: false, age: -1, class: 'Tile'},
    /*86*/  { name: 'Tool Shop', png: 126, inv: [{num: 1, amount: 2}, {num: 32, amount: 2}], under_tile_num: 57, class: 'Shop'},
    /*87*/  { name: 'Rob Botus', png: 127, inv: [{num: 27, amount: 1}, {num: 28, amount: 1}, {num: 18, amount: 1}, {num: 19, amount: 4}, {num: 20, amount: 4}, {num: 21, amount: 4}, {num: 22, amount: 4}, {num: 23, amount: 2}, {num: 29, amount: 4}, {num: 30, amount: 4}, {num: 26, amount: 4}, {num: 34, amount: 4}], under_tile_num: 57, class: 'Shop'},
    /*88*/  { name: 'Jake', png: 128, inv: [{num: 25, amount: 3}, {num: 24, amount: 1}], under_tile_num: 57, class: 'Shop'},
    /*89*/  { name: 'Dog', png: 129, inv: [0], under_tile_num: 57, instructions: [], moving_timer: 80, class: 'FreeMoveEntity'},
    /*90*/  { name: 'David', png: 130, inv: [0], hand: 0, facing: 2, under_tile_num: 71, instructions: [], moving_timer: 100, class: 'NPC'},
    /*91*/  { name: 'bunny', png: 135, inv: [0], under_tile_num: 3, instructions: [], moving_timer: 80, class: 'FreeMoveEntity'},
    /*92*/  { name: 'carrot', png: 138, collide: false, age: 0, eat_num: 39, waterneed: 1, growthTime: 2200, class: 'Plant' },
    /*93*/  { name: 'brigde_hori_move', png: 139, age: -1, under_tile_num: 8, price: 1000, class: 'PayToMoveEntity'},
    /*94*/  { name: 'brigde_vert_move', png: 139, age: -1, under_tile_num: 9, price: 1000, class: 'PayToMoveEntity'},
    /*95*/  { name: 'park_grass_move', png: 139, age: -1, under_tile_num: 57, price: 420, class: 'PayToMoveEntity'},
    /*96*/  { name: 'Adam', png: 140, inv: [0], hand: 0, facing: 2, under_tile_num: 57, instructions: [], moving_timer: 100, class: 'NPC'},
    /*97*/  { name: 'Barry', png: 141, inv: [0], hand: 0, facing: 2, under_tile_num: 57, instructions: [], moving_timer: 100, class: 'NPC'},
    /*98*/  { name: 'Mr.C', png: 142, inv: [0], hand: 0, facing: 2, under_tile_num: 1, instructions: ['down', 'down', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'disappear', 'disappear', 'disappear'], moving_timer: 10, class: 'NPC'},
    /*99*/  { name: 'Pumpkin', png: 143, collide: false, age: 0, eat_num: 41, waterneed: 0, growthTime: 3000, class: 'Plant' }
];

/*
Property Reference:
- name: Tile display name
- png: Image index number
- collide: Whether blocks movement
- age: Growth/age state (-1 = static)
- class: Tile class determining behavior
- inv: Inventory array for shops/chests/NPCs
- hand: Currently held item index
- facing: Direction (0=up, 1=right, 2=down, 3=left)
- under_tile_num: Tile index underneath entity
- instructions: Movement/command array for NPCs/robots
- moving_timer: Time between moves (ms)
- eat_num: Item index when harvested
- waterneed: Water requirement level
- growthTime: Time to fully grow (ms)
- price: Cost to interact/move
*/
