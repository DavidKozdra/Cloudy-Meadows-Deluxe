'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readPublic } = require('./support/load');

const clone = value => JSON.parse(JSON.stringify(value));
const misc = readPublic('miscfunctions.js');
const sketch = readPublic('sketch.js');
const clockStart = sketch.indexOf('if (millis() - lastTimeMili >');
const clockEnd = sketch.indexOf('lastTimeMili = millis();', clockStart);
assert.ok(clockStart !== -1 && clockEnd > clockStart, 'Could not isolate the day clock');
const clock = new vm.Script(sketch.slice(clockStart, sketch.indexOf('}', clockEnd) + 1));
const weatherGenerator = sketch.slice(sketch.indexOf('function generateDailyWeather()'), sketch.indexOf('function getDayNightOpacity('));
// Isolate the actual save/load and new-game paths from the browser UI setup.
const persistenceSource = [
    misc.slice(misc.indexOf('function saveAll(){'), misc.indexOf('function removeTemporaryRainFrogsFromLevels(){')),
    misc.slice(misc.indexOf('function loadAll(){'), misc.indexOf('function loadLevel(')),
    misc.slice(misc.indexOf('function selectDifficulty('), misc.indexOf('\nlet controlsContainer'))
].join('\n');

function makeGame(savedDayState) {
    const store = new Map();
    const writes = [];
    let now = 0;
    const state = {
        days: 0, dayOfWeek: 0, time: 0, timephase: 0, dificulty: 0, extraCount: 0,
        timeSpeed: 1, lastTimeMili: 0, millis: () => now,
        currentLevel_x: 0, currentLevel_y: 0, levels: [], currentWeather: 'clear', weatherLog: [],
        lastRainDay: -999, lastFrogRainDay: -999, heatwaveStartDay: -999, heatwaveEndDay: -999,
        player: { talking: 0, quests: [], save() {} },
        level10: { map: Array.from({ length: 10 }, () => Array(6).fill({ name: 'grass' })) },
        newDayChime: { play() {} },
        dispatchEvent() {},
        CustomEvent: class {
            constructor(type, options) { Object.assign(this, { type }, options); }
        },
        document: { getElementById: () => null },
        console: { log() {}, warn() {} },
        Math: Object.assign(Object.create(Math), { random: () => 0.9 }),
        localData: {
            get: key => store.has(key) ? clone(store.get(key)) : null,
            set(key, value) { writes.push(key); store.set(key, clone(value)); },
            remove: key => store.delete(key)
        },
        getTutorialStateForSave: () => ({}),
        hasCompletedMainQuest: () => false
    };
    for (const name of [
        'removeTemporaryRainFrogsFromLevels', 'loadTutorialState', 'applyStartingInventory',
        'applyAccessibilityPrefs', 'ensureKiahInLegacyDowntownSave', 'ensureDowntownMarketVariety',
        'ensureNPCWalkingPaths', 'ensureCooperativeExchangeBoard', 'applyNPCFilterRules',
        'applyCritterFilterRules', 'applyAreaRules', 'applyItemPrices', 'removeDisabledItemsFromInventory',
        'resetTutorialStateForNewGame', 'hideDifficultyMenu', 'scheduleContextualTutorials', 'loadLevel'
    ]) state[name] = () => {};
    state.window = state;
    vm.createContext(state);
    vm.runInContext(readPublic('classes/weather-system.js'), state);
    vm.runInContext(readPublic('classes/time-rewind.js'), state);
    vm.runInContext(persistenceSource, state);
    vm.runInContext(weatherGenerator, state);
    if (savedDayState) {
        store.set('Day_curLvl_Dif', clone(savedDayState));
        state.loadAll();
    }
    return {
        state, store, writes, weather: state.CloudyWeather,
        tick() {
            now += 301;
            clock.runInContext(state);
        }
    };
}

test('day rollover autosaves weather and replay through the clock survives a reload', () => {
    const { state, store, writes, tick } = makeGame();
    state.player.touching = { name: 'grass' };
    state.Math.random = () => 0.05;
    state.generateDailyWeather(); // Day 0: rain.
    state.captureDaySnapshot(0);

    // Cross real forward day boundaries, which generate weather and autosave.
    state.timeSpeed = 16;
    for (const roll of [0.0005, 0.510101]) {
        state.time = 199;
        state.timephase = 0;
        state.Math.random = () => roll;
        tick();
        const saved = store.get('Day_curLvl_Dif');
        assert.equal(saved.days, state.days);
        assert.equal(saved.currentWeather, state.currentWeather);
        assert.equal(saved.weatherLog.length, state.days + 1);
    }
    const originalSave = clone(store.get('Day_curLvl_Dif'));
    assert.deepEqual(originalSave.weatherLog.map(({ day, weather }) => ({ day, weather })), [
        { day: 0, weather: 'rain' }, { day: 1, weather: 'frog-rain' }, { day: 2, weather: 'heatwave' }
    ]);

    // Existing snapshots and the calendar both participate in this rewind.
    state.Math.random = () => { throw new Error('A recorded day must not reroll'); };
    state.timeSpeed = -16;
    writes.length = 0;
    for (const expected of ['frog-rain', 'rain']) {
        state.time = 0;
        tick();
        assert.equal(state.currentWeather, expected);
    }
    assert.equal(state.days, 0);
    assert.deepEqual(writes, [], 'backward clock crossings must not autosave');
    assert.deepEqual(store.get('Day_curLvl_Dif'), originalSave, 'the saved future remains intact');

    state.timeSpeed = 16;
    for (const expected of ['frog-rain', 'heatwave']) {
        state.time = 199;
        state.timephase = 0;
        tick();
        assert.equal(state.currentWeather, expected);
        assert.deepEqual(store.get('Day_curLvl_Dif').weatherLog, originalSave.weatherLog);
    }

    const loaded = makeGame(store.get('Day_curLvl_Dif'));
    loaded.state.player.touching = { name: 'grass' };
    loaded.state.Math.random = () => { throw new Error('Reloaded history must not reroll'); };
    assert.equal(loaded.state.hasDaySnapshot(1), false, 'only the loaded day has a world snapshot');
    loaded.state.time = 0;
    loaded.state.timeSpeed = -16;
    loaded.tick();
    assert.equal(loaded.state.days, 1);
    assert.equal(loaded.state.currentWeather, 'frog-rain');
    assert.deepEqual(loaded.writes, [], 'reloading then rewinding must not save either');

    loaded.state.time = 199;
    loaded.state.timephase = 0;
    loaded.state.timeSpeed = 16;
    loaded.tick();
    assert.equal(loaded.state.currentWeather, 'heatwave');
    assert.equal(loaded.state.heatwaveStartDay, 2);
    assert.equal(loaded.state.heatwaveEndDay, 4);
    assert.deepEqual(loaded.store.get('Day_curLvl_Dif').weatherLog, originalSave.weatherLog);
});

test('each day keeps its first weather roll, with no duplicate entries or random rerolls', () => {
    const { state, weather } = makeGame();
    const rolls = [0.0005, 0.01, 0.05, 0.15, 0.25, 0.4, 0.48, 0.51, 0.9];
    const types = ['frog-rain', 'thunderstorm', 'rain', 'sunshower', 'overcast', 'partly-cloudy', 'fog', 'heatwave', 'clear'];
    for (let i = 0; i < rolls.length; i++) {
        state.days = i * 4; // Leave room for heatwaves between sampled days.
        assert.equal(weather.roll(rolls[i]), types[i]);
    }
    const history = clone(state.weatherLog);
    state.Math.random = () => { throw new Error('Recorded weather must not roll again'); };
    for (const entry of history.slice().reverse()) {
        state.days = entry.day;
        assert.equal(weather.roll(), entry.weather);
        assert.equal(state.lastRainDay, entry.lastRainDay);
        assert.equal(state.lastFrogRainDay, entry.lastFrogRainDay);
    }
    assert.deepEqual(clone(state.weatherLog), history);
});

test('weather and its future records survive saving and loading while rewound', () => {
    const { state, weather, store, writes } = makeGame();
    weather.roll(0.05); // Day 0: rain.
    state.days = 1;
    weather.roll(0.0005); // Day 1: frog rain.
    state.days = 2;
    weather.roll(0.9); // Day 2: clear.
    const history = clone(state.weatherLog);
    state.days = 0;
    assert.equal(weather.restoreDay(0), true);
    assert.deepEqual(writes, [], 'reading weather does not save the game');
    state.saveAll();

    const loaded = makeGame(store.get('Day_curLvl_Dif'));
    assert.deepEqual(clone(loaded.state.weatherLog), history);
    assert.equal(loaded.state.currentWeather, 'rain');
    assert.equal(loaded.state.lastRainDay, 0);
    assert.equal(loaded.state.lastFrogRainDay, -999, 'future frog rain has not happened yet');
    loaded.state.days = 1;
    assert.equal(loaded.weather.roll(0.9), 'frog-rain');
    assert.equal(loaded.state.lastFrogRainDay, 1);
    loaded.state.days = 2;
    assert.equal(loaded.weather.roll(0.05), 'clear');
    assert.equal(loaded.state.weatherLog.length, 3);
});

test('replaying a heatwave restores its original span, including unvisited remaining days', () => {
    const { state, weather, store } = makeGame();
    state.days = 9;
    weather.roll(0.9);
    state.days = 10;
    weather.roll(0.510101); // Three-day heatwave.
    assert.equal(state.heatwaveEndDay, 12);
    state.days = 9;
    weather.restoreDay(9);
    state.saveAll();

    const loaded = makeGame(store.get('Day_curLvl_Dif'));
    loaded.state.days = 10;
    assert.equal(loaded.weather.roll(0.9), 'heatwave');
    assert.equal(loaded.state.heatwaveStartDay, 10);
    assert.equal(loaded.state.heatwaveEndDay, 12);
    for (const day of [11, 12, 13]) {
        loaded.state.days = day;
        assert.equal(loaded.weather.roll(0.9), day <= 12 ? 'heatwave' : 'clear');
    }
});

test('loading an older save preserves its known weather without inventing past days', () => {
    const { state, weather } = makeGame({
        days: 20, currentWeather: 'heatwave', lastRainDay: 18, lastFrogRainDay: 12,
        heatwaveStartDay: 19, heatwaveEndDay: 21
    });
    assert.equal(weather.roll(0.9), 'heatwave');
    assert.equal(state.weatherLog.length, 1);
    assert.equal(state.weatherLog[0].day, 20);
    assert.equal(state.lastRainDay, 18);
    assert.equal(state.lastFrogRainDay, 12);
    assert.equal(state.heatwaveEndDay, 21);
    assert.equal(weather.restoreDay(19), false);
});

for (const custom of [false, true]) {
    test(`starting a ${custom ? 'custom' : 'normal'} game resets and saves its weather calendar`, () => {
        const { state, weather, store } = makeGame();
        weather.roll(0.05);
        state.days = 10;
        weather.roll(0.0005);
        state.levels = [[{}]];
        if (custom) state.selectCustomDifficulty([{ enabled: true }, { enabled: true }, { enabled: false }]);
        else state.selectDifficulty(1);
        assert.equal(state.currentWeather, 'clear', 'new day zero uses a fresh roll');
        assert.deepEqual(clone(state.weatherLog).map(({ day, weather }) => ({ day, weather })), [{ day: 0, weather: 'clear' }]);
        assert.deepEqual(store.get('Day_curLvl_Dif').weatherLog, clone(state.weatherLog));
    });
}

test('changed weather weights only affect days that have not been recorded', () => {
    const { state, weather } = makeGame();
    weather.roll(0.05);
    state.customRules = { weatherWeights: { rain: 0, clear: 100 } };
    assert.equal(weather.roll(0.9), 'rain');
    state.days = 1;
    assert.equal(weather.roll(0.9), 'clear');
});

test('weather history remains available after old world snapshots expire', () => {
    const { state, weather, writes } = makeGame();
    for (let day = 0; day < 15; day++) {
        state.days = day;
        weather.roll(day === 0 ? 0.05 : 0.9);
        state.captureDaySnapshot(day);
    }
    assert.equal(state.hasDaySnapshot(0), false);
    assert.equal(weather.restoreDay(0), true);
    assert.equal(state.currentWeather, 'rain');
    assert.equal(state.weatherLog.length, 15);
    assert.deepEqual(writes, []);
});

test('loading history skips invalid records and keeps the first record for each day', () => {
    const { state, weather } = makeGame();
    weather.loadHistory([
        null, { day: -1, weather: 'rain' }, { day: 0.5, weather: 'fog' },
        { day: 2, weather: 'unknown' }, { day: 0, weather: 'rain', lastRainDay: 0 },
        { day: 0, weather: 'clear' }
    ]);
    assert.equal(state.weatherLog.length, 1);
    assert.equal(weather.roll(0.9), 'rain');
    assert.equal(state.lastRainDay, 0);
});

test('requesting an unrecorded day leaves weather, history and storage untouched', () => {
    const { state, weather, store, writes } = makeGame();
    state.days = 10;
    weather.roll(0.510101);
    state.saveAll();
    const saved = clone(store.get('Day_curLvl_Dif'));
    writes.length = 0;

    for (const missingDay of [0, 9, 11, 100]) {
        assert.equal(weather.restoreDay(missingDay), false);
        assert.equal(state.days, 10);
        assert.equal(state.currentWeather, saved.currentWeather);
        assert.equal(state.lastRainDay, saved.lastRainDay);
        assert.equal(state.lastFrogRainDay, saved.lastFrogRainDay);
        assert.equal(state.heatwaveStartDay, saved.heatwaveStartDay);
        assert.equal(state.heatwaveEndDay, saved.heatwaveEndDay);
        assert.deepEqual(clone(state.weatherLog), saved.weatherLog);
        assert.deepEqual(store.get('Day_curLvl_Dif'), saved);
    }
    assert.deepEqual(writes, []);
});

test('loading another world replaces the previous world weather calendar', () => {
    const other = makeGame();
    other.weather.roll(0.01); // Other world, day 0: thunderstorm.
    other.state.saveAll();
    const otherSave = clone(other.store.get('Day_curLvl_Dif'));

    const { state, weather, store } = makeGame();
    weather.roll(0.05); // Original world, day 0: rain.
    state.days = 1;
    weather.roll(0.0005); // Original world, day 1: frog rain.
    store.set('Day_curLvl_Dif', otherSave);
    state.loadAll();
    assert.equal(state.days, 0);
    assert.equal(state.currentWeather, 'thunderstorm');
    assert.deepEqual(clone(state.weatherLog), otherSave.weatherLog);
    state.days = 1;
    assert.equal(weather.roll(0.9), 'clear', 'day 1 must not inherit the previous world frog rain');
});

test('loading with no saved world clears any existing weather calendar', () => {
    const { state, weather, writes } = makeGame();
    weather.roll(0.05);
    state.days = 1;
    weather.roll(0.0005);
    state.loadAll();
    assert.deepEqual(clone(state.weatherLog), []);
    assert.equal(weather.restoreDay(0), false);
    assert.deepEqual(writes, []);
});

test('a missing current-day entry is seeded from the save without losing recorded future days', () => {
    const { state, weather } = makeGame({
        days: 3, currentWeather: 'rain', lastRainDay: 3, lastFrogRainDay: 1,
        heatwaveStartDay: -999, heatwaveEndDay: -999,
        weatherLog: [{ day: 5, weather: 'fog', lastRainDay: 3, lastFrogRainDay: 1, heatwaveStartDay: -999, heatwaveEndDay: -999 }]
    });
    assert.equal(weather.roll(0.9), 'rain');
    assert.equal(state.lastRainDay, 3);
    assert.equal(state.lastFrogRainDay, 1);
    assert.equal(state.weatherLog.length, 2);
    state.days = 5;
    assert.equal(weather.roll(0.05), 'fog');
    assert.equal(state.weatherLog.length, 2, 'revisiting must not duplicate either record');
});

test('malformed saved calendars fall back to the saved day instead of rerolling', () => {
    for (const weatherLog of [null, 'invalid', { day: 8, weather: 'fog' }, 42]) {
        const { state, weather, writes } = makeGame({
            days: 8, currentWeather: 'frog-rain', lastRainDay: 6, lastFrogRainDay: 8,
            heatwaveStartDay: -999, heatwaveEndDay: -999, weatherLog
        });
        state.Math.random = () => { throw new Error('Saved weather must not reroll'); };
        assert.equal(weather.roll(), 'frog-rain');
        assert.equal(state.weatherLog.length, 1);
        assert.equal(state.weatherLog[0].day, 8);
        assert.equal(state.lastRainDay, 6);
        assert.equal(state.lastFrogRainDay, 8);
        assert.deepEqual(writes, []);
    }
});
