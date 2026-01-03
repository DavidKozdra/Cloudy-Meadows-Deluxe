/**
 * Configuration constants for Cloudy Meadows
 * Extracted from sketch.js and player.js
 */

// === GAME DIMENSIONS ===
const TILE_SIZE = 32;
const GRID_WIDTH = 23;
const GRID_HEIGHT = 19;
const CANVAS_WIDTH = GRID_WIDTH * TILE_SIZE;  // 736
const CANVAS_HEIGHT = GRID_HEIGHT * TILE_SIZE; // 608

// === TIME & GAMEPLAY ===
const DAY_CYCLE_MS = 300;  // milliseconds per game tick (300 = 2 min per day, 150 = 1 min per day)
const HUNGER_DRAIN_INTERVAL = 600;  // milliseconds between hunger drain when full
const HUNGER_DAMAGE_INTERVAL = 400; // milliseconds between damage when hungry
const MAX_HUNGER = 6;
const CLOUD_COUNT = 8;

// === RESPAWN ===
const RESPAWN_TICKS = 600;  // ~10 seconds at 60 FPS
const DEATH_FADE_TICKS = 51; // ~0.85 seconds

// === STARTING POSITION ===
const START_LEVEL_Y = 1;
const START_LEVEL_X = 4;
const START_POS_X = 5 * TILE_SIZE;
const START_POS_Y = 5 * TILE_SIZE;

// === DEFAULT KEY BINDINGS (Key Codes) ===
const DEFAULT_KEYS = {
    INTERACT: 69,     // 'e'
    EAT: 81,          // 'q'
    UP: 87,           // 'w'
    LEFT: 65,         // 'a'
    DOWN: 83,         // 's'
    RIGHT: 68,        // 'd'
    SPECIAL: 16,      // Shift
    QUEST: 80         // 'p'
};

// === DEFAULT KEY STRINGS ===
const DEFAULT_KEY_STRINGS = {
    INTERACT: 'e',
    EAT: 'q',
    UP: 'w',
    LEFT: 'a',
    DOWN: 's',
    RIGHT: 'd',
    SPECIAL: 'shift',
    QUEST: 'p'
};

// === UI CONSTANTS ===
const UI_PADDING = 10;
const INVENTORY_SLOTS = 8;
const QUEST_VISIBLE_COUNT = 6;
const SAVE_ANIMATION_DURATION = 255; // frames

// === ANIMATION SPEEDS ===
const ANIMATION_SPEED = {
    FADE_IN: 5,   // Alpha change per frame
    FADE_OUT: 5,
    MONEY: 2      // Money animation speed
};

// === STORAGE ===
const SAVE_KEY = 'cloudy_meadows_save';
const SAVE_BACKUP_KEY = 'cloudy_meadows_save_backup';
const OPTIONS_KEY = 'Options';
const STORAGE_PASSPHRASE = 'passphrase.life';
