// Achievements: goals tracked across every world, stored under the shared
// 'Achievements' key (see SHARED_KEYS in world-saves.js), so deleting or
// switching worlds never loses them.
//
// CloudyAchievements.create(store) is the pure tracker the tests drive. The
// rest of the file connects it to the game: events, harvest sites, the unlock
// popup and the achievement list shown in the More menu and the pause menu.
(function (global) {
    'use strict';

    const STORAGE_KEY = 'Achievements';
    const MAIN_QUEST = 'Save Cloudy Meadows';
    const CORN_GOAL = 1000;
    const NICE_DAY = 69;
    const FAST_WIN_DAY = 20;
    const FROG_RAIN_GOAL = 2;
    const HARD_DIFFICULTY = 2;
    const CUSTOM_DIFFICULTY = 3;
    // Show who is left for Hello World once only a handful remain.
    const NPC_HINT_LIMIT = 5;

    // Every NPC placed in the shipped world. The Scientist arrives in The Big
    // City on day 88. Deb, Meb and OldManJ are defined in config/tiles.js but
    // never placed, so they are left out. achievements.test.js checks this
    // list against the level maps.
    const ALL_NPCS = Object.freeze([
        'Mr.C', 'Rick', 'Mario', 'Garry', 'Liam', 'Mira', 'Brandon', 'Brent', 'James', 'BlindPete',
        'Adam', 'Barry', 'Ishmil', 'Super Tina', 'Vinny',
        'Kenny', 'Dog', 'Guy', 'David',
        'Zoda',
        'Ticket Master', 'Fisher Joe', 'Sandy', 'Skipper', 'Alex Chen',
        'Priya Patel', 'Marcus Brown', 'Sophia Moore', 'Jordan Kim', 'Kiah', 'Coral', 'Scientist'
    ]);

    const DEFINITIONS = Object.freeze([
        { id: 'corn-addict', title: 'Corn Addict', description: 'Harvest 1,000 corn.', icon: 'images/items/Corn_item.png' },
        { id: 'gamer', title: 'Gamer', description: 'Beat the game on Hard or Hardcore.', icon: 'images/ui/dealth_icon(128x128).png' },
        { id: 'hello-world', title: 'Hello World', description: 'Talk to every NPC that exists.', icon: 'images/ui/Chat_Icon.png' },
        { id: 'bible-reference', title: 'Bible Reference', description: 'See frog rain twice in one world.', icon: 'images/npc/frog_front.png' },
        { id: 'like-minecraft', title: "It's Like Minecraft", description: 'Beat the game in 3D mode.', icon: 'images/tiles/Grass.png' },
        { id: 'nice', title: 'Nice', description: 'Reach day 69.', icon: 'images/ui/Calender.png' },
        { id: 'absolute-gamer', title: 'Absolute Gamer', description: 'Beat the game before day 20.', icon: 'images/items/stop_watch.png' }
    ].map(Object.freeze));

    // Hard difficulty, or a Custom game with all three of Hard's penalties on
    // (the Hardcore preset turns all three on).
    function isHardcoreRun(difficulty, rules) {
        if (difficulty === HARD_DIFFICULTY) return true;
        return difficulty === CUSTOM_DIFFICULTY && !!rules &&
            rules.permaDeath === true && rules.moneyLoss === true && rules.foodRot === true;
    }

    // The weather log holds one record per day, so repeat entries for a day
    // (rewinds, re-rolls) can't count twice.
    function frogRainDays(weatherLog) {
        if (!Array.isArray(weatherLog)) return 0;
        const days = new Set();
        for (const entry of weatherLog) {
            if (entry && entry.weather === 'frog-rain') days.add(entry.day);
        }
        return days.size;
    }

    function blankState() {
        return { unlocked: {}, cornHarvested: 0, npcsTalkedTo: [] };
    }

    function normalizeState(raw) {
        const state = blankState();
        if (!raw || typeof raw !== 'object') return state;
        if (raw.unlocked && typeof raw.unlocked === 'object') {
            for (const def of DEFINITIONS) {
                if (typeof raw.unlocked[def.id] === 'string') state.unlocked[def.id] = raw.unlocked[def.id];
            }
        }
        if (Number.isFinite(raw.cornHarvested) && raw.cornHarvested > 0) {
            state.cornHarvested = Math.floor(raw.cornHarvested);
        }
        if (Array.isArray(raw.npcsTalkedTo)) {
            state.npcsTalkedTo = ALL_NPCS.filter(name => raw.npcsTalkedTo.includes(name));
        }
        return state;
    }

    function create(store, options = {}) {
        const onUnlock = typeof options.onUnlock === 'function' ? options.onUnlock : () => {};
        const now = typeof options.now === 'function' ? options.now : () => new Date().toISOString();
        let state = null;

        function read() {
            if (!state) {
                let raw = null;
                try { raw = store.get(STORAGE_KEY); } catch (error) { raw = null; }
                state = normalizeState(raw);
            }
            return state;
        }

        function write() {
            try {
                store.set(STORAGE_KEY, read());
            } catch (error) {
                if (global.console) global.console.warn('Could not save achievements', error);
            }
        }

        function isUnlocked(id) {
            return !!read().unlocked[id];
        }

        // Returns true only the first time an achievement unlocks.
        function unlock(id) {
            const def = DEFINITIONS.find(entry => entry.id === id);
            if (!def || isUnlocked(id)) return false;
            read().unlocked[id] = now();
            write();
            onUnlock(def);
            return true;
        }

        function recordHarvest(itemName, amount) {
            const count = Math.floor(Number(amount));
            if (itemName !== 'Corn' || !(count > 0)) return;
            read().cornHarvested += count;
            write();
            if (read().cornHarvested >= CORN_GOAL) unlock('corn-addict');
        }

        function recordNpcTalk(name) {
            if (!ALL_NPCS.includes(name)) return;
            const talkedTo = read().npcsTalkedTo;
            if (!talkedTo.includes(name)) {
                talkedTo.push(name);
                write();
            }
            if (talkedTo.length >= ALL_NPCS.length) unlock('hello-world');
        }

        // Goals that depend on the current world's state. Safe to re-run at any
        // time, including on a save that already qualifies.
        function checkWorld(world = {}) {
            if (Number(world.days) >= NICE_DAY) unlock('nice');
            if (frogRainDays(world.weatherLog) >= FROG_RAIN_GOAL) unlock('bible-reference');
        }

        // Called once, the moment the main quest is completed.
        function recordGameBeaten(run = {}) {
            if (isHardcoreRun(run.difficulty, run.rules)) unlock('gamer');
            if (run.is3D === true) unlock('like-minecraft');
            if (Number.isFinite(run.days) && run.days < FAST_WIN_DAY) unlock('absolute-gamer');
        }

        function progressFor(id) {
            if (id === 'corn-addict') {
                return { current: Math.min(read().cornHarvested, CORN_GOAL), goal: CORN_GOAL };
            }
            if (id === 'hello-world') {
                const talkedTo = read().npcsTalkedTo;
                const remaining = ALL_NPCS.filter(name => !talkedTo.includes(name));
                return { current: talkedTo.length, goal: ALL_NPCS.length, remaining };
            }
            return null;
        }

        function list() {
            return DEFINITIONS.map(def => ({
                ...def,
                unlockedAt: read().unlocked[def.id] || null,
                progress: progressFor(def.id)
            }));
        }

        return {
            unlock, isUnlocked, recordHarvest, recordNpcTalk, checkWorld, recordGameBeaten, list,
            unlockedCount: () => DEFINITIONS.filter(def => isUnlocked(def.id)).length,
            total: DEFINITIONS.length
        };
    }

    global.CloudyAchievements = {
        create, isHardcoreRun, frogRainDays, DEFINITIONS, ALL_NPCS, STORAGE_KEY, MAIN_QUEST,
        CORN_GOAL, NICE_DAY, FAST_WIN_DAY, FROG_RAIN_GOAL
    };

    // --- Game wiring ---------------------------------------------------------

    // Shadows i18n.js's t() so this file still runs where it isn't loaded (tests).
    const t = (text, vars) => (typeof global.t === 'function' ? global.t(text, vars) : text);
    let tracker = null;

    // Created on first use, since localData is defined by sketch.js, which
    // loads after this file.
    function achievements() {
        if (!tracker && typeof localData !== 'undefined' && localData) {
            tracker = create(localData, { onUnlock: queueAchievementToast });
        }
        return tracker;
    }

    // Harvests by the player, their robots and the Auto Farms harvesters all
    // land here. The Auto Farms bots farm on their own, so their harvests
    // don't count.
    function recordCropHarvest(itemNum, amount, levelName, byPlayer) {
        if (!byPlayer && typeof levelName === 'string' && levelName.startsWith('Auto Farms')) return;
        const item = typeof all_items !== 'undefined' && Array.isArray(all_items) ? all_items[itemNum] : null;
        if (item && item.name) achievements()?.recordHarvest(item.name, amount);
    }

    function checkWorldAchievements() {
        achievements()?.checkWorld({
            days: typeof days !== 'undefined' ? days : 0,
            weatherLog: typeof weatherLog !== 'undefined' ? weatherLog : []
        });
    }

    if (typeof global.addEventListener === 'function') {
        global.addEventListener('npcInteraction', event => {
            achievements()?.recordNpcTalk(event.detail && event.detail.npcName);
        });
        global.addEventListener('newDay', checkWorldAchievements);
        global.addEventListener('questCompleted', event => {
            const quest = event.detail && event.detail.quest;
            if (!quest || quest.og_name !== MAIN_QUEST) return;
            achievements()?.recordGameBeaten({
                days: typeof days !== 'undefined' ? Number(days) : NaN,
                difficulty: typeof dificulty !== 'undefined' ? dificulty : null,
                rules: global.customRules || null,
                is3D: typeof is3DMode !== 'undefined' && is3DMode === true
            });
        });
    }

    // --- Unlock popup ----------------------------------------------------------

    const TOAST_VISIBLE_MS = 4500;
    const TOAST_GAP_MS = 450;
    const toastQueue = [];
    let toastActive = false;

    function queueAchievementToast(def) {
        toastQueue.push(def);
        if (!toastActive) showNextToast();
    }

    function showNextToast() {
        const def = toastQueue.shift();
        if (!def || !global.document || !global.document.body) {
            toastActive = false;
            return;
        }
        toastActive = true;
        const doc = global.document;
        let toast = doc.getElementById('achievement-toast');
        if (!toast) {
            toast = doc.createElement('div');
            toast.id = 'achievement-toast';
            toast.className = 'achievement-toast';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            doc.body.appendChild(toast);
        }
        const icon = doc.createElement('img');
        icon.className = 'achievement-toast-icon';
        icon.src = def.icon;
        icon.alt = '';
        const text = doc.createElement('div');
        text.className = 'achievement-toast-text';
        const label = doc.createElement('span');
        label.className = 'achievement-toast-label';
        label.textContent = t('Achievement unlocked!');
        const title = doc.createElement('strong');
        title.className = 'achievement-toast-title';
        title.textContent = t(def.title);
        const description = doc.createElement('span');
        description.className = 'achievement-toast-description';
        description.textContent = t(def.description);
        text.append(label, title, description);
        toast.replaceChildren(icon, text);
        // Next frame, so the slide-in transition runs on a freshly filled toast.
        const nextFrame = global.requestAnimationFrame || (callback => global.setTimeout(callback, 16));
        nextFrame(() => toast.classList.add('visible'));
        if (typeof moneySound !== 'undefined' && moneySound && typeof moneySound.play === 'function') {
            moneySound.play();
        }
        global.setTimeout(() => {
            toast.classList.remove('visible');
            global.setTimeout(showNextToast, TOAST_GAP_MS);
        }, TOAST_VISIBLE_MS);
    }

    // --- Achievement list (More menu and pause menu) ----------------------------

    function formatUnlockDate(iso) {
        const date = new Date(iso);
        return Number.isFinite(date.getTime())
            ? date.toLocaleDateString(undefined, { dateStyle: 'medium' })
            : '';
    }

    // Replaces host's contents with the summary line and one card per achievement.
    function renderAchievementList(host) {
        const doc = global.document;
        const tracked = achievements();
        if (!host || !doc || !tracked) return;
        const summary = doc.createElement('p');
        summary.className = 'achievement-summary';
        summary.textContent = t('{count} of {total} unlocked', { count: tracked.unlockedCount(), total: tracked.total });

        const listEl = doc.createElement('ul');
        listEl.className = 'achievement-list';
        for (const entry of tracked.list()) {
            const unlocked = !!entry.unlockedAt;
            const card = doc.createElement('li');
            card.className = 'achievement-card ' + (unlocked ? 'achievement-unlocked' : 'achievement-locked');

            const icon = doc.createElement('img');
            icon.className = 'achievement-icon';
            icon.src = entry.icon;
            icon.alt = '';

            const body = doc.createElement('div');
            body.className = 'achievement-body';
            const title = doc.createElement('h3');
            title.className = 'achievement-title';
            title.textContent = t(entry.title);
            const description = doc.createElement('p');
            description.className = 'achievement-description';
            description.textContent = t(entry.description);
            body.append(title, description);

            if (entry.progress && !unlocked) {
                const { current, goal } = entry.progress;
                const bar = doc.createElement('div');
                bar.className = 'achievement-progress';
                bar.setAttribute('role', 'progressbar');
                bar.setAttribute('aria-valuemin', '0');
                bar.setAttribute('aria-valuemax', String(goal));
                bar.setAttribute('aria-valuenow', String(current));
                bar.setAttribute('aria-label', t(entry.title));
                const fill = doc.createElement('span');
                fill.style.width = Math.round((current / goal) * 100) + '%';
                bar.appendChild(fill);
                const count = doc.createElement('p');
                count.className = 'achievement-progress-label';
                count.textContent = current.toLocaleString() + ' / ' + goal.toLocaleString();
                body.append(bar, count);
                const remaining = entry.progress.remaining;
                if (Array.isArray(remaining) && remaining.length && remaining.length <= NPC_HINT_LIMIT) {
                    const hint = doc.createElement('p');
                    hint.className = 'achievement-hint';
                    hint.textContent = t('Still to meet: {names}', { names: remaining.join(', ') });
                    body.appendChild(hint);
                }
            }

            const status = doc.createElement('p');
            status.className = 'achievement-status';
            status.textContent = unlocked
                ? t('Unlocked {date}', { date: formatUnlockDate(entry.unlockedAt) }).trim()
                : t('Locked');
            body.appendChild(status);

            card.append(icon, body);
            listEl.appendChild(card);
        }
        host.replaceChildren(summary, listEl);
    }

    global.recordCropHarvest = recordCropHarvest;
    global.checkWorldAchievements = checkWorldAchievements;
    global.renderAchievementList = renderAchievementList;
})(window);
