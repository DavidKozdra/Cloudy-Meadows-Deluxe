'use strict';
const C = CloudySaveCodec;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const equal = (a, b, message) => assert(C.canonical(a) === C.canonical(b), message);
let repository, expected = new Map(), saveTimes = [], loadTimes = [], logicalBytes = 0;
let testCount = 1000;
function rng(seed) { let state = seed || 1; return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; }; }
function baseMaps() {
    return Object.fromEntries(Array.from({ length: 32 }, (_, area) => {
        const name = area < 24 ? `Authored Farm ${area}` : `Extra y:0 x:${area - 24}`;
        return [name, { name, ladybugs: area % 5, map: Array.from({ length: 24 }, (_, y) => Array.from({ length: 24 }, (_, x) => ({
            name: 'grass', class: 'Tile', num: 1, png: 1, pos: { x: x * 32, y: y * 32 }, age: 0, anim: 0, collide: false, variant: (x + y + area) % 4,
            under_tile: 0, light: 0, touching: 0, inv: [], playerOwned: false
        }))), fore: Array.from({ length: 24 }, () => Array(24).fill(0)) }];
    }));
}
const fixtureBases = baseMaps();
function fixture(seed) {
    const random = rng(seed), names = ['corn', 'strawberry', 'pumpkin', 'Chest', 'HarvestBot', 'WaterBot', 'NPC'];
    const inv = () => Array.from({ length: 8 }, (_, i) => ({ name: ['Corn', 'Corn Seed', 'Strawberries', 'Wood'][i % 4], amount: 1 + Math.floor(random() * 999), quality: i % 3 }));
    const data = C.clone(fixtureBases);
    for (const map of Object.values(data)) {
        for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
            if ((x + y) % 8) continue;
            const tile = map.map[y][x], kind = Math.floor(random() * names.length);
            Object.assign(tile, { name: names[kind], age: Math.floor(random() * 80), water: Math.floor(random() * 100), playerOwned: true,
                class: ['Plant','Plant','Plant','Chest','FarmRobot','FarmRobot','NPC'][kind], inv: kind > 2 ? inv() : [],
                goal: { x: Math.floor(random() * 24), y: Math.floor(random() * 24) }, facing: Math.floor(random() * 4) });
        }
    }
    data.Day_curLvl_Dif = { days: 3650 + seed, currentLevel_x: 4, currentLevel_y: 1, dificulty: seed % 4, currentWeather: 'rain',
        customRules: { startingCoins: seed, hungerRate: 80, growthRate: 125, timeWatchDays: 30, itemPrices: { Corn: seed % 20 + 1 }, areasEnabled: { home: true } },
        weatherLog: Array.from({ length: 3650 }, (_, day) => ({ day, weather: ['rain','frog-rain','heatwave','clear','thunderstorm'][Math.floor(random()*5)],
            lastRainDay: day - 1, lastFrogRainDay: day - 5, heatwaveStartDay: day - 3, heatwaveEndDay: day - 1 })) };
    data.player = { pos: { x: 32 * 5, y: 32 * 5 }, coins: seed * 101, hp: 70 + seed % 30, inv: inv(),
        quests: Array.from({ length: 40 }, (_, i) => ({ name: `Quest ${i}`, progress: seed % (i + 1), finished: i % 3 === seed % 3, failed: false, reward: i * 10 })) };
    data.extralvlStuff = { extraCount: 8, lvlLength: 14 };
    data.BridgeTutorialSeen = seed % 2 === 0;
    data.__worldInfo = { location: 'Authored Farm 0', updatedAt: '2026-01-01T00:00:00.000Z' };
    return data;
}
async function digest(data) { return C.hash(new TextEncoder().encode(C.canonical(data))); }
async function setupStress(count) {
    testCount = count;
    repository = await CloudyWorldRepository.open();
    await repository.registerBaseMaps(fixtureBases);
    return { fixtureBytes: new TextEncoder().encode(C.canonical(fixture(1))).length, baseMaps: Object.keys(fixtureBases).length, storage: await repository.storageInfo() };
}
async function createBatch(start, end) {
    for (let slot = start; slot <= end; slot++) {
        const data = fixture(slot), id = 'stress-world-' + slot, hash = await digest(data);
        const then = performance.now();
        const head = await repository.save(id, data, { slot });
        saveTimes.push(performance.now() - then); logicalBytes += head.logicalBytes;
        expected.set(slot, { id, hash });
    }
    return { through: end, count: await repository.count(), storage: await repository.storageInfo(), heapBytes: performance.memory?.usedJSHeapSize ?? null };
}
async function reopenStress() { repository.close(); repository = await CloudyWorldRepository.open(); }
async function verifyBatch(start, end) {
    for (let slot = start; slot <= end; slot++) {
        const { id, hash } = expected.get(slot), then = performance.now();
        const loaded = await repository.load(id, { recover: false });
        loadTimes.push(performance.now() - then);
        assert(await digest(loaded.data) === hash, 'Reload content mismatch in world ' + slot);
    }
    return { verifiedThrough: end, heapBytes: performance.memory?.usedJSHeapSize ?? null };
}
async function rejects(action, name) {
    try { await action(); } catch (error) { assert(!name || error.name === name, `Expected ${name}, got ${error.name}: ${error.message}`); return; }
    throw new Error('Expected operation to fail: ' + name);
}
async function verifyOne(slot) {
    const item = expected.get(slot), loaded = await repository.load(item.id, { recover: false });
    assert(await digest(loaded.data) === item.hash, 'Isolation mismatch in world ' + slot);
    return loaded;
}
async function exerciseFailures() {
    const results = [];
    const slot = 1, before = await verifyOne(slot), id = before.head.id;
    const changed = C.clone(before.data); changed.player.coins += 700;
    for (const fault of ['abort','quota']) {
        repository.options.transactionHook = tx => {
            if (fault === 'quota') throw new DOMException('Injected full disk', 'QuotaExceededError');
            tx.abort();
        };
        await rejects(() => repository.save(id, changed, { slot, expectedRevision: before.head.revision }), fault === 'quota' ? 'QuotaExceededError' : 'AbortError');
        repository.options.transactionHook = null;
        await verifyOne(slot); results.push(fault + ' rollback');
    }
    const storage = repository.storage;
    repository.storage = { estimate: async () => ({ usage: 999999, quota: 1000000 }), persisted: async () => false };
    await rejects(() => repository.save(id, changed, { slot, expectedRevision: before.head.revision }), 'QuotaExceededError');
    repository.storage = storage; await verifyOne(slot); results.push('space reserve');
    const writes = repository.metrics.recordWrites;
    const second = await repository.save(id, changed, { slot, expectedRevision: before.head.revision });
    assert(repository.metrics.recordWrites - writes === 1, 'Only changed player record should be rewritten');
    const snapshot = await repository.get('snapshots', [id, second.revision]);
    // Use a fresh transaction after the asynchronous manifest read.
    const damage = repository.db.transaction('records','readwrite');
    await new Promise((resolve, reject) => {
        damage.oncomplete = resolve; damage.onabort = () => reject(damage.error);
        const req = damage.objectStore('records').get([id, 'player', snapshot.refs.player.revision]);
        req.onsuccess = () => { const record = req.result; record.hash = 'broken'; damage.objectStore('records').put(record); };
    });
    const recovered = await repository.load(id);
    assert(recovered.recoveredFrom === before.head.revision, 'Should recover previous revision');
    assert(await digest(recovered.data) === expected.get(slot).hash, 'Recovery lost previous contents');
    await repository.save(id, recovered.data, { slot, expectedRevision: second.revision, preserveRevision: recovered.recoveredFrom });
    await verifyOne(slot); results.push('checksum recovery and repair');
    const reads = repository.metrics.recordReads;
    let after = 0, listed = 0;
    do { const page = await repository.list({ after, limit: 20 }); listed += page.items.length; after = page.next; } while (after);
    assert(listed === testCount && reads === repository.metrics.recordReads, 'Listing must read only summaries');
    results.push('paged summaries without world reads');
    return results;
}
async function randomOperations(iterations = 60) {
    const random = rng(9238);
    for (let i = 0; i < iterations; i++) {
        const slot = 1 + Math.floor(random() * testCount), loaded = await verifyOne(slot);
        let id = loaded.head.id, data = loaded.data;
        if (i % 5 === 0) {
            await repository.delete(id, loaded.head.revision);
            assert(!await repository.getBySlot(slot), 'Delete left its world summary');
            id = `replacement-${slot}-${i}`;
            await repository.save(id, data, { slot });
        } else {
            if (i % 5 === 1) data = fixture(10000 + i); // Replace all records like a validated import.
            else { data.player.coins += i; data['Authored Farm 0'].map[0][0].age += 1; }
            await repository.save(id, data, { slot, expectedRevision: loaded.head.revision });
        }
        expected.set(slot, { id, hash: await digest(data) });
        await verifyOne(slot);
        await verifyOne(1 + Math.floor(random() * testCount));
    }
    return { operations: iterations, count: await repository.count() };
}
function rawStore(initial = {}) {
    const data = new Map(Object.entries(initial));
    return { data, get: key => data.has(key) ? C.clone(data.get(key)) : undefined, set: (key,value) => data.set(key,C.clone(value)),
        remove: key => data.delete(key), clear: () => data.clear(), keys: () => data.size,
        key: index => 'legacy.' + [...data.keys()][index], showprefix: () => 'legacy.' };
}
async function migrationAndManagerTests() {
    const raw = rawStore({ ...fixture(13), Options: { musicVolume: 0.3 }, Achievements: { unlocked: ['corn-addict'] } });
    const manager = CloudyWorldSaves.create(raw, { name: 'migration-and-manager' });
    await manager.ready;
    assert(!raw.data.has('player') && manager.summary(1).valid, 'Legacy migration failed');
    await manager.activate(1);
    const firstId = manager.activeWorldId;
    equal(manager.store.get('Options'), { musicVolume: 0.3 }, 'Shared preferences lost');
    const data = fixture(14);
    await manager.replace(data);
    equal((await manager.repository.load(firstId)).data, data, 'Atomic import content mismatch');
    const bad = C.clone(data); bad.player.pos = null;
    await rejects(() => manager.replace(bad));
    equal((await manager.repository.load(firstId)).data, data, 'Invalid import replaced the original');
    await manager.activate(2);
    for (const [key,value] of Object.entries(fixture(15))) manager.store.set(key,value);
    await manager.commit();
    await manager.clearWorld(1);
    assert(manager.summary(2).valid, 'Deleting migrated world damaged World 2');
    equal(manager.store.get('Achievements'), { unlocked: ['corn-addict'] }, 'Deletion damaged shared achievements');
    await manager.activate(1);
    assert(manager.activeWorldId !== firstId, 'Reusing a slot must create a new permanent identity');
    manager.repository.close();
    return ['legacy migration', 'shared settings', 'validated atomic import', 'world isolation', 'permanent world IDs'];
}
let race;
async function prepareRace(id) { if (!repository) repository = await CloudyWorldRepository.open(); race = await repository.load(id); return race.head.revision; }
async function commitRace(coins) {
    race.data.player.coins = coins;
    try { await repository.save(race.head.id, race.data, { slot: race.head.slot, expectedRevision: race.head.revision }); return 'saved'; }
    catch (error) { return error.name; }
}
async function updateExpected(slot) { const head = await repository.getBySlot(slot); const data = (await repository.load(head.id)).data; expected.set(slot,{ id:head.id, hash: await digest(data) }); }
async function interruptibleSave(id) {
    const loaded = await repository.load(id); loaded.data.player.coins += 1;
    repository.options.transactionHook = tx => {
        window.transactionStarted = true;
        function keepAlive() { const req = tx.objectStore('worlds').get(id); req.onsuccess = keepAlive; }
        keepAlive();
    };
    repository.save(id,loaded.data,{slot:loaded.head.slot,expectedRevision:loaded.head.revision}).catch(() => {});
}
function stats(values) { const sorted = [...values].sort((a,b)=>a-b); return { medianMs: sorted[Math.floor(sorted.length/2)], p95Ms: sorted[Math.floor(sorted.length*.95)], maxMs: sorted.at(-1) }; }
async function stressReport() { return { worlds: testCount, logicalBytes, save: stats(saveTimes), load: stats(loadTimes), metrics: repository.metrics, storage: await repository.storageInfo(), heapBytes: performance.memory?.usedJSHeapSize ?? null }; }

function stressState() { return { expected: [...expected], saveTimes, logicalBytes, testCount }; }
async function resumeStress(state) {
    expected = new Map(state.expected); saveTimes = state.saveTimes; logicalBytes = state.logicalBytes; testCount = state.testCount;
    repository = await CloudyWorldRepository.open();
}
