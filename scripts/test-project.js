const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'farm_game/public');
let failures = 0;

function walk(directory, predicate = () => true) {
    const results = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.vscode' || entry.name === '.vs') continue;
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) results.push(...walk(fullPath, predicate));
        else if (predicate(fullPath)) results.push(fullPath);
    }
    return results;
}

function relative(file) {
    return path.relative(root, file).split(path.sep).join('/');
}

function check(name, callback) {
    try {
        callback();
        console.log(`PASS ${name}`);
    } catch (error) {
        failures += 1;
        console.error(`FAIL ${name}`);
        console.error(error.stack || error.message || error);
    }
}

function loadDefinitions(file, globalName, exportedName) {
    const context = {};
    const source = fs.readFileSync(file, 'utf8');
    vm.runInNewContext(`${source}\nglobalThis.${exportedName} = ${globalName};`, context, { filename: file });
    return context[exportedName];
}

function localReferenceExists(reference, fromDirectory = publicDir) {
    const clean = reference.split(/[?#]/)[0];
    if (!clean || /^(?:https?:|data:|#)/.test(clean)) return true;
    return fs.existsSync(path.resolve(fromDirectory, clean));
}

function extractArray(source, offset) {
    const start = source.indexOf('[', offset);
    assert.notEqual(start, -1, 'Expected an array literal');
    let depth = 0;
    let quote = null;
    let escaped = false;
    for (let index = start; index < source.length; index++) {
        const char = source[index];
        if (quote) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === quote) quote = null;
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }
        if (char === '[') depth += 1;
        else if (char === ']') {
            depth -= 1;
            if (depth === 0) {
                const literal = source.slice(start, index + 1);
                const value = vm.runInNewContext(`(${literal})`, { kiahTileNum: 122 });
                return { value: JSON.parse(JSON.stringify(value)), end: index + 1 };
            }
        }
    }
    throw new Error('Unterminated array literal');
}

const tiles = loadDefinitions(path.join(publicDir, 'config/tiles.js'), 'TILE_DEFINITIONS', 'tiles');
const items = loadDefinitions(path.join(publicDir, 'config/items.js'), 'ITEM_DEFINITIONS', 'items');

check('JavaScript syntax', () => {
    const errors = [];
    for (const file of walk(root, candidate => candidate.endsWith('.js'))) {
        const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
        if (result.status !== 0) errors.push(`${relative(file)}\n${result.stderr.trim()}`);
    }
    assert.deepEqual(errors, []);
});

check('JSON files parse', () => {
    for (const file of walk(root, candidate => candidate.endsWith('.json'))) JSON.parse(fs.readFileSync(file, 'utf8'));
});

check('tile registry is contiguous and supported', () => {
    const supportedClasses = new Set([
        'Tile', 'Shop', 'Plant', 'Entity', 'FreeMoveEntity', 'MovableEntity',
        'GridMoveEntity', 'NPC', 'Chest', 'Robot', 'AirBallon',
        'LightMoveEntity', 'PayToMoveEntity', 'FarmRobot'
    ]);
    assert.ok(tiles.length > 0);
    tiles.forEach((tile, index) => {
        assert.ok(tile && typeof tile === 'object', `tile ID ${index + 1} is empty`);
        assert.ok(tile.name, `tile ID ${index + 1} has no name`);
        assert.ok(supportedClasses.has(tile.class), `tile ID ${index + 1} has unsupported class ${tile.class}`);
    });
    assert.equal(tiles[104].name, 'Thomas');
    assert.equal(tiles[122].name, 'Scientist');
    assert.equal(tiles[123].name, 'HarvestBot');
    assert.equal(tiles[124].name, 'WaterBot');
});

check('item registry references valid items and tiles', () => {
    assert.equal(items[0], 0);
    items.slice(1).forEach((item, index) => {
        const id = index + 1;
        assert.ok(item && item.name && item.class, `item ID ${id} is malformed`);
        if (item.tile_num !== undefined) assert.ok(tiles[item.tile_num - 1], `item ${item.name} uses invalid tile ${item.tile_num}`);
        if (item.plant_num !== undefined) assert.ok(tiles[item.plant_num - 1], `item ${item.name} uses invalid plant ${item.plant_num}`);
        if (item.seed_num !== undefined && item.seed_num !== 0) assert.ok(items[item.seed_num], `item ${item.name} uses invalid seed ${item.seed_num}`);
    });
    tiles.forEach(tile => {
        if (tile.eat_num) assert.ok(items[tile.eat_num], `tile ${tile.name} uses invalid harvest item ${tile.eat_num}`);
        for (const slot of tile.inv || []) {
            if (slot && slot.num) assert.ok(items[slot.num], `tile ${tile.name} inventory uses invalid item ${slot.num}`);
        }
    });
});

check('all shipped world maps reference valid tile IDs', () => {
    const source = fs.readFileSync(path.join(publicDir, 'preload.js'), 'utf8');
    const pattern = /new Level\s*\(\s*(['"])(.*?)\1\s*,/g;
    let match;
    let count = 0;
    while ((match = pattern.exec(source))) {
        const map = extractArray(source, pattern.lastIndex);
        const foreground = extractArray(source, map.end);
        map.value.forEach((row, rowIndex) => {
            assert.equal(row.length, map.value[0].length, `${match[2]} map row ${rowIndex} width differs`);
            row.forEach((id, columnIndex) => {
                assert.ok(Number.isInteger(id) && id >= 0, `${match[2]} has invalid tile at ${columnIndex},${rowIndex}`);
                if (id > 0) assert.ok(tiles[id - 1], `${match[2]} uses undefined tile ${id} at ${columnIndex},${rowIndex}`);
            });
        });
        foreground.value.forEach((row, rowIndex) => {
            assert.equal(row.length, foreground.value[0].length, `${match[2]} foreground row ${rowIndex} width differs`);
            row.forEach((id, columnIndex) => {
                assert.ok(Number.isInteger(id) && id >= 0 && id <= 6,
                    `${match[2]} has invalid foreground ${id} at ${columnIndex},${rowIndex}`);
            });
        });
        pattern.lastIndex = foreground.end;
        count += 1;
    }
    assert.ok(count >= 40, `Expected at least 40 level definitions, found ${count}`);
});

check('HTML local scripts and linked files exist', () => {
    const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
    const refs = [
        ...[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]),
        ...[...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map(match => match[1])
    ];
    assert.deepEqual(refs.filter(ref => !localReferenceExists(ref)).sort(), []);
});

check('service-worker shell matches local app scripts', () => {
    const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
    const worker = fs.readFileSync(path.join(publicDir, 'sw.js'), 'utf8');
    const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
        .map(match => match[1])
        .filter(ref => !/^https?:/.test(ref) && ref !== 'localDataStorage-3.0.0.min.js');
    for (const script of scripts) assert.ok(worker.includes(`'./${script}'`), `${script} is missing from APP_SHELL`);
    for (const [, ref] of worker.matchAll(/'\.\/([^']+)'/g)) {
        assert.ok(localReferenceExists(ref), `APP_SHELL entry does not exist: ${ref}`);
    }
});

check('literal preload assets exist', () => {
    const source = fs.readFileSync(path.join(publicDir, 'preload.js'), 'utf8');
    const references = new Set();
    for (const match of source.matchAll(/(?:loadImage|loadFont|loadJSON)\(\s*["']([^"']+)["']/g)) references.add(match[1]);
    for (const match of source.matchAll(/["']((?:audio|images)\/[^"']+\.(?:wav|mp3|png|gif))["']/gi)) references.add(match[1]);
    assert.deepEqual([...references].filter(ref => !localReferenceExists(ref)).sort(), []);
});

check('dialogue data is valid and non-empty', () => {
    const dialogue = JSON.parse(fs.readFileSync(path.join(publicDir, 'dialouge_list.json'), 'utf8'));
    assert.ok(dialogue && typeof dialogue === 'object');
    assert.ok(JSON.stringify(dialogue).length > 1000, 'dialogue data is unexpectedly empty');
});

// Behavioral suites (automation, consumables, plant, chest, level, ...) run
// under the node:test runner via `npm test`; this script only owns the static
// asset/registry validation above.

if (failures > 0) {
    console.error(`\n${failures} project test${failures === 1 ? '' : 's'} failed.`);
    process.exit(1);
}

console.log('\nAll project tests passed.');
