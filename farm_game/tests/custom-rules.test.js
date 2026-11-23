'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const { installBaseGlobals, resetWorld } = require('./support/mocks');
const { installGameHelpers } = require('./support/game-helpers');
const { readPublic } = require('./support/load');

// --- Environment ------------------------------------------------------------
installBaseGlobals();
resetWorld();
installGameHelpers();
global.Dialouge_JSON = { 'Deb': {}, 'Rick': {}, 'Mr.C': {} };

// Evaluate the custom-rules block of miscfunctions.js (starting inventory,
// defaults/normalize, share codes, presets) on its own. Top-level const/let
// become var so the declarations land on the global object.
const misc = readPublic('miscfunctions.js');
const blockStart = misc.indexOf('const STARTING_INVENTORY_SLOTS');
const blockEnd = misc.indexOf('\nfunction ensureConfigModal() {');
assert.ok(blockStart !== -1 && blockEnd > blockStart, 'Could not isolate the custom rules block');
vm.runInThisContext(misc.slice(blockStart, blockEnd).replace(/^(const|let) /gm, 'var '));

const itemExists = name => all_items.some(def => def && def.name === name);

test('defaults are complete, versioned, and every map starts enabled', () => {
    const d = getDefaultCustomRules();
    assert.equal(d.version, CUSTOM_RULES_VERSION);
    assert.equal(d.mainQuestCoins, 10000);
    assert.equal(d.mainQuestDays, 100);
    assert.deepEqual(d.npcEnabled, { 'Deb': true, 'Rick': true, 'Mr.C': true });
    assert.equal(d.areasEnabled['Cloudy Meadows'], true);
    assert.equal(d.crittersEnabled['Bees'], true);
    assert.equal(d.itemsEnabled['1'], true, 'items keyed by registry index');
    assert.equal(d.itemsEnabled['0'], undefined, 'the empty slot is not an item');
    assert.deepEqual(d.startingInventory.slice(0, 3).map(e => e.name), ['Hoe', 'Corn', 'Corn Seed']);
    const weatherTotal = Object.values(d.weatherWeights).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(weatherTotal - 100) < 0.01, 'default weather sums to 100%');
});

test('normalize fills legacy/partial rules with defaults', () => {
    // Shape of a save from before weather weights, prices and starting kits existed.
    const legacy = normalizeCustomRules({
        mainQuestCoins: 5000,
        permaDeath: true,
        npcEnabled: { 'Rick': false },
        weatherWeights: null,
        itemsEnabled: null,
        itemPriceMultiplier: 100
    });
    assert.equal(legacy.mainQuestCoins, 5000);
    assert.equal(legacy.mainQuestDays, 100);
    assert.equal(legacy.permaDeath, true);
    assert.equal(legacy.moneyLoss, true);
    assert.equal(legacy.npcEnabled['Rick'], false);
    assert.equal(legacy.npcEnabled['Deb'], true, 'NPCs missing from the map stay enabled');
    assert.deepEqual(legacy.weatherWeights, DEFAULT_WEATHER_WEIGHTS);
    assert.equal(legacy.itemPriceMultiplier, undefined, 'unknown keys are dropped');
    assert.equal(legacy.startingInventory[0].name, 'Hoe');
});

test('normalize clamps bad values and rejects junk', () => {
    const r = normalizeCustomRules({
        mainQuestCoins: -50,
        mainQuestDays: 'lots',
        startingCoins: 1e12,
        moneyLoss: 'yes',
        itemPrices: { '1': 999, '1000': 5, '4': 10, '2': 'cheap' },
        npcEnabled: { 'Deb': 'off', 'Rick': false }
    });
    assert.equal(r.mainQuestCoins, 0);
    assert.equal(r.mainQuestDays, 100);
    assert.equal(r.startingCoins, 100000000);
    assert.equal(r.moneyLoss, true, 'non-boolean toggles fall back to the default');
    assert.deepEqual(r.itemPrices, { '1': 999 }, 'unknown items, price-less items and non-numbers are dropped');
    assert.equal(r.npcEnabled['Deb'], true);
    assert.equal(r.npcEnabled['Rick'], false);
});

test('weather over 100% is scaled down and Clear is derived', () => {
    const r = normalizeCustomRules({
        weatherWeights: { 'partly-cloudy': 100, 'overcast': 100, 'fog': 0, 'sunshower': 0, 'rain': 0, 'thunderstorm': 0, 'heatwave': 0, 'frog-rain': 0, 'clear': 90 }
    });
    const nonClear = WEATHER_WEIGHT_KEYS.reduce((sum, key) => sum + r.weatherWeights[key], 0);
    assert.ok(nonClear <= 100);
    assert.equal(r.weatherWeights['partly-cloudy'], 50);
    assert.equal(r.weatherWeights['overcast'], 50);
    assert.equal(r.weatherWeights.clear, 0);
});

test('share codes round-trip and only carry the changes', () => {
    const rules = normalizeCustomRules({
        mainQuestDays: 42,
        permaDeath: true,
        npcEnabled: { 'Rick': false },
        weatherWeights: { ...DEFAULT_WEATHER_WEIGHTS, 'rain': 20 },
        itemPrices: { '1': 5 },
        startingInventory: [{ name: 'Axe', amount: 1 }, 0, { name: 'Tomato', amount: 7 }]
    });
    const code = encodeShareCode(rules);
    assert.ok(code.startsWith(SHARE_CODE_PREFIX));
    assert.match(code.slice(SHARE_CODE_PREFIX.length), /^[A-Za-z0-9_-]+$/, 'URL/chat safe characters only');
    assert.deepEqual(decodeShareCode(code), rules);

    const diff = diffCustomRules(rules, getDefaultCustomRules());
    assert.deepEqual(diff.npcEnabled, { 'Rick': false });
    assert.deepEqual(diff.weatherWeights, { 'rain': 20 });
    assert.equal(diff.mainQuestCoins, undefined);
    assert.equal(diff.version, undefined);
});

test('the default rules encode to a tiny code', () => {
    const code = encodeShareCode(getDefaultCustomRules());
    assert.equal(code, SHARE_CODE_PREFIX + 'e30', 'empty diff: "{}"');
    assert.deepEqual(decodeShareCode(code), getDefaultCustomRules());
});

test('share codes tolerate whitespace and reject garbage with a readable message', () => {
    const code = encodeShareCode(normalizeCustomRules({ mainQuestCoins: 1234 }));
    const spaced = '  ' + code.slice(0, 6) + '\n' + code.slice(6) + '  ';
    assert.equal(decodeShareCode(spaced).mainQuestCoins, 1234);

    assert.throws(() => decodeShareCode(''), /Paste a rules code/);
    assert.throws(() => decodeShareCode('hello'), /not a Cloudy Meadows rules code/);
    assert.throws(() => decodeShareCode(SHARE_CODE_PREFIX + '!!!!'), /damaged/);
    // Valid base64, but the JSON inside is an array rather than an object.
    assert.throws(() => decodeShareCode(SHARE_CODE_PREFIX + Buffer.from('[1]').toString('base64')), /damaged/);
});

test('every built-in preset is valid and its starting kit survives normalization', () => {
    const ids = new Set();
    for (const preset of BUILT_IN_RULE_PRESETS) {
        assert.ok(!ids.has(preset.id), `duplicate preset id ${preset.id}`);
        ids.add(preset.id);
        const rules = mergeCustomRules(preset.rules);
        assert.deepEqual(normalizeCustomRules(rules), rules, `${preset.name} is already normalized`);
        for (const entry of preset.rules.startingInventory || []) {
            assert.ok(itemExists(entry.name), `${preset.name}: unknown item ${entry.name}`);
        }
        const kitSize = (preset.rules.startingInventory || []).length;
        if (kitSize) {
            assert.equal(rules.startingInventory.filter(Boolean).length, kitSize, `${preset.name}: kit fits the hotbar`);
        }
        for (const [key, value] of Object.entries(preset.rules.weatherWeights || {})) {
            assert.equal(rules.weatherWeights[key], value, `${preset.name}: ${key} weight is kept as written`);
        }
    }
    assert.deepEqual(mergeCustomRules(BUILT_IN_RULE_PRESETS.find(p => p.id === 'classic').rules), getDefaultCustomRules());
});

test('randomized rules are always playable', () => {
    let seed = 7;
    const rng = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 200; i++) {
        const rules = randomCustomRules(rng);
        assert.deepEqual(normalizeCustomRules(rules), rules);
        assert.equal(rules.startingInventory[0].name, 'Hoe');
        assert.ok(rules.mainQuestDays >= 30 && rules.mainQuestCoins >= 2000);
        assert.ok(Object.values(rules.npcEnabled).every(Boolean), 'NPCs stay on so Mr.C is reachable');
        assert.ok(Object.values(rules.areasEnabled).every(Boolean));
        const names = rules.startingInventory.filter(Boolean).map(e => e.name);
        assert.equal(new Set(names).size, names.length, 'no duplicate stacks');
    }
});
