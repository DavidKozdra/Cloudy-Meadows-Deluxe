'use strict';

// Heatwave: a rare weather event that lasts 2-3 days, slows crops that have no
// sprinkler in range, and makes sprinklers cost more.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const { installBaseGlobals, resetWorld } = require('./support/mocks');
const { loadClasses, readPublic } = require('./support/load');

installBaseGlobals();
global.new_tile_from_num = (num, x, y) => ({ name: `tile_${num}`, pos: { x, y }, render() {}, load() {} });
loadClasses(['classes/tile_classes/tile.js', 'classes/tile_classes/plant.js'], ['Tile', 'Plant']);

// --- weather-system.js in an isolated window -------------------------------

function makeWeather(overrides = {}) {
    const calls = [];
    const record = name => (...args) => calls.push({ name, args });
    const window = {
        canvasWidth: 800, canvasHeight: 600, time: 100, paused: false, CORNER: 'corner',
        days: 10, weatherLog: [],
        push: record('push'), pop: record('pop'), rectMode: record('rectMode'),
        noStroke: record('noStroke'), fill: record('fill'), rect: record('rect'),
        stroke: record('stroke'), strokeWeight: record('strokeWeight'), line: record('line'),
        ...overrides
    };
    vm.runInNewContext(readPublic('classes/weather-system.js'), { window, Math });
    return { weather: window.CloudyWeather, window, calls };
}

// Default weights put heatwave in the cumulative band (50.1, 51.6] of 100.
const HEATWAVE_ROLL = 0.51;
const CLEAR_ROLL = 0.9;

test('a heatwave roll starts a 2-3 day heatwave span', () => {
    const lengths = new Set();
    for (const r of [0.5101, 0.5102, 0.5103, 0.5104, 0.5105, 0.511]) {
        const { weather, window } = makeWeather();
        assert.equal(weather.roll(r), 'heatwave');
        assert.equal(window.currentWeather, 'heatwave');
        assert.equal(window.heatwaveStartDay, 10);
        const length = window.heatwaveEndDay - window.heatwaveStartDay + 1;
        assert.ok(length === 2 || length === 3, `length ${length} should be 2 or 3`);
        lengths.add(length);
    }
    assert.deepEqual([...lengths].sort(), [2, 3], 'both durations occur');
});

test('the heatwave continues every day of its span regardless of the roll, then ends', () => {
    const { weather, window } = makeWeather();
    weather.roll(HEATWAVE_ROLL);
    const end = window.heatwaveEndDay;
    for (let day = 11; day <= end; day++) {
        window.days = day;
        assert.equal(weather.roll(CLEAR_ROLL), 'heatwave', `day ${day} is still a heatwave`);
    }
    window.days = end + 1;
    assert.equal(weather.roll(CLEAR_ROLL), 'clear', 'normal weather resumes after the span');
    assert.deepEqual(window.weatherLog.map(e => e.weather).slice(-1), ['clear']);
});

test('re-rolling the same day (config save) neither extends nor restarts the heatwave', () => {
    const { weather, window } = makeWeather();
    weather.roll(HEATWAVE_ROLL);
    const span = [window.heatwaveStartDay, window.heatwaveEndDay];
    weather.roll(CLEAR_ROLL);
    weather.roll(HEATWAVE_ROLL);
    assert.deepEqual([window.heatwaveStartDay, window.heatwaveEndDay], span);
});

test('a heatwave span in the future (after a Time Watch rewind) does not start early', () => {
    const { weather, window } = makeWeather({ heatwaveStartDay: 20, heatwaveEndDay: 22 });
    assert.equal(weather.roll(CLEAR_ROLL), 'clear');
});

test('setting the heatwave weight to 0 cancels an ongoing heatwave', () => {
    const { weather, window } = makeWeather();
    weather.roll(HEATWAVE_ROLL);
    window.customRules = { weatherWeights: { heatwave: 0, clear: 100 } };
    window.days = 11;
    assert.equal(weather.roll(CLEAR_ROLL), 'clear');
});

test('custom weather configs saved before heatwaves existed still get the default heatwave weight', () => {
    // Old configs list every other type explicitly; heatwave is missing.
    const oldConfig = { 'partly-cloudy': 0, overcast: 0, fog: 0, sunshower: 0, rain: 0, thunderstorm: 0, 'frog-rain': 0, clear: 0 };
    const { weather } = makeWeather({ customRules: { weatherWeights: oldConfig } });
    assert.equal(weather.roll(0.5), 'heatwave', 'heatwave is the only weather with weight');
});

test('heatwave rendering draws an orange tint and rising shimmer lines', () => {
    const { weather, calls } = makeWeather({ currentWeather: 'heatwave' });
    weather.render();
    const tint = calls.find(c => c.name === 'fill');
    assert.deepEqual(tint.args.slice(0, 3), [255, 140, 40], 'warm orange overlay');
    assert.ok(calls.filter(c => c.name === 'line').length > 50, 'shimmer bands are drawn');
});

// --- crops ------------------------------------------------------------------

function growOnce(weather, withSprinkler) {
    const plant = new Plant('corn', 20, tileSize, tileSize, false, 2, 0, 100);
    const map = Array.from({ length: 3 }, (_, r) => Array.from({ length: 3 }, (_, c) => ({
        name: 'grass', pos: { x: c * tileSize, y: r * tileSize }, render() {}
    })));
    map[1][1] = plant;
    if (withSprinkler) map[0][0] = { name: 'sprinkler', render() {} };
    global.levels = [[{ map, ladybugs: 0 }]];
    global.currentWeather = weather;
    plant.grow(0, 0);
    return plant.growTimer;
}

beforeEach(() => resetWorld());

test('a heatwave halves growth for crops with no sprinkler in range', () => {
    assert.equal(growOnce('clear', false), 1);
    assert.equal(growOnce('heatwave', false), 0.5);
});

test('a sprinkler shields crops from the heatwave slowdown', () => {
    assert.equal(growOnce('heatwave', true), growOnce('clear', true));
});

// --- shop prices ------------------------------------------------------------

function makeShop(globals) {
    const sandbox = {
        random: (lo) => lo, round: Math.round, max: Math.max,
        days: 10, dayOfWeek: 0, lastRainDay: -999, lastFrogRainDay: -999, currentWeather: 'clear',
        ...globals
    };
    vm.runInNewContext(`class Entity {}\n${readPublic('classes/tile_classes/shop.js')}\nthis.Shop = Shop;`, sandbox);
    const shop = Object.create(sandbox.Shop.prototype);
    shop.inv = [{ name: 'Sprinkler', price: 20, amount: 10 }, { name: 'Seeds', price: 20, amount: 10 }];
    shop.originalPrices = [20, 20];
    return { shop, sandbox };
}

test('sprinklers cost 50% more during a heatwave, other items do not', () => {
    const { shop } = makeShop({ currentWeather: 'heatwave' });
    shop.recalculatePrices();
    // stock 10 -> supply adjustment random(-1, 1) -> -1 with the stubbed random
    assert.equal(shop.inv[0].price, Math.round(19 * 1.5));
    assert.equal(shop.inv[1].price, 19);
});

test('the heatwave sprinkler price survives the per-purchase reprice', () => {
    const { shop } = makeShop({ currentWeather: 'heatwave' });
    shop.recalculateItemPrice('Sprinkler');
    assert.equal(shop.inv[0].price, Math.round(19 * 1.5));
});

test('the post-rain sprinkler discount also survives the per-purchase reprice', () => {
    const { shop } = makeShop({ lastRainDay: 9 });
    shop.recalculateItemPrice('Sprinkler');
    assert.equal(shop.inv[0].price, Math.round(19 * 0.5));
});

// --- persistence --------------------------------------------------------------

test('Time Watch rewind restores the heatwave span', () => {
    const store = new Map();
    const s = {
        levels: [], loadLevel() {}, console,
        localData: { get: k => store.get(k), set: (k, v) => store.set(k, v), remove: k => store.delete(k) },
        currentWeather: 'heatwave', lastRainDay: -999, lastFrogRainDay: -999,
        heatwaveStartDay: 10, heatwaveEndDay: 12
    };
    vm.runInNewContext(readPublic('classes/time-rewind.js'), s);
    s.captureDaySnapshot(10);
    s.heatwaveStartDay = 30;
    s.heatwaveEndDay = 31;
    assert.equal(s.restoreDaySnapshot(10), true);
    assert.equal(s.heatwaveStartDay, 10);
    assert.equal(s.heatwaveEndDay, 12);
});

test('the save, load and new-game paths carry the heatwave span', () => {
    const misc = readPublic('miscfunctions.js');
    assert.match(misc, /heatwaveStartDay: heatwaveStartDay,\s*heatwaveEndDay: heatwaveEndDay/, 'saved with the day state');
    assert.match(misc, /heatwaveStartDay = typeof savedDayState\.heatwaveStartDay === 'number'/, 'loaded from the day state');
    assert.equal((misc.match(/heatwaveStartDay = -999;/g) || []).length, 2, 'reset by both new-game paths');
    assert.match(misc, /'cfg-weather-heatwave'/, 'has a custom-difficulty slider');
});
