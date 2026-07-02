
// Handle unhandled promise rejections from localData operations
window.addEventListener('unhandledrejection', event => {
    if (event.reason && event.reason.message && event.reason.message.includes('Permissions')) {
        console.warn('IndexedDB permissions error (expected in some environments):', event.reason);
        event.preventDefault();
    }
});

const ACCESSIBILITY_OPTION_DEFAULTS = Object.freeze({
    reduceMotion: false,
    highContrast: false,
    largeText: false,
    largeControls: false,
    uiScale: 1
});

function getOptionsStore() {
    try {
        if (typeof localData !== 'undefined' && localData) {
            return localData;
        }
    } catch (err) {
        console.warn('Primary options store unavailable, falling back to bootstrap store.', err);
    }

    if (!window.__bootstrapLocalData && typeof localDataStorage === 'function') {
        window.__bootstrapLocalData = localDataStorage('passphrase.life');
    }

    return window.__bootstrapLocalData || null;
}

function clampAccessibilityUIScale(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return ACCESSIBILITY_OPTION_DEFAULTS.uiScale;
    }

    return Math.min(1.4, Math.max(0.9, numericValue));
}

function normalizeAccessibilityOptions(rawOptions = {}) {
    return {
        reduceMotion: !!rawOptions.reduceMotion,
        highContrast: !!rawOptions.highContrast,
        largeText: !!rawOptions.largeText,
        largeControls: !!rawOptions.largeControls,
        uiScale: clampAccessibilityUIScale(rawOptions.uiScale)
    };
}

function getStoredOptions() {
    const store = getOptionsStore();
    if (!store) {
        return null;
    }

    try {
        return store.get('Options') || null;
    } catch (err) {
        console.warn('Failed to read stored options.', err);
        return null;
    }
}

let cachedAccessibilityOptions = normalizeAccessibilityOptions(getStoredOptions() || {});

function buildMergedOptions(overrides = {}) {
    const previousOptions = getStoredOptions() || {};
    const mergedOptions = {
        ...previousOptions,
        ...overrides
    };

    return {
        ...mergedOptions,
        ...normalizeAccessibilityOptions(mergedOptions)
    };
}

function persistOptionsData(overrides = {}) {
    const nextOptions = buildMergedOptions(overrides);
    const store = getOptionsStore();

    if (!store) {
        return nextOptions;
    }

    try {
        store.set('Options', nextOptions);
    } catch (err) {
        console.warn('Failed to persist options.', err);
    }

    return nextOptions;
}

function getAccessibilityOptions(sourceOptions) {
    if (sourceOptions) {
        return normalizeAccessibilityOptions(sourceOptions);
    }

    return cachedAccessibilityOptions;
}

function syncAccessibilityControls(sourceOptions) {
    const accessibilityOptions = getAccessibilityOptions(sourceOptions);

    Array.from(document.querySelectorAll('[data-accessibility-setting]')).forEach(input => {
        const settingKey = input.dataset.accessibilitySetting;
        if (!(settingKey in accessibilityOptions)) {
            return;
        }

        if (input.type === 'checkbox') {
            input.checked = !!accessibilityOptions[settingKey];
            input.setAttribute('aria-checked', input.checked ? 'true' : 'false');
        } else {
            input.value = accessibilityOptions[settingKey];
        }
    });

    Array.from(document.querySelectorAll('[data-accessibility-value="uiScale"]')).forEach(node => {
        node.textContent = accessibilityOptions.uiScale.toFixed(2) + 'x';
    });
}

function applyAccessibilityPrefs(sourceOptions) {
    const accessibilityOptions = getAccessibilityOptions(sourceOptions || getStoredOptions() || {});
    cachedAccessibilityOptions = accessibilityOptions;
    const targetNodes = [document.documentElement];

    if (document.body) {
        targetNodes.push(document.body);
    }

    targetNodes.forEach(node => {
        node.classList.toggle('acc-reduce-motion', accessibilityOptions.reduceMotion);
        node.classList.toggle('acc-high-contrast', accessibilityOptions.highContrast);
        node.classList.toggle('acc-large-text', accessibilityOptions.largeText);
        node.classList.toggle('acc-large-ui', accessibilityOptions.largeControls);
    });

    document.documentElement.style.setProperty('--ui-scale', accessibilityOptions.uiScale.toFixed(2));
    syncAccessibilityControls(accessibilityOptions);
    return accessibilityOptions;
}

function shouldReduceMotion() {
    return getAccessibilityOptions().reduceMotion;
}

function updateAccessibilityOption(settingKey, value) {
    const normalizedValue = settingKey === 'uiScale'
        ? clampAccessibilityUIScale(value)
        : !!value;
    const nextOptions = persistOptionsData({ [settingKey]: normalizedValue });
    applyAccessibilityPrefs(nextOptions);
    return nextOptions;
}

window.applyAccessibilityPrefs = applyAccessibilityPrefs;
window.shouldReduceMotion = shouldReduceMotion;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        applyAccessibilityPrefs();
    }, { once: true });
} else {
    applyAccessibilityPrefs();
}

// Helper function to update canvas pointer-events based on visible menus
function updateCanvasPointerEvents() {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const mainMenuVisible = document.getElementById('main-menu-container')?.style.display !== 'none';
    const difficultyMenuVisible = document.getElementById('difficulty-menu')?.style.display !== 'none';
    const optionsMenuVisible = document.getElementById('options-menu')?.style.display !== 'none';
    const creditsMenuVisible = document.getElementById('credits-menu')?.style.display !== 'none';
    const pauseMenuVisible = document.getElementById('pause-menu')?.style.display !== 'none';
    const questsVisible = document.querySelector('.quests-container')?.style.display !== 'none';
    const loseScreenVisible = document.getElementById('lose-screen')?.style.display !== 'none';
    const configModalVisible = document.getElementById('config-overlay')?.style.display !== 'none';
    const tutorialVisible = document.getElementById('tutorial-overlay')?.style.display !== 'none';
    const cooperativeExchangeOverlay = document.getElementById('cooperative-exchange-overlay');
    const cooperativeExchangeVisible = !!cooperativeExchangeOverlay && cooperativeExchangeOverlay.style.display !== 'none';

    const anyMenuVisible = mainMenuVisible || difficultyMenuVisible || optionsMenuVisible || creditsMenuVisible || pauseMenuVisible || questsVisible || loseScreenVisible || configModalVisible || tutorialVisible || cooperativeExchangeVisible;
    canvas.style.pointerEvents = anyMenuVisible ? 'none' : 'auto';
}

// Helper function to add money and dispatch event
function addMoney(amount) {
    if (amount > 0 && typeof player !== 'undefined' && player) {
        player.coins += amount;
        player.money_anim = 255;
        player.money_anim_amount += amount;
        
        // Dispatch money gained event
        window.dispatchEvent(new CustomEvent('moneyGained', {
            detail: { amount: amount, totalCoins: player.coins }
        }));
        
        // Update quest UI if it's showing - only update relevant parts
        if (player.show_quests && questsContainer) {
            // Just update the quest content, not rebuild everything
            updateQuestContent();
        }
    }
}

function updateQuestContent(){
    if (!questsContainer) return; // Quest panel not open yet
    const questsList = questsContainer.querySelector('.quests-list');
    if (!questsList) return;

    const buttons = questsList.querySelectorAll('.quest-item');
    buttons.forEach(btn => {
        const questIndex = parseInt(btn.getAttribute('data-quest-index'));
        const questContent = btn.querySelector('.quest-content');
        if (questContent && player.quests[questIndex]) {
            questContent.innerHTML = '';
            player.quests[questIndex].render(questContent, player.current_quest === questIndex ? 'yellow' : null);
        }
    });
}

function start(){
    triggerMenuFadeOut(() => {
        startButton.hide();
        optionsButton.hide();
        creditsButton.hide();
        resetControlsButton.hide();
        clearButton.hide();
        hideControls();
        hidePaused();
        title_screen = false;
        if(localData.get('Day_curLvl_Dif') == null){
            dificulty_screen = true;
        }
        paused = false;
        levels[currentLevel_y][currentLevel_x].level_name_popup = true;

        //turn off the title screen
        title_screen = false;
        hideMainMenu();

        if (!dificulty_screen) {
            scheduleContextualTutorials(250);
        }
    });
}

function hasGameSave(){
    // Check only the keys that represent an actual world state, not options
    try {
        return localData.get('player') != null || localData.get('Day_curLvl_Dif') != null || localData.get('extralvlStuff') != null;
    } catch (err) {
        console.warn('Save detection failed, assuming no save', err);
        return false;
    }
}

// Backfill Kiah into older Downtown saves that were created before she was added to the map.
function ensureKiahInLegacyDowntownSave() {
    if (!levels || !levels.length) {
        return false;
    }

    let downtown = null;
    for (let y = 0; y < levels.length; y++) {
        for (let x = 0; x < levels[y].length; x++) {
            if (levels[y][x] && levels[y][x].name === 'The Big City : Downtown') {
                downtown = levels[y][x];
                break;
            }
        }
        if (downtown) {
            break;
        }
    }

    if (!downtown || !downtown.map) {
        return false;
    }

    for (let y = 0; y < downtown.map.length; y++) {
        for (let x = 0; x < downtown.map[y].length; x++) {
            if (downtown.map[y][x] && downtown.map[y][x].name === 'Kiah') {
                return true;
            }
        }
    }

    const preferredSpots = [
        { x: 13, y: 14 },
        { x: 9, y: 14 },
        { x: 17, y: 11 },
        { x: 13, y: 8 }
    ];

    let spawnSpot = preferredSpots.find(({ x, y }) => {
        const tile = downtown.map?.[y]?.[x];
        return tile == null || tile === 0 || (tile.class === 'Tile' && tile.name === 'concrete');
    });

    if (!spawnSpot) {
        for (let y = 0; y < downtown.map.length; y++) {
            for (let x = 0; x < downtown.map[y].length; x++) {
                const tile = downtown.map[y][x];
                if (tile && tile.class === 'Tile' && tile.name === 'concrete') {
                    spawnSpot = { x, y };
                    break;
                }
            }
            if (spawnSpot) {
                break;
            }
        }
    }

    if (!spawnSpot) {
        console.warn('Unable to place Kiah in Downtown: no open concrete tile found');
        return false;
    }

    const kiahTileNum = tile_name_to_num('Kiah');
    if (!kiahTileNum) {
        console.warn('Unable to place Kiah in Downtown: tile definition not found');
        return false;
    }

    downtown.map[spawnSpot.y][spawnSpot.x] = new_tile_from_num(kiahTileNum, spawnSpot.x * tileSize, spawnSpot.y * tileSize);
    return true;
}

// Backfill the Cooperative Exchange into saves made before the Harbor board was interactive.
function ensureCooperativeExchangeBoard() {
    if (!levels || !levels.length) return false;
    let harbor = null;
    for (let y = 0; y < levels.length && !harbor; y++) {
        for (let x = 0; x < levels[y].length; x++) {
            if (levels[y][x]?.name === 'The Big City: Harbor District') {
                harbor = levels[y][x];
                break;
            }
        }
    }
    if (!harbor?.map) return false;
    for (const row of harbor.map) {
        if (row.some(tile => tile?.name === 'Job Board')) return true;
    }
    const x = 10;
    const y = 6;
    const current = harbor.map?.[y]?.[x];
    if (!current || (current.class === 'Tile' && !current.collide)) {
        const boardNum = tile_name_to_num('Job Board');
        if (boardNum) {
            harbor.map[y][x] = new_tile_from_num(boardNum, x * tileSize, y * tileSize);
            return true;
        }
    }
    console.warn('Unable to place Cooperative Exchange board in Harbor District');
    return false;
}

let saveTransferStatus = {
    message: '',
    isError: false
};

let saveTransferMode = null;

function setSaveTransferStatus(message = '', isError = false) {
    saveTransferStatus.message = message;
    saveTransferStatus.isError = isError;

    const statusNodes = document.querySelectorAll('.save-transfer-status');
    statusNodes.forEach((node) => {
        node.textContent = message;
        node.classList.toggle('error', !!message && isError);
        node.classList.toggle('success', !!message && !isError);
    });
}

function hasManagedSaveData() {
    try {
        return hasGameSave() || localData.get('Options') != null || localData.get('Controls') != null;
    } catch (err) {
        console.warn('Save management detection failed, assuming no managed data', err);
        return false;
    }
}

function refreshSaveTransferButtons() {
    const canCopy = hasManagedSaveData();
    const copyButtons = document.querySelectorAll('[data-save-copy-button="true"]');
    copyButtons.forEach((button) => {
        button.disabled = !canCopy;
        button.title = canCopy ? 'Copy the current save data to your clipboard.' : 'No save data is available to copy yet.';
    });
}

function getSavedLevelsForExport() {
    const savedLevels = {};
    for (let y = 0; y < levels.length; y++) {
        for (let x = 0; x < levels[y].length; x++) {
            const level = levels[y][x];
            if (level == 0 || level == undefined) {
                continue;
            }

            const storedLevel = localData.get(level.name);
            if (storedLevel != null) {
                savedLevels[level.name] = storedLevel;
            }
        }
    }
    return savedLevels;
}

function buildSaveExportPayload() {
    try {
        if (typeof saveOptions === 'function' && typeof musicSlider !== 'undefined' && typeof fxSlider !== 'undefined' && musicSlider && fxSlider) {
            saveOptions();
        }
    } catch (err) {
        console.warn('Failed to persist options before copying save data:', err);
    }

    const payload = {
        format: 'cloudy-meadows-save',
        version: 1,
        exportedAt: new Date().toISOString(),
        data: {}
    };

    const rootKeys = ['player', 'Day_curLvl_Dif', 'extralvlStuff', 'Options', 'Controls'];
    for (let i = 0; i < rootKeys.length; i++) {
        const key = rootKeys[i];
        const value = localData.get(key);
        if (value != null) {
            payload.data[key] = value;
        }
    }

    const savedLevels = getSavedLevelsForExport();
    if (Object.keys(savedLevels).length > 0) {
        payload.data.levels = savedLevels;
    }

    if (Object.keys(payload.data).length === 0) {
        throw new Error('No save data found to export.');
    }

    return payload;
}

function getSerializedSaveData() {
    return JSON.stringify(buildSaveExportPayload(), null, 2);
}

function showSaveTransferEditor(mode, value = '') {
    const editor = document.getElementById('save-transfer-editor');
    const editorTitle = document.getElementById('save-transfer-editor-title');
    const textarea = document.getElementById('save-transfer-textarea');
    const copyBtn = document.getElementById('save-transfer-copy-btn');
    const importBtn = document.getElementById('save-transfer-import-btn');
    const fileBtn = document.getElementById('save-transfer-file-btn');
    const cancelBtn = document.getElementById('save-transfer-cancel-btn');

    if (!editor || !editorTitle || !textarea || !copyBtn || !importBtn || !fileBtn || !cancelBtn) {
        return;
    }

    saveTransferMode = mode;
    editor.style.display = 'flex';
    textarea.value = value;
    textarea.readOnly = mode === 'copy';
    editorTitle.textContent = mode === 'copy' ? 'Copy Save Data' : 'Import Save Data';
    copyBtn.style.display = mode === 'copy' ? 'inline-flex' : 'none';
    importBtn.style.display = mode === 'import' ? 'inline-flex' : 'none';
    fileBtn.style.display = mode === 'import' ? 'inline-flex' : 'none';
    cancelBtn.textContent = mode === 'copy' ? 'Close' : 'Cancel';

    requestAnimationFrame(() => {
        textarea.focus();
        if (mode === 'copy') {
            textarea.select();
            textarea.setSelectionRange(0, textarea.value.length);
        }
    });
}

function hideSaveTransferEditor(clearValue = true) {
    const editor = document.getElementById('save-transfer-editor');
    const textarea = document.getElementById('save-transfer-textarea');
    if (editor) {
        editor.style.display = 'none';
    }
    if (textarea && clearValue) {
        textarea.value = '';
    }
    saveTransferMode = null;
}

async function tryCopySaveDataText(text) {
    const textarea = document.getElementById('save-transfer-textarea');

    if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
    }

    if (textarea) {
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        if (document.execCommand && document.execCommand('copy')) {
            return true;
        }
    }

    return false;
}

async function copySaveData() {
    try {
        const serializedData = getSerializedSaveData();
        showSaveTransferEditor('copy', serializedData);
        const copied = await tryCopySaveDataText(serializedData);
        setSaveTransferStatus(copied ? 'Save data copied to clipboard.' : 'Copy was blocked. Use the text box to copy manually.');
        refreshSaveTransferButtons();
    } catch (err) {
        const message = err?.message || 'Failed to copy save data.';
        console.warn('Failed to copy save data:', err);
        setSaveTransferStatus(message, true);
        alert(message);
    }
}

function normalizeImportedSavePayload(payload) {
    const data = payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object'
        ? payload.data
        : payload;

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Invalid save file.');
    }

    if (data.levels != null && (typeof data.levels !== 'object' || Array.isArray(data.levels))) {
        throw new Error('Invalid save file: level data is malformed.');
    }

    const hasImportableData =
        data.player != null ||
        data.Day_curLvl_Dif != null ||
        data.extralvlStuff != null ||
        data.Options != null ||
        data.Controls != null ||
        (data.levels != null && Object.keys(data.levels).length > 0);

    if (!hasImportableData) {
        throw new Error('Save file does not contain any importable data.');
    }

    return data;
}

async function importSaveDataFromText(text) {
    const parsed = JSON.parse(text.trim());
    const data = normalizeImportedSavePayload(parsed);

    localData.clear();

    const rootKeys = ['player', 'Day_curLvl_Dif', 'extralvlStuff', 'Options', 'Controls'];
    for (let i = 0; i < rootKeys.length; i++) {
        const key = rootKeys[i];
        if (data[key] != null) {
            localData.set(key, data[key]);
        }
    }

    if (data.levels != null) {
        for (const levelName in data.levels) {
            if (!Object.prototype.hasOwnProperty.call(data.levels, levelName)) {
                continue;
            }
            const levelData = data.levels[levelName];
            if (levelData != null) {
                localData.set(levelName, levelData);
            }
        }
    }

    setSaveTransferStatus('Save imported. Reloading...');
    refreshSaveTransferButtons();
    alert('Save data imported. The game will reload now.');
    window.location.reload();
}

function ensureSaveImportInput() {
    let input = document.getElementById('save-import-input');
    if (input) {
        return input;
    }

    input = document.createElement('input');
    input.id = 'save-import-input';
    input.type = 'file';
    input.accept = '.json,.txt,application/json,text/plain';
    input.style.display = 'none';
    input.addEventListener('change', async (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) {
            return;
        }

        try {
            const text = await file.text();
            showSaveTransferEditor('import', text);
            setSaveTransferStatus('File loaded. Click "Import Save Data" to continue.');
        } catch (err) {
            const message = err?.message || 'Failed to import save data.';
            console.warn('Failed to import save data:', err);
            setSaveTransferStatus(message, true);
            refreshSaveTransferButtons();
            alert(message);
        } finally {
            event.target.value = '';
        }
    });

    document.body.appendChild(input);
    return input;
}

function promptSaveImport() {
    showSaveTransferEditor('import', '');
    setSaveTransferStatus('Paste save data below or choose a file to import.');
}

function openSaveImportFilePicker() {
    ensureSaveImportInput().click();
}

async function importSaveDataFromEditor() {
    const textarea = document.getElementById('save-transfer-textarea');
    const text = textarea ? textarea.value.trim() : '';

    if (!text) {
        setSaveTransferStatus('Paste save data or choose a file first.', true);
        return;
    }

    if (!confirm('Importing save data will overwrite the current save and local settings. Continue?')) {
        return;
    }

    try {
        await importSaveDataFromText(text);
    } catch (err) {
        const message = err?.message || 'Failed to import save data.';
        console.warn('Failed to import save data:', err);
        setSaveTransferStatus(message, true);
        refreshSaveTransferButtons();
        alert(message);
    }
}

function createSaveTransferStatusNode() {
    const status = document.createElement('div');
    status.className = 'save-transfer-status';
    status.setAttribute('aria-live', 'polite');
    status.textContent = saveTransferStatus.message;
    if (saveTransferStatus.message) {
        status.classList.add(saveTransferStatus.isError ? 'error' : 'success');
    }
    return status;
}

const DEFAULT_TUTORIAL_STATE = {
    fullTutorialSeen: false,
    lastMrCHintDayShown: -1
};

let tutorialPromptQueue = [];
let activeTutorialPrompt = null;
let tutorialShouldResumeGameplay = false;
let tutorialShouldReturnToPauseMenu = false;
let tutorialScheduleTimer = null;

function normalizeTutorialState(state) {
    return {
        fullTutorialSeen: !!state?.fullTutorialSeen,
        lastMrCHintDayShown: Number.isFinite(state?.lastMrCHintDayShown) ? state.lastMrCHintDayShown : -1
    };
}

function getTutorialState() {
    if (!window.tutorialState) {
        window.tutorialState = normalizeTutorialState(DEFAULT_TUTORIAL_STATE);
    }
    return window.tutorialState;
}

function getTutorialStateForSave() {
    return normalizeTutorialState(getTutorialState());
}

function loadTutorialState(savedState) {
    window.tutorialState = normalizeTutorialState(savedState || DEFAULT_TUTORIAL_STATE);
}

function persistTutorialState() {
    try {
        const prev = localData.get('Day_curLvl_Dif') || { days: days || 0, currentLevel_y, currentLevel_x, dificulty };
        prev.tutorialState = getTutorialStateForSave();
        localData.set('Day_curLvl_Dif', prev);
    } catch (err) {
        console.warn('Failed to persist tutorial state', err);
    }
}

function resetTutorialStateForNewGame() {
    window.tutorialState = normalizeTutorialState(DEFAULT_TUTORIAL_STATE);
    tutorialPromptQueue = [];
    activeTutorialPrompt = null;
    persistTutorialState();
}

function isQuestPanelVisible() {
    return document.querySelector('.quests-container')?.style.display === 'flex';
}

function isTutorialOverlayVisible() {
    return document.getElementById('tutorial-overlay')?.style.display === 'flex';
}

function getMainQuest() {
    if (!player || !Array.isArray(player.quests)) {
        return null;
    }
    return player.quests.find(q => q && (q.og_name === 'Save Cloudy Meadows' || q.name === 'Save Cloudy Meadows')) || null;
}

function getMainQuestIndex() {
    if (!player || !Array.isArray(player.quests)) {
        return -1;
    }
    return player.quests.findIndex(q => q && (q.og_name === 'Save Cloudy Meadows' || q.name === 'Save Cloudy Meadows'));
}

function getMainQuestMrCGoal() {
    const mainQuest = getMainQuest();
    if (!mainQuest || !Array.isArray(mainQuest.goals)) {
        return null;
    }
    return mainQuest.goals.find(goal => goal && goal.class === 'TalkingGoal' && goal.npc_name === 'Mr.C') || null;
}

function isMainQuestMrCPending() {
    const mainQuest = getMainQuest();
    const mrCGoal = getMainQuestMrCGoal();
    if (!mainQuest || !mrCGoal) {
        return false;
    }
    return !mainQuest.failed && !mainQuest.done && !mrCGoal.done;
}

function formatTutorialKey(keyName, fallback) {
    const raw = keyName || fallback || '';
    if (!raw) return '';
    return String(raw).length === 1 ? String(raw).toUpperCase() : String(raw);
}

function getInteractTutorialActionLabel() {
    if (typeof isMobile !== 'undefined' && isMobile) {
        return 'Tap Interact';
    }

    return 'Press ' + formatTutorialKey(Controls_Interact_button_key, 'E');
}

function getGameplayControlHints() {
    if (typeof isMobile !== 'undefined' && isMobile) {
        return {
            move: 'Use the on-screen movement pad to move around.',
            interact: 'Tap the Interact button when you see the chat icon over an NPC or object.',
            eat: 'Tap the Eat button when you need to use food from your hand.',
            quest: 'Tap the Quests button in the top-left corner to review your objectives.'
        };
    }

    return {
        move: 'Move with ' + [
            formatTutorialKey(Controls_Up_button_key, 'W'),
            formatTutorialKey(Controls_Left_button_key, 'A'),
            formatTutorialKey(Controls_Down_button_key, 'S'),
            formatTutorialKey(Controls_Right_button_key, 'D')
        ].join(' / ') + '.',
        interact: 'Press ' + formatTutorialKey(Controls_Interact_button_key, 'E') + ' to talk, shop, open containers, or interact with objects.',
        eat: 'Press ' + formatTutorialKey(Controls_Eat_button_key, 'Q') + ' to use the item in your hand.',
        quest: 'Press ' + formatTutorialKey(Controls_Quest_button_key, 'P') + ' to open the quest log and see the current objective.'
    };
}

function findNPCWorldLocation(npcName) {
    if (typeof levels === 'undefined' || !levels || !Array.isArray(levels)) {
        return null;
    }

    for (let levelY = 0; levelY < levels.length; levelY++) {
        for (let levelX = 0; levelX < levels[levelY].length; levelX++) {
            const level = levels[levelY][levelX];
            if (!level || !Array.isArray(level.map)) {
                continue;
            }

            for (let y = 0; y < level.map.length; y++) {
                for (let x = 0; x < level.map[y].length; x++) {
                    const tile = level.map[y][x];
                    if (tile && tile.name === npcName) {
                        return {
                            npc: tile,
                            level,
                            levelX,
                            levelY,
                            x,
                            y
                        };
                    }
                }
            }
        }
    }

    return null;
}

function getMrCTutorialLocationInfo() {
    const found = findNPCWorldLocation('Mr.C');

    if (!found || !found.level) {
        return {
            levelName: 'Cloudy Meadows: Home',
            shortLabel: 'Right outside your house',
            instructions: [
                'Go back to Cloudy Meadows: Home.',
                'Mr.C starts right outside your house at the beginning of the game.'
            ]
        };
    }

    if (found.level.name === 'Cloudy Meadows: Home') {
        return {
            levelName: found.level.name,
            shortLabel: 'Right outside your house',
            instructions: [
                'Go to Cloudy Meadows: Home.',
                'Mr.C starts right outside your house at the beginning of the game.'
            ]
        };
    }

    return {
        levelName: found.level.name,
        shortLabel: 'Follow the highlighted Mr.C sprite',
        instructions: [
            'Go to ' + found.level.name + '.',
            'Look for the glowing highlight around Mr.C.'
        ]
    };
}

function getMrCInteractionHint() {
    return 'Walk up to Mr.C until the chat icon appears, then ' + getInteractTutorialActionLabel().toLowerCase() + ' to talk to him.';
}

function shouldHighlightMrCInWorld(tile) {
    return !!tile &&
        tile.name === 'Mr.C' &&
        typeof player !== 'undefined' &&
        !!player &&
        player.talking !== tile &&
        typeof isMainQuestMrCPending === 'function' &&
        isMainQuestMrCPending();
}

// --- First-time bridge tutorial ----------------------------------------------
// After Mr.C walks off at the start of the game, new players are stranded in the
// Home screen with no idea that the plank/"bridge" tiles at the edges carry them
// to the next area (their farm, the market, etc.). The first time this happens
// we enter a lightweight tutorial mode: every bridge tile on the current screen
// gets a pulsing glow + arrow drawn over it, and an explanatory banner appears.
// The mode ends (and is never shown again) once the player crosses a bridge.
const BRIDGE_TUTORIAL_SEEN_KEY = 'BridgeTutorialSeen';
const BRIDGE_TILE_NAMES = ['Bridge', 'bridge2'];

function isBridgeTile(tile) {
    return !!tile && typeof tile === 'object' && BRIDGE_TILE_NAMES.indexOf(tile.name) !== -1;
}

function hasSeenBridgeTutorial() {
    const store = getOptionsStore();
    if (!store) return false;
    try {
        return store.get(BRIDGE_TUTORIAL_SEEN_KEY) === true;
    } catch (err) {
        console.warn('Failed to read bridge tutorial flag.', err);
        return false;
    }
}

function markBridgeTutorialSeen() {
    const store = getOptionsStore();
    if (!store) return;
    try {
        store.set(BRIDGE_TUTORIAL_SEEN_KEY, true);
    } catch (err) {
        console.warn('Failed to persist bridge tutorial flag.', err);
    }
}

// Called when the opening Mr.C conversation ends and he walks away. Starts the
// tutorial once per save; no-ops if it has already been shown.
function startBridgeTutorial() {
    if (hasSeenBridgeTutorial()) return;
    if (window.bridgeTutorialActive) return;
    window.bridgeTutorialActive = true;
    // Remember the screen we started on so we can detect the player crossing.
    window.bridgeTutorialStartLevel = (typeof levels !== 'undefined' &&
        levels[currentLevel_y] && levels[currentLevel_y][currentLevel_x])
        ? levels[currentLevel_y][currentLevel_x].name
        : null;
    showBridgeTutorialBanner();
}

// Ends the tutorial and records that it has been seen so it never returns.
function endBridgeTutorial() {
    if (!window.bridgeTutorialActive) return;
    window.bridgeTutorialActive = false;
    markBridgeTutorialSeen();
    hideBridgeTutorialBanner();
}

// Draw a pulsing glow + arrow over every bridge tile on the current screen so
// the player's eye is pulled straight to the exit. Mirrors the Mr.C world
// highlight style in level.js. Call from the level render pass (world space).
function renderBridgeTutorialHighlights(level) {
    if (!window.bridgeTutorialActive || !level || !level.map) return;

    // The player crossed to a new screen — mission accomplished, end the tutorial.
    if (window.bridgeTutorialStartLevel && level.name !== window.bridgeTutorialStartLevel) {
        endBridgeTutorial();
        return;
    }

    const reduceMotion = typeof shouldReduceMotion === 'function' && shouldReduceMotion();
    const pulse = reduceMotion ? 0.8 : (0.55 + (0.45 * Math.abs(Math.sin(millis() * 0.006))));

    push();
    for (let i = 0; i < level.map.length; i++) {
        for (let j = 0; j < level.map[i].length; j++) {
            const tile = level.map[i][j];
            if (!isBridgeTile(tile)) continue;

            const centerX = tile.pos.x + (tileSize / 2);
            const centerY = tile.pos.y + (tileSize / 2);

            // Soft glow behind the plank
            noStroke();
            fill(255, 216, 104, 40 + (45 * pulse));
            ellipse(centerX, centerY, tileSize * (1.5 + (0.12 * pulse)), tileSize * (1.5 + (0.12 * pulse)));

            // Bright ring outline
            stroke(255, 239, 174, 220);
            strokeWeight(3);
            noFill();
            rect(tile.pos.x + 2, tile.pos.y + 2, tileSize - 4, tileSize - 4);
        }
    }

    // Draw a bouncing arrow above the bridge tile nearest the player so it reads
    // as "go here" rather than just "these tiles are special".
    const target = findNearestBridgeTile(level);
    if (target) {
        const bounce = reduceMotion ? 0 : (4 * Math.sin(millis() * 0.006));
        const ax = target.pos.x + (tileSize / 2);
        const ay = target.pos.y - 14 - bounce;
        noStroke();
        fill(255, 239, 174, 235);
        // Simple downward-pointing chevron
        triangle(ax - 9, ay - 8, ax + 9, ay - 8, ax, ay + 6);
    }
    pop();
}

function findNearestBridgeTile(level) {
    if (typeof player === 'undefined' || !player || !level || !level.map) return null;
    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i < level.map.length; i++) {
        for (let j = 0; j < level.map[i].length; j++) {
            const tile = level.map[i][j];
            if (!isBridgeTile(tile)) continue;
            const dx = tile.pos.x - player.pos.x;
            const dy = tile.pos.y - player.pos.y;
            const dist = (dx * dx) + (dy * dy);
            if (dist < bestDist) {
                bestDist = dist;
                best = tile;
            }
        }
    }
    return best;
}

function showBridgeTutorialBanner() {
    // Reuse the shared UI popup container that level-name banners live in so the
    // banner is positioned/stacked consistently with the rest of the HUD.
    if (typeof levels !== 'undefined' &&
        levels[currentLevel_y] &&
        levels[currentLevel_y][currentLevel_x] &&
        typeof levels[currentLevel_y][currentLevel_x].ensurePopupContainer === 'function') {
        levels[currentLevel_y][currentLevel_x].ensurePopupContainer();
    }

    const container = document.getElementById('ui-popup-container');
    if (!container) return;

    let banner = document.getElementById('bridge-tutorial-banner');
    if (banner) return; // already showing

    banner = document.createElement('div');
    banner.id = 'bridge-tutorial-banner';

    const isMobileOrSmall = (typeof isMobile !== 'undefined' && isMobile) || window.innerWidth <= 768;
    const fontSize = isMobileOrSmall ? '11px' : '15px';
    const borderWidth = isMobileOrSmall ? '3px' : '5px';
    const maxWidth = isMobileOrSmall ? '200px' : '320px';

    banner.style.maxWidth = maxWidth;
    banner.style.minHeight = (isMobileOrSmall ? 35 : 50) + 'px';
    banner.style.padding = isMobileOrSmall ? '6px 8px' : '8px 12px';
    banner.style.backgroundColor = 'rgb(187, 132, 75)';
    banner.style.border = borderWidth + ' solid rgb(149, 108, 65)';
    banner.style.boxSizing = 'border-box';
    banner.style.fontFamily = 'pixelFont, monospace';
    banner.style.color = 'rgb(255, 255, 255)';
    banner.style.fontSize = fontSize;
    banner.style.lineHeight = '1.35';
    banner.style.display = 'flex';
    banner.style.alignItems = 'center';
    banner.style.justifyContent = 'center';
    banner.style.textAlign = 'center';
    banner.style.fontWeight = 'bold';
    banner.style.textShadow = (isMobileOrSmall ? '2px 2px' : '4px 4px') + ' 0px rgba(0, 0, 0, 0.5)';
    banner.style.marginBottom = '5px';

    banner.textContent = "See the glowing bridge? Walk onto it to cross to the next area.";

    container.appendChild(banner);
}

function hideBridgeTutorialBanner() {
    const banner = document.getElementById('bridge-tutorial-banner');
    if (banner) banner.remove();
}

window.startBridgeTutorial = startBridgeTutorial;
window.endBridgeTutorial = endBridgeTutorial;
window.renderBridgeTutorialHighlights = renderBridgeTutorialHighlights;
window.isBridgeTile = isBridgeTile;

function createTutorialSection(sectionConfig) {
    const section = document.createElement('section');
    section.className = 'tutorial-section' + (sectionConfig.highlight ? ' tutorial-section-highlight' : '');

    if (sectionConfig.title) {
        const title = document.createElement('h3');
        title.className = 'tutorial-section-title';
        title.textContent = sectionConfig.title;
        section.appendChild(title);
    }

    if (sectionConfig.lines && sectionConfig.lines.length) {
        const list = document.createElement('ul');
        list.className = 'tutorial-list';
        sectionConfig.lines.forEach(lineText => {
            const item = document.createElement('li');
            item.textContent = lineText;
            list.appendChild(item);
        });
        section.appendChild(list);
    }

    return section;
}

function createTutorialSpotlightCard(spotlightConfig) {
    const card = document.createElement('div');
    card.className = 'tutorial-spotlight';

    const portraitWrap = document.createElement('div');
    portraitWrap.className = 'tutorial-spotlight-portrait-wrap';
    const portrait = document.createElement('img');
    portrait.className = 'tutorial-spotlight-portrait';
    portrait.src = spotlightConfig.image;
    portrait.alt = spotlightConfig.alt || spotlightConfig.name || 'NPC';
    portrait.width = 96;
    portrait.height = 96;
    portraitWrap.appendChild(portrait);
    card.appendChild(portraitWrap);

    const content = document.createElement('div');
    content.className = 'tutorial-spotlight-content';

    if (spotlightConfig.eyebrow) {
        const eyebrow = document.createElement('div');
        eyebrow.className = 'tutorial-spotlight-eyebrow';
        eyebrow.textContent = spotlightConfig.eyebrow;
        content.appendChild(eyebrow);
    }

    const name = document.createElement('h3');
    name.className = 'tutorial-spotlight-name';
    name.textContent = spotlightConfig.name;
    content.appendChild(name);

    if (spotlightConfig.location) {
        const location = document.createElement('div');
        location.className = 'tutorial-spotlight-location';
        location.textContent = spotlightConfig.location;
        content.appendChild(location);
    }

    const chips = document.createElement('div');
    chips.className = 'tutorial-spotlight-chips';

    if (spotlightConfig.action) {
        const actionChip = document.createElement('div');
        actionChip.className = 'tutorial-spotlight-chip tutorial-spotlight-chip-action';
        actionChip.textContent = spotlightConfig.action;
        chips.appendChild(actionChip);
    }

    if (spotlightConfig.detail) {
        const detailChip = document.createElement('div');
        detailChip.className = 'tutorial-spotlight-chip';
        detailChip.textContent = spotlightConfig.detail;
        chips.appendChild(detailChip);
    }

    content.appendChild(chips);
    card.appendChild(content);

    return card;
}

function createTutorialStepCards(stepConfigs) {
    const steps = document.createElement('div');
    steps.className = 'tutorial-steps';

    stepConfigs.forEach((stepConfig, index) => {
        const step = document.createElement('div');
        step.className = 'tutorial-step' + (stepConfig.highlight ? ' tutorial-step-highlight' : '');

        const number = document.createElement('div');
        number.className = 'tutorial-step-number';
        number.textContent = String(index + 1);
        step.appendChild(number);

        const content = document.createElement('div');
        content.className = 'tutorial-step-content';

        const title = document.createElement('h3');
        title.className = 'tutorial-step-title';
        title.textContent = stepConfig.title;
        content.appendChild(title);

        if (stepConfig.lines && stepConfig.lines.length) {
            const list = document.createElement('ul');
            list.className = 'tutorial-list tutorial-list-compact';
            stepConfig.lines.forEach(lineText => {
                const item = document.createElement('li');
                item.textContent = lineText;
                list.appendChild(item);
            });
            content.appendChild(list);
        }

        step.appendChild(content);
        steps.appendChild(step);
    });

    return steps;
}

function createTutorialAssetGrid(assetConfigs) {
    const grid = document.createElement('div');
    grid.className = 'tutorial-asset-grid';

    assetConfigs.forEach(assetConfig => {
        const card = document.createElement('article');
        card.className = 'tutorial-asset-card';

        const media = document.createElement('div');
        media.className = 'tutorial-asset-media';

        const image = document.createElement('img');
        image.className = 'tutorial-asset-image';
        image.src = assetConfig.image;
        image.alt = assetConfig.alt || assetConfig.title || 'Tutorial asset';
        image.width = assetConfig.width || 52;
        image.height = assetConfig.height || 52;
        media.appendChild(image);
        card.appendChild(media);

        const content = document.createElement('div');
        content.className = 'tutorial-asset-content';

        const title = document.createElement('h4');
        title.className = 'tutorial-asset-title';
        title.textContent = assetConfig.title;
        content.appendChild(title);

        if (assetConfig.description) {
            const description = document.createElement('p');
            description.className = 'tutorial-asset-description';
            description.textContent = assetConfig.description;
            content.appendChild(description);
        }

        card.appendChild(content);
        grid.appendChild(card);
    });

    return grid;
}

function createTutorialDirectoryHero(tabConfig) {
    const hero = document.createElement('section');
    hero.className = 'tutorial-directory-hero';

    const copy = document.createElement('div');
    copy.className = 'tutorial-directory-hero-copy';

    if (tabConfig.eyebrow) {
        const eyebrow = document.createElement('div');
        eyebrow.className = 'tutorial-directory-eyebrow';
        eyebrow.textContent = tabConfig.eyebrow;
        copy.appendChild(eyebrow);
    }

    const title = document.createElement('h3');
    title.className = 'tutorial-directory-title';
    title.textContent = tabConfig.title;
    copy.appendChild(title);

    if (tabConfig.description) {
        const description = document.createElement('p');
        description.className = 'tutorial-directory-description';
        description.textContent = tabConfig.description;
        copy.appendChild(description);
    }

    if (tabConfig.chips && tabConfig.chips.length) {
        const chips = document.createElement('div');
        chips.className = 'tutorial-directory-chips';
        tabConfig.chips.forEach(chipText => {
            const chip = document.createElement('span');
            chip.className = 'tutorial-directory-chip';
            chip.textContent = chipText;
            chips.appendChild(chip);
        });
        copy.appendChild(chips);
    }

    hero.appendChild(copy);

    if (tabConfig.image) {
        const media = document.createElement('div');
        media.className = 'tutorial-directory-hero-media';

        const image = document.createElement('img');
        image.className = 'tutorial-directory-hero-image';
        image.src = tabConfig.image;
        image.alt = tabConfig.alt || tabConfig.title || 'Tutorial topic';
        image.width = 140;
        image.height = 140;
        media.appendChild(image);
        hero.appendChild(media);
    }

    return hero;
}

function createTutorialDirectoryLayout(prompt, options = {}) {
    const directory = document.createElement('div');
    directory.className = 'tutorial-directory';
    if (options.variant) {
        directory.classList.add('tutorial-directory-' + options.variant);
    }

    const nav = document.createElement('div');
    nav.className = 'tutorial-directory-tabs';
    directory.appendChild(nav);

    const content = document.createElement('div');
    content.className = 'tutorial-directory-content';
    directory.appendChild(content);

    const tabs = Array.isArray(prompt.tabs) ? prompt.tabs : [];
    if (!tabs.length) {
        return directory;
    }

    const tabButtons = [];

    const renderActiveTab = (tabId) => {
        const activeTab = tabs.find(tab => tab.id === tabId) || tabs[0];
        content.innerHTML = '';

        tabButtons.forEach(button => {
            const isActive = button.dataset.tabId === activeTab.id;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        content.appendChild(createTutorialDirectoryHero(activeTab));

        if (activeTab.assets && activeTab.assets.length) {
            content.appendChild(createTutorialAssetGrid(activeTab.assets));
        }

        if (activeTab.sections && activeTab.sections.length) {
            const sectionsWrap = document.createElement('div');
            sectionsWrap.className = 'tutorial-directory-sections';
            activeTab.sections.forEach(sectionConfig => {
                sectionsWrap.appendChild(createTutorialSection(sectionConfig));
            });
            content.appendChild(sectionsWrap);
        }
    };

    tabs.forEach((tabConfig, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tutorial-directory-tab';
        button.dataset.tabId = tabConfig.id;

        const label = document.createElement('span');
        label.className = 'tutorial-directory-tab-label';
        label.textContent = tabConfig.label;
        button.appendChild(label);

        if (tabConfig.navHint && !options.hideNavHints) {
            const hint = document.createElement('span');
            hint.className = 'tutorial-directory-tab-hint';
            hint.textContent = tabConfig.navHint;
            button.appendChild(hint);
        }

        button.addEventListener('click', () => {
            renderActiveTab(tabConfig.id);
        });

        nav.appendChild(button);
        tabButtons.push(button);

        if (index === 0) {
            renderActiveTab(tabConfig.id);
        }
    });

    return directory;
}

function ensureTutorialOverlay() {
    let overlay = document.getElementById('tutorial-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'tutorial-overlay';
    overlay.className = 'tutorial-overlay';
    document.body.appendChild(overlay);

    const modal = document.createElement('div');
    modal.id = 'tutorial-modal';
    modal.className = 'tutorial-modal';
    overlay.appendChild(modal);

    const title = document.createElement('h2');
    title.id = 'tutorial-title';
    title.className = 'tutorial-title';
    modal.appendChild(title);

    const intro = document.createElement('p');
    intro.id = 'tutorial-intro';
    intro.className = 'tutorial-intro';
    modal.appendChild(intro);

    const body = document.createElement('div');
    body.id = 'tutorial-body';
    body.className = 'tutorial-body';
    modal.appendChild(body);

    const actions = document.createElement('div');
    actions.id = 'tutorial-actions';
    actions.className = 'tutorial-actions';
    modal.appendChild(actions);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay && activeTutorialPrompt?.allowOverlayClose) {
            closeTutorialOverlay();
        }
    });

    return overlay;
}

function buildFullTutorialPrompt(options = {}) {
    const controls = getGameplayControlHints();
    const mrCLocation = getMrCTutorialLocationInfo();
    const pauseMenuVisible = document.getElementById('pause-menu')?.style.display === 'flex';
    const allowQuestShortcut = !title_screen && !pauseMenuVisible && typeof player !== 'undefined' && !!player;

    return {
        type: 'full-tutorial',
        layout: 'directory',
        allowOverlayClose: true,
        title: 'How To Play',
        intro: 'Use the tabs to learn the core loop, recognize important assets, and find the next useful thing to do.',
        tabs: [
            {
                id: 'start',
                label: 'Start',
                navHint: 'first quest',
                eyebrow: 'First Objective',
                title: 'Meet Mr.C and start the run',
                description: 'If you skip the opening Mr.C conversation, the main story does not move and the game feels stalled.',
                image: 'images/npc/mrC.png',
                alt: 'Mr.C',
                chips: [
                    mrCLocation.levelName,
                    getInteractTutorialActionLabel(),
                    'Follow the world highlight'
                ],
                assets: [
                    {
                        image: 'images/ui/Chat_Icon.png',
                        title: 'Chat Icon',
                        description: 'Stand close until this appears, then interact to start talking.'
                    },
                    {
                        image: 'images/ui/QuestMarker.png',
                        title: 'Quest Marker',
                        description: 'NPCs with markers are usually tied to quests or useful progression.'
                    },
                    {
                        image: 'images/ui/coin.png',
                        title: 'Quest Rewards',
                        description: 'Talking to the right people unlocks rewards, goals, and better routes forward.'
                    }
                ],
                sections: [
                    {
                        title: 'Do This First',
                        highlight: true,
                        lines: [
                            'Go to ' + mrCLocation.levelName + '.',
                            mrCLocation.instructions[1],
                            'Walk up until the chat icon appears, then ' + getInteractTutorialActionLabel().toLowerCase() + '.'
                        ]
                    },
                    {
                        title: 'How To Know It Worked',
                        lines: [
                            'Finish the full conversation with Mr.C.',
                            'If the top-left goal still mentions Mr.C, the conversation is not done yet.',
                            'Open the quest log any time you need to re-check the active objective.'
                        ]
                    }
                ]
            },
            {
                id: 'farming',
                label: 'Farming',
                navHint: 'crop loop',
                eyebrow: 'Main Money Loop',
                title: 'Plant, water, harvest, sell',
                description: 'Most early progress comes from simple farming. Learn the loop once and everything else gets easier.',
                image: 'images/items/Corn_Seed_bag.png',
                alt: 'Corn seeds',
                chips: ['Plant', 'Water', 'Harvest'],
                assets: [
                    {
                        image: 'images/items/Hoe.png',
                        title: 'Hoe',
                        description: 'Use tools to prepare land and support your crop loop.'
                    },
                    {
                        image: 'images/items/Corn_Seed_bag.png',
                        title: 'Seed Bags',
                        description: 'Seeds start the loop. Keep a few on hand so you can replant quickly.'
                    },
                    {
                        image: 'images/items/Sprinkler.png',
                        title: 'Sprinklers',
                        description: ' Some plants need water and placing these next to them will help water tilled soil in a grid.'
                    },
                    {
                        image: 'images/items/Corn_item.png',
                        title: 'Harvest',
                        description: 'Crops become coins, quest items, or emergency food.'
                    }
                ],
                sections: [
                    {
                        title: 'Basic Crop Loop',
                        highlight: true,
                        lines: [
                            'Get seeds, plant them on workable soil, and keep them watered.',
                            'Come back when they finish growing, harvest them, then sell or save the crop.',
                            'Replant quickly so your field keeps making money every day.'
                        ]
                    },
                    {
                        title: 'Good Habits',
                        lines: [
                            'Do not spend every coin at once. Keep enough for more seeds and food.',
                            'Use sprinklers and tools to reduce repetitive work.',
                            'As new crops unlock, compare their speed, value, and quest usefulness.'
                        ]
                    }
                ]
            },
            {
                id: 'money',
                label: 'Money',
                navHint: 'shops + upgrades',
                eyebrow: 'Economy',
                title: 'Earn coins and spend them well',
                description: 'Coins are not just score. They control how fast you scale your farm, storage, and equipment.',
                image: 'images/ui/coin.png',
                alt: 'Coin',
                chips: ['Sell crops', 'Buy tools', 'Scale up'],
                assets: [
                    {
                        image: 'images/ui/coin.png',
                        title: 'Coins',
                        description: 'Treat coins as fuel for progress, not something to hoard forever.'
                    },
                    {
                        image: 'images/items/Corn_item.png',
                        title: 'Produce',
                        description: 'Selling produce is the most reliable early-game income.'
                    },
                    {
                        image: 'images/items/tomato.png',
                        title: 'Better Crops',
                        description: 'Different crops open stronger value and quest options over time.'
                    },
                    {
                        image: 'images/items/backPack.png',
                        title: 'Storage',
                        description: 'Backpacks and chests reduce wasted trips and lost opportunities.'
                    }
                ],
                sections: [
                    {
                        title: 'How To Earn',
                        highlight: true,
                        lines: [
                            'Sell crops often instead of letting your farm sit full.',
                            'Quest rewards and NPC requests add extra coins, items, and direction.',
                            'Larger harvests matter more than random grinding without a plan.'
                        ]
                    },
                    {
                        title: 'How To Spend',
                        lines: [
                            'Prioritize seeds, tools, food, and storage before vanity purchases.',
                            'Use your next upgrade to remove the biggest bottleneck in your current routine.',
                            'If you are always full on inventory, fix storage before anything else.'
                        ]
                    }
                ]
            },
            {
                id: 'survival',
                label: 'Survival',
                navHint: 'hunger + time',
                eyebrow: 'Stay Alive',
                title: 'Manage hunger and day progression',
                description: 'Runs get sloppy when players ignore hunger or burn entire days without purpose.',
                image: 'images/items/HotDog.png',
                alt: 'Food',
                chips: [formatTutorialKey(Controls_Eat_button_key, 'Q'), 'Sleep advances time', 'Carry food'],
                assets: [
                    {
                        image: 'images/ui/Corn_empty.png',
                        title: 'Low Hunger',
                        description: 'When the meter drops, you are close to a problem.'
                    },
                    {
                        image: 'images/ui/Corn_Filled.png',
                        title: 'Recovered Hunger',
                        description: 'Keep food ready so recovery is quick instead of panicked.'
                    },
                    {
                        image: 'images/items/HotDog.png',
                        title: 'Food',
                        description: controls.eat
                    }
                ],
                sections: [
                    {
                        title: 'Hunger',
                        highlight: true,
                        lines: [
                            'Watch the hunger meter and eat before it becomes an emergency.',
                            'Carry food before long trips or work sessions away from home.',
                            'Low hunger slows good decision making because every task becomes urgent.'
                        ]
                    },
                    {
                        title: 'Days And Deadlines',
                        lines: [
                            'Sleeping advances the day, and quest timers continue moving.',
                            'Do not waste full days if the main quest deadline is close.',
                            'A good day has a clear goal before you go to bed.'
                        ]
                    }
                ]
            },
            {
                id: 'tools',
                label: 'Tools',
                navHint: 'storage + travel',
                eyebrow: 'Systems',
                title: 'Use tools, storage, and helpers to scale up',
                description: 'The game opens up once you stop doing everything manually and start using the systems around you.',
                image: 'images/npc/Ticket_Master.png',
                alt: 'Ticket Master',
                chips: ['Storage', 'Automation', 'Travel'],
                assets: [
                    {
                        image: 'images/items/backPack.png',
                        title: 'Backpack',
                        description: 'Carry more so you can work longer before returning home.'
                    },
                    {
                        image: 'images/items/Chest.png',
                        title: 'Chest',
                        description: 'Store overflow items instead of clogging your inventory.'
                    },
                    {
                        image: 'images/items/robot.png',
                        title: 'Robots',
                        description: 'Helpers and commands can automate repeat jobs later in the run.'
                    },
                    {
                        image: 'images/npc/Ticket_Master.png',
                        title: 'Travel',
                        description: 'Use travel systems and map exits to reach other areas and opportunities.'
                    }
                ],
                sections: [
                    {
                        title: 'Reduce Friction',
                        highlight: true,
                        lines: [
                            'Storage is a progression tool. Fix inventory pressure early.',
                            'Use hoes, axes, shovels, sprinklers, and machines to remove routine busywork.',
                            'Helpers matter once your farm is large enough to punish manual play.'
                        ]
                    },
                    {
                        title: 'Explore Smart',
                        lines: [
                            controls.quest,
                            'Talk to NPCs, watch for quest markers, and explore new areas for better tools and quests.',
                            'Save and Quit from the pause menu whenever you need to step away safely.'
                        ]
                    }
                ]
            }
        ],
        buttons: allowQuestShortcut ? [
            { label: 'Open Quests', variant: 'secondary', action: 'open-quests' },
            { label: 'Got It', variant: 'primary', action: 'close' }
        ] : [
            { label: 'Close', variant: 'primary', action: 'close' }
        ],
        onShow: () => {
            if (options.auto) {
                const state = getTutorialState();
                state.fullTutorialSeen = true;
                persistTutorialState();
            }
        }
    };
}

function buildMrCHintPrompt() {
    if (!isMainQuestMrCPending() || days < 1) {
        return null;
    }

    const mrCLocation = getMrCTutorialLocationInfo();

    return {
        type: 'mr-c-reminder',
        theme: 'urgent',
        allowOverlayClose: true,
        title: 'Talk To Mr.C Now',
        intro: 'The run is stalled because the first main quest conversation has not happened yet.',
        spotlight: {
            eyebrow: 'Find This NPC',
            name: 'Mr.C',
            image: 'images/npc/mrC.png',
            alt: 'Mr.C',
            location: mrCLocation.levelName,
            action: getInteractTutorialActionLabel(),
            detail: mrCLocation.shortLabel
        },
        steps: [
            {
                title: 'Find Mr.C',
                highlight: true,
                lines: mrCLocation.instructions
            },
            {
                title: 'Stand Right Next To Mr.C',
                lines: [
                    'Move close until the chat icon appears above him.',
                    'If no icon appears, take one more step closer and face him.'
                ]
            },
            {
                title: getInteractTutorialActionLabel(),
                lines: [
                    'Use the interact control to start the conversation.',
                    'Keep talking until the dialogue finishes and the goal updates.'
                ]
            }
        ],
        sections: [
            {
                title: 'Why You Are Stuck',
                highlight: true,
                lines: [
                    'The first main quest does not move forward until you finish talking to Mr.C.',
                    'If you skip that conversation, the game feels like it is not progressing.',
                    'Mr.C is highlighted in the world now, so follow the glow to him.'
                ]
            },
            {
                title: 'Quick Check',
                lines: [
                    'Open the quest log and look for "Save Cloudy Meadows" if you need a reminder.',
                    getMrCInteractionHint(),
                    'If the top-left goal still says to talk to Mr.C, you have not done it yet.',
                    'After you talk to him, the current goal will change and the run will start moving forward.'
                ]
            }
        ],
        buttons: [
            { label: 'Show Main Quest', variant: 'secondary', action: 'open-quests' },
            { label: 'Got It', variant: 'primary', action: 'close' }
        ],
        onShow: () => {
            const state = getTutorialState();
            state.lastMrCHintDayShown = days;
            const mainQuestIndex = getMainQuestIndex();
            if (mainQuestIndex >= 0 && player) {
                player.current_quest = mainQuestIndex;
            }
            persistTutorialState();
        }
    };
}

function buildTutorialPrompt(type, options = {}) {
    if (type === 'mr-c-reminder') {
        return buildMrCHintPrompt();
    }
    return buildFullTutorialPrompt(options);
}

function renderTutorialPrompt(prompt) {
    const overlay = ensureTutorialOverlay();
    const modal = document.getElementById('tutorial-modal');
    const title = document.getElementById('tutorial-title');
    const intro = document.getElementById('tutorial-intro');
    const body = document.getElementById('tutorial-body');
    const actions = document.getElementById('tutorial-actions');

    if (!modal || !title || !intro || !body || !actions) {
        return;
    }

    overlay.className = 'tutorial-overlay' +
        (prompt.theme === 'urgent' ? ' tutorial-overlay-urgent' : '') +
        (prompt.layout === 'directory' ? ' tutorial-overlay-directory' : '');
    modal.className = 'tutorial-modal' +
        (prompt.theme === 'urgent' ? ' tutorial-modal-urgent' : '') +
        (prompt.layout === 'directory' ? ' tutorial-modal-directory' : '');
    title.textContent = prompt.title;
    intro.textContent = prompt.intro || '';
    intro.style.display = prompt.intro ? 'block' : 'none';
    body.className = 'tutorial-body' + (prompt.layout === 'directory' ? ' tutorial-body-directory' : '');
    body.innerHTML = '';
    actions.innerHTML = '';

    if (prompt.layout === 'directory' && prompt.tabs && prompt.tabs.length) {
        body.appendChild(createTutorialDirectoryLayout(prompt));
    } else if (prompt.spotlight) {
        body.appendChild(createTutorialSpotlightCard(prompt.spotlight));
        if (prompt.steps && prompt.steps.length) {
            body.appendChild(createTutorialStepCards(prompt.steps));
        }
        (prompt.sections || []).forEach(sectionConfig => {
            body.appendChild(createTutorialSection(sectionConfig));
        });
    } else {
        if (prompt.steps && prompt.steps.length) {
            body.appendChild(createTutorialStepCards(prompt.steps));
        }
        (prompt.sections || []).forEach(sectionConfig => {
            body.appendChild(createTutorialSection(sectionConfig));
        });
    }

    prompt.buttons.forEach(buttonConfig => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tutorial-button' + (buttonConfig.variant === 'secondary' ? ' tutorial-button-secondary' : '');
        btn.textContent = buttonConfig.label;
        btn.addEventListener('click', () => {
            if (buttonConfig.action === 'open-quests') {
                closeTutorialOverlay(() => {
                    openQuestLogFromTutorial();
                });
                return;
            }

            closeTutorialOverlay();
        });
        actions.appendChild(btn);
    });

    hideUIPopups();
    tutorialShouldReturnToPauseMenu = document.getElementById('pause-menu')?.style.display === 'flex';
    if (tutorialShouldReturnToPauseMenu) {
        hidePaused();
    }
    tutorialShouldResumeGameplay = !title_screen && !paused;
    if (tutorialShouldResumeGameplay) {
        paused = true;
    }

    overlay.style.display = 'flex';
    activeTutorialPrompt = prompt;
    if (typeof prompt.onShow === 'function') {
        prompt.onShow();
    }
    updateCanvasPointerEvents();
}

function showNextTutorialPrompt() {
    if (activeTutorialPrompt || tutorialPromptQueue.length === 0) {
        return;
    }

    const nextPrompt = tutorialPromptQueue.shift();
    const prompt = buildTutorialPrompt(nextPrompt.type, nextPrompt.options);
    if (!prompt) {
        showNextTutorialPrompt();
        return;
    }

    renderTutorialPrompt(prompt);
}

function queueTutorialPrompt(type, options = {}) {
    const dedupeKey = options.dedupeKey || type;
    if (activeTutorialPrompt?.type === type) {
        return;
    }
    if (tutorialPromptQueue.some(prompt => prompt.dedupeKey === dedupeKey)) {
        return;
    }

    tutorialPromptQueue.push({ type, options, dedupeKey });
    showNextTutorialPrompt();
}

function closeTutorialOverlay(afterClose) {
    const overlay = document.getElementById('tutorial-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }

    activeTutorialPrompt = null;
    if (tutorialShouldReturnToPauseMenu) {
        paused = true;
    } else if (tutorialShouldResumeGameplay) {
        paused = false;
    }
    tutorialShouldResumeGameplay = false;
    tutorialShouldReturnToPauseMenu = false;
    updateCanvasPointerEvents();

    if (typeof afterClose === 'function') {
        afterClose();
    }

    showNextTutorialPrompt();
}

function openQuestLogFromTutorial() {
    if (!player) {
        return;
    }

    const mainQuestIndex = getMainQuestIndex();
    if (mainQuestIndex >= 0) {
        player.current_quest = mainQuestIndex;
    }
    player.show_quests = true;
    showQuests();
}

function shouldAutoShowFullTutorial() {
    const state = getTutorialState();
    const mobileOrSmallScreen = (typeof isMobile !== 'undefined' && isMobile) || window.innerWidth <= 768;
    return !mobileOrSmallScreen && !state.fullTutorialSeen && !title_screen && !lose_screen && days <= 0 && isMainQuestMrCPending();
}

function maybeQueueFullGameTutorial() {
    if (shouldAutoShowFullTutorial()) {
        queueTutorialPrompt('full-tutorial', { auto: true, dedupeKey: 'full-tutorial-auto' });
    }
}

function shouldShowMrCHint() {
    const state = getTutorialState();
    return !title_screen && !lose_screen && days >= 1 && isMainQuestMrCPending() && state.lastMrCHintDayShown !== days;
}

function maybeQueueMrCHint() {
    if (shouldShowMrCHint()) {
        queueTutorialPrompt('mr-c-reminder', { dedupeKey: 'mr-c-day-' + days });
    }
}

function scheduleContextualTutorials(delay = 200) {
    if (tutorialScheduleTimer) {
        window.clearTimeout(tutorialScheduleTimer);
    }

    tutorialScheduleTimer = window.setTimeout(() => {
        maybeQueueFullGameTutorial();
        maybeQueueMrCHint();
    }, delay);
}

function showFullGameTutorial(options = {}) {
    const mobileOrSmallScreen = (typeof isMobile !== 'undefined' && isMobile) || window.innerWidth <= 768;
    if (mobileOrSmallScreen) {
        return;
    }

    queueTutorialPrompt('full-tutorial', { manual: true, dedupeKey: options.dedupeKey || ('full-tutorial-manual-' + (options.source || 'default')) });
}

window.addEventListener('newDay', () => {
    scheduleContextualTutorials(250);
});

// Hide UI popups (goal and location) when not in gameplay
function hideUIPopups() {
    const goalPopup = document.getElementById('current-goal-popup');
    if (goalPopup) {
        goalPopup.style.display = 'none';
    }
    const levelPopup = document.getElementById('level-name-popup');
    if (levelPopup) {
        levelPopup.style.display = 'none';
    }
}

function showTitle(){
    // Hide UI popups on title screen
    hideUIPopups();

    // Render background on canvas
  
        /*
        
          push()
    background(135, 206, 235);
    for (let i = 0; i < clouds.length; i++) {
        clouds[i].update(clouds[i].vel)
        clouds[i].render()
    }
    imageMode(CENTER);
    image(title_screen_img, canvasWidth / 2, (canvasHeight / 2) - 40);
    pop();*/

    if(title_screen){
            // Show DOM-based menu
    showMainMenu();

    }else{
        hideMainMenu();
    }
    if(paused){
        showTitleOptions();
    }
    else{
        hideTitleOptions();
    }
    if(creditsOn){
        showCreditsMenu();
    }
    else{
        hideCreditsMenu();
        cursor('default');
    }
    if(clear_anim){
        clear_data_render();
    }
}

function showMainMenu(){
    let container = document.getElementById('main-menu-container');
    let startBtn = document.getElementById('start-btn');
    if (!container) {
        // Create structure =J BN,/
        container = document.createElement('div');
        container.id = 'main-menu-container';
        container.className = 'main-menu';
        document.body.appendChild(container);
        
        const titleImg = document.createElement('img');
        titleImg.src = 'images/ui/Title_Screen.gif';
        titleImg.alt = 'Title';
        titleImg.className = 'main-menu-title-image';
        container.appendChild(titleImg);

        const deluxeText = document.createElement('div');
        deluxeText.className = 'deluxe-text';
        deluxeText.textContent = 'DELUXE';
        container.appendChild(deluxeText);

        startBtn = document.createElement('button');
        startBtn.id = 'start-btn';
        startBtn.className = 'main-menu-button';
        startBtn.textContent = 'Start'; // Default label in case save check fails early
        startBtn.addEventListener('click', start);
        container.appendChild(startBtn);

        const optionsBtn = document.createElement('button');
        optionsBtn.id = 'options-btn';
        optionsBtn.className = 'main-menu-button';
        optionsBtn.textContent = 'Options';
        optionsBtn.addEventListener('click', () => {
            paused = !paused;
            creditsOn = false;
        });
        container.appendChild(optionsBtn);

        const creditsBtn = document.createElement('button');
        creditsBtn.id = 'credits-btn';
        creditsBtn.className = 'main-menu-button';
        creditsBtn.textContent = 'Credits';
        creditsBtn.addEventListener('click', () => {
            creditsOn = !creditsOn;
            paused = false;
        });
        container.appendChild(creditsBtn);
    }
    // Refresh label every time in case save data was added or cleared
    const hasSavedGame = hasGameSave();
    if (startBtn) {
        startBtn.textContent = hasSavedGame ? 'Continue' : 'Start';
    } else {
        console.warn('Main menu start button missing');
    }
    container.style.display = 'flex';
    updateCanvasPointerEvents();
}

function hideMainMenu(){
    const container = document.getElementById('main-menu-container');
    if (container) container.style.display = 'none';


    updateCanvasPointerEvents();

}

function showDificulty(){
    // Render background on canvas
    push();
    background(135, 206, 235);
    for (let i = 0; i < clouds.length; i++) {
        clouds[i].update(clouds[i].vel)
        clouds[i].render()
    }
    pop();

    // Show DOM-based difficulty menu
    showDifficultyMenu();
}

function showDifficultyMenu(){
    let difficultyMenu = document.getElementById('difficulty-menu');
    if (!difficultyMenu) {
        // Create structure once
        difficultyMenu = document.createElement('div');
        difficultyMenu.id = 'difficulty-menu';
        difficultyMenu.className = 'difficulty-menu';
        document.body.appendChild(difficultyMenu);
        
        const title = document.createElement('h2');
        title.className = 'difficulty-title';
        title.textContent = 'Select Your Difficulty';
        difficultyMenu.appendChild(title);
        
        const container = document.createElement('div');
        container.className = 'difficulty-container';
        container.id = 'difficulty-container';
        difficultyMenu.appendChild(container);
        
        const difficulties = [
            {
                id: 'easy',
                title: 'Easy',
                features: [
                    { label: 'Money Loss', icon: 'checkmark.png', enabled: true },
                    { label: 'Food Rot', icon: 'x.png', enabled: false },
                    { label: 'Perma Death', icon: 'x.png', enabled: false }
                ],
                difficulty: 0
            },
            {
                id: 'medium',
                title: 'Medium',
                features: [
                    { label: 'Money Loss', icon: 'checkmark.png', enabled: true },
                    { label: 'Food Rot', icon: 'checkmark.png', enabled: true },
                    { label: 'Perma Death', icon: 'x.png', enabled: false }
                ],
                difficulty: 1
            },
            {
                id: 'hard',
                title: 'Hard',
                features: [
                    { label: 'Money Loss', icon: 'checkmark.png', enabled: true },
                    { label: 'Food Rot', icon: 'checkmark.png', enabled: true },
                    { label: 'Perma Death', icon: 'checkmark.png', enabled: true }
                ],
                difficulty: 2
            },
            {
                id: 'custom',
                title: 'Custom',
                features: [
                    { label: 'Money Loss', icon: 'checkmark.png', enabled: true, toggleable: true },
                    { label: 'Food Rot', icon: 'checkmark.png', enabled: true, toggleable: true },
                    { label: 'Perma Death', icon: 'x.png', enabled: false, toggleable: true }
                ],
                difficulty: 3
            }
        ];
        
        for (const diff of difficulties) {
            const card = document.createElement('div');
            card.className = `difficulty-card difficulty-card-${diff.id}`;
            
            const cardTitle = document.createElement('h3');
            cardTitle.className = 'difficulty-card-title';
            cardTitle.textContent = diff.title;
            card.appendChild(cardTitle);
            
            for (const feature of diff.features) {
                const featureDiv = document.createElement('div');
                featureDiv.className = 'difficulty-feature';
                
                const label = document.createElement('span');
                label.textContent = feature.label;
                featureDiv.appendChild(label);
                
                if (feature.toggleable) {
                    // Make feature clickable for custom difficulty
                    const toggleBtn = document.createElement('button');
                    toggleBtn.className = 'feature-toggle-btn';
                    toggleBtn.style.background = 'none';
                    toggleBtn.style.border = 'none';
                    toggleBtn.style.padding = '0';
                    toggleBtn.style.cursor = 'pointer';
                    
                    const img = document.createElement('img');
                    img.src = `images/ui/${feature.icon}`;
                    img.alt = feature.label;
                    img.className = 'feature-icon';
                    toggleBtn.appendChild(img);
                    
                    toggleBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        feature.enabled = !feature.enabled;
                        img.src = `images/ui/${feature.enabled ? 'checkmark.png' : 'x.png'}`;
                    });
                    
                    featureDiv.appendChild(toggleBtn);
                } else if (feature.type === 'number') {
                    const input = document.createElement('input');
                    input.type = 'number';
                    input.value = feature.value;
                    input.id = feature.id;
                    input.style.width = '80px';
                    input.style.marginLeft = '10px';
                    input.style.padding = '2px 5px';
                    input.style.borderRadius = '4px';
                    input.style.border = '1px solid #ccc';
                    input.style.fontSize = '14px';
                    
                    // Prevent clicks on input from selecting the difficulty
                    input.addEventListener('click', (e) => e.stopPropagation());
                    
                    featureDiv.appendChild(input);
                } else {
                    const img = document.createElement('img');
                    img.src = `images/ui/${feature.icon}`;
                    img.alt = feature.label;
                    img.className = 'feature-icon';
                    featureDiv.appendChild(img);
                }
                
                card.appendChild(featureDiv);
            }
            
            const btn = document.createElement('button');
            btn.className = 'difficulty-select-btn';
            btn.textContent = 'Select';
            btn.dataset.difficulty = diff.difficulty;
            btn.addEventListener('click', () => {
                if (diff.id === 'custom') {
                    selectCustomDifficulty(diff.features);
                } else {
                    selectDifficulty(diff.difficulty);
                }
            });
            card.appendChild(btn);

            // Add Configure button for Custom difficulty to open modal
            if (diff.id === 'custom') {
                const cfgBtn = document.createElement('button');
                cfgBtn.className = 'difficulty-select-btn';
                cfgBtn.textContent = 'Configure';
                cfgBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showConfigModal();
                });
                card.appendChild(cfgBtn);
            }
            
            container.appendChild(card);
        }
        
        // Add back button
        const backBtn = document.createElement('button');
        backBtn.className = 'difficulty-back-btn';
        backBtn.textContent = 'Back';
        backBtn.addEventListener('click', () => {
            dificulty_screen = false;
            title_screen = true;
            hideDifficultyMenu();
            showMainMenu();
        });
        difficultyMenu.appendChild(backBtn);
        
        // Add scroll hint (CSS controls visibility based on screen size)
        const scrollHint = document.createElement('div');
        scrollHint.className = 'difficulty-scroll-hint';
        scrollHint.innerHTML = 'Scroll for more ↓';
        difficultyMenu.insertBefore(scrollHint, difficultyMenu.firstChild);
    }

    difficultyMenu.style.display = 'flex';
    updateCanvasPointerEvents();
}

function hideDifficultyMenu(){
    const difficultyMenu = document.getElementById('difficulty-menu');
    if (difficultyMenu) difficultyMenu.style.display = 'none';
    updateCanvasPointerEvents();
}

function showLoseScreen() {
    // Hide UI popups on lose screen
    hideUIPopups();
    
    let loseScreen = document.getElementById('lose-screen');
    if (!loseScreen) {
        loseScreen = document.createElement('div');
        loseScreen.id = 'lose-screen';
        loseScreen.className = 'lose-screen';
        document.body.appendChild(loseScreen);

        const title = document.createElement('h1');
        title.className = 'lose-title';
        title.textContent = 'GAME OVER';
        loseScreen.appendChild(title);

        const message = document.createElement('p');
        message.className = 'lose-message';
        message.textContent = 'MR.C now owns the meadows, you failed to gather the funds to stop him.';
        loseScreen.appendChild(message);

        const btn = document.createElement('button');
        btn.className = 'lose-btn';
        btn.textContent = 'Return to Title';
        btn.addEventListener('click', () => {
            deleteSave();
            location.reload(); // Reload to reset everything
        });
        loseScreen.appendChild(btn);
    }
    loseScreen.style.display = 'flex';
    updateCanvasPointerEvents();
}

function deleteSave() {
    localData.remove('player');
    localData.remove('Day_curLvl_Dif');
    localData.remove('extralvlStuff');
    // Remove all levels
    for(let i = 0; i < levels.length; i++){
        for(let j = 0; j < levels[i].length; j++){
            if(levels[i][j] != 0 && levels[i][j] != undefined){
                localData.remove(levels[i][j].name);
            }
        }
    }
}

function selectDifficulty(difficulty){
    dificulty = difficulty;
    window.customRules = null;
    days = 0;
    dayOfWeek = 0;
    time = 0;
    timephase = 0;
    currentWeather = 'clear';
    if (typeof lastRainDay !== 'undefined') {
        lastRainDay = -999;
    }
    if (typeof lastFrogRainDay !== 'undefined') {
        lastFrogRainDay = -999;
    }
    if (typeof frogRainEntities !== 'undefined') {
        frogRainEntities = [];
    }
    resetTutorialStateForNewGame();
    
    // Proceed directly into the game without showing difficulty screen again
    hideDifficultyMenu();
    dificulty_screen = false;
    title_screen = false;
    paused = false;

    console.log('Starting game with difficulty:', difficulty);
    // Ensure weather is rolled for the current day when starting a game
    if (typeof generateDailyWeather === 'function') {
        try { generateDailyWeather(); } catch(e) { console.warn('Failed to roll weather at game start:', e); }
    }

    try {
        localData.set('Day_curLvl_Dif', {
            days: 0,
            currentLevel_y,
            currentLevel_x,
            dificulty,
            currentWeather,
            time,
            timephase,
            customRules: null,
            tutorialState: getTutorialStateForSave()
        });
        console.log('Difficulty saved:', difficulty);
    } catch (e) {
        console.warn('Failed to save difficulty:', e);
    }

    levels[currentLevel_y][currentLevel_x].level_name_popup = true;
    scheduleContextualTutorials(250);
}

function selectCustomDifficulty(features){
    dificulty = 3; // Custom difficulty
    days = 0;
    dayOfWeek = 0;
    time = 0;
    timephase = 0;
    currentWeather = 'clear';
    if (typeof lastRainDay !== 'undefined') {
        lastRainDay = -999;
    }
    if (typeof lastFrogRainDay !== 'undefined') {
        lastFrogRainDay = -999;
    }
    if (typeof frogRainEntities !== 'undefined') {
        frogRainEntities = [];
    }
    resetTutorialStateForNewGame();
    
    const questCoinsInput = document.getElementById('custom-quest-coins');
    const questDaysInput = document.getElementById('custom-quest-days');
    // Prefer rules saved via modal; otherwise build from card state
    const modalRules = window.customRules || null;
    const rules = modalRules ? {
        moneyLoss: typeof modalRules.moneyLoss === 'boolean' ? modalRules.moneyLoss : features[0].enabled,
        foodRot: typeof modalRules.foodRot === 'boolean' ? modalRules.foodRot : features[1].enabled,
        permaDeath: typeof modalRules.permaDeath === 'boolean' ? modalRules.permaDeath : features[2].enabled,
        mainQuestCoins: (typeof modalRules.mainQuestCoins === 'number' ? modalRules.mainQuestCoins : (questCoinsInput ? parseInt(questCoinsInput.value) : 10000)),
        mainQuestDays: (typeof modalRules.mainQuestDays === 'number' ? modalRules.mainQuestDays : (questDaysInput ? parseInt(questDaysInput.value) : 100)),
        startingCoins: (typeof modalRules.startingCoins === 'number' ? modalRules.startingCoins : 0),
        // PRESERVE all custom config from modal!
        weatherWeights: modalRules.weatherWeights || null,
        npcEnabled: modalRules.npcEnabled || null,
        crittersEnabled: modalRules.crittersEnabled || null,
        areasEnabled: modalRules.areasEnabled || null,
        itemsEnabled: modalRules.itemsEnabled || null,
        itemPriceMultiplier: modalRules.itemPriceMultiplier ?? 100
    } : {
        moneyLoss: features[0].enabled,
        foodRot: features[1].enabled,
        permaDeath: features[2].enabled,
        mainQuestCoins: questCoinsInput ? parseInt(questCoinsInput.value) : 10000,
        mainQuestDays: questDaysInput ? parseInt(questDaysInput.value) : 100,
        startingCoins: 0,
        weatherWeights: null,
        npcEnabled: null,
        crittersEnabled: null,
        areasEnabled: null,
        itemsEnabled: null,
        itemPriceMultiplier: 100
    };
    window.customRules = rules;
    console.log('selectCustomDifficulty: Final rules with weatherWeights:', rules.weatherWeights);
    
    // Proceed directly into the game
    hideDifficultyMenu();
    dificulty_screen = false;
    title_screen = false;
    paused = false;
    
    console.log('Starting game with custom difficulty:', window.customRules);
    // Ensure weather is rolled for the current day when starting a custom game
    if (typeof generateDailyWeather === 'function') {
        try { generateDailyWeather(); } catch(e) { console.warn('Failed to roll weather at custom start:', e); }
    }
    
    try {
        localData.set('Day_curLvl_Dif', {
            days: 0,
            currentLevel_y,
            currentLevel_x,
            dificulty,
            currentWeather,
            time,
            timephase,
            customRules: window.customRules,
            tutorialState: getTutorialStateForSave()
        });
        console.log('Custom difficulty saved:', window.customRules);
    } catch (e) {
        console.warn('Failed to save custom difficulty:', e);
    }

    // Update player quests if player already exists
    if (typeof player !== 'undefined' && player.quests) {
        for (let q of player.quests) {
            if (q.og_name === "Save Cloudy Meadows") {
                q.days = window.customRules.mainQuestDays;
                q.maxDays = q.days;
                for (let goal of q.goals) {
                    if (goal.class === 'FundingGoal') {
                        goal.amount = window.customRules.mainQuestCoins;
                    }
                }
                // Refresh name with new days
                if (q.maxDays > 0) {
                    q.name = q.og_name + ' ' + q.days + ' days left';
                }
            }
        }
        // Apply starting coins immediately on new games (no saved player yet)
        try {
            const hasSavedPlayer = localData.get('player') != null;
            if (!hasSavedPlayer && typeof window.customRules?.startingCoins === 'number') {
                player.coins = window.customRules.startingCoins;
            }
        } catch (e) {
            // If localData is unavailable, fall back to applying when coins are zero
            if (player.coins === 0 && typeof window.customRules?.startingCoins === 'number') {
                player.coins = window.customRules.startingCoins;
            }
        }
    }

    // Apply NPC/critter filter rules immediately when starting with custom difficulty
    applyNPCFilterRules();
    applyCritterFilterRules();
    applyAreaRules();
    applyItemPrices();
    removeDisabledItemsFromInventory();

    levels[currentLevel_y][currentLevel_x].level_name_popup = true;
    scheduleContextualTutorials(250);
}

let controlsContainer = null;
let controlRows = [];

function resetControls() {
    // Reset all control key bindings to defaults
    Controls_Interact_button_key = 'e';
    Controls_Eat_button_key = 'q';
    Controls_Up_button_key = 'w';
    Controls_Down_button_key = 's';
    Controls_Left_button_key = 'a';
    Controls_Right_button_key = 'd';
    Controls_Special_button_key = 'Shift';
    Controls_Quest_button_key = 'q';
    
    // Save the reset controls
    saveOptions();
    
    // Refresh the controls display if the options menu is open
    const controlsContainer = document.getElementById('title-controls-container');
    if (controlsContainer) {
        renderControlButtons(controlsContainer);
    }
    
    // Refresh pause menu controls if pause menu is open
    const pauseControlsContainer = document.getElementById('pause-controls-container');
    if (pauseControlsContainer && pauseControlsContainer.parentElement.style.display !== 'none') {
        renderControlButtons(pauseControlsContainer);
    }
}

function renderControlButtons(container) {
    // Skip rendering on mobile - touch controls are used instead
    const isMobileOrSmallScreen = (typeof isMobile !== 'undefined' && isMobile) || window.innerWidth <= 768;
    if (isMobileOrSmallScreen) {
        return;
    }

    const controlItems = [
        { label: 'Interact:', key: () => Controls_Interact_button_key || 'z', controlIndex: 1 },
        { label: 'Eat:', key: () => Controls_Eat_button_key || 'e', controlIndex: 2 },
        { label: 'Up:', key: () => Controls_Up_button_key || 'w', controlIndex: 3 },
        { label: 'Down:', key: () => Controls_Down_button_key || 's', controlIndex: 4 },
        { label: 'Left:', key: () => Controls_Left_button_key || 'a', controlIndex: 5 },
        { label: 'Right:', key: () => Controls_Right_button_key || 'd', controlIndex: 6 },
        { label: 'Special:', key: () => Controls_Special_button_key || 'x', controlIndex: 7 },
        { label: 'Quest:', key: () => Controls_Quest_button_key || 'q', controlIndex: 8 }
    ];
    
    // If container is provided, use it as parent (for pause menu, options, etc.)
    if (container) {
        container.innerHTML = '';
        
        for (let i = 0; i < controlItems.length; i++) {
            const item = controlItems[i];
            
            const row = document.createElement('div');
            row.className = 'control-row';
            row.style.display = 'flex';
            row.style.gap = '10px';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.width = '100%';
            row.style.padding = '4px 0';
            
            const label = document.createElement('span');
            label.className = 'control-label';
            label.textContent = item.label;
            label.style.minWidth = '70px';
            row.appendChild(label);
            
            const button = document.createElement('button');
            button.className = 'control-button';
            button.style.minWidth = '60px';
            button.style.cursor = 'pointer';
            button.style.pointerEvents = 'auto';
            const keyValue = item.key();
            button.textContent = keyValue ? String(keyValue) : '?';
            
            const clickHandler = function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('CLICK DETECTED - Control button clicked:', item.label, 'controlIndex:', item.controlIndex);
                console.log('Activating keymapping mode...');
                console.log('keymapping defined?:', typeof keymapping !== 'undefined');
                
                if (typeof keymapping !== 'undefined') {
                    keymapping = true;
                    currentMappingIndex = item.controlIndex;
                    control_set = item.controlIndex;
                    button.textContent = 'Press Key...';
                    console.log('Keymapping active for control:', item.controlIndex);
                } else {
                    console.error('keymapping variable not defined!');
                }
            };
            
            button.addEventListener('click', clickHandler);
            button.addEventListener('mousedown', function(e) {
                console.log('MOUSEDOWN on button:', item.label);
            });
            
            row.appendChild(button);
            container.appendChild(row);
        }
        console.log('Inline buttons created, total:', controlItems.length);
        return;
    }
    
    // Otherwise use the global container for game canvas (original behavior)
    if (!controlsContainer) {
        controlsContainer = document.createElement('div');
        controlsContainer.className = 'controls-container';
        document.getElementById('game-container').appendChild(controlsContainer);
        
        for (let i = 0; i < controlItems.length; i++) {
            const item = controlItems[i];
            const row = document.createElement('div');
            row.className = 'control-row';
            
            const label = document.createElement('div');
            label.className = 'control-label';
            label.textContent = item.label;
            row.appendChild(label);
            
            const button = document.createElement('button');
            button.className = 'control-button';
            button.addEventListener('click', () => {
                console.log('Control button clicked (canvas):', item.label, 'controlIndex:', item.controlIndex);
                console.log('Activating keymapping mode...');
                
                if (typeof keymapping !== 'undefined') {
                    keymapping = true;
                    currentMappingIndex = item.controlIndex;
                    control_set = item.controlIndex;
                    button.textContent = 'Press Key...';
                    console.log('Keymapping active for control:', item.controlIndex);
                } else {
                    console.error('keymapping variable not defined!');
                }
            });
            row.appendChild(button);
            
            controlsContainer.appendChild(row);
            controlRows.push({ row, button });
        }
    }
    
    controlsContainer.style.left = x + 'px';
    controlsContainer.style.top = y + 'px';
    controlsContainer.style.display = 'flex';
    
    for (let i = 0; i < controlItems.length; i++) {
        const { button } = controlRows[i];
        const keyValue = controlItems[i].key();
        const keyLength = keyValue.length;
        const fontSize = keyLength > 5 ? Math.max(15 - ((keyLength - 5) * 1.5), 8) : 15;
        
        button.style.fontSize = fontSize + 'px';
        button.textContent = keyValue;
        
        if (control_set === controlItems[i].controlIndex) {
            controlRows[i].row.classList.add('highlighted');
        } else {
            controlRows[i].row.classList.remove('highlighted');
        }
    }
}

function hideControls() {
    if (controlsContainer) {
        controlsContainer.style.display = 'none';
        // toggle labels as well
        for (let i = 0; i < controlRows.length; i++) {
            controlRows[i].row.classList.remove('highlighted');
        }
    }


}

function createAccessibilityToggleControl(contextId, settingKey, labelText, descriptionText) {
    const row = document.createElement('label');
    row.className = 'accessibility-toggle-row';
    row.htmlFor = contextId + '-accessibility-' + settingKey;

    const copy = document.createElement('span');
    copy.className = 'accessibility-copy';

    const title = document.createElement('span');
    title.className = 'accessibility-label';
    title.textContent = labelText;
    copy.appendChild(title);

    const description = document.createElement('span');
    description.className = 'accessibility-description';
    description.id = contextId + '-accessibility-' + settingKey + '-description';
    description.textContent = descriptionText;
    copy.appendChild(description);

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = contextId + '-accessibility-' + settingKey;
    input.className = 'accessibility-toggle-input';
    input.dataset.accessibilitySetting = settingKey;
    input.setAttribute('aria-describedby', description.id);
    input.addEventListener('change', () => {
        updateAccessibilityOption(settingKey, input.checked);
    });

    row.appendChild(copy);
    row.appendChild(input);
    return row;
}

function createAccessibilityScaleControl(contextId) {
    const row = document.createElement('div');
    row.className = 'accessibility-scale-row';

    const copy = document.createElement('div');
    copy.className = 'accessibility-copy';

    const title = document.createElement('label');
    title.className = 'accessibility-label';
    title.htmlFor = contextId + '-accessibility-uiScale';
    title.textContent = 'UI Scale';
    copy.appendChild(title);

    const description = document.createElement('span');
    description.className = 'accessibility-description';
    description.id = contextId + '-accessibility-uiScale-description';
    description.textContent = 'Scale menu and overlay interface elements without changing browser zoom.';
    copy.appendChild(description);

    const controls = document.createElement('div');
    controls.className = 'accessibility-scale-input-wrap';

    const input = document.createElement('input');
    input.type = 'range';
    input.id = contextId + '-accessibility-uiScale';
    input.className = 'accessibility-scale-input';
    input.min = '0.9';
    input.max = '1.4';
    input.step = '0.05';
    input.dataset.accessibilitySetting = 'uiScale';
    input.setAttribute('aria-describedby', description.id);
    input.addEventListener('input', () => {
        updateAccessibilityOption('uiScale', input.value);
    });

    const value = document.createElement('span');
    value.className = 'accessibility-scale-value';
    value.dataset.accessibilityValue = 'uiScale';
    value.textContent = ACCESSIBILITY_OPTION_DEFAULTS.uiScale.toFixed(2) + 'x';

    controls.appendChild(input);
    controls.appendChild(value);
    row.appendChild(copy);
    row.appendChild(controls);
    return row;
}

function createAccessibilitySettingsSection(contextId, sectionOptions = {}) {
    const section = document.createElement('div');
    section.className = (sectionOptions.compact ? 'pause-menu-section' : 'options-section') + ' accessibility-settings-section';

    const title = document.createElement(sectionOptions.compact ? 'div' : 'h3');
    title.className = sectionOptions.compact ? 'pause-controls-title' : 'options-section-title';
    title.textContent = 'Accessibility';
    section.appendChild(title);

    const intro = document.createElement('p');
    intro.className = (sectionOptions.compact ? 'pause-menu-label' : 'options-section-description') + ' accessibility-section-intro';
    intro.textContent = 'Tune motion, contrast, text, and control size so the interface stays comfortable to use.';
    section.appendChild(intro);

    const list = document.createElement('div');
    list.className = 'accessibility-settings-list';
    list.appendChild(createAccessibilityScaleControl(contextId));
    list.appendChild(createAccessibilityToggleControl(
        contextId,
        'reduceMotion',
        'Reduce Motion',
        'Disable menu transitions and animated interface movement where possible.'
    ));
    list.appendChild(createAccessibilityToggleControl(
        contextId,
        'highContrast',
        'High Contrast UI',
        'Strengthen panel, text, and focus contrast for menus and overlay controls.'
    ));
    list.appendChild(createAccessibilityToggleControl(
        contextId,
        'largeText',
        'Larger Text',
        'Increase menu, prompt, and overlay text for better legibility.'
    ));
    list.appendChild(createAccessibilityToggleControl(
        contextId,
        'largeControls',
        'Larger UI Controls',
        'Increase button size and touch targets across menu and mobile controls.'
    ));
    section.appendChild(list);

    return section;
}

function showOptions(){
    push()
    stroke(149, 108, 65);
    strokeWeight(5);
    fill(187, 132, 75);
    rectMode(CENTER);
    rect(((4*canvasWidth)/5)+50, canvasHeight/2, 300, canvasHeight);
    fill(255);
    stroke(0);
    strokeWeight(2);
    textFont(player_2);
    textAlign(CENTER, CENTER);
    textSize(30);
    text('Option', ((4*canvasWidth)/5)+40, 30);
    image(music_note_img, ((4*canvasWidth)/5)-80, (canvasHeight/6)-50);
    image(fx_img, ((4*canvasWidth)/5)-80, (canvasHeight/6)-10);
    pop()
    
    // Show DOM-based options menu
    showTitleOptions();
}

function setActiveTitleOptionsTab(tabId) {
    const optionsMenu = document.getElementById('options-menu');
    if (!optionsMenu) return;

    optionsMenu.dataset.activeTab = tabId;

    Array.from(optionsMenu.querySelectorAll('.options-tab')).forEach(tab => {
        const isActive = tab.dataset.tab === tabId;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    Array.from(optionsMenu.querySelectorAll('.options-tab-panel')).forEach(panel => {
        const isActive = panel.dataset.tab === tabId;
        panel.classList.toggle('active', isActive);
        panel.hidden = !isActive;
    });
}

function showTitleOptions(){
    let optionsMenu = document.getElementById('options-menu');
    if (!optionsMenu) {
        optionsMenu = document.createElement('div');
        optionsMenu.id = 'options-menu';
        optionsMenu.className = 'title-options-menu';
        document.body.appendChild(optionsMenu);

        const optionsShell = document.createElement('div');
        optionsShell.className = 'title-options-shell';
        optionsMenu.appendChild(optionsShell);

        const title = document.createElement('h2');
        title.className = 'options-title';
        title.textContent = 'Options';
        optionsShell.appendChild(title);

        const tabBar = document.createElement('div');
        tabBar.className = 'options-tab-bar';
        tabBar.setAttribute('role', 'tablist');
        optionsShell.appendChild(tabBar);

        const panelWrap = document.createElement('div');
        panelWrap.className = 'options-panel-wrap';
        optionsShell.appendChild(panelWrap);

        const createOptionsPanel = (tabId, label) => {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'options-tab';
            tab.dataset.tab = tabId;
            tab.textContent = label;
            tab.id = 'title-options-tab-' + tabId;
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-controls', 'title-options-panel-' + tabId);
            tab.setAttribute('aria-selected', 'false');
            tab.setAttribute('tabindex', '-1');
            tab.addEventListener('click', () => {
                setActiveTitleOptionsTab(tabId);
            });
            tabBar.appendChild(tab);

            const panel = document.createElement('div');
            panel.className = 'options-tab-panel';
            panel.dataset.tab = tabId;
            panel.id = 'title-options-panel-' + tabId;
            panel.setAttribute('role', 'tabpanel');
            panel.setAttribute('aria-labelledby', tab.id);
            panel.hidden = true;
            panelWrap.appendChild(panel);
            return panel;
        };

        const mobileOrSmallScreen = (typeof isMobile !== 'undefined' && isMobile) || window.innerWidth <= 768;
        const audioPanel = createOptionsPanel('audio', 'Audio');
        const accessibilityPanel = createOptionsPanel('accessibility', 'Accessibility');
        const controlsPanel = !mobileOrSmallScreen ? createOptionsPanel('controls', 'Controls') : null;
        const dataPanel = createOptionsPanel('data', 'Data');
        const helpPanel = !mobileOrSmallScreen ? createOptionsPanel('help', 'Help') : null;

        const audioSection = document.createElement('div');
        audioSection.className = 'options-section';

        const musicRow = document.createElement('div');
        musicRow.className = 'slider-row';
        const musicIcon = document.createElement('img');
        musicIcon.src = 'images/ui/Music_Note.png';
        musicIcon.alt = 'Music';
        musicIcon.className = 'options-icon';
        const musicLabel = document.createElement('label');
        musicLabel.htmlFor = 'music-slider-title';
        musicLabel.textContent = 'Music';
        const musicSlider = document.createElement('input');
        musicSlider.id = 'music-slider-title';
        musicSlider.type = 'range';
        musicSlider.min = '0';
        musicSlider.max = '1';
        musicSlider.step = '0.01';
        musicSlider.className = 'options-slider';
        musicSlider.addEventListener('input', () => {
            window.musicSlider.value(musicSlider.value);
        });
        musicRow.appendChild(musicIcon);
        musicRow.appendChild(musicLabel);
        musicRow.appendChild(musicSlider);
        audioSection.appendChild(musicRow);

        const fxRow = document.createElement('div');
        fxRow.className = 'slider-row';
        const fxIcon = document.createElement('img');
        fxIcon.src = 'images/ui/fx.png';
        fxIcon.alt = 'FX';
        fxIcon.className = 'options-icon';
        const fxLabel = document.createElement('label');
        fxLabel.htmlFor = 'fx-slider-title';
        fxLabel.textContent = 'Sound';
        const fxSlider = document.createElement('input');
        fxSlider.id = 'fx-slider-title';
        fxSlider.type = 'range';
        fxSlider.min = '0';
        fxSlider.max = '1';
        fxSlider.step = '0.01';
        fxSlider.className = 'options-slider';
        fxSlider.addEventListener('input', () => {
            window.fxSlider.value(fxSlider.value);
        });
        fxRow.appendChild(fxIcon);
        fxRow.appendChild(fxLabel);
        fxRow.appendChild(fxSlider);
        audioSection.appendChild(fxRow);
        audioPanel.appendChild(audioSection);
        accessibilityPanel.appendChild(createAccessibilitySettingsSection('title'));

        if (controlsPanel) {
            const controlsSection = document.createElement('div');
            controlsSection.className = 'options-section options-controls-section';
            controlsSection.id = 'options-controls-section';

            const controlsTitle = document.createElement('h3');
            controlsTitle.className = 'options-section-title';
            controlsTitle.textContent = 'Controls';
            controlsSection.appendChild(controlsTitle);

            const controlsContainer = document.createElement('div');
            controlsContainer.id = 'title-controls-container';
            controlsContainer.className = 'title-controls-container';
            controlsSection.appendChild(controlsContainer);
            controlsPanel.appendChild(controlsSection);

            const controlsActions = document.createElement('div');
            controlsActions.className = 'options-button-group';
            const resetBtn = document.createElement('button');
            resetBtn.id = 'reset-controls-btn';
            resetBtn.className = 'options-button';
            resetBtn.textContent = 'Reset Controls';
            resetBtn.addEventListener('click', () => {
                resetControls();
            });
            controlsActions.appendChild(resetBtn);
            controlsPanel.appendChild(controlsActions);
        }

        const dataSection = document.createElement('div');
        dataSection.className = 'options-section options-data-section';
        const dataTitle = document.createElement('h3');
        dataTitle.className = 'options-section-title';
        dataTitle.textContent = 'Data Management';
        dataSection.appendChild(dataTitle);
        const dataDescription = document.createElement('p');
        dataDescription.className = 'options-section-description';
        dataDescription.textContent = 'Permanently remove saves and local settings.';
        dataSection.appendChild(dataDescription);
        const dataActions = document.createElement('div');
        dataActions.className = 'options-button-group';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'options-button';
        copyBtn.textContent = 'Copy Save Data';
        copyBtn.dataset.saveCopyButton = 'true';
        copyBtn.addEventListener('click', copySaveData);
        dataActions.appendChild(copyBtn);
        const importBtn = document.createElement('button');
        importBtn.className = 'options-button';
        importBtn.textContent = 'Import Save Data';
        importBtn.addEventListener('click', promptSaveImport);
        dataActions.appendChild(importBtn);
        const clearBtn = document.createElement('button');
        clearBtn.id = 'clear-data-btn';
        clearBtn.className = 'options-button options-button-danger';
        clearBtn.textContent = 'Clear All Saved Data';
        clearBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all saved data and local settings? This cannot be undone.')) {
                clear_anim = true;
                try {
                    localData.clear();
                    console.log('Data cleared from IndexedDB');
                    setTimeout(() => {
                        console.log('Reloading window...');
                        window.location.reload();
                    }, 1500);
                } catch (e) {
                    console.warn('Failed to clear data:', e);
                    window.location.reload();
                }
            }
        });
        dataActions.appendChild(clearBtn);
        dataSection.appendChild(dataActions);
        dataSection.appendChild(createSaveTransferStatusNode());
        const dataEditor = document.createElement('div');
        dataEditor.id = 'save-transfer-editor';
        dataEditor.className = 'save-transfer-editor';
        dataEditor.style.display = 'none';
        const dataEditorTitle = document.createElement('div');
        dataEditorTitle.id = 'save-transfer-editor-title';
        dataEditorTitle.className = 'save-transfer-editor-title';
        dataEditor.textContent = '';
        dataEditor.appendChild(dataEditorTitle);
        const dataTextarea = document.createElement('textarea');
        dataTextarea.id = 'save-transfer-textarea';
        dataTextarea.className = 'save-transfer-textarea';
        dataTextarea.spellcheck = false;
        dataTextarea.placeholder = 'Paste save data here or choose a file to import.';
        dataEditor.appendChild(dataTextarea);
        const dataEditorActions = document.createElement('div');
        dataEditorActions.className = 'save-transfer-actions';
        const copyAgainBtn = document.createElement('button');
        copyAgainBtn.id = 'save-transfer-copy-btn';
        copyAgainBtn.className = 'options-button';
        copyAgainBtn.textContent = 'Copy Again';
        copyAgainBtn.addEventListener('click', copySaveData);
        dataEditorActions.appendChild(copyAgainBtn);
        const importNowBtn = document.createElement('button');
        importNowBtn.id = 'save-transfer-import-btn';
        importNowBtn.className = 'options-button';
        importNowBtn.textContent = 'Import Save Data';
        importNowBtn.addEventListener('click', importSaveDataFromEditor);
        dataEditorActions.appendChild(importNowBtn);
        const chooseFileBtn = document.createElement('button');
        chooseFileBtn.id = 'save-transfer-file-btn';
        chooseFileBtn.className = 'options-button';
        chooseFileBtn.textContent = 'Choose File';
        chooseFileBtn.addEventListener('click', openSaveImportFilePicker);
        dataEditorActions.appendChild(chooseFileBtn);
        const cancelTransferBtn = document.createElement('button');
        cancelTransferBtn.id = 'save-transfer-cancel-btn';
        cancelTransferBtn.className = 'options-button';
        cancelTransferBtn.textContent = 'Cancel';
        cancelTransferBtn.addEventListener('click', () => hideSaveTransferEditor());
        dataEditorActions.appendChild(cancelTransferBtn);
        dataEditor.appendChild(dataEditorActions);
        dataSection.appendChild(dataEditor);
        dataPanel.appendChild(dataSection);

        if (helpPanel) {
            const helpSection = document.createElement('div');
            helpSection.className = 'options-section';
            const helpTitle = document.createElement('h3');
            helpTitle.className = 'options-section-title';
            helpTitle.textContent = 'How to Play';
            helpSection.appendChild(helpTitle);
            const helpDescription = document.createElement('p');
            helpDescription.className = 'options-section-description';
            helpDescription.textContent = 'Open the tabbed gameplay guide with art, controls, and progression tips.';
            helpSection.appendChild(helpDescription);
            const helpActions = document.createElement('div');
            helpActions.className = 'options-button-group';
            const tutorialBtn = document.createElement('button');
            tutorialBtn.className = 'options-button';
            tutorialBtn.textContent = 'How to Play';
            tutorialBtn.addEventListener('click', () => {
                showFullGameTutorial({ source: 'title-options' });
            });
            helpActions.appendChild(tutorialBtn);
            helpSection.appendChild(helpActions);
            helpPanel.appendChild(helpSection);
        }

        const backBtn = document.createElement('button');
        backBtn.id = 'back-btn';
        backBtn.className = 'options-back-button';
        backBtn.textContent = 'Back';
        backBtn.addEventListener('click', () => {
            paused = false;
            hideTitleOptions();
        });
        optionsShell.appendChild(backBtn);

        setActiveTitleOptionsTab('audio');
    }

    const musicSliderDOM = document.getElementById('music-slider-title');
    const fxSliderDOM = document.getElementById('fx-slider-title');
    const controlsContainer = document.getElementById('title-controls-container');

    if (musicSliderDOM) {
        musicSliderDOM.value = musicSlider.value();
    }
    if (fxSliderDOM) {
        fxSliderDOM.value = fxSlider.value();
    }

    if (controlsContainer && controlsContainer.childElementCount === 0) {
        renderControlButtons(controlsContainer);
    }

    const preferredTab = optionsMenu.dataset.activeTab || 'audio';
    const availableTab = optionsMenu.querySelector('.options-tab[data-tab="' + preferredTab + '"]') ? preferredTab : 'audio';
    setActiveTitleOptionsTab(availableTab);
    syncAccessibilityControls();
    refreshSaveTransferButtons();
    optionsMenu.style.display = 'flex';
    updateCanvasPointerEvents();
}

function hideTitleOptions(){
    const optionsMenu = document.getElementById('options-menu');
    if (optionsMenu) optionsMenu.style.display = 'none';
    hideSaveTransferEditor();
    updateCanvasPointerEvents();
}

// ==================== CONFIG MODAL ====================
function ensureConfigModal() {
    let overlay = document.getElementById('config-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'config-overlay';
    overlay.className = 'config-overlay';
    document.body.appendChild(overlay);

    const modal = document.createElement('div');
    modal.className = 'config-modal';
    overlay.appendChild(modal);

    const title = document.createElement('h3');
    title.className = 'config-title';
    title.textContent = 'Configure Game Rules';
    modal.appendChild(title);

    const tabBar = document.createElement('div');
    tabBar.className = 'config-tab-bar';
    modal.appendChild(tabBar);

    const panelWrap = document.createElement('div');
    panelWrap.className = 'config-tab-panels';
    modal.appendChild(panelWrap);

    function createTabPanel(tabId, label, helpText) {
        const tabBtn = document.createElement('button');
        tabBtn.type = 'button';
        tabBtn.className = 'config-tab';
        tabBtn.dataset.tab = tabId;
        tabBtn.textContent = label;
        tabBtn.addEventListener('click', () => {
            setActiveConfigTab(tabId);
        });
        tabBar.appendChild(tabBtn);

        const panel = document.createElement('div');
        panel.className = 'config-panel';
        panel.dataset.tab = tabId;
        panelWrap.appendChild(panel);

        if (helpText) {
            const help = document.createElement('div');
            help.className = 'config-panel-help';
            help.textContent = helpText;
            panel.appendChild(help);
        }
        return panel;
    }

    function createSection(container, titleText, helpText) {
        const section = document.createElement('section');
        section.className = 'config-section';
        container.appendChild(section);

        if (titleText) {
            const titleEl = document.createElement('div');
            titleEl.className = 'config-subtitle';
            titleEl.textContent = titleText;
            section.appendChild(titleEl);
        }

        if (helpText) {
            const helpEl = document.createElement('div');
            helpEl.className = 'config-help';
            helpEl.textContent = helpText;
            section.appendChild(helpEl);
        }

        return section;
    }

    function addSliderRow(container, labelText, id, min = 0, max = 100, step = 1) {
        const row = document.createElement('div');
        row.className = 'config-row';
        const label = document.createElement('label');
        label.className = 'config-label';
        label.htmlFor = id;
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'range';
        input.id = id;
        input.className = 'config-slider';
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        const valueBadge = document.createElement('span');
        valueBadge.className = 'config-slider-value';
        valueBadge.textContent = '0';
        input.addEventListener('input', () => {
            valueBadge.textContent = String(input.value);
            // Keep total at 100 by balancing with Clear
            normalizeWeatherTotal(id);
        });
        row.appendChild(label);
        row.appendChild(input);
        row.appendChild(valueBadge);
        container.appendChild(row);
    }

    function addNumberRow(container, labelText, id, placeholder) {
        const row = document.createElement('div');
        row.className = 'config-row';
        const label = document.createElement('label');
        label.className = 'config-label';
        label.htmlFor = id;
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'number';
        input.id = id;
        input.className = 'config-input';
        input.placeholder = placeholder || '';
        row.appendChild(label);
        row.appendChild(input);
        container.appendChild(row);
    }

    function addToggleRow(container, labelText, id) {
        const row = document.createElement('div');
        row.className = 'config-row';
        const label = document.createElement('label');
        label.className = 'config-label';
        label.htmlFor = id;
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        input.className = 'config-checkbox';
        row.appendChild(label);
        row.appendChild(input);
        container.appendChild(row);
    }

    function addBulkToggleActions(container, grid, onChange) {
        const actions = document.createElement('div');
        actions.className = 'config-actions config-inline-actions';

        const allOnBtn = document.createElement('button');
        allOnBtn.type = 'button';
        allOnBtn.className = 'config-btn';
        allOnBtn.textContent = 'All On';
        allOnBtn.addEventListener('click', () => {
            Array.from(grid.querySelectorAll('.config-grid-item')).forEach(el => el.classList.add('active'));
            if (typeof onChange === 'function') onChange();
        });

        const allOffBtn = document.createElement('button');
        allOffBtn.type = 'button';
        allOffBtn.className = 'config-btn';
        allOffBtn.textContent = 'All Off';
        allOffBtn.addEventListener('click', () => {
            Array.from(grid.querySelectorAll('.config-grid-item')).forEach(el => el.classList.remove('active'));
            if (typeof onChange === 'function') onChange();
        });

        actions.appendChild(allOnBtn);
        actions.appendChild(allOffBtn);
        container.appendChild(actions);
    }

    const corePanel = createTabPanel('core', 'Rules', 'Quest goals and survival rules live here.');
    const worldPanel = createTabPanel('world', 'World', 'Weather and area access are grouped together.');
    const peoplePanel = createTabPanel('people', 'People', 'NPC and critter availability can be managed separately.');
    const itemsPanel = createTabPanel('items', 'Items', 'Item unlocks and price overrides are organized here.');

    const coreSection = createSection(corePanel, 'Quest and Survival');
    addNumberRow(coreSection, 'Main Quest Coins', 'cfg-main-quest-coins', 'e.g. 10000');
    addNumberRow(coreSection, 'Main Quest Days', 'cfg-main-quest-days', 'e.g. 100');
    addNumberRow(coreSection, 'Starting Coins', 'cfg-starting-coins', 'e.g. 0');
    addToggleRow(coreSection, 'Money Loss', 'cfg-money-loss');
    addToggleRow(coreSection, 'Food Rot', 'cfg-food-rot');
    addToggleRow(coreSection, 'Perma Death', 'cfg-perma-death');

    // NPC toggle grid
    const npcSection = createSection(peoplePanel, 'NPCs', 'Enable or disable individual characters for this run.');
    const npcGrid = document.createElement('div');
    npcGrid.id = 'cfg-npc-grid';
    npcGrid.className = 'config-grid config-sprite-grid';
    // Build grid from dialogue keys (fallback to empty list)
    const npcNames = Object.keys(typeof Dialouge_JSON !== 'undefined' && Dialouge_JSON ? Dialouge_JSON : {});
    
    // NPC name to image path mapping
    const NPC_SPRITE_MAP = {
        'Deb': 'images/npc/deb.png',
        'Rick': 'images/npc/cowboy_rick.png',
        'Meb': 'images/npc/meb.png',
        'Mario': 'images/npc/mario.png',
        'Garry': 'images/npc/garry.png',
        'Mira': 'images/npc/mira.png',
        'OldManJ': 'images/npc/old_man_jay1.png',
        'Brandon': 'images/npc/brandon.png',
        'Brent': 'images/npc/brent.png',
        'BlindPete': 'images/npc/blind_pete.png',
        'James': 'images/npc/james.png',
        'Liam': 'images/npc/liam.png',
        'Zoda': 'images/npc/christian.png',
        'Super Tina': 'images/npc/supertina.png',
        'Guy': 'images/npc/Guy.png',
        'Vinny': 'images/npc/vinny.png',
        'Kenny': 'images/npc/kenny.png',
        'Ishmil': 'images/npc/Ishmil.png',
        'David': 'images/npc/David.png',
        'Adam': 'images/npc/Adam.png',
        'Barry': 'images/npc/Barry.png',
        'Mr.C': 'images/npc/mrC.png',
        'Dog': 'images/npc/dog_right.png',
        'Ticket Master': 'images/npc/Ticket_Master.png',
        'Sarah': 'images/npc/mira.png',
        'Elena': 'images/npc/Sophia.png',
        'Thomas': 'images/npc/Thomas.png',
        'Victoria': 'images/npc/Victoria.png',
        'Dante': 'images/npc/Barry.png',
        'Kai': 'images/npc/kenny.png',
        'Coral': 'images/npc/coral.png',
        'Fisher Joe': 'images/npc/fisher_joe.png',
        'Sandy': 'images/npc/sandy.png',
        'Skipper': 'images/npc/skipper.png',
        'Alex Chen': 'images/npc/chen.png',
        'Priya Patel': 'images/npc/priya.png',
        'Marcus Brown': 'images/npc/marcus.png',
        'Sophia Moore': 'images/npc/Sophia.png',
        'Jordan Kim': 'images/npc/Jordan_Kim.png',
        'Kiah': 'images/npc/Kiah.png',
        'Jake': 'images/npc/Jake.png',
        'Chef': 'images/npc/chef.png',
        'Rob Botus': 'images/npc/Rob_Botus.png'
    };
    
    npcNames.forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'config-grid-item config-sprite-item';
        btn.dataset.npcName = name;
        
        // Create sprite img element
        const spriteImg = document.createElement('img');
        spriteImg.className = 'config-sprite-img';
        spriteImg.width = 32;
        spriteImg.height = 32;
        spriteImg.style.imageRendering = 'pixelated';
        const imgPath = NPC_SPRITE_MAP[name] || 'images/npc/cowboy_rick.png';
        spriteImg.src = imgPath;
        spriteImg.alt = name;
        btn.appendChild(spriteImg);
        
        // Add name label
        const label = document.createElement('span');
        label.className = 'config-sprite-label';
        label.textContent = name;
        btn.appendChild(label);
        
        // Click toggles active state
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
        });
        npcGrid.appendChild(btn);
    });
    npcSection.appendChild(npcGrid);
    addBulkToggleActions(npcSection, npcGrid);

    // Critters toggle grid (frogs, fireflies, bees, bunnies, etc.)
    const crittersSection = createSection(peoplePanel, 'Critters', 'Ambient creatures can be toggled without affecting NPCs.');
    const crittersGrid = document.createElement('div');
    crittersGrid.id = 'cfg-critters-grid';
    crittersGrid.className = 'config-grid config-sprite-grid';
    
    // Critter definitions with sprites
    const CRITTER_DEFINITIONS = [
        { name: 'Frog', sprite: 'images/npc/frog_front.png' },
        { name: 'LightBug', sprite: 'images/tiles/FireFlys.gif' },
        { name: 'Bees', sprite: 'images/tiles/Bees.gif' },
        { name: 'ladybug', sprite: 'images/tiles/LadyBugs.gif' }
    ];
    
    CRITTER_DEFINITIONS.forEach(critter => {
        const btn = document.createElement('button');
        btn.className = 'config-grid-item config-sprite-item active';
        btn.dataset.critterName = critter.name;
        
        const spriteImg = document.createElement('img');
        spriteImg.className = 'config-sprite-img';
        spriteImg.width = 32;
        spriteImg.height = 32;
        spriteImg.style.imageRendering = 'pixelated';
        spriteImg.src = critter.sprite;
        spriteImg.alt = critter.name;
        btn.appendChild(spriteImg);
        
        const label = document.createElement('span');
        label.className = 'config-sprite-label';
        label.textContent = critter.name;
        btn.appendChild(label);
        
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
        });
        crittersGrid.appendChild(btn);
    });
    crittersSection.appendChild(crittersGrid);
    addBulkToggleActions(crittersSection, crittersGrid);

    // Weather rarity sliders (weights; higher = more likely)
    const weatherSection = createSection(worldPanel, 'Weather Rarity', 'Non-clear weather sliders are balanced automatically against Clear.');
    addSliderRow(weatherSection, 'Partly Cloudy', 'cfg-weather-partly', 0, 100, 1);
    addSliderRow(weatherSection, 'Overcast', 'cfg-weather-overcast', 0, 100, 1);
    addSliderRow(weatherSection, 'Fog', 'cfg-weather-fog', 0, 100, 1);
    addSliderRow(weatherSection, 'Sunshower', 'cfg-weather-sunshower', 0, 100, 1);
    addSliderRow(weatherSection, 'Rain', 'cfg-weather-rain', 0, 100, 1);
    addSliderRow(weatherSection, 'Thunderstorm', 'cfg-weather-thunderstorm', 0, 100, 1);
    addSliderRow(weatherSection, 'Frog Rain', 'cfg-weather-frog', 0, 100, 0.1);

    // Total indicator (always kept at 100%)
    const totalRow = document.createElement('div');
    totalRow.className = 'config-row';
    const totalSpacer = document.createElement('div');
    totalSpacer.style.flex = '1';
    const totalBadge = document.createElement('div');
    totalBadge.id = 'cfg-weather-total';
    totalBadge.className = 'config-slider-remaining';
    totalBadge.textContent = 'Clear: 100%';
    totalRow.appendChild(totalSpacer);
    totalRow.appendChild(totalBadge);
    weatherSection.appendChild(totalRow);

    // Areas/Levels toggle grid
    const areasSection = createSection(worldPanel, 'Areas', 'Disable large regions if you want a narrower world.');
    const areasGrid = document.createElement('div');
    areasGrid.id = 'cfg-areas-grid';
    areasGrid.className = 'config-grid';
    // Define areas with their sub-levels
    const AREA_DEFINITIONS = [
        { name: 'Cloudy Meadows', prefix: 'Cloudy Meadows' },
        { name: 'Poly Park', prefix: 'Poly Park' },
        { name: 'Swiggy Swamps', prefix: 'Swiggy Swamps' },
        { name: 'The Big City', prefix: 'The Big City' },
        { name: 'Beach', prefix: 'Beach' }
    ];
    AREA_DEFINITIONS.forEach(area => {
        const btn = document.createElement('button');
        btn.className = 'config-grid-item active'; // Areas on by default
        btn.dataset.areaName = area.name;
        btn.dataset.areaPrefix = area.prefix;
        btn.textContent = area.name;
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
        });
        areasGrid.appendChild(btn);
    });
    areasSection.appendChild(areasGrid);
    addBulkToggleActions(areasSection, areasGrid);

    // Items toggle grid with individual prices
    const itemsSection = createSection(itemsPanel, 'Items', 'Toggle individual items and override any base shop price.');
    const itemDefs = typeof ITEM_DEFINITIONS !== 'undefined' ? ITEM_DEFINITIONS : [];
    const ITEM_CLASS_LABELS = {
        Eat: 'Food',
        Seed: 'Seeds',
        Placeable: 'Placeables',
        Command: 'Commands',
        Tool: 'Tools',
        Item: 'Materials',
        Backpack: 'Storage'
    };
    const itemClasses = [];
    itemDefs.forEach(item => {
        if (!item || !item.name) return;
        const itemClass = item.class || 'Item';
        if (!itemClasses.includes(itemClass)) {
            itemClasses.push(itemClass);
        }
    });

    const itemsToolbar = document.createElement('div');
    itemsToolbar.className = 'config-items-toolbar';

    const itemsToolbarTop = document.createElement('div');
    itemsToolbarTop.className = 'config-items-toolbar-top';

    const itemsSearchWrap = document.createElement('div');
    itemsSearchWrap.className = 'config-item-search-wrap';

    const itemsSearch = document.createElement('input');
    itemsSearch.type = 'search';
    itemsSearch.id = 'cfg-items-search';
    itemsSearch.className = 'config-input config-item-search';
    itemsSearch.placeholder = 'Search items by name, type, or price state';
    itemsSearch.autocomplete = 'off';
    itemsSearch.addEventListener('input', () => {
        applyItemConfigFilters();
        updateItemConfigSearchUI();
    });
    itemsSearchWrap.appendChild(itemsSearch);

    const itemsSearchClear = document.createElement('button');
    itemsSearchClear.type = 'button';
    itemsSearchClear.id = 'cfg-items-search-clear';
    itemsSearchClear.className = 'config-btn config-item-search-clear';
    itemsSearchClear.textContent = 'Clear';
    itemsSearchClear.addEventListener('click', () => {
        itemsSearch.value = '';
        applyItemConfigFilters();
        updateItemConfigSearchUI();
        itemsSearch.focus();
    });
    itemsSearchWrap.appendChild(itemsSearchClear);

    itemsToolbarTop.appendChild(itemsSearchWrap);

    const itemsSummary = document.createElement('div');
    itemsSummary.id = 'cfg-items-summary';
    itemsSummary.className = 'config-items-summary';
    [
        { key: 'showing', label: 'Showing', value: '0/0' },
        { key: 'enabled', label: 'Enabled', value: '0' },
        { key: 'custom', label: 'Custom', value: '0' }
    ].forEach(summaryDef => {
        const chip = document.createElement('div');
        chip.className = 'config-items-summary-chip';

        const label = document.createElement('span');
        label.className = 'config-items-summary-label';
        label.textContent = summaryDef.label;
        chip.appendChild(label);

        const value = document.createElement('span');
        value.className = 'config-items-summary-value';
        value.dataset.summaryValue = summaryDef.key;
        value.textContent = summaryDef.value;
        chip.appendChild(value);

        itemsSummary.appendChild(chip);
    });
    itemsToolbarTop.appendChild(itemsSummary);

    itemsToolbar.appendChild(itemsToolbarTop);

    const itemsFilters = document.createElement('div');
    itemsFilters.id = 'cfg-items-filters';
    itemsFilters.className = 'config-chip-bar';
    const itemFilterDefs = [
        { value: 'all', label: 'All' },
        { value: 'enabled', label: 'Enabled' },
        { value: 'disabled', label: 'Disabled' },
        { value: 'custom-price', label: 'Custom Price' }
    ].concat(itemClasses.map(itemClass => ({
        value: 'class:' + itemClass,
        label: ITEM_CLASS_LABELS[itemClass] || itemClass
    })));

    itemFilterDefs.forEach(filterDef => {
        const filterBtn = document.createElement('button');
        filterBtn.type = 'button';
        filterBtn.className = 'config-filter-chip';
        filterBtn.dataset.filter = filterDef.value;
        filterBtn.textContent = filterDef.label;
        filterBtn.addEventListener('click', () => {
            setActiveItemConfigFilter(filterDef.value);
        });
        itemsFilters.appendChild(filterBtn);
    });
    itemsToolbar.appendChild(itemsFilters);
    itemsSection.appendChild(itemsToolbar);

    const itemsGrid = document.createElement('div');
    itemsGrid.id = 'cfg-items-grid';
    itemsGrid.className = 'config-grid config-sprite-grid';
    
    // Item name to image path mapping
    const ITEM_SPRITE_MAP = {
        'Hoe': 'images/items/Hoe.png',
        'Corn': 'images/items/Corn_item.png',
        'Corn Seed': 'images/items/Corn_Seed_bag.png',
        'Junk': 'images/items/junk.png',
        'Sweet Potatoes': 'images/items/SweetPotato.png',
        'Sweet Potato Seed': 'images/items/seedbag_sp.png',
        'Strawberries': 'images/items/Stawberry.png',
        'Strawberry Seed': 'images/items/SeedBag_Stawberry.png',
        'Compost': 'images/items/Compost.png',
        'Ladybugs': 'images/items/Lady_Bug_bag.png',
        'Flower Seed': 'images/items/SeedBagFlower.png',
        'Sprinkler': 'images/items/Sprinkler.png',
        'Full Course': 'images/items/FullCourse.png',
        'Tomato Seed': 'images/items/tomato_bag.png',
        'Tomato': 'images/items/tomato.png',
        'Watermelon Seed': 'images/items/seedbagwatermelon.png',
        'Watermelon': 'images/items/watermelon2.png',
        'Robot3': 'images/items/robot.png',
        'Up Command': 'images/items/floppy_up.png',
        'Right Command': 'images/items/floppy_right.png',
        'Down Command': 'images/items/floppy_down.png',
        'Left Command': 'images/items/floppy_left.png',
        'Interact Command': 'images/items/floppy_interact.png',
        'Hemp Seed': 'images/items/hemp_seeds.png',
        'Hemp Flower': 'images/items/hemp.png',
        'Restart Command': 'images/items/floppy_restart.png',
        'Robot1': 'images/items/robot.png',
        'Robot2': 'images/items/robot2.png',
        'Add to Chest Command': 'images/items/Floppy_addChestt.png',
        'Add from Chest Command': 'images/items/floppy_removechest.png',
        'Veggie Oil': 'images/items/veg_oil.png',
        'Shovel': 'images/items/shovel.png',
        'Backpack': 'images/items/backPack.png',
        '1 Day Pause Command': 'images/items/Floppy_Pause.png',
        'Hotdog': 'images/items/HotDog.png',
        'Chest': 'images/items/Chest.png',
        'Grinder': 'images/items/Grinder.png',
        'Veggie Press': 'images/items/veg_oil_maker.png',
        'Carrot': 'images/items/carrot.png',
        'Carrot Seed': 'images/items/seedbag_carrot.png',
        'Pumpkin': 'images/items/Pumpkin.png',
        'Pumpkin Seed': 'images/items/Pumpkin_seedBag.png',
        'Bed': 'images/tiles/Bed.png',
        'Wall': 'images/tiles/Wood.png',
        'Axe': 'images/items/Axe.png',
        'Composter': 'images/tiles/Worm_Bucket.png',
        'Hemp Oil': 'images/items/veg_oil.png',
        'Fruit Juice': 'images/items/veg_oil.png'
    };
    
    itemDefs.forEach((item, idx) => {
        if (!item || idx === 0) return; // Skip empty slot
        if (!item.name) return;
        
        // Container for item row
        const itemRow = document.createElement('div');
        itemRow.className = 'config-item-row';
        itemRow.dataset.itemIdx = idx;
        itemRow.dataset.itemName = item.name;
        itemRow.dataset.itemClass = item.class || 'Item';
        itemRow.dataset.searchText = (item.name + ' ' + (ITEM_CLASS_LABELS[item.class] || item.class || 'Item')).toLowerCase();

        const itemMain = document.createElement('div');
        itemMain.className = 'config-item-main';
        itemRow.appendChild(itemMain);
        
        // Toggle button
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'config-grid-item config-sprite-item config-item-toggle active'; // Items on by default
        btn.dataset.itemIdx = idx;
        btn.dataset.itemName = item.name;
        btn.dataset.itemClass = item.class || 'Item';
        
        // Create sprite img element
        const spriteImg = document.createElement('img');
        spriteImg.className = 'config-sprite-img';
        spriteImg.width = 32;
        spriteImg.height = 32;
        spriteImg.style.imageRendering = 'pixelated';
        const imgPath = ITEM_SPRITE_MAP[item.name] || 'images/items/junk.png';
        spriteImg.src = imgPath;
        spriteImg.alt = item.name;
        btn.appendChild(spriteImg);
        
        // Add name label
        const label = document.createElement('span');
        label.className = 'config-sprite-label';
        label.textContent = item.name;
        btn.appendChild(label);
        
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            updateItemConfigRowState(itemRow);
            applyItemConfigFilters();
        });
        itemMain.appendChild(btn);

        const meta = document.createElement('div');
        meta.className = 'config-item-meta';

        const stateBadge = document.createElement('span');
        stateBadge.className = 'config-item-badge config-item-state-badge';
        stateBadge.textContent = 'Enabled';
        meta.appendChild(stateBadge);

        const classBadge = document.createElement('span');
        classBadge.className = 'config-item-badge';
        classBadge.textContent = ITEM_CLASS_LABELS[item.class] || item.class || 'Item';
        meta.appendChild(classBadge);
        
        // Price input (only for items that have a base price)
        const basePrice = item.price || 0;
        const priceBadge = document.createElement('span');
        priceBadge.className = 'config-item-badge';
        priceBadge.textContent = basePrice > 0 ? ('Base $' + basePrice) : 'No shop price';
        meta.appendChild(priceBadge);
        itemMain.appendChild(meta);

        const controls = document.createElement('div');
        controls.className = 'config-item-controls';
        itemRow.appendChild(controls);

        if (basePrice > 0) {
            const priceWrapper = document.createElement('div');
            priceWrapper.className = 'config-price-wrapper';

            const priceHeading = document.createElement('span');
            priceHeading.className = 'config-price-caption';
            priceHeading.textContent = 'Shop Price';
            priceWrapper.appendChild(priceHeading);

            const priceStatus = document.createElement('span');
            priceStatus.className = 'config-item-price-status';
            priceStatus.textContent = 'Base price';
            priceWrapper.appendChild(priceStatus);

            const priceInputWrap = document.createElement('div');
            priceInputWrap.className = 'config-price-input-wrap';

            const priceLabel = document.createElement('span');
            priceLabel.className = 'config-price-label';
            priceLabel.textContent = '$';
            priceInputWrap.appendChild(priceLabel);
            
            const priceInput = document.createElement('input');
            priceInput.type = 'number';
            priceInput.className = 'config-item-price';
            priceInput.dataset.itemIdx = idx;
            priceInput.dataset.defaultPrice = String(basePrice);
            priceInput.min = '1';
            priceInput.max = '999999';
            priceInput.value = basePrice;
            priceInput.title = 'Price for ' + item.name;
            priceInput.placeholder = String(basePrice);
            priceInput.addEventListener('input', () => {
                updateItemConfigRowState(itemRow);
                applyItemConfigFilters();
            });
            priceInputWrap.appendChild(priceInput);

            const resetBtn = document.createElement('button');
            resetBtn.type = 'button';
            resetBtn.className = 'config-price-reset';
            resetBtn.textContent = 'Reset';
            resetBtn.addEventListener('click', () => {
                priceInput.value = String(basePrice);
                updateItemConfigRowState(itemRow);
                applyItemConfigFilters();
            });
            priceInputWrap.appendChild(resetBtn);

            priceWrapper.appendChild(priceInputWrap);
            controls.appendChild(priceWrapper);
        } else {
            const noPriceNote = document.createElement('div');
            noPriceNote.className = 'config-item-note';
            noPriceNote.textContent = 'No shop price to override';
            controls.appendChild(noPriceNote);
        }
        
        itemsGrid.appendChild(itemRow);
        updateItemConfigRowState(itemRow);
    });
    itemsSection.appendChild(itemsGrid);

    const itemsEmptyState = document.createElement('div');
    itemsEmptyState.id = 'cfg-items-empty';
    itemsEmptyState.className = 'config-empty-state';
    itemsEmptyState.textContent = 'No items match the current search or filter.';
    itemsEmptyState.hidden = true;
    itemsSection.appendChild(itemsEmptyState);

    addBulkToggleActions(itemsSection, itemsGrid, () => {
        Array.from(itemsGrid.querySelectorAll('.config-item-row')).forEach(updateItemConfigRowState);
        applyItemConfigFilters();
    });

    const actions = document.createElement('div');
    actions.className = 'config-actions';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'config-btn';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
        saveConfigModal();
    });
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'config-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', hideConfigModal);
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    modal.appendChild(actions);

    setActiveConfigTab('core');
    setActiveItemConfigFilter('all');

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) hideConfigModal();
    });

    return overlay;
}

function setActiveConfigTab(tabId) {
    const overlay = document.getElementById('config-overlay');
    if (!overlay) return;

    overlay.dataset.activeTab = tabId;

    Array.from(overlay.querySelectorAll('.config-tab')).forEach(tab => {
        const isActive = tab.dataset.tab === tabId;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    Array.from(overlay.querySelectorAll('.config-panel')).forEach(panel => {
        panel.classList.toggle('active', panel.dataset.tab === tabId);
    });
}

function updateItemConfigRowState(row) {
    if (!row) return;

    const toggleBtn = row.querySelector('.config-item-toggle');
    const priceInput = row.querySelector('.config-item-price');
    const enabled = toggleBtn ? toggleBtn.classList.contains('active') : true;
    if (toggleBtn) {
        toggleBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    }
    row.dataset.enabled = enabled ? 'true' : 'false';
    row.classList.toggle('disabled', !enabled);

    const stateBadge = row.querySelector('.config-item-state-badge');
    if (stateBadge) {
        stateBadge.textContent = enabled ? 'Enabled' : 'Disabled';
    }

    let hasCustomPrice = false;
    if (priceInput) {
        const defaultPrice = parseInt(priceInput.dataset.defaultPrice);
        const currentPrice = parseInt(priceInput.value);
        hasCustomPrice = !isNaN(defaultPrice) && !isNaN(currentPrice) && currentPrice > 0 && currentPrice !== defaultPrice;

        const status = row.querySelector('.config-item-price-status');
        if (status) {
            status.textContent = hasCustomPrice ? 'Custom price' : 'Base price';
        }

        const resetBtn = row.querySelector('.config-price-reset');
        if (resetBtn) {
            resetBtn.disabled = !hasCustomPrice;
        }
    }

    row.dataset.customPrice = hasCustomPrice ? 'true' : 'false';
    row.classList.toggle('custom-price', hasCustomPrice);
}

function updateItemConfigSearchUI() {
    const searchInput = document.getElementById('cfg-items-search');
    const clearButton = document.getElementById('cfg-items-search-clear');
    if (!clearButton) return;

    clearButton.disabled = !searchInput || !searchInput.value.trim();
}

function applyItemConfigFilters() {
    const grid = document.getElementById('cfg-items-grid');
    if (!grid) return;

    const searchValue = (document.getElementById('cfg-items-search')?.value || '').trim().toLowerCase();
    const activeFilter = document.querySelector('#cfg-items-filters .config-filter-chip.active')?.dataset.filter || 'all';

    let totalCount = 0;
    let visibleCount = 0;
    let visibleEnabledCount = 0;
    let visibleCustomCount = 0;

    Array.from(grid.querySelectorAll('.config-item-row')).forEach(row => {
        totalCount++;

        const matchesSearch = !searchValue || (row.dataset.searchText || '').includes(searchValue);
        let matchesFilter = true;

        if (activeFilter === 'enabled') {
            matchesFilter = row.dataset.enabled === 'true';
        } else if (activeFilter === 'disabled') {
            matchesFilter = row.dataset.enabled === 'false';
        } else if (activeFilter === 'custom-price') {
            matchesFilter = row.dataset.customPrice === 'true';
        } else if (activeFilter.startsWith('class:')) {
            matchesFilter = row.dataset.itemClass === activeFilter.slice(6);
        }

        const isVisible = matchesSearch && matchesFilter;
        row.hidden = !isVisible;

        if (isVisible) {
            visibleCount++;
            if (row.dataset.enabled === 'true') visibleEnabledCount++;
            if (row.dataset.customPrice === 'true') visibleCustomCount++;
        }
    });

    const summary = document.getElementById('cfg-items-summary');
    if (summary) {
        const showingValue = summary.querySelector('[data-summary-value="showing"]');
        const enabledValue = summary.querySelector('[data-summary-value="enabled"]');
        const customValue = summary.querySelector('[data-summary-value="custom"]');

        if (showingValue) {
            showingValue.textContent = visibleCount + '/' + totalCount;
        }
        if (enabledValue) {
            enabledValue.textContent = String(visibleEnabledCount);
        }
        if (customValue) {
            customValue.textContent = String(visibleCustomCount);
        }
    }

    const emptyState = document.getElementById('cfg-items-empty');
    if (emptyState) {
        emptyState.hidden = visibleCount !== 0;
    }

    updateItemConfigSearchUI();
}

function setActiveItemConfigFilter(filterValue) {
    const filterButtons = Array.from(document.querySelectorAll('#cfg-items-filters .config-filter-chip'));
    if (!filterButtons.length) return;

    filterButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filterValue);
    });

    applyItemConfigFilters();
}

function resetItemConfigFilters() {
    const searchInput = document.getElementById('cfg-items-search');
    if (searchInput) {
        searchInput.value = '';
    }
    updateItemConfigSearchUI();
    setActiveItemConfigFilter('all');
}

function showConfigModal() {
    const overlay = ensureConfigModal();
    setActiveConfigTab('core');
    // Populate fields from current rules or defaults
    const rules = window.customRules || {};
    document.getElementById('cfg-main-quest-coins').value = (rules.mainQuestCoins ?? 10000);
    document.getElementById('cfg-main-quest-days').value = (rules.mainQuestDays ?? 100);
    document.getElementById('cfg-starting-coins').value = (rules.startingCoins ?? 0);
    document.getElementById('cfg-money-loss').checked = !!(rules.moneyLoss ?? true);
    document.getElementById('cfg-food-rot').checked = !!(rules.foodRot ?? true);
    document.getElementById('cfg-perma-death').checked = !!(rules.permaDeath ?? false);
    // NPC grid state
    const npcGrid = document.getElementById('cfg-npc-grid');
    const enabled = rules.npcEnabled || null;
    if (npcGrid) {
        const items = Array.from(npcGrid.querySelectorAll('.config-grid-item'));
        items.forEach(el => {
            const name = el.dataset.npcName;
            const isOn = enabled == null ? true : !!enabled[name];
            el.classList.toggle('active', isOn);
            // Special visual emphasis for Mr.C
            if (name === 'Mr.C') {
                el.setAttribute('data-npc-name', 'Mr.C');
            }
        });
    }
    // Weather weights defaults mirror current system probabilities
    const ww = rules.weatherWeights ?? {
        'clear': 49.9,
        'partly-cloudy': 15,
        'overcast': 10,
        'fog': 7,
        'sunshower': 8,
        'rain': 8,
        'thunderstorm': 2,
        'frog-rain': 0.1
    };
    const setSlider = (id, v) => { const el = document.getElementById(id); const badge = el?.parentElement?.querySelector('.config-slider-value'); if (el) el.value = v; if (badge) badge.textContent = String(v); };
    setSlider('cfg-weather-partly', ww['partly-cloudy']);
    setSlider('cfg-weather-overcast', ww['overcast']);
    setSlider('cfg-weather-fog', ww['fog']);
    setSlider('cfg-weather-sunshower', ww['sunshower']);
    setSlider('cfg-weather-rain', ww['rain']);
    setSlider('cfg-weather-thunderstorm', ww['thunderstorm']);
    setSlider('cfg-weather-frog', ww['frog-rain']);

    // Normalize total to 100 by adjusting Clear accordingly
    normalizeWeatherTotal(null);

    // Areas grid state
    const areasGrid = document.getElementById('cfg-areas-grid');
    const areasEnabled = rules.areasEnabled || null;
    if (areasGrid) {
        Array.from(areasGrid.querySelectorAll('.config-grid-item')).forEach(el => {
            const name = el.dataset.areaName;
            const isOn = areasEnabled == null ? true : !!areasEnabled[name];
            el.classList.toggle('active', isOn);
        });
    }

    // Items grid state
    const itemsGrid = document.getElementById('cfg-items-grid');
    const itemsEnabled = rules.itemsEnabled || null;
    const itemPrices = rules.itemPrices || {};
    if (itemsGrid) {
        Array.from(itemsGrid.querySelectorAll('.config-item-toggle')).forEach(el => {
            const idx = el.dataset.itemIdx;
            const isOn = itemsEnabled == null ? true : !!itemsEnabled[idx];
            el.classList.toggle('active', isOn);
        });

        Array.from(itemsGrid.querySelectorAll('.config-item-price')).forEach(inp => {
            const idx = inp.dataset.itemIdx;
            const defaultPrice = parseInt(inp.dataset.defaultPrice);
            inp.value = itemPrices[idx] !== undefined ? itemPrices[idx] : defaultPrice;
        });

        Array.from(itemsGrid.querySelectorAll('.config-item-row')).forEach(updateItemConfigRowState);
    }
    resetItemConfigFilters();

    // Critters grid state
    const crittersGrid = document.getElementById('cfg-critters-grid');
    const crittersEnabled = rules.crittersEnabled || null;
    if (crittersGrid) {
        Array.from(crittersGrid.querySelectorAll('.config-grid-item')).forEach(el => {
            const name = el.dataset.critterName;
            const isOn = crittersEnabled == null ? true : !!crittersEnabled[name];
            el.classList.toggle('active', isOn);
        });
    }

    overlay.style.display = 'flex';
    updateCanvasPointerEvents();
}

function hideConfigModal() {
    const overlay = document.getElementById('config-overlay');
    if (overlay) overlay.style.display = 'none';
    updateCanvasPointerEvents();
}

function clampInt(val, min, max, fallback) {
    const n = parseInt(val);
    if (isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}

function clampNumber(val, min, max, fallback) {
    const n = parseFloat(val);
    if (isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}

function saveConfigModal() {
    const newRules = {
        mainQuestCoins: clampInt(document.getElementById('cfg-main-quest-coins').value, 0, 100000000, 10000),
        mainQuestDays: clampInt(document.getElementById('cfg-main-quest-days').value, 0, 100000, 100),
        startingCoins: clampInt(document.getElementById('cfg-starting-coins').value, 0, 100000000, 0),
        moneyLoss: !!document.getElementById('cfg-money-loss').checked,
        foodRot: !!document.getElementById('cfg-food-rot').checked,
        permaDeath: !!document.getElementById('cfg-perma-death').checked,
        // Build npcEnabled map from grid
        npcEnabled: (() => {
            const grid = document.getElementById('cfg-npc-grid');
            const out = {};
            if (grid) {
                Array.from(grid.querySelectorAll('.config-grid-item')).forEach(el => {
                    const name = el.dataset.npcName;
                    out[name] = el.classList.contains('active');
                });
            }
            return out;
        })(),
        weatherWeights: (() => {
            const get = (id) => clampNumber(document.getElementById(id).value, 0, 100, 0);
            const ww = {
                'partly-cloudy': get('cfg-weather-partly'),
                'overcast': get('cfg-weather-overcast'),
                'fog': get('cfg-weather-fog'),
                'sunshower': get('cfg-weather-sunshower'),
                'rain': get('cfg-weather-rain'),
                'thunderstorm': get('cfg-weather-thunderstorm'),
                'frog-rain': get('cfg-weather-frog')
            };
            const sumOthers = ww['partly-cloudy'] + ww['overcast'] + ww['fog'] + ww['sunshower'] + ww['rain'] + ww['thunderstorm'] + ww['frog-rain'];
            ww['clear'] = Math.max(0, 100 - sumOthers);
            return ww;
        })(),
        // Build areasEnabled map from grid
        areasEnabled: (() => {
            const grid = document.getElementById('cfg-areas-grid');
            const out = {};
            if (grid) {
                Array.from(grid.querySelectorAll('.config-grid-item')).forEach(el => {
                    const name = el.dataset.areaName;
                    out[name] = el.classList.contains('active');
                });
            }
            return out;
        })(),
        // Build itemsEnabled map from grid
        itemsEnabled: (() => {
            const grid = document.getElementById('cfg-items-grid');
            const out = {};
            if (grid) {
                Array.from(grid.querySelectorAll('.config-item-toggle')).forEach(el => {
                    const idx = el.dataset.itemIdx;
                    const isActive = el.classList.contains('active');
                    out[idx] = isActive;
                    if (!isActive) {
                        console.log('Disabling item idx:', idx, 'name:', el.dataset.itemName);
                    }
                });
            }
            console.log('Built itemsEnabled map:', out);
            return out;
        })(),
        // Build crittersEnabled map from grid
        crittersEnabled: (() => {
            const grid = document.getElementById('cfg-critters-grid');
            const out = {};
            if (grid) {
                Array.from(grid.querySelectorAll('.config-grid-item')).forEach(el => {
                    const name = el.dataset.critterName;
                    out[name] = el.classList.contains('active');
                });
            }
            return out;
        })(),
        // Per-item prices
        itemPrices: (() => {
            const grid = document.getElementById('cfg-items-grid');
            const out = {};
            if (grid) {
                Array.from(grid.querySelectorAll('.config-item-price')).forEach(inp => {
                    const idx = inp.dataset.itemIdx;
                    const price = parseInt(inp.value);
                    const defaultPrice = parseInt(inp.dataset.defaultPrice);
                    if (!isNaN(price) && price > 0 && price !== defaultPrice) {
                        out[idx] = price;
                    }
                });
            }
            return out;
        })()
    };

    window.customRules = newRules;

    // Persist to Day_curLvl_Dif without clobbering other fields
    try {
        const prev = localData.get('Day_curLvl_Dif') || { day: days || 0, currentLevel_y, currentLevel_x, dificulty };
        prev.customRules = newRules;
        localData.set('Day_curLvl_Dif', prev);
        console.log('Updated custom rules:', newRules);
    } catch(e) {
        console.warn('Failed saving custom rules', e);
    }

    // Apply to active game for main quest values
    applyCustomRulesToActiveGame();
    applyNPCFilterRules();
    applyCritterFilterRules();
    applyAreaRules();
    applyItemPrices();
    removeDisabledItemsFromInventory();
    // Immediately re-generate today's weather using the new weights
    if (typeof generateDailyWeather === 'function') {
        try {
            console.log('SAVE: About to re-roll weather. window.customRules.weatherWeights =', window.customRules?.weatherWeights);
            generateDailyWeather();
            console.log('Weather re-rolled with updated weights. Current:', typeof currentWeather !== 'undefined' ? currentWeather : '(unknown)');
        } catch (e) {
            console.warn('Failed to re-roll weather after saving config:', e);
        }
    }
    hideConfigModal();
}

function applyCustomRulesToActiveGame() {
    if (!window.customRules) return;
    if (typeof player !== 'undefined' && player.quests) {
        for (let q of player.quests) {
            if (q.og_name === "Save Cloudy Meadows") {
                // Update days and goal funding amount
                q.days = window.customRules.mainQuestDays ?? q.days;
                q.maxDays = q.days;
                for (let goal of q.goals) {
                    if (goal.class === 'FundingGoal') {
                        goal.amount = window.customRules.mainQuestCoins ?? goal.amount;
                    }
                }
                if (q.maxDays > 0) {
                    q.name = q.og_name + ' ' + q.days + ' days left';
                }
            }
        }
    }
}

// Keep weather sliders totaling 100% by balancing with Clear
function normalizeWeatherTotal(changedId) {
    const ids = [
        'cfg-weather-partly',
        'cfg-weather-overcast',
        'cfg-weather-fog',
        'cfg-weather-sunshower',
        'cfg-weather-rain',
        'cfg-weather-thunderstorm',
        'cfg-weather-frog'
    ];
    const get = (id) => { const el = document.getElementById(id); return el ? parseFloat(el.value) || 0 : 0; };
    const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) {
            const val = Math.max(0, Math.min(100, Math.round(v * 10) / 10));
            el.value = String(val);
            const badge = el.parentElement?.querySelector('.config-slider-value');
            if (badge) badge.textContent = String(val);
        }
    };
    const sumAll = ids.reduce((s, id) => s + get(id), 0);
    if (changedId) {
        const desired = get(changedId);
        const sumOthers = sumAll - desired;
        const maxAllowed = Math.max(0, 100 - sumOthers);
        set(changedId, Math.min(desired, maxAllowed));
    }
    const totalBadge = document.getElementById('cfg-weather-total');
    if (totalBadge) {
        const sum = ids.reduce((s, id) => s + get(id), 0);
        const clearPct = Math.max(0, 100 - sum);
        totalBadge.textContent = `Clear: ${Math.round(clearPct)}%`;
    }
}

function applyNPCFilterRules() {
    if (!window.customRules || !levels) {
        console.log('applyNPCFilterRules: No customRules or levels');
        return;
    }
    const enabledMap = window.customRules.npcEnabled;
    const mode = window.customRules.npcMode; // legacy: 'all' | 'only-mr-c' | 'none'
    const useLegacy = !enabledMap || Object.keys(enabledMap).length === 0;
    
    console.log('applyNPCFilterRules: enabledMap=', enabledMap, 'useLegacy=', useLegacy);
    
    if (useLegacy && (!mode || mode === 'all')) {
        console.log('applyNPCFilterRules: Nothing to do (legacy all)');
        return;
    }
    
    let removedCount = 0;
    for (let y = 0; y < levels.length; y++) {
        for (let x = 0; x < levels[y].length; x++) {
            const lvl = levels[y][x];
            if (!lvl || !lvl.map) continue;
            for (let r = 0; r < lvl.map.length; r++) {
                for (let c = 0; c < lvl.map[r].length; c++) {
                    const tile = lvl.map[r][c];
                    if (tile && tile.class === 'NPC') {
                        let keep = true;
                        if (useLegacy) {
                            keep = (mode === 'only-mr-c' && tile.name === 'Mr.C') ? true : (mode === 'none' ? false : true);
                        } else {
                            // default to true if not specified in map
                            keep = enabledMap.hasOwnProperty(tile.name) ? !!enabledMap[tile.name] : true;
                        }
                        if (!keep) {
                            console.log('Removing NPC:', tile.name, 'at level', y, x);
                            // Restore the ground tile beneath the NPC when removing
                            const replacement = (tile && tile.under_tile) ? tile.under_tile : 0;
                            lvl.map[r][c] = replacement;
                            removedCount++;
                        }
                    }
                }
            }
        }
    }
    console.log('applyNPCFilterRules: Removed', removedCount, 'NPCs');
}

// Apply critter filter rules - remove disabled critters from all levels
function applyCritterFilterRules() {
    if (!window.customRules || !levels) {
        console.log('applyCritterFilterRules: No customRules or levels');
        return;
    }
    const enabledMap = window.customRules.crittersEnabled;
    if (!enabledMap || Object.keys(enabledMap).length === 0) {
        console.log('applyCritterFilterRules: No critters to filter');
        return;
    }
    
    // Classes that are considered critters
    const critterClasses = ['FreeMoveEntity', 'LightMoveEntity', 'Entity'];
    // Specific critter names we care about
    const critterNames = ['Frog', 'LightBug', 'Bees', 'ladybug'];
    
    let removedCount = 0;
    for (let y = 0; y < levels.length; y++) {
        for (let x = 0; x < levels[y].length; x++) {
            const lvl = levels[y][x];
            if (!lvl || !lvl.map) continue;
            for (let r = 0; r < lvl.map.length; r++) {
                for (let c = 0; c < lvl.map[r].length; c++) {
                    const tile = lvl.map[r][c];
                    if (!tile) continue;
                    
                    // Check if this is a critter
                    const isCritterClass = critterClasses.includes(tile.class);
                    const isCritterName = critterNames.includes(tile.name);
                    
                    if (isCritterClass && isCritterName) {
                        // Check if this critter is disabled
                        const keep = enabledMap.hasOwnProperty(tile.name) ? !!enabledMap[tile.name] : true;
                        if (!keep) {
                            console.log('Removing critter:', tile.name, 'at level', y, x);
                            const replacement = (tile && tile.under_tile) ? tile.under_tile : 0;
                            lvl.map[r][c] = replacement;
                            removedCount++;
                        }
                    }
                }
            }
        }
    }
    console.log('applyCritterFilterRules: Removed', removedCount, 'critters');
}

// Apply area access rules - block travel to disabled areas
function applyAreaRules() {
    if (!window.customRules || !window.customRules.areasEnabled) return;
    const areasEnabled = window.customRules.areasEnabled;
    // Store blocked areas globally for level transition checks
    window.blockedAreas = {};
    for (const [areaName, enabled] of Object.entries(areasEnabled)) {
        if (!enabled) {
            window.blockedAreas[areaName] = true;
        }
    }
    console.log('Blocked areas:', Object.keys(window.blockedAreas));
}

// Check if a level is in a blocked area
function isLevelBlocked(levelName) {
    if (!window.blockedAreas || !levelName) return false;
    for (const areaName of Object.keys(window.blockedAreas)) {
        if (levelName.startsWith(areaName)) {
            return true;
        }
    }
    return false;
}

// Remove disabled items from player's inventory
function removeDisabledItemsFromInventory() {
    if (!window.customRules || !window.customRules.itemsEnabled) return;
    if (typeof player === 'undefined' || !player.inv) return;
    
    const enabled = window.customRules.itemsEnabled;
    let removedCount = 0;
    
    // Check main inventory (hotbar)
    for (let i = 0; i < player.inv.length; i++) {
        if (player.inv[i] != 0 && player.inv[i] != undefined) {
            const itemNum = typeof item_name_to_num === 'function' ? item_name_to_num(player.inv[i].name) : -1;
            const strKey = String(itemNum);
            const isEnabled = !enabled.hasOwnProperty(strKey) || !!enabled[strKey];
            if (!isEnabled) {
                console.log('Removing disabled item from inventory slot', i, ':', player.inv[i].name);
                player.inv[i] = 0;
                removedCount++;
            }
        }
    }
    
    // Check backpack if player has one equipped
    for (let i = 0; i < player.inv.length; i++) {
        if (player.inv[i] != 0 && player.inv[i].class === 'Backpack' && player.inv[i].inv) {
            for (let j = 0; j < player.inv[i].inv.length; j++) {
                if (player.inv[i].inv[j] != 0 && player.inv[i].inv[j] != undefined) {
                    const itemNum = typeof item_name_to_num === 'function' ? item_name_to_num(player.inv[i].inv[j].name) : -1;
                    const strKey = String(itemNum);
                    const isEnabled = !enabled.hasOwnProperty(strKey) || !!enabled[strKey];
                    if (!isEnabled) {
                        console.log('Removing disabled item from backpack slot', j, ':', player.inv[i].inv[j].name);
                        player.inv[i].inv[j] = 0;
                        removedCount++;
                    }
                }
            }
        }
    }
    
    console.log('removeDisabledItemsFromInventory: Removed', removedCount, 'items');
}

// Apply per-item custom prices
function applyItemPrices() {
    if (!window.customRules) return;
    const prices = window.customRules.itemPrices || {};
    
    // Store original prices if not already stored
    if (!window._originalItemPrices) {
        window._originalItemPrices = {};
        if (typeof all_items !== 'undefined') {
            for (let i = 0; i < all_items.length; i++) {
                if (all_items[i] && all_items[i].price !== undefined) {
                    window._originalItemPrices[i] = all_items[i].price;
                }
            }
        }
    }
    
    // Apply custom prices to all_items
    if (typeof all_items !== 'undefined') {
        for (let i = 0; i < all_items.length; i++) {
            if (all_items[i] && window._originalItemPrices[i] !== undefined) {
                all_items[i].price = window._originalItemPrices[i];
            }
        }

        for (const [idx, price] of Object.entries(prices)) {
            const i = parseInt(idx);
            if (!isNaN(i) && all_items[i] && price > 0) {
                all_items[i].price = price;
                console.log('Set all_items[' + i + '].price =', price, '(' + all_items[i].name + ')');
            }
        }
    }
    
    // Also update shop inventories and their originalPrices cache
    if (typeof levels !== 'undefined' && levels) {
        for (let y = 0; y < levels.length; y++) {
            for (let x = 0; x < levels[y].length; x++) {
                const lvl = levels[y][x];
                if (!lvl || !lvl.map) continue;
                for (let row of lvl.map) {
                    for (let tile of row) {
                        if (tile && tile.class === 'Shop' && tile.inv) {
                            for (let j = 0; j < tile.inv.length; j++) {
                                if (tile.inv[j] != 0 && tile.inv[j].name) {
                                    const itemNum = typeof item_name_to_num === 'function' ? item_name_to_num(tile.inv[j].name) : -1;
                                    const strKey = String(itemNum);
                                    const defaultPrice = window._originalItemPrices?.[itemNum] ?? tile.inv[j].price;
                                    const effectivePrice = prices[strKey] !== undefined && prices[strKey] > 0 ? prices[strKey] : defaultPrice;
                                    tile.inv[j].price = effectivePrice;
                                    tile.originalPrices[j] = effectivePrice;
                                    console.log('Updated shop', tile.name, 'item', tile.inv[j].name, 'price to', effectivePrice);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    console.log('Applied custom item prices:', prices);
}

// Get effective item - returns false if item is disabled
function getEffectiveItem(itemIdx) {
    if (!window.customRules || !window.customRules.itemsEnabled) {
        return true; // No rules = all enabled
    }
    const enabled = window.customRules.itemsEnabled;
    // Check both string and number keys since dataset values are strings
    const strKey = String(itemIdx);
    const numKey = Number(itemIdx);
    
    // Check if this key exists in the map
    const hasStrKey = enabled.hasOwnProperty(strKey);
    const hasNumKey = enabled.hasOwnProperty(numKey);
    
    let result;
    if (hasStrKey) {
        result = !!enabled[strKey];
    } else if (hasNumKey) {
        result = !!enabled[numKey];
    } else {
        result = true; // Not in map = enabled by default
    }
    
    if (!result) {
        console.log('getEffectiveItem:', itemIdx, 'strKey:', strKey, 'hasStrKey:', hasStrKey, 'val:', enabled[strKey], '-> DISABLED');
    }
    return result;
}

// ======== Progress gating helpers ========
function getHasBeatenGame() {
    try {
        const prev = localData.get('Day_curLvl_Dif');
        return !!(prev && prev.hasBeatenGame);
    } catch(e) {
        return false;
    }
}

// Mark beaten state when main quest completes (global listener, independent of UI panels)
if (!window._beatFlagListenerRegistered) {
    window._beatFlagListenerRegistered = true;
    window.addEventListener('questCompleted', (e) => {
        const q = e.detail && e.detail.quest;
        if (q && (q.og_name === 'Save Cloudy Meadows' || q.name === 'Save Cloudy Meadows')) {
            try {
                const prev = localData.get('Day_curLvl_Dif') || { day: days || 0, currentLevel_y, currentLevel_x, dificulty };
                prev.hasBeatenGame = true;
                localData.set('Day_curLvl_Dif', prev);
                console.log('Beaten flag set in local storage');
            } catch(err) {
                console.warn('Failed to set beaten flag', err);
            }
        }
    });
}

function showPaused(){
    ensurePauseMenuContainer();
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) {
        const wasVisible = pauseMenu.style.display === 'flex';
        pauseMenu.style.display = 'flex';
        updateCanvasPointerEvents();
        
        // Show/hide quit button based on whether we're in game or title screen
        const quitBtn = document.getElementById('pause-quit-btn');
        if (quitBtn) {
            // Show the quit button when in-game (not on title screen)
            quitBtn.style.display = title_screen ? 'none' : 'block';
        }
        
        // Update sliders
        const musicSliderDOM = document.getElementById('pause-music-slider');
        const fxSliderDOM = document.getElementById('pause-fx-slider');
        
        if (musicSliderDOM) {
            musicSliderDOM.value = musicSlider.value();
            musicSliderDOM.oninput = () => {
                musicSlider.value(musicSliderDOM.value);
            };
        }
        
        if (fxSliderDOM) {
            fxSliderDOM.value = fxSlider.value();
            fxSliderDOM.oninput = () => {
                fxSlider.value(fxSliderDOM.value);
            };
        }

        if (!wasVisible) {
            const pauseControlsContainer = document.getElementById('pause-controls-container');
            if (pauseControlsContainer) {
                renderControlButtons(pauseControlsContainer);
            }

            renderPauseHelpTabContent();

            const preferredTab = pauseMenu.dataset.activeTab || 'audio';
            const availableTab = pauseMenu.querySelector('.pause-tab[data-tab="' + preferredTab + '"]') ? preferredTab : 'audio';
            setActivePauseMenuTab(availableTab);
        }

        syncAccessibilityControls();
    }
}

function hidePaused() {
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) {
        pauseMenu.style.display = 'none';
    }
    updateCanvasPointerEvents();
}

function setActivePauseMenuTab(tabId) {
    const pauseMenu = document.getElementById('pause-menu');
    if (!pauseMenu) return;

    pauseMenu.dataset.activeTab = tabId;

    Array.from(pauseMenu.querySelectorAll('.pause-tab')).forEach(tab => {
        const isActive = tab.dataset.tab === tabId;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    Array.from(pauseMenu.querySelectorAll('.pause-tab-panel')).forEach(panel => {
        const isActive = panel.dataset.tab === tabId;
        panel.classList.toggle('active', isActive);
        panel.hidden = !isActive;
    });

    if (tabId === 'help') {
        renderPauseHelpTabContent();
    }
}

function renderPauseHelpTabContent() {
    const helpHost = document.getElementById('pause-inline-tutorial');
    if (!helpHost) return;

    const helpPrompt = buildFullTutorialPrompt({ source: 'pause-menu-inline' });
    const helpTitle = document.getElementById('pause-help-title');
    const helpIntro = document.getElementById('pause-help-intro');

    if (helpTitle) {
        helpTitle.textContent = helpPrompt.title || 'How To Play';
    }

    if (helpIntro) {
        if (helpPrompt.intro) {
            helpIntro.textContent = helpPrompt.intro;
            helpIntro.style.display = '';
        } else {
            helpIntro.textContent = '';
            helpIntro.style.display = 'none';
        }
    }

    helpHost.innerHTML = '';
    helpHost.appendChild(createTutorialDirectoryLayout(helpPrompt, { variant: 'compact', hideNavHints: true }));
}

function ensurePauseMenuContainer() {
    if (document.getElementById('pause-menu')) return;
    
    const pauseMenu = document.createElement('div');
    pauseMenu.id = 'pause-menu';
    document.body.appendChild(pauseMenu);
    
    // Title
    const title = document.createElement('h2');
    title.className = 'pause-title';
    title.textContent = 'Paused';
    pauseMenu.appendChild(title);

    const tabBar = document.createElement('div');
    tabBar.className = 'options-tab-bar pause-tab-bar';
    tabBar.setAttribute('role', 'tablist');
    pauseMenu.appendChild(tabBar);

    const panelWrap = document.createElement('div');
    panelWrap.className = 'options-panel-wrap pause-panel-wrap';
    pauseMenu.appendChild(panelWrap);

    const createPausePanel = (tabId, label) => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'options-tab pause-tab';
        tab.dataset.tab = tabId;
        tab.textContent = label;
        tab.id = 'pause-tab-' + tabId;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', 'pause-panel-' + tabId);
        tab.setAttribute('aria-selected', 'false');
        tab.setAttribute('tabindex', '-1');
        tab.addEventListener('click', () => {
            setActivePauseMenuTab(tabId);
        });
        tabBar.appendChild(tab);

        const panel = document.createElement('div');
        panel.className = 'options-tab-panel pause-tab-panel';
        panel.dataset.tab = tabId;
        panel.id = 'pause-panel-' + tabId;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
        panel.hidden = true;
        panelWrap.appendChild(panel);
        return panel;
    };

    const mobileOrSmallScreen = (typeof isMobile !== 'undefined' && isMobile) || window.innerWidth <= 768;
    const audioPanel = createPausePanel('audio', 'Audio');
    const accessibilityPanel = createPausePanel('accessibility', 'Accessibility');
    const controlsPanel = !mobileOrSmallScreen ? createPausePanel('controls', 'Controls') : null;
    const helpPanel = !mobileOrSmallScreen ? createPausePanel('help', 'Help') : null;

    const sliderSection = document.createElement('div');
    sliderSection.className = 'pause-menu-section';

    const audioTitle = document.createElement('div');
    audioTitle.className = 'pause-controls-title';
    audioTitle.textContent = 'Audio';
    sliderSection.appendChild(audioTitle);

    const musicRow = document.createElement('div');
    musicRow.className = 'pause-slider-row';
    const musicIcon = document.createElement('img');
    musicIcon.className = 'pause-slider-icon';
    musicIcon.src = 'images/ui/Music_Note.png';
    musicIcon.alt = 'Music';
    const musicLabel = document.createElement('span');
    musicLabel.className = 'pause-slider-label';
    musicLabel.textContent = 'Music';
    const musicSliderDOM = document.createElement('input');
    musicSliderDOM.id = 'pause-music-slider';
    musicSliderDOM.type = 'range';
    musicSliderDOM.min = '0';
    musicSliderDOM.max = '1';
    musicSliderDOM.step = '0.01';
    musicRow.appendChild(musicIcon);
    musicRow.appendChild(musicLabel);
    musicRow.appendChild(musicSliderDOM);
    sliderSection.appendChild(musicRow);

    const fxRow = document.createElement('div');
    fxRow.className = 'pause-slider-row';
    const fxIcon = document.createElement('img');
    fxIcon.className = 'pause-slider-icon';
    fxIcon.src = 'images/ui/fx.png';
    fxIcon.alt = 'FX';
    const fxLabel = document.createElement('span');
    fxLabel.className = 'pause-slider-label';
    fxLabel.textContent = 'Sound';
    const fxSliderDOM = document.createElement('input');
    fxSliderDOM.id = 'pause-fx-slider';
    fxSliderDOM.type = 'range';
    fxSliderDOM.min = '0';
    fxSliderDOM.max = '1';
    fxSliderDOM.step = '0.01';
    fxRow.appendChild(fxIcon);
    fxRow.appendChild(fxLabel);
    fxRow.appendChild(fxSliderDOM);
    sliderSection.appendChild(fxRow);

    audioPanel.appendChild(sliderSection);
    accessibilityPanel.appendChild(createAccessibilitySettingsSection('pause', { compact: true }));

    if (controlsPanel) {
        const controlsSection = document.createElement('div');
        controlsSection.className = 'pause-controls-section';

        const controlsTitle = document.createElement('div');
        controlsTitle.className = 'pause-controls-title';
        controlsTitle.textContent = 'Controls';
        controlsSection.appendChild(controlsTitle);

        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'pause-controls-container';
        controlsContainer.className = 'pause-controls-list';
        controlsSection.appendChild(controlsContainer);

        const controlsActions = document.createElement('div');
        controlsActions.className = 'pause-button-group';
        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'pause-button';
        resetBtn.textContent = 'Reset Controls';
        resetBtn.addEventListener('click', () => {
            resetControls();
        });
        controlsActions.appendChild(resetBtn);
        controlsSection.appendChild(controlsActions);

        controlsPanel.appendChild(controlsSection);
        renderControlButtons(controlsContainer);
    }

    if (helpPanel) {
        const helpSection = document.createElement('div');
        helpSection.className = 'pause-menu-section pause-help-section';

        const helpTitle = document.createElement('div');
        helpTitle.id = 'pause-help-title';
        helpTitle.className = 'pause-controls-title';
        helpTitle.textContent = 'How To Play';
        helpSection.appendChild(helpTitle);

        const helpDescription = document.createElement('p');
        helpDescription.id = 'pause-help-intro';
        helpDescription.className = 'pause-menu-label pause-help-intro';
        helpSection.appendChild(helpDescription);

        const helpContent = document.createElement('div');
        helpContent.id = 'pause-inline-tutorial';
        helpContent.className = 'pause-inline-tutorial';
        helpSection.appendChild(helpContent);
        helpPanel.appendChild(helpSection);
    }

    const actions = document.createElement('div');
    actions.className = 'pause-actions';

    //back button
    const backBtn = document.createElement('button');
    backBtn.id = 'pause-back-btn';
    backBtn.className = 'pause-button';
    backBtn.textContent = 'Resume';
    backBtn.addEventListener('click', () => {
        paused = false;
        hidePaused();
    });
    actions.appendChild(backBtn);

    // Quit button
    const quitBtn = document.createElement('button');
    quitBtn.id = 'pause-quit-btn';
    quitBtn.className = 'pause-button';
    quitBtn.textContent = 'Save and Quit';
    quitBtn.addEventListener('click', () => {
        console.log('Saving and quitting to title screen...');
        title_screen = true;
        paused = false;
        hidePaused();
        startButton.show();
        creditsButton.show();
        optionsButton.show();
        clearButton.hide();
        saveAll();
    });
    actions.appendChild(quitBtn);
    pauseMenu.appendChild(actions);

    if (helpPanel) {
        renderPauseHelpTabContent();
    }
    setActivePauseMenuTab('audio');
}

function showCredits(){
    // Show DOM-based credits menu
    showCreditsMenu();
}

function showCreditsMenu(){
    let creditsMenu = document.getElementById('credits-menu');
    if (!creditsMenu) {
        // Create structure once
        creditsMenu = document.createElement('div');
        creditsMenu.id = 'credits-menu';
        creditsMenu.className = 'credits-menu';
        document.body.appendChild(creditsMenu);
        
        const title = document.createElement('h2');
        title.className = 'credits-title';
        title.textContent = 'Credits';
        creditsMenu.appendChild(title);
        
        const content = document.createElement('div');
        content.className = 'credits-content';
        
        const credits = [
            'Christian Rodriguez - Lead programmer of old system and engine',
            'David Kozdra - Lazy Code, bad Art and sound',
            'Patrick Mayer - Misc',
            'Christian "Sealand" Rodriguez - Music',
            'Ethan Davis - Dialogue and Testing',
            'and thanks to our play testers'
        ];
        
        credits.forEach((credit, idx) => {
            const line = document.createElement('div');
            line.className = 'credits-line';
            if (idx === 1) {
                line.textContent = credit;
            } else {
                line.textContent = credit;
            }
            content.appendChild(line);
        });
        creditsMenu.appendChild(content);
        
        const backBtn = document.createElement('button');
        backBtn.id = 'credits-back-btn';
        backBtn.className = 'credits-back-button';
        backBtn.textContent = 'Back';
        backBtn.addEventListener('click', () => {
            creditsOn = false;
            hideCreditsMenu();
        });
        creditsMenu.appendChild(backBtn);
    }
    creditsMenu.style.display = 'flex';
    updateCanvasPointerEvents();
}

function hideCreditsMenu(){
    const creditsMenu = document.getElementById('credits-menu');
    if (creditsMenu) creditsMenu.style.display = 'none';
    updateCanvasPointerEvents();
}

let questsContainer = null;
let currentQuestPage = 0;
let questsPerPage = 6;
let lastSelectedQuest = -1;

function showQuests(){
    if (!questsContainer) {
        questsContainer = document.createElement('div');
        questsContainer.className = 'quests-container';
        document.getElementById('game-container').appendChild(questsContainer);
        
        // Create header wrapper with close button
        const headerWrapper = document.createElement('div');
        headerWrapper.className = 'quests-header-wrapper';
        questsContainer.appendChild(headerWrapper);
        
        const header = document.createElement('div');
        header.className = 'quests-header';
        header.innerHTML = '<h2>All Quests</h2>';
        headerWrapper.appendChild(header);
        
        const closeInstruction = document.createElement('div');
        closeInstruction.className = 'quests-close-instruction';
        header.appendChild(closeInstruction);
        
        const closeButton = document.createElement('button');
        closeButton.className = 'quests-close-btn';
        closeButton.textContent = '×';
        closeButton.addEventListener('click', () => {
            player.show_quests = false;
            questsContainer.style.display = 'none';
            questSlider.hide();
            questCloseButton.hide();
            currentQuestPage = 0; // Reset to first page when closing
            updateCanvasPointerEvents();
        });
        headerWrapper.appendChild(closeButton);
        
        // Create quests list container
        const questsList = document.createElement('div');
        questsList.className = 'quests-list';
        questsContainer.appendChild(questsList);
        
        // Create footer for close instruction
        // Create pagination controls
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'quest-pagination';
        questsContainer.appendChild(paginationContainer);
        
        const prevButton = document.createElement('button');
        prevButton.className = 'quest-page-btn quest-page-prev';
        prevButton.textContent = '← Prev';
        prevButton.addEventListener('click', () => {
            if (currentQuestPage > 0) {
                currentQuestPage--;
                updateQuestsDisplay();
            }
        });
        paginationContainer.appendChild(prevButton);
        
        const pageInfo = document.createElement('span');
        pageInfo.className = 'quest-page-info';
        paginationContainer.appendChild(pageInfo);
        
        const nextButton = document.createElement('button');
        nextButton.className = 'quest-page-btn quest-page-next';
        nextButton.textContent = 'Next →';
        nextButton.addEventListener('click', () => {
            const totalPages = Math.ceil(player.quests.length / questsPerPage);
            if (currentQuestPage < totalPages - 1) {
                currentQuestPage++;
                updateQuestsDisplay();
            }
        });
        paginationContainer.appendChild(nextButton);
        
        // Disable canvas pointer events to prevent click interception
        const canvas = document.querySelector('canvas');
        if(canvas){
            canvas.style.pointerEvents = 'none';
        }
    }

    updateQuestsDisplay();
}

function updateQuestsDisplay() {
    if (!questsContainer || !player) return;
    
    // Update if page changed or quest was selected
    if (lastSelectedQuest !== player.current_quest) {
        lastSelectedQuest = player.current_quest;
    }
    
    // Update quests list
    const questsList = questsContainer.querySelector('.quests-list');
    questsList.innerHTML = '';

    // Calculate pagination
    const totalPages = Math.ceil(player.quests.length / questsPerPage);
    const startIndex = currentQuestPage * questsPerPage;
    const endIndex = Math.min(startIndex + questsPerPage, player.quests.length);
    
    for(let i = startIndex; i < endIndex; i++){
        const questButton = document.createElement('button');
        questButton.className = 'quest-item';
        questButton.setAttribute('data-quest-index', i);
        
        if (player.current_quest === i) {
            questButton.classList.add('quest-current');
        }
        
        // Add click handler
        questButton.addEventListener('click', (e) => {
            // Don't handle clicks on the details button or its children
            if (e.target.classList.contains('quest-details-button') || 
                e.target.closest('.quest-details-button') ||
                (e.target.tagName === 'BUTTON' && e.target.textContent.includes('Details')) ||
                (e.target.tagName === 'BUTTON' && e.target.textContent.includes('Hide'))) {
                // Let the details button handle its own click
                return;
            }
            
            console.log('Quest button clicked');
            e.preventDefault();
            e.stopPropagation();
            const questIndex = parseInt(e.currentTarget.getAttribute('data-quest-index'));
            // Don't allow selecting failed or completed quests as current
            if (player.quests[questIndex].failed || player.quests[questIndex].done) {
                console.log('Cannot select failed or completed quest');
                return;
            }
            console.log('Setting current quest to:', questIndex);
            player.current_quest = questIndex;
            lastSelectedQuest = questIndex;
            // Update UI immediately without full refresh
            updateQuestButtonHighlight();
        });
        
        const questContent = document.createElement('div');
        questContent.className = 'quest-content';
        
        // Let the quest render into the DOM element
        questContent.innerHTML = '';
        player.quests[i].RenderQuestList(questContent, player.current_quest === i ? 'yellow' : null);

        // Inline details UI built here so expanded content stays within parent quest card
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'quest-details-container';
        detailsContainer.style.display = 'none';

        const detailsButton = document.createElement('button');
        detailsButton.className = 'quest-details-button';
        detailsButton.textContent = 'Details';
        detailsButton.onclick = (e) => {
            console.log(e , 'Details button clicked for quest index:', i);
            e.preventDefault();
            e.stopPropagation();
            const isOpen = detailsContainer.style.display === 'flex';
            if (isOpen) {
                detailsContainer.innerHTML = '';
                detailsContainer.style.display = 'none';
                detailsButton.textContent = 'Details';
                return;
            }
            detailsContainer.innerHTML = '';
            const quest = player.quests[i];
            for (let g = 0; g < quest.goals.length; g++) {
                const goal = quest.goals[g];
                const card = quest.createGoalCard(goal, g === quest.current_Goal && !goal.done);
                detailsContainer.appendChild(card);
            }
            
            // Always show rewards card to see what's configured
            const rewardsCard = quest.createRewardsCard();
            detailsContainer.appendChild(rewardsCard);
            
            detailsContainer.style.display = 'flex';
            detailsButton.textContent = 'Hide';
        };

        const progressRow = questContent.querySelector('.quest-progress-container');
        if (progressRow) {
            progressRow.appendChild(detailsButton);
        } else {
            questContent.appendChild(detailsButton);
        }
        questContent.appendChild(detailsContainer);
        
        questButton.appendChild(questContent);
        questsList.appendChild(questButton);

        // Sync progress immediately in case goals were completed before opening the UI
        updateQuestProgressBar(questButton);
    }
    
    // Update pagination controls
    const pageInfo = questsContainer.querySelector('.quest-page-info');
    const prevBtn = questsContainer.querySelector('.quest-page-prev');
    const nextBtn = questsContainer.querySelector('.quest-page-next');
    
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentQuestPage + 1} of ${totalPages} (${player.quests.length} quest${player.quests.length !== 1 ? 's' : ''})`;
    }
    
    if (prevBtn) {
        prevBtn.disabled = currentQuestPage === 0;
        prevBtn.style.opacity = currentQuestPage === 0 ? '0.5' : '1';
        prevBtn.style.cursor = currentQuestPage === 0 ? 'not-allowed' : 'pointer';
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentQuestPage >= totalPages - 1;
        nextBtn.style.opacity = currentQuestPage >= totalPages - 1 ? '0.5' : '1';
        nextBtn.style.cursor = currentQuestPage >= totalPages - 1 ? 'not-allowed' : 'pointer';
    }

    // Update close instruction - show mobile-friendly text on touch devices or small screens
    const closeInstruction = questsContainer.querySelector('.quests-close-instruction');
    const isMobileOrSmallScreen = (typeof isMobile !== 'undefined' && isMobile) || window.innerWidth <= 768;
    if (closeInstruction) {
        if (isMobileOrSmallScreen) {
            closeInstruction.textContent = 'Tap × to close quests';
        } else {
            closeInstruction.textContent = String.fromCharCode(quest_key) + ' to close quests';
        }
    }

    // Hide p5.js buttons and show container
    questCloseButton.hide();
    questSlider.hide();

    questsContainer.style.display = 'flex';
    updateCanvasPointerEvents();
    
    // Set up event listeners for quest updates (only once)
    if (!window._questEventsRegistered) {
        window._questEventsRegistered = true;
        
        window.addEventListener('questGoalCompleted', (e) => {
            if (!questsContainer || questsContainer.style.display === 'none') return;
            // Find which quest button this is and update it
            const quest = e.detail.quest;
            const questIndex = player.quests.indexOf(quest);
            const btn = document.querySelector(`[data-quest-index="${questIndex}"]`)?.closest('.quest-item');
            if (btn) updateQuestProgressBar(btn);
        });
        
        window.addEventListener('questCompleted', (e) => {
            if (!questsContainer || questsContainer.style.display === 'none') return;
            const questIndex = player.quests.indexOf(e.detail.quest);
            const btn = document.querySelector(`[data-quest-index="${questIndex}"]`)?.closest('.quest-item');
            if (btn) updateQuestProgressBar(btn);

            // Auto-select next incomplete quest if current was just completed
            if (questIndex === player.current_quest) {
                for (let i = 0; i < player.quests.length; i++) {
                    if (!player.quests[i].done && !player.quests[i].failed) {
                        player.current_quest = i;
                        updateQuestButtonHighlight();
                        break;
                    }
                }
            }
        });
        
        window.addEventListener('newDay', (e) => {
            if (!questsContainer || questsContainer.style.display === 'none') return;
            // Full refresh when new day occurs to update quest names with day counts
            updateQuestsDisplay();
        });
    }
}

function updateQuestProgressBar(btn) {
    const questIndex = parseInt(btn.getAttribute('data-quest-index'));
    const quest = player.quests[questIndex];
    if (!quest) return;
    
    // Update progress bar
    let completedGoals = 0;
    for (let j = 0; j < quest.goals.length; j++) {
        if (quest.goals[j].done) completedGoals++;
    }
    
    const progressFill = btn.querySelector('.quest-progress-fill');
    const statusDiv = btn.querySelector('.quest-status');
    
    if (progressFill) {
        const progress = (completedGoals / quest.goals.length) * 100;
        progressFill.style.width = progress + '%';
        if (quest.failed) {
            progressFill.style.backgroundColor = 'rgb(255, 0, 0)';
        } else if (quest.done || completedGoals === quest.goals.length) {
            progressFill.style.backgroundColor = 'rgb(50, 200, 50)';
        } else {
            progressFill.style.backgroundColor = 'rgb(255, 255, 0)';
        }
    }
    
    if (statusDiv) {
        if (quest.failed) {
            statusDiv.textContent = 'Failed';
            statusDiv.style.color = 'rgb(255, 0, 0)';
        } else if (quest.done) {
            statusDiv.textContent = 'Completed';
            statusDiv.style.color = 'rgb(50, 200, 50)';
            statusDiv.style.fontWeight = 'bold';
        } else {
            statusDiv.textContent = `${completedGoals}/${quest.goals.length} goals`;
            statusDiv.style.color = 'rgb(255, 255, 255)';
        }
    }
}

function updateQuestButtonHighlight(){
    const buttons = document.querySelectorAll('.quest-item');
    buttons.forEach(btn => {
        const questIndex = parseInt(btn.getAttribute('data-quest-index'));
        if (questIndex === player.current_quest) {
            btn.classList.add('quest-current');
        } else {
            btn.classList.remove('quest-current');
        }
    });
}

function clear_data_render() {
    if(clear_movephase == 0){
        if(clear_ticks >= 50){
            clear_movephase = 1;
            clear_ticks = 0;
        }
        clear_y -= 1;
    }
    if(clear_movephase == 1){
        if(clear_ticks >= 70){
            clear_movephase = 2;
            clear_ticks = 0;
        }
    }
    if(clear_movephase == 2){
        clear_y += 1;
        if(clear_ticks >= 50){
            clear_anim = false;
            clear_ticks = 0;
            clear_movephase = 0;
        }
    }
    clear_ticks += 1;
    push();
    stroke(0);
    strokeWeight(5);
    fill(255, 255, 0);
    rect(canvasWidth-(('Clearing Data'.length*17)+6), clear_y, ('Clearing Data'.length*17)+6, 50);
    textFont(player_2);
    textSize(15);
    fill(255);
    stroke(0);
    strokeWeight(4);
    textAlign(CENTER, CENTER);
    text('Clearing Data', canvasWidth-((('Clearing Data'.length*17)+6)/2)+2, clear_y+25);
    pop();
}

function addItem(to, item_obj_num, amount) {
    for (let i = 0; i < to.inv.length; i++) {
        if (to.inv[i] != 0) { // stack items
            if (to.inv[i].name == all_items[item_obj_num].name) {
                to.inv[i].amount += amount;
                return;
            }
        }
    }
    if (to.inv[to.hand] == 0) { // air
        to.inv[to.hand] = new_item_from_num(item_obj_num, amount);
        return;
    }

    for (let i = 0; i < 8; i++) {
        if (to.inv[i] == 0) { // find space
            to.inv[i] = new_item_from_num(item_obj_num, amount);
            return;
        }
    }
}

function checkForSpace(to, item_obj_num){
    var check = false;
    if(item_obj_num == 0){
        check = true;
        return check;
    }
    for (let i = 0; i < to.inv.length; i++) {
        if (to.inv[i] != 0) { // stack items
            if (to.inv[i].name == all_items[item_obj_num].name) {
                check = true;
                return check;
            }
        }
    }
    if (to.inv[to.hand] == 0) { // air in hand
        check = true;
        return check;
    }

    for (let i = 0; i < 8; i++) {
        if (to.inv[i] == 0) { // find space
            check = true;
            return check;
        }
    }
    if(!check){
        to.inv_warn_anim = 255;
        ErrorSound.play();
    }
    return check;
}

function item_name_to_num(item_name) {
    for (let i = 0; i < all_items.length; i++) {
        if (item_name == all_items[i].name) {
            return i;
        }
    }
    console.warn('Item name not found: ' + item_name);
    return undefined;
}

function tile_name_to_num(tile_name) {
    for (let i = 0; i < all_tiles.length; i++) {
        if (tile_name == all_tiles[i].name) {
            return i+1;
        }
    }
    return undefined;
}

function new_tile_from_num(num, x, y) {
    if (num && num > 0 && num <= all_tiles.length) {
        if (all_tiles[num - 1].class == 'Tile') {
            return new Tile(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].collide, all_tiles[num - 1].age, all_tiles[num - 1].under_tile_num);
        }
        else if (all_tiles[num - 1].class == 'Shop') {
            return new Shop(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].inv, all_tiles[num - 1].under_tile_num);
        }
        else if (all_tiles[num - 1].class == 'Plant') {
            return new Plant(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].collide, all_tiles[num - 1].eat_num, all_tiles[num - 1].waterneed, all_tiles[num - 1].growthTime);
        }
        else if (all_tiles[num - 1].class == 'Entity') {
            return new Entity(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].age, all_tiles[num - 1].inv, all_tiles[num - 1].hand, all_tiles[num - 1].under_tile_num);
        }
        else if (all_tiles[num - 1].class == 'FreeMoveEntity') {
            return new FreeMoveEntity(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].inv, all_tiles[num - 1].under_tile_num, all_tiles[num - 1].instructions, all_tiles[num - 1].moving_timer);
        }
        else if (all_tiles[num - 1].class == 'MovableEntity') {
            return new MoveableEntity(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].inv, all_tiles[num - 1].hand, all_tiles[num - 1].facing, all_tiles[num - 1].under_tile_num, all_tiles[num - 1].moving_timer);
        }
        else if (all_tiles[num - 1].class == 'GridMoveEntity') {
            return new GridMoveEntity(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].inv, all_tiles[num - 1].hand, all_tiles[num - 1].facing, all_tiles[num - 1].under_tile_num, all_tiles[num - 1].instructions, all_tiles[num - 1].moving_timer);
        }
        else if (all_tiles[num - 1].class == 'NPC') {
            const npc = new NPC(
                all_tiles[num - 1].name,
                all_tiles[num - 1].png,
                x,
                y,
                all_tiles[num - 1].inv,
                all_tiles[num - 1].hand,
                all_tiles[num - 1].facing,
                all_tiles[num - 1].under_tile_num,
                all_tiles[num - 1].instructions,
                all_tiles[num - 1].moving_timer,
                all_tiles[num - 1].random_move
            );
            if (all_tiles[num - 1].places) npc.places = all_tiles[num - 1].places.slice();
            if (all_tiles[num - 1].travel_price) npc.travel_price = all_tiles[num - 1].travel_price;
            return npc;
        }
        else if (all_tiles[num - 1].class == 'Chest'){
            return new Chest(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].inv, all_tiles[num - 1].under_tile_num);
        }
        else if (all_tiles[num - 1].class == 'Robot'){
            return new Robot(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].inv, all_tiles[num - 1].under_tile_num, all_tiles[num - 1].instructions, all_tiles[num - 1].moving_timer);
        }
        else if (all_tiles[num - 1].class == 'AirBallon'){
            return new AirBallon(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].under_tile_num);
        }
        else if (all_tiles[num-1].class == 'LightMoveEntity'){
            return new LightMoveEntity(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].inv, all_tiles[num - 1].under_tile_num, all_tiles[num - 1].instructions, all_tiles[num - 1].moving_timer);
        }
        else if (all_tiles[num-1].class == 'PayToMoveEntity'){
            return new PayToMoveEntity(all_tiles[num-1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].age, all_tiles[num - 1].under_tile_num, all_tiles[num - 1].price)
        }
        else if (all_tiles[num-1].class == 'FarmRobot'){
            return new FarmRobot(all_tiles[num-1].name, all_tiles[num-1].png, x, y, all_tiles[num-1].instructions, all_tiles[num-1].moving_timer);
        }
    }
    else {
        return undefined;
    }
}

function new_item_from_num(num, amount) {
    if (typeof all_items !== 'undefined' && num < all_items.length && all_items[num] && all_items[num] !== 0) {
        if (all_items[num].class == 'Item') {
            return new Item(all_items[num].name, amount, all_items[num].png, all_items[num].price);
        }
        else if (all_items[num].class == 'Tool') {
            return new Tool(all_items[num].name, amount, all_items[num].png);
        }
        else if (all_items[num].class == 'Eat') {
            return new Eat(all_items[num].name, amount, all_items[num].png, all_items[num].price, all_items[num].hunger, all_items[num].hunger_timer, all_items[num].seed_num);
        }
        else if (all_items[num].class == 'Seed') {
            return new Seed(all_items[num].name, amount, all_items[num].png, all_items[num].plant_num, all_items[num].price);
        }
        else if (all_items[num].class == 'Placeable') {
            return new Placeable(all_items[num].name, amount, all_items[num].png, all_items[num].price, all_items[num].tile_num, all_items[num].tile_need_num);
        }
        else if(all_items[num].class == 'Command'){
            return new Command(all_items[num].name, amount, all_items[num].png, all_items[num].command);
        }
        else if(all_items[num].class == 'Backpack'){
            return new Backpack(all_items[num].name, amount, all_items[num].png, all_items[num].inv);
        }
    }
    else {
        console.error('item created from ' + num + ' doesnt exist');
    }
}

function saveAll(){
    save_anim = 255;
    removeTemporaryRainFrogsFromLevels();
    
    // 1. Prepare all levels and entities (clear circular references and non-serializable objects)
    for(let i = 0; i < levels.length; i++){
        for(let j = 0; j < levels[i].length; j++){
            const level = levels[i][j];
            if(level && level !== 0){
                // Prepare the level itself
                if(typeof level.getReadyForSave === 'function'){
                    level.getReadyForSave();
                }
                // Prepare all entities in the level
                for(let y = 0; y < level.map.length; y++){
                    for(let x = 0; x < level.map[y].length; x++){
                        const tile = level.map[y][x];
                        if (tile && tile !== 0 && typeof tile.getReadyForSave === 'function'){
                            tile.getReadyForSave();
                        }
                    }
                }
            }
        }
    }
    
    // 2. Prepare player (who might be touching one of those entities)
    if (player && typeof player.getReadyForSave === 'function') {
        player.getReadyForSave();
    }

    // 3. Now save everything
    if(player.talking == 0){
        player.save()
    }
    const previousDayState = localData.get('Day_curLvl_Dif') || {};
    localData.set('Day_curLvl_Dif', {
        days: days, 
        currentLevel_x: currentLevel_x, 
        currentLevel_y: currentLevel_y, 
        dificulty: dificulty,
        currentWeather: currentWeather,
        time: time,
        timephase: timephase,
        customRules: window.customRules || null,
        tutorialState: getTutorialStateForSave(),
        hasBeatenGame: previousDayState.hasBeatenGame || hasCompletedMainQuest()
    });
    let lvlLength = 0;
    for(let i = 0; i < levels.length; i++){
        for(let j = 0; j < levels[i].length; j++){
            if(levels[i][j] != 0 && levels[i][j] != undefined){
                localData.set(levels[i][j].name, levels[i][j]);
                if(j > lvlLength){
                    lvlLength = j
                }
            }
        }
    }
    localData.set('extralvlStuff', {extraCount: extraCount, lvlLength: lvlLength});
}

function removeTemporaryRainFrogsFromLevels(){
    if (!levels) return;

    if (typeof frogRainEntities !== 'undefined') {
        frogRainEntities = [];
    }

    for(let y = 0; y < levels.length; y++){
        for(let x = 0; x < levels[y].length; x++){
            const level = levels[y][x];
            if(!level || !level.map) continue;

            for(let row = 0; row < level.map.length; row++){
                for(let col = 0; col < level.map[row].length; col++){
                    const tile = level.map[row][col];
                    if(tile && tile.rainFrog){
                        level.map[row][col] = tile.under_tile || new_tile_from_num(1, col * tileSize, row * tileSize);
                    }
                }
            }
        }
    }
}

function saveOptions(){
    const optionOverrides = {};
    if (typeof musicSlider !== 'undefined' && musicSlider && typeof musicSlider.value === 'function') {
        optionOverrides.musicVolume = musicSlider.value();
    }
    if (typeof fxSlider !== 'undefined' && fxSlider && typeof fxSlider.value === 'function') {
        optionOverrides.fxVolume = fxSlider.value();
    }

    persistOptionsData(optionOverrides);
    localData.set('Controls', {
        Controls_Interact_button_key: Controls_Interact_button_key,
        Controls_Eat_button_key: Controls_Eat_button_key,
        Controls_Up_button_key: Controls_Up_button_key,
        Controls_Down_button_key: Controls_Down_button_key,
        Controls_Left_button_key: Controls_Left_button_key,
        Controls_Right_button_key: Controls_Right_button_key,
        Controls_Special_button_key: Controls_Special_button_key,
        Controls_Quest_button_key: Controls_Quest_button_key,
        move_right_button: move_right_button,
        move_left_button: move_left_button,
        move_up_button: move_up_button,
        move_down_button: move_down_button,
        interact_button: interact_button,
        eat_button: eat_button,
        pause_button: pause_button,
        special_key: special_key,
        quest_key: quest_key
    })
}

function loadAll(){
    // Initialize days to 0 if not already set
    if (typeof days === 'undefined' || isNaN(days)) {
        days = 0;
    }
    
    if(localData.get('player') != null ){
        player.load(localData.get('player'));
        
        // Check if main quest was already failed in the save
        for (let q of player.quests) {
            if (q.og_name === "Save Cloudy Meadows" && q.failed) {
                lose_screen = true;
                paused = true;
            }
        }
    }
    if(localData.get('Day_curLvl_Dif') != null){
        loadTutorialState(localData.get('Day_curLvl_Dif').tutorialState || null);
        days = localData.get('Day_curLvl_Dif').days || 0;
        // Ensure days is a valid number
        if (isNaN(days)) {
            days = 0;
        }
        // Recalculate dayOfWeek from days
        dayOfWeek = days % 5;
        currentLevel_x = localData.get('Day_curLvl_Dif').currentLevel_x;
        currentLevel_y = localData.get('Day_curLvl_Dif').currentLevel_y;
        dificulty = localData.get('Day_curLvl_Dif').dificulty;
        window.customRules = localData.get('Day_curLvl_Dif').customRules || null;
        console.log('LOAD: customRules from storage:', window.customRules);
        console.log('LOAD: weatherWeights:', window.customRules?.weatherWeights);
        // If this is a new game (no saved player yet), apply starting coins now
        try {
            const hasSavedPlayer = localData.get('player') != null;
            if (!hasSavedPlayer && player && typeof window.customRules?.startingCoins === 'number') {
                player.coins = window.customRules.startingCoins;
            }
        } catch (e) {
            // If localData access fails, avoid crashing
        }

        // NPC/Area/Price rules are applied AFTER levels load below
        
        // Load weather state
        currentWeather = localData.get('Day_curLvl_Dif').currentWeather || 'clear';
        
        // Load time of day
        time = localData.get('Day_curLvl_Dif').time || 0;
        timephase = localData.get('Day_curLvl_Dif').timephase || 0;
    } else {
        loadTutorialState(null);
    }
    if(localData.get('Controls') != null){
        Controls_Interact_button_key = localData.get('Controls').Controls_Interact_button_key
        Controls_Eat_button_key = localData.get('Controls').Controls_Eat_button_key
        Controls_Up_button_key = localData.get('Controls').Controls_Up_button_key
        Controls_Down_button_key = localData.get('Controls').Controls_Down_button_key
        Controls_Left_button_key = localData.get('Controls').Controls_Left_button_key
        Controls_Right_button_key = localData.get('Controls').Controls_Right_button_key
        Controls_Special_button_key = localData.get('Controls').Controls_Special_button_key
        Controls_Quest_button_key = localData.get('Controls').Controls_Quest_button_key
        move_right_button = localData.get('Controls').move_right_button
        move_left_button = localData.get('Controls').move_left_button
        move_up_button = localData.get('Controls').move_up_button
        move_down_button = localData.get('Controls').move_down_button
        interact_button = localData.get('Controls').interact_button
        eat_button = localData.get('Controls').eat_button
        pause_button = localData.get('Controls').pause_button
        special_key = localData.get('Controls').special_key
        quest_key = localData.get('Controls').quest_key
    }
    applyAccessibilityPrefs(localData.get('Options'));
    if(localData.get('extralvlStuff') != null){
        extraCount = localData.get('extralvlStuff').extraCount
        let lvlLength = localData.get('extralvlStuff').lvlLength;
        for(let i = 0; i < levels.length; i++){
            for(let j = 0; j < lvlLength+1; j++){
                if(levels[i][j] != 0){
                    loadLevel(levels[i][j], j, i);
                }
            }
        }
    }
    else{
        for(let i = 0; i < levels.length; i++){
            for(let j = 0; j < levels[i].length; j++){
                if(levels[i][j] != 0){
                    loadLevel(levels[i][j]);
                }
            }
        }
    }
    
    ensureKiahInLegacyDowntownSave();
    ensureCooperativeExchangeBoard();

    // Apply NPC/Area/Price/Critter rules AFTER all levels have loaded from storage
    applyNPCFilterRules();
    applyCritterFilterRules();
    applyAreaRules();
    applyItemPrices();
    removeDisabledItemsFromInventory();
}

function loadLevel(level, lvlx = 0, lvly = 0){
    let newLvl = 0;
    if(level === undefined){
        newLvl = localData.get('Extra y:'+ lvly + ' x:' + (lvlx-6));
        if(newLvl == undefined){
            return;
        }
        let fore = JSON.parse(JSON.stringify(newLvl.fore));
        for(let i = 0; i < fore.length; i++){
            for(let j = 0; j < fore[i].length; j++){
                const savedFore = fore[i][j];
                if(savedFore && savedFore !== 0 && typeof savedFore.type !== 'undefined'){
                    fore[i][j] = savedFore.type;
                } else if(savedFore == null) {
                    fore[i][j] = 0;
                }
            }
        }
        let map = JSON.parse(JSON.stringify(newLvl.map));
        for(let i = 0; i < map.length; i++){
            for(let j = 0; j < map[i].length; j++){
                const savedTile = map[i][j];
                if(savedTile && savedTile !== 0 && savedTile.name){
                    map[i][j] = tile_name_to_num(savedTile.name) || 0;
                } else if(savedTile == null) {
                    map[i][j] = 0;
                }
            }
        }
        levels[lvly][lvlx] = new Level(newLvl.name, map, fore);
        level = levels[lvly][lvlx];
        for(let i = 0; i < levels[lvly][lvlx].fore.length; i++){
            for(let j = 0; j < levels[lvly][lvlx].fore[i].length; j++){
                const currentFore = levels[lvly][lvlx].fore[i][j];
                const savedFore = newLvl.fore?.[i]?.[j];
                if(currentFore && savedFore && savedFore !== 0 && typeof savedFore.variant !== 'undefined'){
                    currentFore.variant = savedFore.variant;
                }
            }
        }
    }else{
        newLvl = localData.get(level.name)
    }
    if(newLvl != null){
        level.lights = [];
        level.ladybugs = newLvl.ladybugs;
        for(let i = 0; i < newLvl.map.length; i++){
            for(let j = 0; j < newLvl.map[i].length; j++){
                const savedTile = newLvl.map[i][j];
                const currentTile = level.map?.[i]?.[j];
                if(savedTile && savedTile.rainFrog){
                    if(savedTile.under_tile && savedTile.under_tile !== 0 && savedTile.under_tile.name){
                        const underTileNum = tile_name_to_num(savedTile.under_tile.name);
                        if(underTileNum !== undefined){
                            const underPos = savedTile.under_tile.pos || currentTile?.pos || { x: j * tileSize, y: i * tileSize };
                            level.map[i][j] = new_tile_from_num(underTileNum, underPos.x, underPos.y);
                            if(level.map[i][j] && typeof level.map[i][j].load === 'function'){
                                level.map[i][j].load(savedTile.under_tile);
                            }
                        }
                    }
                    continue;
                }
                if(savedTile && savedTile !== 0 && currentTile && currentTile !== 0 && savedTile.name){
                    const tileNum = tile_name_to_num(savedTile.name);
                    if(tileNum !== undefined) {
                        const savedPos = savedTile.pos || currentTile.pos;
                        level.map[i][j] = new_tile_from_num(tileNum, savedPos.x, savedPos.y);
                        level.map[i][j].load(savedTile);
                    } else {
                        // Tile name not found, skip loading and keep original
                        console.warn('Saved tile "' + savedTile.name + '" not found, keeping original tile');
                    }
                    if (savedTile.name == 'lamppost') {
                        append(level.lights, new Light(level.map[i][j].pos.x, level.map[i][j].pos.y, (tileSize * 6), 255, 255, 255));
                    }
                    if (savedTile.name == 'satilite') {
                        append(level.lights, new Light(level.map[i][j].pos.x, level.map[i][j].pos.y, (tileSize * 1)+5, 255, 255, 0));
                    }
                    if (savedTile.name == 'LightBug'){
                        let light = new Light(level.map[i][j].pos.x, level.map[i][j].pos.y, (tileSize * 1)-5, 150, 255, 0);
                        append(level.lights, light);
                        level.map[i][j].light = light;
                        level.map[i][j].lightI = level.lights.length - 1;
                    }
                }
            }
        }
    }
}

function deleteWorld(){
    localData.remove('player');
    localData.remove('Day_curLvl_Dif');
    for(let i = 0; i < levels.length; i++){
        for(let j = 0; j < levels[i].length; j++){
            if(levels[i][j] != 0){
                localData.remove(levels[i][j].name);
            }
        }
    }
}

function restoreMainQuestNPCs() {
    if (!window.mainQuestNPCs) return;
    
    const marketLevel = levels[0][5];
    
    // Remove Mr.C from market if he exists
    for (let i = 0; i < marketLevel.map.length; i++) {
        for (let j = 0; j < marketLevel.map[i].length; j++) {
            if (marketLevel.map[i][j] && marketLevel.map[i][j].name === 'Mr.C') {
                marketLevel.map[i][j] = marketLevel.map[i][j].under_tile || 0;
            }
        }
    }
    
    for (const data of window.mainQuestNPCs) {
        const npc = data.npc;
        // Remove from market if still there
        let foundInMarket = false;
        for (let i = 0; i < marketLevel.map.length; i++) {
            for (let j = 0; j < marketLevel.map[i].length; j++) {
                if (marketLevel.map[i][j] === npc) {
                    marketLevel.map[i][j] = npc.under_tile || 0;
                    foundInMarket = true;
                    break;
                }
            }
            if (foundInMarket) break;
        }
        
        // Restore to original level and position
        npc.pos.x = data.originalPos.x;
        npc.pos.y = data.originalPos.y;
        const targetLvl = levels[data.lvlY][data.lvlX];
        if (targetLvl && targetLvl.map) {
            npc.under_tile = targetLvl.map[data.y][data.x];
            targetLvl.map[data.y][data.x] = npc;
        }
    }
    
    // Restore player position
    if (window.playerOriginalPos) {
        currentLevel_x = window.playerOriginalPos.lvlX;
        currentLevel_y = window.playerOriginalPos.lvlY;
        player.pos.x = window.playerOriginalPos.x;
        player.pos.y = window.playerOriginalPos.y;
        window.playerOriginalPos = null;
    }
    
    window.mainQuestNPCs = null;
    console.log('Cloudy Meadows NPCs and Player restored to original positions.');
}
