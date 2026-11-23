'use strict';

// The death screen's countdown says "Respawn in" unless the death ends the run
// (Perma Death, or the last of the Lives). Player.isFinalDeath() decides that.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const { installBaseGlobals, resetWorld } = require('./support/mocks');
const { readPublic } = require('./support/load');

installBaseGlobals();
resetWorld();

// Isolate the Player class body (same approach as consumables.test.js).
global.MoveableEntity = class MoveableEntity {};
const playerSource = readPublic('classes/tile_classes/player.js');
const controlsStart = playerSource.indexOf('\nvar Controls_');
assert.notEqual(controlsStart, -1, 'Could not isolate the Player class');
vm.runInThisContext(`${playerSource.slice(0, controlsStart)}\nglobalThis.Player = Player;`);

const isFinalDeath = player => Player.prototype.isFinalDeath.call(player);
let lives = 0;

beforeEach(() => {
    global.window = global.window || {};
    global.dificulty = 3;
    window.customRules = { permaDeath: false };
    lives = 0;
    global.customRule = key => (key === 'lives' ? lives : undefined);
});

test('Perma Death makes every death final', () => {
    window.customRules.permaDeath = true;
    assert.equal(isFinalDeath({ transphase: 0 }), true);
    assert.equal(isFinalDeath({ transphase: 1 }), true);
});

test('ordinary custom deaths respawn', () => {
    assert.equal(isFinalDeath({ transphase: 1 }), false);
});

test('preset difficulties never end the run, even if stale custom rules linger', () => {
    window.customRules.permaDeath = true;
    for (const dif of [0, 1, 2]) {
        global.dificulty = dif;
        assert.equal(isFinalDeath({ transphase: 1 }), false, `difficulty ${dif}`);
    }
});

test('only the death that uses the last life is final', () => {
    lives = 3;
    assert.equal(isFinalDeath({ transphase: 1, livesUsed: 0 }), false);
    assert.equal(isFinalDeath({ transphase: 1, livesUsed: 1 }), false);
    assert.equal(isFinalDeath({ transphase: 1, livesUsed: 2 }), true);
});

test('after a non-final death is applied (transphase 2) it is not counted twice', () => {
    lives = 3;
    // deathConsequence already bumped livesUsed from 1 to 2 for this death.
    assert.equal(isFinalDeath({ transphase: 2, livesUsed: 2 }), false);
});
