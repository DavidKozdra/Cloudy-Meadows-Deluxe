'use strict';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { installBaseGlobals, resetWorld } = require('./support/mocks');
const { loadClasses } = require('./support/load');

installBaseGlobals();

// Plant.grow() reads levels[y][x].map for neighboring sprinklers and may
// replace itself via new_tile_from_num when it dies. Provide a factory that
// yields identifiable stand-ins so death/mutation transitions are observable.
const DIRT_TILE = 5;   // the "dead crop" replacement id in grow()
global.new_tile_from_num = (num, x, y) => ({
    name: num === DIRT_TILE ? 'dirt' : `tile_${num}`,
    tile_num: num, pos: { x, y }, class: 'Tile', render() {}, load() {}
});

loadClasses([
    'classes/tile_classes/tile.js',
    'classes/tile_classes/plant.js'
], ['Tile', 'Plant']);

// all_imgs[20] has 4 frames -> ripe age is length-2 = 2. png 22 (strawberry)
// is also 4 frames in the mock atlas.
const RIPE_AGE = 2;

// Build a single-level world whose map is a `size`×`size` grass grid, then drop
// `plant` at (row,col). Returns the level so callers can inspect map mutations.
function worldWith(plant, row = 1, col = 1, size = 3) {
    const map = Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => ({
        name: 'grass', pos: { x: c * tileSize, y: r * tileSize }, class: 'Tile', collide: false, render() {}
    })));
    plant.pos.x = col * tileSize;
    plant.pos.y = row * tileSize;
    map[row][col] = plant;
    const level = { map, ladybugs: 0 };
    global.levels = [[level]];
    return level;
}

function makeCorn(growthTime = 10, waterNeeded = 0) {
    return new Plant('corn', 20, tileSize, tileSize, false, 2, waterNeeded, growthTime);
}

beforeEach(() => {
    resetWorld();
    global.currentWeather = 'clear';
});

test('a watered-enough plant ages one step each time its grow timer fills', () => {
    const plant = makeCorn(3, 0); // no water needed -> always watered
    worldWith(plant);
    assert.equal(plant.age, 0);
    for (let tick = 0; tick < 3; tick++) plant.grow(0, 0);
    assert.equal(plant.age, 1, 'reaching growthTime advances age by one');
    assert.equal(plant.growTimer, 0, 'grow timer resets after a growth step');
});

test('grow timer accumulates below the threshold without aging', () => {
    const plant = makeCorn(10, 0);
    worldWith(plant);
    for (let tick = 0; tick < 9; tick++) plant.grow(0, 0);
    assert.equal(plant.age, 0, 'below growthTime the plant does not age');
    assert.equal(plant.growTimer, 9);
});

test('a ripe crop stops aging but survives while it has death attempts left', () => {
    const plant = makeCorn(1, 0);
    worldWith(plant);
    // Ripens by tick 2, then each overcrowded cycle spends one deathAttempt
    // while capping the age. With 3 attempts the plant is still standing —
    // and still capped at the ripe frame — after tick 4.
    for (let tick = 0; tick < 5; tick++) plant.grow(0, 0);
    assert.equal(plant.age, RIPE_AGE, 'age is capped at the ripe frame while attempts remain');
    assert.equal(plant.deathAttempts, 0, 'the overcrowded cycles have spent every death attempt');
    assert.equal(levels[0][0].map[1][1], plant, 'the plant is still standing');
});

test('a crop left ripe too long dies and reverts to dirt', () => {
    const plant = makeCorn(1, 0);
    worldWith(plant);
    // 3 deathAttempts + the transition means enough cycles turn it to dirt.
    for (let tick = 0; tick < 12; tick++) plant.grow(0, 0);
    const here = levels[0][0].map[1][1];
    assert.notEqual(here, plant, 'the overcrowded plant is replaced');
    assert.equal(here.name, 'dirt', 'a dead crop reverts to dirt');
});

test('a thirsty crop with no water source loses death attempts and dies', () => {
    const plant = makeCorn(1, 1); // needs water, none nearby
    worldWith(plant);
    assert.equal(plant.deathAttempts, 3);
    for (let tick = 0; tick < 3; tick++) plant.grow(0, 0);
    assert.equal(plant.age, 0, 'a thirsty crop never advances');
    assert.equal(levels[0][0].map[1][1].name, 'dirt', 'it dies once attempts run out');
});

test('an adjacent sprinkler satisfies a water-needing crop so it grows', () => {
    const plant = makeCorn(2, 1);
    const level = worldWith(plant);
    level.map[1][2] = { name: 'sprinkler', pos: { x: 2 * tileSize, y: tileSize }, class: 'Tile' };
    for (let tick = 0; tick < 2; tick++) plant.grow(0, 0);
    assert.ok(plant.watermet, 'the neighboring sprinkler satisfies the water need');
    assert.equal(plant.age, 1, 'a watered crop advances normally');
});

test('same-day hand watering (wateredDay) counts as water for one crop', () => {
    const plant = makeCorn(2, 1);
    worldWith(plant);
    global.days = 7;
    plant.wateredDay = 7; // watered by hand today
    for (let tick = 0; tick < 2; tick++) plant.grow(0, 0);
    assert.ok(plant.watermet);
    assert.equal(plant.age, 1);
});

test('rain waters every crop regardless of sprinklers', () => {
    const plant = makeCorn(2, 3); // high water need
    worldWith(plant);
    global.currentWeather = 'rain';
    for (let tick = 0; tick < 2; tick++) plant.grow(0, 0);
    assert.ok(plant.watermet, 'rain satisfies all water needs');
    assert.ok(plant.age >= 1);
});

test('rain also accelerates growth relative to clear weather', () => {
    const clear = makeCorn(10, 0);
    worldWith(clear, 1, 1);
    global.currentWeather = 'clear';
    clear.grow(0, 0);
    const clearTimer = clear.growTimer;

    const rainy = makeCorn(10, 0);
    worldWith(rainy, 1, 1);
    global.currentWeather = 'rain';
    rainy.grow(0, 0);
    assert.ok(rainy.growTimer > clearTimer, 'rain adds a growth bonus per tick');
});

test('planting on a bed grants a large growth bonus', () => {
    const plant = makeCorn(10, 0);
    worldWith(plant);
    global.player = { touching: { name: 'bed' } };
    plant.grow(0, 0);
    assert.ok(plant.growTimer >= 3, 'a bed adds +2 (plus the base +1) per tick');
});

test('watermelon yields a variable harvest; other crops yield one', () => {
    const corn = makeCorn(10, 0);
    assert.equal(corn.getHarvestYield(), 1, 'a normal crop yields a single unit');
    const melon = new Plant('watermelon', 20, 0, 0, false, 2, 0, 10);
    const yieldAmount = melon.getHarvestYield();
    assert.ok(yieldAmount >= 2 && yieldAmount <= 5, 'watermelon yields 2-5');
});

test('load() restores the persisted growth/water state', () => {
    const plant = makeCorn(10, 1);
    plant.load({ age: 1, variant: 0, watermet: true, deathAttempts: 2, growTimer: 5, wateredDay: 9 });
    assert.equal(plant.age, 1);
    assert.equal(plant.deathAttempts, 2);
    assert.equal(plant.growTimer, 5);
    assert.equal(plant.wateredDay, 9);
});

test('load() defaults a missing wateredDay to -1 for legacy saves', () => {
    const plant = makeCorn(10, 1);
    plant.load({ age: 0, variant: 0, watermet: false, deathAttempts: 3, growTimer: 0 });
    assert.equal(plant.wateredDay, -1);
});
