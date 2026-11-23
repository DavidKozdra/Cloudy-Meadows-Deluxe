/**
 * Custom game rules: the extended rule set behind the Configure Game Rules
 * editor (Survival, Farming, Economy, Goals, Powers, Map Editor tabs).
 *
 *   - RULE_SPECS describes every simple (number / toggle / choice) rule once:
 *     its default, range, label and tab. Validation, defaults, share codes and
 *     the form controls are all generated from it.
 *   - customRule(key) is what game code calls. It returns the active custom
 *     game's value, or the spec default for normal difficulties and old saves,
 *     so every hook behaves exactly like the original game by default.
 *   - Structured rules (shop stock, co-op contracts, custom quests, dialogue
 *     edits, map edits, ...) have their own normalizers below.
 *   - applyNewGameCustomRules() runs once when a custom game starts; the
 *     result is then persisted by the normal save system.
 *
 * The overall rules object (defaults, normalize, share codes, presets) lives
 * in miscfunctions.js and calls into getExtendedRuleDefaults() /
 * normalizeExtendedRules() here.
 */

// --- Simple rule specs --------------------------------------------------------

const TIME_OF_DAY_OPTIONS = [
    { value: 'morning', label: 'Morning' },
    { value: 'afternoon', label: 'Afternoon' },
    { value: 'evening', label: 'Evening' },
    { value: 'night', label: 'Night' }
];

const WIN_CONDITION_OPTIONS = [
    { value: 'funding', label: 'Raise the funding (classic)' },
    { value: 'harvest', label: 'Collect a crop or item' },
    { value: 'sell', label: 'Sell a crop or item' },
    { value: 'survive', label: 'Survive a number of days' },
    { value: 'quests', label: 'Finish side quests' },
    { value: 'coop', label: 'Deliver co-op contracts' }
];

const VIEW_MODE_OPTIONS = [
    { value: 'choice', label: "Player's choice" },
    { value: '2d', label: 'Always 2D' },
    { value: '3d', label: 'Always 3D' }
];

// type: 'int' | 'bool' | 'enum'. optionsFrom: 'levels' | 'npcSkins' | 'items'
// fills enum options at runtime. showIf hides the row unless another rule has
// one of the listed values.
const RULE_SPECS = [
    // Survival
    { key: 'dayLengthSec', tab: 'survival', section: 'Time', label: 'Day Length', unit: 'sec', type: 'int', min: 30, max: 1200, step: 10, def: 120, help: 'Real seconds for one full day and night.' },
    { key: 'startTimeOfDay', tab: 'survival', section: 'Time', label: 'Start Time', type: 'enum', options: TIME_OF_DAY_OPTIONS, def: 'morning' },
    { key: 'alwaysDay', tab: 'survival', section: 'Time', label: 'Never Get Dark', type: 'bool', def: false, help: 'Days still pass, but the screen never darkens.' },
    { key: 'maxHealth', tab: 'survival', section: 'Health and Hunger', label: 'Max Health', type: 'int', min: 10, max: 1000, step: 10, def: 100, help: 'Health only drops while starving; more health means longer before you pass out.' },
    { key: 'maxHunger', tab: 'survival', section: 'Health and Hunger', label: 'Max Hunger', unit: 'pips', type: 'int', min: 1, max: 12, step: 1, def: 6 },
    { key: 'hungerRate', tab: 'survival', section: 'Health and Hunger', label: 'Hunger Drain Speed', unit: '%', type: 'int', min: 0, max: 500, step: 5, def: 100, help: '0% means you never get hungry.' },
    { key: 'starveDamage', tab: 'survival', section: 'Health and Hunger', label: 'Starving Damage', unit: 'hp', type: 'int', min: 0, max: 100, step: 1, def: 10, help: 'Health lost every 0.4 seconds while your hunger is empty.' },
    { key: 'healthRegen', tab: 'survival', section: 'Health and Hunger', label: 'Health Regen When Full', unit: 'hp', type: 'int', min: 0, max: 100, step: 1, def: 2 },
    { key: 'respawnSeconds', tab: 'survival', section: 'Death', label: 'Respawn Delay', unit: 'sec', type: 'int', min: 1, max: 60, step: 1, def: 10 },
    { key: 'lives', tab: 'survival', section: 'Death', label: 'Lives', type: 'int', min: 0, max: 99, step: 1, def: 0, help: '0 = unlimited. Running out ends the run, like Perma Death.' },

    // Farming
    { key: 'cropGrowthSpeed', tab: 'farming', section: 'Growth', label: 'Crop Growth Speed', unit: '%', type: 'int', min: 10, max: 1000, step: 5, def: 100 },
    { key: 'rainGrowthBonus', tab: 'farming', section: 'Growth', label: 'Rain Growth Bonus', unit: '%', type: 'int', min: 0, max: 500, step: 5, def: 25 },
    { key: 'overcastGrowthPenalty', tab: 'farming', section: 'Growth', label: 'Overcast Growth Penalty', unit: '%', type: 'int', min: 0, max: 100, step: 5, def: 20 },
    { key: 'heatwaveGrowthPenalty', tab: 'farming', section: 'Growth', label: 'Heatwave Penalty (no sprinkler)', unit: '%', type: 'int', min: 0, max: 100, step: 5, def: 50 },
    { key: 'bedGrowthBonus', tab: 'farming', section: 'Growth', label: 'Sleeping Growth Bonus', unit: '%', type: 'int', min: 0, max: 1000, step: 10, def: 200, help: 'Extra growth while you are in bed.' },
    { key: 'cropsNeedWater', tab: 'farming', section: 'Water and Decay', label: 'Crops Need Water', type: 'bool', def: true },
    { key: 'dryCropsDie', tab: 'farming', section: 'Water and Decay', label: 'Dry Crops Can Die', type: 'bool', def: true },
    { key: 'overripeCropsDie', tab: 'farming', section: 'Water and Decay', label: 'Unharvested Crops Rot', type: 'bool', def: true },
    { key: 'plotDryDays', tab: 'farming', section: 'Water and Decay', label: 'Tilled Soil Lasts', unit: 'days', type: 'int', min: 1, max: 100, step: 1, def: 5 },
    { key: 'compostDays', tab: 'farming', section: 'Water and Decay', label: 'Compost Finishes In', unit: 'days', type: 'int', min: 1, max: 30, step: 1, def: 2 },
    { key: 'harvestYield', tab: 'farming', section: 'Harvest', label: 'Harvest Yield', unit: '%', type: 'int', min: 10, max: 1000, step: 10, def: 100 },
    { key: 'seedReturn', tab: 'farming', section: 'Harvest', label: 'Seeds From Food and Grinder', unit: '%', type: 'int', min: 0, max: 1000, step: 10, def: 100 },
    { key: 'ladybugBonus', tab: 'farming', section: 'Harvest', label: 'Ladybug Bonus', unit: '%', type: 'int', min: 0, max: 1000, step: 10, def: 100 },
    { key: 'ladybugDays', tab: 'farming', section: 'Harvest', label: 'Ladybugs Last', unit: 'days', type: 'int', min: 1, max: 100, step: 1, def: 10 },

    // Economy
    { key: 'buyPriceMultiplier', tab: 'economy', section: 'Prices', label: 'Shop Buy Prices', unit: '%', type: 'int', min: 10, max: 1000, step: 5, def: 100 },
    { key: 'sellPriceMultiplier', tab: 'economy', section: 'Prices', label: 'Sell Prices', unit: '%', type: 'int', min: 10, max: 1000, step: 5, def: 100 },
    { key: 'priceSwings', tab: 'economy', section: 'Prices', label: 'Supply and Demand Swings', type: 'bool', def: true, help: 'Prices rise when stock is low and fall when it is high.' },
    { key: 'priceEvents', tab: 'economy', section: 'Prices', label: 'Weather and Weekday Deals', type: 'bool', def: true, help: 'Fruit Fridays, rain sprinkler sales, frog-rain ladybug prices, heatwave sprinkler prices.' },
    { key: 'coopUnlockDay', tab: 'economy', section: 'Co-op Exchange', label: 'Unlock On Day', type: 'int', min: 0, max: 1000, step: 1, def: 0, help: '0 = after you finish the main quest.' },
    { key: 'coopRewardMultiplier', tab: 'economy', section: 'Co-op Exchange', label: 'Contract Rewards', unit: '%', type: 'int', min: 0, max: 1000, step: 10, def: 100 },

    // Goals
    { key: 'winCondition', tab: 'goals', section: 'How You Win', label: 'Win By', type: 'enum', options: WIN_CONDITION_OPTIONS, def: 'funding', help: 'Funding uses Main Quest Coins from the Rules tab. Main Quest Days is the deadline for every mode except Survive.' },
    { key: 'winItem', tab: 'goals', section: 'How You Win', label: 'Item', type: 'enum', optionsFrom: 'items', def: 'Corn', showIf: { winCondition: ['harvest', 'sell'] } },
    { key: 'winAmount', tab: 'goals', section: 'How You Win', label: 'Amount', type: 'int', min: 1, max: 100000, step: 1, def: 100, showIf: { winCondition: ['harvest', 'sell'] } },
    { key: 'winDays', tab: 'goals', section: 'How You Win', label: 'Days to Survive', type: 'int', min: 1, max: 10000, step: 1, def: 100, showIf: { winCondition: ['survive'] } },
    { key: 'winQuestCount', tab: 'goals', section: 'How You Win', label: 'Side Quests to Finish', type: 'int', min: 1, max: 60, step: 1, def: 5, showIf: { winCondition: ['quests'] } },
    { key: 'winContractCount', tab: 'goals', section: 'How You Win', label: 'Contracts to Deliver', type: 'int', min: 1, max: 500, step: 1, def: 10, showIf: { winCondition: ['coop'] }, help: 'The co-op exchange opens on day 1 in this mode unless you set an unlock day.' },
    { key: 'questRewardMultiplier', tab: 'goals', section: 'Quest Rewards', label: 'Side Quest Rewards', unit: '%', type: 'int', min: 0, max: 1000, step: 10, def: 100 },

    // World (added to the existing World tab)
    { key: 'startArea', tab: 'world', section: 'Start', label: 'Start In', type: 'enum', optionsFrom: 'levels', def: '', emptyLabel: 'Home (default)', help: 'You also respawn here.' },
    { key: 'playerSkin', tab: 'world', section: 'Start', label: 'Player Look', type: 'enum', optionsFrom: 'npcSkins', def: '', emptyLabel: 'Farmer (default)' },

    // Powers
    { key: 'timeWatchDays', tab: 'powers', section: 'Time Watch', label: 'Rewind Up To', unit: 'days', type: 'int', min: 1, max: 30, step: 1, def: 7 },
    { key: 'robotSpeed', tab: 'powers', section: 'Robots', label: 'Robot Speed', unit: '%', type: 'int', min: 10, max: 500, step: 10, def: 100 },
    { key: 'robotsNeedFuel', tab: 'powers', section: 'Robots', label: 'Robots Use Fuel', type: 'bool', def: true },
    { key: 'viewMode', tab: 'powers', section: 'View', label: '2D / 3D Mode', type: 'enum', options: VIEW_MODE_OPTIONS, def: 'choice' }
];

const RULE_SPEC_BY_KEY = {};
RULE_SPECS.forEach(spec => { RULE_SPEC_BY_KEY[spec.key] = spec; });

const STRUCTURED_RULE_DEFAULTS = {
    cropGrowth: {},
    shopStock: {},
    coopContracts: null,
    disabledSideQuests: [],
    customQuests: [],
    dialogueOverrides: {},
    mapEdits: {}
};

const MAX_SHOP_STOCK_ITEMS = 12;
const MAX_COOP_CONTRACTS = 24;
const MAX_CUSTOM_QUESTS = 20;
const MAX_DIALOGUE_TEXT = 300;
const MAP_ROWS = 19;
const MAP_COLS = 23;
const CUSTOM_QUEST_GOAL_TYPES = ['talk', 'give', 'have', 'sell', 'visit'];

// --- Runtime accessor --------------------------------------------------------

// The active value of a rule. Normal difficulties (no customRules) and rules
// saved before a key existed get the spec default, i.e. the original game.
function customRule(key) {
    const rules = typeof window !== 'undefined' ? window.customRules : null;
    if (rules && rules[key] !== undefined && rules[key] !== null) return rules[key];
    if (RULE_SPEC_BY_KEY[key]) return RULE_SPEC_BY_KEY[key].def;
    const structured = STRUCTURED_RULE_DEFAULTS[key];
    return structured && typeof structured === 'object' ? JSON.parse(JSON.stringify(structured)) : structured;
}

function customRuleFraction(key) {
    return customRule(key) / 100;
}

// Rounds x to an integer, rounding the fractional part up with that
// probability, so e.g. a 150% yield of 1 averages 1.5 per harvest.
function stochasticRound(x) {
    const whole = Math.floor(x);
    return whole + (Math.random() < x - whole ? 1 : 0);
}

// --- Validation ---------------------------------------------------------------

function ruleIsPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function ruleItemDefinitions() {
    if (typeof all_items !== 'undefined' && Array.isArray(all_items)) return all_items;
    if (typeof ITEM_DEFINITIONS !== 'undefined') return ITEM_DEFINITIONS;
    return [];
}

function ruleTileDefinitions() {
    if (typeof all_tiles !== 'undefined' && Array.isArray(all_tiles)) return all_tiles;
    if (typeof TILE_DEFINITIONS !== 'undefined') return TILE_DEFINITIONS;
    return [];
}

// Map/factory IDs start at 1; the tile registry starts at index 0.
function ruleTileDefinition(num) {
    return ruleTileDefinitions()[num - 1];
}

function isKnownItemName(name) {
    return typeof name === 'string' && ruleItemDefinitions().some(def => def && def.name === name);
}

function cleanRuleText(value, maxLength) {
    return typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, maxLength) : '';
}

function clampRuleInt(value, min, max, fallback) {
    const n = Math.round(Number(value));
    if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}

function normalizeRuleSpecValue(spec, value) {
    if (spec.type === 'int') return clampRuleInt(value, spec.min, spec.max, spec.def);
    if (spec.type === 'bool') return typeof value === 'boolean' ? value : spec.def;
    if (spec.type === 'enum') {
        if (typeof value !== 'string') return spec.def;
        if (spec.options) return spec.options.some(opt => opt.value === value) ? value : spec.def;
        // Runtime option lists (levels, NPCs) may not exist yet; accept any short name.
        if (value === '') return '';
        if (spec.optionsFrom === 'items') return isKnownItemName(value) ? value : spec.def;
        return value.slice(0, 80);
    }
    return spec.def;
}

function getExtendedRuleDefaults() {
    const out = {};
    RULE_SPECS.forEach(spec => { out[spec.key] = spec.def; });
    Object.keys(STRUCTURED_RULE_DEFAULTS).forEach(key => {
        out[key] = JSON.parse(JSON.stringify(STRUCTURED_RULE_DEFAULTS[key]));
    });
    return out;
}

function cropTileDefinitions() {
    const out = [];
    ruleTileDefinitions().forEach((def, idx) => {
        if (def && def.class === 'Plant' && def.name && !out.some(c => c.name === def.name)) {
            out.push({ num: idx + 1, name: def.name, growthTime: def.growthTime });
        }
    });
    return out;
}

function shopTileDefinitions() {
    const out = [];
    ruleTileDefinitions().forEach(def => {
        if (def && def.class === 'Shop' && def.name && !out.some(s => s.name === def.name)) {
            const stock = (def.inv || []).filter(slot => slot && slot !== 0).map(slot => {
                const itemDef = ruleItemDefinitions()[slot.num];
                return itemDef ? { name: itemDef.name, amount: slot.amount } : null;
            }).filter(Boolean);
            out.push({ name: def.name, stock });
        }
    });
    return out;
}

function defaultCoopContracts() {
    return typeof COOP_CONTRACT_TEMPLATES !== 'undefined'
        ? JSON.parse(JSON.stringify(COOP_CONTRACT_TEMPLATES))
        : [];
}

function coopDistrictNames() {
    return typeof COOP_DISTRICTS !== 'undefined' ? COOP_DISTRICTS.slice() : [];
}

function normalizeStockList(list) {
    const out = [];
    (Array.isArray(list) ? list : []).forEach(entry => {
        if (out.length >= MAX_SHOP_STOCK_ITEMS || !entry || !isKnownItemName(entry.name)) return;
        if (out.some(existing => existing.name === entry.name)) return;
        out.push({ name: entry.name, amount: clampRuleInt(entry.amount, 1, 999, 1) });
    });
    return out;
}

function normalizeCoopContracts(value) {
    if (!Array.isArray(value)) return null;
    const districts = coopDistrictNames();
    const out = [];
    value.forEach(entry => {
        if (out.length >= MAX_COOP_CONTRACTS || !ruleIsPlainObject(entry) || !isKnownItemName(entry.itemName)) return;
        const district = districts.includes(entry.district) ? entry.district : (districts[0] || 'Cloudy Meadows');
        out.push({
            district,
            title: cleanRuleText(entry.title, 40) || ('Order of ' + entry.itemName),
            itemName: entry.itemName,
            amount: clampRuleInt(entry.amount, 1, 9999, 10),
            reward: clampRuleInt(entry.reward, 0, 1000000, 100)
        });
    });
    // Identical to the built-in list means "use the built-ins".
    return JSON.stringify(out) === JSON.stringify(defaultCoopContracts()) ? null : out;
}

function normalizeCustomQuest(entry) {
    if (!ruleIsPlainObject(entry)) return null;
    const goalType = CUSTOM_QUEST_GOAL_TYPES.includes(entry.goalType) ? entry.goalType : 'talk';
    const needsItem = goalType === 'give' || goalType === 'have' || goalType === 'sell';
    const quest = {
        name: cleanRuleText(entry.name, 40),
        giver: cleanRuleText(entry.giver, 40),
        goalType,
        npc: cleanRuleText(entry.npc, 40),
        item: isKnownItemName(entry.item) ? entry.item : '',
        amount: clampRuleInt(entry.amount, 1, 9999, 1),
        level: cleanRuleText(entry.level, 80),
        days: clampRuleInt(entry.days, 0, 1000, 0),
        rewardCoins: clampRuleInt(entry.rewardCoins, 0, 1000000, 0),
        rewardItem: isKnownItemName(entry.rewardItem) ? entry.rewardItem : '',
        rewardAmount: clampRuleInt(entry.rewardAmount, 1, 999, 1)
    };
    if (!quest.name) return null;
    if ((goalType === 'talk' || goalType === 'give') && !quest.npc) return null;
    if (needsItem && !quest.item) return null;
    if (goalType === 'visit' && !quest.level) return null;
    return quest;
}

function normalizeExtendedRules(src) {
    const raw = ruleIsPlainObject(src) ? src : {};
    const out = {};
    RULE_SPECS.forEach(spec => { out[spec.key] = normalizeRuleSpecValue(spec, raw[spec.key]); });

    out.cropGrowth = {};
    if (ruleIsPlainObject(raw.cropGrowth)) {
        const crops = cropTileDefinitions().map(c => c.name);
        Object.keys(raw.cropGrowth).forEach(name => {
            const pct = clampRuleInt(raw.cropGrowth[name], 10, 1000, 100);
            if ((crops.length === 0 || crops.includes(name)) && pct !== 100) out.cropGrowth[name] = pct;
        });
    }

    out.shopStock = {};
    if (ruleIsPlainObject(raw.shopStock)) {
        const shops = shopTileDefinitions();
        Object.keys(raw.shopStock).forEach(name => {
            const shop = shops.find(s => s.name === name);
            if (!shop && shops.length) return;
            const stock = normalizeStockList(raw.shopStock[name]);
            if (!shop || JSON.stringify(stock) !== JSON.stringify(shop.stock)) out.shopStock[name] = stock;
        });
    }

    out.coopContracts = normalizeCoopContracts(raw.coopContracts);

    out.disabledSideQuests = [];
    if (Array.isArray(raw.disabledSideQuests)) {
        raw.disabledSideQuests.forEach(name => {
            const clean = cleanRuleText(name, 80);
            if (clean && !out.disabledSideQuests.includes(clean) && out.disabledSideQuests.length < 200) {
                out.disabledSideQuests.push(clean);
            }
        });
    }

    out.customQuests = (Array.isArray(raw.customQuests) ? raw.customQuests : [])
        .map(normalizeCustomQuest)
        .filter(Boolean)
        .slice(0, MAX_CUSTOM_QUESTS);

    out.dialogueOverrides = {};
    if (ruleIsPlainObject(raw.dialogueOverrides)) {
        Object.keys(raw.dialogueOverrides).slice(0, 100).forEach(npc => {
            const lines = raw.dialogueOverrides[npc];
            if (!ruleIsPlainObject(lines)) return;
            const clean = {};
            Object.keys(lines).slice(0, 200).forEach(key => {
                // "3" = dialogue 3's line, "3.1" = reply 1 of dialogue 3.
                if (!/^\d{1,3}(\.\d{1,2})?$/.test(key)) return;
                const text = cleanRuleText(lines[key], MAX_DIALOGUE_TEXT);
                if (text) clean[key] = text;
            });
            if (Object.keys(clean).length) out.dialogueOverrides[cleanRuleText(npc, 40)] = clean;
        });
    }

    out.mapEdits = {};
    if (ruleIsPlainObject(raw.mapEdits)) {
        const tileCount = ruleTileDefinitions().length;
        Object.keys(raw.mapEdits).slice(0, 100).forEach(levelName => {
            const cells = raw.mapEdits[levelName];
            if (!ruleIsPlainObject(cells)) return;
            const clean = {};
            Object.keys(cells).forEach(cellKey => {
                const match = /^(\d{1,2}),(\d{1,2})$/.exec(cellKey);
                if (!match) return;
                const row = Number(match[1]);
                const col = Number(match[2]);
                const num = Math.round(Number(cells[cellKey]));
                if (row >= MAP_ROWS || col >= MAP_COLS || !Number.isInteger(num) || num < 1) return;
                if (tileCount && !ruleTileDefinition(num)) return;
                clean[row + ',' + col] = num;
            });
            if (Object.keys(clean).length) out.mapEdits[cleanRuleText(levelName, 80)] = clean;
        });
    }

    return out;
}

// --- Game hooks: values the game reads every frame/day ------------------------

function getDayTickMs() {
    // A full day/night is 400 clock ticks (0 -> 200 -> 0).
    return customRule('dayLengthSec') * 1000 / 400;
}

function getMaxHealth() {
    return customRule('maxHealth');
}

function getCropGrowthScale(cropName) {
    const perCrop = customRule('cropGrowth') || {};
    const cropPct = typeof perCrop[cropName] === 'number' ? perCrop[cropName] : 100;
    return customRuleFraction('cropGrowthSpeed') * cropPct / 100;
}

// Harvest amount after the Harvest Yield and Ladybug Bonus rules. Always >= 1.
function scaleHarvestYield(baseYield, ladybugExtra = 0) {
    const crop = Math.max(1, stochasticRound(baseYield * customRuleFraction('harvestYield')));
    const bugs = Math.max(0, stochasticRound(ladybugExtra * customRuleFraction('ladybugBonus')));
    return crop + bugs;
}

function scaleSeedAmount(amount) {
    return Math.max(0, stochasticRound(amount * customRuleFraction('seedReturn')));
}

function scaleSellPrice(price) {
    return Math.max(price > 0 ? 1 : 0, Math.round(price * customRuleFraction('sellPriceMultiplier')));
}

function scaleBuyPrice(price) {
    return Math.max(1, Math.round(price * customRuleFraction('buyPriceMultiplier')));
}

// Fallback sell price when no shop on screen stocks the item (base * 0.75).
function shopFallbackSellPrice(basePrice) {
    return scaleSellPrice(Math.round(basePrice * 0.75));
}

// null = the player's own 2D/3D option; true/false = forced by the rules.
function getForcedViewMode() {
    const mode = customRule('viewMode');
    if (mode === '3d') return true;
    if (mode === '2d') return false;
    return null;
}

function getCoopContractTemplates() {
    const custom = customRule('coopContracts');
    return Array.isArray(custom) && custom.length ? custom : defaultCoopContracts();
}

function isCoopUnlockedByRules() {
    let unlockDay = customRule('coopUnlockDay');
    if (!unlockDay && customRule('winCondition') === 'coop') unlockDay = 1;
    return unlockDay > 0 && (typeof days === 'number' ? days : 0) + 1 >= unlockDay;
}

// Sprite for the player: the default farmer, or an NPC's sprite sheet.
function getPlayerSprite(facing, anim) {
    const skin = customRule('playerSkin');
    if (skin && typeof all_imgs !== 'undefined') {
        const def = ruleTileDefinitions().find(d => d && d.name === skin && (d.class === 'NPC' || d.class === 'Shop'));
        const sheet = def && all_imgs[def.png];
        const frames = sheet && Array.isArray(sheet[facing]) ? sheet[facing] : null;
        if (frames && frames.length) return frames[anim % frames.length];
    }
    return player_imgs[facing][anim];
}

function getLevelByName(name) {
    if (!name || typeof levels === 'undefined' || !Array.isArray(levels)) return null;
    for (let y = 0; y < levels.length; y++) {
        for (let x = 0; x < (levels[y] || []).length; x++) {
            const level = levels[y][x];
            if (level && level.name === name) return { level, y, x };
        }
    }
    return null;
}

// Walkable tile nearest to (preferCol, preferRow) in a level, searching
// outward ring by ring and staying off the edge columns/rows.
function findWalkableCell(level, preferCol = 5, preferRow = 5) {
    const isOpen = (row, col) => {
        const tile = level.map[row] && level.map[row][col];
        return tile && tile !== 0 && !tile.collide && (tile.class === 'Tile' || tile.class === 'Plant');
    };
    for (let radius = 0; radius < Math.max(MAP_ROWS, MAP_COLS); radius++) {
        for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
                if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
                const row = preferRow + dr;
                const col = preferCol + dc;
                if (row < 1 || col < 1 || row >= MAP_ROWS - 1 || col >= MAP_COLS - 1) continue;
                if (isOpen(row, col)) return { row, col };
            }
        }
    }
    return { row: preferRow, col: preferCol };
}

// Where the player starts and respawns: Home (5,5) unless Start In is set.
function getRespawnPoint() {
    const fallback = { levelY: 1, levelX: 4, x: 5 * tileSize, y: 5 * tileSize };
    const found = getLevelByName(customRule('startArea'));
    if (!found) return fallback;
    if (window.blockedAreas && typeof isLevelBlocked === 'function' && isLevelBlocked(found.level.name)) return fallback;
    const cell = findWalkableCell(found.level);
    return { levelY: found.y, levelX: found.x, x: cell.col * tileSize, y: cell.row * tileSize };
}

// Values that must be pushed into game globals rather than read on demand.
// Safe to call any time customRules changes (start, load, Save, normal game).
function applyCustomRuleRuntime() {
    if (typeof maxHunger !== 'undefined') {
        maxHunger = customRule('maxHunger');
        if (typeof player !== 'undefined' && player && player.hunger > maxHunger) player.hunger = maxHunger;
    }
    if (typeof player !== 'undefined' && player && player.hp > getMaxHealth()) player.hp = getMaxHealth();
    if (typeof applyAccessibilityPrefs === 'function') {
        try { applyAccessibilityPrefs(); } catch (e) { console.warn('Could not apply view mode rule', e); }
    }
}

// --- New goal types for win conditions ----------------------------------------
// Defined here (not quest.js) to keep the rules feature in one place; quest.js
// rebuilds them by class name when loading a save.

function defineCustomRuleGoals() {
    const root = typeof globalThis !== 'undefined' ? globalThis : window;
    if (typeof Goal === 'undefined' || root.SurviveGoal) return;

    root.SurviveGoal = class SurviveGoal extends Goal {
        constructor(target_days) {
            super('Survive until day ' + target_days);
            this.target_days = target_days;
            this.class = 'SurviveGoal';
        }
        update() {
            if (typeof days === 'number' && days >= this.target_days) this.done = true;
        }
    };

    root.QuestCountGoal = class QuestCountGoal extends Goal {
        constructor(amount) {
            super('Finish ' + amount + ' side quests');
            this.amount = amount;
            this.class = 'QuestCountGoal';
        }
        update() {
            if (typeof player === 'undefined' || !player || !player.quests) return;
            const finished = player.quests.filter(q => q && q.done && q.og_name !== 'Save Cloudy Meadows').length;
            if (finished >= this.amount) this.done = true;
        }
    };

    root.CoopContractGoal = class CoopContractGoal extends Goal {
        constructor(amount) {
            super('Deliver ' + amount + ' co-op contracts');
            this.amount = amount;
            this.class = 'CoopContractGoal';
        }
        update() {
            const state = typeof getCooperativeState === 'function' ? getCooperativeState() : null;
            if (state && (state.completedContracts || 0) >= this.amount) this.done = true;
        }
    };
}

// Rebuild a saved custom goal; returns null for classes this file doesn't own.
function rebuildCustomRuleGoal(saved) {
    defineCustomRuleGoals();
    const root = typeof globalThis !== 'undefined' ? globalThis : window;
    if (!saved || !root.SurviveGoal) return null;
    let goal = null;
    if (saved.class === 'SurviveGoal') goal = new root.SurviveGoal(saved.target_days);
    else if (saved.class === 'QuestCountGoal') goal = new root.QuestCountGoal(saved.amount);
    else if (saved.class === 'CoopContractGoal') goal = new root.CoopContractGoal(saved.amount);
    if (goal && saved.done !== undefined) goal.done = saved.done;
    return goal;
}

// Goal data (plain objects, as Quest's constructor expects) for the main quest.
function buildMainQuestGoals(rules) {
    const talk = { class: 'TalkingGoal', npc_name: 'Mr.C', item_name: 0, amount: 0 };
    switch (rules.winCondition) {
        case 'harvest': return [talk, { class: 'HaveGoal', item_name: rules.winItem, amount: rules.winAmount }];
        case 'sell': return [talk, { class: 'SellGoal', item_name: rules.winItem, amount: rules.winAmount }];
        case 'survive': return [talk, { class: 'SurviveGoal', target_days: rules.winDays }];
        case 'quests': return [talk, { class: 'QuestCountGoal', amount: rules.winQuestCount }];
        case 'coop': return [talk, { class: 'CoopContractGoal', amount: rules.winContractCount }];
        default: return [talk, { class: 'FundingGoal', amount: rules.mainQuestCoins }];
    }
}

// --- Custom quests and NPC dialogue -------------------------------------------

function customQuestToData(quest) {
    let goal;
    if (quest.goalType === 'give') goal = { class: 'TalkingGoal', npc_name: quest.npc, item_name: quest.item, amount: quest.amount };
    else if (quest.goalType === 'have') goal = { class: 'HaveGoal', item_name: quest.item, amount: quest.amount };
    else if (quest.goalType === 'sell') goal = { class: 'SellGoal', item_name: quest.item, amount: quest.amount };
    else if (quest.goalType === 'visit') goal = { class: 'LocationGoal', level_name: quest.level };
    else goal = { class: 'TalkingGoal', npc_name: quest.npc, item_name: 0, amount: 0 };
    const rewardNum = quest.rewardItem && typeof item_name_to_num === 'function' ? item_name_to_num(quest.rewardItem) : undefined;
    return {
        name: quest.name,
        goals: [goal],
        days: quest.days,
        reward_item: rewardNum ? { num: rewardNum, amount: quest.rewardAmount } : 0,
        reward_coins: quest.rewardCoins
    };
}

function scaleQuestRewards(questData, multiplier) {
    if (multiplier === 1 || !questData) return questData;
    questData.reward_coins = Math.round((questData.reward_coins || 0) * multiplier);
    if (questData.reward_item && questData.reward_item !== 0) {
        const amount = Math.round((questData.reward_item.amount || 1) * multiplier);
        questData.reward_item = amount > 0 ? { ...questData.reward_item, amount } : 0;
    }
    return questData;
}

// Dialogue JSON for one NPC after rules: text edits, disabled side quests,
// scaled rewards, and custom quests offered as an extra reply on line 0.
function buildRuleDialogueData(npcName, rules) {
    const source = typeof Dialouge_JSON !== 'undefined' && Dialouge_JSON ? Dialouge_JSON[npcName] : null;
    if (!Array.isArray(source)) return null;
    const data = JSON.parse(JSON.stringify(source));
    const edits = (rules.dialogueOverrides || {})[npcName] || {};
    const disabled = rules.disabledSideQuests || [];
    const rewardScale = (rules.questRewardMultiplier ?? 100) / 100;

    data.forEach((line, i) => {
        if (edits[String(i)]) line.phrase = edits[String(i)];
        (line.replies || []).forEach((reply, j) => {
            if (edits[i + '.' + j]) reply.phrase = edits[i + '.' + j];
            if (reply.quest && reply.quest !== -1) {
                if (disabled.includes(reply.quest.name)) reply.quest = -1;
                else scaleQuestRewards(reply.quest, rewardScale);
            }
        });
    });

    const offered = (rules.customQuests || []).filter(q => q.giver === npcName);
    if (offered.length && data[0]) {
        data[0].replies = data[0].replies || [];
        offered.forEach(quest => {
            data[0].replies.unshift({ phrase: 'About "' + quest.name + '"...', dialouge_num: -1, quest: customQuestToData(quest) });
        });
    }
    return data;
}

function forEachLevelTile(callback) {
    if (typeof levels === 'undefined' || !Array.isArray(levels)) return;
    levels.forEach(row => (row || []).forEach(level => {
        if (!level || !level.map) return;
        level.map.forEach((mapRow, r) => mapRow.forEach((tile, c) => {
            if (tile && tile !== 0) callback(tile, level, r, c);
        }));
    }));
}

function rebuildNpcDialogues(rules) {
    const changesDialogue = Object.keys(rules.dialogueOverrides || {}).length ||
        (rules.disabledSideQuests || []).length ||
        (rules.customQuests || []).some(q => q.giver) ||
        (rules.questRewardMultiplier ?? 100) !== 100;
    if (!changesDialogue || typeof Dialouge === 'undefined') return;
    forEachLevelTile(tile => {
        if (tile.class !== 'NPC') return;
        const data = buildRuleDialogueData(tile.name, rules);
        if (!data) return;
        tile.dialouges = data.map(d => new Dialouge(d.phrase, d.replies, d.hand_num, d.amount));
        tile.current_dialouge = 0;
    });
}

function applyShopStockRules(rules) {
    const stockRules = rules.shopStock || {};
    if (!Object.keys(stockRules).length) return;
    forEachLevelTile(tile => {
        if (tile.class !== 'Shop' || !stockRules[tile.name]) return;
        const stock = stockRules[tile.name];
        tile.inv = stock.map(entry => new_item_from_num(item_name_to_num(entry.name), entry.amount) || 0);
        tile.originalPrices = tile.inv.map(item => item ? item.price : 0);
        tile.itemsSold = {};
        tile.inv.forEach(item => { if (item) tile.itemsSold[item.name] = 0; });
        tile._enabledIndices = null;
    });
}

// --- Map edits ------------------------------------------------------------------

// Pristine tile numbers per level, captured right after newWorld() so the map
// editor can show (and diff against) the unmodified world.
let baseLevelMaps = {};
let baseLevelAppearance = {};

// Copy only rendering state: live tiles move, grow and change after a game starts.
function captureMapTileAppearance(tile) {
    if (!tile) return null;
    return {
        name: tile.name, png: tile.png, variant: tile.variant,
        facing: tile.facing, age: tile.age, watermet: tile.watermet,
        waterneeded: tile.waterneeded, class: tile.class,
        under_tile: captureMapTileAppearance(tile.under_tile)
    };
}

function captureBaseLevelMaps() {
    baseLevelMaps = {};
    baseLevelAppearance = {};
    if (typeof levels === 'undefined' || !Array.isArray(levels)) return;
    levels.forEach(row => (row || []).forEach(level => {
        if (!level || !level.map || !level.name) return;
        baseLevelMaps[level.name] = level.map.map(mapRow => mapRow.map(tile => {
            if (!tile || tile === 0) return 0;
            const num = typeof tile_name_to_num === 'function' ? tile_name_to_num(tile.name) : 0;
            return num || 0;
        }));
        baseLevelAppearance[level.name] = {
            map: level.map.map(mapRow => mapRow.map(captureMapTileAppearance)),
            fore: (level.fore || []).map(foreRow => foreRow.map(tile => tile ? {
                png: tile.png, variant: tile.variant, type: tile.type, dim: tile.dim
            } : null))
        };
    }));
}

function placeRuleTile(level, row, col, num) {
    const tile = new_tile_from_num(num, col * tileSize, row * tileSize);
    if (!tile) return;
    level.map[row][col] = tile;
    if (typeof Light !== 'undefined' && typeof append === 'function') {
        if (tile.name === 'lamppost') append(level.lights, new Light(tile.pos.x, tile.pos.y, tileSize * 6, 255, 255, 255));
        if (tile.name === 'satilite') append(level.lights, new Light(tile.pos.x, tile.pos.y, tileSize + 5, 255, 255, 0));
    }
}

function applyMapEditRules(rules) {
    const edits = rules.mapEdits || {};
    Object.keys(edits).forEach(levelName => {
        const found = getLevelByName(levelName);
        if (!found) return;
        Object.keys(edits[levelName]).forEach(cellKey => {
            const [row, col] = cellKey.split(',').map(Number);
            if (found.level.map[row] && col < found.level.map[row].length) placeRuleTile(found.level, row, col, edits[levelName][cellKey]);
        });
    });
}

// --- New game ------------------------------------------------------------------

// Everything that sets up the world/player once, when a custom game starts
// (the save system persists the result). Order matters: map edits first so
// placed shops/NPCs get custom stock and dialogue. Safe to run twice. The start
// area is applied separately by applyCustomStartArea().
function applyNewGameCustomRules(target, rules) {
    if (!target || !rules) return;
    defineCustomRuleGoals();

    applyMapEditRules(rules);
    applyShopStockRules(rules);
    rebuildNpcDialogues(rules);

    applyCustomRuleRuntime();
    target.hp = getMaxHealth();
    target.hunger = typeof maxHunger !== 'undefined' ? maxHunger : target.hunger;
    target.livesUsed = 0;

    // Time of day
    const startTimes = { morning: [0, 0], afternoon: [70, 0], evening: [140, 0], night: [190, 1] };
    const [startTime, startPhase] = startTimes[rules.startTimeOfDay] || startTimes.morning;
    time = startTime;
    timephase = startPhase;

    // Main quest: win condition and deadline
    const mainIndex = (target.quests || []).findIndex(q => q && q.og_name === 'Save Cloudy Meadows');
    if (mainIndex !== -1 && (rules.winCondition || 'funding') !== 'funding') {
        const questDays = rules.winCondition === 'survive' ? 0 : rules.mainQuestDays;
        const old = target.quests[mainIndex];
        (old.goals || []).forEach(goal => goal && typeof goal.removeEventListeners === 'function' && goal.removeEventListeners());
        target.quests[mainIndex] = new Quest('Save Cloudy Meadows', buildMainQuestGoals(rules), questDays, 0, 0);
    }

    // Custom quests with no giver start in the quest log (once, even if the
    // new-game setup runs again after a reload before the first save).
    (rules.customQuests || []).filter(q => !q.giver).forEach(quest => {
        if (target.quests.some(existing => existing && existing.og_name === quest.name)) return;
        const data = customQuestToData(quest);
        target.quests.push(new Quest(data.name, data.goals, data.days, data.reward_item, data.reward_coins));
    });
}

// Move a new custom game's player to the Start In area. Call after area rules
// are applied so a disabled area falls back to Home.
function applyCustomStartArea(target, rules) {
    if (!target || !rules || !rules.startArea) return;
    const spawn = getRespawnPoint();
    currentLevel_y = spawn.levelY;
    currentLevel_x = spawn.levelX;
    target.pos.x = spawn.x;
    target.pos.y = spawn.y;
}

// =============================================================================
// Config editor UI (Survival, Farming, Economy, Goals, Powers, Map Editor tabs,
// plus extra sections in the World and People tabs). Built by ensureConfigModal
// in miscfunctions.js through createExtendedConfigPanels/fillExtendedConfigPanels.
// =============================================================================

const EXTENDED_CONFIG_TABS = [
    { id: 'survival', label: 'Survival' },
    { id: 'farming', label: 'Farming' },
    { id: 'economy', label: 'Economy' },
    { id: 'goals', label: 'Goals' },
    { id: 'powers', label: 'Powers' },
    { id: 'map', label: 'Map Editor' }
];

const CUSTOM_QUEST_GOAL_LABELS = {
    talk: 'Talk to someone',
    give: 'Give items to someone',
    have: 'Collect items',
    sell: 'Sell items',
    visit: 'Visit an area'
};

let shopStockDraft = {};
let dialogueDraft = {};
let mapEditsDraft = {};
let mapEditorState = { level: '', tile: 2, tool: 'paint', painting: false };

function cfgEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}

function cfgButton(label, className, onClick) {
    const btn = cfgEl('button', className || 'config-btn config-btn-small', label);
    btn.type = 'button';
    btn.addEventListener('click', onClick);
    return btn;
}

function cfgSelect(options, value, className) {
    const select = cfgEl('select', className || 'config-input config-select');
    options.forEach(opt => {
        const option = cfgEl('option', null, opt.label);
        option.value = opt.value;
        select.appendChild(option);
    });
    if (value !== undefined) setSelectValue(select, value);
    return select;
}

// Select a value, adding it as an option if the list doesn't have it (e.g. a
// shared code naming an area this build calls something else).
function setSelectValue(select, value) {
    const str = value === undefined || value === null ? '' : String(value);
    if (!Array.from(select.options).some(opt => opt.value === str)) {
        const option = cfgEl('option', null, str || '(none)');
        option.value = str;
        select.appendChild(option);
    }
    select.value = str;
}

function cfgNumber(value, min, max, className) {
    const input = cfgEl('input', className || 'config-input config-number');
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    return input;
}

function cfgField(labelText, control) {
    const wrap = cfgEl('label', 'config-field');
    wrap.appendChild(cfgEl('span', 'config-field-label', labelText));
    wrap.appendChild(control);
    return wrap;
}

function levelNameOptions() {
    const names = Object.keys(baseLevelMaps);
    if (!names.length && typeof levels !== 'undefined' && Array.isArray(levels)) {
        levels.forEach(row => (row || []).forEach(level => { if (level && level.name) names.push(level.name); }));
    }
    return names.filter(name => !/^Extra /.test(name)).map(name => ({ value: name, label: name }));
}

function npcSkinOptions() {
    const names = [];
    ruleTileDefinitions().forEach(def => {
        if (def && def.class === 'NPC' && def.name && !names.includes(def.name)) names.push(def.name);
    });
    return names.sort().map(name => ({ value: name, label: name }));
}

function itemNameOptions() {
    return ruleItemDefinitions()
        .filter((def, idx) => idx > 0 && def && def.name)
        .map(def => ({ value: def.name, label: def.name }));
}

function dialogueNpcNames() {
    return Object.keys(typeof Dialouge_JSON !== 'undefined' && Dialouge_JSON ? Dialouge_JSON : {}).sort();
}

function ruleSpecOptions(spec) {
    let options = spec.options;
    if (spec.optionsFrom === 'levels') options = levelNameOptions();
    else if (spec.optionsFrom === 'npcSkins') options = npcSkinOptions();
    else if (spec.optionsFrom === 'items') options = itemNameOptions();
    if (spec.emptyLabel) options = [{ value: '', label: spec.emptyLabel }].concat(options);
    return options || [];
}

function buildRuleControl(spec) {
    const row = cfgEl('div', 'config-row config-rule-row');
    row.dataset.ruleKey = spec.key;

    const labelWrap = cfgEl('div', 'config-rule-label');
    const label = cfgEl('label', 'config-label', spec.label);
    label.htmlFor = 'cfg-rule-' + spec.key;
    labelWrap.appendChild(label);
    if (spec.help) labelWrap.appendChild(cfgEl('div', 'config-rule-help', spec.help));
    row.appendChild(labelWrap);

    // Fixed-width control column so every row lines up: numbers get a unit
    // slot (empty if none), selects fill the column, toggles are switches.
    const control = cfgEl('div', 'config-rule-control');
    let input;
    if (spec.type === 'bool') {
        input = cfgEl('input', 'config-switch');
        input.type = 'checkbox';
        control.appendChild(input);
    } else if (spec.type === 'enum') {
        input = cfgSelect(ruleSpecOptions(spec), spec.def);
        control.appendChild(input);
    } else {
        input = cfgNumber(spec.def, spec.min, spec.max, 'config-input config-rule-number');
        input.step = String(spec.step || 1);
        control.appendChild(input);
        control.appendChild(cfgEl('span', 'config-unit', spec.unit || ''));
    }
    row.appendChild(control);
    input.id = 'cfg-rule-' + spec.key;
    input.dataset.ruleKey = spec.key;
    input.addEventListener('change', updateRuleVisibility);
    return row;
}

function updateRuleVisibility() {
    RULE_SPECS.forEach(spec => {
        if (!spec.showIf) return;
        const row = document.querySelector('.config-rule-row[data-rule-key="' + spec.key + '"]');
        if (!row) return;
        row.hidden = !Object.keys(spec.showIf).every(key => {
            const control = document.getElementById('cfg-rule-' + key);
            return control && spec.showIf[key].includes(control.value);
        });
    });
}

function createExtendedConfigPanels(createTabPanel) {
    const panels = {};
    EXTENDED_CONFIG_TABS.forEach(tab => { panels[tab.id] = createTabPanel(tab.id, tab.label); });
    return panels;
}

function fillExtendedConfigPanels(panels, helpers) {
    const allPanels = { ...panels, world: helpers.worldPanel, people: helpers.peoplePanel };
    const sections = {};
    RULE_SPECS.forEach(spec => {
        const panel = allPanels[spec.tab];
        if (!panel) return;
        const sectionId = spec.tab + '|' + spec.section;
        if (!sections[sectionId]) sections[sectionId] = helpers.createSection(panel, spec.section);
        sections[sectionId].appendChild(buildRuleControl(spec));
    });

    buildCropGrowthEditor(helpers.createSection(panels.farming, 'Per-Crop Growth Speed', 'On top of Crop Growth Speed. 100% = normal.'));
    buildCoopContractsEditor(helpers.createSection(panels.economy, 'Co-op Contracts', 'The Job Board posts four of these each week. Amounts and rewards grow as your co-op rank rises.'));
    buildShopStockEditor(helpers.createSection(panels.economy, 'Shop Stock', 'Choose what each shop or vendor sells and how many it starts with (up to ' + MAX_SHOP_STOCK_ITEMS + ' items).'));
    buildSideQuestToggles(helpers.createSection(panels.goals, 'Side Quests', 'Turned-off quests are never offered by their NPC.'));
    buildCustomQuestEditor(helpers.createSection(panels.goals, 'Your Own Quests', 'Given at the start of the game, or offered by an NPC as an extra reply. Incomplete quests are skipped.'));
    if (helpers.peoplePanel) {
        buildDialogueEditor(helpers.createSection(helpers.peoplePanel, 'Dialogue', 'Rewrite what NPCs say and the replies you can pick. Clear a box to go back to the original line.'));
    }
    buildMapEditor(helpers.createSection(panels.map, null, 'Edits are applied when a new custom game starts.'));
    updateRuleVisibility();
}

function populateExtendedConfigForm(rules) {
    RULE_SPECS.forEach(spec => {
        const input = document.getElementById('cfg-rule-' + spec.key);
        if (!input) return;
        const value = rules[spec.key] !== undefined ? rules[spec.key] : spec.def;
        if (spec.type === 'bool') input.checked = !!value;
        else if (spec.type === 'enum') {
            // Runtime lists (levels, NPCs) may have changed since the modal was built.
            if (spec.optionsFrom) {
                input.innerHTML = '';
                ruleSpecOptions(spec).forEach(opt => {
                    const option = cfgEl('option', null, opt.label);
                    option.value = opt.value;
                    input.appendChild(option);
                });
            }
            setSelectValue(input, value);
        } else input.value = String(value);
    });
    updateRuleVisibility();
    populateCropGrowthEditor(rules.cropGrowth || {});
    populateCoopContractsEditor(rules.coopContracts);
    shopStockDraft = JSON.parse(JSON.stringify(rules.shopStock || {}));
    renderShopStockEditor();
    populateSideQuestToggles(rules.disabledSideQuests || []);
    populateCustomQuestEditor(rules.customQuests || []);
    dialogueDraft = JSON.parse(JSON.stringify(rules.dialogueOverrides || {}));
    renderDialogueEditor();
    mapEditsDraft = JSON.parse(JSON.stringify(rules.mapEdits || {}));
    renderMapEditor();
}

// Raw values from every extended control; normalizeCustomRules cleans them.
function readExtendedConfigForm() {
    const out = {};
    RULE_SPECS.forEach(spec => {
        const input = document.getElementById('cfg-rule-' + spec.key);
        if (!input) return;
        if (spec.type === 'bool') out[spec.key] = input.checked;
        else if (spec.type === 'enum') out[spec.key] = input.value;
        else out[spec.key] = input.value;
    });
    out.cropGrowth = readCropGrowthEditor();
    out.coopContracts = readCoopContractsEditor();
    out.shopStock = JSON.parse(JSON.stringify(shopStockDraft));
    out.disabledSideQuests = readSideQuestToggles();
    out.customQuests = readCustomQuestEditor();
    out.dialogueOverrides = JSON.parse(JSON.stringify(dialogueDraft));
    out.mapEdits = JSON.parse(JSON.stringify(mapEditsDraft));
    return out;
}

// --- Per-crop growth ---------------------------------------------------------

function buildCropGrowthEditor(section) {
    const grid = cfgEl('div', 'config-crop-grid');
    grid.id = 'cfg-crop-growth';
    cropTileDefinitions().forEach(crop => {
        const input = cfgNumber(100, 10, 1000);
        input.step = '5';
        input.dataset.crop = crop.name;
        const wrap = cfgEl('div', 'config-number-wrap');
        wrap.appendChild(input);
        wrap.appendChild(cfgEl('span', 'config-unit', '%'));
        grid.appendChild(cfgField(crop.name.replace(/_/g, ' '), wrap));
    });
    section.appendChild(grid);
}

function populateCropGrowthEditor(map) {
    document.querySelectorAll('#cfg-crop-growth input[data-crop]').forEach(input => {
        input.value = String(map[input.dataset.crop] || 100);
    });
}

function readCropGrowthEditor() {
    const out = {};
    document.querySelectorAll('#cfg-crop-growth input[data-crop]').forEach(input => {
        out[input.dataset.crop] = input.value;
    });
    return out;
}

// --- Co-op contracts ----------------------------------------------------------
// Grouped by district: each district is a block of contract cards that read
// as a sentence ("Deliver [30] x [Corn]  /  [240] coins").

function itemSpritePath(itemName) {
    const map = typeof CONFIG_ITEM_SPRITE_MAP !== 'undefined' ? CONFIG_ITEM_SPRITE_MAP : {};
    return map[itemName] || 'images/items/junk.png';
}

function coopContractCard(contract) {
    const card = cfgEl('div', 'coop-card');

    const icon = cfgEl('div', 'coop-card-icon');
    const img = cfgEl('img');
    img.width = 32;
    img.height = 32;
    img.alt = '';
    img.src = itemSpritePath(contract.itemName);
    icon.appendChild(img);
    card.appendChild(icon);

    const body = cfgEl('div', 'coop-card-body');
    const title = cfgEl('input', 'coop-card-title');
    title.type = 'text';
    title.maxLength = 40;
    title.value = contract.title;
    title.placeholder = 'Contract name';
    title.dataset.field = 'title';
    title.setAttribute('aria-label', 'Contract name');
    body.appendChild(title);

    const terms = cfgEl('div', 'coop-card-terms');
    terms.appendChild(cfgEl('span', 'coop-card-word', 'Deliver'));
    const amount = cfgNumber(contract.amount, 1, 9999, 'config-input coop-card-number');
    amount.dataset.field = 'amount';
    amount.setAttribute('aria-label', 'Amount to deliver');
    terms.appendChild(amount);
    terms.appendChild(cfgEl('span', 'coop-card-word', '×'));
    const item = cfgSelect(itemNameOptions(), contract.itemName, 'config-input config-select coop-card-item');
    item.dataset.field = 'itemName';
    item.setAttribute('aria-label', 'Item to deliver');
    item.addEventListener('change', () => { img.src = itemSpritePath(item.value); });
    terms.appendChild(item);
    body.appendChild(terms);

    const reward = cfgEl('div', 'coop-card-terms coop-card-reward');
    const coin = cfgEl('img', 'coop-card-coin');
    coin.src = 'images/ui/coin.png';
    coin.alt = '';
    reward.appendChild(coin);
    const rewardInput = cfgNumber(contract.reward, 0, 1000000, 'config-input coop-card-number');
    rewardInput.dataset.field = 'reward';
    rewardInput.setAttribute('aria-label', 'Reward in coins');
    reward.appendChild(rewardInput);
    reward.appendChild(cfgEl('span', 'coop-card-word', 'coins'));
    body.appendChild(reward);
    card.appendChild(body);

    const remove = cfgButton('×', 'config-start-remove coop-card-remove', () => {
        card.remove();
        updateCoopEditorCounts();
    });
    remove.title = 'Remove this contract';
    remove.setAttribute('aria-label', 'Remove ' + (contract.title || 'contract'));
    card.appendChild(remove);
    return card;
}

function addCoopContract(district) {
    const grid = document.querySelector('#cfg-coop-editor .coop-district[data-district="' + district + '"] .coop-card-grid');
    if (!grid || document.querySelectorAll('#cfg-coop-editor .coop-card').length >= MAX_COOP_CONTRACTS) return;
    const sample = defaultCoopContracts().find(c => c.district === district);
    const card = coopContractCard({ title: 'New Contract', itemName: sample ? sample.itemName : 'Corn', amount: 10, reward: 100 });
    grid.appendChild(card);
    updateCoopEditorCounts();
    const title = card.querySelector('.coop-card-title');
    if (title) {
        title.focus();
        title.select();
    }
}

function buildCoopContractsEditor(section) {
    if (!section) return;
    const editor = cfgEl('div', 'coop-editor');
    editor.id = 'cfg-coop-editor';

    const toolbar = cfgEl('div', 'coop-editor-toolbar');
    const count = cfgEl('span', 'config-items-summary-chip coop-editor-count');
    count.id = 'cfg-coop-count';
    toolbar.appendChild(count);
    toolbar.appendChild(cfgButton('Restore Built-ins', 'config-btn config-btn-small', () => populateCoopContractsEditor(null)));
    editor.appendChild(toolbar);

    coopDistrictNames().forEach(district => {
        const group = cfgEl('div', 'coop-district');
        group.dataset.district = district;
        const head = cfgEl('div', 'coop-district-head');
        head.appendChild(cfgEl('span', 'coop-district-dot'));
        head.appendChild(cfgEl('span', 'coop-district-name', district));
        head.appendChild(cfgEl('span', 'coop-district-count'));
        const add = cfgButton('+ Add', 'coop-district-add', () => addCoopContract(district));
        add.setAttribute('aria-label', 'Add a contract in ' + district);
        head.appendChild(add);
        group.appendChild(head);
        group.appendChild(cfgEl('div', 'coop-card-grid'));
        group.appendChild(cfgEl('div', 'coop-district-empty', 'No contracts here.'));
        editor.appendChild(group);
    });
    section.appendChild(editor);
}

function updateCoopEditorCounts() {
    const editor = document.getElementById('cfg-coop-editor');
    if (!editor) return;
    const total = editor.querySelectorAll('.coop-card').length;
    const full = total >= MAX_COOP_CONTRACTS;
    const count = document.getElementById('cfg-coop-count');
    if (count) count.textContent = total + ' / ' + MAX_COOP_CONTRACTS + ' contracts';
    editor.querySelectorAll('.coop-district').forEach(group => {
        const n = group.querySelectorAll('.coop-card').length;
        group.querySelector('.coop-district-count').textContent = String(n);
        group.querySelector('.coop-district-empty').hidden = n > 0;
        group.querySelector('.coop-district-add').disabled = full;
    });
}

function populateCoopContractsEditor(contracts) {
    const editor = document.getElementById('cfg-coop-editor');
    if (!editor) return;
    const groups = {};
    editor.querySelectorAll('.coop-district').forEach(group => {
        group.querySelector('.coop-card-grid').innerHTML = '';
        groups[group.dataset.district] = group.querySelector('.coop-card-grid');
    });
    const fallback = Object.keys(groups)[0];
    (Array.isArray(contracts) ? contracts : defaultCoopContracts()).forEach(contract => {
        const grid = groups[contract.district] || groups[fallback];
        if (grid) grid.appendChild(coopContractCard(contract));
    });
    updateCoopEditorCounts();
}

function readCoopContractsEditor() {
    const editor = document.getElementById('cfg-coop-editor');
    if (!editor) return null;
    const out = [];
    editor.querySelectorAll('.coop-district').forEach(group => {
        group.querySelectorAll('.coop-card').forEach(card => {
            const contract = { district: group.dataset.district };
            card.querySelectorAll('[data-field]').forEach(input => { contract[input.dataset.field] = input.value; });
            out.push(contract);
        });
    });
    return out;
}

// --- Shop stock ------------------------------------------------------------------

function buildShopStockEditor(section) {
    const shops = shopTileDefinitions();
    const top = cfgEl('div', 'config-inline-row');
    const shopSelect = cfgSelect(shops.map(s => ({ value: s.name, label: s.name })));
    shopSelect.id = 'cfg-shop-select';
    shopSelect.addEventListener('change', renderShopStockEditor);
    top.appendChild(cfgField('Shop', shopSelect));
    section.appendChild(top);

    const list = cfgEl('div', 'config-list');
    list.id = 'cfg-shop-stock-rows';
    section.appendChild(list);

    const addRow = cfgEl('div', 'config-inline-row');
    const itemSelect = cfgSelect(itemNameOptions());
    itemSelect.id = 'cfg-shop-add-item';
    addRow.appendChild(cfgField('Add item', itemSelect));
    addRow.appendChild(cfgButton('Add', 'config-btn', () => {
        const stock = currentShopStock();
        if (stock.length >= MAX_SHOP_STOCK_ITEMS || stock.some(e => e.name === itemSelect.value)) return;
        stock.push({ name: itemSelect.value, amount: 5 });
        setCurrentShopStock(stock);
    }));
    addRow.appendChild(cfgButton('Restore Default Stock', 'config-btn', () => {
        delete shopStockDraft[shopSelect.value];
        renderShopStockEditor();
    }));
    section.appendChild(addRow);
}

function currentShopStock() {
    const name = document.getElementById('cfg-shop-select')?.value;
    if (!name) return [];
    if (shopStockDraft[name]) return shopStockDraft[name].map(e => ({ ...e }));
    const shop = shopTileDefinitions().find(s => s.name === name);
    return shop ? shop.stock.map(e => ({ ...e })) : [];
}

function setCurrentShopStock(stock) {
    const name = document.getElementById('cfg-shop-select')?.value;
    if (!name) return;
    const shop = shopTileDefinitions().find(s => s.name === name);
    if (shop && JSON.stringify(stock) === JSON.stringify(shop.stock)) delete shopStockDraft[name];
    else shopStockDraft[name] = stock;
    renderShopStockEditor();
}

function renderShopStockEditor() {
    const list = document.getElementById('cfg-shop-stock-rows');
    if (!list) return;
    list.innerHTML = '';
    const stock = currentShopStock();
    if (!stock.length) list.appendChild(cfgEl('div', 'config-empty-state', 'This shop sells nothing. Add an item below.'));
    stock.forEach((entry, i) => {
        const row = cfgEl('div', 'config-list-row');
        row.appendChild(cfgEl('span', 'config-list-name', entry.name));
        const amount = cfgNumber(entry.amount, 1, 999);
        amount.addEventListener('change', () => {
            const next = currentShopStock();
            next[i].amount = clampRuleInt(amount.value, 1, 999, 1);
            setCurrentShopStock(next);
        });
        row.appendChild(cfgField('Starting stock', amount));
        row.appendChild(cfgButton('×', 'config-start-remove', () => {
            const next = currentShopStock();
            next.splice(i, 1);
            setCurrentShopStock(next);
        }));
        list.appendChild(row);
    });
    const name = document.getElementById('cfg-shop-select')?.value;
    const status = cfgEl('div', 'config-help', shopStockDraft[name] ? 'Custom stock' : 'Default stock');
    list.appendChild(status);
}

// --- Side quests ------------------------------------------------------------------

function sideQuestList() {
    const out = [];
    const json = typeof Dialouge_JSON !== 'undefined' && Dialouge_JSON ? Dialouge_JSON : {};
    Object.keys(json).forEach(npc => (json[npc] || []).forEach(line => (line.replies || []).forEach(reply => {
        if (reply.quest && reply.quest !== -1 && reply.quest.name && !out.some(q => q.name === reply.quest.name)) {
            out.push({ name: reply.quest.name, npc });
        }
    })));
    return out;
}

function buildSideQuestToggles(section) {
    const grid = cfgEl('div', 'config-grid');
    grid.id = 'cfg-side-quests';
    sideQuestList().forEach(quest => {
        const btn = cfgEl('button', 'config-grid-item config-quest-toggle active');
        btn.type = 'button';
        btn.dataset.questName = quest.name;
        btn.appendChild(cfgEl('span', 'config-quest-name', quest.name));
        btn.appendChild(cfgEl('span', 'config-quest-npc', quest.npc));
        btn.addEventListener('click', () => btn.classList.toggle('active'));
        grid.appendChild(btn);
    });
    section.appendChild(grid);
    const actions = cfgEl('div', 'config-actions config-inline-actions');
    actions.appendChild(cfgButton('All On', 'config-btn', () => grid.querySelectorAll('.config-grid-item').forEach(b => b.classList.add('active'))));
    actions.appendChild(cfgButton('All Off', 'config-btn', () => grid.querySelectorAll('.config-grid-item').forEach(b => b.classList.remove('active'))));
    section.appendChild(actions);
}

function populateSideQuestToggles(disabled) {
    document.querySelectorAll('#cfg-side-quests .config-grid-item').forEach(btn => {
        btn.classList.toggle('active', !disabled.includes(btn.dataset.questName));
    });
}

function readSideQuestToggles() {
    return Array.from(document.querySelectorAll('#cfg-side-quests .config-grid-item:not(.active)')).map(b => b.dataset.questName);
}

// --- Custom quest builder --------------------------------------------------------

function customQuestCard(quest) {
    const card = cfgEl('div', 'config-quest-card');
    const field = (label, control, key, showFor) => {
        control.dataset.field = key;
        const wrap = cfgField(label, control);
        if (showFor) wrap.dataset.showFor = showFor.join(' ');
        card.appendChild(wrap);
        return control;
    };
    const npcOptions = dialogueNpcNames().map(n => ({ value: n, label: n }));
    const name = cfgEl('input', 'config-input');
    name.type = 'text';
    name.maxLength = 40;
    name.value = quest.name || '';
    name.placeholder = 'Quest name';
    field('Name', name, 'name');
    field('Given by', cfgSelect([{ value: '', label: 'Start of the game' }].concat(npcOptions), quest.giver || ''), 'giver');
    const goalType = field('Goal', cfgSelect(CUSTOM_QUEST_GOAL_TYPES.map(t => ({ value: t, label: CUSTOM_QUEST_GOAL_LABELS[t] })), quest.goalType || 'talk'), 'goalType');
    field('Who', cfgSelect(npcOptions, quest.npc || (npcOptions[0] && npcOptions[0].value)), 'npc', ['talk', 'give']);
    field('Item', cfgSelect(itemNameOptions(), quest.item || 'Corn'), 'item', ['give', 'have', 'sell']);
    field('Amount', cfgNumber(quest.amount || 1, 1, 9999), 'amount', ['give', 'have', 'sell']);
    field('Area', cfgSelect(levelNameOptions(), quest.level || ''), 'level', ['visit']);
    field('Days (0 = no limit)', cfgNumber(quest.days || 0, 0, 1000), 'days');
    field('Reward coins', cfgNumber(quest.rewardCoins || 0, 0, 1000000), 'rewardCoins');
    field('Reward item', cfgSelect([{ value: '', label: 'None' }].concat(itemNameOptions()), quest.rewardItem || ''), 'rewardItem');
    field('Reward amount', cfgNumber(quest.rewardAmount || 1, 1, 999), 'rewardAmount');
    card.appendChild(cfgButton('Remove Quest', 'config-btn config-btn-small config-btn-danger', () => card.remove()));

    const syncVisibility = () => {
        card.querySelectorAll('[data-show-for]').forEach(wrap => {
            wrap.hidden = !wrap.dataset.showFor.split(' ').includes(goalType.value);
        });
    };
    goalType.addEventListener('change', syncVisibility);
    syncVisibility();
    return card;
}

function buildCustomQuestEditor(section) {
    const list = cfgEl('div', 'config-quest-list');
    list.id = 'cfg-custom-quests';
    section.appendChild(list);
    const actions = cfgEl('div', 'config-actions config-inline-actions');
    actions.appendChild(cfgButton('Add Quest', 'config-btn', () => {
        if (list.children.length >= MAX_CUSTOM_QUESTS) return;
        list.appendChild(customQuestCard({ name: 'New Quest', goalType: 'have', item: 'Corn', amount: 10, rewardCoins: 100 }));
    }));
    section.appendChild(actions);
}

function populateCustomQuestEditor(quests) {
    const list = document.getElementById('cfg-custom-quests');
    if (!list) return;
    list.innerHTML = '';
    quests.forEach(q => list.appendChild(customQuestCard(q)));
}

function readCustomQuestEditor() {
    return Array.from(document.querySelectorAll('#cfg-custom-quests .config-quest-card')).map(card => {
        const out = {};
        card.querySelectorAll('[data-field]').forEach(input => { out[input.dataset.field] = input.value; });
        return out;
    });
}

// --- Dialogue editor ----------------------------------------------------------------

function originalDialogueText(phrase) {
    return Array.isArray(phrase) ? phrase.join('') : String(phrase || '');
}

function buildDialogueEditor(section) {
    const top = cfgEl('div', 'config-inline-row');
    const npcSelect = cfgSelect(dialogueNpcNames().map(n => ({ value: n, label: n })));
    npcSelect.id = 'cfg-dialogue-npc';
    npcSelect.addEventListener('change', renderDialogueEditor);
    top.appendChild(cfgField('NPC', npcSelect));
    top.appendChild(cfgButton('Reset This NPC', 'config-btn', () => {
        delete dialogueDraft[npcSelect.value];
        renderDialogueEditor();
    }));
    section.appendChild(top);
    const list = cfgEl('div', 'config-dialogue-list');
    list.id = 'cfg-dialogue-lines';
    section.appendChild(list);
}

function renderDialogueEditor() {
    const list = document.getElementById('cfg-dialogue-lines');
    const npc = document.getElementById('cfg-dialogue-npc')?.value;
    if (!list) return;
    list.innerHTML = '';
    const lines = npc && typeof Dialouge_JSON !== 'undefined' && Dialouge_JSON ? Dialouge_JSON[npc] : null;
    if (!Array.isArray(lines)) return;
    const edits = dialogueDraft[npc] || {};

    const bind = (control, key, original) => {
        control.value = edits[key] !== undefined ? edits[key] : original;
        control.placeholder = original;
        control.maxLength = MAX_DIALOGUE_TEXT;
        control.addEventListener('input', () => {
            const text = control.value.trim();
            dialogueDraft[npc] = dialogueDraft[npc] || {};
            if (!text || text === original) delete dialogueDraft[npc][key];
            else dialogueDraft[npc][key] = text;
            if (!Object.keys(dialogueDraft[npc]).length) delete dialogueDraft[npc];
            control.classList.toggle('edited', !!(dialogueDraft[npc] && dialogueDraft[npc][key]));
        });
        control.classList.toggle('edited', edits[key] !== undefined);
    };

    lines.forEach((line, i) => {
        const block = cfgEl('div', 'config-dialogue-block');
        block.appendChild(cfgEl('div', 'config-field-label', 'Line ' + (i + 1)));
        const phrase = cfgEl('textarea', 'config-share-code config-dialogue-text');
        phrase.rows = 2;
        bind(phrase, String(i), originalDialogueText(line.phrase));
        block.appendChild(phrase);
        (line.replies || []).forEach((reply, j) => {
            const replyRow = cfgEl('div', 'config-dialogue-reply');
            replyRow.appendChild(cfgEl('span', 'config-dialogue-arrow', reply.quest && reply.quest !== -1 ? '★' : '→'));
            const input = cfgEl('input', 'config-input');
            input.type = 'text';
            bind(input, i + '.' + j, originalDialogueText(reply.phrase));
            replyRow.appendChild(input);
            block.appendChild(replyRow);
        });
        list.appendChild(block);
    });
}

// --- Map editor ----------------------------------------------------------------------

const MAP_CELL_PX = 24;

function mapSpriteDrawable(png, variant = 0, facing = 2) {
    if (typeof all_imgs === 'undefined' || !all_imgs[png]) return null;
    let img = all_imgs[png];
    if (Array.isArray(img) && Array.isArray(img[0])) img = img[facing] || img[0];
    if (Array.isArray(img)) img = img[variant] || img[0];
    return img ? (img.canvas || img.elt || null) : null;
}

function tileDrawable(num, appearance = null) {
    const def = ruleTileDefinition(num);
    if (!def) return null;
    const tile = appearance || def;
    const variant = def.class === 'Plant' ? Math.max(0, tile.age || 0) : tile.variant || 0;
    const facing = tile.facing === undefined
        ? (['FreeMoveEntity', 'LightMoveEntity'].includes(def.class) ? 3 : 2) : tile.facing;
    return mapSpriteDrawable(tile.png, variant, facing);
}

function drawTile(ctx, num, x, y, size, appearance = null, thumbnail = false) {
    const def = ruleTileDefinition(num);
    if (!def) return;
    // Match the ground layers drawn by Tile/Plant/Entity.render(). A wall's
    // under_tile is movement data; Tile.render() doesn't draw it.
    let groundPng = null;
    if (def.class === 'Plant') groundPng = appearance && appearance.waterneeded > 0 && appearance.watermet ? 93 : 2;
    else if (def.class === 'Tile') {
        if (['bed', 'lamppost', 'compost_bucket', 'cart_s', 'bush', 'Veggie_Press', 'table', 'grinder', 'computer', 'Job Board'].includes(def.name)) groundPng = 0;
        else if (def.name === 'Flower_Done') groundPng = 1;
        else if (def.name === 'junk' || def.name === 'sprinkler') groundPng = 2;
        else if (def.name === 'compost_tile') groundPng = 3;
        else if (def.name.endsWith('_fence')) groundPng = 94;
    }
    const under = appearance && appearance.under_tile;
    if (under && (def.class !== 'Tile' || def.name === 'sprinkler')) {
        drawTile(ctx, tile_name_to_num(under.name), x, y, size, under, thumbnail);
    } else if (groundPng !== null) {
        const ground = mapSpriteDrawable(groundPng);
        if (ground) ctx.drawImage(ground, x, y, size, size);
    } else if (def.class !== 'Tile' && def.under_tile_num) {
        drawTile(ctx, def.under_tile_num, x, y, size, null, thumbnail);
    } else if (def.class === 'FarmRobot') {
        drawTile(ctx, 1, x, y, size, null, thumbnail);
    }
    const image = tileDrawable(num, appearance);
    if (image) {
        try {
            // Most sprites occupy one cell. Large sprites (e.g. the air ship)
            // use their native dimensions and anchor in the game world.
            const scale = size / (typeof tileSize === 'number' ? tileSize : 32);
            const width = thumbnail ? size : image.width * scale;
            const height = thumbnail ? size : image.height * scale;
            const centerX = x + (def.class === 'AirBallon' && !thumbnail ? 0 : size / 2);
            const centerY = y + (def.class === 'AirBallon' && !thumbnail ? -size / 2 : size / 2);
            ctx.drawImage(image, centerX - width / 2, centerY - height / 2, width, height);
            return;
        } catch (e) { /* fall through to placeholder */ }
    }
    ctx.fillStyle = def.collide ? '#6b5a48' : '#4e8a3a';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#fff';
    ctx.font = Math.floor(size / 2.4) + 'px monospace';
    ctx.fillText(String(def.name || '?').slice(0, 2), x + 2, y + size - 4);
}

function mapBaseNum(level, row, col) {
    const base = baseLevelMaps[level];
    if (base && base[row]) return base[row][col] || 0;
    const found = getLevelByName(level);
    const tile = found && found.level.map[row] && found.level.map[row][col];
    return tile && tile !== 0 && typeof tile_name_to_num === 'function' ? (tile_name_to_num(tile.name) || 0) : 0;
}

function mapCellNum(level, row, col) {
    const edits = mapEditsDraft[level];
    const key = row + ',' + col;
    return edits && edits[key] !== undefined ? edits[key] : mapBaseNum(level, row, col);
}

function setMapCell(row, col, num) {
    const level = mapEditorState.level;
    if (!level) return;
    const key = row + ',' + col;
    mapEditsDraft[level] = mapEditsDraft[level] || {};
    if (num === null || num === mapBaseNum(level, row, col)) delete mapEditsDraft[level][key];
    else mapEditsDraft[level][key] = num;
    if (!Object.keys(mapEditsDraft[level]).length) delete mapEditsDraft[level];
}

function buildMapEditor(section) {
    section.classList.add('config-map-section');
    const toolbar = cfgEl('div', 'config-inline-row config-map-toolbar');
    const levelSelect = cfgSelect(levelNameOptions());
    levelSelect.id = 'cfg-map-level';
    levelSelect.addEventListener('change', () => {
        mapEditorState.level = levelSelect.value;
        renderMapEditor();
    });
    toolbar.appendChild(cfgField('Area', levelSelect));

    const tools = cfgEl('div', 'config-chip-bar');
    tools.id = 'cfg-map-tools';
    [['paint', 'Paint'], ['pick', 'Pick'], ['restore', 'Restore']].forEach(([tool, label]) => {
        const chip = cfgButton(label, 'config-filter-chip', () => {
            mapEditorState.tool = tool;
            renderMapTools();
        });
        chip.dataset.tool = tool;
        chip.title = tool === 'paint' ? 'Click or drag to place the selected tile'
            : tool === 'pick' ? 'Click a tile on the map to select it (right-click also picks)'
            : 'Click or drag to put back the original tile';
        tools.appendChild(chip);
    });
    toolbar.appendChild(tools);
    toolbar.appendChild(cfgButton('Reset This Area', 'config-btn config-btn-small', () => {
        delete mapEditsDraft[mapEditorState.level];
        renderMapEditor();
    }));
    toolbar.appendChild(cfgButton('Clear All Map Edits', 'config-btn config-btn-small config-btn-danger', () => {
        if (!Object.keys(mapEditsDraft).length || window.confirm('Remove every map edit in every area?')) {
            mapEditsDraft = {};
            renderMapEditor();
        }
    }));
    section.appendChild(toolbar);

    const status = cfgEl('div', 'config-help');
    status.id = 'cfg-map-status';
    section.appendChild(status);

    const layout = cfgEl('div', 'config-map-layout');
    const canvasWrap = cfgEl('div', 'config-map-canvas-wrap');
    const canvas = cfgEl('canvas', 'config-map-canvas');
    canvas.id = 'cfg-map-canvas';
    canvas.width = MAP_COLS * MAP_CELL_PX;
    canvas.height = MAP_ROWS * MAP_CELL_PX;
    canvasWrap.appendChild(canvas);
    const hover = cfgEl('div', 'config-help config-map-hover', 'Hover a tile to see what it is.');
    hover.id = 'cfg-map-hover';
    canvasWrap.appendChild(hover);
    layout.appendChild(canvasWrap);

    const paletteWrap = cfgEl('div', 'config-map-palette-wrap');
    const selected = cfgEl('div', 'config-map-selected');
    selected.id = 'cfg-map-selected';
    paletteWrap.appendChild(selected);
    const search = cfgEl('input', 'config-input config-item-search');
    search.type = 'search';
    search.id = 'cfg-map-search';
    search.placeholder = 'Search tiles';
    search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        document.querySelectorAll('#cfg-map-palette .config-map-tile').forEach(btn => {
            btn.hidden = !!q && !btn.dataset.search.includes(q);
        });
    });
    paletteWrap.appendChild(search);
    const palette = cfgEl('div', 'config-map-palette');
    palette.id = 'cfg-map-palette';
    ruleTileDefinitions().forEach((def, index) => {
        if (!def || !def.name) return;
        const num = index + 1;
        const btn = cfgEl('button', 'config-map-tile');
        btn.type = 'button';
        btn.dataset.tileNum = String(num);
        btn.dataset.search = (def.name + ' ' + (def.class || '')).toLowerCase();
        btn.title = def.name + ' (' + (def.class || 'Tile') + ')';
        const thumb = cfgEl('canvas', 'config-map-thumb');
        thumb.width = 32;
        thumb.height = 32;
        btn.appendChild(thumb);
        btn.appendChild(cfgEl('span', 'config-map-tile-name', def.name.replace(/_/g, ' ')));
        btn.addEventListener('click', () => {
            mapEditorState.tile = num;
            mapEditorState.tool = 'paint';
            renderMapTools();
        });
        palette.appendChild(btn);
    });
    paletteWrap.appendChild(palette);
    layout.appendChild(paletteWrap);
    section.appendChild(layout);
    section.appendChild(cfgEl('div', 'config-help', 'Tip: the edges of each area connect to its neighbours. Keep a path open across the edges so you can still walk between areas.'));

    const cellAt = (event) => {
        const rect = canvas.getBoundingClientRect();
        const col = Math.floor((event.clientX - rect.left) / rect.width * MAP_COLS);
        const row = Math.floor((event.clientY - rect.top) / rect.height * MAP_ROWS);
        return (row >= 0 && col >= 0 && row < MAP_ROWS && col < MAP_COLS) ? { row, col } : null;
    };
    const apply = (cell, button) => {
        if (!cell || !mapEditorState.level) return;
        const tool = button === 2 ? 'pick' : mapEditorState.tool;
        if (tool === 'pick') {
            mapEditorState.tile = mapCellNum(mapEditorState.level, cell.row, cell.col) || mapEditorState.tile;
            mapEditorState.tool = 'paint';
            renderMapTools();
            return;
        }
        setMapCell(cell.row, cell.col, tool === 'restore' ? null : mapEditorState.tile);
        renderMapCanvas();
        renderMapStatus();
    };
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {
        e.preventDefault();
        mapEditorState.painting = e.button !== 2;
        if (canvas.setPointerCapture) {
            try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        }
        apply(cellAt(e), e.button);
    });
    canvas.addEventListener('pointermove', e => {
        const cell = cellAt(e);
        if (cell && mapEditorState.level) {
            const def = ruleTileDefinition(mapCellNum(mapEditorState.level, cell.row, cell.col));
            const edited = mapEditsDraft[mapEditorState.level] && mapEditsDraft[mapEditorState.level][cell.row + ',' + cell.col] !== undefined;
            hover.textContent = 'x ' + cell.col + ', y ' + cell.row + ': ' + (def ? def.name : 'empty') + (edited ? ' (edited)' : '');
        }
        if (mapEditorState.painting && mapEditorState.tool !== 'pick') apply(cell, 0);
    });
    const stop = () => { mapEditorState.painting = false; };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    canvas.addEventListener('pointerleave', stop);
}

function renderMapTools() {
    document.querySelectorAll('#cfg-map-tools .config-filter-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.tool === mapEditorState.tool);
    });
    document.querySelectorAll('#cfg-map-palette .config-map-tile').forEach(btn => {
        btn.classList.toggle('active', Number(btn.dataset.tileNum) === mapEditorState.tile);
    });
    const selected = document.getElementById('cfg-map-selected');
    const def = ruleTileDefinition(mapEditorState.tile);
    if (selected) selected.textContent = 'Painting with: ' + (def ? def.name.replace(/_/g, ' ') : 'nothing');
}

function renderMapThumbnails() {
    document.querySelectorAll('#cfg-map-palette .config-map-tile').forEach(btn => {
        const thumb = btn.querySelector('canvas');
        const ctx = thumb && thumb.getContext && thumb.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, 32, 32);
        drawTile(ctx, Number(btn.dataset.tileNum), 0, 0, 32, null, true);
    });
}

function renderMapCanvas() {
    const canvas = document.getElementById('cfg-map-canvas');
    const ctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgb(135, 206, 235)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const level = mapEditorState.level;
    if (!level) return;
    const edits = mapEditsDraft[level] || {};
    const appearance = baseLevelAppearance[level];
    const scale = MAP_CELL_PX / (typeof tileSize === 'number' ? tileSize : 32);
    const skyline = typeof background_img !== 'undefined' && (background_img.canvas || background_img.elt);
    if (skyline) ctx.drawImage(skyline, 0, 0, skyline.width * scale, skyline.height * scale);
    // The game draws the skyline, building/cloud scenery, then playable tiles.
    if (appearance) appearance.fore.forEach((row, r) => row.forEach((tile, c) => {
        if (!tile) return;
        const image = mapSpriteDrawable(tile.png, tile.variant);
        const x = c * MAP_CELL_PX;
        const y = r * MAP_CELL_PX;
        if (image) ctx.drawImage(image, x, y, image.width * scale, image.height * scale);
        if (tile.type === 2 || tile.type === 3) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(x, y, MAP_CELL_PX, MAP_CELL_PX);
        }
        if (tile.dim) {
            ctx.fillStyle = 'rgba(0, 0, 0, ' + tile.dim / 255 + ')';
            ctx.fillRect(x, y, MAP_CELL_PX, MAP_CELL_PX);
        }
    }));
    const canopies = [];
    for (let row = 0; row < MAP_ROWS; row++) {
        for (let col = 0; col < MAP_COLS; col++) {
            const num = mapCellNum(level, row, col);
            const original = appearance && appearance.map[row] && appearance.map[row][col];
            const tile = edits[row + ',' + col] === undefined ? original : null;
            const args = [ctx, num, col * MAP_CELL_PX, row * MAP_CELL_PX, MAP_CELL_PX, tile];
            if (ruleTileDefinition(num)?.name === 'tree_top') canopies.push(args);
            else if (num) drawTile(...args);
        }
    }
    canopies.forEach(args => drawTile(...args));
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 221, 114, 0.95)';
    Object.keys(edits).forEach(key => {
        const [row, col] = key.split(',').map(Number);
        ctx.strokeRect(col * MAP_CELL_PX + 1, row * MAP_CELL_PX + 1, MAP_CELL_PX - 2, MAP_CELL_PX - 2);
    });
}

function renderMapStatus() {
    const status = document.getElementById('cfg-map-status');
    if (!status) return;
    const here = Object.keys(mapEditsDraft[mapEditorState.level] || {}).length;
    const areas = Object.keys(mapEditsDraft).length;
    const total = Object.values(mapEditsDraft).reduce((sum, cells) => sum + Object.keys(cells).length, 0);
    status.textContent = here + ' tile' + (here === 1 ? '' : 's') + ' changed in this area; ' +
        total + ' in ' + areas + ' area' + (areas === 1 ? '' : 's') + ' overall. Edited tiles are outlined in gold.';
}

function renderMapEditor() {
    const levelSelect = document.getElementById('cfg-map-level');
    if (!levelSelect) return;
    if (!mapEditorState.level || !Array.from(levelSelect.options).some(o => o.value === mapEditorState.level)) {
        mapEditorState.level = levelSelect.options[0] ? levelSelect.options[0].value : '';
    }
    levelSelect.value = mapEditorState.level;
    renderMapTools();
    renderMapThumbnails();
    renderMapCanvas();
    renderMapStatus();
}
