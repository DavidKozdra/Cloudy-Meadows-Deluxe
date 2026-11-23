'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readPublic } = require('./support/load');

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function makeWorlds(initial = {}) {
    const data = new Map(Object.entries(clone(initial)));
    const raw = {
        get: key => clone(data.get(key)),
        set: (key, value) => data.set(key, clone(value)),
        remove: key => data.delete(key),
        clear: () => data.clear(),
        keys: () => data.size,
        key: index => 'passphrase.life.' + [...data.keys()][index],
        showprefix: () => 'passphrase.life.'
    };
    const state = { window: {} };
    vm.runInNewContext(readPublic('classes/world-saves.js'), state);
    return { worlds: state.window.CloudyWorldSaves.create(raw), create: () => state.window.CloudyWorldSaves.create(raw), raw, data };
}

function saveWorld(worlds, id, days = id * 10) {
    worlds.activate(id);
    worlds.store.set('Day_curLvl_Dif', {
        days, dificulty: id - 1, currentLevel_x: 4, currentLevel_y: 1,
        currentWeather: 'rain', weatherLog: [{ day: days, weather: 'rain' }]
    });
    worlds.store.set('player', { coins: id * 100, pos: { x: 32, y: 64 }, inv: [], quests: [] });
    worlds.store.set('Cloudy Meadows: Home', { name: 'Cloudy Meadows: Home', map: [[{ name: `crop-${id}` }]] });
    worlds.store.set('Extra y:0 x:1', { name: 'Extra y:0 x:1', map: [[id]] });
}

test('an existing save becomes World 1 without rewriting or deleting its data', () => {
    const legacy = {
        Day_curLvl_Dif: { days: 42, dificulty: 1, currentLevel_x: 4, currentLevel_y: 1, currentWeather: 'fog' },
        player: { coins: 1234, pos: { x: 1, y: 2 }, inv: [], quests: [] },
        'Cloudy Meadows: Home': { map: [[1]] }, Options: { musicVolume: 0.4 }
    };
    const { worlds, data } = makeWorlds(legacy);
    assert.equal(worlds.activeId, 1);
    assert.equal(worlds.summary(1).valid, true);
    assert.equal(worlds.summary(1).days, 42);
    assert.equal(worlds.summary(1).coins, 1234);
    assert.equal(worlds.summary(2).occupied, false);
    assert.equal(worlds.summary(3).occupied, false);
    assert.deepEqual(Object.fromEntries(data), legacy);
});

test('three worlds keep independent players, levels and weather through switching and reload', () => {
    const { worlds, create } = makeWorlds();
    for (let id = 1; id <= 3; id++) saveWorld(worlds, id);
    const loaded = create();
    assert.equal(loaded.activeId, 3);
    for (let id = 1; id <= 3; id++) {
        loaded.activate(id);
        assert.equal(loaded.store.get('player').coins, id * 100);
        assert.equal(loaded.store.get('Cloudy Meadows: Home').map[0][0].name, `crop-${id}`);
        assert.equal(loaded.store.get('Extra y:0 x:1').map[0][0], id);
        assert.deepEqual(clone(loaded.store.get('Day_curLvl_Dif').weatherLog), [{ day: id * 10, weather: 'rain' }]);
    }
});

test('repeated tile data uses less storage and still round-trips as objects', () => {
    const { worlds, raw } = makeWorlds();
    const level = { name: 'Farm', map: Array.from({ length: 20 }, () => [{
        name: 'grass', class: 'Tile', png: 1, pos: { x: 32, y: 64 }, age: 0, variant: 0, collide: false
    }]) };
    worlds.store.set('Farm', level);
    assert.ok(JSON.stringify(raw.get('Farm')).length < JSON.stringify(level).length * 0.7);
    assert.deepEqual(clone(worlds.store.get('Farm')), level);
    worlds.store.set('Options', { musicVolume: 0.2 });
    assert.deepEqual(raw.get('Options'), { musicVolume: 0.2 }, 'shared settings remain compatible with bootstrap readers');
});

test('options, controls and custom presets are shared while clearing a world keeps them', () => {
    const { worlds } = makeWorlds();
    saveWorld(worlds, 1);
    saveWorld(worlds, 2);
    for (const key of ['Options', 'Controls', 'customRulePresets']) worlds.store.set(key, { test: key });
    worlds.store.clear();
    assert.equal(worlds.summary(2).occupied, false);
    assert.equal(worlds.summary(1).valid, true);
    worlds.activate(1);
    for (const key of ['Options', 'Controls', 'customRulePresets']) assert.deepEqual(worlds.store.get(key), { test: key });
});

test('making room for new worlds compacts legacy maps without changing their contents or shared settings', () => {
    const tile = JSON.parse('{"name":"corn","pos":{"x":32,"y":64},"__proto__":{"safe":true},"state":[null,false,0,-2,"🌽",[],{}]}');
    const level = { name: 'Old Farm', map: Array.from({ length: 40 }, () => [tile]) };
    const { worlds, raw } = makeWorlds({ 'Old Farm': level, Options: { musicVolume: 0.5 } });
    worlds.compact();
    assert.ok(JSON.stringify(raw.get('Old Farm')).length < JSON.stringify(level).length);
    assert.deepEqual(clone(worlds.store.get('Old Farm')), level);
    assert.deepEqual(raw.get('Options'), { musicVolume: 0.5 });
    const once = clone(raw.get('Old Farm'));
    worlds.compact();
    assert.deepEqual(raw.get('Old Farm'), once, 'already compacted data is not encoded twice');
});

for (const deleted of [1, 2, 3]) {
    test(`deleting World ${deleted} removes all its generated areas and keeps the other two worlds`, () => {
        const { worlds } = makeWorlds();
        for (let id = 1; id <= 3; id++) saveWorld(worlds, id);
        worlds.clearWorld(deleted);
        assert.equal(worlds.summary(deleted).occupied, false);
        assert.deepEqual(clone(worlds.store.worldKeys(deleted)), []);
        for (let id = 1; id <= 3; id++) {
            if (id === deleted) continue;
            worlds.activate(id);
            assert.equal(worlds.summary(id).valid, true);
            assert.equal(worlds.store.get('player').coins, id * 100);
        }
    });
}

test('clear all removes all three worlds and shared settings', () => {
    const { worlds, data } = makeWorlds();
    for (let id = 1; id <= 3; id++) saveWorld(worlds, id);
    worlds.store.set('Options', { musicVolume: 0.5 });
    worlds.clearAll();
    assert.equal(worlds.activeId, 1);
    assert.equal(data.size, 0);
    assert.ok(worlds.list().every(world => !world.occupied));
});

test('partial or malformed saves cannot be continued or silently reused as empty slots', () => {
    const { worlds } = makeWorlds({ player: { coins: 10 } });
    assert.equal(worlds.summary(1).valid, false);
    assert.equal(worlds.summary(1).occupied, true);
    worlds.activate(2);
    worlds.store.set('Day_curLvl_Dif', { days: -2, dificulty: 0 });
    assert.equal(worlds.summary(2).valid, false);
    assert.equal(worlds.summary(2).occupied, true);
    worlds.activate(3);
    worlds.store.set('Day_curLvl_Dif', { days: 0, dificulty: 3, currentLevel_x: 4, currentLevel_y: 1, customRules: { startingCoins: 250 } });
    assert.equal(worlds.summary(3).valid, true, 'legacy new games may not have a saved player yet');
    assert.equal(worlds.summary(3).coins, 250);
});

test('summary info updates after saving without loading that world into gameplay', () => {
    const { worlds } = makeWorlds();
    assert.equal(worlds.summary(1).valid, false);
    saveWorld(worlds, 1, 20);
    worlds.store.set('__worldInfo', { location: 'Cloudy Meadows: Home', updatedAt: '2026-11-23T12:00:00Z' });
    assert.equal(worlds.summary(1).days, 20);
    assert.equal(worlds.summary(1).location, 'Cloudy Meadows: Home');
    worlds.store.set('player', { coins: 999, inv: [], quests: [], pos: { x: 0, y: 0 } });
    assert.equal(worlds.summary(1).coins, 999);
});

test('invalid slot IDs and reserved keys cannot modify another world', () => {
    const { worlds, data } = makeWorlds();
    for (const id of [0, 4, -1, 1.5, '2', null]) {
        assert.throws(() => worlds.activate(id), /Invalid world slot/);
        assert.throws(() => worlds.clearWorld(id), /Invalid world slot/);
    }
    for (const key of ['__cloudyActiveWorld', '__cloudyWorld2:player']) {
        assert.throws(() => worlds.store.set(key, {}), /Invalid world data key/);
    }
    assert.equal(data.size, 0);
});

test('import replaces only the selected world, including its generated areas', async () => {
    const { worlds } = makeWorlds();
    for (let id = 1; id <= 3; id++) saveWorld(worlds, id);
    worlds.activate(2);
    const misc = readPublic('miscfunctions.js');
    const state = {
        localData: worlds.store, setSaveTransferStatus() {}, refreshSaveTransferButtons() {}, alert() {},
        window: { location: { reload() {} } }
    };
    vm.runInNewContext(misc.slice(misc.indexOf('function normalizeImportedSavePayload('), misc.indexOf('function ensureSaveImportInput(')), state);
    await state.importSaveDataFromText(JSON.stringify({ data: {
        Day_curLvl_Dif: { days: 8, dificulty: 0, currentLevel_x: 4, currentLevel_y: 1 },
        levels: { Home: { name: 'Home', map: [[2]] } }
    } }));
    assert.equal(worlds.summary(2).days, 8);
    assert.equal(worlds.store.get('Extra y:0 x:1'), undefined);
    assert.equal(worlds.summary(1).coins, 100);
    assert.equal(worlds.summary(3).coins, 300);
});

for (const difficulty of [2, 3]) {
    test(`permanent death in difficulty ${difficulty} deletes only the active world`, () => {
        const { worlds } = makeWorlds();
        for (let id = 1; id <= 3; id++) saveWorld(worlds, id);
        worlds.activate(2);
        const misc = readPublic('miscfunctions.js');
        const state = {
            localData: worlds.store, window: { customRules: { permaDeath: true }, addEventListener() {} },
            document: { addEventListener() {} },
            newWorld() {}, title_screen: false,
            localStorage: { clear() { assert.fail('Must not erase other worlds'); } }
        };
        vm.runInNewContext(misc.slice(misc.indexOf('function deleteSave()'), misc.indexOf('function selectDifficulty(')), state);
        vm.runInNewContext('class MoveableEntity {}\n' + readPublic('classes/tile_classes/player.js') + '\nthis.Player = Player;', state);
        const player = Object.create(state.Player.prototype);
        player.deathConsequence(difficulty);
        assert.equal(worlds.summary(2).occupied, false);
        assert.equal(worlds.summary(1).valid, true);
        assert.equal(worlds.summary(3).valid, true);
    });
}

test('Continue opens one valid world directly and offers a picker for several', () => {
    const { worlds } = makeWorlds();
    const calls = [];
    const state = { worldSaves: worlds, window: { addEventListener() {} } };
    vm.runInNewContext(readPublic('classes/ui/world-menu.js'), state);
    state.openSavedWorld = id => calls.push(['open', id]);
    state.showWorldPicker = mode => calls.push(['picker', mode]);
    state.continueWorldGame();
    saveWorld(worlds, 3);
    state.continueWorldGame();
    saveWorld(worlds, 1);
    state.continueWorldGame();
    assert.deepEqual(calls, [['picker', 'new'], ['open', 3], ['picker', 'continue']]);
});
