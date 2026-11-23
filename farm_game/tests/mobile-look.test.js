'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readPublic, extractFunction } = require('./support/load');

function makeControls() {
    const events = new Map();
    const captures = new Set();
    const knob = { offsetWidth: 44, style: {} };
    const stick = {
        dataset: {}, classList: { add() {}, remove() {} },
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
        addEventListener: (type, fn) => events.set(type, fn),
        setPointerCapture: id => captures.add(id),
        hasPointerCapture: id => captures.has(id),
        releasePointerCapture: id => captures.delete(id)
    };
    const sandbox = {
        isMobile: true, is3DMode: true, title_screen: false, paused: false,
        dificulty_screen: false, lose_screen: false,
        player: { lookYawDeg: 0, facing: 1, talking: 0 },
        window: { addEventListener: (type, fn) => events.set(type, fn) },
        document: {
            hidden: false,
            addEventListener: (type, fn) => events.set(type, fn),
            getElementById: id => id === 'mobile-look-stick' ? stick : id === 'mobile-look-knob' ? knob : null
        }
    };
    vm.runInNewContext(readPublic('classes/raycaster3d.js') + '\n' + readPublic('mobile-look.js'), sandbox);
    sandbox.setupMobileLook();
    const send = (type, x, y, pointerId = 1) => events.get(type)({
        clientX: x, clientY: y, pointerId, button: 0, preventDefault() {}
    });
    return { sandbox, send, captures, stick };
}

test('camera stick has a dead zone and turns continuously while held independently of movement', () => {
    const { sandbox: s, send } = makeControls();
    send('pointerdown', 52, 50);
    s.updateMobileLook(20);
    assert.equal(s.player.lookYawDeg, 0);
    send('pointermove', 100, 50);
    for (let i = 0; i < 50; i++) s.updateMobileLook(20);
    assert.equal(s.player.lookYawDeg, 150);
    assert.equal(s.player.facing, 3, 'interactions follow the camera heading');
    send('pointerup', 100, 50);
    s.updateMobileLook(20);
    assert.equal(s.player.lookYawDeg, 150, 'release stops camera motion');
});

test('a movement finger cannot replace or release the camera finger; cancellation releases capture', () => {
    const { sandbox: s, send, captures } = makeControls();
    send('pointerdown', 90, 50, 2);
    send('pointerdown', 10, 50, 3);
    send('pointerup', 10, 50, 3);
    assert.equal(s.mobileLookInput.pointerId, 2);
    assert.equal(s.mobileLookInput.x, 1);
    assert.ok(captures.has(2));
    send('pointercancel', 90, 50, 2);
    assert.equal(s.mobileLookInput.pointerId, null);
    assert.equal(s.mobileLookInput.x, 0);
    assert.equal(captures.size, 0);
});

test('vertical look is clamped and long frames cannot snap the view', () => {
    const { sandbox: s, send } = makeControls();
    send('pointerdown', 50, 0);
    s.updateMobileLook(10000);
    assert.equal(s.player.lookPitchDeg, 5);
    for (let i = 0; i < 100; i++) s.updateMobileLook(20);
    assert.equal(s.player.lookPitchDeg, 60);
    send('pointermove', 50, 100);
    for (let i = 0; i < 100; i++) s.updateMobileLook(20);
    assert.equal(s.player.lookPitchDeg, -60);
});

test('menus, 2D mode, lost focus, and rotation cancel held camera input', () => {
    for (const stop of [
        s => s.paused = true,
        s => s.title_screen = true,
        s => s.is3DMode = false,
        s => s.isMobile = false,
        s => s.player.talking = {},
        s => s.player.show_quests = true,
        s => s.mobileInventoryState = { isOpen: true },
        s => s.isTutorialOverlayVisible = () => true,
        s => s.document.hidden = true
    ]) {
        const { sandbox: s, send, stick } = makeControls();
        send('pointerdown', 100, 50);
        stop(s);
        s.updateMobileLook(20);
        assert.equal(s.mobileLookInput.pointerId, null);
        assert.equal(s.player.lookYawDeg, 0);
        assert.equal(stick.hidden, true);
    }
    for (const event of ['blur', 'resize', 'visibilitychange', 'lostpointercapture']) {
        const { sandbox: s, send } = makeControls();
        send('pointerdown', 100, 50);
        send(event, 100, 50);
        assert.equal(s.mobileLookInput.pointerId, null, event);
        assert.equal(s.mobileLookInput.x, 0, event);
    }
});

test('camera rendering applies mobile pitch while preserving desktop level look', () => {
    const s = { isMobile: true, tileSize: 32, canvasWidth: 800, canvasHeight: 400,
        getActiveCameraYawDeg: () => 90,
        WEBGL_WALL_HEIGHT_TILES: 1, WEBGL_FOV_DEGREES: 66,
        three3DCamera: { position: { set() {} }, updateProjectionMatrix() {}, updateMatrixWorld() {},
            lookAt(x, y, z) { this.target = { x, y, z }; } }
    };
    vm.runInNewContext(extractFunction(readPublic('classes/raycaster3d.js'), 'configureThreePlayerCamera'), s);
    const player = { pos: { x: 0, y: 0 }, lookPitchDeg: 30 };
    s.configureThreePlayerCamera(player, { map: [[0]] });
    assert.ok(Math.abs(s.three3DCamera.target.y - 16.5) < 1e-9);
    s.isMobile = false;
    s.configureThreePlayerCamera(player, { map: [[0]] });
    assert.equal(s.three3DCamera.target.y, 16);
});
