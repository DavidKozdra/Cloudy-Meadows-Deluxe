'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readPublic, extractArray, loadDefinition } = require('./support/load');

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const FIXED_DATE = '2026-11-23T12:00:00.000Z';

function memoryStore(initial = {}) {
    const data = new Map(Object.entries(clone(initial)));
    return {
        data,
        get: key => data.has(key) ? clone(data.get(key)) : null,
        set: (key, value) => { data.set(key, clone(value)); }
    };
}

// Runs achievements.js in a fresh context. Game globals (days, localData...)
// can be changed on the returned context before firing an event.
function loadAchievements(globals = {}) {
    const listeners = {};
    const context = {
        console: { warn() {}, log() {} },
        addEventListener: (type, handler) => { (listeners[type] ||= []).push(handler); },
        ...globals
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(readPublic('classes/achievements.js'), context);
    const fire = (type, detail) => (listeners[type] || []).forEach(handler => handler({ type, detail }));
    return { context, api: context.CloudyAchievements, fire };
}

const { api } = loadAchievements();

function makeTracker(store = memoryStore()) {
    const unlocked = [];
    const tracker = api.create(store, { onUnlock: def => unlocked.push(def.id), now: () => FIXED_DATE });
    return { tracker, unlocked, store };
}

const progressOf = (tracker, id) => clone(tracker.list().find(entry => entry.id === id).progress);

test('every achievement from the design is defined once', () => {
    assert.deepEqual(clone(api.DEFINITIONS.map(def => def.title)), [
        'Corn Addict', 'Gamer', 'Hello World', 'Bible Reference', "It's Like Minecraft", 'Nice', 'Absolute Gamer'
    ]);
    assert.equal(new Set(api.DEFINITIONS.map(def => def.id)).size, api.DEFINITIONS.length);
});

test('corn harvests add up and unlock Corn Addict at 1,000, once', () => {
    const { tracker, unlocked, store } = makeTracker();
    tracker.recordHarvest('Tomato', 500);
    tracker.recordHarvest('Corn', 0);
    tracker.recordHarvest('Corn', -5);
    tracker.recordHarvest('Corn', 'lots');
    tracker.recordHarvest('Corn', 999);
    assert.equal(tracker.isUnlocked('corn-addict'), false);
    assert.deepEqual(progressOf(tracker, 'corn-addict'), { current: 999, goal: 1000 });

    tracker.recordHarvest('Corn', 3);
    tracker.recordHarvest('Corn', 50);
    assert.deepEqual(unlocked, ['corn-addict']);
    assert.deepEqual(progressOf(tracker, 'corn-addict'), { current: 1000, goal: 1000 });
    const saved = store.get('Achievements');
    assert.equal(saved.cornHarvested, 1052);
    assert.equal(saved.unlocked['corn-addict'], FIXED_DATE);
});

test('progress is read back from storage', () => {
    const store = memoryStore();
    api.create(store).recordHarvest('Corn', 400);
    api.create(store).recordNpcTalk('Rick');
    const reloaded = api.create(store);
    assert.equal(progressOf(reloaded, 'corn-addict').current, 400);
    assert.equal(progressOf(reloaded, 'hello-world').current, 1);
});

test('Hello World needs every NPC in the world, each counted once', () => {
    const { tracker, unlocked } = makeTracker();
    tracker.recordNpcTalk('Jake'); // a shop, not an NPC
    tracker.recordNpcTalk('Deb'); // defined but never placed in the world
    tracker.recordNpcTalk(undefined);
    const last = api.ALL_NPCS[api.ALL_NPCS.length - 1];
    for (const name of api.ALL_NPCS.slice(0, -1)) {
        tracker.recordNpcTalk(name);
        tracker.recordNpcTalk(name);
    }
    assert.deepEqual(progressOf(tracker, 'hello-world'), {
        current: api.ALL_NPCS.length - 1, goal: api.ALL_NPCS.length, remaining: [last]
    });
    assert.deepEqual(unlocked, []);
    tracker.recordNpcTalk(last);
    assert.deepEqual(unlocked, ['hello-world']);
});

test('Nice unlocks on day 69', () => {
    const { tracker, unlocked } = makeTracker();
    tracker.checkWorld({ days: 68, weatherLog: [] });
    assert.deepEqual(unlocked, []);
    tracker.checkWorld({ days: 69, weatherLog: [] });
    tracker.checkWorld({ days: 120, weatherLog: [] });
    assert.deepEqual(unlocked, ['nice']);
});

test('Bible Reference counts separate frog-rain days in the world weather log', () => {
    const { tracker, unlocked } = makeTracker();
    const weatherLog = [
        { day: 3, weather: 'frog-rain' },
        { day: 3, weather: 'frog-rain' },
        { day: 4, weather: 'rain' }
    ];
    tracker.checkWorld({ days: 4, weatherLog });
    assert.deepEqual(unlocked, []);
    weatherLog.push({ day: 9, weather: 'frog-rain' });
    tracker.checkWorld({ days: 9, weatherLog });
    assert.deepEqual(unlocked, ['bible-reference']);
    assert.equal(api.frogRainDays(null), 0);
});

test('beating the game checks Hard/Hardcore, 3D mode and a finish before day 20', () => {
    const misc = readPublic('miscfunctions.js');
    const presets = extractArray(misc, misc.indexOf('const BUILT_IN_RULE_PRESETS')).value;
    const hardcore = presets.find(preset => preset.id === 'hardcore').rules;
    const sandbox = presets.find(preset => preset.id === 'sandbox').rules;

    const cases = [
        [{ difficulty: 0, days: 50, is3D: false }, []],
        [{ difficulty: 1, days: 50 }, []],
        [{ difficulty: 2, days: 50 }, ['gamer']],
        [{ difficulty: 3, rules: hardcore, days: 50 }, ['gamer']],
        [{ difficulty: 3, rules: { ...hardcore, permaDeath: false }, days: 50 }, []],
        [{ difficulty: 3, rules: sandbox, days: 50 }, []],
        [{ difficulty: 3, rules: null, days: 50 }, []],
        [{ difficulty: 0, days: 50, is3D: true }, ['like-minecraft']],
        [{ difficulty: 0, days: 19 }, ['absolute-gamer']],
        [{ difficulty: 0, days: 20 }, []],
        [{ difficulty: 0 }, []],
        [{ difficulty: 2, days: 5, is3D: true }, ['gamer', 'like-minecraft', 'absolute-gamer']]
    ];
    for (const [run, expected] of cases) {
        const { tracker, unlocked } = makeTracker();
        tracker.recordGameBeaten(run);
        assert.deepEqual(unlocked, expected, JSON.stringify(run));
    }
});

test('damaged or outdated stored data is cleaned up', () => {
    const { tracker } = makeTracker(memoryStore({
        Achievements: {
            unlocked: { nice: '2026-01-01T00:00:00.000Z', retired: FIXED_DATE, gamer: 5 },
            cornHarvested: 'lots',
            npcsTalkedTo: ['Rick', 'Rick', 'Nobody']
        }
    }));
    assert.equal(tracker.isUnlocked('nice'), true);
    assert.equal(tracker.isUnlocked('gamer'), false);
    assert.equal(tracker.unlockedCount(), 1);
    assert.equal(progressOf(tracker, 'corn-addict').current, 0);
    assert.equal(progressOf(tracker, 'hello-world').current, 1);

    assert.equal(makeTracker(memoryStore({ Achievements: 'garbage' })).tracker.unlockedCount(), 0);
    const broken = { get() { throw new Error('storage blocked'); }, set() { throw new Error('storage full'); } };
    const { tracker: offline, unlocked } = makeTracker(broken);
    offline.checkWorld({ days: 70 });
    assert.deepEqual(unlocked, ['nice'], 'a failed save still unlocks for this session');
});

test('the NPC list matches every NPC placed in the world', () => {
    const tiles = loadDefinition('config/tiles.js', 'TILE_DEFINITIONS', { kiahTileNum: 122 });
    const npcNames = new Map();
    tiles.forEach((def, index) => { if (def.class === 'NPC') npcNames.set(index + 1, def.name); });

    const placed = new Set();
    const preload = readPublic('preload.js');
    for (const match of preload.matchAll(/new Level\(\s*(['"])[^'"]+\1\s*,/g)) {
        const map = extractArray(preload, match.index + match[0].length, { kiahTileNum: 122 }).value;
        map.flat().forEach(num => { if (npcNames.has(num)) placed.add(npcNames.get(num)); });
    }
    // NPCs spawned during play, such as the Scientist on day 88.
    for (const file of ['sketch.js', 'miscfunctions.js', 'classes/quest.js']) {
        for (const match of readPublic(file).matchAll(/new_tile_from_num\(\s*(\d+)\s*,/g)) {
            if (npcNames.has(Number(match[1]))) placed.add(npcNames.get(Number(match[1])));
        }
    }
    assert.deepEqual([...api.ALL_NPCS].sort(), [...placed].sort());
});

test('achievements are shared by every world and survive deleting one', () => {
    const data = new Map();
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
    const worlds = state.window.CloudyWorldSaves.create(raw);

    worlds.activate(2);
    worlds.store.set('Day_curLvl_Dif', { days: 70 });
    api.create(worlds.store).checkWorld({ days: 70 });
    worlds.activate(1);
    assert.equal(api.create(worlds.store).isUnlocked('nice'), true, 'visible from another world');
    worlds.clearWorld(2);
    worlds.clearWorld(1);
    assert.equal(api.create(worlds.store).isUnlocked('nice'), true, 'kept after deleting worlds');
});

test('game events and harvest sites feed the tracker', () => {
    const store = memoryStore();
    const { context, fire } = loadAchievements({
        localData: store,
        all_items: [{ name: 'empty' }, { name: 'Corn' }, { name: 'Tomato' }],
        days: 12, dificulty: 2, is3DMode: true, weatherLog: []
    });
    const saved = () => store.get('Achievements') || { unlocked: {} };

    context.recordCropHarvest(1, 600, 'Cloudy Meadows: Home', true);
    context.recordCropHarvest(1, 5000, 'Auto Farms: 2', false); // the district's own bots
    context.recordCropHarvest(2, 5000, 'Cloudy Meadows: Home', true);
    assert.equal(saved().cornHarvested, 600);
    context.recordCropHarvest(1, 400, 'Cloudy Meadows: Home', false); // the player's robot
    assert.ok(saved().unlocked['corn-addict']);

    fire('npcInteraction', { npcName: 'Rick' });
    assert.deepEqual(saved().npcsTalkedTo, ['Rick']);

    fire('questCompleted', { quest: { og_name: 'Talk to some people' } });
    assert.equal(Object.keys(saved().unlocked).length, 1);
    fire('questCompleted', { quest: { og_name: 'Save Cloudy Meadows' } });
    for (const id of ['gamer', 'like-minecraft', 'absolute-gamer']) assert.ok(saved().unlocked[id], id);

    context.days = 69;
    context.weatherLog = [{ day: 2, weather: 'frog-rain' }, { day: 40, weather: 'frog-rain' }];
    fire('newDay', { day: 69 });
    assert.ok(saved().unlocked.nice);
    assert.ok(saved().unlocked['bible-reference']);
});
