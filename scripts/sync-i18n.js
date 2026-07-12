const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'farm_game', 'public');
const localeDir = path.join(publicDir, 'i18n');
const languages = ['es', 'fr', 'de', 'pt', 'ja'];
const languageNames = {
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    pt: 'Portuguese',
    ja: 'Japanese'
};

const commonTranslations = {
    es: {
        'System Default': 'Sistema',
        'Continue': 'Continuar',
        'Choose the language for dialogue, menus, quests, items, and HUD text.': 'Elige el idioma para dialogos, menus, misiones, objetos y texto del HUD.'
    },
    fr: {
        'System Default': 'Systeme',
        'Continue': 'Continuer',
        'Choose the language for dialogue, menus, quests, items, and HUD text.': 'Choisissez la langue des dialogues, menus, quetes, objets et textes du HUD.'
    },
    de: {
        'System Default': 'Systemstandard',
        'Continue': 'Fortsetzen',
        'Choose the language for dialogue, menus, quests, items, and HUD text.': 'Waehle die Sprache fuer Dialoge, Menues, Quests, Gegenstaende und HUD-Text.'
    },
    pt: {
        'System Default': 'Padrao do sistema',
        'Continue': 'Continuar',
        'Choose the language for dialogue, menus, quests, items, and HUD text.': 'Escolha o idioma de dialogos, menus, missoes, itens e texto do HUD.'
    },
    ja: {
        'System Default': 'システム既定',
        'Continue': '続ける',
        'Choose the language for dialogue, menus, quests, items, and HUD text.': '会話、メニュー、クエスト、アイテム、HUDの言語を選びます。'
    }
};

const shouldTranslate = process.argv.includes('--translate') || process.env.I18N_AUTO_TRANSLATE === '1';
const translateDelimiter = '<CM_I18N_SPLIT>';

function addKey(keys, value) {
    if (typeof value === 'string' && value.trim()) keys.add(value);
}

function walkDialogue(value, keys) {
    if (!value) return;
    if (Array.isArray(value)) {
        value.forEach(item => walkDialogue(item, keys));
        return;
    }
    if (typeof value !== 'object') return;
    if (typeof value.phrase === 'string') addKey(keys, value.phrase);
    if (value.quest) {
        addKey(keys, value.quest.name);
        walkDialogue(value.quest.goals, keys);
    }
    Object.values(value).forEach(item => walkDialogue(item, keys));
}

function extractSourceKeys(keys) {
    const files = fs.readdirSync(publicDir, { recursive: true })
        .filter(file => /\.(js|html)$/.test(file))
        .filter(file => !file.includes('localDataStorage') && !file.includes('node_modules'));

    for (const file of files) {
        const source = fs.readFileSync(path.join(publicDir, file), 'utf8');
        for (const match of source.matchAll(/\bt(?:Item|QuestName|Goal)?\(\s*(['"`])((?:\\.|(?!\1).)*?)\1/g)) {
            addKey(keys, match[2].replace(/\\(['"`\\])/g, '$1'));
        }
        for (const match of source.matchAll(/data-i18n(?:-alt)?=["']([^"']+)["']/g)) {
            addKey(keys, match[1]);
        }

        if (file === 'miscfunctions.js') {
            extractTutorialKeys(source, keys);
        }
    }
}

function extractTutorialKeys(source, keys) {
    const start = source.indexOf('function buildFullTutorialPrompt');
    const end = source.indexOf('function buildTutorialPrompt');
    if (start < 0 || end < 0 || end <= start) return;

    const tutorialSource = source.slice(start, end);
    const textProps = new Set([
        'title',
        'intro',
        'label',
        'navHint',
        'eyebrow',
        'description',
        'alt',
        'location',
        'action',
        'detail'
    ]);

    for (const match of tutorialSource.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(['"`])((?:\\.|(?!\2).)*?)\2/g)) {
        if (textProps.has(match[1])) addKey(keys, match[3].replace(/\\(['"`\\])/g, '$1'));
    }

    for (const match of tutorialSource.matchAll(/(['"`])((?:\\.|(?!\1).)*?[A-Za-z][^'"`]*?)\1/g)) {
        const text = match[2].replace(/\\(['"`\\])/g, '$1');
        if (
            text.includes('/') ||
            text.endsWith('.png') ||
            /^[a-z0-9_-]+$/.test(text) ||
            text.startsWith('tutorial-') ||
            text.startsWith('full-tutorial') ||
            text.startsWith('mr-c-')
        ) {
            continue;
        }
        addKey(keys, text);
    }
}

function extractContentKeys() {
    const keys = new Set();
    const dialogue = JSON.parse(fs.readFileSync(path.join(publicDir, 'dialouge_list.json'), 'utf8'));
    walkDialogue(dialogue, keys);

    const itemSource = fs.readFileSync(path.join(publicDir, 'config', 'items.js'), 'utf8');
    for (const match of itemSource.matchAll(/name:\s*'([^']+)'/g)) {
        addKey(keys, match[1]);
    }

    extractSourceKeys(keys);
    return Array.from(keys).sort((a, b) => a.localeCompare(b));
}

async function translateChunk(texts, lang) {
    const joined = texts.join(`\n${translateDelimiter}\n`);
    const params = new URLSearchParams({
        client: 'gtx',
        sl: 'en',
        tl: lang,
        dt: 't',
        q: joined
    });
    const response = await fetch('https://translate.googleapis.com/translate_a/single?' + params.toString());
    if (!response.ok) {
        throw new Error(`translate ${lang} failed: ${response.status} ${response.statusText}`);
    }
    const payload = await response.json();
    const translated = (payload[0] || []).map(part => part[0]).join('').trim();
    const parts = translated.split(translateDelimiter).map(part => part.trim());
    if (parts.length !== texts.length) {
        throw new Error(`translate ${lang} returned ${parts.length} entries for ${texts.length} source entries`);
    }
    return parts;
}

function makeTranslationChunks(texts) {
    const chunks = [];
    let current = [];
    let size = 0;
    for (const text of texts) {
        const nextSize = size + text.length + translateDelimiter.length + 2;
        if (current.length && nextSize > 3000) {
            chunks.push(current);
            current = [];
            size = 0;
        }
        current.push(text);
        size += text.length + translateDelimiter.length + 2;
    }
    if (current.length) chunks.push(current);
    return chunks;
}

async function autoTranslateMissing(lang, translations, keys) {
    if (!shouldTranslate) return;
    const manual = commonTranslations[lang] || {};
    const missing = keys.filter(key => {
        if (manual[key]) return false;
        const value = translations[key];
        return !value || value === key;
    });
    if (!missing.length) return;

    const chunks = makeTranslationChunks(missing);
    let translatedCount = 0;
    for (const chunk of chunks) {
        const translated = await translateChunk(chunk, lang);
        chunk.forEach((key, index) => {
            translations[key] = translated[index] || key;
            translatedCount++;
        });
    }
    console.log(`translated ${translatedCount} ${lang} entries`);
}

async function syncLocale(lang, keys) {
    const file = path.join(localeDir, `${lang}.json`);
    const existing = fs.existsSync(file)
        ? JSON.parse(fs.readFileSync(file, 'utf8'))
        : { language: languageNames[lang], translations: {} };
    const translations = existing.translations || {};
    const manual = commonTranslations[lang] || {};

    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(translations, key)) {
            translations[key] = manual[key] || key;
        }
    }

    await autoTranslateMissing(lang, translations, keys);

    const sorted = {};
    for (const key of Object.keys(translations).sort((a, b) => a.localeCompare(b))) {
        sorted[key] = translations[key];
    }

    fs.writeFileSync(file, JSON.stringify({
        language: existing.language || languageNames[lang],
        translations: sorted
    }, null, 2) + '\n');
}

async function main() {
    const keys = extractContentKeys();
    fs.mkdirSync(localeDir, { recursive: true });
    for (const lang of languages) {
        await syncLocale(lang, keys);
    }
    console.log(`i18n catalogs synced: ${keys.length} keys`);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
