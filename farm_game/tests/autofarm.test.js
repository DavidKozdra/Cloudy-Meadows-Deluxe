const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/autofarm/game.js'), 'utf8');
const raycasterSource = fs.readFileSync(path.join(__dirname, '../public/classes/raycaster3d.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../public/autofarm/index.html'), 'utf8');
const assetsSource = fs.readFileSync(path.join(__dirname, '../public/autofarm/assets.js'), 'utf8');
const miscSource = fs.readFileSync(path.join(__dirname, '../public/miscfunctions.js'), 'utf8');
const context = {
    navigator: { userAgent: 'test' },
    localDataStorage() { return { get() { return null; }, set() {} }; },
    window: {},
    document: {},
    localStorage: { getItem() { return null; } }
};
vm.runInNewContext(raycasterSource + '\n' + source + '\nglobalThis.testGenerateMap=generateAutoMap;globalThis.testHash=autoHash;globalThis.testFacingTile=getAutoFacingTile;globalThis.testInitial3DMode=getAutoFarmInitial3DMode;globalThis.testUpdateAuto3D=updateAutoFarm3DMovement;globalThis.testResolvePlaceable=resolveAutoPlaceableTarget;globalThis.testSnapPlayer=snapPlayerTo2DGrid;globalThis.testSerializeTile=serializeAutoTile;globalThis.testUseAutoItem=useAutoItem;globalThis.testActiveCameraYaw=getActiveCameraYawDeg;', context);

function openMovementMap(width = 23, height = 19) {
    return Array.from({ length: height }, () =>
        Array.from({ length: width }, () => ({ collide: false }))
    );
}

function install3DMovement(map, centerX, centerY, yaw = 0) {
    Object.assign(context, {
        levels: [[{ map }]],
        currentLevel_x: 0,
        currentLevel_y: 0,
        pointerLockEngaged: true,
        deltaTime: 16,
        keyIsDown: code => code === 87,
        millis: () => 1000,
        autoSocket: null,
        player: {
            pos: { x: centerX * 32 - 16, y: centerY * 32 - 16 },
            facing: 1,
            lookYawDeg: yaw,
            anim: 0
        }
    });
}

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
    assert.match(source, /held && held\.class === 'Placeable'/);
});

test('AutoFarm loads and initializes the shared Three.js 3D renderer', () => {
    assert.match(html, /import \* as THREE from 'https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.184\.0\/build\/three\.module\.min\.js'/);
    assert.match(html, /classes\/raycaster3d\.js\?v=31/);
    assert.match(source, /initializeThree3DRenderer\(\)/);
    assert.match(source, /render3DViewWebgl\(player, level, currentLevel_x, currentLevel_y\)/);
    assert.doesNotMatch(source, /createGraphics\(canvasWidth, canvasHeight, WEBGL\)/);
});

test('AutoFarm starts in 3D without an unsolicited keyboard toggle', () => {
    assert.equal(context.testInitial3DMode({}), true);
    assert.equal(context.testInitial3DMode({ is3DMode: false }), false, 'an explicit options choice is respected');
    assert.match(source, /var is3DMode = true;/);
    assert.doesNotMatch(source, /key === ['"]v['"]/i);
    assert.doesNotMatch(html, /V switch 2D\/3D/);
});

test('AutoFarm 3D movement is continuous and camera-relative', () => {
    install3DMovement(openMovementMap(), 1.5, 1.5, 0);

    const moved = context.testUpdateAuto3D();

    assert.equal(moved, true);
    assert.ok(context.player.pos.x > 32 && context.player.pos.x < 64, 'one frame moves a fraction of a tile');
    assert.equal(context.player.pos.y, 32);
});

test('AutoFarm 3D movement accepts the shared mobile virtual input', () => {
    install3DMovement(openMovementMap(), 1.5, 1.5, 0);
    context.keyIsDown = () => false;
    context.virtualInput.up = true;

    const moved = context.testUpdateAuto3D();

    context.virtualInput.up = false;
    assert.equal(moved, true);
    assert.ok(context.player.pos.x > 32 && context.player.pos.x < 64);
});

test('AutoFarm mobile camera uses touch-drag yaw without pointer lock', () => {
    context.pointerLockEngaged = false;
    context.isMobile = true;
    assert.equal(context.testActiveCameraYaw({ lookYawDeg: 137, facing: 2 }), 137);
    context.isMobile = false;
});

test('AutoFarm 3D movement slides with a collision radius instead of entering walls', () => {
    const map = openMovementMap();
    map[1][2].collide = true;
    install3DMovement(map, 1.75, 1.5, 0);
    const originalX = context.player.pos.x;

    context.testUpdateAuto3D();

    assert.equal(context.player.pos.x, originalX);
    assert.equal(context.player.pos.y, 32);
});

test('AutoFarm 3D movement crosses into the matching generated-world neighbor lane', () => {
    const sourceMap = openMovementMap();
    const destinationMap = openMovementMap();
    install3DMovement(sourceMap, 22.47, 9.2, 0);
    context.levels = [[{ map: sourceMap }, { map: destinationMap }]];
    context.ensureAutoNeighbors = () => {};

    context.testUpdateAuto3D();

    const centerX = (context.player.pos.x + 16) / 32;
    const centerY = (context.player.pos.y + 16) / 32;
    assert.equal(context.currentLevel_x, 1);
    assert.ok(Math.abs(centerX - 0.534) < 1e-9);
    assert.equal(centerY, 9.5);
});

test('returning from AutoFarm 3D snaps to the nearest open 2D grid tile', () => {
    const map = openMovementMap(5, 5);
    map[2][2].collide = true;
    Object.assign(context, {
        tileSize: 32,
        currentLevel_x: 0,
        currentLevel_y: 0,
        player: { pos: { x: 2.2 * 32, y: 2.1 * 32 }, touching: 0 }
    });

    const snapped = context.testSnapPlayer(context.player, { map });

    assert.deepEqual({ row: snapped.row, col: snapped.col }, { row: 2, col: 3 });
    assert.equal(context.player.pos.x, 96);
    assert.equal(context.player.pos.y, 64);
    assert.equal(map[2][2].collide, true, 'the blocked tile remains blocked');
});

test('AutoFarm walls target the open tile ahead instead of trapping the player', () => {
    context.tile_name_to_num = name => name === 'grass' ? 2 : undefined;
    const currentTile = { name: 'grass', collide: false };
    const aheadTile = { name: 'grass', collide: false };
    const currentPosition = { row: 4, col: 4 };
    const aheadPosition = { row: 4, col: 5 };
    const wall = { name: 'Wall', class: 'Placeable', tile_need_num: 0 };

    const target = context.testResolvePlaceable(
        wall, currentTile, currentPosition, aheadTile, aheadPosition
    );

    assert.equal(target.tile, aheadTile);
    assert.equal(target.position, aheadPosition);
    assert.equal(context.testResolvePlaceable(
        wall, currentTile, currentPosition, { name: 'wall', collide: true }, aheadPosition
    ), null);
    assert.equal(context.testResolvePlaceable(
        wall, currentTile, currentPosition, currentTile, currentPosition
    ), null, 'a clamped room-edge target cannot place on the player');
});

test('using a wall on desktop places it ahead, preserves its floor, and consumes one item', () => {
    const map = openMovementMap();
    for (let row = 0; row < map.length; row++) {
        for (let col = 0; col < map[row].length; col++) {
            map[row][col] = { name: 'grass', class: 'Tile', collide: false, row, col };
        }
    }
    const floor = map[4][5];
    Object.assign(context, {
        levels: [[{ map }]],
        currentLevel_x: 0,
        currentLevel_y: 0,
        constrain: (value, low, high) => Math.min(high, Math.max(low, value)),
        tile_name_to_num: name => name === 'grass' ? 2 : -1,
        new_tile_from_num: (tileNum, x, y) => ({
            name: tileNum === 6 ? 'wall' : 'unknown',
            class: 'Tile', collide: tileNum === 6, x, y
        }),
        player: {
            pos: { x: 4 * 32, y: 4 * 32 },
            facing: 1,
            hand: 0,
            inv: [{ name: 'Wall', class: 'Placeable', tile_num: 6, tile_need_num: 0, amount: 2 }]
        },
        autoSocket: null
    });

    context.testUseAutoItem();

    assert.equal(map[4][5].name, 'wall');
    assert.equal(map[4][5].under_tile, floor);
    assert.equal(context.player.inv[0].amount, 1);
    assert.equal(map[4][4].name, 'grass', 'the occupied tile is unchanged');
});

test('AutoFarm includes and consumes the main-game mobile control surface', () => {
    for (const id of ['mobile-controls','dpad-up','dpad-down','dpad-left','dpad-right',
        'btn-interact','btn-eat','hotbar-prev','hotbar-next','btn-mobile-pause']) {
        assert.match(html, new RegExp(`id=["']${id}["']`));
    }
    assert.match(source, /function setupAutoMobileControls\(/);
    assert.match(source, /processAutoVirtualActions\(\)/);
    assert.match(source, /virtualInput\.up/);
    assert.match(source, /player\.lookYawDeg = normalizeAngleDeg0to360/);
});

test('3D pause resumes pointer lock from the Resume button click', () => {
    assert.match(miscSource, /function rememberPointerLockForPause\(/);
    assert.match(miscSource, /function restorePointerLockAfterPause\(/);
    assert.match(miscSource, /backBtn\.addEventListener\('click',[\s\S]*restorePointerLockAfterPause\(\)/);
    assert.doesNotMatch(
        miscSource,
        /if \(engaged && typeof player[\s\S]{0,180}player\.lookYawDeg = \[270, 0, 90, 180\]/,
        'relocking must preserve the current camera yaw'
    );
    assert.match(source, /rememberPointerLockForPause\(\)/);
});

test('AutoFarm saves the floor beneath a placed wall for later removal', () => {
    const floor = { name: 'path', class: 'Tile', age: -1, variant: 2 };
    const wall = { name: 'wall', class: 'Tile', age: -1, variant: 0, under_tile: floor };

    const saved = context.testSerializeTile(wall);

    assert.equal(saved.name, 'wall');
    assert.equal(saved.underTile.name, 'path');
    assert.equal(saved.underTile.variant, 2);
});

test('AutoFarm loads the shared ready, quest, and gift marker sprites', () => {
    assert.match(assetsSource, /done_dot = img\('images\/ui\/plant_done_icon\.png'\)/);
    assert.match(assetsSource, /quest_marker_img = img\('images\/ui\/QuestMarker\.png'\)/);
    assert.match(assetsSource, /gift_indication_img = img\('images\/ui\/gift_indication\.png'\)/);
});

test('AutoFarm exposes the tile ahead for shared 3D interaction prompts', () => {
    const map = Array.from({ length: 3 }, (_, row) =>
        Array.from({ length: 3 }, (_, column) => ({ row, column }))
    );
    context.levels = [[{ map }]];
    const player = { pos: { x: 32, y: 32 }, facing: 0 };

    assert.deepEqual(context.testFacingTile(player, 0, 0), map[0][1]);
    player.facing = 1;
    assert.deepEqual(context.testFacingTile(player, 0, 0), map[1][2]);
    player.facing = 2;
    assert.deepEqual(context.testFacingTile(player, 0, 0), map[2][1]);
    player.facing = 3;
    assert.deepEqual(context.testFacingTile(player, 0, 0), map[1][0]);
});
