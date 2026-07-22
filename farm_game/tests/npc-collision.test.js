'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const { readPublic } = require('./support/load');

const sandbox = {
    GridMoveEntity: class GridMoveEntity {},
    tileSize: 32,
    frameCount: 10,
    randomDavidVariantIndex: () => 3,
    davidVariantImgFor: index => `david-${index}`,
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

test('David shares one stable sprite variant between 2D and 3D rendering', () => {
    const getSprite = sandbox.TestNPC.prototype.getDavidVariantSprite;
    const david = { name: 'David', davidVariant: 1, davidLastRenderFrame: 9 };

    assert.equal(getSprite.call(david), 'david-1', 'consecutive renders preserve the variant');
    assert.equal(david.davidVariant, 1);

    sandbox.frameCount = 12;
    assert.equal(getSprite.call(david), 'david-3', 'returning after a render gap selects a variant');
    assert.equal(david.davidVariant, 3);
});
