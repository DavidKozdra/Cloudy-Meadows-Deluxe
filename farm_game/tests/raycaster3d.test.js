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
const readyMarker = { id: 'ready', width: 16, height: 16 };
const questMarker = { id: 'quest', width: 16, height: 16 };
const giftMarker = { id: 'gift', width: 16, height: 16 };
const sandbox = {
    all_imgs: [
        [fallbackSprite, primarySprite],
        [[fallbackSprite], [fallbackSprite], [frontSprite], [fallbackSprite]],
        [fallbackSprite, plantSprite],
        staticSprite
    ],
    done_dot: readyMarker,
    quest_marker_img: questMarker,
    gift_indication_img: giftMarker,
    tileSize: 32
};

vm.runInNewContext(
    `${source}
     globalThis.buildRoomGeometryDescriptors = buildRoomGeometryDescriptors;
     globalThis.getRoomGeometryForRoom = getRoomGeometryForRoom;
     globalThis.getWebglBillboardSprite = getWebglBillboardSprite;
     globalThis.collectBillboardDescriptors = collectBillboardDescriptors;
     globalThis.collect3DStatusMarkerDescriptors = collect3DStatusMarkerDescriptors;
     globalThis.get3DInteractionTarget = get3DInteractionTarget;`,
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

test('beds render as raised horizontal props over their under-tile', () => {
    const underTile = { name: 'dirt', collide: false, class: 'Tile', png: 0, variant: 1 };
    const bed = {
        name: 'bed', collide: false, class: 'Tile', png: 3, variant: 0, under_tile: underTile
    };

    const geometry = sandbox.buildRoomGeometryDescriptors([[bed]]);

    assert.equal(geometry.walls.length, 0);
    assert.equal(geometry.staticBillboards.length, 0, 'a bed must not stand vertically');
    assert.equal(geometry.floors.length, 1);
    assert.equal(geometry.floors[0].sprite, primarySprite);
    assert.equal(geometry.flatProps.length, 1);
    assert.deepEqual(
        JSON.parse(JSON.stringify((({ sprite, ...descriptor }) => descriptor)(geometry.flatProps[0]))),
        { xTiles: 0, yTiles: 0 }
    );
    assert.equal(geometry.flatProps[0].sprite, staticSprite);
});

test('3D interaction prompt uses the same nearby interactable target as the player', () => {
    const npc = { class: 'NPC', pos: { x: 32, y: 64 } };
    const floor = { class: 'Tile', name: 'grass', pos: { x: 32, y: 64 } };
    const player = { talking: 0, looking: () => npc };

    assert.strictEqual(sandbox.get3DInteractionTarget(player, 4, 2), npc);
    player.looking = () => floor;
    assert.equal(sandbox.get3DInteractionTarget(player, 4, 2), null);
    player.looking = () => npc;
    player.talking = npc;
    assert.equal(sandbox.get3DInteractionTarget(player, 4, 2), null);
});

test('3D status markers match ready-plant and NPC quest/gift priority rules', () => {
    const readyPlant = {
        class: 'Plant', png: 2, age: 0, pos: { x: 0, y: 0 }
    };
    const questNpc = {
        class: 'NPC', png: 1, pos: { x: 32, y: 0 },
        hasQuestForPlayer: () => true,
        hasGiftForPlayer: () => true
    };
    const giftNpc = {
        class: 'NPC', png: 1, pos: { x: 64, y: 0 },
        hasQuestForPlayer: () => false,
        hasGiftForPlayer: () => true
    };
    const markers = sandbox.collect3DStatusMarkerDescriptors(
        { map: [[readyPlant, questNpc, giftNpc]] },
        { talking: 0 }
    );

    assert.equal(markers.length, 3);
    assert.equal(markers[0].sprite, readyMarker);
    assert.equal(markers[1].sprite, questMarker, 'quest takes priority when an NPC also has a gift');
    assert.equal(markers[2].sprite, giftMarker);
    assert.ok(markers.every(marker => marker.worldY > marker.height / 2));
    assert.ok(markers.every(marker => marker.statusMarker === true));
});

test('NPC status markers hide while talking, while ready crop markers remain', () => {
    const readyPlant = { class: 'Plant', png: 2, age: 0, pos: { x: 0, y: 0 } };
    const npc = {
        class: 'NPC', png: 1, pos: { x: 32, y: 0 },
        hasQuestForPlayer: () => true,
        hasGiftForPlayer: () => false
    };

    const markers = sandbox.collect3DStatusMarkerDescriptors(
        { map: [[readyPlant, npc]] },
        { talking: npc }
    );

    assert.equal(markers.length, 1);
    assert.equal(markers[0].sprite, readyMarker);
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

test('player occupancy and entity movement do not rebuild static room geometry', () => {
    const grass = { name: 'grass', collide: false, class: 'Tile', png: 0, variant: 0 };
    const dirt = { name: 'dirt', collide: false, class: 'Tile', png: 0, variant: 1 };
    const npc = {
        collide: true,
        class: 'NPC',
        png: 1,
        pos: { x: 0, y: 0 },
        under_tile: grass
    };
    const level = { map: [[npc, dirt]] };
    const first = sandbox.getRoomGeometryForRoom(level, 7, 7);

    // This is the same map update performed when an entity moves east: the
    // old position reveals its under-tile and the entity adopts the new one.
    level.map[0][0] = npc.under_tile;
    npc.under_tile = dirt;
    npc.pos.x = 32;
    level.map[0][1] = npc;
    const afterEntityMove = sandbox.getRoomGeometryForRoom(level, 7, 7);
    assert.equal(afterEntityMove, first);

    // Player occupancy changes collide on a named floor Tile; that affects
    // movement only, not the cached visual geometry.
    grass.collide = true;
    const afterPlayerOccupancy = sandbox.getRoomGeometryForRoom(level, 7, 7);
    assert.equal(afterPlayerOccupancy, first);
});
