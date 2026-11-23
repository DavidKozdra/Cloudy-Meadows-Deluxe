// Achievements: goals tracked across every world, stored under the shared
// 'Achievements' key (see SHARED_KEYS in world-saves.js), so deleting or
// switching worlds never loses them.
//
// Most achievements are data: a lifetime stat that must reach a goal, or a
// collection that must be completed. Game code reports what happened with
// trackAchievement(type, detail) and the tracker updates stats and unlocks.
//
// CloudyAchievements.create(store) is the pure tracker the tests drive. The
// rest of the file connects it to the game: events, the unlock popup and the
// achievement list shown in the More menu and the pause menu.
(function (global) {
    'use strict';

    const STORAGE_KEY = 'Achievements';
    const MAIN_QUEST = 'Save Cloudy Meadows';
    const FAST_WIN_DAY = 20;
    const FROG_RAIN_GOAL = 2;
    const HARD_DIFFICULTY = 2;
    const CUSTOM_DIFFICULTY = 3;
    // A collection names what is left once only a handful remain.
    const HINT_LIMIT = 5;

    // Every NPC placed in the shipped world. The Scientist arrives in The Big
    // City on day 88. Deb, Meb and OldManJ are defined in config/tiles.js but
    // never placed, so they are left out. achievements.test.js checks every
    // collection below against the game data.
    const ALL_NPCS = Object.freeze([
        'Mr.C', 'Rick', 'Mario', 'Garry', 'Liam', 'Mira', 'Brandon', 'Brent', 'James', 'BlindPete',
        'Adam', 'Barry', 'Ishmil', 'Super Tina', 'Vinny',
        'Kenny', 'Dog', 'Guy', 'David',
        'Zoda',
        'Ticket Master', 'Fisher Joe', 'Sandy', 'Skipper', 'Alex Chen',
        'Priya Patel', 'Marcus Brown', 'Sophia Moore', 'Jordan Kim', 'Kiah', 'Coral', 'Scientist'
    ]);

    const COLLECTIONS = Object.freeze({
        npcs: ALL_NPCS,
        // What each seed grows into (flowers yield nothing).
        crops: Object.freeze(['Corn', 'Sweet Potatoes', 'Strawberries', 'Tomato', 'Watermelon', 'Hemp Flower', 'Carrot', 'Pumpkin']),
        // Every item of class 'Eat'.
        foods: Object.freeze(['Corn', 'Sweet Potatoes', 'Strawberries', 'Full Course', 'Tomato', 'Watermelon', 'Hemp Flower', 'Hotdog', 'Carrot', 'Pumpkin']),
        // The part of a level name before its colon.
        districts: Object.freeze(['Cloudy Meadows', 'Poly Park', 'Swiggy Swamps', 'Auto Farms', 'The Big City', 'Beach']),
        weather: Object.freeze(['clear', 'partly-cloudy', 'overcast', 'fog', 'sunshower', 'rain', 'thunderstorm', 'heatwave', 'frog-rain'])
    });

    const COLLECTION_HINTS = Object.freeze({
        npcs: 'Still to meet: {names}',
        crops: 'Still to harvest: {names}',
        foods: 'Still to taste: {names}',
        districts: 'Still to visit: {names}',
        weather: 'Still to see: {names}'
    });

    const WEATHER_LABELS = Object.freeze({
        'clear': 'Clear', 'partly-cloudy': 'Partly Cloudy', 'overcast': 'Overcast', 'fog': 'Fog',
        'sunshower': 'Sunshower', 'rain': 'Rain', 'thunderstorm': 'Thunderstorm', 'heatwave': 'Heatwave',
        'frog-rain': 'Frog Rain'
    });

    const CATEGORIES = Object.freeze(['Farming', 'Money', 'Food & Survival', 'Story', 'Exploring', 'Robots & Time', 'Just for Fun']);

    // stat + goal: unlocks when the lifetime stat reaches the goal.
    // collection: unlocks when every entry of COLLECTIONS[collection] is found.
    // Neither: unlocked directly by checkWorld() or recordGameBeaten().
    const DEFINITIONS = Object.freeze([
        // Farming
        { id: 'bug-squad', category: 'Farming', title: 'Bug Squad', description: 'Release ladybugs on a farm.', icon: 'images/items/Lady_Bug_bag.png', stat: 'placed:Ladybugs', goal: 1 },
        { id: 'sprinkler-system', category: 'Farming', title: 'Sprinkler System', description: 'Place 10 sprinklers.', icon: 'images/items/Sprinkler.png', stat: 'placed:Sprinkler', goal: 10 },
        { id: 'crop-rotation', category: 'Farming', title: 'Crop Rotation', description: 'Harvest every kind of crop.', icon: 'images/items/carrot.png', collection: 'crops' },
        { id: 'berry-good', category: 'Farming', title: 'Berry Good', description: 'Harvest 500 strawberries.', icon: 'images/items/Stawberry.png', stat: 'harvest:Strawberries', goal: 500 },
        { id: 'corn-addict', category: 'Farming', title: 'Corn Addict', description: 'Harvest 1,000 corn.', icon: 'images/items/Corn_item.png', stat: 'harvest:Corn', goal: 1000 },
        { id: 'one-in-a-melon', category: 'Farming', title: 'One in a Melon', description: 'Harvest 1,000 watermelons.', icon: 'images/items/watermelon2.png', stat: 'harvest:Watermelon', goal: 1000 },
        { id: 'gourd-lord', category: 'Farming', title: 'Gourd Lord', description: 'Harvest 1,000 pumpkins.', icon: 'images/items/Pumpkin.png', stat: 'harvest:Pumpkin', goal: 1000 },
        { id: 'rot-and-roll', category: 'Farming', title: 'Rot and Roll', description: 'Make 1,000 compost.', icon: 'images/items/Compost.png', stat: 'composted', goal: 1000 },
        { id: 'green-thumb', category: 'Farming', title: 'Green Thumb', description: 'Plant 10,000 seeds.', icon: 'images/items/Corn_Seed_bag.png', stat: 'planted', goal: 10000 },
        { id: 'fresh-picked', category: 'Farming', title: 'Fresh Picked', description: 'Harvest 10,000 crops.', icon: 'images/ui/plant_done_icon.png', stat: 'harvested', goal: 10000 },
        { id: 'hoe-down', category: 'Farming', title: 'Hoe Down', description: 'Till 10,000 patches of grass.', icon: 'images/items/Hoe.png', stat: 'tilled', goal: 10000 },
        { id: 'bumper-crop', category: 'Farming', title: 'Bumper Crop', description: 'Harvest 50,000 crops.', icon: 'images/tiles/CornStage8.png', stat: 'harvested', goal: 50000 },

        // Money
        { id: 'open-for-business', category: 'Money', title: 'Open for Business', description: 'Sell your first item.', icon: 'images/tiles/Cart_s.png', stat: 'sold', goal: 1 },
        { id: 'market-mogul', category: 'Money', title: 'Market Mogul', description: 'Sell 1,000 items.', icon: 'images/tiles/Cart.png', stat: 'sold', goal: 1000 },
        { id: 'shopaholic', category: 'Money', title: 'Shopaholic', description: 'Buy 1,000 items from shops.', icon: 'images/items/backPack.png', stat: 'bought', goal: 1000 },
        { id: 'make-it-rain', category: 'Money', title: 'Make It Rain', description: 'Earn 50,000 coins in total.', icon: 'images/ui/coin.png', stat: 'coinsEarned', goal: 50000 },
        { id: 'dragon-hoard', category: 'Money', title: 'Dragon Hoard', description: 'Have 25,000 coins at once.', icon: 'images/items/Chest.png', stat: 'mostCoins', goal: 25000 },
        { id: 'team-player', category: 'Money', title: 'Team Player', description: 'Deliver a co-op contract.', icon: 'images/ui/gift_indication.png', stat: 'contracts', goal: 1 },
        { id: 'supply-chain', category: 'Money', title: 'Supply Chain', description: 'Deliver 25 co-op contracts.', icon: 'images/items/veg_oil.png', stat: 'contracts', goal: 25 },

        // Food & Survival
        { id: 'balanced-diet', category: 'Food & Survival', title: 'Balanced Diet', description: 'Eat every kind of food.', icon: 'images/items/FullCourse.png', collection: 'foods' },
        { id: 'hot-diggity-dog', category: 'Food & Survival', title: 'Hot Diggity Dog', description: 'Eat a hotdog.', icon: 'images/items/HotDog.png', stat: 'eat:Hotdog', goal: 1 },
        { id: 'questionable-choices', category: 'Food & Survival', title: 'Questionable Choices', description: 'Eat a hemp flower.', icon: 'images/items/hemp.png', stat: 'eat:Hemp Flower', goal: 1 },
        { id: 'skill-issue', category: 'Food & Survival', title: 'Skill Issue', description: 'Die for the first time.', icon: 'images/ui/dealth_icon(128x128).png', stat: 'deaths', goal: 1 },

        // Story
        { id: 'saved-the-meadows', category: 'Story', title: 'Saved the Meadows', description: 'Beat the game.', icon: 'images/ui/QuestMarker.png', stat: 'gamesWon', goal: 1 },
        { id: 'gamer', category: 'Story', title: 'Gamer', description: 'Beat the game on Hard or Hardcore.', icon: 'images/ui/warning_sign_icon.png' },
        { id: 'like-minecraft', category: 'Story', title: "It's Like Minecraft", description: 'Beat the game in 3D mode.', icon: 'images/tiles/Grass.png' },
        { id: 'absolute-gamer', category: 'Story', title: 'Absolute Gamer', description: 'Beat the game before day 20.', icon: 'images/items/stop_watch.png' },
        { id: 'untouchable', category: 'Story', title: 'Untouchable', description: 'Beat the game without dying.', icon: 'images/player/Farmer.gif' },
        { id: 'errand-runner', category: 'Story', title: 'Errand Runner', description: 'Complete 10 side quests.', icon: 'images/ui/mobile-quests-icon.png', stat: 'sideQuests', goal: 10 },
        { id: 'nice', category: 'Story', title: 'Nice', description: 'Reach day 69.', icon: 'images/ui/Calender.png', stat: 'highestDay', goal: 69 },
        { id: 'century-farmer', category: 'Story', title: 'Century Farmer', description: 'Reach day 100.', icon: 'images/ui/Save-icon.gif', stat: 'highestDay', goal: 100 },

        // Exploring
        { id: 'hello-world', category: 'Exploring', title: 'Hello World', description: 'Talk to every NPC that exists.', icon: 'images/ui/Chat_Icon.png', collection: 'npcs' },
        { id: 'good-boy', category: 'Exploring', title: "Who's a Good Boy?", description: 'Talk to the dog.', icon: 'images/npc/dog_right.png', stat: 'talk:Dog', goal: 1 },
        { id: 'meet-the-developer', category: 'Exploring', title: 'Meet the Developer', description: 'Talk to David.', icon: 'images/npc/David.png', stat: 'talk:David', goal: 1 },
        { id: 'tourist', category: 'Exploring', title: 'Tourist', description: 'Visit all six districts.', icon: 'images/foreground/building_gray.png', collection: 'districts' },
        { id: 'up-up-and-away', category: 'Exploring', title: 'Up, Up and Away', description: 'Ride the hot air balloon.', icon: 'images/foreground/Cloud_Tile.png', stat: 'trips:balloon', goal: 1 },
        { id: 'frequent-flyer', category: 'Exploring', title: 'Frequent Flyer', description: 'Travel by balloon or train 100 times.', icon: 'images/npc/Ticket_Master.png', stat: 'trips', goal: 100 },
        { id: 'storm-chaser', category: 'Exploring', title: 'Storm Chaser', description: 'See every kind of weather.', icon: 'images/foreground/cloud_tile2.png', collection: 'weather' },
        { id: 'bible-reference', category: 'Exploring', title: 'Bible Reference', description: 'See frog rain twice in one world.', icon: 'images/npc/frog_front.png' },

        // Robots & Time
        { id: 'beep-boop', category: 'Robots & Time', title: 'Beep Boop', description: 'Place your first robot.', icon: 'images/items/robot.png', stat: 'robotsPlaced', goal: 1 },
        { id: 'work-smarter', category: 'Robots & Time', title: 'Work Smarter', description: 'Have your robots harvest 500 crops.', icon: 'images/items/robot2.png', stat: 'robotHarvested', goal: 500 },
        { id: 'kaboom', category: 'Robots & Time', title: 'Kaboom', description: 'Blow up a robot.', icon: 'images/items/robot_water.png', stat: 'robotsBoomed', goal: 1 },
        { id: 'time-traveler', category: 'Robots & Time', title: 'Time Traveler', description: 'Rewind time to an earlier day.', icon: 'images/items/stop_watch.png', stat: 'rewinds', goal: 1 },
        { id: 'fast-forward', category: 'Robots & Time', title: 'Fast Forward', description: 'Run the clock at top speed.', icon: 'images/ui/batteryIcon.png', stat: 'fastForwards', goal: 1 },

        // Just for Fun
        { id: 'polyglot', category: 'Just for Fun', title: 'Polyglot', description: 'Play in another language.', icon: 'images/ui/Chat_Icon.png', stat: 'otherLanguage', goal: 1 },
        { id: 'roll-credits', category: 'Just for Fun', title: 'Roll Credits', description: 'Watch the credits.', icon: 'images/ui/Music_Note.png', stat: 'creditsViewed', goal: 1 }
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

    // 'The Big City : Downtown' -> 'The Big City', 'Beach' -> 'Beach'.
    function districtOf(levelName) {
        return typeof levelName === 'string' ? levelName.split(':')[0].trim() : '';
    }

    const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
    const positiveInt = value => {
        const number = Math.floor(Number(value));
        return Number.isFinite(number) && number > 0 ? number : 0;
    };

    function normalizeState(raw) {
        const state = { unlocked: {}, stats: Object.create(null), collections: {} };
        if (!isObject(raw)) return state;
        if (isObject(raw.unlocked)) {
            for (const def of DEFINITIONS) {
                if (typeof raw.unlocked[def.id] === 'string') state.unlocked[def.id] = raw.unlocked[def.id];
            }
        }
        if (isObject(raw.stats)) {
            for (const [stat, value] of Object.entries(raw.stats)) {
                if (positiveInt(value)) state.stats[stat] = positiveInt(value);
            }
        }
        const found = isObject(raw.collections) ? raw.collections : {};
        // The first release stored corn and NPC progress in fields of their own.
        const legacyNpcs = Array.isArray(raw.npcsTalkedTo) ? raw.npcsTalkedTo : [];
        for (const [name, entries] of Object.entries(COLLECTIONS)) {
            const saved = (Array.isArray(found[name]) ? found[name] : []).concat(name === 'npcs' ? legacyNpcs : []);
            const have = entries.filter(entry => saved.includes(entry));
            if (have.length) state.collections[name] = have;
        }
        const legacyCorn = positiveInt(raw.cornHarvested);
        if (legacyCorn > (state.stats['harvest:Corn'] || 0)) state.stats['harvest:Corn'] = legacyCorn;

        for (const def of DEFINITIONS) {
            if (!state.unlocked[def.id] || !def.stat) continue;
            if (!isObject(raw.stats)) {
                // The first release kept no stats: carry its unlocks over as met.
                state.stats[def.stat] = Math.max(state.stats[def.stat] || 0, def.goal);
            } else if ((state.stats[def.stat] || 0) < def.goal) {
                // A goal raised in an update re-locks achievements that no longer meet it.
                delete state.unlocked[def.id];
            }
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
                store.set(STORAGE_KEY, { unlocked: read().unlocked, stats: { ...read().stats }, collections: read().collections });
            } catch (error) {
                if (global.console) global.console.warn('Could not save achievements', error);
            }
        }

        const stat = name => read().stats[name] || 0;
        const found = name => read().collections[name] || [];
        const isUnlocked = id => !!read().unlocked[id];

        // Returns true only the first time an achievement unlocks.
        function unlock(id) {
            const def = DEFINITIONS.find(entry => entry.id === id);
            if (!def || isUnlocked(id)) return false;
            read().unlocked[id] = now();
            write();
            onUnlock(def);
            return true;
        }

        function checkStat(name) {
            for (const def of DEFINITIONS) {
                if (def.stat === name && stat(name) >= def.goal) unlock(def.id);
            }
        }

        function checkCollection(name) {
            for (const def of DEFINITIONS) {
                if (def.collection === name && found(name).length >= COLLECTIONS[name].length) unlock(def.id);
            }
        }

        function add(name, amount = 1) {
            const count = positiveInt(amount);
            if (!count) return;
            read().stats[name] = stat(name) + count;
            write();
            checkStat(name);
        }

        // Keeps the highest value seen, such as the most coins held at once.
        function best(name, value) {
            const number = positiveInt(value);
            if (number <= stat(name)) return;
            read().stats[name] = number;
            write();
            checkStat(name);
        }

        function collect(name, entry) {
            if (!COLLECTIONS[name] || !COLLECTIONS[name].includes(entry) || found(name).includes(entry)) return;
            read().collections[name] = COLLECTIONS[name].filter(item => item === entry || found(name).includes(item));
            write();
            checkCollection(name);
        }

        // Records one thing that happened in the game.
        function track(type, detail = {}) {
            switch (type) {
                case 'harvest':
                    if (!positiveInt(detail.amount) || typeof detail.name !== 'string') return;
                    add('harvested', detail.amount);
                    add('harvest:' + detail.name, detail.amount);
                    if (detail.byRobot) add('robotHarvested', detail.amount);
                    collect('crops', detail.name);
                    return;
                case 'plant': return add('planted');
                case 'till': return add('tilled');
                case 'compost': return add('composted', detail.amount);
                case 'place':
                    if (typeof detail.name !== 'string') return;
                    add('placed:' + detail.name);
                    if (/^Robot\d$/.test(detail.name)) add('robotsPlaced');
                    return;
                case 'sell': return add('sold', detail.amount);
                case 'buy': return add('bought', detail.amount === undefined ? 1 : detail.amount);
                case 'earn':
                    add('coinsEarned', detail.amount);
                    best('mostCoins', detail.total);
                    return;
                case 'contract': return add('contracts');
                case 'eat':
                    if (typeof detail.name !== 'string') return;
                    add('eaten');
                    add('eat:' + detail.name);
                    collect('foods', detail.name);
                    return;
                case 'death': return add('deaths');
                case 'talk':
                    if (!ALL_NPCS.includes(detail.name)) return;
                    add('talk:' + detail.name);
                    collect('npcs', detail.name);
                    return;
                case 'visit': return collect('districts', districtOf(detail.level));
                case 'travel':
                    add('trips');
                    if (detail.via === 'balloon') add('trips:balloon');
                    return;
                case 'quest': return add('sideQuests');
                case 'rewind': return add('rewinds');
                case 'fastForward': return add('fastForwards');
                case 'robotBoom': return add('robotsBoomed');
                case 'credits': return add('creditsViewed');
                case 'language':
                    if (typeof detail.language === 'string' && detail.language !== 'en') add('otherLanguage');
                    return;
                default:
                    return;
            }
        }

        // Goals that depend on the current world's state. Safe to re-run at any
        // time, including on a save that already qualifies.
        function checkWorld(world = {}) {
            best('highestDay', world.days);
            const weatherLog = Array.isArray(world.weatherLog) ? world.weatherLog : [];
            for (const entry of weatherLog) collect('weather', entry && entry.weather);
            collect('weather', world.weather);
            if (frogRainDays(weatherLog) >= FROG_RAIN_GOAL) unlock('bible-reference');
        }

        // Called once, the moment the main quest is completed.
        function recordGameBeaten(run = {}) {
            add('gamesWon');
            if (isHardcoreRun(run.difficulty, run.rules)) unlock('gamer');
            if (run.is3D === true) unlock('like-minecraft');
            if (Number.isFinite(run.days) && run.days < FAST_WIN_DAY) unlock('absolute-gamer');
            if (run.deaths === 0) unlock('untouchable');
        }

        function progressFor(def) {
            if (def.collection) {
                const have = found(def.collection);
                const remaining = COLLECTIONS[def.collection].filter(entry => !have.includes(entry));
                return { current: have.length, goal: COLLECTIONS[def.collection].length, remaining };
            }
            if (def.stat && def.goal > 1) return { current: Math.min(stat(def.stat), def.goal), goal: def.goal };
            return null;
        }

        function list() {
            return DEFINITIONS.map(def => ({
                ...def,
                unlockedAt: read().unlocked[def.id] || null,
                progress: progressFor(def)
            }));
        }

        return {
            track, checkWorld, recordGameBeaten, unlock, isUnlocked, list, stat,
            unlockedCount: () => DEFINITIONS.filter(def => isUnlocked(def.id)).length,
            total: DEFINITIONS.length
        };
    }

    global.CloudyAchievements = {
        create, isHardcoreRun, frogRainDays, districtOf, DEFINITIONS, CATEGORIES, COLLECTIONS, ALL_NPCS,
        STORAGE_KEY, MAIN_QUEST, FAST_WIN_DAY, FROG_RAIN_GOAL
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

    // The entry point for game code: trackAchievement('plant'),
    // trackAchievement('eat', { name: 'Corn' }) and so on (see track() above).
    function trackAchievement(type, detail = {}) {
        const tracked = achievements();
        if (!tracked) return;
        if (type === 'harvest') {
            // The Auto Farms bots farm on their own; their harvests don't count.
            if (!detail.byPlayer && typeof detail.level === 'string' && detail.level.startsWith('Auto Farms')) return;
            const item = typeof all_items !== 'undefined' && Array.isArray(all_items) ? all_items[detail.itemNum] : null;
            if (!item || !item.name) return;
            tracked.track('harvest', { name: item.name, amount: detail.amount, byRobot: !detail.byPlayer });
            return;
        }
        tracked.track(type, detail);
    }

    function checkWorldAchievements() {
        achievements()?.checkWorld({
            days: typeof days !== 'undefined' ? days : 0,
            weatherLog: typeof weatherLog !== 'undefined' ? weatherLog : [],
            weather: typeof currentWeather !== 'undefined' ? currentWeather : null
        });
    }

    if (typeof global.addEventListener === 'function') {
        const on = (type, handler) => global.addEventListener(type, event => handler(event.detail || {}));
        on('npcInteraction', detail => trackAchievement('talk', { name: detail.npcName }));
        on('moneyGained', detail => trackAchievement('earn', { amount: detail.amount, total: detail.totalCoins }));
        on('locationVisited', detail => trackAchievement('visit', { level: detail.locationName }));
        on('languageChanged', detail => trackAchievement('language', { language: detail.language }));
        global.addEventListener('newDay', checkWorldAchievements);
        on('questCompleted', detail => {
            const quest = detail.quest;
            if (!quest) return;
            if (quest.og_name !== MAIN_QUEST) {
                trackAchievement('quest');
                return;
            }
            achievements()?.recordGameBeaten({
                days: typeof days !== 'undefined' ? Number(days) : NaN,
                difficulty: typeof dificulty !== 'undefined' ? dificulty : null,
                rules: global.customRules || null,
                is3D: typeof is3DMode !== 'undefined' && is3DMode === true,
                deaths: typeof player !== 'undefined' && player ? player.deaths : undefined
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

    function entryLabel(collection, entry) {
        return t(collection === 'weather' ? WEATHER_LABELS[entry] : entry);
    }

    function renderCard(doc, entry) {
        const unlocked = !!entry.unlockedAt;
        const card = doc.createElement('li');
        card.className = 'achievement-card ' + (unlocked ? 'achievement-unlocked' : 'achievement-locked');

        const icon = doc.createElement('img');
        icon.className = 'achievement-icon';
        icon.src = entry.icon;
        icon.alt = '';

        const body = doc.createElement('div');
        body.className = 'achievement-body';
        const title = doc.createElement('h4');
        title.className = 'achievement-title';
        title.textContent = t(entry.title);
        const description = doc.createElement('p');
        description.className = 'achievement-description';
        description.textContent = t(entry.description);
        body.append(title, description);

        if (entry.progress && !unlocked) {
            const { current, goal, remaining } = entry.progress;
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
            if (entry.collection && remaining.length && remaining.length <= HINT_LIMIT) {
                const hint = doc.createElement('p');
                hint.className = 'achievement-hint';
                const names = remaining.map(item => entryLabel(entry.collection, item)).join(', ');
                hint.textContent = t(COLLECTION_HINTS[entry.collection], { names });
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
        return card;
    }

    // Replaces host's contents with the summary line and one section per category.
    function renderAchievementList(host) {
        const doc = global.document;
        const tracked = achievements();
        if (!host || !doc || !tracked) return;
        const entries = tracked.list();
        const summary = doc.createElement('p');
        summary.className = 'achievement-summary';
        summary.textContent = t('{count} of {total} unlocked', { count: tracked.unlockedCount(), total: tracked.total });
        const sections = [summary];

        for (const category of CATEGORIES) {
            const inCategory = entries.filter(entry => entry.category === category);
            const section = doc.createElement('section');
            section.className = 'achievement-category';
            const heading = doc.createElement('h3');
            heading.className = 'achievement-category-title';
            const name = doc.createElement('span');
            name.textContent = t(category);
            const count = doc.createElement('span');
            count.className = 'achievement-category-count';
            count.textContent = inCategory.filter(entry => entry.unlockedAt).length + ' / ' + inCategory.length;
            heading.append(name, count);
            const listEl = doc.createElement('ul');
            listEl.className = 'achievement-list';
            for (const entry of inCategory) listEl.appendChild(renderCard(doc, entry));
            section.append(heading, listEl);
            sections.push(section);
        }
        host.replaceChildren(...sections);
    }

    global.trackAchievement = trackAchievement;
    global.checkWorldAchievements = checkWorldAchievements;
    global.renderAchievementList = renderAchievementList;
})(window);
