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
     globalThis.getFloorTileSprite = getFloorTileSprite;
     globalThis.getWebglBillboardSprite = getWebglBillboardSprite;
     globalThis.collectBillboardDescriptors = collectBillboardDescriptors;
     globalThis.isAnimatedWebglSprite = isAnimatedWebglSprite;
     globalThis.collect3DStatusMarkerDescriptors = collect3DStatusMarkerDescriptors;
     globalThis.get3DInteractionTarget = get3DInteractionTarget;
     globalThis.get3DHeldItemSprite = get3DHeldItemSprite;`,
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

test('generic animated entities such as ladybugs render as 3D billboards', () => {
    const ladybugSprite = {
        width: 32,
        height: 32,
        gifProperties: { frames: [{}, {}] }
    };
    sandbox.all_imgs[4] = ladybugSprite;
    const ladybug = {
        class: 'Entity',
        name: 'ladybug',
        png: 4,
        pos: { x: 32, y: 64 },
        under_tile: { class: 'Tile', name: 'grass', png: 0, variant: 0 }
    };

    const descriptors = sandbox.collectBillboardDescriptors({ map: [[ladybug]] });

    assert.equal(descriptors.length, 1);
    assert.equal(descriptors[0].sprite, ladybugSprite);
    assert.equal(sandbox.isAnimatedWebglSprite(ladybugSprite), true);
});

test('crop floors use dry or wet soil textures and invalidate when watering changes', () => {
    const originalPlotSprites = sandbox.all_imgs[2];
    const plotSprite = { id: 'plot', width: 32, height: 32 };
    const wetPlotSprite = { id: 'wet-plot', width: 32, height: 32 };
    const cropSprite = { id: 'crop', width: 32, height: 32 };
    sandbox.all_imgs[2] = [plotSprite];
    sandbox.all_imgs[4] = [cropSprite];
    sandbox.all_imgs[93] = [wetPlotSprite];
    const plant = {
        class: 'Plant', name: 'strawberry', png: 4, age: 0,
        waterneeded: 1, watermet: false, pos: { x: 0, y: 0 }
    };
    const level = { map: [[plant]] };

    const dryGeometry = sandbox.getRoomGeometryForRoom(level, 30, 30);
    assert.equal(dryGeometry.floors[0].sprite, plotSprite);

    plant.watermet = true;
    const wetGeometry = sandbox.getRoomGeometryForRoom(level, 30, 30);
    assert.notEqual(wetGeometry, dryGeometry, 'watering invalidates cached floor geometry');
    assert.equal(wetGeometry.floors[0].sprite, wetPlotSprite);

    sandbox.all_imgs[2] = originalPlotSprites;
});

test('sprinkler floors recover their remembered underlying soil texture', () => {
    const originalPlotSprites = sandbox.all_imgs[2];
    const plotSprite = { id: 'plot', width: 32, height: 32 };
    const sprinklerSprite = { id: 'sprinkler', width: 16, height: 16 };
    sandbox.all_imgs[2] = [plotSprite];
    sandbox.all_imgs[4] = [sprinklerSprite];
    const sprinkler = {
        class: 'Tile', name: 'sprinkler', png: 4, variant: 0,
        last_under_png: 2, last_under_variant: 0
    };

    const geometry = sandbox.buildRoomGeometryDescriptors([[sprinkler]]);

    assert.equal(geometry.floors[0].sprite, plotSprite);
    assert.equal(geometry.staticBillboards[0].sprite, sprinklerSprite);
    sandbox.all_imgs[2] = originalPlotSprites;
});

test('park tree billboards stack the canopy above the trunk at one 3D position', () => {
    const trunkSprite = { id: 'trunk', width: 32, height: 32 };
    const canopySprite = { id: 'canopy', width: 40, height: 32 };
    sandbox.all_imgs[4] = [trunkSprite];
    sandbox.all_imgs[5] = [canopySprite];
    const top = { name: 'tree_top', class: 'Tile', png: 5, variant: 0 };
    const bottom = { name: 'tree_bottom', class: 'Tile', png: 4, variant: 0 };

    const geometry = sandbox.buildRoomGeometryDescriptors([[top], [bottom]]);
    const topDescriptor = geometry.staticBillboards.find(entry => entry.sprite === canopySprite);
    const bottomDescriptor = geometry.staticBillboards.find(entry => entry.sprite === trunkSprite);

    assert.equal(bottomDescriptor.worldZ, 48);
    assert.equal(bottomDescriptor.worldY, undefined);
    assert.equal(topDescriptor.worldZ, 48, 'canopy shares the trunk ground position');
    assert.equal(topDescriptor.worldY, 48, 'canopy is one tile above the trunk');
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

test('3D held-item viewmodel resolves the selected inventory sprite', () => {
    const player = { hand: 1, inv: [{ png: 0 }, { png: 3 }] };

    assert.equal(sandbox.get3DHeldItemSprite(player), staticSprite);
    player.hand = 0;
    assert.equal(sandbox.get3DHeldItemSprite(player), null, 'sprite arrays are not item icons');
    player.inv[0] = 0;
    assert.equal(sandbox.get3DHeldItemSprite(player), null);
});

test('3D held-item viewmodel uses an isolated perspective depth pass', () => {
    assert.match(source, /three3DViewModelCamera = new THREE\.PerspectiveCamera/);
    assert.match(source, /new THREE\.BoxGeometry\(0\.34, 0\.34, 0\.92\)/);
    assert.match(source, /three3DRenderer\.clearDepth\(\)/);
    assert.match(source, /three3DRenderer\.render\(three3DViewModelScene, three3DViewModelCamera\)/);
    assert.match(source, /Math\.sin\(swingProgress \* Math\.PI\)/);
    assert.doesNotMatch(source, /function render3DHeldItemOverlay/);
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
