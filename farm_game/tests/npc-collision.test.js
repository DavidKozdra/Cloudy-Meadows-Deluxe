'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const { readPublic } = require('./support/load');

const sandbox = {
    GridMoveEntity: class GridMoveEntity {},
    tileSize: 32,
    currentLevel_x: 2,
    currentLevel_y: 3,
    player: { pos: { x: 5 * 32, y: 7 * 32 } }
};

vm.runInNewContext(
    `${readPublic('classes/tile_classes/npc.js')}\nglobalThis.TestNPC = NPC;`,
    sandbox
);

test('all NPCs reject the player grid cell without blocking other cells', () => {
    const canEnter = sandbox.TestNPC.prototype.canEnterGridCell;
    const npc = {};

    assert.equal(canEnter.call(npc, 2, 3, 5, 7), false);
    assert.equal(canEnter.call(npc, 2, 3, 6, 7), true);
    assert.equal(canEnter.call(npc, 1, 3, 5, 7), true, 'offscreen NPC rooms are unaffected');
});
