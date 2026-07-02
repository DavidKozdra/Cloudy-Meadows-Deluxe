const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const result = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
    cwd: root,
    encoding: 'utf8'
});

if (result.status !== 0) {
    const message = (result.stderr || result.stdout || '').trim();
    console.error(`Unable to configure Git hooks${message ? `: ${message}` : '.'}`);
    process.exit(result.status || 1);
}

console.log('Git hooks configured from .githooks/');
