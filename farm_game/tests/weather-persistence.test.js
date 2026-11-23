'use strict';

// lastRainDay / lastFrogRainDay drive 3-day shop price effects (sprinkler
// discount after rain, Ladybug/Bee doubling after frog rain). They must survive
// a save/reload and a Time Watch rewind, like currentWeather does.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readPublic } = require('./support/load');

function loadTimeRewind(globals) {
    const store = new Map();
    const sandbox = {
        levels: [], loadLevel() {}, console,
        localData: { get: k => store.get(k), set: (k, v) => store.set(k, v), remove: k => store.delete(k) },
        ...globals
    };
    vm.runInNewContext(readPublic('classes/time-rewind.js'), sandbox);
    return sandbox;
}

test('Time Watch rewind restores rain and frog-rain days with the weather', () => {
    const s = loadTimeRewind({ currentWeather: 'thunderstorm', lastRainDay: 4, lastFrogRainDay: 2 });
    s.captureDaySnapshot(4);

    s.currentWeather = 'clear';
    s.lastRainDay = 9;
    s.lastFrogRainDay = 8;
    assert.equal(s.restoreDaySnapshot(4), true);

    assert.equal(s.currentWeather, 'thunderstorm');
    assert.equal(s.lastRainDay, 4);
    assert.equal(s.lastFrogRainDay, 2);
});

test('saveAll writes and the loader reads lastRainDay / lastFrogRainDay', () => {
    const source = readPublic('miscfunctions.js');
    const saveBlock = source.slice(source.indexOf("localData.set('Day_curLvl_Dif', {"));
    const saved = saveBlock.slice(0, saveBlock.indexOf('});'));
    assert.match(saved, /lastRainDay:\s*lastRainDay/);
    assert.match(saved, /lastFrogRainDay:\s*lastFrogRainDay/);
    assert.match(source, /lastRainDay = savedDayState\.lastRainDay/);
    assert.match(source, /lastFrogRainDay = savedDayState\.lastFrogRainDay/);
});
