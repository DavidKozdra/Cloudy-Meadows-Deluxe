'use strict';

function safetyWorld(coins = 10) {
    return {
        BridgeTutorialSeen: true,
        Day_curLvl_Dif: { days: 12, dificulty: 1, currentLevel_x: 1, currentLevel_y: 0, currentWeather: 'rain', weatherLog: [{ day: 12, weather: 'rain' }] },
        player: { coins, pos: { x: 32, y: 32 }, inv: [{ name: 'Corn', amount: 5 }], quests: [{ name: 'Farm', progress: 3 }] },
        Home: { name: 'Home', map: Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => ({ name: 'grass', age: 0 }))) }
    };
}

async function runStorageSafety() {
    const passed = [];
    let repo = await CloudyWorldRepository.open({ name: 'safety-base-versions' });
    const original = safetyWorld(), nextBase = C.clone(original.Home);
    await repo.registerBaseMaps({ Home: original.Home });
    const first = await repo.save('versioned-world', original, { slot: 1 });
    nextBase.map[3][4] = { name: 'rock', age: 10 };
    await repo.registerBaseMaps({ Home: nextBase });
    const edited = C.clone(original); edited.Home.map[2][3] = { name: 'corn', age: 4 };
    await repo.save(first.id, edited, { slot: 1, expectedRevision: first.revision });
    equal((await repo.readSnapshot(first.id, first.revision)).data, original, 'A changed base corrupted an older revision');
    repo.close(); repo = await CloudyWorldRepository.open({ name: 'safety-base-versions' });
    equal((await repo.load(first.id)).data, edited, 'Versioned base was not available after reopening');
    passed.push('base-map upgrades preserve old revisions');

    const controller = new AbortController();
    repo.options.transactionHook = () => controller.abort();
    await rejects(() => repo.save(first.id, safetyWorld(20), { slot: 1, expectedRevision: 2, signal: controller.signal }), 'AbortError');
    equal((await repo.load(first.id)).data, edited, 'Cancelling a write changed its original');
    repo.options.transactionHook = null;
    repo.worker.close();
    await rejects(() => repo.save(first.id, safetyWorld(20), { slot: 1, expectedRevision: 2 }));
    repo.close(); repo = await CloudyWorldRepository.open({ name: 'safety-base-versions' });
    equal((await repo.load(first.id)).data, edited, 'Worker failure changed the original');
    passed.push('cancelled writes and worker failures preserve saves');

    repo.storage = { persisted: async () => false, persist: async () => false };
    assert(!await repo.requestPersistence(), 'Persistence denial was not reported');
    const head = await repo.getBySlot(1);
    await new Promise((resolve, reject) => {
        const tx = repo.db.transaction('worlds', 'readwrite');
        tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
        tx.objectStore('worlds').put({ ...head, schema: 99 });
    });
    await rejects(() => repo.load(first.id));
    await rejects(() => repo.save(first.id, original, { slot: 1, expectedRevision: head.revision }));
    assert((await repo.getBySlot(1)).schema === 99, 'A future world schema was overwritten');
    repo.close();
    passed.push('future world schemas rejected and persistence denial handled');

    const raw = rawStore(), statuses = [];
    const listener = event => statuses.push(event.detail.state);
    window.addEventListener('worldSaveStatus', listener);
    const manager = CloudyWorldSaves.create(raw, { name: 'safety-manager' });
    await manager.ready; await manager.activate(1);
    for (const [key, value] of Object.entries(original)) manager.store.set(key, value);
    let release = false, settled = false, started;
    const writing = new Promise(resolve => { started = resolve; });
    manager.repository.options.transactionHook = tx => {
        started();
        function holdOpen() {
            if (release) return;
            tx.objectStore('worlds').get(manager.activeWorldId).onsuccess = holdOpen;
        }
        holdOpen();
    };
    const pending = manager.commit().then(() => { settled = true; });
    await writing;
    assert(!settled && manager.status === 'saving' && !statuses.includes('saved'), 'Saved was displayed before commit');
    release = true; await pending;
    assert(manager.status === 'saved' && manager.summary(1).coins === original.player.coins, 'Committed summary missing');
    manager.repository.options.transactionHook = null;
    assert((await manager.page({ limit: 1 })).next === null, 'The final full page offered an empty next page');
    passed.push('Saved waits for transaction completion');

    manager.repository.options.transactionHook = () => { throw new DOMException('Full disk', 'QuotaExceededError'); };
    await rejects(() => manager.replace(safetyWorld(999)), 'QuotaExceededError');
    equal(manager.store.get('player'), original.player, 'Failed import changed the active cache');
    assert(!manager.hasUnsavedChanges, 'Failed import left a false dirty state');
    equal((await manager.repository.load(manager.activeWorldId)).data, original, 'Failed import changed the original');
    manager.repository.options.transactionHook = null;
    await manager.activate(2); await manager.activate(1);
    passed.push('failed imports restore cache and permit switching');

    const worlds = new Map([[1, original]]), choose = rng(9203);
    for (const slot of [2, 1000]) {
        await manager.activate(slot); await manager.replace(safetyWorld(slot));
        worlds.set(slot, safetyWorld(slot));
    }
    for (let step = 0; step < 24; step++) {
        const slot = [1, 2, 1000][Math.floor(choose() * 3)];
        await manager.activate(slot);
        equal(await manager.prepareExport(), worlds.get(slot), 'Switching mixed world caches');
        const changed = C.clone(worlds.get(slot)); changed.player.coins += step;
        if (step % 3 === 0) {
            await manager.clearWorld(slot); await manager.activate(slot); await manager.replace(changed);
        } else if (step % 3 === 1) await manager.replace(changed);
        else manager.store.set('player', changed.player); // Autosave queued immediately before switching.
        worlds.set(slot, changed);
    }
    await manager.flush();
    for (const [slot, data] of worlds) {
        await manager.activate(slot); equal(await manager.prepareExport(), data, 'Random manager operations crossed world boundaries');
    }
    passed.push('random manager saves, imports, deletion and switches preserve isolation');

    const settings = { musicVolume: .37 };
    manager.store.set('Options', settings); settings.musicVolume = .99;
    manager.store.set('Controls', { forward: 'w' });
    await manager.flushSettings();
    equal((await manager.repository.get('settings', 'Options')).value, { musicVolume: .37 }, 'Setting changed after it was queued');
    manager.store.set('Options', { musicVolume: .1 });
    await manager.clearAll();
    assert((await manager.repository.settings()).length === 0 && await manager.repository.count() === 0, 'Clear raced a pending setting write');
    manager.repository.close(); window.removeEventListener('worldSaveStatus', listener);
    passed.push('settings flush before reload and clear');

    repo = await CloudyWorldRepository.open({ name: 'safety-migration' });
    const legacy = rawStore(original), load = repo.load.bind(repo);
    repo.load = async () => { throw new Error('Injected verification failure'); };
    const errors = await CloudyLegacySaves.migrate(repo, legacy);
    assert(errors.has(1), 'Migration verification failure was hidden');
    equal(Object.fromEntries(legacy.data), original, 'Original deleted before verification');
    repo.load = load;
    assert((await CloudyLegacySaves.migrate(repo, legacy)).size === 0, 'Interrupted migration could not resume');
    equal((await repo.load('legacy-v1-world-1')).data, original, 'Resumed migration changed data');
    assert(legacy.data.size === 0, 'Verified legacy source was not cleaned up');
    passed.push('migration resumes after failed verification without deleting originals');

    let upgraded = false;
    repo.onchange = event => { if (event.type === 'upgrade') upgraded = true; };
    const upgradedDB = await new Promise((resolve, reject) => {
        const opening = indexedDB.open('safety-migration', 2);
        opening.onsuccess = () => resolve(opening.result); opening.onerror = () => reject(opening.error);
    });
    assert(upgraded, 'Old connection did not close for an upgrade');
    await rejects(() => CloudyWorldRepository.open({ name: 'safety-migration' }), 'VersionError');
    const preserved = await new Promise((resolve, reject) => {
        const req = upgradedDB.transaction('worlds').objectStore('worlds').get('legacy-v1-world-1');
        req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    assert(preserved.revision === 1, 'Opening with older code changed upgraded data');
    upgradedDB.close();
    passed.push('database upgrades close old connections and reject older code');
    return passed;
}
