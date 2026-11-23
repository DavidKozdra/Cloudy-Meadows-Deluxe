'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readPublic } = require('./support/load');

// Load weather-system.js into an isolated window with p5 drawing calls recorded.
function makeWeather(overrides = {}) {
    const calls = [];
    const record = name => (...args) => calls.push({ name, args });
    const window = {
        canvasWidth: 800, canvasHeight: 600, time: 50, paused: false, CORNER: 'corner',
        push: record('push'), pop: record('pop'), rectMode: record('rectMode'),
        noStroke: record('noStroke'), fill: record('fill'), rect: record('rect'),
        stroke: record('stroke'), strokeWeight: record('strokeWeight'), line: record('line'),
        ...overrides
    };
    const sandbox = { window, Math: Object.create(Math) };
    vm.runInNewContext(readPublic('classes/weather-system.js'), sandbox);
    return { weather: window.CloudyWeather, window, calls, sandbox };
}

// Lines drawn after the yellow bolt stroke is set (rain lines come earlier with a blue stroke).
const boltLines = calls => {
    const start = calls.findIndex(c => c.name === 'stroke' && c.args.join() === '255,255,150,180');
    return start < 0 ? [] : calls.slice(start).filter(c => c.name === 'line');
};

test('a lightning strike draws a flash and jagged bolts reaching the bottom of the screen', () => {
    const { weather, calls, sandbox } = makeWeather();
    sandbox.Math.random = () => 0; // always strike, always 2 bolts
    assert.equal(weather.lightning(), true);

    assert.ok(calls.some(c => c.name === 'fill' && c.args.join() === '255,255,255,50'), 'white flash overlay');
    const lines = boltLines(calls);
    assert.equal(lines.length, 16, 'two bolts of eight segments each');
    assert.equal(lines[7].args[3], 600, 'first bolt reaches the canvas bottom');
    for (let i = 1; i < 8; i++) {
        assert.deepEqual(lines[i].args.slice(0, 2), lines[i - 1].args.slice(2), 'segments are connected');
    }
});

test('no strike means no flash and no bolts', () => {
    const { weather, calls, sandbox } = makeWeather();
    sandbox.Math.random = () => 0.99;
    assert.equal(weather.lightning(), false);
    assert.equal(calls.length, 0);
});

test('thunderstorm rendering includes lightning bolts, not just a flash', () => {
    const { weather, window, calls, sandbox } = makeWeather({ currentWeather: 'thunderstorm' });
    sandbox.Math.random = () => 0;
    weather.render();
    assert.ok(calls.some(c => c.name === 'stroke' && c.args.join() === '255,255,150,180'), 'yellow bolt stroke');
    assert.ok(calls.some(c => c.name === 'strokeWeight' && c.args[0] === 3), 'thick bolt lines');
    assert.equal(window.currentWeather, 'thunderstorm');
});
