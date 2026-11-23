'use strict';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const { installBaseGlobals, resetWorld } = require('./support/mocks');
const { installGameHelpers } = require('./support/game-helpers');
const { readPublic, loadClasses } = require('./support/load');

// --- Environment ------------------------------------------------------------
installBaseGlobals();
resetWorld();
installGameHelpers();
global.Dialouge_JSON = JSON.parse(readPublic('dialouge_list.json'));
global.window.addEventListener = () => {};

// Co-op templates/districts (the file also registers window listeners).
vm.runInThisContext(readPublic('classes/cooperative-exchange.js').replace(/^(const|let) /gm, 'var '));
// The rules engine itself, plus the rules block of miscfunctions.js
// (defaults, normalize, share codes) that calls into it.
vm.runInThisContext(readPublic('classes/custom-rules.js').replace(/^(const|let) /gm, 'var '));
const misc = readPublic('miscfunctions.js');
vm.runInThisContext(misc
    .slice(misc.indexOf('const STARTING_INVENTORY_SLOTS'), misc.indexOf('\nfunction ensureConfigModal() {'))
    .replace(/^(const|let) /gm, 'var '));

// Plant growth runs through the rule hooks.
global.new_tile_from_num = (num, x, y) => ({ name: num === 5 ? 'dirt' : `tile_${num}`, pos: { x, y }, class: 'Tile' });
loadClasses(['classes/tile_classes/tile.js', 'classes/tile_classes/plant.js'], ['Tile', 'Plant']);

beforeEach(() => {
    window.customRules = null;
    global.currentWeather = 'clear';
    global.player = { touching: { name: 'grass' } };
});

// --- Specs and defaults -------------------------------------------------------

test('every rule spec has a sane default and survives normalization unchanged', () => {
    const keys = new Set();
    for (const spec of RULE_SPECS) {
        assert.ok(!keys.has(spec.key), `duplicate rule key ${spec.key}`);
        keys.add(spec.key);
        assert.ok(['int', 'bool', 'enum'].includes(spec.type), `${spec.key} has a known type`);
        if (spec.type === 'int') {
            assert.ok(spec.def >= spec.min && spec.def <= spec.max, `${spec.key} default is in range`);
        }
        assert.deepEqual(normalizeRuleSpecValue(spec, spec.def), spec.def, `${spec.key} default is valid`);
        assert.ok(spec.label && spec.tab && spec.section, `${spec.key} has label/tab/section`);
    }
});

test('the full rules object includes every extended rule at its default', () => {
    const defaults = getDefaultCustomRules();
    for (const spec of RULE_SPECS) assert.equal(defaults[spec.key], spec.def, spec.key);
    assert.deepEqual(defaults.mapEdits, {});
    assert.equal(defaults.coopContracts, null);
    assert.deepEqual(normalizeCustomRules({}), defaults);
    assert.equal(encodeShareCode(defaults), SHARE_CODE_PREFIX + 'e30', 'defaults still encode to an empty diff');
});

test('customRule falls back to the original game for normal difficulties and old saves', () => {
    assert.equal(customRule('dayLengthSec'), 120);
    assert.equal(getDayTickMs(), 300, 'default tick matches the original 300ms');
    window.customRules = { mainQuestCoins: 5000 }; // custom rules saved before these keys existed
    assert.equal(customRule('hungerRate'), 100);
    assert.equal(customRule('cropsNeedWater'), true);
    window.customRules = { dayLengthSec: 60, cropsNeedWater: false };
    assert.equal(getDayTickMs(), 150);
    assert.equal(customRule('cropsNeedWater'), false);
});

test('simple rules are clamped and bad choices fall back to the default', () => {
    const r = normalizeCustomRules({
        dayLengthSec: 5,
        maxHunger: 99,
        hungerRate: 'fast',
        alwaysDay: 'yes',
        winCondition: 'cheat',
        winItem: 'Not An Item',
        viewMode: '3d',
        startArea: 'Poly Park: 1'
    });
    assert.equal(r.dayLengthSec, 30);
    assert.equal(r.maxHunger, 12);
    assert.equal(r.hungerRate, 100);
    assert.equal(r.alwaysDay, false);
    assert.equal(r.winCondition, 'funding');
    assert.equal(r.winItem, 'Corn');
    assert.equal(r.viewMode, '3d');
    assert.equal(r.startArea, 'Poly Park: 1');
});

// --- Structured rules ------------------------------------------------------------

test('shop stock keeps real changes only and validates items', () => {
    const vegetables = shopTileDefinitions().find(s => s.name === 'Vegetables');
    assert.ok(vegetables, 'Vegetables shop exists');
    const r = normalizeCustomRules({
        shopStock: {
            'Vegetables': vegetables.stock,                       // unchanged: dropped
            'Fruits': [{ name: 'Axe', amount: 2 }, { name: 'Axe', amount: 9 }, { name: 'Nope', amount: 1 }, { name: 'Corn', amount: 5000 }],
            'Not A Shop': [{ name: 'Corn', amount: 1 }]
        }
    });
    assert.deepEqual(Object.keys(r.shopStock), ['Fruits']);
    assert.deepEqual(r.shopStock.Fruits, [{ name: 'Axe', amount: 2 }, { name: 'Corn', amount: 999 }]);
});

test('co-op contracts: built-ins mean null, edits are validated', () => {
    assert.equal(normalizeCustomRules({ coopContracts: COOP_CONTRACT_TEMPLATES }).coopContracts, null);
    const r = normalizeCustomRules({ coopContracts: [
        { district: 'Beach', title: 'Melon Run', itemName: 'Watermelon', amount: 3, reward: 900 },
        { district: 'Mars', title: '', itemName: 'Corn', amount: -4, reward: 'lots' },
        { district: 'Beach', title: 'Bad', itemName: 'Unobtainium', amount: 1, reward: 1 }
    ] });
    assert.equal(r.coopContracts.length, 2);
    assert.deepEqual(r.coopContracts[0], { district: 'Beach', title: 'Melon Run', itemName: 'Watermelon', amount: 3, reward: 900 });
    assert.equal(r.coopContracts[1].district, COOP_DISTRICTS[0]);
    assert.equal(r.coopContracts[1].amount, 1);
    assert.equal(r.coopContracts[1].reward, 100);
    assert.equal(r.coopContracts[1].title, 'Order of Corn');
});

test('custom quests drop incomplete entries', () => {
    const r = normalizeCustomRules({ customQuests: [
        { name: 'Melons for Deb', giver: 'Deb', goalType: 'give', npc: 'Deb', item: 'Watermelon', amount: 5, rewardCoins: 300 },
        { name: '', goalType: 'have', item: 'Corn' },          // no name
        { name: 'Give nothing', goalType: 'give', npc: 'Deb' }, // no item
        { name: 'Go places', goalType: 'visit', level: 'Beach: 1', days: 4, rewardItem: 'Axe', rewardAmount: 1 }
    ] });
    assert.deepEqual(r.customQuests.map(q => q.name), ['Melons for Deb', 'Go places']);
    assert.equal(r.customQuests[1].rewardItem, 'Axe');
});

test('dialogue and map edits are validated', () => {
    const r = normalizeCustomRules({
        dialogueOverrides: { Deb: { '0': '  Howdy!  ', '0.1': 'Sure', 'abc': 'bad key', '2': '' } },
        mapEdits: { 'Cloudy Meadows: Home': { '3,4': 2, '19,0': 2, '0,23': 2, '1,1': 99999, '2,2': 'x', '5,5': 12 } }
    });
    assert.deepEqual(r.dialogueOverrides, { Deb: { '0': 'Howdy!', '0.1': 'Sure' } });
    assert.deepEqual(r.mapEdits, { 'Cloudy Meadows: Home': { '3,4': 2, '5,5': 12 } }, 'out-of-grid and unknown tiles dropped');
});

test('share codes carry extended rules, including map edits', () => {
    const rules = normalizeCustomRules({
        dayLengthSec: 300,
        winCondition: 'survive',
        winDays: 50,
        cropGrowth: { corn: 200 },
        mapEdits: { 'Cloudy Meadows: Home': { '3,4': 12 } },
        customQuests: [{ name: 'Corn!', goalType: 'have', item: 'Corn', amount: 20 }]
    });
    assert.deepEqual(decodeShareCode(encodeShareCode(rules)), rules);
});

// --- Game hook math ---------------------------------------------------------------

test('harvest, seed and price hooks are identity at default rules', () => {
    for (let base = 1; base <= 5; base++) {
        assert.equal(scaleHarvestYield(base, 2), base + 2);
        assert.equal(scaleSeedAmount(base), base);
    }
    assert.equal(scaleSellPrice(15), 15);
    assert.equal(scaleBuyPrice(15), 15);
    assert.equal(shopFallbackSellPrice(20), 15);
    assert.equal(getCropGrowthScale('corn'), 1);
});

test('harvest, seed and price hooks follow the rules', () => {
    window.customRules = { harvestYield: 300, ladybugBonus: 0, seedReturn: 0, sellPriceMultiplier: 200, buyPriceMultiplier: 50,
        cropGrowthSpeed: 200, cropGrowth: { corn: 50 } };
    assert.equal(scaleHarvestYield(2, 4), 6);
    assert.equal(scaleSeedAmount(3), 0);
    assert.equal(scaleSellPrice(15), 30);
    assert.equal(scaleBuyPrice(15), 8);
    assert.equal(getCropGrowthScale('corn'), 1);
    assert.equal(getCropGrowthScale('tomato'), 2);
    window.customRules = { harvestYield: 10 };
    assert.equal(scaleHarvestYield(1, 0), 1, 'a harvest always gives at least one');
});

function growOnce(plant) {
    const map = [[0, 0, 0], [0, plant, 0], [0, 0, 0]].map((row, r) => row.map((t, c) => t || { name: 'grass', pos: { x: c * 32, y: r * 32 } }));
    plant.pos.x = 32;
    plant.pos.y = 32;
    global.levels = [[{ map, ladybugs: 0 }]];
    global.days = 0;
    const before = plant.growTimer;
    plant.grow(0, 0);
    return plant.growTimer - before;
}

test('crop growth matches the original numbers at default rules', () => {
    const plant = () => new Plant('corn', 20, 0, 0, false, 2, 0, 1e9);
    assert.equal(growOnce(plant()), 1);
    global.currentWeather = 'rain';
    assert.equal(growOnce(plant()), 1.25);
    global.currentWeather = 'overcast';
    assert.ok(Math.abs(growOnce(plant()) - 0.8) < 1e-9);
    global.currentWeather = 'heatwave';
    assert.equal(growOnce(plant()), 0.5);
    global.currentWeather = 'clear';
    global.player = { touching: { name: 'bed' } };
    assert.equal(growOnce(plant()), 3);
});

test('crop growth and watering follow the Farming rules', () => {
    window.customRules = { cropGrowthSpeed: 200, rainGrowthBonus: 100, cropsNeedWater: false };
    global.currentWeather = 'rain';
    const thirsty = new Plant('tomato', 23, 0, 0, false, 15, 2, 1e9);
    assert.equal(growOnce(thirsty), 4, '(1 + 100%) x 200%');
    global.currentWeather = 'clear';
    growOnce(thirsty);
    assert.equal(thirsty.watermet, true, 'crops never need water when the rule is off');
});

test('dry crops survive when the rule is off', () => {
    window.customRules = { dryCropsDie: false };
    const plant = new Plant('tomato', 23, 0, 0, false, 15, 2, 1);
    for (let i = 0; i < 10; i++) growOnce(plant);
    assert.equal(plant.deathAttempts, 3, 'never loses attempts to drought');
});

// --- Win conditions, quests and dialogue ---------------------------------------

test('each win condition builds the matching main quest goals', () => {
    const base = getDefaultCustomRules();
    const goalsFor = cond => buildMainQuestGoals({ ...base, winCondition: cond, winItem: 'Tomato', winAmount: 30, winDays: 40, winQuestCount: 3, winContractCount: 6 });
    assert.deepEqual(goalsFor('funding')[1], { class: 'FundingGoal', amount: 10000 });
    assert.deepEqual(goalsFor('harvest')[1], { class: 'HaveGoal', item_name: 'Tomato', amount: 30 });
    assert.deepEqual(goalsFor('sell')[1], { class: 'SellGoal', item_name: 'Tomato', amount: 30 });
    assert.deepEqual(goalsFor('survive')[1], { class: 'SurviveGoal', target_days: 40 });
    assert.deepEqual(goalsFor('quests')[1], { class: 'QuestCountGoal', amount: 3 });
    assert.deepEqual(goalsFor('coop')[1], { class: 'CoopContractGoal', amount: 6 });
    for (const cond of WIN_CONDITION_OPTIONS.map(o => o.value)) {
        assert.equal(goalsFor(cond)[0].npc_name, 'Mr.C', `${cond} still starts by talking to Mr.C`);
    }
});

test('new goal types rebuild from save data and complete', () => {
    global.Goal = class { constructor(name) { this.name = name; this.done = false; } };
    global.days = 10;
    const survive = rebuildCustomRuleGoal({ class: 'SurviveGoal', target_days: 10, done: false });
    survive.update();
    assert.equal(survive.done, true);
    global.player = { quests: [{ og_name: 'Save Cloudy Meadows', done: false }, { og_name: 'A', done: true }, { og_name: 'B', done: true }] };
    const quests = rebuildCustomRuleGoal({ class: 'QuestCountGoal', amount: 2 });
    quests.update();
    assert.equal(quests.done, true);
    assert.equal(rebuildCustomRuleGoal({ class: 'FundingGoal', amount: 5 }), null, 'other classes are left to quest.js');
});

test('dialogue rules: edits, disabled quests, reward scaling and offered quests', () => {
    const questReply = Dialouge_JSON.Deb.flatMap(line => line.replies).find(r => r.quest !== -1);
    const rules = normalizeCustomRules({
        dialogueOverrides: { Deb: { '0': 'Hello from the editor', '0.0': 'Worms?' } },
        questRewardMultiplier: 200,
        customQuests: [{ name: 'Rush order', giver: 'Deb', goalType: 'have', item: 'Corn', amount: 5, rewardCoins: 50 }]
    });
    const data = buildRuleDialogueData('Deb', rules);
    assert.equal(data[0].phrase, 'Hello from the editor');
    assert.equal(data[0].replies[0].quest.name, 'Rush order', 'custom quest offered first on line 0');
    assert.equal(data[0].replies[1].phrase, 'Worms?');
    const scaled = data.flatMap(line => line.replies).find(r => r.quest !== -1 && r.quest.name === questReply.quest.name);
    assert.equal(scaled.quest.reward_coins, questReply.quest.reward_coins * 2);
    assert.equal(Dialouge_JSON.Deb[0].phrase.startsWith('Hi, I'), true, 'the shared dialogue JSON is not modified');

    const disabled = buildRuleDialogueData('Deb', normalizeCustomRules({ disabledSideQuests: [questReply.quest.name] }));
    assert.ok(disabled.flatMap(line => line.replies).every(r => r.quest === -1 || r.quest.name !== questReply.quest.name));
});

test('co-op unlocks by rule day, or on day 1 when it is the win condition', () => {
    global.days = 4;
    assert.equal(isCoopUnlockedByRules(), false, 'default: only after the main quest');
    window.customRules = { coopUnlockDay: 5 };
    assert.equal(isCoopUnlockedByRules(), true, 'day index 4 is day 5');
    window.customRules = { coopUnlockDay: 6 };
    assert.equal(isCoopUnlockedByRules(), false);
    window.customRules = { winCondition: 'coop' };
    assert.equal(isCoopUnlockedByRules(), true);
});

// --- New-game setup ----------------------------------------------------------------

test('new-game setup applies map, shop, dialogue, quests, time and start area (and is safe to rerun)', () => {
    const grass = (r, c) => ({ name: 'grass', class: 'Tile', collide: false, pos: { x: c * 32, y: r * 32 } });
    const grid = () => Array.from({ length: 19 }, (_, r) => Array.from({ length: 23 }, (_, c) => grass(r, c)));
    const home = { name: 'Cloudy Meadows: Home', map: grid(), lights: [] };
    const beach = { name: 'Beach: 1', map: grid(), lights: [] };
    beach.map[5][5] = { name: 'rock', class: 'Tile', collide: true, pos: { x: 160, y: 160 } }; // spawn must step aside
    const shop = { name: 'Vegetables', class: 'Shop', inv: [], originalPrices: [], itemsSold: {} };
    const deb = { name: 'Deb', class: 'NPC', dialouges: [], current_dialouge: 3 };
    home.map[2][2] = shop;
    home.map[2][3] = deb;
    global.levels = [[home, beach]];
    global.tileSize = 32;
    global.maxHunger = 6;
    global.new_tile_from_num = (num, x, y) => ({ name: all_tiles[num - 1].name, class: all_tiles[num - 1].class || 'Tile', pos: { x, y } });
    global.Dialouge = class { constructor(phrase, replies) { this.phrase = phrase; this.replies = replies; } };
    global.Quest = class { constructor(name, goals, days) { Object.assign(this, { og_name: name, goals, days }); } };
    global.Goal = class { constructor(name) { this.name = name; this.done = false; } };
    global.time = 0;
    global.timephase = 0;
    global.currentLevel_y = 0;
    global.currentLevel_x = 0;

    const questName = Dialouge_JSON.Deb.flatMap(l => l.replies).find(r => r.quest !== -1).quest.name;
    const rules = normalizeCustomRules({
        mapEdits: { 'Cloudy Meadows: Home': { '4,4': 12 } },
        shopStock: { Vegetables: [{ name: 'Axe', amount: 2 }] },
        disabledSideQuests: [questName],
        winCondition: 'harvest', winItem: 'Tomato', winAmount: 40, mainQuestDays: 60,
        customQuests: [{ name: 'Starter task', goalType: 'have', item: 'Corn', amount: 3 }],
        startTimeOfDay: 'night', maxHunger: 9, maxHealth: 250,
        startArea: 'Beach: 1'
    });
    window.customRules = rules;
    const target = { hp: 100, hunger: 6, pos: { x: 0, y: 0 }, quests: [{ og_name: 'Save Cloudy Meadows', goals: [] }, { og_name: 'Talk to some people', goals: [] }] };

    applyNewGameCustomRules(target, rules);
    applyNewGameCustomRules(target, rules); // reload before the first save
    applyCustomStartArea(target, rules);

    assert.equal(home.map[4][4].name, 'lamppost', 'map edit placed with the real one-based tile ID');
    assert.deepEqual(shop.inv.map(i => [i.name, i.amount]), [['Axe', 2]], 'shop restocked');
    assert.equal(deb.current_dialouge, 0);
    assert.ok(deb.dialouges.flatMap(d => d.replies).every(r => r.quest === -1 || r.quest.name !== questName), 'disabled quest removed');
    const main = target.quests[0];
    assert.equal(main.og_name, 'Save Cloudy Meadows');
    assert.deepEqual(main.goals[1], { class: 'HaveGoal', item_name: 'Tomato', amount: 40 });
    assert.equal(main.days, 60);
    assert.equal(target.quests.filter(q => q.og_name === 'Starter task').length, 1, 'custom quest added once');
    assert.equal(global.time, 190);
    assert.equal(global.timephase, 1);
    assert.equal(global.maxHunger, 9);
    assert.equal(target.hunger, 9);
    assert.equal(target.hp, 250);
    assert.deepEqual([global.currentLevel_y, global.currentLevel_x], [0, 1], 'moved to the Beach');
    assert.notDeepEqual([target.pos.x, target.pos.y], [160, 160], 'not inside the rock');
    assert.equal(beach.map[target.pos.y / 32][target.pos.x / 32].collide, false);
});
