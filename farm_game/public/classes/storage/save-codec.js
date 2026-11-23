(function (global) {
    'use strict';
    const FORMAT = 1;
    const MAX_RECORD_BYTES = 32 * 1024 * 1024;
    const WEATHER_KEYS = ['currentWeather', 'weatherLog', 'lastRainDay', 'lastFrogRainDay', 'heatwaveStartDay', 'heatwaveEndDay'];
    const SHARED_KEYS = ['Options', 'Controls', 'customRulePresets', 'Achievements'];
    const WORLD_ROOT_KEYS = ['player', 'Day_curLvl_Dif', 'extralvlStuff', '__worldInfo', 'BridgeTutorialSeen'];
    const clone = value => JSON.parse(JSON.stringify(value));
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    function canonical(value) {
        if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
        if (object(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
        return JSON.stringify(value);
    }
    async function hash(bytes) {
        return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
    }
    function diff(base, value) {
        if (base === value) return null;
        if ((object(base) && object(value)) || (Array.isArray(base) && Array.isArray(value))) {
            const entries = [];
            for (const key of Object.keys(value)) {
                const patch = Object.hasOwn(base, key) ? diff(base[key], value[key]) : { value: value[key] };
                if (patch) entries.push([key, patch]);
            }
            const remove = Object.keys(base).filter(key => !Object.hasOwn(value, key));
            if (!entries.length && !remove.length && (!Array.isArray(value) || base.length === value.length)) return null;
            return { entries, remove, length: Array.isArray(value) ? value.length : null };
        }
        return { value };
    }
    function apply(base, patch) {
        if (!patch) return clone(base);
        if (Object.hasOwn(patch, 'value')) return clone(patch.value);
        const result = clone(base);
        for (const key of patch.remove) delete result[key];
        for (const [key, change] of patch.entries) {
            Object.defineProperty(result, key, { value: apply(Object.hasOwn(result, key) ? result[key] : null, change), enumerable: true, writable: true, configurable: true });
        }
        if (patch.length !== null) result.length = patch.length;
        return result;
    }
    async function encode(value, base = null, previousHash = null) {
        const text = canonical(value);
        const bytes = new TextEncoder().encode(text);
        if (bytes.length > MAX_RECORD_BYTES) throw new Error('A save record is too large. Export this world before expanding it further.');
        const checksum = await hash(bytes);
        if (checksum === previousHash) return { unchanged: true, hash: checksum };
        let payload = { format: FORMAT, value };
        if (base) {
            const delta = { format: FORMAT, base: base.id, patch: diff(base.value, value) };
            if (canonical(delta).length < text.length) payload = delta;
        }
        let data = new TextEncoder().encode(canonical(payload));
        let encoding = 'json';
        if (data.length >= 4096 && typeof CompressionStream === 'function') {
            const compressed = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
            if (compressed.length < data.length) { data = compressed; encoding = 'gzip'; }
        }
        return { format: FORMAT, encoding, data, hash: checksum, bytes: data.length, logicalBytes: bytes.length, baseId: payload.base || null };
    }
    async function payload(record) {
        if (!record || record.format !== FORMAT || !['json', 'gzip'].includes(record.encoding)) throw new Error('Unsupported save record format.');
        let stream = new Blob([record.data]).stream();
        if (record.encoding === 'gzip') stream = stream.pipeThrough(new DecompressionStream('gzip'));
        const reader = stream.getReader(), parts = [];
        let length = 0;
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            length += value.byteLength;
            if (length > MAX_RECORD_BYTES * 2) { await reader.cancel(); throw new Error('Save record exceeds its size limit.'); }
            parts.push(value);
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const part of parts) { bytes.set(part, offset); offset += part.length; }
        const result = JSON.parse(new TextDecoder().decode(bytes));
        if (result.format !== FORMAT) throw new Error('Unsupported save payload version.');
        return result;
    }
    async function decode(record, base = null) {
        const packed = await payload(record);
        if (packed.base && !base) throw new Error('A required base map is missing.');
        const value = packed.base ? apply(base, packed.patch) : packed.value;
        if (await hash(new TextEncoder().encode(canonical(value))) !== record.hash) throw new Error('Save checksum does not match.');
        return value;
    }
    function validate(data) {
        if (!object(data)) throw new Error('Invalid world data.');
        const day = data.Day_curLvl_Dif, player = data.player;
        if (!object(day) || !Number.isSafeInteger(day.days) || day.days < 0 || ![0, 1, 2, 3].includes(day.dificulty) ||
            !Number.isSafeInteger(day.currentLevel_x) || day.currentLevel_x < 0 || !Number.isSafeInteger(day.currentLevel_y) || day.currentLevel_y < 0) throw new Error('Invalid world calendar or location.');
        if (player != null && (!object(player) || !Array.isArray(player.inv) || !Array.isArray(player.quests) || !Number.isFinite(player.pos?.x) || !Number.isFinite(player.pos?.y) || !Number.isFinite(player.coins))) throw new Error('Invalid saved player.');
        if (day.weatherLog != null && (!Array.isArray(day.weatherLog) || day.weatherLog.some(entry => !object(entry) || !Number.isSafeInteger(entry.day) || entry.day < 0 || typeof entry.weather !== 'string'))) throw new Error('Invalid weather history.');
        if (Object.hasOwn(data, 'BridgeTutorialSeen') && typeof data.BridgeTutorialSeen !== 'boolean') throw new Error('Invalid bridge tutorial progress.');
        for (const [key, value] of Object.entries(data)) {
            if (SHARED_KEYS.includes(key) || key.startsWith('__cloudy') || ['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Invalid world data key.');
            if (WORLD_ROOT_KEYS.includes(key)) continue;
            if (!object(value) || value.name !== key || !Array.isArray(value.map) || !value.map.length || value.map.some(row => !Array.isArray(row) || row.length !== value.map[0].length)) throw new Error('Invalid map: ' + key);
            if (value.fore != null && (!Array.isArray(value.fore) || value.fore.some(row => !Array.isArray(row)))) throw new Error('Invalid foreground: ' + key);
        }
        return data;
    }
    function split(data) {
        validate(data);
        const records = Object.create(null);
        for (const [key, value] of Object.entries(data)) {
            if (key === 'player') {
                const { quests, ...player } = value;
                records.player = player; records.quests = quests;
            } else if (key === 'Day_curLvl_Dif') {
                const day = { ...value }, weather = {};
                for (const name of WEATHER_KEYS) { if (Object.hasOwn(day, name)) weather[name] = day[name]; delete day[name]; }
                records.day = day; records.weather = weather;
            } else records['data:' + key] = value;
        }
        return records;
    }
    function validateImport(data) {
        validate(data);
        const inventory = value => Array.isArray(value) && value.every(entry => Array.isArray(entry) ? inventory(entry) : item(entry));
        const item = value => value == null || value === 0 || (object(value) && typeof value.name === 'string' && Number.isFinite(value.amount) && value.amount >= 0 &&
            (value.inv == null || inventory(value.inv)));
        const player = data.player;
        if (player) {
            if (!player.inv.every(item)) throw new Error('Invalid imported inventory.');
            for (const quest of player.quests) {
                if (!object(quest) || typeof quest.og_name !== 'string' || !Array.isArray(quest.goals) || !Number.isFinite(quest.days) ||
                    !(quest.reward_item === 0 || (object(quest.reward_item) && item(quest.reward_item))) ||
                    quest.goals.some(goal => !object(goal) || typeof goal.class !== 'string')) throw new Error('Invalid imported quest.');
            }
        }
        for (const [key, value] of Object.entries(data)) {
            if (!value?.map) continue;
            if (key.startsWith('Extra y:') && !Array.isArray(value.fore)) throw new Error('Generated area is missing its foreground.');
            for (const row of value.map) for (const tile of row) {
                if (tile == null || tile === 0) continue;
                if (!object(tile) || typeof tile.name !== 'string' ||
                    (tile.pos != null && (!Number.isFinite(tile.pos.x) || !Number.isFinite(tile.pos.y))) ||
                    (tile.inv != null && !inventory(tile.inv))) throw new Error('Invalid imported tile in ' + key);
            }
        }
        return data;
    }
    function join(records) {
        const data = Object.create(null);
        for (const [key, value] of Object.entries(records)) {
            if (key.startsWith('data:')) data[key.slice(5)] = value;
        }
        data.Day_curLvl_Dif = { ...records.day, ...records.weather };
        if (records.player) data.player = { ...records.player, quests: records.quests || [] };
        return validate(data);
    }
    function summary(data, slot) {
        const day = data.Day_curLvl_Dif, info = data.__worldInfo || {};
        return { id: slot, name: `World ${slot}`, valid: true, occupied: true, difficulty: day.dificulty,
            days: day.days, coins: data.player?.coins ?? day.customRules?.startingCoins ?? 0,
            weather: day.currentWeather || 'clear', location: info.location || '', updatedAt: new Date().toISOString() };
    }
    async function batch(method, entries) {
        const results = [];
        for (let i = 0; i < entries.length; i += 4) results.push(...await Promise.all(entries.slice(i, i + 4).map(args => method(...args))));
        return results;
    }
    const encodeRecords = entries => batch(encode, entries);
    const decodeRecords = entries => batch(decode, entries);
    global.CloudySaveCodec = { encodeRecords, decodeRecords, FORMAT, SHARED_KEYS, WORLD_ROOT_KEYS, MAX_RECORD_BYTES, clone, canonical, hash, diff, apply, encode, decode, validate, validateImport, split, join, summary };
})(globalThis);
