'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readPublic } = require('./support/load');

// Exercise the clock block from draw() without needing p5's rendering loop.
const source = readPublic('sketch.js');
const start = source.indexOf('if (millis() - lastTimeMili >');
const lastTick = source.indexOf('lastTimeMili = millis();', start);
assert.ok(start !== -1 && lastTick > start, 'Could not isolate the day clock');
const clock = new vm.Script(source.slice(start, source.indexOf('}', lastTick) + 1));

function makeClock(overrides = {}, hasSnapshot = true) {
    const effects = [];
    let now = 0;
    const sandbox = {
        days: 5, dayOfWeek: 0, time: 0, timephase: 0, timeSpeed: -2,
        lastTimeMili: 0, lastRainDay: -999, lastFrogRainDay: -999,
        millis: () => now,
        player: {
            touching: { name: 'grass' },
            quests: [{ daily_update: () => effects.push('quest') }]
        },
        levels: [[{
            map: [[{ class: 'Shop', daily_update: () => effects.push('shop') }]],
            daily_update: () => effects.push('level')
        }]],
        level10: { map: Array.from({ length: 10 }, () => Array(6).fill({ name: 'grass' })) },
        hasDaySnapshot: () => hasSnapshot,
        restoreDaySnapshot: day => effects.push(`restore:${day}`),
        captureDaySnapshot: day => effects.push(`capture:${day}`),
        generateDailyWeather: () => effects.push('weather'),
        saveAll: () => effects.push('save'),
        newDayChime: { play: () => effects.push('chime') },
        window: { dispatchEvent: event => effects.push(`${event.type}:${event.detail.day}`) },
        CustomEvent: class {
            constructor(type, options) { Object.assign(this, { type }, options); }
        },
        ...overrides
    };
    const context = vm.createContext(sandbox);
    return {
        state: sandbox,
        effects,
        tick() {
            now += 301;
            clock.runInContext(context);
        }
    };
}

for (const speed of [-2, -4, -8, -16]) {
    for (const hasSnapshot of [true, false]) {
        test(`rewind at ${speed} crosses a day without saving (snapshot: ${hasSnapshot})`, () => {
            const { state, effects, tick } = makeClock({ timeSpeed: speed }, hasSnapshot);
            tick();

            assert.equal(state.days, 4);
            assert.equal(state.dayOfWeek, 4);
            assert.equal(state.time, 200);
            assert.equal(state.timephase, 1);
            assert.deepEqual(effects, hasSnapshot ? ['restore:4'] : []);
            assert.equal(state.lastTimeMili, 301);

            // Keep rewinding into another day without running forward-day effects.
            for (let i = 0; i < Math.floor(200 / -speed) + 1; i++) tick();
            assert.equal(state.days, 3);
            assert.equal(state.dayOfWeek, 3);
            assert.deepEqual(effects, hasSnapshot ? ['restore:4', 'restore:3'] : []);
        });
    }
}

test('rewind stops at day zero without saving or daily updates', () => {
    const { state, effects, tick } = makeClock({ days: 0 });
    tick();
    tick();
    assert.equal(state.days, 0);
    assert.equal(state.time, 0);
    assert.equal(state.timephase, 0);
    assert.deepEqual(effects, []);
});

test('the clock restores recorded weather without a world snapshot or an autosave', () => {
    const { state, effects, tick } = makeClock({ days: 4, currentWeather: 'clear' }, false);
    state.window = state;
    vm.runInNewContext(readPublic('classes/weather-system.js'), state);
    state.CloudyWeather.roll(0.05); // Record rain for day 4.
    state.days = 5;
    state.CloudyWeather.roll(0.0005); // Record frog rain for day 5.

    tick();
    assert.equal(state.days, 4);
    assert.equal(state.currentWeather, 'rain');
    assert.equal(state.lastRainDay, 4);
    assert.equal(state.lastFrogRainDay, -999);
    assert.equal(state.weatherLog.length, 2, 'keep the future weather record');
    assert.deepEqual(effects, [], 'rewinding does not trigger forward-day effects');
});

for (const speed of [1, 2, 4, 8, 16]) {
    test(`forward time at ${speed} still advances and saves once per new day`, () => {
        const { state, effects, tick } = makeClock({ time: 199, timeSpeed: speed });
        tick();
        assert.equal(state.days, 6);
        assert.equal(state.dayOfWeek, 1);
        assert.deepEqual(effects, ['weather', 'quest', 'newDay:6', 'capture:6', 'save', 'chime']);

        effects.length = 0;
        tick();
        assert.equal(state.days, 6);
        assert.deepEqual(effects, []);
    });
}

test('morning updates distant shops once with the correct weather and skips empty areas', () => {
    const { state, tick } = makeClock({ time: 1, timephase: 1, timeSpeed: 1, days: 6, dayOfWeek: 1, lastRainDay: 6 });
    vm.runInNewContext(readPublic('classes/level.js') + '\nthis.TestLevel = Level;', state);
    const calls = [];
    const shop = { class: 'Shop', age: -1, daily_update: (...args) => calls.push(args) };
    const remote = Object.create(state.TestLevel.prototype);
    remote.map = [[shop]];
    state.levels = [[0, undefined, remote]];
    tick();
    assert.deepEqual(calls, [[1, 6, -999]], 'one restock per morning, even in a distant area');
    tick();
    assert.equal(calls.length, 1, 'the next clock tick does not repeat morning updates');
});
