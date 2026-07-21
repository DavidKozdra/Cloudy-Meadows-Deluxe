'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const { readPublic, extractFunction } = require('./support/load');

const source = readPublic('classes/raycaster3d.js');
const sandbox = { pointerLockEngaged: true };
vm.runInNewContext(
    [
        extractFunction(source, 'normalizeAngleDeg0to360'),
        extractFunction(source, 'nearestCardinalFacingFromYaw'),
        extractFunction(source, 'getActiveCameraYawDeg'),
        extractFunction(source, 'isPointBlocked'),
        extractFunction(source, 'testMovementPosition'),
        extractFunction(source, 'moveWithSliding'),
        extractFunction(source, 'wrapPositionAcrossEdge'),
        extractFunction(source, 'snapToTileCenter'),
        extractFunction(source, 'findNearestWalkableGridCell'),
        extractFunction(source, 'snapPlayerTo2DGrid'),
        extractFunction(source, 'resetLevelTransitionAnim'),
        extractFunction(source, 'configureGeneratedRightBridge'),
        extractFunction(source, 'ensureLevelExists'),
        extractFunction(source, 'getLevelEntryCell'),
        extractFunction(source, 'isOpenLevelEntry'),
        extractFunction(source, 'updatePlayer3DMovementWebgl'),
        // nearestCardinalFacingFromYaw() reads these two top-level consts.
        'const YAW_TO_FACING = { 0: 1, 90: 2, 180: 3, 270: 0 };',
        'const FACING_TO_YAW_DEG = [270, 0, 90, 180];',
        'const MOVE_SPEED_TILES_PER_SEC = 4;',
        'const PLAYER_COLLISION_RADIUS_TILES = 0.2;',
        'const tileSize = 32;',
        'globalThis.normalizeAngleDeg0to360 = normalizeAngleDeg0to360;',
        'globalThis.nearestCardinalFacingFromYaw = nearestCardinalFacingFromYaw;',
        'globalThis.isPointBlocked = isPointBlocked;',
        'globalThis.moveWithSliding = moveWithSliding;',
        'globalThis.wrapPositionAcrossEdge = wrapPositionAcrossEdge;',
        'globalThis.snapToTileCenter = snapToTileCenter;',
        'globalThis.findNearestWalkableGridCell = findNearestWalkableGridCell;',
        'globalThis.snapPlayerTo2DGrid = snapPlayerTo2DGrid;',
        'globalThis.configureGeneratedRightBridge = configureGeneratedRightBridge;',
        'globalThis.ensureLevelExists = ensureLevelExists;',
        'globalThis.getLevelEntryCell = getLevelEntryCell;',
        'globalThis.isOpenLevelEntry = isOpenLevelEntry;',
        'globalThis.updatePlayer3DMovementWebgl = updatePlayer3DMovementWebgl;'
    ].join('\n'),
    sandbox
);
const {
    normalizeAngleDeg0to360,
    nearestCardinalFacingFromYaw,
    isPointBlocked,
    moveWithSliding,
    wrapPositionAcrossEdge
} = sandbox;

const WALL = { collide: true };
const FLOOR = { collide: false };

function corridorMap(width, height) {
    const map = [];
    for (let row = 0; row < height; row++) {
        const rowTiles = [];
        for (let col = 0; col < width; col++) {
            const isBorder = row === 0 || row === height - 1 || col === 0 || col === width - 1;
            rowTiles.push(isBorder ? WALL : FLOOR);
        }
        map.push(rowTiles);
    }
    return map;
}

function openMap(width = 5, height = 5) {
    return Array.from({ length: height }, () =>
        Array.from({ length: width }, () => ({ collide: false }))
    );
}

function movementLevel(map = openMap()) {
    return {
        map,
        level_name_popup: true,
        y: 0,
        done: true,
        movephase: 1,
        ticks: 1
    };
}

function installMovementWorld(levels, levelX, levelY, virtualInput) {
    Object.assign(sandbox, {
        levels,
        currentLevel_x: levelX,
        currentLevel_y: levelY,
        deltaTime: 20,
        tileSize: 32,
        canvasWidth: 160,
        canvasHeight: 160,
        virtualInput,
        move_up_button: 87,
        move_down_button: 83,
        move_left_button: 65,
        move_right_button: 68,
        keyIsDown: () => false,
        pointerLockEngaged: true
    });
}

function playerAtCenter(centerX, centerY, yawDeg) {
    const map = sandbox.levels[sandbox.currentLevel_y][sandbox.currentLevel_x].map;
    const occupiedCell = map[Math.floor(centerY)][Math.floor(centerX)];
    occupiedCell.collide = true;
    return {
        pos: { x: centerX * 32 - 16, y: centerY * 32 - 16 },
        facing: nearestCardinalFacingFromYaw(yawDeg),
        lookYawDeg: yawDeg,
        touching: occupiedCell,
        tileTouching(levelX, levelY) {
            const targetMap = sandbox.levels[levelY][levelX].map;
            return targetMap[Math.round(this.pos.y / 32)][Math.round(this.pos.x / 32)];
        }
    };
}

test('normalizeAngleDeg0to360 wraps negative and overflowing angles into [0, 360)', () => {
    assert.equal(normalizeAngleDeg0to360(-10), 350);
    assert.equal(normalizeAngleDeg0to360(370), 10);
    assert.equal(normalizeAngleDeg0to360(360), 0);
    assert.equal(normalizeAngleDeg0to360(180), 180);
});

test('nearestCardinalFacingFromYaw snaps to the closest of the 4 cardinal facings', () => {
    assert.equal(nearestCardinalFacingFromYaw(0), 1); // right
    assert.equal(nearestCardinalFacingFromYaw(90), 2); // down
    assert.equal(nearestCardinalFacingFromYaw(180), 3); // left
    assert.equal(nearestCardinalFacingFromYaw(270), 0); // up
    assert.equal(nearestCardinalFacingFromYaw(44), 1); // closer to 0 (right)
    assert.equal(nearestCardinalFacingFromYaw(46), 2); // closer to 90 (down)
    assert.equal(nearestCardinalFacingFromYaw(359), 1); // wraps to 0 (right)
});

test('isPointBlocked reports floor, wall, and edge cases', () => {
    const map = corridorMap(5, 5);
    assert.equal(isPointBlocked(map, 2.5, 2.5), false);
    assert.equal(isPointBlocked(map, 0.5, 0.5), 'wall');
    assert.equal(isPointBlocked(map, -0.5, 2.5), 'edge');
    assert.equal(isPointBlocked(map, 2.5, 10), 'edge');
    map[2][2] = 0;
    assert.equal(isPointBlocked(map, 2.5, 2.5), 'wall', 'zero map cells are non-walkable void');
});

test('moveWithSliding moves freely across open floor', () => {
    const map = corridorMap(7, 7);
    const result = moveWithSliding(map, 3, 3, 0.5, 0.5);
    assert.equal(result.x, 3.5);
    assert.equal(result.y, 3.5);
    assert.equal(result.hitEdgeX, false);
    assert.equal(result.hitEdgeY, false);
});

test('moveWithSliding cancels the blocked axis and slides along the wall', () => {
    // 5x5 room, walls on the border. Player near the right wall trying to
    // move right (blocked) and down (open) should slide down without being
    // blocked by the unrelated X collision.
    const map = corridorMap(5, 5);
    const result = moveWithSliding(map, 3.9, 2, 0.5, 0.5);
    assert.equal(result.x, 3.9, 'X movement into the wall is cancelled');
    assert.equal(result.y, 2.5, 'Y movement still slides through');
    assert.equal(result.hitEdgeX, false);
    assert.equal(result.hitEdgeY, false);
});

test('moveWithSliding stops fully in a corner when both axes are blocked', () => {
    const map = corridorMap(5, 5);
    const result = moveWithSliding(map, 3.9, 3.9, 0.5, 0.5);
    assert.equal(result.x, 3.9);
    assert.equal(result.y, 3.9);
});

test('moveWithSliding cannot enter numeric-zero void tiles', () => {
    const map = openMap();
    map[2][3] = 0;

    const result = moveWithSliding(map, 2.5, 2.5, 0.6, 0);

    assert.equal(result.x, 2.5);
    assert.equal(result.y, 2.5);
    assert.equal(result.hitEdgeX, false, 'void is a wall, not a room transition');
});

test('moveWithSliding keeps the first-person camera radius away from a wall face', () => {
    const map = corridorMap(5, 5);
    const pointResult = moveWithSliding(map, 3.6, 2.5, 0.25, 0);
    const radiusResult = moveWithSliding(map, 3.6, 2.5, 0.25, 0, 0.2);

    assert.equal(pointResult.x, 3.85, 'point collision can approach the wall closely');
    assert.equal(radiusResult.x, 3.6, 'camera radius rejects the same near-wall step');
});

test('moveWithSliding reports hitEdgeX/hitEdgeY when a point runs off the map', () => {
    const map = corridorMap(5, 5).map(row => row.map(() => FLOOR));
    const result = moveWithSliding(map, 4.8, 2, 0.5, 0);
    assert.equal(result.hitEdgeX, true);
    assert.ok(result.x > 5, 'overshoot past the edge is preserved, not clamped');
});

test('wrapPositionAcrossEdge preserves overshoot when crossing the positive edge', () => {
    // The camera center crosses the last tile center at 4.5. An additional
    // 0.8-tile overshoot enters the next room at center coordinate 1.3.
    assert.ok(Math.abs(wrapPositionAcrossEdge(5.3, 5, 1) - 1.3) < 1e-9);
});

test('wrapPositionAcrossEdge preserves overshoot when crossing the negative edge', () => {
    // Crossing 0.8 tiles beyond the first tile center arrives 0.8 tiles in
    // from the opposite entrance center.
    assert.ok(Math.abs(wrapPositionAcrossEdge(-0.3, 5, -1) - 3.7) < 1e-9);
});

test('snapToTileCenter preserves a bridge lane and stays inside room bounds', () => {
    assert.equal(sandbox.snapToTileCenter(2.83, 5), 2.5);
    assert.equal(sandbox.snapToTileCenter(-0.2, 5), 0.5);
    assert.equal(sandbox.snapToTileCenter(5.1, 5), 4.5);
});

test('2D handoff snaps to the nearest walkable tile and ignores solid cells', () => {
    const map = Array.from({ length: 4 }, () =>
        Array.from({ length: 4 }, () => ({ collide: false }))
    );
    map[2][2].collide = true;
    const player = { pos: { x: 2.15 * 32, y: 2.1 * 32 }, touching: 0 };

    const snapped = sandbox.snapPlayerTo2DGrid(player, { map });

    assert.deepEqual(
        { row: snapped.row, col: snapped.col },
        { row: 2, col: 3 }
    );
    assert.equal(player.pos.x, 96);
    assert.equal(player.pos.y, 64);
});

test('2D handoff transfers the story player occupancy marker', () => {
    sandbox.currentLevel_x = 0;
    sandbox.currentLevel_y = 0;
    const occupied = { collide: true };
    const destination = { collide: false };
    const map = [[occupied, destination]];
    const player = {
        pos: { x: 0.6 * 32, y: 0 },
        touching: occupied,
        tileTouching() { return map[0][Math.round(this.pos.x / 32)]; }
    };

    sandbox.snapPlayerTo2DGrid(player, { map });

    assert.equal(player.pos.x, 32);
    assert.equal(occupied.collide, false);
    assert.equal(destination.collide, true);
    assert.equal(player.touching, destination);
});

test('frame movement follows continuous yaw and updates player position', () => {
    const map = Array.from({ length: 5 }, () =>
        Array.from({ length: 5 }, () => FLOOR)
    );
    Object.assign(sandbox, {
        levels: [[{ map }]],
        currentLevel_x: 0,
        currentLevel_y: 0,
        deltaTime: 250,
        tileSize: 32,
        canvasWidth: 160,
        canvasHeight: 160,
        virtualInput: { up: true, down: false, left: false, right: false },
        move_up_button: 87,
        move_down_button: 83,
        move_left_button: 65,
        move_right_button: 68,
        keyIsDown: () => false
    });
    const player = { pos: { x: 32, y: 32 }, lookYawDeg: 0 };

    sandbox.updatePlayer3DMovementWebgl(player);

    assert.equal(player.pos.x, 64, 'yaw 0 forward movement advances one tile along +X');
    assert.equal(player.pos.y, 32);
});

test('3D movement ignores the player occupancy tile without ignoring real walls', () => {
    const map = Array.from({ length: 5 }, () =>
        Array.from({ length: 5 }, () => ({ collide: false }))
    );
    const occupiedCell = map[1][1];
    occupiedCell.collide = true;
    Object.assign(sandbox, {
        levels: [[{ map }]],
        currentLevel_x: 0,
        currentLevel_y: 0,
        deltaTime: 16,
        tileSize: 32,
        canvasWidth: 160,
        canvasHeight: 160,
        virtualInput: { up: true, down: false, left: false, right: false },
        move_up_button: 87,
        move_down_button: 83,
        move_left_button: 65,
        move_right_button: 68,
        keyIsDown: () => false,
        pointerLockEngaged: true
    });
    const player = {
        pos: { x: 32, y: 32 },
        facing: 1,
        lookYawDeg: 0,
        touching: occupiedCell,
        tileTouching() {
            return map[Math.round(this.pos.y / 32)][Math.round(this.pos.x / 32)];
        }
    };

    sandbox.updatePlayer3DMovementWebgl(player);

    assert.ok(player.pos.x > 32, 'a sub-tile step can leave the player-owned collision cell');
    assert.equal(player.touching.collide, true, 'the current tile remains occupied for NPC collision');

    map[1][2].collide = true;
    const blocked = sandbox.moveWithSliding(map, 1.75, 1.5, 0.1, 0, 0.2, occupiedCell);
    assert.equal(blocked.x, 1.75, 'an unrelated wall is still solid');
});

test('movement follows the visible cardinal camera when pointer lock is disengaged', () => {
    const map = Array.from({ length: 5 }, () =>
        Array.from({ length: 5 }, () => FLOOR)
    );
    Object.assign(sandbox, {
        levels: [[{ map }]],
        currentLevel_x: 0,
        currentLevel_y: 0,
        deltaTime: 250,
        tileSize: 32,
        canvasWidth: 160,
        canvasHeight: 160,
        virtualInput: { up: true, down: false, left: false, right: false },
        move_up_button: 87,
        move_down_button: 83,
        move_left_button: 65,
        move_right_button: 68,
        keyIsDown: () => false,
        pointerLockEngaged: false
    });
    const player = { pos: { x: 32, y: 32 }, facing: 2, lookYawDeg: 0 };

    sandbox.updatePlayer3DMovementWebgl(player);

    assert.equal(player.pos.x, 32, 'stale free-look yaw is ignored outside pointer lock');
    assert.equal(player.pos.y, 64, 'facing down moves forward along the visible +Y direction');
});

test('cross-room movement works in all four directions and preserves the entrance lane', async t => {
    const cases = [
        {
            name: 'right', yaw: 0, start: [4.45, 2.8],
            expectedLevel: [2, 1], expectedCenter: [0.53, 2.5], expectedTile: [0, 2]
        },
        {
            name: 'left', yaw: 180, start: [0.55, 2.2],
            expectedLevel: [0, 1], expectedCenter: [4.47, 2.5], expectedTile: [4, 2]
        },
        {
            name: 'down', yaw: 90, start: [2.8, 4.45],
            expectedLevel: [1, 2], expectedCenter: [2.5, 0.53], expectedTile: [2, 0]
        },
        {
            name: 'up', yaw: 270, start: [2.2, 0.55],
            expectedLevel: [1, 0], expectedCenter: [2.5, 4.47], expectedTile: [2, 4]
        }
    ];

    for (const direction of cases) {
        await t.test(direction.name, () => {
            const levels = Array.from({ length: 3 }, () =>
                Array.from({ length: 3 }, () => movementLevel())
            );
            installMovementWorld(
                levels,
                1,
                1,
                { up: true, down: false, left: false, right: false }
            );
            const player = playerAtCenter(direction.start[0], direction.start[1], direction.yaw);
            const occupiedCell = player.touching;

            sandbox.updatePlayer3DMovementWebgl(player);

            const centerX = (player.pos.x + 16) / 32;
            const centerY = (player.pos.y + 16) / 32;
            assert.deepEqual(
                [sandbox.currentLevel_x, sandbox.currentLevel_y],
                direction.expectedLevel
            );
            assert.ok(Math.abs(centerX - direction.expectedCenter[0]) < 1e-9);
            assert.ok(Math.abs(centerY - direction.expectedCenter[1]) < 1e-9);
            assert.equal(occupiedCell.collide, false, 'the source occupancy marker is released');
            assert.equal(
                levels[direction.expectedLevel[1]][direction.expectedLevel[0]]
                    .map[direction.expectedTile[1]][direction.expectedTile[0]].collide,
                true,
                'the matching destination entrance becomes occupied'
            );
        });
    }
});

test('cross-room movement refuses a closed destination entrance', () => {
    const makeMap = () => Array.from({ length: 5 }, () =>
        Array.from({ length: 5 }, () => ({ collide: false }))
    );
    const sourceMap = makeMap();
    const destinationMap = makeMap();
    destinationMap[2][0].collide = true;
    Object.assign(sandbox, {
        levels: [[{ map: sourceMap }, { map: destinationMap }]],
        currentLevel_x: 0,
        currentLevel_y: 0,
        deltaTime: 20,
        tileSize: 32,
        canvasWidth: 160,
        canvasHeight: 160,
        virtualInput: { up: true, down: false, left: false, right: false },
        move_up_button: 87,
        move_down_button: 83,
        move_left_button: 65,
        move_right_button: 68,
        keyIsDown: () => false,
        pointerLockEngaged: true
    });
    const player = { pos: { x: 4.45 * 32 - 16, y: 2.5 * 32 - 16 }, facing: 1, lookYawDeg: 0 };

    sandbox.updatePlayer3DMovementWebgl(player);

    assert.equal(sandbox.currentLevel_x, 0);
    assert.equal((player.pos.x + 16) / 32, 4.5, 'the player remains inside the source room');
});

test('cross-room movement also refuses a numeric-zero destination entrance', () => {
    const sourceMap = openMap();
    const destinationMap = openMap();
    destinationMap[2][0] = 0;
    installMovementWorld(
        [[movementLevel(sourceMap), movementLevel(destinationMap)]],
        0,
        0,
        { up: true, down: false, left: false, right: false }
    );
    const player = playerAtCenter(4.45, 2.5, 0);

    sandbox.updatePlayer3DMovementWebgl(player);

    assert.equal(sandbox.currentLevel_x, 0);
    assert.equal((player.pos.x + 16) / 32, 4.5);
    assert.equal(player.touching.collide, true, 'the source occupancy marker is restored');
});

test('a diagonal corner step crosses exactly one room boundary', () => {
    const levels = Array.from({ length: 3 }, () =>
        Array.from({ length: 3 }, () => movementLevel())
    );
    installMovementWorld(
        levels,
        1,
        1,
        { up: true, down: false, left: false, right: true }
    );
    const player = playerAtCenter(4.45, 4.45, 0);

    sandbox.updatePlayer3DMovementWebgl(player);

    const levelDistance = Math.abs(sandbox.currentLevel_x - 1) +
        Math.abs(sandbox.currentLevel_y - 1);
    assert.equal(levelDistance, 1, 'the player enters one adjacent room, never the diagonal room');
    assert.notDeepEqual([sandbox.currentLevel_x, sandbox.currentLevel_y], [2, 2]);
});

test('entry lookup selects the matching edge and treats walls and void as closed', () => {
    const map = openMap();
    const level = movementLevel(map);

    assert.strictEqual(sandbox.getLevelEntryCell(level, 'x', 1, 2.7), map[2][0]);
    assert.strictEqual(sandbox.getLevelEntryCell(level, 'x', -1, 2.7), map[2][4]);
    assert.strictEqual(sandbox.getLevelEntryCell(level, 'y', 1, 2.7), map[0][2]);
    assert.strictEqual(sandbox.getLevelEntryCell(level, 'y', -1, 2.7), map[4][2]);

    map[2][0] = WALL;
    assert.equal(sandbox.isOpenLevelEntry(level, 'x', 1, 2.7), false);
    map[2][0] = 0;
    assert.equal(sandbox.isOpenLevelEntry(level, 'x', 1, 2.7), false);
    map[2][0] = FLOOR;
    assert.equal(sandbox.isOpenLevelEntry(level, 'x', 1, 2.7), true);
});

test('only rightward crossings generate extra rooms and they receive an entrance bridge', () => {
    const blankMap = () => Array.from({ length: 19 }, () => Array(23).fill(0));
    Object.assign(sandbox, {
        levels: [[{ map: blankMap() }], []],
        extra_lvls: { map: blankMap(), fore: blankMap() },
        extraCount: 0,
        tileSize: 32,
        floor: Math.floor,
        random: () => 1,
        new_tile_from_num: (num, x, y) => ({ num, name: num === 8 ? 'Bridge' : 'generated', collide: false, pos: { x, y } }),
        Level: class {
            constructor(name, map, fore) {
                Object.assign(this, { name, map, fore });
            }
        }
    });

    assert.equal(sandbox.ensureLevelExists(0, 1, 'x', 1), true);
    assert.equal(sandbox.levels[0][1].map[8][0].num, 8);
    assert.equal(sandbox.levels[0][1].map[8][1].num, 8);
    assert.equal(sandbox.ensureLevelExists(1, 0, 'y', 1), false);
    assert.equal(sandbox.levels[1][0], undefined);
});

test('generated rooms build each randomized bridge exit without losing the left entrance', async t => {
    const blankMap = () => Array.from({ length: 19 }, () => Array(23).fill(0));
    const exits = [
        { variant: 0, cells: [[0, 11, 94], [1, 11, 9]] },
        { variant: 1, cells: [[8, 22, 93], [8, 21, 8]] },
        { variant: 2, cells: [[18, 11, 9], [17, 11, 9], [16, 11, 94], [15, 11, 9]] }
    ];
    Object.assign(sandbox, {
        tileSize: 32,
        floor: Math.floor,
        new_tile_from_num: (num, x, y) => ({ num, collide: false, pos: { x, y } })
    });

    for (const exit of exits) {
        await t.test(`variant ${exit.variant}`, () => {
            const level = { map: blankMap() };
            sandbox.random = () => exit.variant + 0.1;

            sandbox.configureGeneratedRightBridge(level, 1);

            assert.equal(level.map[8][0].num, 8);
            assert.equal(level.map[8][1].num, 8);
            for (const [row, column, tileNum] of exit.cells) {
                assert.equal(level.map[row][column].num, tileNum);
            }
        });
    }
});
