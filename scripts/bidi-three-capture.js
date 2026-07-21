'use strict';

const endpoint = process.argv[2];
const targetUrl = process.argv[3];
const pending = new Map();
let nextId = 1;

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function primitive(response) {
    const result = response?.result?.result;
    return result && Object.prototype.hasOwnProperty.call(result, 'value') ? result.value : result;
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
        const response = await send('script.evaluate', {
            expression,
            target: { context },
            awaitPromise: true,
            resultOwnership: 'none',
            userActivation: true
        });
        const result = response?.result?.result;
        if (result?.type === 'exception') {
            throw new Error(result.exceptionDetails?.text || 'Page script exception');
        }
        return primitive(response);
    }

    await send('session.new', { capabilities: { alwaysMatch: { acceptInsecureCerts: true } } });
    const tree = await send('browsingContext.getTree');
    const context = tree.result.contexts[0].context;
    await send('browsingContext.navigate', { context, url: targetUrl, wait: 'complete' });

    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
        await delay(250);
        ready = await evaluate(`typeof player !== 'undefined' && !!player &&
            typeof THREE !== 'undefined' && typeof three3DRenderer !== 'undefined' &&
            !!three3DRenderer && frameCount > 2`, context);
        if (ready) break;
    }
    if (!ready) {
        throw new Error(await evaluate(`JSON.stringify({
            player: typeof player,
            THREE: typeof THREE,
            renderer: typeof three3DRenderer,
            frameCount: typeof frameCount === 'number' ? frameCount : null
        })`, context));
    }

    await evaluate(`(() => {
        window.__captureErrors = [];
        window.addEventListener('error', event => {
            window.__captureErrors.push(String(event.error?.stack || event.message));
        });
        title_screen = false;
        dificulty_screen = false;
        lose_screen = false;
        paused = false;
        is3DMode = true;
        pointerLockEngaged = true;
        time = 0;
        timeSpeed = 0;
        player.hunger = maxHunger;
        player.talking = 0;
    })()`, context);

    const scenes = [
        { label: 'home-east', levelX: 4, levelY: 1, x: 5, y: 5, yaw: 0 },
        { label: 'home-south', levelX: 4, levelY: 1, x: 5, y: 5, yaw: 90 },
        { label: 'home-west', levelX: 4, levelY: 1, x: 5, y: 5, yaw: 180 },
        { label: 'outdoor-east', levelX: 3, levelY: 0, x: 11, y: 9, yaw: 0 },
        { label: 'outdoor-south', levelX: 3, levelY: 0, x: 11, y: 9, yaw: 90 },
        { label: 'outdoor-west', levelX: 3, levelY: 0, x: 11, y: 9, yaw: 180 }
    ];
    const frames = [];
    for (const scene of scenes) {
        await evaluate(`(() => {
            const scene = ${JSON.stringify(scene)};
            currentLevel_x = scene.levelX;
            currentLevel_y = scene.levelY;
            player.pos.x = scene.x * tileSize;
            player.pos.y = scene.y * tileSize;
            player.lookYawDeg = scene.yaw;
            player.facing = nearestCardinalFacingFromYaw(scene.yaw);
        })()`, context);
        await delay(350);
        frames.push(JSON.parse(await evaluate(`JSON.stringify({
            label: ${JSON.stringify(scene.label)},
            image: document.getElementById('defaultCanvas0').toDataURL('image/png'),
            renderer: {
                calls: three3DRenderer.info.render.calls,
                triangles: three3DRenderer.info.render.triangles,
                geometries: three3DRenderer.info.memory.geometries,
                textures: three3DRenderer.info.memory.textures
            }
        })`, context)));
    }

    const stability = JSON.parse(await evaluate(`(async () => {
        currentLevel_x = 3;
        currentLevel_y = 0;
        player.pos.x = 11 * tileSize;
        player.pos.y = 9 * tileSize;
        const before = {
            geometries: three3DRenderer.info.memory.geometries,
            textures: three3DRenderer.info.memory.textures
        };
        for (let yaw = 0; yaw < 360; yaw += 6) {
            player.lookYawDeg = yaw;
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
        return JSON.stringify({
            before,
            after: {
                geometries: three3DRenderer.info.memory.geometries,
                textures: three3DRenderer.info.memory.textures
            },
            image: document.getElementById('defaultCanvas0').toDataURL('image/png')
        });
    })()`, context));

    const errors = JSON.parse(await evaluate('JSON.stringify(window.__captureErrors)', context));
    process.stdout.write(JSON.stringify({ frames, stability, errors }));
    await send('session.end');
    socket.close();
}

main().catch(error => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
