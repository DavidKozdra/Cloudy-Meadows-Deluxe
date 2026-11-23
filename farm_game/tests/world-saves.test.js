'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readPublic } = require('./support/load');
vm.runInThisContext(readPublic('classes/storage/save-codec.js'));
vm.runInThisContext(readPublic('classes/storage/legacy-saves.js'));
const C = globalThis.CloudySaveCodec;
const clone = C.clone;
function world() {
    return {
        BridgeTutorialSeen: true,
        Day_curLvl_Dif: { days: 30, dificulty: 2, currentLevel_x: 4, currentLevel_y: 1, currentWeather: 'rain', weatherLog: [{ day: 30, weather: 'rain' }] },
        player: { coins: 250, inv: [0, { name: 'Corn', amount: 12 }], quests: [{ name: 'Save Cloudy Meadows', progress: 7 }], pos: { x: 32, y: 64 } },
        Home: { name: 'Home', map: Array.from({ length: 30 }, (_, y) => Array.from({ length: 30 }, (_, x) => ({ name: 'corn', pos: { x, y }, age: 10, water: 5 }))) }
    };
}
test('maps, players, quests and weather round-trip as separate records', async () => {
    const expected = world(), records = C.split(expected), decoded = {};
    assert.ok(records.quests && records.weather && records.day && records['data:Home']);
    assert.equal(records.player.quests, undefined);
    for (const [key, value] of Object.entries(records)) decoded[key] = await C.decode(await C.encode(value));
    assert.deepEqual(clone(C.join(decoded)), expected);
});
test('large records use gzip and detect damaged contents', async () => {
    const value = world().Home, encoded = await C.encode(value);
    assert.equal(encoded.encoding, 'gzip');
    assert.ok(encoded.bytes < encoded.logicalBytes / 3);
    encoded.hash = 'corrupted';
    await assert.rejects(C.decode(encoded), /checksum/);
});
test('map edits are deltas against an immutable versioned base', async () => {
    const base = world().Home, next = clone(base);
    next.map[4][5] = { name: 'Chest', inv: [{ name: 'Corn', amount: 8 }] };
    const record = await C.encode(next, { id: 'base-v1:map1', value: base });
    assert.equal(record.baseId, 'base-v1:map1');
    assert.ok(record.bytes < 1000);
    assert.deepEqual(await C.decode(record, base), next);
    assert.equal(base.map[4][5].name, 'corn');
    await assert.rejects(C.decode(record), /base map/);
});
test('unchanged records avoid compression and rewriting', async () => {
    const value = world().Home, first = await C.encode(value);
    const next = await C.encode(value, null, first.hash);
    assert.equal(next.unchanged, true);
    assert.equal(next.data, undefined);
});
test('bridge tutorial completion is world metadata and survives record round-trips', async () => {
    for (const seen of [true, false]) {
        const data = world(); data.BridgeTutorialSeen = seen;
        const records = C.split(data), decoded = {};
        assert.equal(records['data:BridgeTutorialSeen'], seen);
        for (const [key, value] of Object.entries(records)) decoded[key] = await C.decode(await C.encode(value));
        assert.deepEqual(clone(C.join(decoded)), data);
    }
});
test('delta patches handle removal, resizing, Unicode and prototype-like nested keys', () => {
    const before = JSON.parse('{"array":[1,2,3],"obsolete":1,"__proto__":{"value":2}}');
    const after = JSON.parse('{"array":["🌽"],"added":[null,false,{}],"__proto__":{"value":4}}');
    assert.deepEqual(C.apply(before, C.diff(before, after)), after);
    assert.equal({}.value, undefined);
});
for (const corrupt of [data => data.Day_curLvl_Dif.days = -1, data => data.player.inv = {}, data => data.Day_curLvl_Dif.weatherLog = [{ day: 'bad' }], data => data.Home.map[0] = null, data => data.Options = {}]) {
    test('malformed imports are rejected before any storage writes', () => { const data = world(); corrupt(data); assert.throws(() => C.validate(data), /Invalid/); });
}
function legacyRaw(initial) {
    const values = new Map(Object.entries(clone(initial)));
    return { values, get: key => cloneOrMissing(values.get(key)), set: (key, value) => values.set(key, clone(value)),
        remove: key => values.delete(key), keys: () => values.size,
        key: index => 'passphrase.life.' + [...values.keys()][index], showprefix: () => 'passphrase.life.' };
}
function cloneOrMissing(value) { return value == null ? value : clone(value); }
function migrationRepo(options = {}) {
    const heads = new Map(), data = new Map(), receipts = new Map();
    return { heads, data, receipts,
        get: async (store, key) => store === 'migrations' ? receipts.get(key) : undefined,
        setSetting: async () => {}, getBySlot: async slot => heads.get(slot),
        save: async (id, value, { slot }) => {
            if (options.failSave) throw new DOMException('Full', 'QuotaExceededError');
            const head = { id, slot, revision: 1 }; heads.set(slot, head); data.set(id, clone(value)); return head;
        },
        load: async id => ({ head: { id, revision: 1 }, data: options.corruptRead ? {} : data.get(id) }),
        receipt: async (key, value) => receipts.set(key, value)
    };
}
test('legacy worlds migrate independently and originals are removed only after read-back verification', async () => {
    const first = world(), second = world(); second.player.coins = 999;
    const raw = legacyRaw({ ...first, ...Object.fromEntries(Object.entries(second).map(([key, value]) => ['__cloudyWorld2:' + key, value])), Options: { volume: 0.5 } });
    const repo = migrationRepo();
    assert.equal((await CloudyLegacySaves.migrate(repo, raw)).size, 0);
    assert.equal(repo.data.get('legacy-v1-world-1').player.coins, 250);
    assert.equal(repo.data.get('legacy-v1-world-2').player.coins, 999);
    assert.deepEqual([...raw.values.keys()], ['Options']);
    assert.equal(repo.receipts.size, 2);
});
for (const options of [{ failSave: true }, { corruptRead: true }]) {
    test('migration preserves the entire original if writing or verification fails', async () => {
        const data = world(), raw = legacyRaw(data);
        const errors = await CloudyLegacySaves.migrate(migrationRepo(options), raw);
        assert.ok(errors.has(1)); assert.deepEqual(Object.fromEntries(raw.values), data);
    });
}
test('legacy compact data remains readable', () => {
    const raw = { $cloudyWorld: 1, shapes: [['name','map']], strings: ['Home'], data: [0, [-2,0], [-1,[-1,1,2]]] };
    assert.deepEqual(CloudyLegacySaves.unpack(raw), { name: 'Home', map: [[1,2]] });
});
test('imports validate quest, inventory and tile data before replacing a playable world', () => {
    const data = world();
    data.player.quests = [{ og_name: 'Farm', days: 10, reward_item: 0, goals: [{ class: 'FundingGoal', amount: 100 }] }];
    data.Home.map[2][3] = { name: 'Chest', inv: [[0, { name: 'Corn', amount: 5 }], [0, 0]] };
    assert.equal(C.validateImport(data), data);
    for (const corrupt of [value => value.player.quests[0].goals = null,
        value => value.player.quests[0] = null,
        value => value.player.inv[1].amount = 'bad',
        value => value.Home.map[0][0].pos = { x: 'bad', y: 1 }]) {
        const broken = clone(data); corrupt(broken);
        assert.throws(() => C.validateImport(broken), /Invalid imported/);
    }
});
test('rewind restores map data directly without even staging a save', () => {
    const calls = [], level = { name: 'Home', map: [[{ name: 'corn', age: 3 }]] };
    const sandbox = { levels: [[level]], loadLevel: (...args) => calls.push(args), console,
        localData: { get() { assert.fail('Rewind must not read permanent storage'); }, set() { assert.fail('Rewind must not write permanent storage'); } } };
    vm.runInNewContext(readPublic('classes/time-rewind.js'), sandbox);
    sandbox.captureDaySnapshot(1); level.map[0][0].age = 7; sandbox.restoreDaySnapshot(1);
    assert.equal(calls[0][3].map[0][0].age, 3);
    assert.equal(calls[0][0], level);
});
test('Time Watch history has a separate bounded byte budget', () => {
    const sandbox = { levels: [[{ name: 'Big', map: [[{ name: 'corn', data: 'x'.repeat(1024 * 1024) }]] }]], customRule: () => 1000, console };
    vm.runInNewContext(readPublic('classes/time-rewind.js'), sandbox);
    for (let day = 0; day < 40; day++) sandbox.captureDaySnapshot(day);
    assert.equal(sandbox.hasDaySnapshot(0), false);
    assert.equal(sandbox.hasDaySnapshot(39), true);
});
