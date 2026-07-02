/**
 * Time Watch rewind buffer.
 *
 * The Time Watch lets the player run the day clock backwards. On its own that
 * only moved the `days`/`time` counters — the world (crops, entities, shops)
 * kept its already-advanced state, so the next auto-save wrote an inconsistent
 * game and reloading it broke.
 *
 * This module keeps an in-memory ring of full world snapshots, one per day,
 * taken at each new-day rollover ("state at the start of day N"). When the clock
 * rewinds past a day boundary we restore the snapshot for the day we land on, so
 * the world reverts together with the counters and the save stays consistent.
 *
 * Design decisions (see item design notes):
 *  - Granularity: one snapshot per whole day. Rewinding lands you at the start of
 *    a prior day, not an arbitrary tick.
 *  - Depth: the last MAX_SNAPSHOTS days are retained (older ones drop off).
 *  - Scope: world only. The player (coins, inventory, position, hunger) is NOT
 *    reverted — the player keeps the progress they made.
 *
 * Capture/restore deliberately reuse the SAME serialize -> rehydrate path the
 * normal save/load uses (localData + loadLevel), so no parallel reconstruction
 * logic can drift from it.
 */

const MAX_SNAPSHOTS = 7; // days of history retained

// Map of dayNumber -> { levelData: { levelName: plainLevelObject }, meta }.
// Held in memory only; snapshots are never persisted.
let timeRewindSnapshots = {};

/**
 * Deep-clone the plain-data form of every live level, exactly as saveAll would
 * serialize it. Returns a { levelName: plainObject } map suitable for feeding
 * back through loadLevel later.
 */
function captureWorldLevelData() {
    const levelData = {};
    if (typeof levels === 'undefined' || !levels) return levelData;

    // Match saveAll's pre-serialization cleanup so snapshots are as clean as
    // the real save (removes circular refs / non-serializable bits).
    if (typeof removeTemporaryRainFrogsFromLevels === 'function') {
        removeTemporaryRainFrogsFromLevels();
    }

    for (let i = 0; i < levels.length; i++) {
        for (let j = 0; j < levels[i].length; j++) {
            const level = levels[i][j];
            if (!level || level === 0) continue;

            if (typeof level.getReadyForSave === 'function') {
                level.getReadyForSave();
            }
            for (let y = 0; y < level.map.length; y++) {
                for (let x = 0; x < level.map[y].length; x++) {
                    const tile = level.map[y][x];
                    if (tile && tile !== 0 && typeof tile.getReadyForSave === 'function') {
                        tile.getReadyForSave();
                    }
                }
            }

            // Structured deep copy of the plain data. JSON round-trip matches
            // what localData persists (no functions, no prototypes).
            try {
                levelData[level.name] = JSON.parse(JSON.stringify(level));
            } catch (e) {
                console.warn('time-rewind: failed to snapshot level', level.name, e);
            }
        }
    }
    return levelData;
}

/**
 * Take a snapshot representing the world at the start of `dayNumber`.
 * Called at each new-day rollover (forward). Evicts the oldest day once the
 * ring exceeds MAX_SNAPSHOTS.
 */
function captureDaySnapshot(dayNumber) {
    if (typeof dayNumber !== 'number' || isNaN(dayNumber)) return;

    timeRewindSnapshots[dayNumber] = {
        day: dayNumber,
        // Day-scalar world state that lives outside the level objects.
        weather: (typeof currentWeather !== 'undefined') ? currentWeather : 'clear',
        levelData: captureWorldLevelData()
    };

    // Evict oldest days beyond the retention window.
    const keys = Object.keys(timeRewindSnapshots)
        .map(Number)
        .sort((a, b) => a - b);
    while (keys.length > MAX_SNAPSHOTS) {
        const oldest = keys.shift();
        delete timeRewindSnapshots[oldest];
    }
}

/** True if we hold a restorable snapshot for the given day. */
function hasDaySnapshot(dayNumber) {
    return Object.prototype.hasOwnProperty.call(timeRewindSnapshots, dayNumber);
}

/**
 * Restore the world to the snapshot taken at the start of `dayNumber`.
 * Reuses loadLevel so rehydration is identical to loading a save.
 * Player state is intentionally left untouched. Returns true on success.
 */
function restoreDaySnapshot(dayNumber) {
    const snap = timeRewindSnapshots[dayNumber];
    if (!snap || typeof loadLevel !== 'function') return false;

    // Restore day-scalar world state.
    if (typeof snap.weather === 'string') {
        currentWeather = snap.weather;
    }

    for (let i = 0; i < levels.length; i++) {
        for (let j = 0; j < levels[i].length; j++) {
            const level = levels[i][j];
            if (!level || level === 0) continue;

            const saved = snap.levelData[level.name];
            if (saved == null) continue;

            // loadLevel reads the plain data from localData under the level's
            // name — the same channel the real save uses. Stash the snapshot
            // there, rehydrate, then restore whatever the persisted save held so
            // we don't clobber the on-disk save with snapshot data.
            const persisted = localData.get(level.name);
            localData.set(level.name, saved);
            try {
                loadLevel(level);
            } catch (e) {
                console.warn('time-rewind: failed to restore level', level.name, e);
            }
            if (persisted != null) {
                localData.set(level.name, persisted);
            } else {
                localData.remove(level.name);
            }
        }
    }
    return true;
}

/** Clear all snapshots (e.g. on new game / load / world reset). */
function clearTimeRewindSnapshots() {
    timeRewindSnapshots = {};
}
