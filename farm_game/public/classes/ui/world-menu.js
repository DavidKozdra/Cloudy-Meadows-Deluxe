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

async function continueWorldGame() {
    try {
        await worldSaves.ready;
        const page = await worldSaves.page({ limit: 2 });
        if (page.items.length === 1) await openSavedWorld(page.items[0].id);
        else await showWorldPicker(page.items.length ? 'continue' : 'new');
    } catch (error) { reportWorldSaveError(error); }
}

async function showWorldPicker(mode = 'continue', after = 0) {
    await worldSaves.ready;
    await worldSaves.invalidate();
    const savedPage = mode === 'new' ? null : await worldSaves.page({ after, limit: 3 });
    const usesDefaultSlots = !after && worldSaves.count <= 3 && savedPage?.items.every(world => world.id <= 3);
    const page = usesDefaultSlots ? null : savedPage;
    const worlds = page ? page.items : worldSaves.list();
    const full = worlds.every(world => world.occupied);
    const title = mode === 'new' ? 'New Game' : mode === 'manage' ? 'Manage Worlds' : 'Choose Your World';
    const intro = mode === 'new'
        ? (full ? 'All three slots are in use. Delete a world to make room for a new game.' : 'Choose an empty slot, then select your difficulty.')
        :  '';
    const panel = openWorldMenuPanel(mode, title, intro);
    panel.classList.add('world-picker');
    const header = document.createElement('div');
    header.className = 'world-picker-header';
    header.appendChild(panel.querySelector('h1'));
    panel.prepend(header);
    const content = document.createElement('div');
    content.className = 'world-picker-content';
    const introElement = panel.querySelector('.world-menu-intro');
    if (introElement) content.appendChild(introElement);
    panel.appendChild(content);
    const grid = document.createElement('div');
    grid.className = 'world-slot-grid';
    for (const world of worlds) {
        const card = document.createElement('article');
        card.className = 'world-slot-card' + (world.occupied ? '' : ' world-slot-empty');
        card.dataset.worldSlot = world.id;
        const cardHeading = document.createElement('div');
        cardHeading.className = 'world-slot-heading';
        const name = document.createElement('h2');
        name.id = 'world-slot-title-' + world.id;
        card.setAttribute('aria-labelledby', name.id);
        name.textContent = t('World {number}', { number: world.id });
        cardHeading.appendChild(name);
        const status = document.createElement('p');
        status.className = 'world-slot-difficulty';
        status.textContent = world.valid ? t(['Easy', 'Medium', 'Hard', 'Custom'][world.difficulty])
            : t(world.occupied ? 'Save unavailable' : 'Empty slot');
        cardHeading.appendChild(status);
        card.appendChild(cardHeading);
        if (world.valid) {
            const stats = document.createElement('dl');
            stats.className = 'world-slot-stats';
            const info = [['Day', world.days], ['Coins', world.coins.toLocaleString()], ['Weather', t(world.weather)]];
            if (world.location) info.push(['Location', world.location]);
            if (world.updatedAt && Number.isFinite(Date.parse(world.updatedAt))) {
                info.push(['Last saved', new Date(world.updatedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })]);
            }
            for (const [label, value] of info) {
                const stat = document.createElement('div');
                stat.className = 'world-slot-stat';
                const term = document.createElement('dt');
                term.textContent = t(label);
                const detail = document.createElement('dd');
                detail.textContent = String(value);
                if (label === 'Location' || label === 'Last saved') {
                    stat.classList.add('world-slot-stat-detail');
                    term.className = 'world-slot-detail-label';
                    detail.className = 'world-slot-detail-value';
                }
                stat.append(term, detail);
                stats.appendChild(stat);
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
            if (mode === 'manage' && world.valid) actions.appendChild(worldMenuButton('Download Backup', () => worldSaves.download(world.id).catch(reportWorldSaveError), 'world-slot-play world-slot-backup'));
            if (mode !== 'continue') {
                actions.appendChild(worldMenuButton('Delete World', async () => {
                    if (!confirm(t('Delete World {number}? Its progress will be permanently removed. Your other worlds will be kept.', { number: world.id }))) return;
                    try { await worldSaves.clearWorld(world.id); await showWorldPicker(mode); }
                    catch (error) { reportWorldSaveError(error); }
                }, 'world-slot-delete'));
            }
        }
        card.appendChild(actions);
        grid.appendChild(card);
    }
    content.appendChild(grid);
    if (page) {
        const paging = document.createElement('div'); paging.className = 'world-slot-actions world-picker-pagination';
        if (after) paging.appendChild(worldMenuButton('First page', () => showWorldPicker(mode), 'world-menu-back'));
        if (page.next) paging.appendChild(worldMenuButton('Next page', () => showWorldPicker(mode, page.next), 'world-menu-back'));
        if (paging.childElementCount) content.appendChild(paging);
    }
    if (mode === 'manage') {
        const storage = document.createElement('p'); storage.className = 'world-menu-intro';
        content.appendChild(storage);
        worldSaves.storageInfo().then(info => {
            storage.textContent = info.quota == null ? t('Storage estimate unavailable.') :
                `${Math.ceil(info.usage / 1048576)} MB / ${Math.floor(info.quota / 1048576)} MB · ${info.persistent ? t('Persistent storage enabled') : t('Back up your worlds regularly')}`;
        });
        content.appendChild(worldMenuButton('Protect Local Saves', async () => {
            const granted = await worldSaves.requestPersistence();
            storage.textContent = t(granted ? 'Persistent storage enabled. Download backups to keep another copy.' : 'The browser did not grant persistent storage. Download backups to keep another copy.');
        }, 'world-menu-back'));
    }
    content.appendChild(worldMenuButton('Back', backToWorldMainMenu, 'world-menu-back world-picker-back'));
    grid.querySelector('button')?.focus({ preventScroll: true });
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
    actions.appendChild(worldMenuButton('Achievements', showAchievementsPanel));
    actions.appendChild(worldMenuButton('How to Play', () => {
        queueTutorialPrompt('full-tutorial', { manual: true, dedupeKey: 'main-menu-help' });
    }));
    actions.appendChild(worldMenuButton('Back', backToWorldMainMenu));
    panel.appendChild(actions);
    actions.querySelector('button')?.focus({ preventScroll: true });
}

function showAchievementsPanel() {
    const panel = openWorldMenuPanel('achievements', 'Achievements');
    const host = document.createElement('div');
    host.className = 'achievement-host';
    panel.appendChild(host);
    renderAchievementList(host);
    const back = worldMenuButton('Back', showMoreMenu, 'world-menu-back');
    panel.appendChild(back);
    back.focus({ preventScroll: true });
}

async function resetRuntimeForWorld(id) {
    await worldSaves.activate(id);
    await worldSaves.baseReady;
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
    window.bridgeTutorialActive = false;
    window.bridgeTutorialStartLevel = null;
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

async function openSavedWorld(id) {
    if (worldMenuBusy || !worldSaves.summary(id).valid) return;
    worldMenuBusy = true;
    triggerMenuFadeOut(async () => {
        try {
            await resetRuntimeForWorld(id);
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

async function startNewWorld(id) {
    if (worldMenuBusy || worldSaves.summary(id).occupied) return;
    worldMenuBusy = true;
    try {
        await worldSaves.ready;
        if (await worldSaves.repository.getBySlot(id)) throw new Error('This slot was filled in another tab. Refresh the world list.');
        pendingNewWorld = { id, previousId: worldSaves.activeId };
        await resetRuntimeForWorld(id);
    closeWorldMenuPanel();
    hideMainMenu();
    document.getElementById('difficulty-menu')?.remove();
    title_screen = false;
    dificulty_screen = true;
    showDifficultyMenu();
    } catch (error) { pendingNewWorld = null; reportWorldSaveError(error); }
    finally { worldMenuBusy = false; }
}

async function cancelNewWorld() {
    if (pendingNewWorld) {
        await worldSaves.clearWorld(pendingNewWorld.id);
        await worldSaves.activate(pendingNewWorld.previousId);
        pendingNewWorld = null;
    }
    dificulty_screen = false;
    title_screen = true;
    paused = false;
    hideDifficultyMenu();
    showMainMenu();
}

async function finishNewWorldSave(resumeAfterSave = false) {
    try {
        if (await saveAll()) {
            captureDaySnapshot(days);
            pendingNewWorld = null;
            if (resumeAfterSave) paused = false;
        } else {
            paused = true;
        }
    } catch (error) {
        paused = true;
        reportWorldSaveError(error);
    }
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
        // Logo + DELUXE travel together; on landscape phones they form the right column.
        const brand = document.createElement('div');
        brand.className = 'main-menu-brand';
        brand.append(image, deluxe);
        container.appendChild(brand);
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
    continueButton.hidden = !worldSaves.count;
    for (const id of ['start-btn', 'new-game-btn', 'more-btn']) document.getElementById(id).disabled = !worldSaves.initialized;
    let loading = document.getElementById('world-storage-loading');
    if (!loading) { loading = document.createElement('p'); loading.id = 'world-storage-loading'; container.appendChild(loading); }
    loading.hidden = worldSaves.initialized;
    loading.textContent = worldSaves.initializationError ? t('Could not open saves. Reload to try again; existing saves have been kept.') : t('Opening saved worlds…');
    container.style.display = 'flex';
    updateCanvasPointerEvents();
}

window.addEventListener('storage', () => worldSaves.invalidate());

function reportWorldSaveError(error) {
    console.error('World save failed:', error);
    showWorldSaveStatus({ state: 'error', message: error?.message || 'Could not save this world.' });
}

async function saveAndQuitWorld() {
    const button = document.getElementById('pause-quit-btn');
    if (button?.disabled) return;
    if (button) button.disabled = true;
    try {
        if (!await saveAll()) return;
        title_screen = true; paused = false; hidePaused();
        clearButton.hide(); QuitButton.hide();
        showMainMenu();
    } catch (error) { reportWorldSaveError(error); }
    finally { if (button) button.disabled = false; }
}

let worldSaveNoticeTimer = null;
function showWorldSaveStatus({ state, message }) {
    if (!document.body) {
        window.addEventListener('DOMContentLoaded', () => showWorldSaveStatus({ state, message }), { once: true });
        return;
    }
    clearTimeout(worldSaveNoticeTimer);
    let notice = document.getElementById('world-save-notice');
    if (!notice) { notice = document.createElement('aside'); notice.id = 'world-save-notice'; document.body.appendChild(notice); }
    notice.replaceChildren(); notice.hidden = state === 'idle';
    notice.setAttribute('role', state === 'error' ? 'alert' : 'status');
    const text = document.createElement('p');
    text.textContent = state === 'saving' ? t('Saving…') : state === 'saved' ? t('Saved') : message;
    notice.appendChild(text);
    if (state === 'error' || state === 'recovered') {
        if (worldSaves.activeWorldId) {
            notice.appendChild(worldMenuButton('Download Backup', () => worldSaves.download().catch(reportWorldSaveError)));
            notice.appendChild(worldMenuButton('Retry Save', () => {
                if (pendingNewWorld) finishNewWorldSave(true);
                else if (!title_screen) Promise.resolve(saveAll()).catch(reportWorldSaveError);
                else worldSaves.flush().catch(reportWorldSaveError);
            }));
        }
        notice.appendChild(worldMenuButton('Close', () => { notice.hidden = true; }));
    }
    if (state === 'saved') worldSaveNoticeTimer = setTimeout(() => { notice.hidden = true; }, 1800);
}
window.addEventListener('worldSaveStatus', event => showWorldSaveStatus(event.detail));
