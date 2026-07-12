const I18N_LANGUAGES = [
    { code: 'system', label: 'System Default' },
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Spanish' },
    { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' },
    { code: 'pt', label: 'Portuguese' },
    { code: 'ja', label: 'Japanese' }
];

const I18N_STORAGE_KEY = 'cloudy_meadows_language';
let i18nLanguagePreference = 'system';
let i18nCurrentLanguage = 'en';
let i18nCatalog = {};

function i18nNormalizeLanguage(code) {
    return I18N_LANGUAGES.some(lang => lang.code === code) ? code : 'system';
}

function i18nSystemLanguage() {
    const browserLang = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return I18N_LANGUAGES.some(lang => lang.code === browserLang) ? browserLang : 'en';
}

function i18nResolveLanguagePreference(code) {
    return code === 'system' ? i18nSystemLanguage() : i18nNormalizeLanguage(code);
}

function i18nLoadSavedLanguage() {
    try {
        const saved = localStorage.getItem(I18N_STORAGE_KEY);
        if (saved) return i18nNormalizeLanguage(saved);
    } catch (e) {
        // Ignore blocked localStorage and use English.
    }
    return 'system';
}

function i18nSetLanguage(code) {
    i18nLanguagePreference = i18nNormalizeLanguage(code);
    i18nCurrentLanguage = i18nResolveLanguagePreference(i18nLanguagePreference);
    try {
        localStorage.setItem(I18N_STORAGE_KEY, i18nLanguagePreference);
    } catch (e) {
        // Language still changes for this session.
    }
    i18nApplyDocumentText();
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: i18nCurrentLanguage } }));
}

function i18nRegisterCatalog(code, catalog) {
    if (!catalog || !catalog.translations) return;
    i18nCatalog[code] = catalog.translations;
}

function i18nPreload() {
    i18nLanguagePreference = i18nLoadSavedLanguage();
    i18nCurrentLanguage = i18nResolveLanguagePreference(i18nLanguagePreference);
    for (const lang of I18N_LANGUAGES) {
        if (lang.code === 'system' || lang.code === 'en') continue;
        loadJSON(
            'i18n/' + lang.code + '.json',
            data => i18nRegisterCatalog(lang.code, data),
            () => console.warn('Missing i18n catalog:', lang.code)
        );
    }
}

function t(text, vars) {
    if (text === undefined || text === null) return '';
    const source = String(text);
    const catalog = i18nCatalog[i18nCurrentLanguage] || {};
    let translated = catalog[source] || source;
    if (vars) {
        Object.keys(vars).forEach(key => {
            translated = translated.replaceAll('{' + key + '}', vars[key]);
        });
    }
    return translated;
}

function tItem(name) {
    return t(name);
}

function tQuestName(name) {
    if (!name) return '';
    const timed = String(name).match(/^(.*) (\d+) days left$/);
    if (timed) {
        return t('{quest} {days} days left', {
            quest: t(timed[1]),
            days: timed[2]
        });
    }
    return t(name);
}

function tGoal(goal) {
    if (!goal) return '';
    if (goal.class === 'TalkingGoal') {
        const requires = goal.required_location ? ' ' + t('after visiting') + ' ' + t(goal.required_location) : '';
        if (goal.item_name && goal.item_name !== 0) {
            return goal.receive_type
                ? t('Get') + ' ' + goal.amount + ' ' + tItem(goal.item_name) + ' ' + t('from') + ' ' + t(goal.npc_name) + requires
                : t('Give') + ' ' + goal.amount + ' ' + tItem(goal.item_name) + ' ' + t('to') + ' ' + t(goal.npc_name) + requires;
        }
        return t('Talk to') + ' ' + t(goal.npc_name) + requires;
    }
    if (goal.class === 'TellGoal') return t('Tell') + ' ' + t(goal.npc_name) + ': "' + t(goal.reply_phrase) + '"';
    if (goal.class === 'FundingGoal') return t('Get') + ' ' + goal.amount + ' ' + t('more coins');
    if (goal.class === 'LocationGoal') return t('Go to') + ' ' + t(goal.level_name);
    if (goal.class === 'SellGoal') return t('Sell') + ' ' + goal.amount + ' ' + t('more of') + ' ' + tItem(goal.item_name);
    if (goal.class === 'HaveGoal') return t('Have') + ' ' + goal.amount + ' ' + t('of') + ' ' + tItem(goal.item_name);
    if (goal.class === 'OneTileCheck') return t('Make') + ' x:' + goal.x + ' y:' + goal.y + ' ' + t('into') + ' ' + t(goal.tile_name) + ' ' + t('at') + ' ' + t(goal.level_name) + ' ' + t('instead of') + ' ' + t(goal.oldTileName || 'Rock');
    return t(goal.name);
}

function i18nApplyDocumentText() {
    document.documentElement.lang = i18nCurrentLanguage;
    document.title = t('Cloudy Meadows: Deluxe Edition');
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const prefix = el.getAttribute('data-i18n-prefix') || '';
        const suffix = el.getAttribute('data-i18n-suffix') || '';
        el.textContent = prefix + t(el.getAttribute('data-i18n')) + suffix;
    });
    document.querySelectorAll('[data-i18n-alt]').forEach(el => {
        el.alt = t(el.getAttribute('data-i18n-alt'));
    });
}

function createLanguageSelect(className) {
    const select = document.createElement('select');
    select.className = className || 'language-select';
    select.setAttribute('aria-label', t('Language'));
    for (const lang of I18N_LANGUAGES) {
        const option = document.createElement('option');
        option.value = lang.code;
        option.textContent = t(lang.label);
        option.selected = lang.code === i18nLanguagePreference;
        select.appendChild(option);
    }
    select.addEventListener('change', () => i18nSetLanguage(select.value));
    window.addEventListener('languageChanged', () => {
        select.value = i18nLanguagePreference;
        select.setAttribute('aria-label', t('Language'));
        Array.from(select.options).forEach(option => {
            const lang = I18N_LANGUAGES.find(item => item.code === option.value);
            option.textContent = t(lang.label);
        });
    });
    return select;
}

i18nLanguagePreference = i18nLoadSavedLanguage();
i18nCurrentLanguage = i18nResolveLanguagePreference(i18nLanguagePreference);
