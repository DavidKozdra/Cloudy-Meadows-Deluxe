const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/autofarm/game.js'), 'utf8');
const context = {
    navigator: { userAgent: 'test' },
    localDataStorage() { return { get() { return null; }, set() {} }; },
    window: {},
    document: {},
    localStorage: {}
};
vm.runInNewContext(source + '\nglobalThis.testGenerateMap=generateAutoMap;globalThis.testHash=autoHash;', context);

test('separate AutoFarm world generation is deterministic with open room edges', () => {
    const first = context.testGenerateMap(14, -8);
    const second = context.testGenerateMap(14, -8);
    assert.deepEqual(first, second);
    assert.equal(first.length, 19);
    assert.ok(first.every(row => row.length === 23));
    assert.ok(first[0].every(tile => tile === 2));
    assert.ok(first[18].every(tile => tile === 2));
    assert.ok(first.every(row => row[0] === 2 && row[22] === 2));
});

test('AutoFarm spawn reserves a clear construction area', () => {
    const map = context.testGenerateMap(0, 0);
    for (let row = 2; row < 15; row++) {
        for (let column = 2; column < 13; column++) assert.equal(map[row][column], 2);
    }
});

test('AutoFarm keeps merchant buying and sales carts as separate interactions', () => {
    assert.match(source, /aheadTile\.class === 'Shop'\) return openAutoShop/);
    assert.match(source, /aheadTile\.name === 'cart_s'\) return openAutoCart/);
    assert.match(source, /function openAutoCart\(/);
    assert.match(source, /shop\.updateItemStock\(item\.name,item\.amount-1\)/);
});

test('AutoFarm joins with a named presence and uses the room socket for chat', () => {
    assert.match(source, /bindAutoMultiplayerClient\(\)/);
    assert.match(source, /type:'presence'.*name:autoPlayerName/);
    assert.match(source, /sendAutoMessage\(\{type:'chat',text:message\}\)/);
    assert.match(source, /function renderAutoNameTags\(/);
    assert.match(source, /message\.type==='server'/);
});

test('AutoFarm uses shared weather and the original chest renderer', () => {
    assert.match(source, /CloudyWeather\.render\(\)/);
    assert.match(source, /CloudyWeather\.roll\(/);
    assert.match(source, /player\.talking\.chest_render\(\)/);
    assert.match(source, /function swapAutoCursor\(/);
});

test('AutoFarm can save, intentionally disconnect, and rejoin with its identity', () => {
    assert.match(source, /Save & Disconnect/);
    assert.match(source, /function disconnectAutoFarm\(/);
    assert.match(source, /socket\.autoIntentionalClose=true/);
    assert.match(source, /localStorage\.getItem\('autofarm-player-id'\)/);
});

test('AutoFarm reuses backpacks, inventory warnings, beds, and registry placeables', () => {
    assert.match(source, /backpack\.inv\[0\]\[2\]=new_item_from_num\(43,1\)/);
    assert.match(source, /player\.talking\.bag_render\(\)/);
    assert.match(source, /autoInventoryWarningUntil=millis\(\)\+1800/);
    assert.match(source, /standingTile&&standingTile\.name==='bed'\?3:1/);
    assert.match(source, /if\(held&&held\.class==='Placeable'\)/);
});
