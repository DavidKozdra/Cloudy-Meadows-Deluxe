/*
@authors: Whole
@brief: Xbox / standard-mapping gamepad support.

    Drives the existing `virtualInput` abstraction (the same one mobile touch
    controls use) so no gameplay call-sites need to change. Continuous inputs
    (movement, held actions) set virtualInput flags; discrete inputs (pause,
    quests, hotbar cycling, title/difficulty/lose-screen confirm) are
    edge-triggered here, mirroring what the on-screen mobile buttons do.

    Uses the W3C "standard" gamepad mapping that Xbox controllers report under
    Chrome/Firefox/Edge:
        buttons[0] A          buttons[1] B
        buttons[2] X          buttons[3] Y
        buttons[4] LB         buttons[5] RB
        buttons[6] LT         buttons[7] RT
        buttons[8] Back/View  buttons[9] Start/Menu
        buttons[10] L-stick   buttons[11] R-stick
        buttons[12] D-up      buttons[13] D-down
        buttons[14] D-left    buttons[15] D-right
        axes[0] L-stick X     axes[1] L-stick Y
*/

// Standard-mapping button indices.
const GP_BUTTON = {
    A: 0,
    B: 1,
    X: 2,
    Y: 3,
    LB: 4,
    RB: 5,
    LT: 6,
    RT: 7,
    BACK: 8,
    START: 9,
    DPAD_UP: 12,
    DPAD_DOWN: 13,
    DPAD_LEFT: 14,
    DPAD_RIGHT: 15
};

// Dead zone for analog sticks/triggers so a resting stick doesn't drift.
const GP_STICK_DEADZONE = 0.35;
const GP_TRIGGER_THRESHOLD = 0.5;

// True while at least one gamepad is connected. Other code can read this.
var gamepadConnected = false;

// Tracks the pressed/not-pressed state of each button from the previous frame
// so we can detect rising edges ("just pressed") for discrete actions.
var gp_prevButtons = {};

window.addEventListener('gamepadconnected', (e) => {
    gamepadConnected = true;
    console.log('Gamepad connected:', e.gamepad.id, '(index ' + e.gamepad.index + ')');
});

window.addEventListener('gamepaddisconnected', (e) => {
    console.log('Gamepad disconnected:', e.gamepad.id);
    // Recompute connection state in case other pads remain.
    gamepadConnected = getActiveGamepad() != null;
    if (!gamepadConnected) {
        // Release any virtual inputs the pad was holding.
        clearGamepadVirtualInput();
    }
});

// Returns the first connected gamepad, or null. getGamepads() must be called
// fresh every frame; the returned objects are snapshots, not live references.
function getActiveGamepad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) return pads[i];
    }
    return null;
}

// Reset only the continuous virtualInput flags this module controls.
function clearGamepadVirtualInput() {
    virtualInput.up = false;
    virtualInput.down = false;
    virtualInput.left = false;
    virtualInput.right = false;
    virtualInput.interact = false;
    virtualInput.eat = false;
    virtualInput.special = false;
    virtualInput.pause = false;
}

// True if a button index is pressed this frame.
function gp_pressed(pad, index) {
    const b = pad.buttons[index];
    if (!b) return false;
    // Some buttons report analog "value"; treat anything past the trigger
    // threshold (or a digital .pressed) as down.
    return b.pressed || b.value > GP_TRIGGER_THRESHOLD;
}

// Rising edge: pressed now, not pressed last frame.
function gp_justPressed(pad, index) {
    const now = gp_pressed(pad, index);
    const was = gp_prevButtons[index] === true;
    return now && !was;
}

// Main per-frame poll. Called from draw() every frame, before takeInput().
function pollGamepad() {
    const pad = getActiveGamepad();
    if (!pad) {
        gamepadConnected = false;
        return;
    }
    gamepadConnected = true;

    // ---- Continuous: movement from left stick + D-pad ----
    const lx = pad.axes[0] || 0;
    const ly = pad.axes[1] || 0;

    virtualInput.left = lx < -GP_STICK_DEADZONE || gp_pressed(pad, GP_BUTTON.DPAD_LEFT);
    virtualInput.right = lx > GP_STICK_DEADZONE || gp_pressed(pad, GP_BUTTON.DPAD_RIGHT);
    virtualInput.up = ly < -GP_STICK_DEADZONE || gp_pressed(pad, GP_BUTTON.DPAD_UP);
    virtualInput.down = ly > GP_STICK_DEADZONE || gp_pressed(pad, GP_BUTTON.DPAD_DOWN);

    // ---- Continuous: held actions ----
    // A = interact (water/plant/use), X = eat, RT/LT or B = special.
    virtualInput.interact = gp_pressed(pad, GP_BUTTON.A);
    virtualInput.eat = gp_pressed(pad, GP_BUTTON.X);
    virtualInput.special = gp_pressed(pad, GP_BUTTON.B)
        || gp_pressed(pad, GP_BUTTON.RT)
        || gp_pressed(pad, GP_BUTTON.LT);

    // ---- Discrete (edge-triggered) actions ----
    handleGamepadDiscreteActions(pad);

    // Record this frame's button states for next-frame edge detection.
    for (let i = 0; i < pad.buttons.length; i++) {
        gp_prevButtons[i] = gp_pressed(pad, i);
    }
}

// Handle one-shot actions that should fire once per press rather than every
// frame they're held: menu toggles, hotbar cycling, and confirm on menus.
function handleGamepadDiscreteActions(pad) {
    const startJust = gp_justPressed(pad, GP_BUTTON.START);
    const aJust = gp_justPressed(pad, GP_BUTTON.A);

    // Title screen: A / Start begins the game (matches interact-to-start).
    if (title_screen) {
        if ((aJust || startJust) && typeof showOptions !== 'undefined' && !showOptions) {
            title_screen = false;
        }
        return;
    }

    // Difficulty select: D-pad / stick moves a cursor across the on-screen
    // difficulty cards, A clicks the focused card's Select button.
    if (typeof dificulty_screen !== 'undefined' && dificulty_screen) {
        handleGamepadMenuNav(
            pad, aJust,
            '#difficulty-menu .difficulty-select-btn',
            true /* horizontal */
        );
        return;
    }

    // Lose screen: a single "Return to Title" button; A / Start clicks it.
    if (typeof lose_screen !== 'undefined' && lose_screen) {
        if (aJust || startJust) {
            const btn = document.querySelector('#lose-screen .lose-btn');
            if (btn) btn.click();
        }
        return;
    }

    // ---- In-game discrete actions ----

    // Left the menus: forget menu focus so re-entering starts fresh.
    gp_menuSelector = null;

    // Start = pause toggle. virtualInput.pause is also read by takeInput(),
    // but that path is held-aware with its own 200ms debounce; here we just
    // toggle on the rising edge so a tap reliably flips pause state.
    if (startJust && typeof player !== 'undefined' && !player.dead) {
        if (player.talking == 0) {
            paused = !paused;
            lastMili = millis();
        }
    }

    if (paused) return;

    // Back/View = quest log toggle (mirrors the mobile quests button).
    if (gp_justPressed(pad, GP_BUTTON.BACK) && typeof player !== 'undefined') {
        player.show_quests = !player.show_quests;
        lastMili = millis();
    }

    // Bumpers cycle the hotbar, skipping disabled slots (same helper the
    // mouse wheel and mobile prev/next buttons use).
    if (typeof player !== 'undefined' && player.inv && !player.show_quests) {
        if (gp_justPressed(pad, GP_BUTTON.RB)) {
            player.hand = findNextEnabledSlot(player.hand, 1);
        }
        if (gp_justPressed(pad, GP_BUTTON.LB)) {
            player.hand = findNextEnabledSlot(player.hand, -1);
        }
    }
}

// Generic DOM-menu navigation. Given a CSS selector that matches the
// selectable buttons in a visible menu, move a cursor with the D-pad/stick,
// highlight the focused button, and click it on A. Reuses the buttons' own
// click handlers so we never duplicate menu logic.
//
// `selector` matches button elements in document order.
// `horizontal` true = D-left/right and stick X navigate; false = up/down.
var gp_menuCursor = 0;
var gp_menuSelector = null; // detect when the active menu changes -> reset cursor
function handleGamepadMenuNav(pad, aJust, selector, horizontal) {
    const buttons = Array.from(document.querySelectorAll(selector))
        .filter(b => b.offsetParent !== null); // visible only
    if (buttons.length === 0) return;

    // Reset cursor when we first enter a different menu.
    if (gp_menuSelector !== selector) {
        gp_menuSelector = selector;
        gp_menuCursor = 0;
    }
    gp_menuCursor = Math.min(gp_menuCursor, buttons.length - 1);

    const prevIdx = horizontal ? GP_BUTTON.DPAD_LEFT : GP_BUTTON.DPAD_UP;
    const nextIdx = horizontal ? GP_BUTTON.DPAD_RIGHT : GP_BUTTON.DPAD_DOWN;
    const axis = horizontal ? (pad.axes[0] || 0) : (pad.axes[1] || 0);

    // Stick edge detection so a held stick advances one step, not many.
    const stickNeg = axis < -GP_STICK_DEADZONE;
    const stickPos = axis > GP_STICK_DEADZONE;
    const stickNegEdge = stickNeg && gp_prevButtons['menuAxNeg'] !== true;
    const stickPosEdge = stickPos && gp_prevButtons['menuAxPos'] !== true;
    gp_prevButtons['menuAxNeg'] = stickNeg;
    gp_prevButtons['menuAxPos'] = stickPos;

    if (gp_justPressed(pad, prevIdx) || stickNegEdge) {
        gp_menuCursor = (gp_menuCursor - 1 + buttons.length) % buttons.length;
    }
    if (gp_justPressed(pad, nextIdx) || stickPosEdge) {
        gp_menuCursor = (gp_menuCursor + 1) % buttons.length;
    }

    // Visually mark the focused button (CSS class .gp-focus styles it).
    buttons.forEach((b, i) => b.classList.toggle('gp-focus', i === gp_menuCursor));

    if (aJust) {
        buttons[gp_menuCursor].click();
    }
}
