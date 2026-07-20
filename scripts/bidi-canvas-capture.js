'use strict';

const endpoint = process.argv[2];
const targetUrl = process.argv[3];
const yaw = Number(process.argv[4] || 90);
const pending = new Map();
let nextId = 1;

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function primitive(response) {
    const value = response?.result?.result;
    return value && Object.prototype.hasOwnProperty.call(value, 'value') ? value.value : value;
}

async function main() {
    const socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => {
        socket.onopen = resolve;
        socket.onerror = () => reject(new Error('WebSocket connection failed'));
    });
    socket.onmessage = event => {
        const message = JSON.parse(event.data);
        if (!message.id || !pending.has(message.id)) return;
        const waiter = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.message || message.error));
        else waiter.resolve(message);
    };
    function send(method, params = {}) {
        const id = nextId++;
        socket.send(JSON.stringify({ id, method, params }));
        return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    }
    async function evaluate(expression, context) {
        return primitive(await send('script.evaluate', {
            expression,
            target: { context },
            awaitPromise: true,
            resultOwnership: 'none',
            userActivation: true
        }));
    }

    await send('session.new', { capabilities: { alwaysMatch: { acceptInsecureCerts: true } } });
    const tree = await send('browsingContext.getTree');
    const context = tree.result.contexts[0].context;
    await send('browsingContext.navigate', { context, url: targetUrl, wait: 'complete' });

    for (let attempt = 0; attempt < 30; attempt++) {
        await delay(500);
        const ready = await evaluate(`typeof player !== 'undefined' && !!player &&
            typeof webgl3DBuffer !== 'undefined' && !!webgl3DBuffer && frameCount > 2`, context);
        if (ready) break;
    }

    await evaluate(`(() => {
        window.__captureErrors = [];
        window.addEventListener('error', event => window.__captureErrors.push(String(event.error?.stack || event.message)));
        title_screen = false;
        dificulty_screen = false;
        lose_screen = false;
        paused = false;
        is3DMode = true;
        pointerLockEngaged = true;
        window.pointerLockEngaged = true;
        player.talking = 0;
        player.lookYawDeg = ${JSON.stringify(yaw)};
        player.facing = nearestCardinalFacingFromYaw(player.lookYawDeg);
        return true;
    })()`, context);
    await delay(1200);

    const result = JSON.parse(await evaluate(`JSON.stringify({
        image: document.getElementById('defaultCanvas0').toDataURL('image/png'),
        errors: window.__captureErrors,
        state: {
            frameCount, currentLevel_x, currentLevel_y, yaw: player.lookYawDeg,
            playerX: player.pos.x, playerY: player.pos.y,
            textureCount: webgl3DBuffer._renderer.textures.length,
            cacheWalls: webglRoomGeometryCache.walls.length,
            cacheFloors: webglRoomGeometryCache.floors.length
        }
    })`, context));
    process.stderr.write(`${JSON.stringify({ errors: result.errors, state: result.state })}\n`);
    process.stdout.write(result.image.slice('data:image/png;base64,'.length));

    await send('session.end');
    socket.close();
}

main().catch(error => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
