(function (global) {
    'use strict';
    function unpack(value) {
        if (!value || value.$cloudyWorld !== 1) return value;
        function decode(item) {
            if (!Array.isArray(item)) return item;
            if (item[0] === -2) return value.strings[item[1]];
            if (item[0] === -1) return item.slice(1).map(decode);
            return Object.fromEntries(value.shapes[item[0]].map((key, i) => [key, decode(item[i + 1])]));
        }
        return decode(value.data);
    }
    function read(raw, slot) {
        const prefix = slot === 1 ? '' : `__cloudyWorld${slot}:`, data = Object.create(null), keys = [];
        for (let i = 0; i < raw.keys(); i++) {
            const full = raw.key(i);
            if (!full?.startsWith(raw.showprefix())) continue;
            const key = full.slice(raw.showprefix().length);
            if (CloudySaveCodec.SHARED_KEYS.includes(key) || key === '__cloudyActiveWorld') continue;
            if (slot === 1 ? key.startsWith('__cloudy') : !key.startsWith(prefix)) continue;
            keys.push(key);
            data[key.slice(prefix.length)] = unpack(raw.get(key));
        }
        return { data, keys };
    }
    async function migrate(repo, raw) {
        const errors = new Map();
        for (const key of CloudySaveCodec.SHARED_KEYS) {
            if (!await repo.get('settings', key) && raw.get(key) != null) await repo.setSetting(key, raw.get(key));
        }
        for (let slot = 1; slot <= 3; slot++) {
            try {
                const { data, keys } = read(raw, slot);
                if (!keys.length) continue;
                CloudySaveCodec.validate(data);
                const fingerprint = await CloudySaveCodec.hash(new TextEncoder().encode(CloudySaveCodec.canonical(data)));
                const key = 'local-storage-v1:' + slot;
                const receipt = await repo.get('migrations', key);
                const id = 'legacy-v1-world-' + slot;
                let head = await repo.getBySlot(slot);
                if (receipt && receipt.fingerprint !== fingerprint) throw new Error('The old save changed after migration. Export it before replacing this world.');
                if (!receipt) {
                    if (head && head.id !== id) throw new Error('An existing world already occupies this slot. The original save has been kept.');
                    if (!head) {
                        try { head = await repo.save(id, data, { slot, expectedRevision: 0 }); }
                        catch (error) {
                            // Another tab can finish the same deterministic migration first.
                            head = await repo.getBySlot(slot);
                            if (head?.id !== id) throw error;
                        }
                    }
                    const loaded = await repo.load(id, { recover: false });
                    if (CloudySaveCodec.canonical(loaded.data) !== CloudySaveCodec.canonical(data)) throw new Error('Migration verification failed. The original save has been kept.');
                    await repo.receipt(key, { fingerprint, id, verifiedRevision: loaded.head.revision });
                } else if (!head || head.id !== receipt.id) throw new Error('The migrated world is missing. The original save has been kept.');
                // Re-read before cleanup so a legacy tab cannot silently race the copy.
                if (CloudySaveCodec.canonical(read(raw, slot).data) !== CloudySaveCodec.canonical(data)) throw new Error('The old save changed during migration. Its data has been kept.');
                for (const name of keys) raw.remove(name);
            } catch (error) { errors.set(slot, error.message); }
        }
        return errors;
    }
    global.CloudyLegacySaves = { read, unpack, migrate };
})(globalThis);
