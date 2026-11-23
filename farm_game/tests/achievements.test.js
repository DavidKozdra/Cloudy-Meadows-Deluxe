'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { readPublic, publicPath, extractArray, loadDefinition } = require('./support/load');

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
const byId = id => api.DEFINITIONS.find(def => def.id === id);

function makeTracker(store = memoryStore()) {
    const unlocked = [];
    const tracker = api.create(store, { onUnlock: def => unlocked.push(def.id), now: () => FIXED_DATE });
    return { tracker, unlocked, store };
}

const progressOf = (tracker, id) => clone(tracker.list().find(entry => entry.id === id).progress);
const repeat = (count, action) => { for (let i = 0; i < count; i++) action(); };

// For each stat, how to raise it by n through the real event types.
const STAT_PRODUCERS = {
    planted: (tracker, n) => repeat(n, () => tracker.track('plant')),
    tilled: (tracker, n) => repeat(n, () => tracker.track('till')),
    harvested: (tracker, n) => tracker.track('harvest', { name: 'Tomato', amount: n }),
    composted: (tracker, n) => tracker.track('compost', { amount: n }),
    sold: (tracker, n) => tracker.track('sell', { amount: n }),
    bought: (tracker, n) => repeat(n, () => tracker.track('buy')),
    coinsEarned: (tracker, n) => tracker.track('earn', { amount: n, total: 0 }),
    // Best-value stats: raise the best seen by n.
    mostCoins: (tracker, n) => tracker.track('earn', { amount: 1, total: tracker.stat('mostCoins') + n }),
    contracts: (tracker, n) => repeat(n, () => tracker.track('contract')),
    deaths: (tracker, n) => repeat(n, () => tracker.track('death')),
    gamesWon: (tracker, n) => repeat(n, () => tracker.recordGameBeaten({ difficulty: 0, days: 50, deaths: 3 })),
    sideQuests: (tracker, n) => repeat(n, () => tracker.track('quest')),
    highestDay: (tracker, n) => tracker.checkWorld({ days: tracker.stat('highestDay') + n, weatherLog: [] }),
    trips: (tracker, n) => repeat(n, () => tracker.track('travel', { via: 'train' })),
    'trips:balloon': (tracker, n) => repeat(n, () => tracker.track('travel', { via: 'balloon' })),
    robotsPlaced: (tracker, n) => repeat(n, () => tracker.track('place', { name: 'Robot2' })),
    robotHarvested: (tracker, n) => tracker.track('harvest', { name: 'Carrot', amount: n, byRobot: true }),
    robotsBoomed: (tracker, n) => repeat(n, () => tracker.track('robotBoom')),
    rewinds: (tracker, n) => repeat(n, () => tracker.track('rewind')),
    fastForwards: (tracker, n) => repeat(n, () => tracker.track('fastForward')),
    creditsViewed: (tracker, n) => repeat(n, () => tracker.track('credits')),
    otherLanguage: (tracker, n) => repeat(n, () => tracker.track('language', { language: 'ja' }))
};

function producerFor(stat) {
    if (STAT_PRODUCERS[stat]) return STAT_PRODUCERS[stat];
    const [kind, name] = stat.split(/:(.*)/s);
    if (kind === 'harvest') return (tracker, n) => tracker.track('harvest', { name, amount: n });
    if (kind === 'placed') return (tracker, n) => repeat(n, () => tracker.track('place', { name }));
    if (kind === 'eat') return (tracker, n) => repeat(n, () => tracker.track('eat', { name }));
    if (kind === 'talk') return (tracker, n) => repeat(n, () => tracker.track('talk', { name }));
    return null;
}

// How to find one entry of each collection.
const COLLECTORS = {
    npcs: (tracker, name) => tracker.track('talk', { name }),
    crops: (tracker, name) => tracker.track('harvest', { name, amount: 1 }),
    foods: (tracker, name) => tracker.track('eat', { name }),
    districts: (tracker, name) => tracker.track('visit', { level: name === 'Beach' ? 'Beach' : name + ': Somewhere' }),
    weather: (tracker, weather) => tracker.checkWorld({ days: 1, weatherLog: [{ day: 1, weather }] })
};

// Unlocked by run conditions rather than a stat or collection.
const CONDITION_ONLY = ['gamer', 'like-minecraft', 'absolute-gamer', 'untouchable', 'bible-reference'];

test('46 achievements: the original 7 plus 39 new ones, each with a unique id', () => {
    assert.equal(api.DEFINITIONS.length, 46);
    assert.equal(new Set(api.DEFINITIONS.map(def => def.id)).size, 46);
    assert.equal(byId('foreclosed'), undefined, 'losing is not an achievement');
    for (const title of ['Corn Addict', 'Gamer', 'Hello World', 'Bible Reference', "It's Like Minecraft", 'Nice', 'Absolute Gamer']) {
        assert.ok(api.DEFINITIONS.some(def => def.title === title), title);
    }
});

test('every achievement has a category, an existing icon and a way to unlock', () => {
    for (const def of api.DEFINITIONS) {
        assert.ok(api.CATEGORIES.includes(def.category), `${def.id} category`);
        assert.ok(def.title && def.description, `${def.id} text`);
        assert.ok(fs.existsSync(publicPath(def.icon)), `${def.id} icon ${def.icon}`);
        const ways = [!!def.stat, !!def.collection, CONDITION_ONLY.includes(def.id)].filter(Boolean).length;
        assert.equal(ways, 1, `${def.id} needs exactly one unlock rule`);
        if (def.stat) assert.ok(Number.isInteger(def.goal) && def.goal >= 1, `${def.id} goal`);
        if (def.collection) assert.ok(api.COLLECTIONS[def.collection], `${def.id} collection`);
    }
});

test('each stat achievement unlocks exactly at its goal through real events', () => {
    for (const def of api.DEFINITIONS.filter(entry => entry.stat)) {
        const produce = producerFor(def.stat);
        assert.ok(produce, `no event raises the stat ${def.stat} (${def.id})`);
        const { tracker } = makeTracker();
        produce(tracker, def.goal - 1);
        assert.equal(tracker.isUnlocked(def.id), false, `${def.id} unlocked early`);
        produce(tracker, 1);
        assert.equal(tracker.isUnlocked(def.id), true, `${def.id} did not unlock at ${def.goal}`);
    }
});

test('each collection achievement unlocks when the last entry is found', () => {
    for (const def of api.DEFINITIONS.filter(entry => entry.collection)) {
        const entries = api.COLLECTIONS[def.collection];
        const { tracker } = makeTracker();
        entries.slice(0, -1).forEach(entry => { COLLECTORS[def.collection](tracker, entry); COLLECTORS[def.collection](tracker, entry); });
        assert.equal(tracker.isUnlocked(def.id), false, `${def.id} unlocked early`);
        assert.deepEqual(progressOf(tracker, def.id), {
            current: entries.length - 1, goal: entries.length, remaining: [entries[entries.length - 1]]
        });
        COLLECTORS[def.collection](tracker, entries[entries.length - 1]);
        assert.equal(tracker.isUnlocked(def.id), true, def.id);
    }
});

test('events ignore things that are not real entries or amounts', () => {
    const { tracker, unlocked } = makeTracker();
    tracker.track('talk', { name: 'Jake' }); // a shop, not an NPC
    tracker.track('talk', { name: 'Deb' }); // defined but never placed in the world
    tracker.track('harvest', { name: 'Corn', amount: 0 });
    tracker.track('harvest', { name: 'Corn', amount: -5 });
    tracker.track('harvest', { name: 'Corn', amount: 'lots' });
    tracker.track('eat', { name: 'Junk' });
    tracker.track('visit', { level: 'Extra y:0 x:1' });
    tracker.track('language', { language: 'en' });
    tracker.track('no-such-event');
    assert.deepEqual(unlocked, []);
    assert.equal(tracker.stat('harvest:Corn'), 0);
    assert.equal(progressOf(tracker, 'hello-world').current, 0);
});

test('harvests count toward totals, the crop, robots and the crop collection', () => {
    const { tracker, unlocked } = makeTracker();
    tracker.track('harvest', { name: 'Corn', amount: 999 });
    tracker.track('harvest', { name: 'Corn', amount: 3, byRobot: true });
    assert.equal(tracker.stat('harvested'), 1002);
    assert.equal(tracker.stat('harvest:Corn'), 1002);
    assert.equal(tracker.stat('robotHarvested'), 3);
    assert.deepEqual(unlocked, ['corn-addict']);
    assert.deepEqual(progressOf(tracker, 'corn-addict'), { current: 1000, goal: 1000 }, 'progress caps at the goal');
});

test('progress is saved and read back, including the first release format', () => {
    const store = memoryStore();
    api.create(store).track('harvest', { name: 'Pumpkin', amount: 40 });
    api.create(store).track('talk', { name: 'Rick' });
    const reloaded = api.create(store);
    assert.equal(reloaded.stat('harvest:Pumpkin'), 40);
    assert.equal(progressOf(reloaded, 'hello-world').current, 1);

    const legacyStore = memoryStore({
        Achievements: { unlocked: { nice: FIXED_DATE }, cornHarvested: 400, npcsTalkedTo: ['Rick', 'Mira'] }
    });
    const legacy = makeTracker(legacyStore).tracker;
    assert.equal(legacy.isUnlocked('nice'), true);
    assert.equal(legacy.stat('harvest:Corn'), 400);
    assert.equal(progressOf(legacy, 'hello-world').current, 2);
    legacy.track('plant'); // saves in the new format
    assert.equal(makeTracker(legacyStore).tracker.isUnlocked('nice'), true, 'first-release unlocks survive the next save');
});

test('a goal raised in an update re-locks achievements that no longer meet it', () => {
    const saved = stats => memoryStore({ Achievements: { unlocked: { 'green-thumb': FIXED_DATE, 'roll-credits': FIXED_DATE }, stats } });
    const early = makeTracker(saved({ planted: 1, creditsViewed: 1 })).tracker;
    assert.equal(early.isUnlocked('green-thumb'), false);
    assert.equal(early.isUnlocked('roll-credits'), true);
    assert.equal(early.stat('planted'), 1, 'progress is kept');
    assert.equal(makeTracker(saved({ planted: 10000, creditsViewed: 1 })).tracker.isUnlocked('green-thumb'), true);
});

test('damaged stored data is cleaned up and a failing store does not break play', () => {
    const { tracker } = makeTracker(memoryStore({
        Achievements: {
            unlocked: { nice: '2026-01-01T00:00:00.000Z', retired: FIXED_DATE, gamer: 5 },
            stats: { tilled: 'lots', planted: 4, deaths: -2, highestDay: 70 },
            collections: { npcs: ['Rick', 'Rick', 'Nobody'], crops: 'Corn' }
        }
    }));
    assert.equal(tracker.unlockedCount(), 1);
    assert.equal(tracker.stat('tilled'), 0);
    assert.equal(tracker.stat('planted'), 4);
    assert.equal(tracker.stat('deaths'), 0);
    assert.equal(progressOf(tracker, 'hello-world').current, 1);
    assert.equal(progressOf(tracker, 'crop-rotation').current, 0);

    assert.equal(makeTracker(memoryStore({ Achievements: 'garbage' })).tracker.unlockedCount(), 0);
    const broken = { get() { throw new Error('storage blocked'); }, set() { throw new Error('storage full'); } };
    const { tracker: offline, unlocked } = makeTracker(broken);
    offline.track('credits');
    assert.deepEqual(unlocked, ['roll-credits'], 'a failed save still unlocks for this session');
});

test('world checks: best day, weather seen and frog rain twice in one world', () => {
    const { tracker, unlocked } = makeTracker();
    const weatherLog = [{ day: 3, weather: 'frog-rain' }, { day: 3, weather: 'frog-rain' }, { day: 4, weather: 'rain' }];
    tracker.checkWorld({ days: 68, weatherLog });
    assert.deepEqual(unlocked, []);
    tracker.checkWorld({ days: 12, weatherLog }); // a younger world doesn't lower the best day
    assert.equal(tracker.stat('highestDay'), 68);
    weatherLog.push({ day: 9, weather: 'frog-rain' });
    tracker.checkWorld({ days: 100, weatherLog, weather: 'fog' });
    assert.deepEqual(unlocked, ['nice', 'century-farmer', 'bible-reference']);
    assert.equal(progressOf(tracker, 'storm-chaser').current, 3);
    assert.equal(api.frogRainDays(null), 0);
});

test('beating the game checks difficulty, 3D mode, speed and deaths', () => {
    const misc = readPublic('miscfunctions.js');
    const presets = extractArray(misc, misc.indexOf('const BUILT_IN_RULE_PRESETS')).value;
    const hardcore = presets.find(preset => preset.id === 'hardcore').rules;
    const sandbox = presets.find(preset => preset.id === 'sandbox').rules;
    const won = ['saved-the-meadows'];

    const cases = [
        [{ difficulty: 0, days: 50, is3D: false, deaths: 2 }, won],
        [{ difficulty: 2, days: 50, deaths: 2 }, [...won, 'gamer']],
        [{ difficulty: 3, rules: hardcore, days: 50, deaths: 2 }, [...won, 'gamer']],
        [{ difficulty: 3, rules: { ...hardcore, permaDeath: false }, days: 50, deaths: 2 }, won],
        [{ difficulty: 3, rules: sandbox, days: 50, deaths: 2 }, won],
        [{ difficulty: 0, days: 50, is3D: true, deaths: 2 }, [...won, 'like-minecraft']],
        [{ difficulty: 0, days: 19, deaths: 2 }, [...won, 'absolute-gamer']],
        [{ difficulty: 0, days: 20, deaths: 2 }, won],
        [{ difficulty: 0, days: 50, deaths: 0 }, [...won, 'untouchable']],
        [{ difficulty: 0, days: 50 }, won], // an old save with no death count
        [{ difficulty: 2, days: 5, is3D: true, deaths: 0 }, [...won, 'gamer', 'like-minecraft', 'absolute-gamer', 'untouchable']]
    ];
    for (const [run, expected] of cases) {
        const { tracker, unlocked } = makeTracker();
        tracker.recordGameBeaten(run);
        assert.deepEqual(unlocked, expected, JSON.stringify(run));
    }
});

test('collections match the game data', () => {
    const tiles = loadDefinition('config/tiles.js', 'TILE_DEFINITIONS', { kiahTileNum: 122 });
    const items = loadDefinition('config/items.js', 'ITEM_DEFINITIONS');
    const sorted = list => [...list].sort();

    const crops = items.filter(item => item && item.class === 'Seed')
        .map(seed => items[tiles[seed.plant_num - 1].eat_num])
        .filter(Boolean).map(item => item.name);
    assert.deepEqual(sorted(api.COLLECTIONS.crops), sorted(new Set(crops)));

    const foods = items.filter(item => item && item.class === 'Eat').map(item => item.name);
    assert.deepEqual(sorted(api.COLLECTIONS.foods), sorted(foods));
    // Balanced Diet must be possible: every food is grown or sold somewhere.
    const sold = new Set(tiles.filter(tile => tile.class === 'Shop').flatMap(tile => tile.inv || [])
        .filter(entry => entry && entry.num).map(entry => items[entry.num].name));
    for (const food of foods) assert.ok(crops.includes(food) || sold.has(food), `${food} cannot be obtained`);

    const preload = readPublic('preload.js');
    const levelNames = [...preload.matchAll(/new Level\(\s*(['"])([^'"]+)\1\s*,/g)].map(match => match[2]);
    assert.deepEqual(sorted(api.COLLECTIONS.districts), sorted(new Set(levelNames.map(api.districtOf))));

    const weatherSource = readPublic('classes/weather-system.js');
    const weights = vm.runInNewContext('(' + weatherSource.match(/DEFAULT_WEIGHTS\s*=\s*(\{[^}]*\})/)[1] + ')');
    assert.deepEqual(sorted(api.COLLECTIONS.weather), sorted(Object.keys(weights)));
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

test('game code only reports event types the tracker handles, and every type is reported', () => {
    const source = readPublic('classes/achievements.js');
    const handled = new Set([...source.slice(source.indexOf('function track(')).matchAll(/case '([^']+)':/g)].map(match => match[1]));
    // Types the module itself reports from browser events.
    const fromEvents = new Set([...source.matchAll(/trackAchievement\('([^']+)'/g)].map(match => match[1]));

    const reported = new Set();
    const publicDir = publicPath('.');
    for (const file of fs.readdirSync(publicDir, { recursive: true })) {
        if (!file.endsWith('.js') || file.includes('libraries') || file.endsWith('achievements.js')) continue;
        for (const match of fs.readFileSync(path.join(publicDir, file), 'utf8').matchAll(/trackAchievement\(\s*'([^']+)'/g)) {
            assert.ok(handled.has(match[1]), `${file} reports unknown type '${match[1]}'`);
            reported.add(match[1]);
        }
    }
    for (const type of handled) {
        assert.ok(reported.has(type) || fromEvents.has(type), `nothing reports '${type}'`);
    }
});

test('achievements are stored with the settings every world shares', () => {
    const saves = readPublic('classes/world-saves.js');
    const shared = saves.match(/SHARED_KEYS\s*=\s*new Set\(\[([^\]]*)\]\)/);
    assert.ok(shared, 'SHARED_KEYS not found');
    assert.match(shared[1], /'Achievements'/);
});

test('game events and hook calls feed the tracker', () => {
    const store = memoryStore();
    const { context, fire } = loadAchievements({
        localData: store,
        all_items: [0, { name: 'Corn' }, { name: 'Tomato' }],
        days: 12, dificulty: 2, is3DMode: true, weatherLog: [], currentWeather: 'clear',
        player: { deaths: 0 }
    });
    const saved = () => store.get('Achievements') || { unlocked: {}, stats: {}, collections: {} };

    context.trackAchievement('harvest', { itemNum: 1, amount: 600, level: 'Cloudy Meadows: Home', byPlayer: true });
    context.trackAchievement('harvest', { itemNum: 1, amount: 5000, level: 'Auto Farms: 2', byPlayer: false });
    context.trackAchievement('harvest', { itemNum: 0, amount: 5, level: 'Cloudy Meadows: Home', byPlayer: true });
    assert.equal(saved().stats['harvest:Corn'], 600);
    context.trackAchievement('harvest', { itemNum: 1, amount: 400, level: 'Cloudy Meadows: Home', byPlayer: false });
    assert.ok(saved().unlocked['corn-addict']);
    assert.equal(saved().stats.robotHarvested, 400);

    fire('npcInteraction', { npcName: 'Dog' });
    assert.ok(saved().unlocked['good-boy']);
    fire('moneyGained', { amount: 300, totalCoins: 26000 });
    assert.ok(saved().unlocked['dragon-hoard']);
    fire('locationVisited', { locationName: 'The Big City : Downtown' });
    assert.deepEqual(saved().collections.districts, ['The Big City']);
    fire('languageChanged', { language: 'fr' });
    assert.ok(saved().unlocked.polyglot);

    fire('questCompleted', { quest: { og_name: 'Talk to some people' } });
    assert.equal(saved().stats.sideQuests, 1);
    fire('questCompleted', { quest: { og_name: 'Save Cloudy Meadows' } });
    for (const id of ['saved-the-meadows', 'gamer', 'like-minecraft', 'absolute-gamer', 'untouchable']) {
        assert.ok(saved().unlocked[id], id);
    }

    context.days = 69;
    context.weatherLog = [{ day: 2, weather: 'frog-rain' }, { day: 40, weather: 'frog-rain' }];
    fire('newDay', { day: 69 });
    assert.ok(saved().unlocked.nice);
    assert.ok(saved().unlocked['bible-reference']);
    assert.deepEqual(saved().collections.weather, ['clear', 'frog-rain']);
});
