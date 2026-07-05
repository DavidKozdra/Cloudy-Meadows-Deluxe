'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { installBaseGlobals, resetWorld } = require('./support/mocks');
const { installGameHelpers } = require('./support/game-helpers');
const { readPublic } = require('./support/load');
const vm = require('node:vm');

// --- Environment ------------------------------------------------------------
installBaseGlobals();
resetWorld();
global.maxHunger = 100;
installGameHelpers();

// Player extends MoveableEntity; the eat() path under test never calls super,
// so an empty base class is enough to let the declaration evaluate.
global.MoveableEntity = class MoveableEntity {};

// The Player class is defined at the top of player.js; the rest of the file is
// standalone control/key globals that pull in the whole browser sketch. Isolate
// just the class body by cutting at the first `var Controls_` declaration.
const playerSource = readPublic('classes/tile_classes/player.js');
const controlsStart = playerSource.indexOf('\nvar Controls_');
assert.notEqual(controlsStart, -1, 'Could not isolate the Player class');
vm.runInThisContext(`${playerSource.slice(0, controlsStart)}\nglobalThis.Player = Player;`);

// Item IDs from the shipped config (looked up by name so the tests survive
// registry renumbering).
const CORN = item_name_to_num('Corn');
const HOTDOG = item_name_to_num('Hotdog');
const JUNK = item_name_to_num('Junk');

// A minimal player stand-in carrying the fields eat() touches, with `item` in
// the first (held) slot.
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

test('seedless food consumes cleanly and leaves the empty-slot sentinel', () => {
    const player = playerWith(new_item_from_num(HOTDOG, 1));
    Player.prototype.eat.call(player);
    assert.equal(player.inv[0], 0, 'consumed hotdog slot returns to the 0 sentinel');
    assert.equal(player.hunger, 100);
    assert.equal(player.lastFoodnum, HOTDOG);
    assert.ok(player.inv.every(slot => slot !== undefined), 'no slot is left undefined');
});

test('a seedless food stack does not require a spare inventory slot', () => {
    const hotdogs = new_item_from_num(HOTDOG, 2);
    const player = playerWith(hotdogs);
    player.inv.fill(new_item_from_num(JUNK, 1), 1); // fill every other slot
    Player.prototype.eat.call(player);
    assert.equal(hotdogs.amount, 1, 'one hotdog is eaten from the stack');
    assert.equal(player.hunger, 100);
});

test('crop foods preserve configured seed ranges and drop seeds when eaten', () => {
    const corn = new_item_from_num(CORN, 1);
    assert.equal(corn.seed_min, 1);
    assert.equal(corn.seed_max, 2);
    const player = playerWith(corn);
    Player.prototype.eat.call(player);
    const seeds = player.inv.find(item => item && item.name === 'Corn Seed');
    assert.ok(seeds, 'eating corn yields corn seed');
    assert.equal(seeds.amount, 2, 'deterministic random picks the midpoint of the seed range');
});

test('a crop food eaten with no room for byproduct is not consumed', () => {
    // amount > 1 forces the checkForSpace path; fill every slot so it fails.
    const corn = new_item_from_num(CORN, 3);
    const player = playerWith(corn);
    player.inv.fill(new_item_from_num(JUNK, 1), 1);
    Player.prototype.eat.call(player);
    assert.equal(corn.amount, 3, 'no room for seeds means the crop is left uneaten');
    assert.equal(player.hunger, 0);
});

test('a full player at max hunger will not eat', () => {
    const corn = new_item_from_num(CORN, 2);
    const player = playerWith(corn);
    player.hunger = 100;
    Player.prototype.eat.call(player);
    assert.equal(corn.amount, 2, 'a sated player leaves food untouched');
});

test('invalid additions fail closed and leave the inventory unchanged', () => {
    const player = playerWith(0);
    const before = player.inv.slice();
    assert.equal(addItem(player, 0, 1), false, 'item ID 0 is rejected');
    assert.deepEqual(player.inv, before);
    assert.equal(new_item_from_num(0, 1), undefined, 'item ID 0 constructs nothing');
});
