const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const publicDir = path.resolve(__dirname, '../public');
const sources = [
    'classes/tile_classes/tile.js',
    'classes/tile_classes/entity.js',
    'classes/tile_classes/moveable-entity.js',
    'classes/tile_classes/grid-move-entity.js',
    'classes/tile_classes/robot.js',
    'classes/tile_classes/farm-robot.js',
    'classes/tile_classes/plant.js',
    'classes/level.js'
].map(file => fs.readFileSync(path.join(publicDir, file), 'utf8')).join('\n');

global.window = {};
global.tileSize = 32;
global.canvasWidth = 96;
global.canvasHeight = 96;
global.createVector = (x, y) => ({ x, y });
global.random = (min, max) => max === undefined ? min / 2 : (min + max) / 2;
global.round = Math.round;
global.floor = Math.floor;
global.append = (array, item) => array.push(item);
global.days = 4;
global.time = 50;
global.currentLevel_x = 0;
global.currentLevel_y = 0;
global.player = { touching: { name: 'grass' }, quests: [], current_quest: 0 };
global.robot_talkingSound = { play() {} };
global.PlantingSound = { play() {} };
global.moneySound = { play() {} };
global.hoe_sound = { play() {} };
global.all_imgs = Array.from({ length: 200 }, () => [{}, {}, {}, {}]);
global.all_imgs[20] = [{}, {}, {}, {}];
global.all_imgs[22] = [{}, {}, {}, {}];
global.all_imgs[45] = [[{}], [{}], [{}], [{}]];
global.all_imgs[46] = [[{}], [{}], [{}], [{}]];
global.all_items = [];
global.all_items[2] = { name: 'Corn', seed_min: 1, seed_max: 2 };

class TestItem {
    constructor(name, amount, extra = {}) { Object.assign(this, { name, amount, class: 'Item', price: 0 }, extra); }
}

const itemNums = {
    Corn: 2,
    'Corn Seed': 3,
    'Veggie Oil': 31,
    'Right Command': 20,
    'Interact Command': 23,
    'Add to Chest Command': 29
};
global.item_name_to_num = name => itemNums[name];
global.new_item_from_num = (num, amount) => {
    if (num === 2) return new TestItem('Corn', amount, { class: 'Eat', seed_num: 3, price: 6 });
    if (num === 3) return new TestItem('Corn Seed', amount, { class: 'Seed', plant_num: 21 });
    if (num === 31) return new TestItem('Veggie Oil', amount);
    if (num === 20) return new TestItem('Right Command', amount, { class: 'Command', command: 'right' });
    if (num === 23) return new TestItem('Interact Command', amount, { class: 'Command', command: 'interact' });
    if (num === 29) return new TestItem('Add to Chest Command', amount, { class: 'Command', command: 'add_to_chest' });
    return new TestItem('Unknown', amount);
};
global.checkForSpace = entity => entity.inv.some(item => item === 0) || entity.inv.some(Boolean);
global.addItem = (entity, num, amount) => {
    const incoming = new_item_from_num(num, amount);
    const existing = entity.inv.find(item => item && item !== 0 && item.name === incoming.name);
    if (existing) existing.amount += amount;
    else entity.inv[entity.inv.indexOf(0)] = incoming;
};
global.addMoney = () => {};
global.tile_name_to_num = name => ({ grass: 1, plot: 3, corn: 21, strawberry: 23, Chest: 40 }[name]);
global.new_tile_from_num = (num, x, y) => {
    if (num === 21) return new Plant('corn', 20, x, y, false, 2, 0, 10);
    if (num === 23) return new Plant('strawberry', 22, x, y, false, 7, 1, 10);
    const names = { 1: 'grass', 3: 'plot', 83: 'grinder' };
    return { name: names[num] || 'grass', png: 0, pos: { x, y }, collide: false, class: 'Tile', load() {}, render() {} };
};

vm.runInThisContext(sources + '\nObject.assign(globalThis, { Tile, Entity, MoveableEntity, GridMoveEntity, Robot, FarmRobot, Plant, Level });');

function command(name, commandName) {
    return new TestItem(name, 1, { class: 'Command', command: commandName });
}

function makeLevel(fill = 'grass') {
    const map = Array.from({ length: 3 }, (_, row) => Array.from({ length: 3 }, (_, col) => ({
        name: fill,
        pos: { x: col * tileSize, y: row * tileSize },
        collide: false,
        class: 'Tile',
        render() {}
    })));
    return { map, ladybugs: 0 };
}

function placeRobot(robot, level, row = 1, col = 1) {
    robot.pos.x = col * tileSize;
    robot.pos.y = row * tileSize;
    robot.under_tile = level.map[row][col];
    level.map[row][col] = robot;
}

function ready(robot) {
    robot.moving_timer = 0;
    robot.fuel_timer = 999;
}

// Empty slots advance without consuming energy.
{
    const robot = new Robot('Robot3', 45, 32, 32, [0, 0, 0, 0], 1, [0, 0], 1);
    levels = [[makeLevel()]];
    placeRobot(robot, levels[0][0]);
    robot.fuel = 50;
    ready(robot);
    robot.move(0, 0);
    assert.equal(robot.fuel, 50);
    assert.equal(robot.current_instruction, 1);
}

// A blocked move neither overwrites the destination nor advances/burns fuel.
{
    const level = makeLevel();
    level.map[1][2].collide = true;
    level.map[1][2].name = 'wall';
    const robot = new Robot('Robot3', 45, 32, 32, [0, 0, 0, 0], 1, [command('Right Command', 'right')], 1);
    levels = [[level]];
    placeRobot(robot, level);
    robot.fuel = 50;
    ready(robot);
    robot.move(0, 0);
    assert.equal(level.map[1][2].name, 'wall');
    assert.equal(robot.current_instruction, 0);
    assert.equal(robot.fuel, 50);
    assert.equal(robot.status, 'blocked');
}

// Missing selectors wait safely instead of using the stale hand.
{
    const level = makeLevel();
    const robot = new Robot('Robot3', 45, 32, 32, [0, 0, 0, 0], 1,
        [command('Interact Command', 'interact'), new TestItem('Corn Seed', 1, { class: 'Seed' })], 1);
    levels = [[level]];
    placeRobot(robot, level);
    robot.fuel = 50;
    ready(robot);
    robot.move(0, 0);
    assert.equal(robot.fuel, 50);
    assert.equal(robot.current_instruction, 0);
}

// Robots can only transfer through chests with matching ownership.
{
    const robot = new Robot('Robot3', 45, 32, 32, [0, 0, 0, 0], 1, [], 1);
    robot.playerOwned = true;
    robot.inv[0] = new TestItem('Corn', 3, { class: 'Eat' });
    const chest = { class: 'Chest', playerOwned: false, inv: [[0, 0], [0, 0]] };
    assert.equal(robot.transferToChest(chest, 'Corn'), false);
    chest.playerOwned = true;
    assert.equal(robot.transferToChest(chest, 'Corn'), true);
    assert.equal(chest.inv[0][0].amount, 3);
}

// Robot grinder interaction closes the crop-to-seed loop.
{
    const robot = new Robot('Robot3', 45, 32, 32, [0, 0, 0, 0], 83, [], 1);
    robot.under_tile = new_tile_from_num(83, 32, 32);
    robot.inv[0] = new TestItem('Corn', 1, { class: 'Eat', seed_num: 3 });
    robot.hand = 0;
    levels = [[makeLevel()]];
    robot.onInteract(0, 0);
    assert.ok(robot.inv.some(item => item && item.name === 'Corn Seed' && item.amount >= 2));
}

// Showcase watering uses the plant's real daily water state.
{
    const level = makeLevel();
    const bot = new FarmRobot('WaterBot', 46, 32, 32, ['water'], 1);
    const plant = new Plant('strawberry', 22, 32, 64, false, 7, 1, 10);
    levels = [[level]];
    placeRobot(bot, level);
    level.map[2][1] = plant;
    bot.moving_timer = 0;
    bot.move(0, 0);
    assert.equal(plant.wateredDay, days);
}

// Showcase harvesting collects output and immediately replants the same crop.
{
    const level = makeLevel();
    const bot = new FarmRobot('HarvestBot', 45, 32, 32, ['harvest'], 1);
    const plant = new Plant('corn', 20, 32, 64, false, 2, 0, 10);
    plant.age = all_imgs[plant.png].length - 2;
    levels = [[level]];
    placeRobot(bot, level);
    level.map[2][1] = plant;
    bot.moving_timer = 0;
    bot.move(0, 0);
    assert.ok(bot.inv.some(item => item && item.name === 'Corn'));
    assert.equal(level.map[2][1].class, 'Plant');
    assert.equal(level.map[2][1].age, 0);
}

// A moving entity is updated once even if the level scan encounters its identity twice.
{
    const level = Object.create(Level.prototype);
    let calls = 0;
    const robot = { class: 'Robot', move() { calls += 1; } };
    level.map = [[robot, robot]];
    level.update(0, 0, 99);
    assert.equal(calls, 1);
}

// Run the shipped Auto Farms showcase routes against a full-size level.
{
    const preload = fs.readFileSync(path.join(publicDir, 'preload.js'), 'utf8');
    assert.match(preload, /21, 124/);
    assert.match(preload, /23, 125/);
    const config = fs.readFileSync(path.join(publicDir, 'config/tiles.js'), 'utf8');
    vm.runInThisContext(config + '\nglobalThis.TEST_TILE_DEFINITIONS = TILE_DEFINITIONS;');
    canvasWidth = 23 * tileSize;
    canvasHeight = 19 * tileSize;
    const harvestDefinition = TEST_TILE_DEFINITIONS[124 - 1];
    const waterDefinition = TEST_TILE_DEFINITIONS[125 - 1];
    assert.equal(TEST_TILE_DEFINITIONS.length, 125);
    assert.ok(TEST_TILE_DEFINITIONS.every(Boolean), 'every public tile ID must construct a definition');
    assert.equal(TEST_TILE_DEFINITIONS[105 - 1].name, 'Thomas');
    assert.equal(TEST_TILE_DEFINITIONS[109 - 1].name, 'Job Board');
    assert.equal(TEST_TILE_DEFINITIONS[123 - 1].name, 'Scientist');
    assert.equal(harvestDefinition.name, 'HarvestBot');
    assert.equal(waterDefinition.name, 'WaterBot');
    const map = Array.from({ length: 19 }, (_, row) => Array.from({ length: 23 }, (_, col) => ({
        name: 'grass', pos: { x: col * tileSize, y: row * tileSize }, collide: false, class: 'Tile', render() {}
    })));
    const level = Object.create(Level.prototype);
    level.map = map;
    level.ladybugs = 0;
    const harvestBot = new FarmRobot('HarvestBot', 45, 3 * tileSize, 3 * tileSize, harvestDefinition.instructions, 1);
    const waterBot = new FarmRobot('WaterBot', 46, 12 * tileSize, 7 * tileSize, waterDefinition.instructions, 1);
    placeRobot(harvestBot, level, 3, 3);
    placeRobot(waterBot, level, 7, 12);
    for (const [row, col] of [[2, 3], [3, 2], [3, 5], [5, 3]]) {
        level.map[row][col] = new Plant('corn', 20, col * tileSize, row * tileSize, false, 2, 0, 40);
    }
    for (const col of [11, 14, 15, 16]) {
        level.map[7][col] = new Plant('strawberry', 22, col * tileSize, 7 * tileSize, false, 7, 1, 100);
    }
    levels = [[level]];
    for (let tick = 1; tick <= 150; tick++) level.update(0, 0, tick);
    assert.ok(harvestBot.inv.some(item => item && item.name === 'Corn'), 'showcase harvester should collect crops');
    assert.ok(level.map[7].some(tile => tile && tile.class === 'Plant' && tile.name === 'strawberry' && tile.age > 0),
        'showcase water bot should keep water-dependent crops growing');
}

// Regression for startup world construction: every positive public tile ID
// must produce an object when Level builds a map. This catches registry holes
// such as the former empty ID 105 before newWorld() can crash on tile.name.
{
    const previousAllTiles = global.all_tiles;
    const previousFactory = global.new_tile_from_num;
    global.all_tiles = TEST_TILE_DEFINITIONS;
    global.new_tile_from_num = (id, x, y) => {
        const definition = all_tiles[id - 1];
        if (!definition) return undefined;
        return {
            ...definition,
            pos: { x, y },
            class: definition.class,
            collide: definition.collide === true,
            age: definition.age ?? -1,
            under_tile: 0,
            render() {},
            load() {},
            getReadyForSave() {}
        };
    };
    const ids = TEST_TILE_DEFINITIONS.map((_, index) => index + 1);
    const registryLevel = new Level('Registry regression', [ids], [ids.map(() => 0)]);
    assert.equal(registryLevel.map[0].length, TEST_TILE_DEFINITIONS.length);
    registryLevel.map[0].forEach((tile, index) => {
        assert.ok(tile && tile !== 0, `tile ID ${index + 1} must construct during Level startup`);
        assert.equal(tile.name, TEST_TILE_DEFINITIONS[index].name);
    });
    assert.equal(registryLevel.map[0][105 - 1].name, 'Thomas');
    assert.equal(registryLevel.map[0][123 - 1].name, 'Scientist');
    assert.equal(registryLevel.map[0][124 - 1].name, 'HarvestBot');
    assert.equal(registryLevel.map[0][125 - 1].name, 'WaterBot');
    global.all_tiles = previousAllTiles;
    global.new_tile_from_num = previousFactory;
}

console.log('automation tests: passed');
