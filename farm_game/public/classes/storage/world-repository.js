(function (global) {
    'use strict';
    const SCHEMA = 1;
    const STORES = ['worlds', 'snapshots', 'records', 'bases', 'settings', 'migrations'];
    const codec = () => global.CloudySaveCodec;
    const request = req => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    function complete(tx) {
        return new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onabort = () => reject(tx.failure || tx.error || new DOMException('Save interrupted; the previous save is unchanged.', 'AbortError'));
            tx.onerror = () => {}; // Abort is the authoritative outcome, not an individual request's success.
        });
    }
    function conflict() { return new DOMException('This world changed in another tab. Reload it before saving again. Your unsaved world can still be downloaded.', 'ConflictError'); }
    class CodecWorker {
        constructor(url) {
            this.jobs = new Map(); this.next = 0;
            this.worker = new Worker(url);
            this.worker.onmessage = ({ data }) => {
                const job = this.jobs.get(data.id);
                if (!job) return;
                this.jobs.delete(data.id);
                if (data.error) job.reject(Object.assign(new Error(data.error.message), { name: data.error.name }));
                else job.resolve(data.result);
            };
            this.worker.onerror = event => this.close(new Error(event.message || 'Save worker stopped.'));
        }
        run(method, ...args) {
            return new Promise((resolve, reject) => {
                if (!this.worker) return reject(new Error('Save worker is unavailable. Reload before saving.'));
                const id = ++this.next;
                this.jobs.set(id, { resolve, reject });
                try { this.worker.postMessage({ id, method, args }); }
                catch (error) { this.jobs.delete(id); reject(error); }
            });
        }
        close(error = new Error('Save storage closed.')) {
            this.worker?.terminate(); this.worker = null;
            for (const job of this.jobs.values()) job.reject(error);
            this.jobs.clear();
        }
    }
    class Repository {
        constructor(db, options) {
            this.db = db;
            this.options = options;
            this.storage = options.storage || global.navigator?.storage;
            this.worker = options.worker || new CodecWorker(options.workerURL || new URL('save-worker.js?v=2', options.scriptURL));
            this.baseMaps = new Map();
            this.pendingBases = new Map();
            this.metrics = { recordReads: 0, recordWrites: 0, summaryReads: 0, encodedBytes: 0 };
            this.channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(db.name) : null;
            this.channel?.addEventListener('message', event => this.onchange?.(event.data));
            db.onversionchange = () => { this.close(); this.onchange?.({ type: 'upgrade' }); };
        }
        close() { this.worker.close(); this.channel?.close(); this.db.close(); }
        async get(store, key) { return request(this.db.transaction(store).objectStore(store).get(key)); }
        async getBySlot(slot) { return request(this.db.transaction('worlds').objectStore('worlds').index('slot').get(slot)); }
        async setSetting(key, value) {
            const tx = this.db.transaction('settings', 'readwrite'), done = complete(tx);
            tx.objectStore('settings').put({ key, value }); await done;
        }
        async settings() { return request(this.db.transaction('settings').objectStore('settings').getAll()); }
        async count() { return request(this.db.transaction('worlds').objectStore('worlds').count()); }
        async list({ after = 0, limit = 20 } = {}) {
            if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid world page size.');
            const store = this.db.transaction('worlds').objectStore('worlds').index('slot');
            const found = await request(store.getAll(IDBKeyRange.lowerBound(after, true), limit + 1));
            this.metrics.summaryReads += found.length;
            const items = found.slice(0, limit);
            return { items, next: found.length > limit ? items.at(-1).slot : null };
        }
        async registerBaseMaps(maps) {
            for (const [name, value] of Object.entries(maps)) {
                const record = await this.worker.run('encode', value);
                const id = 'base-v1:' + record.hash;
                this.baseMaps.set(name, { id, value });
                if (!await this.get('bases', id)) this.pendingBases.set(id, { ...record, id });
            }
        }
        async storageInfo() {
            try {
                const estimate = await this.storage?.estimate?.();
                return { usage: estimate?.usage ?? null, quota: estimate?.quota ?? null, persistent: await this.storage?.persisted?.() || false };
            } catch { return { usage: null, quota: null, persistent: false }; }
        }
        async requestPersistence() { try { return await this.storage?.persist?.() || false; } catch { return false; } }
        async reserve(bytes) {
            const { usage, quota } = await this.storageInfo();
            const reserve = Math.max(this.options.reserveBytes ?? 1024 * 1024, bytes);
            if (quota !== null && usage !== null && usage + bytes + reserve > quota) {
                throw new DOMException('Not enough space to safely save and keep recovery data. Download a backup or free space; your previous save is unchanged.', 'QuotaExceededError');
            }
        }
        async readSnapshot(id, revision) {
            const snapshot = await this.get('snapshots', [id, revision]);
            if (!snapshot || snapshot.schema !== SCHEMA) throw new Error('Missing or unsupported save revision.');
            const entries = Object.entries(snapshot.refs);
            const tx = this.db.transaction(['records', 'bases']);
            const records = await Promise.all(entries.map(([key, ref]) => request(tx.objectStore('records').get([id, key, ref.revision]))));
            this.metrics.recordReads += records.length;
            const baseIds = [...new Set(records.filter(Boolean).map(record => record.baseId).filter(Boolean))];
            const baseRecords = new Map(await Promise.all(baseIds.map(async key => [key, await this.get('bases', key)])));
            const bases = new Map();
            for (const [key, record] of baseRecords) bases.set(key, await this.worker.run('decode', record));
            const decoded = Object.create(null);
            for (let i = 0; i < entries.length; i++) {
                if (!records[i] || records[i].hash !== entries[i][1].hash) throw new Error('A saved record is missing or damaged.');
            }
            const values = await this.worker.run('decodeRecords', records.map(record => [record, bases.get(record.baseId)]));
            for (let i = 0; i < entries.length; i++) decoded[entries[i][0]] = values[i];
            return { snapshot, data: codec().join(decoded) };
        }
        async load(id, { recover = true } = {}) {
            for (let attempt = 0; attempt < 3; attempt++) {
                const head = await this.get('worlds', id);
                if (!head) throw new Error('This world no longer exists.');
                if (head.schema !== SCHEMA) throw new Error('This world needs a newer game version.');
                try { return { head, ...await this.readSnapshot(id, head.revision), recoveredFrom: null }; }
                catch (error) {
                    // A fast writer may have retired this revision between reads.
                    if ((await this.get('worlds', id))?.revision !== head.revision) continue;
                    if (!recover || !head.previousRevision) throw error;
                    return { head, ...await this.readSnapshot(id, head.previousRevision), recoveredFrom: head.previousRevision };
                }
            }
            throw conflict();
        }
        async save(id, data, { expectedRevision = 0, slot, signal, preserveRevision } = {}) {
            if (typeof id !== 'string' || !id || !Number.isSafeInteger(slot) || slot < 1) throw new Error('Invalid world identity.');
            if (signal?.aborted) throw new DOMException('Save cancelled.', 'AbortError');
            // Everything asynchronous (including compression) happens before the write transaction.
            const records = codec().split(data);
            const oldHead = await this.get('worlds', id);
            if ((oldHead?.revision || 0) !== expectedRevision) throw conflict();
            if (oldHead && oldHead.schema !== SCHEMA) throw new Error('This world needs a newer game version.');
            const old = expectedRevision ? await this.get('snapshots', [id, preserveRevision || expectedRevision]) : null;
            if (preserveRevision && preserveRevision !== oldHead?.previousRevision) throw new Error('Invalid recovery revision.');
            const revision = expectedRevision + 1, refs = {}, changes = [];
            const neededBases = new Map();
            const recordEntries = Object.entries(records);
            const encodedRecords = await this.worker.run('encodeRecords', recordEntries.map(([key, value]) =>
                [value, key.startsWith('data:') ? this.baseMaps.get(key.slice(5)) : null, old?.refs[key]?.hash]));
            for (let i = 0; i < recordEntries.length; i++) {
                const [key] = recordEntries[i], encoded = encodedRecords[i];
                if (encoded.unchanged) refs[key] = old.refs[key];
                else {
                    refs[key] = { revision, hash: encoded.hash, bytes: encoded.bytes, logicalBytes: encoded.logicalBytes };
                    changes.push({ ...encoded, worldId: id, key, revision });
                    if (encoded.baseId && this.pendingBases.has(encoded.baseId)) neededBases.set(encoded.baseId, this.pendingBases.get(encoded.baseId));
                }
            }
            const bytes = changes.reduce((sum, value) => sum + value.bytes, 0) + [...neededBases.values()].reduce((sum, value) => sum + value.bytes, 0) + 8192;
            await this.reserve(bytes);
            if (signal?.aborted) throw new DOMException('Save cancelled.', 'AbortError');
            const summary = codec().summary(data, slot);
            const head = { id, slot, schema: SCHEMA, revision, previousRevision: old?.revision || null, summary,
                bytes: Object.values(refs).reduce((sum, ref) => sum + ref.bytes, 0), logicalBytes: Object.values(refs).reduce((sum, ref) => sum + ref.logicalBytes, 0) };
            const tx = this.db.transaction(['worlds', 'snapshots', 'records', 'bases'], 'readwrite', { durability: 'strict' });
            const done = complete(tx);
            const abort = () => { try { tx.abort(); } catch { /* already complete */ } };
            signal?.addEventListener('abort', abort, { once: true });
            const check = tx.objectStore('worlds').get(id);
            check.onsuccess = () => {
                try {
                    if ((check.result?.revision || 0) !== expectedRevision) throw conflict();
                    for (const base of neededBases.values()) tx.objectStore('bases').put(base);
                    for (const record of changes) tx.objectStore('records').put(record);
                    tx.objectStore('snapshots').put({ worldId: id, revision, schema: SCHEMA, refs, summary });
                    tx.objectStore('worlds').put(head);
                    const keep = new Set([...Object.entries(refs), ...Object.entries(old?.refs || {})].map(([key, ref]) => JSON.stringify([key, ref.revision])));
                    const cursor = tx.objectStore('records').index('world').openCursor(IDBKeyRange.only(id));
                    cursor.onsuccess = () => {
                        const item = cursor.result;
                        if (!item) return;
                        if (!keep.has(JSON.stringify([item.value.key, item.value.revision]))) item.delete();
                        item.continue();
                    };
                    const snapshots = tx.objectStore('snapshots').index('world').openCursor(IDBKeyRange.only(id));
                    snapshots.onsuccess = () => {
                        const item = snapshots.result;
                        if (!item) return;
                        if (![revision, old?.revision].includes(item.value.revision)) item.delete();
                        item.continue();
                    };
                    // Injectable platform fault used by browser tests to abort real IDB transactions.
                    this.options.transactionHook?.(tx, { id, revision, changes });
                } catch (error) { tx.failure = error; abort(); }
            };
            try { await done; } finally { signal?.removeEventListener('abort', abort); }
            this.metrics.recordWrites += changes.length;
            this.metrics.encodedBytes += bytes;
            for (const key of neededBases.keys()) this.pendingBases.delete(key);
            this.channel?.postMessage({ type: 'saved', id, slot, revision });
            return head;
        }
        async delete(id, expectedRevision) {
            const tx = this.db.transaction(['worlds', 'snapshots', 'records'], 'readwrite'), done = complete(tx);
            const check = tx.objectStore('worlds').get(id);
            check.onsuccess = () => {
                if (!check.result || check.result.revision !== expectedRevision) { tx.failure = conflict(); tx.abort(); return; }
                tx.objectStore('worlds').delete(id);
                for (const name of ['snapshots', 'records']) {
                    const req = tx.objectStore(name).index('world').openCursor(IDBKeyRange.only(id));
                    req.onsuccess = () => { const item = req.result; if (item) { item.delete(); item.continue(); } };
                }
            };
            await done;
            this.channel?.postMessage({ type: 'deleted', id });
        }
        async clearAll() {
            const tx = this.db.transaction(STORES, 'readwrite'), done = complete(tx);
            for (const name of STORES) tx.objectStore(name).clear();
            await done;
            this.channel?.postMessage({ type: 'cleared' });
        }
        async receipt(key, value) {
            const tx = this.db.transaction('migrations', 'readwrite'), done = complete(tx);
            tx.objectStore('migrations').put({ key, ...value }); await done;
        }
    }
    const scriptURL = typeof document !== 'undefined' ? document.currentScript?.src : '';
    async function open(options = {}) {
        const opening = indexedDB.open(options.name || 'cloudy-meadows-worlds', SCHEMA);
        opening.onupgradeneeded = () => {
            const db = opening.result;
            db.createObjectStore('worlds', { keyPath: 'id' }).createIndex('slot', 'slot', { unique: true });
            db.createObjectStore('snapshots', { keyPath: ['worldId', 'revision'] }).createIndex('world', 'worldId');
            db.createObjectStore('records', { keyPath: ['worldId', 'key', 'revision'] }).createIndex('world', 'worldId');
            db.createObjectStore('bases', { keyPath: 'id' });
            db.createObjectStore('settings', { keyPath: 'key' });
            db.createObjectStore('migrations', { keyPath: 'key' });
        };
        opening.onblocked = () => options.onblocked?.();
        return new Repository(await request(opening), { scriptURL, ...options });
    }
    global.CloudyWorldRepository = { open, SCHEMA, CodecWorker };
})(globalThis);
