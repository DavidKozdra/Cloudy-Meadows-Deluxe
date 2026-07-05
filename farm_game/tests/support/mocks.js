'use strict';

// Shared browser / p5.js / game-helper mocks.
//
// The class files assume a running p5 sketch: image drawing, sound objects,
// randomness, and a handful of game helper functions (item/tile factories,
// inventory ops) all live on the global scope. None of that is available under
// node:test, so this module installs deterministic stand-ins. Everything here
// is intentionally simple and predictable so behavioral assertions stay stable.

// A no-op stand-in for the many p5 drawing calls (`push`, `image`, `fill`, ...).
// Returning a chainable object keeps calls like `textFont(x).textSize(y)` safe.
function noop() {}

// Deterministic replacements for p5's stochastic/geometry helpers.
const deterministic = {
    // random(max) -> max/2 ; random(min, max) -> midpoint. Deterministic so
    // growth/yield code takes a single, repeatable branch.
    random: (min, max) => (max === undefined ? min / 2 : (min + max) / 2),
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
    abs: Math.abs,
    min: Math.min,
    max: Math.max,
    millis: () => 1000,
    createVector: (x, y) => ({ x, y }),
    append: (array, item) => array.push(item)
};

// Every p5 drawing / text / transform primitive the class files reach for.
const drawingApi = [
    'push', 'pop', 'image', 'imageMode', 'tint', 'noTint', 'fill', 'noFill',
    'stroke', 'noStroke', 'strokeWeight', 'rect', 'circle', 'ellipse', 'text',
    'textFont', 'textSize', 'textAlign', 'textWidth', 'line', 'point', 'sin',
    'cos', 'createGraphics', 'background', 'translate', 'scale', 'erase', 'noErase'
];

// A silent sound object (game code calls `.play()` / `.pause()` on many).
function silentSound() {
    return { play: noop, pause: noop, stop: noop, setVolume: noop, loop: noop, isPlaying: () => false };
}

// Build a fresh image atlas: all_imgs[png] is an array of "variant" frames.
// Some entries are nested (animation strips) mirroring the real asset layout
// the automation suite relies on (indices 45/46 are robot strips).
function buildImageAtlas() {
    const atlas = Array.from({ length: 200 }, () => [{}, {}, {}, {}]);
    atlas[45] = [[{}], [{}], [{}], [{}]];
    atlas[46] = [[{}], [{}], [{}], [{}]];
    return atlas;
}

// Install a base set of globals that essentially every class file needs.
// Returns the globalThis for convenience. Call resetWorld()/installGameHelpers()
// afterward for the pieces individual suites customize.
function installBaseGlobals() {
    global.window = global.window || {};
    global.document = global.document || {
        getElementById: () => null,
        createElement: () => ({ style: {}, appendChild: noop, insertBefore: noop }),
        querySelector: () => null,
        body: { appendChild: noop }
    };

    global.tileSize = 32;
    global.canvasWidth = 96;
    global.canvasHeight = 96;

    Object.assign(global, deterministic);
    for (const name of drawingApi) {
        if (typeof global[name] !== 'function') global[name] = noop;
    }

    global.paused = false;
    global.all_imgs = buildImageAtlas();
    global.x_img = {};
    global.done_dot = {};

    // Common sound singletons referenced across classes.
    for (const sound of [
        'robot_talkingSound', 'PlantingSound', 'moneySound', 'hoe_sound',
        'EatSound', 'ErrorSound', 'harvestSound', 'waterSound'
    ]) {
        global[sound] = silentSound();
    }

    return global;
}

// World/time state that suites mutate per-case. Reset between cases to keep
// them isolated. `levels` is the 2D grid of Level objects; day/time drive
// plant growth and lighting.
function resetWorld() {
    global.levels = [];
    global.days = 4;
    global.time = 50;
    global.currentLevel_x = 0;
    global.currentLevel_y = 0;
    global.currentWeather = 'clear';
    global.player = { touching: { name: 'grass' }, quests: [], current_quest: 0, talking: 0 };
}

module.exports = {
    noop,
    silentSound,
    buildImageAtlas,
    installBaseGlobals,
    resetWorld
};
