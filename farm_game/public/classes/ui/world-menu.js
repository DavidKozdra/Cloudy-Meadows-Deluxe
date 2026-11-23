// Main-menu navigation and three independent world slots.
let worldMenuPanel = null;
let pendingNewWorld = null;
let worldMenuBusy = false;

function worldMenuButton(label, action, className = 'main-menu-button') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = t(label);
    button.setAttribute('data-i18n', label);
    button.addEventListener('click', action);
    return button;
}

function closeWorldMenuPanel() {
    document.getElementById('world-menu-panel')?.remove();
    worldMenuPanel = null;
    updateCanvasPointerEvents();
}

function openWorldMenuPanel(kind, title, description) {
    closeWorldMenuPanel();
    worldMenuPanel = kind;
    paused = false;
    creditsOn = false;
    hideMainMenu();
    hideTitleOptions();
    hideCreditsMenu();
    const panel = document.createElement('section');
    panel.id = 'world-menu-panel';
    panel.className = 'world-menu-panel';
    panel.setAttribute('aria-labelledby', 'world-menu-title');
    const heading = document.createElement('h1');
    heading.id = 'world-menu-title';
    heading.textContent = t(title);
    panel.appendChild(heading);
    if (description) {
        const intro = document.createElement('p');
        intro.className = 'world-menu-intro';
        intro.textContent = t(description);
        panel.appendChild(intro);
    }
    document.body.appendChild(panel);
    updateCanvasPointerEvents();
    return panel;
}

function backToWorldMainMenu() {
    closeWorldMenuPanel();
    showMainMenu();
    document.getElementById('new-game-btn')?.focus();
}

function continueWorldGame() {
    const valid = worldSaves.list().filter(world => world.valid);
    if (valid.length === 1) openSavedWorld(valid[0].id);
    else showWorldPicker(valid.length ? 'continue' : 'new');
}

function showWorldPicker(mode = 'continue') {
    worldSaves.invalidate();
    const worlds = worldSaves.list();
    const full = worlds.every(world => world.occupied);
    const title = mode === 'new' ? 'New Game' : mode === 'manage' ? 'Manage Worlds' : 'Choose Your World';
    const intro = mode === 'new'
        ? (full ? 'All three slots are in use. Delete a world to make room for a new game.' : 'Choose an empty slot, then select your difficulty.')
        :  '';
    const panel = openWorldMenuPanel(mode, title, intro);
    const grid = document.createElement('div');
    grid.className = 'world-slot-grid';
    for (const world of worlds) {
        const card = document.createElement('article');
        card.className = 'world-slot-card' + (world.occupied ? '' : ' world-slot-empty');
        card.dataset.worldSlot = world.id;
        const name = document.createElement('h2');
        name.textContent = t('World {number}', { number: world.id });
        card.appendChild(name);
        const status = document.createElement('p');
        status.className = 'world-slot-difficulty';
        status.textContent = world.valid ? t(['Easy', 'Medium', 'Hard', 'Custom'][world.difficulty])
            : t(world.occupied ? 'Save unavailable' : 'Empty slot');
        card.appendChild(status);
        if (world.valid) {
            const stats = document.createElement('dl');
            stats.className = 'world-slot-stats';
            const info = [['Day', world.days], ['Coins', world.coins.toLocaleString()], ['Weather', t(world.weather)]];
            if (world.location) info.push(['Location', world.location]);
            if (world.updatedAt && Number.isFinite(Date.parse(world.updatedAt))) {
                info.push(['Last saved', new Date(world.updatedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })]);
            }
            for (const [label, value] of info) {
                const term = document.createElement('dt');
                term.textContent = t(label);
                const detail = document.createElement('dd');
                detail.textContent = String(value);
                if (label === 'Location' || label === 'Last saved') {
                    term.className = 'world-slot-detail-label';
                    detail.className = 'world-slot-detail-value';
                }
                stats.append(term, detail);
            }
            card.appendChild(stats);
        } else {
            const hint = document.createElement('p');
            hint.className = 'world-slot-hint';
            hint.textContent = t(world.occupied ? 'This save cannot be continued. You can delete it to free this slot.' : 'A fresh start in Cloudy Meadows.');
            card.appendChild(hint);
        }
        const actions = document.createElement('div');
        actions.className = 'world-slot-actions';
        if (!world.occupied) {
            actions.appendChild(worldMenuButton('New Game', () => startNewWorld(world.id), 'world-slot-play'));
        } else {
            if (world.valid && mode !== 'new') actions.appendChild(worldMenuButton('Continue', () => openSavedWorld(world.id), 'world-slot-play'));
            if (mode !== 'continue') {
                actions.appendChild(worldMenuButton('Delete World', () => {
                    if (!confirm(t('Delete World {number}? Its progress will be permanently removed. Your other worlds will be kept.', { number: world.id }))) return;
                    worldSaves.clearWorld(world.id);
                    showWorldPicker(mode);
                }, 'world-slot-delete'));
            }
        }
        card.appendChild(actions);
        grid.appendChild(card);
    }
    panel.appendChild(grid);
    panel.appendChild(worldMenuButton('Back', backToWorldMainMenu, 'world-menu-back'));
    panel.querySelector('button')?.focus({ preventScroll: true });
}

function showMoreMenu() {
    const panel = openWorldMenuPanel('more', 'More', 'Explore, learn, and manage your worlds.');
    const actions = document.createElement('div');
    actions.className = 'main-menu-actions';
    actions.appendChild(worldMenuButton('Manage Worlds', () => showWorldPicker('manage')));
    const autoFarm = document.createElement('a');
    autoFarm.href = 'autofarm/';
    autoFarm.className = 'main-menu-button';
    autoFarm.textContent = 'AutoFarm';
    actions.appendChild(autoFarm);
    actions.appendChild(worldMenuButton('How to Play', () => {
        queueTutorialPrompt('full-tutorial', { manual: true, dedupeKey: 'main-menu-help' });
    }));
    actions.appendChild(worldMenuButton('Back', backToWorldMainMenu));
    panel.appendChild(actions);
    actions.querySelector('button')?.focus({ preventScroll: true });
}

function resetRuntimeForWorld(id) {
    worldSaves.activate(id);
    const savedDay = localData.get('Day_curLvl_Dif');
    window.customRules = savedDay?.customRules || null;
    if (tutorialScheduleTimer) window.clearTimeout(tutorialScheduleTimer);
    tutorialPromptQueue = [];
    activeTutorialPrompt = null;
    tutorialShouldResumeGameplay = false;
    tutorialShouldReturnToPauseMenu = false;
    document.getElementById('tutorial-overlay')?.remove();
    hideUIPopups();
    hideBridgeTutorialBanner();
    window.mainQuestNPCs = null;
    window.playerOriginalPos = null;
    visitedLocations = new Set();
    lose_screen = false;
    paused = false;
    creditsOn = false;
    dificulty_screen = false;
    dificulty = 0;
    dayOfWeek = 0;
    timeSpeed = 1;
    timeSpeedIndex = 4;
    lastTimeMili = millis();
    lastTimeWatchMili = millis();
    worldUpdateTick = 0;
    mouse_item = 0;
    currentWeather = 'clear';
    weatherLog = [];
    lastRainDay = -999;
    lastFrogRainDay = -999;
    heatwaveStartDay = -999;
    heatwaveEndDay = -999;
    frogRainEntities = [];
    clearTimeRewindSnapshots();
    newWorld();
    loadAll();
}

function openSavedWorld(id) {
    if (worldMenuBusy || !worldSaves.summary(id).valid) return;
    worldMenuBusy = true;
    triggerMenuFadeOut(() => {
        try {
            resetRuntimeForWorld(id);
            closeWorldMenuPanel();
            hideMainMenu();
            hideDifficultyMenu();
            title_screen = false;
            startButton.hide();
            optionsButton.hide();
            creditsButton.hide();
            if (!lose_screen) scheduleContextualTutorials(250);
        } catch (error) {
            title_screen = true;
            showWorldPicker('continue');
            alert(t('This world could not be loaded.') + ' ' + error.message);
        } finally {
            worldMenuBusy = false;
        }
    });
}

function startNewWorld(id) {
    if (worldMenuBusy || worldSaves.summary(id).occupied) return;
    worldSaves.compact();
    pendingNewWorld = { id, previousId: worldSaves.activeId };
    resetRuntimeForWorld(id);
    closeWorldMenuPanel();
    hideMainMenu();
    document.getElementById('difficulty-menu')?.remove();
    title_screen = false;
    dificulty_screen = true;
    showDifficultyMenu();
}

function cancelNewWorld() {
    if (pendingNewWorld) {
        worldSaves.clearWorld(pendingNewWorld.id);
        worldSaves.activate(pendingNewWorld.previousId);
        pendingNewWorld = null;
    }
    dificulty_screen = false;
    title_screen = true;
    paused = false;
    hideDifficultyMenu();
    showMainMenu();
}

function finishNewWorldSave() {
    saveAll();
    captureDaySnapshot(days);
    pendingNewWorld = null;
}

function showWorldMainMenu() {
    startButton?.hide();
    optionsButton?.hide();
    creditsButton?.hide();
    const legacyLanguage = document.getElementById('main-menu-language-control');
    if (legacyLanguage) legacyLanguage.style.display = 'none';
    if (worldMenuPanel || paused || creditsOn) {
        hideMainMenu();
        return;
    }
    let container = document.getElementById('main-menu-container');
    if (!container) {
        container = document.createElement('nav');
        container.id = 'main-menu-container';
        container.className = 'main-menu';
        container.setAttribute('aria-label', t('Main menu'));
        const image = document.createElement('img');
        image.src = 'images/ui/Title_Screen.gif';
        image.alt = 'Cloudy Meadows';
        image.className = 'main-menu-title-image';
        const deluxe = document.createElement('div');
        deluxe.className = 'deluxe-text';
        deluxe.textContent = 'DELUXE';
        container.append(image, deluxe);
        const actions = document.createElement('div');
        actions.className = 'main-menu-actions';
        const entries = [
            ['Continue', 'start-btn', continueWorldGame],
            ['New Game', 'new-game-btn', () => showWorldPicker('new')],
            ['Options', 'options-btn', () => { paused = true; creditsOn = false; }],
            ['More', 'more-btn', showMoreMenu],
            ['Credits', 'credits-btn', () => { creditsOn = true; paused = false; }]
        ];
        for (const [label, id, action] of entries) {
            const button = worldMenuButton(label, action);
            button.id = id;
            actions.appendChild(button);
        }
        container.appendChild(actions);
        const language = document.createElement('label');
        language.className = 'main-menu-language-control';
        const languageLabel = document.createElement('span');
        languageLabel.textContent = t('Language');
        languageLabel.setAttribute('data-i18n', 'Language');
        language.append(languageLabel, createLanguageSelect('language-select main-menu-language-select'));
        container.appendChild(language);
        document.body.appendChild(container);
    }
    const continueButton = document.getElementById('start-btn');
    continueButton.hidden = !worldSaves.list().some(world => world.valid);
    container.style.display = 'flex';
    updateCanvasPointerEvents();
}

window.addEventListener('storage', () => worldSaves.invalidate());
