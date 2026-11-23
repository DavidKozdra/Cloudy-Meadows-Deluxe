(function (global) {
    'use strict';
    const SLOT_COUNT = 3; // Menu capacity; the repository has no three-world limit.
    const SHARED_KEYS = new Set(['Options', 'Controls', 'customRulePresets', 'Achievements']);
    const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
    const empty = id => ({ id, name: `World ${id}`, valid: false, occupied: false, days: 0, coins: 0 });
    function create(raw, options = {}) {
        let activeId = raw.get('__cloudyActiveWorld') || 1;
        if (!Number.isSafeInteger(activeId) || activeId < 1) activeId = 1;
        let context = null, repo = null, ready = false, initializationError = null;
        let metadata = new Map(), migrationErrors = new Map(), total = 0, refreshPromise = null;
        let settingsPending = Promise.resolve();
        const shared = new Map([...SHARED_KEYS].map(key => [key, raw.get(key)]));
        const manager = { status: 'loading', lastError: null, ready: null, store: null };
        function status(state, error = null) {
            manager.status = state; manager.lastError = error;
            if (typeof global.dispatchEvent === 'function') global.dispatchEvent(new CustomEvent('worldSaveStatus', { detail: { state, message: error?.message || '' } }));
        }
        function checkSlot(id) { if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid world slot.'); }
        function checkKey(key) {
            if (typeof key !== 'string' || key.startsWith('__cloudy') || ['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Invalid world data key.');
        }
        async function refresh() {
            if (!repo) return;
            const [page, count] = await Promise.all([repo.list({ limit: SLOT_COUNT }), repo.count()]);
            metadata = new Map(page.items.map(head => [head.slot, head])); total = count;
        }
        async function initialize() {
            try {
                repo = await CloudyWorldRepository.open(options);
                migrationErrors = await CloudyLegacySaves.migrate(repo, raw);
                for (const { key, value } of await repo.settings()) {
                    shared.set(key, value);
                    try { raw.set(key, value); } catch { /* IndexedDB remains authoritative. */ }
                }
                await refresh(); ready = true; status('idle');
                repo.onchange = () => { manager.invalidate(); };
                return manager;
            } catch (error) { initializationError = error; status('error', error); throw error; }
        }
        async function commit() {
            if (!context) throw new Error('Open a world before saving.');
            const target = context;
            target.batch = false;
            const data = clone(target.data), generation = target.generation;
            CloudySaveCodec.validate(data);
            target.beforeBatch = null;
            const operation = target.pending.catch(() => {}).then(async () => {
                status('saving');
                try {
                    const head = await repo.save(target.id, data, { slot: target.slot, expectedRevision: target.revision, preserveRevision: target.recoveredFrom });
                    target.revision = head.revision; target.recoveredFrom = null;
                    if (target.generation === generation) target.dirty = false;
                    metadata.set(target.slot, head); total = await repo.count();
                    status('saved'); return head;
                } catch (error) { status('error', error); throw error; }
            });
            target.pending = operation;
            // Some legacy gameplay callers intentionally fire-and-forget autosaves.
            operation.catch(() => {});
            return operation;
        }
        function changed() {
            context.dirty = true; context.generation++;
            // Individual tutorial/config writes remain durable; saveAll batches them.
            if (context.revision && !context.batch && !context.scheduled) {
                const target = context;
                target.scheduled = true;
                queueMicrotask(() => {
                    target.scheduled = false;
                    if (context === target && target.dirty && !target.batch) commit().catch(() => {});
                });
            }
        }
        manager.store = {
            get(key) { checkKey(key); return clone(SHARED_KEYS.has(key) ? shared.get(key) : context?.data[key]); },
            set(key, value) {
                checkKey(key);
                if (SHARED_KEYS.has(key)) {
                    const savedValue = clone(value);
                    shared.set(key, savedValue);
                    try { raw.set(key, value); } catch { /* World data never uses this small bootstrap mirror. */ }
                    settingsPending = settingsPending.catch(() => {}).then(() => manager.ready).then(() => repo.setSetting(key, savedValue));
                    settingsPending.catch(error => status('error', error));
                } else {
                    if (!context) throw new Error('Open a world before changing its save.');
                    context.data[key] = clone(value); changed();
                }
            },
            remove(key) { checkKey(key); if (SHARED_KEYS.has(key)) throw new Error('Use settings to reset shared preferences.'); if (context) { delete context.data[key]; changed(); } },
            clear: () => manager.clearWorld(activeId),
            worldKeys: () => Object.keys(context?.data || {})
        };
        Object.assign(manager, {
            summary(id) {
                const head = metadata.get(id);
                if (head) return { ...head.summary, worldId: head.id, revision: head.revision };
                return migrationErrors.has(id) ? { ...empty(id), occupied: true, error: migrationErrors.get(id) } : empty(id);
            },
            list: () => [1, 2, 3].map(id => manager.summary(id)),
            async page({ after = 0, limit = SLOT_COUNT } = {}) {
                await manager.ready;
                const page = await repo.list({ after, limit });
                for (const head of page.items) metadata.set(head.slot, head);
                return { items: page.items.map(head => manager.summary(head.slot)), next: page.next };
            },
            async activate(id) {
                checkSlot(id); await manager.ready;
                await context?.pending.catch(error => { if (context?.dirty) throw error; });
                const head = await repo.getBySlot(id);
                const loaded = head ? await repo.load(head.id) : null;
                if (!loaded && migrationErrors.has(id)) throw new Error(migrationErrors.get(id));
                activeId = id;
                try { raw.set('__cloudyActiveWorld', id); } catch { /* Optional preference. */ }
                context = { id: head?.id || crypto.randomUUID(), slot: id, revision: head?.revision || 0, recoveredFrom: loaded?.recoveredFrom,
                    data: loaded?.data || Object.create(null), generation: 0, dirty: false, batch: false, pending: Promise.resolve() };
                if (head) metadata.set(id, head);
                if (loaded?.recoveredFrom) status('recovered', new Error('The latest save was damaged. Loaded the previous verified revision.'));
                return loaded;
            },
            begin() {
                if (!context) throw new Error('No world is open.');
                context.beforeBatch = { data: context.data, dirty: context.dirty, generation: context.generation };
                context.data = { ...context.data }; context.batch = true;
            },
            rollback() {
                if (context?.beforeBatch) Object.assign(context, context.beforeBatch);
                if (context) { context.beforeBatch = null; context.batch = false; }
            },
            commit,
            flushSettings: () => settingsPending,
            async flush() { if (!context) return; if (context.dirty && !context.batch) return commit(); return context.pending; },
            async clearWorld(id = activeId) {
                checkSlot(id); await manager.ready;
                if (context?.slot === id) await context.pending.catch(() => {});
                const head = metadata.get(id) || await repo.getBySlot(id);
                if (head) await repo.delete(head.id, context?.slot === id ? context.revision : head.revision);
                else if (migrationErrors.has(id)) { for (const key of CloudyLegacySaves.read(raw, id).keys) raw.remove(key); }
                if (context?.slot === id) context = null;
                migrationErrors.delete(id); metadata.delete(id); total = await repo.count();
            },
            async clearAll() { await manager.ready; await context?.pending.catch(() => {}); await settingsPending.catch(() => {}); await repo.clearAll(); raw.clear(); context = null; metadata.clear(); migrationErrors.clear(); shared.clear(); total = 0; },
            invalidate() { if (repo && !refreshPromise) refreshPromise = refresh().catch(error => status('error', error)).finally(() => { refreshPromise = null; }); return refreshPromise; },
            async registerBaseMaps(maps) { await manager.ready; return repo.registerBaseMaps(clone(maps)); },
            async prepareExport() { await manager.ready; if (!context) await manager.activate(activeId); return clone(context.data); },
            async replace(data) {
                await manager.ready;
                const valid = CloudySaveCodec.validate(clone(data));
                if (!context) await manager.activate(activeId);
                const target = context;
                const before = { data: target.data, generation: target.generation, dirty: target.dirty };
                target.data = valid; target.generation++; target.dirty = true;
                const generation = target.generation;
                try { await commit(); } catch (error) {
                    if (target.generation === generation) Object.assign(target, before);
                    throw error;
                }
            },
            async download(id = activeId) {
                await manager.ready;
                const head = metadata.get(id) || await repo.getBySlot(id);
                const data = context?.slot === id && context.data.Day_curLvl_Dif ? clone(context.data) : (await repo.load(head.id)).data;
                const roots = { ...data }, levels = {};
                for (const [key, value] of Object.entries(roots)) if (value?.map) { levels[key] = value; delete roots[key]; }
                const payload = { format: 'cloudy-meadows-save', version: 2, exportedAt: new Date().toISOString(), data: { ...roots, levels } };
                const url = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' }));
                const link = document.createElement('a'); link.href = url; link.download = `cloudy-world-${id}.json`; link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            },
            storageInfo: async () => { await manager.ready; return repo.storageInfo(); },
            requestPersistence: async () => { await manager.ready; return repo.requestPersistence(); }
        });
        // Getters must remain live (Object.assign would evaluate them).
        Object.defineProperties(manager, {
            repository: { get: () => repo }, activeId: { get: () => activeId }, activeWorldId: { get: () => context?.id },
            count: { get: () => total }, initialized: { get: () => ready }, initializationError: { get: () => initializationError },
            hasUnsavedChanges: { get: () => !!context?.dirty }
        });
        manager.ready = initialize();
        manager.ready.catch(() => {});
        global.addEventListener?.('beforeunload', event => { if (context?.dirty) { event.preventDefault(); event.returnValue = ''; } });
        return manager;
    }
    global.CloudyWorldSaves = { create, SLOT_COUNT };
})(globalThis);
