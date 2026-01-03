# Cloudy Meadows - Code Improvement Plan

**Project**: Cloudy Meadows Farm Game  
**Date**: January 1, 2026  
**Status**: Planning Phase

---

## Executive Summary

This document outlines a strategic refactoring plan for the Cloudy Meadows p5.js farm game. The codebase currently consists of ~7,000 lines with significant technical debt including a 2,708-line preload file, 50+ global variables, no module system, and performance issues from updating 15,732+ tiles per frame. This plan addresses the five most critical improvements to enhance maintainability, performance, and developer experience.

---

## Current State Assessment

### Codebase Metrics
- **Total Lines**: ~7,000 across 20+ files
- **Largest File**: [preload.js](farm_game/public/preload.js) (2,708 lines)
- **Architecture**: Object-oriented with inheritance hierarchy
- **Module System**: None (script tags, global namespace)
- **Dependencies**: p5.js v1.4.1, express, localDataStorage
- **Build Tools**: None
- **Testing**: None
- **Performance**: 15,732 tile updates per frame (36 levels)

### Critical Issues
1. Monolithic files mixing concerns
2. Global namespace pollution (50+ variables)
3. Severe performance bottleneck in draw loop
4. Minimal error handling (2 console.error calls total)
5. Extensive code duplication

---

## Improvement #1: Modularize preload.js

### Objective
Split the 2,708-line [preload.js](farm_game/public/preload.js) into focused, maintainable modules.

### Current Problems
- Mixed responsibilities: asset loading, setup, level data, item/tile definitions
- 36 levels with hardcoded 19×23 tile arrays (~1,500 lines)
- Impossible to navigate or maintain
- No separation between data and logic

### Implementation Steps

#### Phase 1: Extract Configuration Data
1. **Create `data/levels.json`**
   - Move all level tile arrays from [preload.js](farm_game/public/preload.js#L2500-L2708)
   - Structure: `{ "levels": [{ "name": "Farmland", "foreground": [[...]], "background": [[...]] }] }`
   - Validate JSON structure

2. **Create `config/items.js`**
   - Extract all `all_items.push()` calls from [preload.js](farm_game/public/preload.js#L815-L1200)
   - Export as structured data: `export const ITEM_DEFINITIONS = [...]`

3. **Create `config/tiles.js`**
   - Extract all `all_tiles.push()` calls from [preload.js](farm_game/public/preload.js#L1200-L1500)
   - Export as structured data: `export const TILE_DEFINITIONS = [...]`

4. **Create `config/constants.js`**
   - Extract magic numbers: `TILE_SIZE`, `GRID_WIDTH`, `GRID_HEIGHT`, `DAY_CYCLE_MS`
   - Extract key bindings configuration
   - Export as named constants

#### Phase 2: Separate Concerns
5. **Create `core/AssetLoader.js`**
   - Move image/audio loading from [preload.js](farm_game/public/preload.js#L1-L800)
   - Class with methods: `loadImages()`, `loadAudio()`, `loadData()`
   - Implement loading progress tracking
   - Add error handling for missing assets

6. **Create `core/GameSetup.js`**
   - Move setup logic from [preload.js](farm_game/public/preload.js#L815-L2500)
   - Methods: `initializeLevels()`, `registerItems()`, `registerTiles()`
   - Consume data from config files

7. **Reduce preload.js to orchestrator**
   - Keep only p5.js `preload()` and `setup()` functions
   - Delegate to AssetLoader and GameSetup
   - Target size: <100 lines

### Success Criteria
- [preload.js](farm_game/public/preload.js) reduced from 2,708 to <100 lines
- All level data in JSON (enable level editor integration)
- Configuration changes don't require code edits
- Each file has single responsibility

### Estimated Effort
**8-12 hours** (data extraction is mechanical but large)

---

## Improvement #2: Implement Module System

### Objective
Convert from script tags and global variables to ES6 modules with bundler.

### Current Problems
- [index.html](farm_game/public/index.html) manually loads 20+ scripts in specific order
- 50+ global variables in [sketch.js](farm_game/public/sketch.js#L8-L50)
- No dependency management
- Difficult to trace what uses what
- 20+ HTTP requests on page load

### Implementation Steps

#### Phase 1: Setup Build System
1. **Install Vite**
   - Run: `npm install -D vite`
   - Create `vite.config.js` for p5.js compatibility
   - Update [package.json](farm_game/package.json) scripts: `"dev": "vite", "build": "vite build"`

2. **Restructure for bundler**
   - Move [public](farm_game/public) contents to `src/`
   - Keep assets in `public/` (images, audio, data)
   - Update asset paths to use Vite's import system

#### Phase 2: Convert to Modules
3. **Add exports to all class files**
   - [classes/Cloud.js](farm_game/public/classes/Cloud.js): `export class Cloud { ... }`
   - [classes/item.js](farm_game/public/classes/item.js): `export class Item { ... }`
   - [classes/level.js](farm_game/public/classes/level.js): `export class Level { ... }`
   - Repeat for all 15+ class files in [classes/](farm_game/public/classes) and [classes/tile_classes/](farm_game/public/classes/tile_classes)

4. **Create `src/main.js` entry point**
   - Import all classes
   - Import p5.js
   - Initialize game instance
   - Replace script tags in [index.html](farm_game/public/index.html) with single `<script type="module" src="/src/main.js">`

5. **Encapsulate global state**
   - Create `core/GameState.js` class
   - Move variables from [sketch.js](farm_game/public/sketch.js#L8-L50) into GameState properties
   - Pass GameState instance to components that need it
   - Remove all `var` declarations from global scope

6. **Update imports throughout**
   - Replace implicit globals with explicit imports
   - [sketch.js](farm_game/public/sketch.js): `import { Player } from './classes/tile_classes/player.js'`
   - [miscfunctions.js](farm_game/public/miscfunctions.js): `import { Item, Seed, Tool } from './classes/item.js'`

### Success Criteria
- Single bundled JS file in production
- No global variables (except p5 instance mode globals)
- Clear import/export dependencies
- Development server with HMR
- HTTP requests reduced from 20+ to 1-2

### Estimated Effort
**12-16 hours** (requires touching every file)

---

## Improvement #3: Fix Draw Loop Performance

### Objective
Eliminate performance bottleneck where all 36 levels (15,732 tiles) update every frame.

### Current Problems
- [sketch.js](farm_game/public/sketch.js#L52-L65) nested loops iterate every level
- Only current level needs updating
- Causes frame drops on slower devices
- Unnecessary CPU usage (36× overhead)

### Implementation Steps

1. **Track active level**
   - Add `activeLevel` reference to GameState
   - Update on level transitions in [classes/tile_classes/player.js](farm_game/public/classes/tile_classes/player.js)

2. **Refactor update loop in [sketch.js](farm_game/public/sketch.js#L52-L65)**
   - **Before**:
     ```javascript
     for (let y = 0; y < levels.length; y++) {
         for (let x = 0; x < levels[y].length; x++) {
             if (levels[y][x] != 0 && levels[y][x] != undefined) {
                 levels[y][x].update(x, y);
             }
         }
     }
     ```
   - **After**:
     ```javascript
     const currentLevel = levels[currentLevel_y][currentLevel_x];
     if (currentLevel) {
         currentLevel.update();
     }
     ```

3. **Update Level class**
   - Modify [classes/level.js](farm_game/public/classes/level.js) `update()` method
   - Have Level iterate its own tiles internally
   - Add viewport culling: only update visible tiles

4. **Implement spatial optimization**
   - Calculate viewport bounds based on camera position
   - Skip tiles outside visible area
   - Potential additional 4-10× improvement

5. **Profile performance**
   - Add FPS counter to debug UI
   - Compare before/after frame times
   - Target: stable 60 FPS on mid-range devices

### Success Criteria
- Only current level updates per frame
- 36× reduction in tile update calls
- Viewport culling implemented (optional stretch goal)
- Stable 60 FPS on test devices
- No visible gameplay changes

### Estimated Effort
**4-6 hours** (straightforward change, requires thorough testing)

---

## Improvement #4: Add Error Handling & Recovery

### Objective
Prevent silent failures and data loss through comprehensive error handling.

### Current Problems
- Only 2 `console.error()` calls in entire codebase
- Factory functions ([miscfunctions.js](farm_game/public/miscfunctions.js#L441-L533)) return `undefined` on failure
- Save/load ([miscfunctions.js](farm_game/public/miscfunctions.js#L535-L705)) assumes localStorage always works
- No user-facing error messages
- Game crashes without explanation

### Implementation Steps

#### Phase 1: Error Utilities
1. **Create `core/ErrorHandler.js`**
   - `logError(error, context)` - Log to console + storage
   - `showErrorToUser(message)` - Display UI notification
   - `captureState()` - Save debug info on crash
   - Consider integration with error tracking service (Sentry)

2. **Create `utils/validators.js`**
   - `validateTileNumber(num)` - Check valid tile range
   - `validateItemNumber(num)` - Check valid item range
   - `validateLevelCoords(x, y)` - Check level bounds
   - Throw descriptive errors on validation failure

#### Phase 2: Factory Functions
3. **Refactor [miscfunctions.js](farm_game/public/miscfunctions.js#L441-L466) `new_tile_from_num()`**
   - Add input validation using `validateTileNumber()`
   - Replace long if-else chain with class registry map
   - Throw errors instead of returning undefined
   - Wrap caller code in try-catch
   ```javascript
   try {
       const tile = new_tile_from_num(tileNum, x, y);
   } catch (error) {
       ErrorHandler.logError(error, { tileNum, x, y });
       // Use fallback default tile
   }
   ```

4. **Refactor [miscfunctions.js](farm_game/public/miscfunctions.js#L467-L495) `new_item_from_num()`**
   - Same approach as tiles
   - Add validation
   - Throw on invalid input

#### Phase 3: Save/Load System
5. **Add error handling to [miscfunctions.js](farm_game/public/miscfunctions.js#L535-L595) `saveState()`**
   ```javascript
   function saveState() {
       try {
           // Existing save logic
           localStorage.setItem('cloudy_meadows_save', data);
           showMessage('Game saved successfully', 'success');
       } catch (error) {
           if (error.name === 'QuotaExceededError') {
               // Implement compression or cleanup
               showMessage('Save failed: Storage full', 'error');
           } else {
               ErrorHandler.logError(error, 'saveState');
               showMessage('Save failed. Check console.', 'error');
           }
       }
   }
   ```

6. **Add error handling to [miscfunctions.js](farm_game/public/miscfunctions.js#L597-L705) `loadState()`**
   - Try-catch around localStorage.getItem
   - Validate loaded data structure before using
   - Fallback to new game if corrupted
   - Show user-friendly message

7. **Implement backup save slot**
   - Keep previous save as `cloudy_meadows_save_backup`
   - Rotate on successful save
   - Allow manual restore if current save corrupted

#### Phase 4: Asset Loading
8. **Add error handling to AssetLoader**
   - Try-catch around image/audio loading
   - Track which assets failed
   - Use placeholder images for missing assets
   - Display error screen if critical assets missing

### Success Criteria
- No undefined returns from factory functions
- User sees error messages when saves fail
- Corrupted saves don't crash game
- Error logs help debug issues
- Backup save prevents total data loss

### Estimated Effort
**10-14 hours** (touches many systems, requires thorough testing)

---

## Improvement #5: Eliminate Code Duplication

### Objective
Extract duplicated code into reusable functions and optimize data structures.

### Current Problems
- UI rendering duplicated 3× in [sketch.js](farm_game/public/sketch.js)
- Item lookup uses O(n) linear search
- Magic numbers throughout codebase
- Maintenance nightmare (change requires 3 edits)

### Implementation Steps

#### Phase 1: UI Deduplication
1. **Extract player stats rendering**
   - Create `ui/PlayerStats.js` class
   - Method: `render(x, y, context)`
   - Consolidate hunger/coin rendering from [sketch.js](farm_game/public/sketch.js)
   - Single source of truth for UI positioning/styling

2. **Create UI component system** (optional)
   - `ui/InventoryUI.js`
   - `ui/ShopUI.js`
   - `ui/DialogueUI.js`
   - Each responsible for own rendering

#### Phase 2: Optimize Data Structures
3. **Convert item array to Map in [miscfunctions.js](farm_game/public/miscfunctions.js#L457-L465)**
   - **Before** (O(n)):
     ```javascript
     function item_name_to_num(item_name) {
         for (let i = 0; i < all_items.length; i++) {
             if (item_name == all_items[i].name) {
                 return i;
             }
         }
     }
     ```
   - **After** (O(1)):
     ```javascript
     const itemsByName = new Map(all_items.map((item, i) => [item.name, i]));
     function item_name_to_num(item_name) {
         return itemsByName.get(item_name) ?? -1;
     }
     ```

4. **Create tile lookup Map**
   - Same optimization for `tile_name_to_num()`
   - Build Map during initialization
   - O(1) lookups instead of O(n)

#### Phase 3: Extract Constants
5. **Audit codebase for magic numbers**
   - Search: `\b\d+\b` regex
   - Identify repeated numbers: 300, 200, 255, 32, etc.
   - Document meaning of each

6. **Centralize in [config/constants.js](farm_game/public/config/constants.js)**
   ```javascript
   export const TILE_SIZE = 32;
   export const GRID_WIDTH = 23;
   export const GRID_HEIGHT = 19;
   export const DAY_CYCLE_MS = 300; // 2 min = 1 day
   export const HUNGER_DRAIN_RATE = 0.001;
   export const UI_PADDING = 10;
   ```

7. **Replace inline numbers with constants**
   - Find/replace across codebase
   - Update [sketch.js](farm_game/public/sketch.js), [preload.js](farm_game/public/preload.js), [classes/player.js](farm_game/public/classes/player.js)

#### Phase 4: Refactor Input Handling
8. **Simplify [classes/player.js](farm_game/public/classes/player.js#L635-L1020) input logic** (stretch goal)
   - 385 lines of nested if-else
   - Extract to state machine or command pattern
   - Create `input/InputHandler.js` class
   - Map keys to command objects

### Success Criteria
- UI rendering code exists in exactly one place
- Item/tile lookups are O(1) with Maps
- No bare numbers in code (except 0, 1, -1)
- All constants documented and centralized
- Input handling cyclomatic complexity reduced

### Estimated Effort
**8-12 hours** (mostly mechanical refactoring)

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
**Goal**: Setup tooling and extract data

1. ✅ Improvement #1 (Modularize preload.js)
   - Extract levels.json, items.js, tiles.js, constants.js
   - Create AssetLoader and GameSetup classes
   - Reduces preload.js to <100 lines

2. ✅ Improvement #2 (Module system)
   - Install Vite
   - Convert to ES6 modules
   - Eliminate global variables

**Deliverables**: Cleaner code structure, faster development iteration

### Phase 2: Performance & Stability (Week 3)
**Goal**: Fix critical runtime issues

3. ✅ Improvement #3 (Draw loop performance)
   - Optimize to update only active level
   - Add viewport culling
   - Achieve stable 60 FPS

4. ✅ Improvement #4 (Error handling)
   - Add ErrorHandler utility
   - Wrap save/load in try-catch
   - Implement backup saves
   - Validate factory function inputs

**Deliverables**: Smooth gameplay, no data loss

### Phase 3: Polish (Week 4)
**Goal**: Clean up and optimize

5. ✅ Improvement #5 (Eliminate duplication)
   - Extract UI components
   - Convert to Map lookups
   - Centralize constants
   - (Optional) Refactor input handling

**Deliverables**: Maintainable, DRY codebase

### Phase 4: Testing & Documentation (Week 5)
6. Add unit tests for game logic
7. Add integration tests for save/load
8. Document architecture and patterns
9. Create contribution guidelines

---

## Risk Assessment & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking existing functionality | High | High | • Comprehensive manual testing checklist<br>• Git branch strategy<br>• Incremental changes with testing |
| Build system complexity | Medium | Medium | • Use Vite (simpler than webpack)<br>• Document setup process<br>• Keep dev dependencies minimal |
| Save file compatibility | High | High | • Version save format<br>• Implement migration system<br>• Keep backup of old saves |
| Performance regression | Low | High | • Profile before/after<br>• Add FPS monitoring<br>• Test on multiple devices |
| Time overrun | Medium | Low | • Prioritize phases 1-3<br>• Phase 4 optional<br>• Each improvement independent |

---

## Success Metrics

### Code Quality
- ✅ Largest file <500 lines (from 2,708)
- ✅ Zero global variables (from 50+)
- ✅ Build system in place
- ✅ Error handling coverage >80%

### Performance
- ✅ 60 FPS on mid-range devices
- ✅ Load time <3 seconds
- ✅ Bundle size <500KB gzipped

### Developer Experience
- ✅ Hot module replacement works
- ✅ Clear file organization
- ✅ Easy to add new items/tiles via config
- ✅ No magic numbers in code

### Player Experience
- ✅ No visible changes (backwards compatible)
- ✅ Saves never corrupt
- ✅ Clear error messages when issues occur

---

## Next Steps

1. **Review this plan** with team/stakeholders
2. **Create feature branch**: `git checkout -b refactor/code-improvements`
3. **Start Phase 1, Step 1**: Extract levels.json
4. **Commit frequently** with clear messages
5. **Test after each step** before proceeding
6. **Document learnings** and update plan as needed

---

## Questions to Resolve

1. **Build tool choice**: Vite recommended, but Parcel or esbuild alternatives?
2. **TypeScript**: Add now or wait until refactor complete?
3. **Testing framework**: Jest, Vitest, or Mocha?
4. **Save format versioning**: How to handle migration from old saves?
5. **Browser support**: Target modern evergreen only, or IE11 compatibility needed?

---

## Appendix: File Structure (Target State)

```
farm_game/
├── package.json
├── vite.config.js
├── public/
│   ├── index.html
│   ├── data/
│   │   └── levels.json
│   ├── images/
│   └── audio/
└── src/
    ├── main.js
    ├── config/
    │   ├── constants.js
    │   ├── items.js
    │   └── tiles.js
    ├── core/
    │   ├── AssetLoader.js
    │   ├── ErrorHandler.js
    │   ├── GameSetup.js
    │   └── GameState.js
    ├── classes/
    │   ├── Cloud.js
    │   ├── Dialogue.js
    │   ├── Item.js
    │   ├── Level.js
    │   ├── Quest.js
    │   ├── Sound.js
    │   └── entities/
    │       ├── Tile.js
    │       ├── Entity.js
    │       ├── Player.js
    │       ├── NPC.js
    │       ├── Plant.js
    │       └── ...
    ├── ui/
    │   ├── PlayerStats.js
    │   ├── InventoryUI.js
    │   ├── ShopUI.js
    │   └── DialogueUI.js
    ├── utils/
    │   ├── validators.js
    │   └── helpers.js
    └── sketch.js (< 200 lines)
```

---
