/* global p5, Level, Tile, Shop, Plant, Chest, Robot, ITEM_DEFINITIONS, TILE_DEFINITIONS */
'use strict';

// Globals intentionally use the same names as the shared Cloudy Meadows engine.
var tileSize = 32;
var canvasWidth = 23 * tileSize;
var canvasHeight = 19 * tileSize;
var levels = Array.from({ length: 201 }, () => []);
var currentLevel_x = 100;
var currentLevel_y = 100;
var all_imgs = [];
var all_tiles = [];
var all_items = [];
var player;
var days = 0;
var dayOfWeek = 0;
var time = 0;
var timephase = 0;
var paused = false;
var title_screen = false;
var lose_screen = false;
var dificulty_screen = false;
var dificulty = 0;
var current_reply = 0;
var temp_move_bool = true;
var worldUpdateTick = 0;
var is3DMode = true;
var pointerLockEngaged = false;
var MOUSE_LOOK_SENSITIVITY_DEG_PER_PX = 0.15;
var deltaTime = 16;
var camera = { enabled:false, x:0, y:0, zoom:1 };
var virtualInput = { up:false,down:false,left:false,right:false,interact:false,eat:false,special:false,pause:false,quest:false };
var move_up_button = 87, move_left_button = 65, move_down_button = 83, move_right_button = 68;
var interact_button = 69, eat_button = 81, special_key = 16, pause_button = 27, quest_key = 80;
var Controls_Interact_button_key = 'e', Controls_Eat_button_key = 'q', Controls_Up_button_key = 'w';
var Controls_Down_button_key = 's', Controls_Left_button_key = 'a', Controls_Right_button_key = 'd';
var Controls_Special_button_key = 'Shift', Controls_Quest_button_key = 'p';
var flashlightOn = false;
var maxHunger = 6;
var extraCount = 0;
var currentWeather = 'clear';
var lastRainDay = -999, lastFrogRainDay = -999;
var frogRainEntities = [];
var weatherLog = [];
var localData = localDataStorage('passphrase.autofarm.separate');
var player_2, player_imgs, inv_img, inv_hand_img, hunger_e, hunger_f, calendar_img, coin_img;
var battery_low_img, inv_full_img, background_img, chat_icon, done_dot, up_dot, x_img;
var quest_marker_img, gift_indication_img;
var robotPlayButton, robotPauseButton, robotBoomButton;
var mouse_item = 0;
var UI_BOUNDS = {get chestGrid(){return{top:189,bottom:457,left:(canvasWidth/2)-184,right:(canvasWidth/2)+184,cellSize:90,getGridPos:(x,y,inv)=>({x:Math.min(inv[0].length-1,Math.max(0,Math.round((x-(canvasWidth/2)+139)/90))),y:Math.min(inv.length-1,Math.max(0,Math.round((y-234)/90)))})};}};
var mobileInventoryState = { isOpen:false };
var isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || ('ontouchstart' in window)
    || (navigator.maxTouchPoints > 0)
    || (window.innerWidth <= 1024 && window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
    || (window.innerWidth <= 768);
var robot_talkingSound = { play(){} }, PlantingSound = { play(){} }, shovelSound = { play(){} };
var hoe_sound = { play(){} }, moneySound = { play(){} }, errorSound = { play(){} };
var allSounds = [];
var musicSlider, fxSlider;
var QuitButton = { hide(){} };
var keymapping = false, currentMappingIndex = 0, control_set = 0;

const AUTO_SAVE_KEY = 'cloudy-autofarm-world-v2';
const AUTO_ORIGIN = 100;
const AUTO_WORLD_SEED = 'cloudy-autofarm-shared-v2';
const AUTO_3D_MOVE_SPEED_TILES_PER_SEC = 4;
const AUTO_3D_COLLISION_RADIUS_TILES = 0.2;
const AUTO_COMMAND_IDS = [19,20,21,22,23,26,29,30,34];
let autoSave = null;
let autoLastMove = 0;
let autoLastAction = 0;
let autoLastClock = 0;
let autoLastSave = 0;
let autoSocket = null;
let autoPeers = {};
let autoModalObject = null;
let autoJoined = false;
let autoPlayerName = '';
let autoReconnectTimer = null;
let autoUnreadChat = 0;
let autoInventoryWarningUntil = 0;
let autoLastPresence = 0;
let autoLast3DAnim = 0;
let autoVirtualInteractHeld = false;
let autoVirtualEatHeld = false;

function preload() {
    loadAutoFarmAssets();
    all_tiles = TILE_DEFINITIONS;
    all_items = ITEM_DEFINITIONS.slice();
    all_items[51] = { name:'Wood', png:170, price:4, class:'Item' };
    all_items[52] = { name:'Stone', png:171, price:5, class:'Item' };
}

function setup() {
    const canvas = createCanvas(canvasWidth, canvasHeight);
    canvas.parent('game-container');
    noSmooth();
    if (typeof setupPointerLock === 'function') setupPointerLock(canvas.elt);
    if (typeof initializeThree3DRenderer === 'function') initializeThree3DRenderer();
    CloudyDisplay.setup();
    createSharedRobotButtons();
    autoSave = readAutoSave();
    createAutoPlayer();
    ensureAutoNeighbors();
    restoreAutoPlayer();
    if(!autoSave.currentWeather)CloudyWeather.roll(autoHash(days,0,'weather'));
    bindAutoModal();
    setupAutoPauseMenu();
    bindAutoMultiplayerClient();
    setupAutoMobileControls(canvas.elt);
}

function windowResized() {
    CloudyDisplay.resizeCanvas();
    isMobile = detectAutoMobile();
    updateAutoMobileControlsVisibility();
}

function detectAutoMobile() {
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || ('ontouchstart' in window)
        || (navigator.maxTouchPoints > 0)
        || (window.innerWidth <= 1024 && window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
        || (window.innerWidth <= 768);
}

function clearAutoVirtualInput() {
    for (const key of Object.keys(virtualInput)) virtualInput[key] = false;
    autoVirtualInteractHeld = false;
    autoVirtualEatHeld = false;
    document.querySelectorAll('#mobile-controls .pressed, #mobile-controls .long-press')
        .forEach(button => button.classList.remove('pressed', 'long-press'));
}

function updateAutoMobileControlsVisibility() {
    const controls = document.getElementById('mobile-controls');
    if (!controls) return;
    const modal = document.getElementById('autofarm-modal');
    const shouldShow = isMobile && autoJoined && !paused &&
        !(modal && modal.classList.contains('open'));
    controls.classList.toggle('active', shouldShow);
    if (!shouldShow && controls.dataset.inputActive === 'true') clearAutoVirtualInput();
    controls.dataset.inputActive = shouldShow ? 'true' : 'false';
}

function setupAutoMobileControls(canvasElt) {
    const controls = document.getElementById('mobile-controls');
    if (!controls) return;

    const bindHold = (id, inputName, longPressSpecial = false) => {
        const button = document.getElementById(id);
        if (!button) return;
        let longPressTimer = null;
        const release = event => {
            if (event) event.preventDefault();
            clearTimeout(longPressTimer);
            virtualInput[inputName] = false;
            if (longPressSpecial) virtualInput.special = false;
            button.classList.remove('pressed', 'long-press');
        };
        button.addEventListener('pointerdown', event => {
            event.preventDefault();
            button.setPointerCapture?.(event.pointerId);
            virtualInput[inputName] = true;
            button.classList.add('pressed');
            if (longPressSpecial) {
                longPressTimer = setTimeout(() => {
                    virtualInput.special = true;
                    button.classList.add('long-press');
                }, 300);
            }
        });
        button.addEventListener('pointerup', release);
        button.addEventListener('pointercancel', release);
        button.addEventListener('lostpointercapture', release);
    };

    bindHold('dpad-up', 'up');
    bindHold('dpad-down', 'down');
    bindHold('dpad-left', 'left');
    bindHold('dpad-right', 'right');
    bindHold('btn-interact', 'interact', true);
    bindHold('btn-eat', 'eat');

    const bindTap = (id, callback) => {
        const button = document.getElementById(id);
        if (!button) return;
        button.addEventListener('pointerdown', event => {
            event.preventDefault();
            button.classList.add('pressed');
            callback();
        });
        const release = event => {
            event.preventDefault();
            button.classList.remove('pressed');
        };
        button.addEventListener('pointerup', release);
        button.addEventListener('pointercancel', release);
    };

    bindTap('hotbar-prev', () => { if (player) player.hand = (player.hand + 7) % 8; });
    bindTap('hotbar-next', () => { if (player) player.hand = (player.hand + 1) % 8; });
    bindTap('btn-mobile-pause', () => setAutoPaused(true));

    if (canvasElt) {
        let lookPointerId = null;
        let lastLookX = 0;
        canvasElt.addEventListener('pointerdown', event => {
            if (!isMobile || !is3DMode || !autoJoined || paused || event.pointerType === 'mouse') return;
            lookPointerId = event.pointerId;
            lastLookX = event.clientX;
            canvasElt.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        });
        canvasElt.addEventListener('pointermove', event => {
            if (event.pointerId !== lookPointerId || !player) return;
            const movementX = event.clientX - lastLookX;
            lastLookX = event.clientX;
            player.lookYawDeg = normalizeAngleDeg0to360(player.lookYawDeg + movementX * 0.35);
            player.facing = nearestCardinalFacingFromYaw(player.lookYawDeg);
            event.preventDefault();
        });
        const endLook = event => {
            if (event.pointerId === lookPointerId) lookPointerId = null;
        };
        canvasElt.addEventListener('pointerup', endLook);
        canvasElt.addEventListener('pointercancel', endLook);
    }

    isMobile = detectAutoMobile();
    updateAutoMobileControlsVisibility();
}

function processAutoVirtualActions() {
    const modal = document.getElementById('autofarm-modal');
    const canAct = autoJoined && !paused && !autoTextInputActive() &&
        !(modal && modal.classList.contains('open'));
    if (virtualInput.interact && !autoVirtualInteractHeld && canAct && !player.talking) {
        autoLastAction = millis();
        useAutoItem();
    }
    if (virtualInput.eat && !autoVirtualEatHeld && canAct) {
        if (player.talking && ['Chest','Backpack'].includes(player.talking.class)) closeAutoContainer();
        else if (!player.talking) eatAutoHeld();
    }
    autoVirtualInteractHeld = virtualInput.interact;
    autoVirtualEatHeld = virtualInput.eat;
}

function setupAutoPauseMenu() {
    const savedOptions=localData.get('Options')||{};
    applyAccessibilityPrefs({
        ...savedOptions,
        is3DMode:getAutoFarmInitial3DMode(savedOptions)
    });
    musicSlider=createSlider(0,1,savedOptions.musicVolume??0.5,0.01);
    fxSlider=createSlider(0,1,savedOptions.fxVolume??0.5,0.01);
    for(const slider of [musicSlider,fxSlider]){slider.parent('game-container');slider.input(saveOptions);slider.hide();}
    ensurePauseMenuContainer();
    const menu=document.getElementById('pause-menu'),quit=document.getElementById('pause-quit-btn'),title=menu&&menu.querySelector('.pause-title');
    if(title)title.textContent='AutoFarm Paused';
    if(quit){const disconnect=quit.cloneNode(true);disconnect.textContent='Save & Disconnect';disconnect.style.display='block';quit.replaceWith(disconnect);disconnect.addEventListener('click',disconnectAutoFarm);}
    if(menu)menu.querySelectorAll('img[src^="images/"]').forEach(img=>img.src='../'+img.getAttribute('src'));
    const resume=document.getElementById('pause-back-btn');
    if(resume)resume.addEventListener('click',()=>setAutoPaused(false));
    hidePaused();restoreAutoCanvasInput();
}

function getAutoFarmInitial3DMode(savedOptions) {
    return savedOptions && typeof savedOptions.is3DMode === 'boolean'
        ? savedOptions.is3DMode
        : true;
}

function setAutoPaused(value) {
    paused=value;
    if(paused)showPaused();else{hidePaused();restoreAutoCanvasInput();}
}

function restoreAutoCanvasInput(){const canvas=document.querySelector('#game-container canvas');if(canvas)canvas.style.pointerEvents='auto';}

function disconnectAutoFarm(){if(player.talking&&['Chest','Backpack'].includes(player.talking.class))closeAutoContainer();saveAutoFarm();clearTimeout(autoReconnectTimer);autoJoined=false;autoPeers={};const socket=autoSocket;autoSocket=null;if(socket){socket.autoIntentionalClose=true;try{socket.close(1000,'Player disconnected');}catch(_){}}updateAutoPlayerCount(0);setAutoSocketState('offline');setAutoPaused(false);const screen=document.querySelector('#autofarm-name-screen'),input=document.querySelector('#autofarm-name');screen.style.display='grid';input.value=autoPlayerName||localStorage.getItem('autofarm-player-name')||'';document.querySelector('#join-server-state').textContent='DISCONNECTED — SAVE COMPLETE';document.querySelector('#autofarm-client').open=false;setTimeout(()=>{input.focus();refreshAutoServerInfo();},100);}

function createSharedRobotButtons() {
    robotPlayButton = createButton('Play');
    robotPauseButton = createButton('Pause');
    robotBoomButton = createButton('Pack Up');
    for (const button of [robotPlayButton, robotPauseButton, robotBoomButton]) {
        button.parent('game-container'); button.hide();
    }
}

function getAutoFacingTile(playerObj, levelX=currentLevel_x, levelY=currentLevel_y) {
    if (!playerObj) return undefined;
    const offsets=[[0,-1],[1,0],[0,1],[-1,0]],offset=offsets[playerObj.facing]||offsets[2];
    const row=Math.round(playerObj.pos.y/tileSize)+offset[1];
    const col=Math.round(playerObj.pos.x/tileSize)+offset[0];
    const level=levels[levelY]&&levels[levelY][levelX];
    return level&&level.map[row]?level.map[row][col]:undefined;
}

function createAutoPlayer() {
    const backpack=new_item_from_num(33,1);
    backpack.inv[0][0]=new_item_from_num(3,12);
    backpack.inv[0][1]=new_item_from_num(8,8);
    backpack.inv[0][2]=new_item_from_num(43,1);
    player = {
        pos:createVector(5 * tileSize, 5 * tileSize), facing:2, anim:0, hand:0, coins:200,
        hunger:maxHunger, hp:100, dead:false, talking:0, touching:0, lookYawDeg:90,
        inv:[new_item_from_num(1,1),new_item_from_num(32,1),new_item_from_num(45,1),backpack,new_item_from_num(36,2),new_item_from_num(27,1),0,0],
        looking(levelX=currentLevel_x,levelY=currentLevel_y) {
            return getAutoFacingTile(this,levelX,levelY);
        }
    };
}

function draw() {
    updateAutoMobileControlsVisibility();
    background(135,206,235);
    let level = levels[currentLevel_y][currentLevel_x];
    if (!level) return;
    if (autoJoined && !paused) updateAutoFarm(level);
    level = levels[currentLevel_y][currentLevel_x];
    if (!level) return;

    if (is3DMode) {
        render3DViewWebgl(player, level, currentLevel_x, currentLevel_y);
    } else {
        image(background_img, 0, 0, canvasWidth, canvasHeight);
        level.render();
        renderAutoPeers();
        renderAutoPlayer();
        level.renderTreeTops();
        renderAutoNameTags();
    }
    CloudyWeather.render();
    if (time > 0) level.renderLights();
    renderAutoHud();
}

function updateAutoFarm(level) {
    handleAutoInput();
    level = levels[currentLevel_y][currentLevel_x] || level;
    worldUpdateTick += 1;
    for (let y = 0; y < levels.length; y++) {
        for (let x = 0; x < levels[y].length; x++) if (levels[y][x]) levels[y][x].update(x,y,worldUpdateTick);
    }
    if (millis() - autoLastClock > 300) {
        autoLastClock = millis();
        const standingTile=level.map[autoCurrentCell().row][autoCurrentCell().col],clockStep=standingTile&&standingTile.name==='bed'?3:1;
        if (timephase === 0) time += clockStep;
        else time -= clockStep;
        if (time >= 200) { time = 200; timephase = 1; days += 1; dayOfWeek = days % 5; CloudyWeather.roll(autoHash(days,0,'weather')); }
        if (time <= 0) {
            time = 0; timephase = 0;
            for (const row of levels) for (const loaded of row) if (loaded) loaded.daily_update();
        }
    }
    if (millis() - autoLastSave > 10000) { autoLastSave = millis(); saveAutoFarm(); }
}

function handleAutoInput() {
    processAutoVirtualActions();
    if (!autoJoined || autoTextInputActive()) return;
    if (player.talking && ['Chest','Backpack'].includes(player.talking.class)) return;
    if (document.querySelector('#autofarm-modal').classList.contains('open')) return;
    if (is3DMode) {
        updateAutoFarm3DMovement();
        return;
    }
    if (millis() - autoLastMove > 125) {
        if (keyIsDown(move_up_button) || keyIsDown(38) || virtualInput.up) moveAutoPlayer(0,-1,0);
        else if (keyIsDown(move_right_button) || keyIsDown(39) || virtualInput.right) moveAutoPlayer(1,0,1);
        else if (keyIsDown(move_down_button) || keyIsDown(40) || virtualInput.down) moveAutoPlayer(0,1,2);
        else if (keyIsDown(move_left_button) || keyIsDown(37) || virtualInput.left) moveAutoPlayer(-1,0,3);
    }
}

function updateAutoFarm3DMovement() {
    const level = levels[currentLevel_y] && levels[currentLevel_y][currentLevel_x];
    if (!level || !Array.isArray(level.map)) return false;

    const yawRad = getActiveCameraYawDeg(player) * Math.PI / 180;
    const forwardX = Math.cos(yawRad), forwardY = Math.sin(yawRad);
    const rightX = Math.cos(yawRad + Math.PI / 2), rightY = Math.sin(yawRad + Math.PI / 2);
    let moveX = 0, moveY = 0;
    if (keyIsDown(move_up_button) || keyIsDown(38) || virtualInput.up) { moveX += forwardX; moveY += forwardY; }
    if (keyIsDown(move_down_button) || keyIsDown(40) || virtualInput.down) { moveX -= forwardX; moveY -= forwardY; }
    if (keyIsDown(move_right_button) || keyIsDown(39) || virtualInput.right) { moveX += rightX; moveY += rightY; }
    if (keyIsDown(move_left_button) || keyIsDown(37) || virtualInput.left) { moveX -= rightX; moveY -= rightY; }
    if (moveX === 0 && moveY === 0) return false;

    const moveLength = Math.hypot(moveX, moveY);
    if (moveLength > 1) { moveX /= moveLength; moveY /= moveLength; }
    const frameSeconds = Math.min(Math.max(deltaTime, 0), 50) / 1000;
    const stepTiles = AUTO_3D_MOVE_SPEED_TILES_PER_SEC * frameSeconds;
    const originXTiles = (player.pos.x + tileSize / 2) / tileSize;
    const originYTiles = (player.pos.y + tileSize / 2) / tileSize;
    const result = moveWithSliding(
        level.map,
        originXTiles,
        originYTiles,
        moveX * stepTiles,
        moveY * stepTiles,
        AUTO_3D_COLLISION_RADIUS_TILES
    );
    const roomWidthTiles = level.map.reduce(
        (width, row) => Math.max(width, Array.isArray(row) ? row.length : 0),
        0
    );
    const roomHeightTiles = level.map.length;
    const originLevelX = currentLevel_x, originLevelY = currentLevel_y;
    let finalXTiles = result.x, finalYTiles = result.y;
    let crossEdgeX = (moveX < 0 && result.x < 0.5) ||
        (moveX > 0 && result.x > roomWidthTiles - 0.5);
    let crossEdgeY = (moveY < 0 && result.y < 0.5) ||
        (moveY > 0 && result.y > roomHeightTiles - 0.5);

    if (crossEdgeX && crossEdgeY) {
        const xPenetration = moveX > 0
            ? result.x - (roomWidthTiles - 0.5)
            : 0.5 - result.x;
        const yPenetration = moveY > 0
            ? result.y - (roomHeightTiles - 0.5)
            : 0.5 - result.y;
        if (xPenetration >= yPenetration) crossEdgeY = false;
        else crossEdgeX = false;
    }

    let changedRoom = false;
    if (crossEdgeX) {
        const direction = moveX > 0 ? 1 : -1;
        const targetX = originLevelX + direction, targetY = originLevelY;
        const snappedY = snapToTileCenter(result.y, roomHeightTiles);
        if (ensureAutoLevel(targetX, targetY) &&
            isOpenLevelEntry(levels[targetY][targetX], 'x', direction, snappedY)) {
            currentLevel_x = targetX;
            finalXTiles = wrapPositionAcrossEdge(result.x, roomWidthTiles, direction);
            finalYTiles = snappedY;
            changedRoom = true;
        } else {
            finalXTiles = direction > 0 ? roomWidthTiles - 0.5 : 0.5;
        }
    } else if (crossEdgeY) {
        const direction = moveY > 0 ? 1 : -1;
        const targetX = originLevelX, targetY = originLevelY + direction;
        const snappedX = snapToTileCenter(result.x, roomWidthTiles);
        if (ensureAutoLevel(targetX, targetY) &&
            isOpenLevelEntry(levels[targetY][targetX], 'y', direction, snappedX)) {
            currentLevel_y = targetY;
            finalYTiles = wrapPositionAcrossEdge(result.y, roomHeightTiles, direction);
            finalXTiles = snappedX;
            changedRoom = true;
        } else {
            finalYTiles = direction > 0 ? roomHeightTiles - 0.5 : 0.5;
        }
    }

    player.pos.x = finalXTiles * tileSize - tileSize / 2;
    player.pos.y = finalYTiles * tileSize - tileSize / 2;
    const now = millis();
    if (now - autoLast3DAnim >= 125) {
        autoLast3DAnim = now;
        player.anim = (player.anim + 1) % 2;
    }
    if (changedRoom) ensureAutoNeighbors();
    sendAutoPresenceThrottled(changedRoom);
    return true;
}

function keyPressed() {
    if(autoTextInputActive())return true;
    if(keymapping){applyAutoControlMapping(currentMappingIndex,key,keyCode);return false;}
    if(player.talking&&['Chest','Backpack'].includes(player.talking.class)&&keyCode===eat_button){closeAutoContainer();return false;}
    if (keyCode >= 49 && keyCode <= 56) player.hand = keyCode - 49;
    if (keyCode===interact_button && !paused && !player.talking && millis() - autoLastAction > 120) { autoLastAction = millis(); useAutoItem(); }
    if (keyCode===ESCAPE) {
        if(document.querySelector('#autofarm-modal').classList.contains('open'))closeAutoModal();else setAutoPaused(!paused);
    }
    if(keyCode===eat_button&&!player.talking&&!paused){eatAutoHeld();return false;}
}

function applyAutoControlMapping(index,keyName,code){const normalized=keyName.length===1?keyName.toLowerCase():keyName;const fields={1:['Controls_Interact_button_key','interact_button'],2:['Controls_Eat_button_key','eat_button'],3:['Controls_Up_button_key','move_up_button'],4:['Controls_Down_button_key','move_down_button'],5:['Controls_Left_button_key','move_left_button'],6:['Controls_Right_button_key','move_right_button'],7:['Controls_Special_button_key','special_key'],8:['Controls_Quest_button_key','quest_key']},field=fields[index];if(field){window[field[0]]=normalized;window[field[1]]=code;}keymapping=false;control_set=0;currentMappingIndex=0;saveOptions();const host=document.getElementById('pause-controls-container');if(host)renderControlButtons(host);}

function moveAutoPlayer(dx,dy,facing) {
    autoLastMove = millis(); player.facing = facing; player.lookYawDeg = [270,0,90,180][facing];
    let col = Math.round(player.pos.x / tileSize) + dx;
    let row = Math.round(player.pos.y / tileSize) + dy;
    let nextX = currentLevel_x, nextY = currentLevel_y;
    if (col < 0) { nextX--; col = 22; } else if (col > 22) { nextX++; col = 0; }
    if (row < 0) { nextY--; row = 18; } else if (row > 18) { nextY++; row = 0; }
    ensureAutoLevel(nextX,nextY);
    const target = levels[nextY][nextX].map[row][col];
    if (!target || target.collide === true) return;
    currentLevel_x = nextX; currentLevel_y = nextY;
    player.pos.x = col * tileSize; player.pos.y = row * tileSize; player.anim = (player.anim + 1) % 2;
    ensureAutoNeighbors(); sendAutoPresence();
}

function useAutoItem() {
    const level = levels[currentLevel_y][currentLevel_x];
    const position = autoCurrentCell();
    const tile = level.map[position.row][position.col];
    const aheadPosition = autoTargetCell();
    const aheadTile = level.map[aheadPosition.row][aheadPosition.col];
    const held = player.inv[player.hand];
    if(held&&held.class==='Backpack')return openAutoBackpack(held);
    if (aheadTile.class === 'Shop') return openAutoShop(aheadTile);
    if (aheadTile.name === 'cart_s') return openAutoCart(level);
    if (aheadTile.class === 'Chest') return openAutoChest(aheadTile);
    if (aheadTile.class === 'Robot') return openAutoRobot(aheadTile);
    if (tile.class === 'Plant') {
        if (tile.age === all_imgs[tile.png].length - 2) {
            if (addAutoItem(tile.eat_num, Math.max(1, tile.getHarvestYield ? tile.getHarvestYield() : 1))) setAutoCell(position, new_tile_from_num(3,position.col*tileSize,position.row*tileSize));
        } else if (held && held.name === 'Shovel') setAutoCell(position,new_tile_from_num(3,position.col*tileSize,position.row*tileSize));
        return;
    }
    if (aheadTile.name === 'tree_bottom' && held && held.name === 'Axe') {
        addAutoItem(51,3); setAutoCell(aheadPosition,new_tile_from_num(2,aheadPosition.col*tileSize,aheadPosition.row*tileSize));
        if (aheadPosition.row > 0 && level.map[aheadPosition.row-1][aheadPosition.col].name === 'tree_top') setAutoCell({row:aheadPosition.row-1,col:aheadPosition.col},new_tile_from_num(2,aheadPosition.col*tileSize,(aheadPosition.row-1)*tileSize));
        return;
    }
    if (aheadTile.name === 'rock' && held && held.name === 'Shovel') { addAutoItem(52,2); setAutoCell(aheadPosition,new_tile_from_num(2,aheadPosition.col*tileSize,aheadPosition.row*tileSize)); return; }
    if (aheadTile.name === 'bed' && held && held.name === 'Axe') { if(addAutoItem(43,1))setAutoCell(aheadPosition,aheadTile.under_tile||new_tile_from_num(2,aheadPosition.col*tileSize,aheadPosition.row*tileSize)); return; }
    if (aheadTile.name === 'wall' && held && held.name === 'Axe') { if(addAutoItem(44,1))setAutoCell(aheadPosition,aheadTile.under_tile||new_tile_from_num(2,aheadPosition.col*tileSize,aheadPosition.row*tileSize)); return; }
    if (tile.name === 'sprinkler' && held && held.name === 'Shovel') { if(addAutoItem(12,1))setAutoCell(position,tile.under_tile||new_tile_from_num(2,position.col*tileSize,position.row*tileSize)); return; }
    if (tile.name === 'grass' && held && held.name === 'Hoe') { setAutoCell(position,new_tile_from_num(3,position.col*tileSize,position.row*tileSize)); return; }
    if (tile.name === 'plot' && held && held.class === 'Seed') {
        setAutoCell(position,new_tile_from_num(held.plant_num,position.col*tileSize,position.row*tileSize)); consumeAutoHeld(); return;
    }
    if (held && held.class === 'Placeable') {
        const target = resolveAutoPlaceableTarget(held, tile, position, aheadTile, aheadPosition);
        if (!target) return;
        const placed = new_tile_from_num(
            held.tile_num,
            target.position.col * tileSize,
            target.position.row * tileSize
        );
        if (!placed) return;
        placed.under_tile = target.tile;
        if (['Chest','Robot1','Robot2','Robot3'].includes(held.name) ||
            ['grinder','Veggie_Press','compost_bucket'].includes(placed.name)) {
            placed.playerOwned = true;
        }
        if (placed.class === 'Robot') placed.move_bool = false;
        if (placed.name === 'sprinkler') {
            placed.last_under_png = target.tile.png;
            placed.last_under_variant = target.tile.variant;
        }
        setAutoCell(target.position, placed);
        consumeAutoHeld();
    }
}

function resolveAutoPlaceableTarget(held, currentTile, currentPosition, aheadTile, aheadPosition) {
    if (!held || held.class !== 'Placeable') return null;
    // Solid construction and inventory entities belong in front of the player.
    // Putting a wall on the occupied tile traps the continuous 3D controller
    // inside newly-created collision geometry.
    const placeAhead = ['Wall','Chest','Robot1','Robot2','Robot3'].includes(held.name);
    const targetTile = placeAhead ? aheadTile : currentTile;
    const targetPosition = placeAhead ? aheadPosition : currentPosition;
    if (!targetTile || !targetPosition || (placeAhead && targetTile.collide === true)) return null;
    if (placeAhead && targetPosition.row === currentPosition.row &&
        targetPosition.col === currentPosition.col) return null;

    const required = held.tile_need_num || 0;
    if (required !== 0 && required !== tile_name_to_num(targetTile.name)) return null;
    if (held.name === 'Sprinkler' && targetTile.class === 'Plant') return null;
    return { tile: targetTile, position: targetPosition };
}

function eatAutoHeld(){const food=player.inv[player.hand];if(!food||food.class!=='Eat'||player.hunger>=maxHunger)return;player.hunger=Math.min(maxHunger,player.hunger+food.hunger);const seedNum=food.seed_num||0,seedAmount=seedNum?Math.max(1,Math.floor(((food.seed_min||1)+(food.seed_max||food.seed_min||1))/2)):0;food.amount-=1;if(food.amount<=0)player.inv[player.hand]=0;if(seedNum)addAutoItem(seedNum,seedAmount);}

function autoCurrentCell() {
    return {
        row: constrain(Math.round(player.pos.y/tileSize),0,18),
        col: constrain(Math.round(player.pos.x/tileSize),0,22)
    };
}

function autoTargetCell() {
    const vectors = [[0,-1],[1,0],[0,1],[-1,0]], d = vectors[player.facing];
    let col = Math.round(player.pos.x/tileSize)+d[0], row = Math.round(player.pos.y/tileSize)+d[1];
    col = constrain(col,0,22); row = constrain(row,0,18); return {row,col};
}

function setAutoCell(position,tile,remote) {
    levels[currentLevel_y][currentLevel_x].map[position.row][position.col] = tile;
    webglRoomGeometryCache.levelX = null;
    if (!remote) sendAutoMessage({type:'patch',key:autoPatchKey(currentLevel_x,currentLevel_y,position.row,position.col),value:serializeAutoTile(tile)});
}

function addAutoItem(id,amount) {
    const definition=all_items[id];if(!definition||amount<=0)return false;
    let slot=definition.class==='Backpack'?null:player.inv.find(entry=>entry&&entry.name===definition.name);
    if(slot){slot.amount+=amount;return true;}
    if(definition.class!=='Backpack')for(const backpack of player.inv.filter(entry=>entry&&entry.class==='Backpack'))for(const row of backpack.inv){slot=row.find(entry=>entry&&entry.name===definition.name);if(slot){slot.amount+=amount;return true;}}
    const empty=player.inv.indexOf(0);if(empty>=0){player.inv[empty]=new_item_from_num(id,amount);return true;}
    if(definition.class!=='Backpack')for(const backpack of player.inv.filter(entry=>entry&&entry.class==='Backpack'))for(const row of backpack.inv){const backpackEmpty=row.indexOf(0);if(backpackEmpty>=0){row[backpackEmpty]=new_item_from_num(id,amount);return true;}}
    autoInventoryWarningUntil=millis()+1800;return false;
}
function consumeAutoHeld() { if (--player.inv[player.hand].amount <= 0) player.inv[player.hand] = 0; }

function renderAutoPlayer() { push();imageMode(CENTER);image(player_imgs[player.facing][player.anim],player.pos.x+16,player.pos.y+16);pop(); }
function renderAutoPeers() {
    push();imageMode(CENTER);for (const peer of Object.values(autoPeers)) if (peer.levelX === currentLevel_x && peer.levelY === currentLevel_y) image(player_imgs[peer.facing || 2][0],peer.x+16,peer.y+16);pop();
}
function renderAutoNameTags(){for(const peer of Object.values(autoPeers))if(peer.levelX===currentLevel_x&&peer.levelY===currentLevel_y)renderAutoNameTag(peer.name,peer.x+16,peer.y-3);renderAutoNameTag(autoPlayerName,player.pos.x+16,player.pos.y-3);}
function renderAutoNameTag(name,x,y){if(!name)return;push();textFont(player_2);textSize(7);textAlign(CENTER,CENTER);const width=Math.min(150,textWidth(name)+10),tagY=Math.max(7,y);noStroke();fill(31,24,18,210);rectMode(CENTER);rect(x,tagY,width,13,3);fill(255,244,199);stroke(35,24,16);strokeWeight(2);text(name,x,tagY+.5);pop();}

function renderAutoHud() {
    push(); imageMode(CORNER);
    image(calendar_img,canvasWidth-70,6); fill(0); stroke(255); textFont(player_2); textSize(13); textAlign(CENTER); text(days,canvasWidth-40,50);
    const startX = canvasWidth/2-256;
    if(player.talking&&player.talking.class==='Chest')player.talking.chest_render();
    else if(player.talking&&player.talking.class==='Backpack')player.talking.bag_render();
    image(inv_img,startX,canvasHeight-64,512,64);
    for (let i=0;i<8;i++) { if (player.inv[i]) player.inv[i].render(startX+4+i*64,canvasHeight-60); if(i===player.hand) image(inv_hand_img,startX+i*64,canvasHeight-64,64,64); }
    image(coin_img,canvasWidth-150,canvasHeight-165); fill(255); stroke(0); textAlign(LEFT); textSize(18); text(player.coins,canvasWidth-115,canvasHeight-144);
    for(let i=0;i<maxHunger;i++)image(i<player.hunger?hunger_f:hunger_e,startX+i*30,canvasHeight-100,30,30);
    if(millis()<autoInventoryWarningUntil){image(inv_full_img,48,canvasHeight-88,32,32);fill(255,90,75);stroke(0);textSize(9);text('INVENTORY FULL',84,canvasHeight-70);}
    if(mouse_item)mouse_item.render(mouseX-16,mouseY-16);
    pop();
}

function ensureAutoNeighbors() {
    ensureAutoLevel(currentLevel_x,currentLevel_y); ensureAutoLevel(currentLevel_x+1,currentLevel_y); ensureAutoLevel(currentLevel_x-1,currentLevel_y); ensureAutoLevel(currentLevel_x,currentLevel_y+1); ensureAutoLevel(currentLevel_x,currentLevel_y-1);
}

function ensureAutoLevel(levelX,levelY) {
    if (levelX<0||levelY<0||levelX>=201||levelY>=201) return false;
    if (levels[levelY][levelX]) return true;
    const chunkX=levelX-AUTO_ORIGIN, chunkY=levelY-AUTO_ORIGIN;
    const map=generateAutoMap(chunkX,chunkY), fore=Array.from({length:19},()=>Array(23).fill(0));
    const level=new Level('AutoFarm '+chunkX+', '+chunkY,map,fore);
    decorateAutoLevel(level,chunkX,chunkY);
    const saved=autoSave && autoSave.levels && autoSave.levels[levelX+','+levelY];
    if(saved) restoreAutoLevel(level,saved);
    levels[levelY][levelX]=level; return true;
}

function generateAutoMap(chunkX,chunkY) {
    const map=Array.from({length:19},()=>Array(23).fill(2));
    for(let r=1;r<18;r++) for(let c=1;c<22;c++) {
        if(r===9||c===11) continue; const roll=autoHash(chunkX*23+c,chunkY*19+r,'terrain');
        if(roll<.035) map[r][c]=72; else if(roll<.065) map[r][c]=39;
    }
    if(chunkX===0&&chunkY===0) for(let r=2;r<15;r++) for(let c=2;c<13;c++) map[r][c]=2;
    return map;
}

function decorateAutoLevel(level,chunkX,chunkY) {
    for(let r=3;r<17;r+=3) for(let c=2;c<21;c+=4) if(autoHash(chunkX*31+c,chunkY*31+r,'tree')<.2&&level.map[r][c].name==='grass') { level.map[r][c]=new_tile_from_num(68,c*32,r*32); level.map[r-1][c]=new_tile_from_num(69,c*32,(r-1)*32); }
    for(let r=2;r<17;r++) for(let c=2;c<21;c++) if(autoHash(chunkX*41+c,chunkY*41+r,'rock')<.018&&level.map[r][c].name==='grass') level.map[r][c]=new Tile('rock',139,c*32,r*32,true,-1);
    const market=(chunkX===0&&chunkY===0)||autoHash(chunkX,chunkY,'market')<.16;
    if(market) {
        const utilities=[1,12,18,27,28,32,33,36,37,38,43,44,45,46,49,50,...AUTO_COMMAND_IDS];
        const chosen=[]; for(let i=0;i<5;i++) chosen.push(utilities[Math.floor(autoHash(chunkX,chunkY,'stock'+i)*utilities.length)]);
        const commands=[0,1,2].map(i=>AUTO_COMMAND_IDS[Math.floor(autoHash(chunkX,chunkY,'command'+i)*AUTO_COMMAND_IDS.length)]);
        const stock=[2,5,7,15,17,39,41,3,8,14,16,40,42,33,43,...chosen,...commands].map(num=>({num,amount:5+Math.floor(autoHash(chunkX,chunkY,'amount'+num)*12)}));
        const shop=new Shop('AutoFarm Market',15,16*32,7*32,stock,2); level.map[7][16]=shop; level.map[9][14]=new_tile_from_num(15,14*32,9*32);
    }
}

function autoHash(x,y,salt) { let h=2166136261,s=AUTO_WORLD_SEED+':'+x+':'+y+':'+salt; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);} return (h>>>0)/4294967295; }

function openAutoShop(shop) {
    autoModalObject=shop; openAutoModal(shop.name,`<p>This merchant sells its generated stock. Every market carries fruit, vegetables and seeds, plus a changing selection of tools, robots, machines and commands.</p><h2>BUY</h2><div class="auto-grid">${shop.inv.filter(Boolean).map(item=>autoShopRow(item)).join('')}</div><p>Take produce and gathered resources to the nearby sales cart to earn money.</p>`);
    document.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{const index=Number(b.dataset.buy),item=shop.inv[index];if(!item||item.amount<1)return;const cost=shop.getBuyPrice(item.name);if(player.coins>=cost&&addAutoItem(item_name_to_num(item.name),1)){player.coins-=cost;shop.updateItemStock(item.name,item.amount-1);openAutoShop(shop);}});
}
function autoShopRow(item){const i=autoModalObject.inv.indexOf(item),cost=autoModalObject.getBuyPrice(item.name),disabled=item.amount<1||player.coins<cost;return `<div class="auto-row"><img src="${autoItemPath(item.name)}"><span>${item.name}<br>${cost} coins · ${item.amount} left</span><button data-buy="${i}" ${disabled?'disabled':''}>${item.amount<1?'SOLD OUT':'BUY'}</button></div>`;}

function openAutoCart(level) {
    const shop=autoMarketShop(level),sellable=player.inv.map((item,index)=>({item,index})).filter(entry=>entry.item&&entry.item.price>0);
    autoModalObject=shop;openAutoModal('Sales Cart',`<p>The cart buys crops, fruit, gathered resources and other valuable items from you. Robots can also deliver items here automatically.</p><h2>SELL TO CART</h2><div class="auto-grid">${sellable.map(entry=>autoCartRow(entry.item,entry.index,shop)).join('')||'<p>You have nothing sellable yet.</p>'}</div>`);
    document.querySelectorAll('[data-cart-sell]').forEach(button=>button.onclick=()=>sellAutoCartItem(level,Number(button.dataset.cartSell),button.dataset.all==='true'));
}
function autoMarketShop(level){for(const row of level.map)for(const tile of row)if(tile&&tile.class==='Shop')return tile;return null;}
function autoCartRow(item,index,shop){const price=(shop&&shop.getSellPrice(item.name))||Math.max(1,Math.round(item.price*.75));return `<div class="auto-row"><img src="${autoItemPath(item.name)}"><span>${item.name} ×${item.amount}<br>${price} coins each</span><button data-cart-sell="${index}">SELL 1</button><button data-cart-sell="${index}" data-all="true">SELL ALL</button></div>`;}
function sellAutoCartItem(level,index,sellAll){const item=player.inv[index],shop=autoMarketShop(level);if(!item||item.price<=0)return;const amount=sellAll?item.amount:1,price=(shop&&shop.getSellPrice(item.name))||Math.max(1,Math.round(item.price*.75));player.coins+=price*amount;if(shop)shop.recordItemSold(item.name,amount);item.amount-=amount;if(item.amount<=0)player.inv[index]=0;openAutoCart(level);}

function openAutoChest(chest) {
    closeAutoModal();
    mouse_item=0;
    player.talking=chest;
}

function openAutoBackpack(backpack){closeAutoModal();mouse_item=0;player.talking=backpack;}
function closeAutoContainer(){const container=player.talking;if(!container||!['Chest','Backpack'].includes(container.class))return;if(mouse_item){addAutoItem(item_name_to_num(mouse_item.name),mouse_item.amount);mouse_item=0;}if(container.class==='Chest')syncAutoChest(container);player.talking=0;robotBoomButton.hide();}
function mouseReleased(){if(mouseButton!==LEFT||!autoJoined||paused||autoTextInputActive())return;if(player.talking&&['Chest','Backpack'].includes(player.talking.class)){handleAutoStorageMouse(player.talking);return;}const slot=autoHotbarSlotAt(mouseX,mouseY);if(slot>=0)swapAutoCursor(player.inv,slot);}
function autoHotbarSlotAt(x,y){const left=canvasWidth/2-256;if(y<canvasHeight-64||y>canvasHeight||x<left||x>=left+512)return-1;return Math.floor((x-left)/64);}
function autoChestSlotAt(x,y){const left=canvasWidth/4+10,top=canvasHeight/4+40,col=Math.floor((x-left)/90),row=Math.floor((y-top)/90);if(row<0||row>=3||col<0||col>=4||x-left-col*90>74||y-top-row*90>74)return null;return{row,col};}
function handleAutoStorageMouse(container){const hotbar=autoHotbarSlotAt(mouseX,mouseY),cell=autoChestSlotAt(mouseX,mouseY),transferAll=keyIsDown(special_key);if(hotbar>=0){if(transferAll&&player.inv[hotbar])transferAutoItemToStorage(container,hotbar);else if(!(container.class==='Backpack'&&player.inv[hotbar]&&player.inv[hotbar].class==='Backpack'))swapAutoCursor(player.inv,hotbar);}else if(cell){if(transferAll&&container.inv[cell.row][cell.col]){const item=container.inv[cell.row][cell.col];if(addAutoItem(item_name_to_num(item.name),item.amount))container.inv[cell.row][cell.col]=0;}else if(!(container.class==='Backpack'&&mouse_item&&mouse_item.class==='Backpack'))swapAutoCursor(container.inv[cell.row],cell.col);}if(container.class==='Chest')syncAutoChest(container);}
function swapAutoCursor(container,index){const target=container[index];if(mouse_item&&target&&mouse_item.class!=='Backpack'&&target.class!=='Backpack'&&mouse_item.name===target.name){target.amount+=mouse_item.amount;mouse_item=0;return;}container[index]=mouse_item||0;mouse_item=target||0;}
function transferAutoItemToStorage(container,playerIndex){const item=player.inv[playerIndex];if(!item||(container.class==='Backpack'&&item.class==='Backpack'))return;if(item.class!=='Backpack')for(const row of container.inv)for(const stored of row)if(stored&&stored.name===item.name){stored.amount+=item.amount;player.inv[playerIndex]=0;return;}for(const row of container.inv){const empty=row.indexOf(0);if(empty>=0){row[empty]=item;player.inv[playerIndex]=0;return;}}}
function syncAutoChest(chest){setAutoCell({row:Math.round(chest.pos.y/tileSize),col:Math.round(chest.pos.x/tileSize)},chest);}

function openAutoRobot(robot) {
    autoModalObject=robot;
    const inventoryEntries=player.inv.map((item,i)=>({item,i})).filter(v=>v.item);
    const commands=inventoryEntries.filter(v=>v.item.class==='Command');
    const selectors=inventoryEntries.filter(v=>v.item.class!=='Command');
    const cargo=robot.inv.map((item,i)=>({item,i})).filter(v=>v.item);
    openAutoModal(robot.name,`<p>The shared Cloudy Meadows robot engine executes command disks in order. Put tools/seeds in ROBOT INVENTORY, then place a matching selector immediately after INTERACT or a chest command.</p><h2>PROGRAM</h2><div class="program">${robot.instructions.map((entry,i)=>entry?`<button class="auto-command remove" data-remove="${i}">${entry.name}</button>`:'').join('')}</div><h2>COMMAND DISKS</h2>${commands.map(v=>`<button class="auto-command" data-program="${v.i}">${v.item.name} ×${v.item.amount}</button>`).join('')||'<p>Buy command disks at markets.</p>'}<h2>ITEM SELECTORS</h2>${selectors.map(v=>`<button class="auto-command" data-program="${v.i}">${v.item.name}</button>`).join('')}<h2>ROBOT INVENTORY</h2><div class="auto-grid">${cargo.map(v=>`<div class="auto-row"><span>${v.item.name} ×${v.item.amount}</span><button data-robot-program="${v.i}">SELECTOR</button><button data-unload="${v.i}">TAKE</button></div>`).join('')||'<p>Empty. Load a hoe, shovel, seeds, or crops below.</p>'}</div><h2>LOAD FROM PLAYER</h2>${selectors.map(v=>`<button class="auto-command" data-load="${v.i}">${v.item.name} ×${v.item.amount}</button>`).join('')}<p>Fuel: ${robot.fuel}/${robot.max_fuel} · ${robot.status}</p><button class="auto-command" data-run>${robot.move_bool?'PAUSE':'RUN'}</button>`);
    document.querySelectorAll('[data-program]').forEach(button=>button.onclick=()=>{
        const invIndex=Number(button.dataset.program),empty=robot.instructions.indexOf(0),item=player.inv[invIndex];
        if(empty>=0&&item){robot.instructions[empty]=new_item_from_num(item_name_to_num(item.name),1);if(item.class==='Command'&&--item.amount<=0)player.inv[invIndex]=0;openAutoRobot(robot);}
    });
    document.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{
        const i=Number(button.dataset.remove),entry=robot.instructions[i];if(entry&&entry.class==='Command')addAutoItem(item_name_to_num(entry.name),1);robot.instructions[i]=0;openAutoRobot(robot);
    });
    document.querySelectorAll('[data-robot-program]').forEach(button=>button.onclick=()=>{
        const item=robot.inv[Number(button.dataset.robotProgram)],empty=robot.instructions.indexOf(0);if(item&&empty>=0){robot.instructions[empty]=new_item_from_num(item_name_to_num(item.name),1);openAutoRobot(robot);}
    });
    document.querySelectorAll('[data-load]').forEach(button=>button.onclick=()=>{
        const invIndex=Number(button.dataset.load),item=player.inv[invIndex];if(!item)return;
        let slot=robot.inv.find(entry=>entry&&entry.name===item.name);if(!slot){const empty=robot.inv.indexOf(0);if(empty<0)return;slot=new_item_from_num(item_name_to_num(item.name),0);robot.inv[empty]=slot;}
        slot.amount+=item.amount;player.inv[invIndex]=0;openAutoRobot(robot);
    });
    document.querySelectorAll('[data-unload]').forEach(button=>button.onclick=()=>{
        const i=Number(button.dataset.unload),item=robot.inv[i];if(item&&addAutoItem(item_name_to_num(item.name),item.amount)){robot.inv[i]=0;openAutoRobot(robot);}
    });
    document.querySelector('[data-run]').onclick=()=>{robot.move_bool=!robot.move_bool;openAutoRobot(robot);};
}

function openAutoModal(title,html){const modal=document.querySelector('#autofarm-modal');document.querySelector('#modal-title').textContent=title;document.querySelector('#modal-content').innerHTML=html;modal.classList.add('open');modal.setAttribute('aria-hidden','false');}
function closeAutoModal(){const modal=document.querySelector('#autofarm-modal');modal.classList.remove('open');modal.setAttribute('aria-hidden','true');autoModalObject=null;}
function bindAutoModal(){document.querySelector('#modal-close').onclick=closeAutoModal;document.querySelector('#autofarm-modal').onclick=e=>{if(e.target.id==='autofarm-modal')closeAutoModal();};}
function autoItemPath(name){const paths={Hoe:'Hoe.png',Shovel:'shovel.png',Axe:'Axe.png','Corn Seed':'Corn_Seed_bag.png',Corn:'Corn_item.png','Strawberry Seed':'SeedBag_Stawberry.png',Strawberries:'Stawberry.png',Chest:'Chest.png',Backpack:'backPack.png',Bed:'../tiles/Bed.png',Robot1:'robot2.png',Robot2:'robot_water.png',Robot3:'robot.png',Carrot:'carrot.png',Pumpkin:'Pumpkin.png'};return '../images/items/'+(paths[name]||'junk.png');}

function serializeAutoItem(item){if(!item)return 0;const data={name:item.name,amount:item.amount};if(item.class==='Backpack')data.inv=item.inv.map(row=>row.map(serializeAutoItem));return data;}
function deserializeAutoItem(data){if(!data)return 0;const item=new_item_from_num(item_name_to_num(data.name),data.amount);if(item&&item.class==='Backpack'&&data.inv)item.inv=data.inv.map(row=>row.map(deserializeAutoItem));return item;}
function serializeAutoTile(tile){if(!tile)return null;const data={name:tile.name,class:tile.class,age:tile.age,variant:tile.variant};if(tile.under_tile)data.underTile=serializeAutoTile(tile.under_tile);if(tile.class==='Shop')data.inv=tile.inv.map(serializeAutoItem);if(tile.class==='Robot'){data.instructions=tile.instructions.map(i=>i&&i.name||0);data.inv=tile.inv.map(serializeAutoItem);data.facing=tile.facing;data.fuel=tile.fuel;data.move_bool=tile.move_bool;}if(tile.class==='Chest')data.inv=tile.inv.map(row=>row.map(serializeAutoItem));return data;}
function deserializeAutoTile(data,col,row){if(!data)return new_tile_from_num(2,col*32,row*32);if(data.name==='rock')return new Tile('rock',139,col*32,row*32,true,-1);if(data.class==='Shop'){const inv=(data.inv||[]).filter(Boolean).map(i=>({num:item_name_to_num(i.name),amount:i.amount}));return new Shop(data.name,15,col*32,row*32,inv,2);}let num=tile_name_to_num(data.name),tile=new_tile_from_num(num,col*32,row*32);if(!tile)return new_tile_from_num(2,col*32,row*32);if(data.underTile)tile.under_tile=deserializeAutoTile(data.underTile,col,row);if(typeof data.age==='number')tile.age=data.age;if(data.class==='Robot'){tile.instructions=data.instructions.map(n=>n?new_item_from_num(item_name_to_num(n),1):0);tile.inv=data.inv.map(deserializeAutoItem);tile.facing=data.facing;tile.fuel=data.fuel;tile.move_bool=data.move_bool;tile.playerOwned=true;}if(data.class==='Chest'){tile.inv=data.inv.map(items=>items.map(deserializeAutoItem));tile.playerOwned=true;}return tile;}

function readAutoSave(){try{return JSON.parse(localStorage.getItem(AUTO_SAVE_KEY))||{levels:{}};}catch(_){return{levels:{}};}}
function saveAutoFarm(){const saved={inventoryVersion:2,days,time,timephase,currentWeather,lastRainDay,lastFrogRainDay,currentLevel_x,currentLevel_y,x:player.pos.x,y:player.pos.y,coins:player.coins,hunger:player.hunger,hand:player.hand,inv:player.inv.map(serializeAutoItem),levels:{}};for(let y=0;y<levels.length;y++)for(let x=0;x<levels[y].length;x++)if(levels[y][x])saved.levels[x+','+y]=levels[y][x].map.map(row=>row.map(serializeAutoTile));localStorage.setItem(AUTO_SAVE_KEY,JSON.stringify(saved));autoSave=saved;}
function restoreAutoPlayer(){if(!autoSave)return;days=autoSave.days||0;time=autoSave.time||0;timephase=autoSave.timephase||0;currentWeather=autoSave.currentWeather||'clear';lastRainDay=autoSave.lastRainDay??lastRainDay;lastFrogRainDay=autoSave.lastFrogRainDay??lastFrogRainDay;currentLevel_x=autoSave.currentLevel_x||AUTO_ORIGIN;currentLevel_y=autoSave.currentLevel_y||AUTO_ORIGIN;ensureAutoNeighbors();player.pos.x=autoSave.x??player.pos.x;player.pos.y=autoSave.y??player.pos.y;player.coins=autoSave.coins??player.coins;player.hunger=autoSave.hunger??player.hunger;player.hand=autoSave.hand||0;if(autoSave.inv){player.inv=autoSave.inv.map(deserializeAutoItem);if((autoSave.inventoryVersion||0)<2)migrateAutoInventory();}}
function migrateAutoInventory(){if(player.inv.some(item=>item&&item.class==='Backpack'))return;let replaceIndex=player.inv.findIndex(item=>item&&item.class==='Seed');if(replaceIndex<0)replaceIndex=player.inv.findIndex(item=>!item);if(replaceIndex<0)replaceIndex=player.inv.length-1;const displaced=player.inv[replaceIndex],backpack=new_item_from_num(33,1);player.inv[replaceIndex]=backpack;if(displaced)backpack.inv[0][0]=displaced;for(let index=0;index<player.inv.length;index++){const item=player.inv[index];if(index!==replaceIndex&&item&&item.class==='Seed'){const empty=backpack.inv.flat().findIndex(entry=>!entry),row=Math.floor(empty/4),col=empty%4;if(empty>=0){backpack.inv[row][col]=item;player.inv[index]=0;}}}if(!backpack.inv.flat().some(item=>item&&item.name==='Bed')){const empty=backpack.inv.flat().findIndex(entry=>!entry);if(empty>=0)backpack.inv[Math.floor(empty/4)][empty%4]=new_item_from_num(43,1);}}
function restoreAutoLevel(level,saved){for(let r=0;r<saved.length;r++)for(let c=0;c<saved[r].length;c++)level.map[r][c]=deserializeAutoTile(saved[r][c],c,r);}

function autoPatchKey(x,y,row,col){return x+','+y+','+row+','+col;}
function bindAutoMultiplayerClient(){const form=document.querySelector('#autofarm-name-form'),input=document.querySelector('#autofarm-name'),client=document.querySelector('#autofarm-client'),chatForm=document.querySelector('#autofarm-chat-form');input.value=localStorage.getItem('autofarm-player-name')||'';form.addEventListener('submit',event=>{event.preventDefault();const name=cleanAutoPlayerName(input.value);if(!name){input.setCustomValidity('Enter a farmer name.');input.reportValidity();return;}input.setCustomValidity('');autoPlayerName=name;localStorage.setItem('autofarm-player-name',name);autoJoined=true;document.querySelector('#autofarm-name-screen').style.display='none';connectAutoFarmRoom();});input.addEventListener('input',()=>input.setCustomValidity(''));client.addEventListener('toggle',()=>{if(client.open){autoUnreadChat=0;updateAutoUnreadChat();scrollAutoChat();}});chatForm.addEventListener('submit',event=>{event.preventDefault();const chatInput=document.querySelector('#autofarm-chat-input'),message=chatInput.value.trim();if(!message||!autoSocket||autoSocket.readyState!==WebSocket.OPEN)return;sendAutoMessage({type:'chat',text:message});chatInput.value='';});window.addEventListener('pagehide',()=>{if(player)saveAutoFarm();});refreshAutoServerInfo();}
function cleanAutoPlayerName(value){return String(value||'').replace(/[\u0000-\u001f\u007f]/g,'').trim().replace(/\s+/g,' ').slice(0,20);}
function autoTextInputActive(){const active=document.activeElement;return !!active&&(['INPUT','TEXTAREA','SELECT'].includes(active.tagName)||active.isContentEditable);}
async function refreshAutoServerInfo(){if(autoJoined)return;try{const response=await fetch('/api/autofarm/room?room=meadow-one',{cache:'no-store'}),info=await response.json();document.querySelector('#join-server-state').textContent=info.status==='ready'?'SERVER ONLINE':'SERVER UNAVAILABLE';document.querySelector('#join-player-count').textContent=autoPlayerCountLabel(info.totalPlayers||0);setAutoDot(document.querySelector('#join-server-info .socket-dot'),'online');}catch(_){document.querySelector('#join-server-state').textContent='SERVER OFFLINE';setAutoDot(document.querySelector('#join-server-info .socket-dot'),'offline');}if(!autoJoined)setTimeout(refreshAutoServerInfo,5000);}
function connectAutoFarmRoom(){if(!location.host||!autoJoined)return;if(autoSocket&&(autoSocket.readyState===WebSocket.OPEN||autoSocket.readyState===WebSocket.CONNECTING))return;clearTimeout(autoReconnectTimer);setAutoSocketState('connecting');const scheme=location.protocol==='https:'?'wss:':'ws:',id=localStorage.getItem('autofarm-player-id')||crypto.randomUUID?.()||Math.random().toString(36).slice(2);localStorage.setItem('autofarm-player-id',id);const socket=new WebSocket(`${scheme}//${location.host}/api/autofarm/room?room=meadow-one&player=${encodeURIComponent(id)}`);autoSocket=socket;socket.onopen=()=>{setAutoSocketState('online');appendAutoSystemChat('Connected to meadow-one.');sendAutoPresence();};socket.onmessage=event=>handleAutoSocketMessage(event,id);socket.onclose=()=>{if(autoSocket===socket)autoSocket=null;autoPeers={};updateAutoPlayerCount(0);setAutoSocketState('offline');if(socket.autoIntentionalClose||!autoJoined)return;appendAutoSystemChat('Connection lost. Reconnecting…');autoReconnectTimer=setTimeout(connectAutoFarmRoom,4000);};socket.onerror=()=>socket.close();}
function handleAutoSocketMessage(event,id){let message;try{message=JSON.parse(event.data);}catch(_){return;}if(message.type==='snapshot'){for(const[key,value]of Object.entries(message.changes||{}))applyAutoPatch(key,value);autoPeers=message.players||{};if(message.server)updateAutoServerInfo(message.server);}else if(message.type==='server')updateAutoServerInfo(message);else if(message.type==='patch'&&message.playerId!==id)applyAutoPatch(message.key,message.value);else if(message.type==='presence'&&message.player.id!==id)autoPeers[message.player.id]=message.player;else if(message.type==='leave')delete autoPeers[message.id];else if(message.type==='chat')appendAutoChat(message,message.playerId===id);}
function updateAutoServerInfo(info){if(info.room)document.querySelector('#server-room').textContent=info.room;if(Number.isInteger(info.totalPlayers))updateAutoPlayerCount(info.totalPlayers);}
function updateAutoPlayerCount(total){document.querySelector('#farmers-online').textContent=autoPlayerCountLabel(total);}
function autoPlayerCountLabel(total){return total+' '+(total===1?'PLAYER':'PLAYERS');}
function setAutoSocketState(state){const label=document.querySelector('#net-state'),connection=document.querySelector('#server-connection'),dot=document.querySelector('#autofarm-client .socket-dot');label.textContent=state.toUpperCase();label.className=state==='online'?'online':'';connection.textContent=state==='online'?'CONNECTED':state.toUpperCase();setAutoDot(dot,state);const input=document.querySelector('#autofarm-chat-input');if(input)input.disabled=state!=='online';}
function setAutoDot(dot,state){if(dot)dot.className='socket-dot '+(state==='online'?'online':state==='connecting'?'connecting':'');}
function appendAutoChat(message,self){const log=document.querySelector('#autofarm-chat-log'),row=document.createElement('p'),name=document.createElement('strong'),body=document.createTextNode(': '+message.text);row.className='chat-message'+(self?' self':'');name.textContent=message.name;row.append(name,body);log.appendChild(row);while(log.children.length>80)log.firstElementChild.remove();if(!document.querySelector('#autofarm-client').open&&!self){autoUnreadChat++;updateAutoUnreadChat();}scrollAutoChat();}
function appendAutoSystemChat(text){const log=document.querySelector('#autofarm-chat-log'),row=document.createElement('p');row.className='chat-message system';row.textContent=text;log.appendChild(row);while(log.children.length>80)log.firstElementChild.remove();scrollAutoChat();}
function scrollAutoChat(){const log=document.querySelector('#autofarm-chat-log');requestAnimationFrame(()=>{log.scrollTop=log.scrollHeight;});}
function updateAutoUnreadChat(){const badge=document.querySelector('#chat-unread');badge.textContent=autoUnreadChat;badge.hidden=autoUnreadChat===0;}
function sendAutoMessage(message){if(autoSocket&&autoSocket.readyState===WebSocket.OPEN)autoSocket.send(JSON.stringify(message));}
function sendAutoPresence(){sendAutoMessage({type:'presence',player:{id:localStorage.getItem('autofarm-player-id'),name:autoPlayerName,levelX:currentLevel_x,levelY:currentLevel_y,x:player.pos.x,y:player.pos.y,facing:player.facing}});}
function sendAutoPresenceThrottled(force=false){const now=millis();if(force||now-autoLastPresence>=100){autoLastPresence=now;sendAutoPresence();}}
function applyAutoPatch(key,value){const p=key.split(',').map(Number);if(p.length!==4)return;ensureAutoLevel(p[0],p[1]);levels[p[1]][p[0]].map[p[2]][p[3]]=deserializeAutoTile(value,p[3],p[2]);webglRoomGeometryCache.levelX=null;}

// Compatibility hooks required by shared classes but owned by the story UI.
function playerCanEditContainer(){return true;}
function checkForSpace(owner,itemNum){if(owner!==player)return owner.inv.some(i=>i===0||(i&&i.name===all_items[itemNum].name));const definition=all_items[itemNum];if(!definition)return false;if(definition.class==='Backpack')return player.inv.some(item=>!item);if(player.inv.some(item=>!item||(item&&item.name===definition.name)))return true;return player.inv.some(item=>item&&item.class==='Backpack'&&item.inv.some(row=>row.some(stored=>!stored||stored.name===definition.name)));}
function addItem(owner,itemNum,amount){if(owner===player)return addAutoItem(itemNum,amount);let slot=owner.inv.find(i=>i&&i.name===all_items[itemNum].name);if(!slot){const e=owner.inv.indexOf(0);if(e<0)return false;slot=new_item_from_num(itemNum,0);owner.inv[e]=slot;}slot.amount+=amount;return true;}
function addMoney(amount){player.coins+=amount;}
function getEffectiveItem(){return true;}
function getEffectiveTile(){return true;}
function shouldReduceMotion(){return false;}
