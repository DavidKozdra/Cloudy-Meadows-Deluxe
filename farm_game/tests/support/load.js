'use strict';

// Shared source loading for the game's browser-global class files.
//
// The game ships as a set of plain <script> files that declare classes and
// functions on the global scope (no module system). To exercise them under
// node:test we read the source and evaluate it in the current context after
// the mock globals are installed. This module centralizes the file reading,
// path resolution, and the two extraction helpers the suites need, so the
// individual test files stay declarative and a refactor only has to be fixed
// in one place.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const publicDir = path.resolve(__dirname, '../../public');

function publicPath(relativePath) {
    return path.join(publicDir, relativePath);
}

function readPublic(relativePath) {
    return fs.readFileSync(publicPath(relativePath), 'utf8');
}

// Evaluate one or more public source files in the current global context and
// return the named globals they declare. `names` is the list of class/function
// identifiers to hand back (also copied onto globalThis so later files that
// reference them by bare name resolve). Pass a single string or an array of
// relative paths for `files`.
function loadClasses(files, names) {
    const list = Array.isArray(files) ? files : [files];
    const source = list.map(readPublic).join('\n');
    const exportList = names.map(name => `${name}: typeof ${name} !== 'undefined' ? ${name} : undefined`).join(', ');
    vm.runInThisContext(`${source}\nObject.assign(globalThis, { ${exportList} });`);
    const exported = {};
    for (const name of names) {
        assert.ok(globalThis[name] !== undefined, `expected ${name} to be defined after loading ${list.join(', ')}`);
        exported[name] = globalThis[name];
    }
    return exported;
}

// Read a top-level `const NAME = <literal>` (or `var`/`let`) config array/object
// out of a data file in isolation and return a deep, plain-JS clone. Used for
// config/items.js and config/tiles.js which are large literal definitions.
function loadDefinition(relativePath, variableName, sandbox = {}) {
    const source = readPublic(relativePath);
    const context = { ...sandbox };
    vm.runInNewContext(`${source}\nglobalThis.__result = ${variableName};`, context, { filename: publicPath(relativePath) });
    return JSON.parse(JSON.stringify(context.__result));
}

// Walk a brace-matched region starting at `openChar` to find its matching
// close, respecting string literals. Returns the index just past the close.
function matchDelimited(source, start, openChar, closeChar) {
    let depth = 0;
    let quote = null;
    let escaped = false;
    for (let index = start; index < source.length; index++) {
        const char = source[index];
        if (quote) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === quote) quote = null;
            continue;
        }
        if (char === '"' || char === "'" || char === '`') {
            quote = char;
            continue;
        }
        if (char === openChar) depth += 1;
        else if (char === closeChar) {
            depth -= 1;
            if (depth === 0) return index + 1;
        }
    }
    throw new Error(`Unterminated ${openChar}${closeChar} region from index ${start}`);
}

// Extract the array literal that begins at or after `offset` and evaluate it.
// Returns { value, end } where `end` is the index just past the closing ']'.
function extractArray(source, offset, sandbox = {}) {
    const start = source.indexOf('[', offset);
    assert.notEqual(start, -1, 'Expected an array literal');
    const end = matchDelimited(source, start, '[', ']');
    const literal = source.slice(start, end);
    const value = vm.runInNewContext(`(${literal})`, sandbox);
    return { value: JSON.parse(JSON.stringify(value)), end };
}

// Extract a named top-level `function NAME(...) {...}` declaration as source
// text, so a handful of helpers can be evaluated without dragging in the whole
// (browser-coupled) file they live in.
function extractFunction(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `Missing function ${name}`);
    const bodyStart = source.indexOf('{', start);
    const end = matchDelimited(source, bodyStart, '{', '}');
    return source.slice(start, end);
}

module.exports = {
    publicDir,
    publicPath,
    readPublic,
    loadClasses,
    loadDefinition,
    extractArray,
    extractFunction,
    matchDelimited
};
