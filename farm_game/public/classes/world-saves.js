(function (global) {
    'use strict';

    const SLOT_COUNT = 3;
    const ACTIVE_KEY = '__cloudyActiveWorld';
    const SLOT_PREFIX = '__cloudyWorld';
    const SHARED_KEYS = new Set(['Options', 'Controls', 'customRulePresets']);

    // Tiles repeat the same property names and strings thousands of times.
    // Store those once per record, keeping synchronous save/load inexpensive.
    function pack(value) {
        const plain = JSON.parse(JSON.stringify(value));
        const shapes = [], strings = [];
        const shapeIds = new Map(), stringIds = new Map();
        function encode(item) {
            if (typeof item === 'string') {
                if (!stringIds.has(item)) { stringIds.set(item, strings.length); strings.push(item); }
                return [-2, stringIds.get(item)];
            }
            if (Array.isArray(item)) return [-1, ...item.map(encode)];
            if (item !== null && typeof item === 'object') {
                const keys = Object.keys(item);
                const signature = JSON.stringify(keys);
                if (!shapeIds.has(signature)) { shapeIds.set(signature, shapes.length); shapes.push(keys); }
                return [shapeIds.get(signature), ...keys.map(key => encode(item[key]))];
            }
            return item;
        }
        const data = encode(plain);
        const packed = { $cloudyWorld: 1, shapes, strings, data };
        return JSON.stringify(packed).length < JSON.stringify(plain).length ? packed : plain;
    }

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

    function create(raw) {
        let activeId = raw.get(ACTIVE_KEY);
        if (!Number.isInteger(activeId) || activeId < 1 || activeId > SLOT_COUNT) activeId = 1;
        const summaries = new Map();

        function checkId(id) {
            if (!Number.isInteger(id) || id < 1 || id > SLOT_COUNT) throw new Error('Invalid world slot.');
        }

        // World 1 keeps the original keys, so existing saves need no destructive migration.
        function prefix(id) { return id === 1 ? '' : `${SLOT_PREFIX}${id}:`; }
        function storageKey(id, key) {
            if (typeof key !== 'string' || key === ACTIVE_KEY || key.startsWith(SLOT_PREFIX)) {
                throw new Error('Invalid world data key.');
            }
            return SHARED_KEYS.has(key) ? key : prefix(id) + key;
        }
        function read(id, key) {
            return unpack(raw.get(storageKey(id, key)));
        }
        function write(key, value) {
            if (raw.set(key, value) === false) throw new Error('Could not save this world. Check available browser storage.');
        }

        function worldKeys(id = activeId) {
            checkId(id);
            const keys = [];
            const storagePrefix = raw.showprefix();
            const count = raw.keys();
            for (let i = 0; i < count; i++) {
                const fullKey = raw.key(i);
                if (typeof fullKey !== 'string' || !fullKey.startsWith(storagePrefix)) continue;
                const key = fullKey.slice(storagePrefix.length);
                if (SHARED_KEYS.has(key) || key === ACTIVE_KEY) continue;
                if (id === 1) {
                    if (!key.startsWith(SLOT_PREFIX)) keys.push(key);
                } else if (key.startsWith(prefix(id))) keys.push(key.slice(prefix(id).length));
            }
            return keys;
        }

        function summary(id) {
            checkId(id);
            if (summaries.has(id)) return summaries.get(id);
            let result;
            try {
                const day = read(id, 'Day_curLvl_Dif');
                const player = read(id, 'player');
                const validDay = day && Number.isSafeInteger(day.days) && day.days >= 0 &&
                    [0, 1, 2, 3].includes(day.dificulty) &&
                    Number.isInteger(day.currentLevel_x) && day.currentLevel_x >= 0 &&
                    Number.isInteger(day.currentLevel_y) && day.currentLevel_y >= 0;
                const validPlayer = player == null || (Array.isArray(player.inv) && Array.isArray(player.quests) &&
                    Number.isFinite(player.pos?.x) && Number.isFinite(player.pos?.y));
                const valid = !!validDay && validPlayer;
                const info = read(id, '__worldInfo') || {};
                result = {
                    id, valid, occupied: worldKeys(id).length > 0,
                    name: `World ${id}`, difficulty: validDay ? day.dificulty : null,
                    days: validDay ? day.days : 0,
                    coins: Number.isFinite(player?.coins) ? player.coins : (day?.customRules?.startingCoins || 0),
                    weather: typeof day?.currentWeather === 'string' ? day.currentWeather : 'clear',
                    location: typeof info.location === 'string' ? info.location : '',
                    updatedAt: typeof info.updatedAt === 'string' ? info.updatedAt : null
                };
            } catch (error) {
                result = { id, name: `World ${id}`, valid: false, occupied: true };
            }
            summaries.set(id, Object.freeze(result));
            return result;
        }

        function clearWorld(id = activeId) {
            for (const key of worldKeys(id)) raw.remove(storageKey(id, key));
            summaries.delete(id);
        }

        // Make room for additional worlds when an older, uncompressed save exists.
        // Replace records individually only when the encoded version is smaller.
        function compact() {
            for (let id = 1; id <= SLOT_COUNT; id++) {
                for (const key of worldKeys(id)) {
                    const fullKey = storageKey(id, key);
                    const value = raw.get(fullKey);
                    if (!value || typeof value !== 'object' || value.$cloudyWorld === 1) continue;
                    const encoded = pack(value);
                    if (encoded.$cloudyWorld === 1) write(fullKey, encoded);
                }
            }
        }

        const store = {
            get: key => read(activeId, key),
            set(key, value) {
                const encoded = !SHARED_KEYS.has(key) && value !== null && typeof value === 'object'
                    ? pack(value) : value;
                write(storageKey(activeId, key), encoded);
                summaries.delete(activeId);
            },
            remove(key) {
                raw.remove(storageKey(activeId, key));
                summaries.delete(activeId);
            },
            clear: () => clearWorld(),
            worldKeys
        };

        return {
            store, summary, clearWorld, compact,
            list: () => [1, 2, 3].map(summary),
            get activeId() { return activeId; },
            activate(id) {
                checkId(id);
                write(ACTIVE_KEY, id);
                activeId = id;
            },
            invalidate: () => summaries.clear(),
            clearAll() {
                raw.clear();
                activeId = 1;
                summaries.clear();
            }
        };
    }

    global.CloudyWorldSaves = { create, SLOT_COUNT };
})(window);
