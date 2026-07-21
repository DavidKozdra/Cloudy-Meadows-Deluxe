'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const { readPublic } = require('./support/load');

const source = readPublic('classes/raycaster3d.js');
const primarySprite = { id: 'primary', width: 32, height: 32 };
const fallbackSprite = { id: 'fallback', width: 32, height: 32 };
const frontSprite = { id: 'front', width: 24, height: 40 };
const plantSprite = { id: 'plant', width: 30, height: 28 };
const staticSprite = { id: 'static', width: 48, height: 36, get() {} };
const sandbox = {
    all_imgs: [
        [fallbackSprite, primarySprite],
        [[fallbackSprite], [fallbackSprite], [frontSprite], [fallbackSprite]],
        [fallbackSprite, plantSprite],
        staticSprite
    ],
    tileSize: 32
};

vm.runInNewContext(
    `${source}
     globalThis.buildRoomGeometryDescriptors = buildRoomGeometryDescriptors;
     globalThis.getRoomGeometryForRoom = getRoomGeometryForRoom;
     globalThis.getWebglBillboardSprite = getWebglBillboardSprite;
     globalThis.collectBillboardDescriptors = collectBillboardDescriptors;`,
    sandbox
);

test('room descriptors separate walls and floors while excluding billboard entities from walls', () => {
    const wall = { collide: true, class: 'Tile', png: 0, variant: 1 };
    const fallbackWall = { collide: true, class: 'Tile', png: 0, variant: 99 };
    const floor = { collide: false, class: 'Tile', png: 0, variant: 0 };
    const npc = {
        collide: true,
        class: 'NPC',
        png: 0,
        variant: 0,
        under_tile: { png: 0, variant: 1 }
    };
    const map = [
        [wall, floor, npc],
        [0, fallbackWall]
    ];

    const geometry = sandbox.buildRoomGeometryDescriptors(map);

    assert.equal(geometry.walls.length, 2);
    assert.deepEqual(
        JSON.parse(JSON.stringify(geometry.walls.map(({ xTiles, yTiles }) => ({ xTiles, yTiles })))),
        [{ xTiles: 0, yTiles: 0 }, { xTiles: 1, yTiles: 1 }]
    );
    assert.equal(geometry.walls[0].sprite, primarySprite);
    assert.equal(geometry.walls[1].sprite, fallbackSprite);

    assert.equal(geometry.floors.length, 2);
    assert.deepEqual(
        JSON.parse(JSON.stringify(geometry.floors.map(({ xTiles, yTiles }) => ({ xTiles, yTiles })))),
        [{ xTiles: 1, yTiles: 0 }, { xTiles: 2, yTiles: 0 }]
    );
    assert.equal(geometry.floors[0].sprite, fallbackSprite);
    assert.equal(geometry.floors[1].sprite, primarySprite);
});

test('billboard descriptors resolve entity sprite layouts and use live positions', () => {
    const movable = {
        collide: true,
        class: 'MovableEntity',
        png: 1,
        pos: { x: 64, y: 96 },
        under_tile: { png: 0, variant: 0 }
    };
    const plant = {
        collide: false,
        class: 'Plant',
        png: 2,
        age: 1,
        pos: { x: 32, y: 32 }
    };
    const chest = {
        collide: true,
        class: 'Chest',
        png: 3,
        pos: { x: 0, y: 64 }
    };

    assert.equal(sandbox.getWebglBillboardSprite(movable), frontSprite);
    assert.equal(sandbox.getWebglBillboardSprite(plant), plantSprite);
    assert.equal(sandbox.getWebglBillboardSprite(chest), staticSprite);

    const descriptors = sandbox.collectBillboardDescriptors({ map: [[movable, plant, chest]] });
    assert.equal(descriptors.length, 3);
    assert.deepEqual(
        JSON.parse(JSON.stringify(descriptors.map(({ worldX, worldZ, width, height }) => ({ worldX, worldZ, width, height })))),
        [
            { worldX: 80, worldZ: 112, width: 24, height: 40 },
            { worldX: 48, worldZ: 48, width: 30, height: 28 },
            { worldX: 16, worldZ: 80, width: 48, height: 36 }
        ]
    );
});

test('static props become billboards over the room floor instead of opaque wall cubes', () => {
    const dirt = { name: 'dirt', collide: false, class: 'Tile', png: 0, variant: 1 };
    const lamp = { name: 'lamppost', collide: true, class: 'Tile', png: 3, variant: 0 };

    const geometry = sandbox.buildRoomGeometryDescriptors([[dirt, lamp]]);

    assert.equal(geometry.walls.length, 0);
    assert.equal(geometry.floors.length, 2);
    assert.equal(geometry.floors[1].sprite, primarySprite);
    assert.equal(geometry.staticBillboards.length, 1);
    assert.deepEqual(
        JSON.parse(JSON.stringify((({ sprite, ...descriptor }) => descriptor)(geometry.staticBillboards[0]))),
        { worldX: 48, worldZ: 16, width: 48, height: 36 }
    );
    assert.equal(geometry.staticBillboards[0].sprite, staticSprite);
});

test('room geometry is rebuilt for live map edits and room-coordinate changes', () => {
    const level = {
        map: [[{ collide: true, class: 'Tile', png: 0, variant: 0 }]]
    };

    const first = sandbox.getRoomGeometryForRoom(level, 4, 2);
    level.map[0].push({ collide: true, class: 'Tile', png: 0, variant: 0 });
    const sameRoom = sandbox.getRoomGeometryForRoom(level, 4, 2);
    const nextRoom = sandbox.getRoomGeometryForRoom(level, 5, 2);

    assert.notEqual(sameRoom, first);
    assert.equal(sameRoom.walls.length, 2);
    assert.equal(sameRoom.floors.length, 0);
    assert.notEqual(nextRoom, sameRoom);
    assert.equal(nextRoom.walls.length, 2);
});
