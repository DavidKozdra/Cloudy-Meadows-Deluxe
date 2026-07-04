const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const publicDir = path.resolve(__dirname, '../public');

function loadDefinition(file, variableName) {
    const source = fs.readFileSync(file, 'utf8');
    const context = {};
    vm.runInNewContext(`${source}\nglobalThis.result = ${variableName};`, context, { filename: file });
    return JSON.parse(JSON.stringify(context.result));
}

function extractFunction(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `Missing function ${name}`);
    const bodyStart = source.indexOf('{', start);
    let depth = 0;
    let quote = null;
    let escaped = false;

    for (let index = bodyStart; index < source.length; index++) {
        const char = source[index];
        if (quote) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === quote) quote = null;
            continue;
        }
        if (char === "'" || char === '"' || char === '`') {
            quote = char;
            continue;
        }
        if (char === '{') depth += 1;
        if (char === '}' && --depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`Unterminated function ${name}`);
}

global.window = {};
global.MoveableEntity = class MoveableEntity {};
global.maxHunger = 100;
global.floor = Math.floor;
global.random = (min, max) => (min + max) / 2;
global.millis = () => 1000;
global.EatSound = { play() {} };
global.ErrorSound = { play() {} };
global.all_items = loadDefinition(path.join(publicDir, 'config/items.js'), 'ITEM_DEFINITIONS');

const itemSource = fs.readFileSync(path.join(publicDir, 'classes/item.js'), 'utf8');
vm.runInThisContext(`${itemSource}\nObject.assign(globalThis, { Item, Eat, Seed, Tool, Placeable, Command, Backpack });`);

const miscSource = fs.readFileSync(path.join(publicDir, 'miscfunctions.js'), 'utf8');
const helperNames = ['isValidItemNum', 'new_item_from_num', 'addItem', 'checkForSpace', 'item_name_to_num'];
vm.runInThisContext(helperNames.map(name => extractFunction(miscSource, name)).join('\n'));

const playerSource = fs.readFileSync(path.join(publicDir, 'classes/tile_classes/player.js'), 'utf8');
const controlsStart = playerSource.indexOf('\nvar Controls_');
assert.notEqual(controlsStart, -1, 'Could not isolate the Player class');
vm.runInThisContext(`${playerSource.slice(0, controlsStart)}\nglobalThis.Player = Player;`);

function playerWith(item) {
    return {
        dead: false,
        hunger: 0,
        hunger_counter: 50,
        hunger_timer: 0,
        lasteatMili: 0,
        lastFoodnum: 0,
        hand: 0,
        inv: [item, 0, 0, 0, 0, 0, 0, 0]
    };
}

// Seedless foods consume cleanly; item ID 0 remains the empty-slot sentinel.
{
    const player = playerWith(new_item_from_num(35, 1));
    Player.prototype.eat.call(player);
    assert.equal(player.inv[0], 0);
    assert.equal(player.hunger, 100);
    assert.equal(player.lastFoodnum, 35);
    assert.ok(player.inv.every(slot => slot !== undefined));
}

// Seedless food stacks do not require a spare inventory slot.
{
    const hotdogs = new_item_from_num(35, 2);
    const player = playerWith(hotdogs);
    player.inv.fill(new_item_from_num(4, 1), 1);
    Player.prototype.eat.call(player);
    assert.equal(hotdogs.amount, 1);
    assert.equal(player.hunger, 100);
}

// Crop foods preserve configured seed ranges when instantiated and eaten.
{
    const corn = new_item_from_num(2, 1);
    assert.equal(corn.seed_min, 1);
    assert.equal(corn.seed_max, 2);
    const player = playerWith(corn);
    Player.prototype.eat.call(player);
    const seeds = player.inv.find(item => item && item.name === 'Corn Seed');
    assert.ok(seeds);
    assert.equal(seeds.amount, 2);
}

// Invalid additions fail closed and leave the inventory unchanged.
{
    const player = playerWith(0);
    const before = player.inv.slice();
    assert.equal(addItem(player, 0, 1), false);
    assert.deepEqual(player.inv, before);
    assert.equal(new_item_from_num(0, 1), undefined);
}

console.log('Consumable regression tests passed.');
