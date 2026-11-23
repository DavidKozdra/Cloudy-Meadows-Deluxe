// Independent right-thumb input: movement and actions keep their own touches.
var mobileLookInput = { x: 0, y: 0, pointerId: null };
var mobileLookStick = null;
var mobileLookKnob = null;

function canUseMobileLook() {
    return isMobile && is3DMode && !title_screen && !paused &&
        !dificulty_screen && !lose_screen && typeof player !== 'undefined' && player &&
        !player.dead && player.talking === 0 && !player.show_quests &&
        !(typeof mobileInventoryState !== 'undefined' && mobileInventoryState.isOpen) &&
        !(typeof isTutorialOverlayVisible === 'function' && isTutorialOverlayVisible()) &&
        !document.hidden;
}

function resetMobileLook() {
    const pointerId = mobileLookInput.pointerId;
    mobileLookInput.x = 0;
    mobileLookInput.y = 0;
    mobileLookInput.pointerId = null;
    if (!mobileLookStick) return;
    mobileLookStick.classList.remove('pressed');
    mobileLookKnob.style.transform = 'translate(-50%, -50%)';
    if (pointerId !== null && mobileLookStick.hasPointerCapture(pointerId)) {
        mobileLookStick.releasePointerCapture(pointerId);
    }
}

function setupMobileLook() {
    mobileLookStick = document.getElementById('mobile-look-stick');
    mobileLookKnob = document.getElementById('mobile-look-knob');
    if (!mobileLookStick || !mobileLookKnob || mobileLookStick.dataset.ready) return;
    mobileLookStick.dataset.ready = 'true';

    function moveStick(event) {
        if (event.pointerId !== mobileLookInput.pointerId) return;
        if (!canUseMobileLook()) {
            resetMobileLook();
            return;
        }
        event.preventDefault();
        const bounds = mobileLookStick.getBoundingClientRect();
        const radius = (bounds.width - mobileLookKnob.offsetWidth) / 2;
        if (radius <= 0) return;
        const dx = event.clientX - (bounds.left + bounds.width / 2);
        const dy = event.clientY - (bounds.top + bounds.height / 2);
        const distance = Math.hypot(dx, dy);
        const travel = Math.min(distance, radius);
        const x = distance > 0 ? dx / distance : 0;
        const y = distance > 0 ? dy / distance : 0;
        // A small dead zone prevents drift, then speed increases to the rim.
        const strength = Math.max(0, (travel / radius - 0.15) / 0.85);
        mobileLookInput.x = x * strength;
        mobileLookInput.y = y * strength;
        mobileLookKnob.style.transform = `translate(calc(-50% + ${x * travel}px), calc(-50% + ${y * travel}px))`;
    }

    mobileLookStick.addEventListener('pointerdown', event => {
        if (!canUseMobileLook() || mobileLookInput.pointerId !== null || event.button !== 0) return;
        event.preventDefault();
        mobileLookInput.pointerId = event.pointerId;
        mobileLookStick.setPointerCapture(event.pointerId);
        mobileLookStick.classList.add('pressed');
        moveStick(event);
    });
    mobileLookStick.addEventListener('pointermove', moveStick);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        mobileLookStick.addEventListener(type, event => {
            if (event.pointerId === mobileLookInput.pointerId) resetMobileLook();
        });
    }
    window.addEventListener('blur', resetMobileLook);
    window.addEventListener('resize', resetMobileLook);
    document.addEventListener('visibilitychange', resetMobileLook);
}

function updateMobileLook(elapsedMs) {
    const enabled = !!canUseMobileLook();
    if (mobileLookStick) mobileLookStick.hidden = !enabled;
    const controls = document.getElementById('mobile-controls');
    if (controls) controls.classList.toggle('look-enabled', enabled);
    if (!enabled) {
        if (mobileLookInput.pointerId !== null) resetMobileLook();
        return;
    }
    if (mobileLookInput.x === 0 && mobileLookInput.y === 0) return;
    // Cap long frames so resuming a suspended tab cannot snap the camera.
    const seconds = Math.min(Math.max(elapsedMs || 0, 0), 50) / 1000;
    const yaw = Number.isFinite(player.lookYawDeg) ? player.lookYawDeg : FACING_TO_YAW_DEG[player.facing];
    player.lookYawDeg = normalizeAngleDeg0to360(yaw + mobileLookInput.x * 150 * seconds);
    player.lookPitchDeg = Math.max(-60, Math.min(60,
        (player.lookPitchDeg || 0) - mobileLookInput.y * 100 * seconds));
    player.facing = nearestCardinalFacingFromYaw(player.lookYawDeg);
}
