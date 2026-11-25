'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readPublic } = require('./support/load');

const source = readPublic('classes/ui/world-menu.js');
const saveNewWorld = source.slice(source.indexOf('async function finishNewWorldSave('), source.indexOf('function showWorldMainMenu('));

function makeGame() {
    let finishSave;
    const saving = new Promise(resolve => { finishSave = resolve; });
    const game = {
        paused: false,
        days: 0,
        pendingNewWorld: { id: 1 },
        saveAll: () => saving,
        captureDaySnapshot() {},
        reportWorldSaveError() {}
    };
    vm.runInNewContext(saveNewWorld, game);
    return { game, finishSave };
}

test('a new world remains playable while its first save is pending', async () => {
    const { game, finishSave } = makeGame();
    const saving = game.finishNewWorldSave();
    assert.equal(game.paused, false);
    finishSave(true);
    await saving;
    assert.equal(game.paused, false);
    assert.equal(game.pendingNewWorld, null);
});

test('finishing the startup save preserves a pause opened during saving', async () => {
    const { game, finishSave } = makeGame();
    const saving = game.finishNewWorldSave();
    game.paused = true;
    finishSave(true);
    await saving;
    assert.equal(game.paused, true);
});

test('a failed first save can still be retried and resume gameplay', async () => {
    const { game, finishSave } = makeGame();
    const saving = game.finishNewWorldSave();
    finishSave(false);
    await saving;
    assert.equal(game.paused, true);
    assert.ok(game.pendingNewWorld);
    game.saveAll = async () => true;
    await game.finishNewWorldSave(true);
    assert.equal(game.paused, false);
    assert.equal(game.pendingNewWorld, null);
});
