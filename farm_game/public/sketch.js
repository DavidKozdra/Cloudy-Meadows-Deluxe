/*
@authors: Whole
@brief: Outputs to canvas
*/

//main stuff starts here

// Mobile detection - check screen size as fallback for DevTools emulation
var isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
    || ('ontouchstart' in window) 
    || (navigator.maxTouchPoints > 0)
    || (window.innerWidth <= 1024 && window.matchMedia("(pointer: coarse)").matches)
    || (window.innerWidth <= 768); // Fallback: treat small screens as mobile

// Virtual input state for mobile controls
var virtualInput = {
    up: false,
    down: false,
    left: false,
    right: false,
    interact: false,
    eat: false,
    special: false,
    pause: false,
    quest: false
};

var cloudCount = 8;
var clouds = [];
var tileSize = 32;
var canvasWidth = 23 * tileSize;
var canvasHeight = 19 * tileSize;
var player;
var levels = [];
var currentLevel_y = 2;
var currentLevel_x = 4;
var visitedLocations = new Set(); // Track all locations player has visited
var lastMili = 0;
var maxHunger = 6;
var time = 0;
var timephase = 0;
var lastTimeMili = 0;
var lastHungerMili = 0;
var days = 0;
var title_screen = true;
var dificulty_screen = false;
var lose_screen = false;
var dificulty = 0;
var customRules = null;
var save_anim = 0;
var all_tiles = [];
var all_items = [];
var Dialouge_JSON = 0;
var paused = false;
var mouse_item = 0;
var localData = localDataStorage( 'passphrase.life' )
var musicplayer = {};

// Mouse wheel hotbar scroll
function handleHotbarScroll(event) {
    if (typeof player !== 'undefined' && player.inv && !title_screen && !paused && !player.show_quests) {
        const slots = 8;
        if (event.deltaY > 0) {
            // Scroll down: next slot
            player.hand = (player.hand + 1) % slots;
        } else if (event.deltaY < 0) {
            // Scroll up: previous slot
            player.hand = (player.hand - 1 + slots) % slots;
        }
    }
}

// Attach event listener
window.addEventListener('wheel', handleHotbarScroll, { passive: false });

// ==================== MOBILE CONTROLS SETUP ====================
function setupMobileControls() {
    const mobileControls = document.getElementById('mobile-controls');
    if (!mobileControls) {
        console.log('Mobile controls element not found');
        return;
    }
    
    console.log('Setting up mobile controls, isMobile:', isMobile);
    
    // Show controls on mobile (or small screens)
    if (isMobile) {
        mobileControls.classList.add('active');
        console.log('Mobile controls activated');
    }
    
    // Helper to setup touch events for a button
    function setupButton(id, inputKey, isToggle = false) {
        const btn = document.getElementById(id);
        if (!btn) return;
        
        // Prevent default touch behaviors
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            virtualInput[inputKey] = true;
            btn.classList.add('pressed');
        }, { passive: false });
        
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (!isToggle) {
                virtualInput[inputKey] = false;
            }
            btn.classList.remove('pressed');
        }, { passive: false });
        
        btn.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            virtualInput[inputKey] = false;
            btn.classList.remove('pressed');
        }, { passive: false });
        
        // Also support mouse for testing on desktop
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            virtualInput[inputKey] = true;
            btn.classList.add('pressed');
        });
        
        btn.addEventListener('mouseup', (e) => {
            e.preventDefault();
            if (!isToggle) {
                virtualInput[inputKey] = false;
            }
            btn.classList.remove('pressed');
        });
        
        btn.addEventListener('mouseleave', (e) => {
            virtualInput[inputKey] = false;
            btn.classList.remove('pressed');
        });
    }
    
    // D-Pad buttons
    setupButton('dpad-up', 'up');
    setupButton('dpad-down', 'down');
    setupButton('dpad-left', 'left');
    setupButton('dpad-right', 'right');
    
    // Action buttons
    setupButton('btn-eat', 'eat');
    
    // Interact button with long-press for special
    const interactBtn = document.getElementById('btn-interact');
    if (interactBtn) {
        let longPressTimer = null;
        let isLongPress = false;
        const LONG_PRESS_DURATION = 300; // ms
        
        const startPress = (e) => {
            e.preventDefault();
            isLongPress = false;
            interactBtn.classList.add('pressed');
            virtualInput.interact = true;
            
            longPressTimer = setTimeout(() => {
                isLongPress = true;
                virtualInput.special = true;
                interactBtn.classList.add('long-press');
            }, LONG_PRESS_DURATION);
        };
        
        const endPress = (e) => {
            e.preventDefault();
            clearTimeout(longPressTimer);
            interactBtn.classList.remove('pressed', 'long-press');
            virtualInput.interact = false;
            virtualInput.special = false;
        };
        
        interactBtn.addEventListener('touchstart', startPress, { passive: false });
        interactBtn.addEventListener('touchend', endPress, { passive: false });
        interactBtn.addEventListener('touchcancel', endPress, { passive: false });
        interactBtn.addEventListener('mousedown', startPress);
        interactBtn.addEventListener('mouseup', endPress);
        interactBtn.addEventListener('mouseleave', endPress);
    }
    
    // Hotbar scroll buttons
    const hotbarPrev = document.getElementById('hotbar-prev');
    const hotbarNext = document.getElementById('hotbar-next');
    
    if (hotbarPrev) {
        hotbarPrev.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (typeof player !== 'undefined' && player.inv && !title_screen) {
                player.hand = (player.hand - 1 + 8) % 8;
            }
            hotbarPrev.classList.add('pressed');
        }, { passive: false });
        hotbarPrev.addEventListener('touchend', (e) => {
            e.preventDefault();
            hotbarPrev.classList.remove('pressed');
        }, { passive: false });
        hotbarPrev.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof player !== 'undefined' && player.inv && !title_screen) {
                player.hand = (player.hand - 1 + 8) % 8;
            }
        });
    }
    
    if (hotbarNext) {
        hotbarNext.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (typeof player !== 'undefined' && player.inv && !title_screen) {
                player.hand = (player.hand + 1) % 8;
            }
            hotbarNext.classList.add('pressed');
        }, { passive: false });
        hotbarNext.addEventListener('touchend', (e) => {
            e.preventDefault();
            hotbarNext.classList.remove('pressed');
        }, { passive: false });
        hotbarNext.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof player !== 'undefined' && player.inv && !title_screen) {
                player.hand = (player.hand + 1) % 8;
            }
        });
    }
    
    // Top-left menu buttons (pause & quests)
    const mobilePauseBtn = document.getElementById('btn-mobile-pause');
    const mobileQuestsBtn = document.getElementById('btn-mobile-quests');
    
    if (mobilePauseBtn) {
        mobilePauseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!title_screen && typeof player !== 'undefined') {
                paused = !paused;
            }
        });
        mobilePauseBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            mobilePauseBtn.classList.add('pressed');
        }, { passive: false });
        mobilePauseBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            mobilePauseBtn.classList.remove('pressed');
            if (!title_screen && typeof player !== 'undefined') {
                paused = !paused;
            }
        }, { passive: false });
    }
    
    if (mobileQuestsBtn) {
        mobileQuestsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!title_screen && !paused && typeof player !== 'undefined') {
                player.show_quests = !player.show_quests;
            }
        });
        mobileQuestsBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            mobileQuestsBtn.classList.add('pressed');
        }, { passive: false });
        mobileQuestsBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            mobileQuestsBtn.classList.remove('pressed');
            if (!title_screen && !paused && typeof player !== 'undefined') {
                player.show_quests = !player.show_quests;
            }
        }, { passive: false });
    }
}

// Show/hide mobile controls based on game state
function updateMobileControlsVisibility() {
    const mobileControls = document.getElementById('mobile-controls');
    if (!mobileControls || !isMobile) return;
    
    if (title_screen || paused) {
        mobileControls.classList.remove('active');
    } else {
        mobileControls.classList.add('active');
    }
}

// Update mobile status on window resize
function updateMobileStatus() {
    const wasMobile = isMobile;
    isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
        || ('ontouchstart' in window) 
        || (navigator.maxTouchPoints > 0)
        || (window.innerWidth <= 1024 && window.matchMedia("(pointer: coarse)").matches)
        || (window.innerWidth <= 768);
    
    // If mobile status changed, update controls
    if (wasMobile !== isMobile) {
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            if (isMobile && !title_screen && !paused) {
                mobileControls.classList.add('active');
            } else {
                mobileControls.classList.remove('active');
            }
        }
        console.log('Mobile status changed:', isMobile);
    }
}

// p5.js window resize callback
function windowResized() {
    // Canvas resize is handled by resizeCanvasForFullscreen in preload.js
    // This function is here for any additional p5.js resize handling needed
    if (typeof resizeCanvasForFullscreen === 'function') {
        resizeCanvasForFullscreen();
    }
}

// Initialize mobile controls after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMobileControls);
} else {
    setupMobileControls();
}

// ============================================
// Mobile Inventory UI System
// ============================================
var mobileInventoryState = {
    isOpen: false,
    selectedSlot: null,  // { source: 'container'|'player'|'instructions', row: number, col: number }
    containerType: null, // 'Chest', 'Backpack', 'Robot'
    containerRef: null   // Reference to the actual container object
};

function setupMobileInventoryUI() {
    const overlay = document.getElementById('mobile-inventory-overlay');
    const closeBtn = document.getElementById('mobile-inv-close');
    const transferAllBtn = document.getElementById('mobile-inv-transfer-all');
    const splitBtn = document.getElementById('mobile-inv-split');
    
    if (!overlay) return;
    
    // Close button
    if (closeBtn) {
        closeBtn.addEventListener('click', closeMobileInventory);
        closeBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            closeMobileInventory();
        });
    }
    
    // Transfer all button
    if (transferAllBtn) {
        transferAllBtn.addEventListener('click', mobileTransferAll);
        transferAllBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            mobileTransferAll();
        });
    }
    
    // Split button
    if (splitBtn) {
        splitBtn.addEventListener('click', mobileSplitStack);
        splitBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            mobileSplitStack();
        });
    }
}

function openMobileInventory(containerType, containerRef) {
    if (!isMobile) return; // Only on mobile
    
    const overlay = document.getElementById('mobile-inventory-overlay');
    if (!overlay) return;
    
    mobileInventoryState.isOpen = true;
    mobileInventoryState.containerType = containerType;
    mobileInventoryState.containerRef = containerRef;
    mobileInventoryState.selectedSlot = null;
    
    overlay.style.display = 'flex';
    
    // Hide the p5 buttons
    robotPlayButton.hide();
    robotPauseButton.hide();
    robotBoomButton.hide();
    
    // Update the panel based on container type
    updateMobileInventoryUI();
}

function closeMobileInventory() {
    const overlay = document.getElementById('mobile-inventory-overlay');
    if (!overlay) return;
    
    mobileInventoryState.isOpen = false;
    mobileInventoryState.selectedSlot = null;
    mobileInventoryState.containerType = null;
    mobileInventoryState.containerRef = null;
    
    overlay.style.display = 'none';
    
    // Clear mouse item if any on mobile
    if (isMobile && mouse_item !== 0) {
        // Return mouse_item to player inventory if possible
        if (checkForSpace(player, item_name_to_num(mouse_item.name))) {
            addItem(player, item_name_to_num(mouse_item.name), mouse_item.amount);
        }
        mouse_item = 0;
    }
    
    // Close the talking state
    if (player && player.talking) {
        if (player.talking.class === 'Robot') {
            player.talking.fuel_timer = player.talking.max_fuel_timer;
            player.talking.move_bool = temp_move_bool;
        }
        player.oldlooking_name = player.talking.name;
        player.talking = 0;
    }
}

function updateMobileInventoryUI() {
    const titleEl = document.getElementById('mobile-inv-title');
    const containerGrid = document.getElementById('mobile-inv-container-grid');
    const playerGrid = document.getElementById('mobile-inv-player-grid');
    const containerSection = document.getElementById('mobile-inv-container-section');
    const containerLabel = document.getElementById('mobile-inv-container-label');
    const actionsDiv = document.getElementById('mobile-inv-actions');
    const infoDiv = document.getElementById('mobile-inv-selected-info');
    const instructionsEl = document.getElementById('mobile-inv-instructions');
    
    if (!containerGrid || !playerGrid) return;
    
    const container = mobileInventoryState.containerRef;
    const containerType = mobileInventoryState.containerType;
    
    // Update title
    if (titleEl) {
        titleEl.textContent = container ? container.name : 'Inventory';
    }
    
    // Clear existing grids
    containerGrid.innerHTML = '';
    playerGrid.innerHTML = '';
    
    // Remove any existing robot sections
    const existingRobotInfo = document.getElementById('mobile-inv-robot-info');
    const existingRobotControls = document.getElementById('mobile-inv-robot-controls');
    const existingInstructionsSection = document.getElementById('mobile-inv-instructions-section');
    if (existingRobotInfo) existingRobotInfo.remove();
    if (existingRobotControls) existingRobotControls.remove();
    if (existingInstructionsSection) existingInstructionsSection.remove();
    
    // Update instructions text
    if (instructionsEl) {
        if (containerType === 'Robot') {
            instructionsEl.textContent = 'Tap to select, tap destination to move. Add commands to instruction slots.';
        } else {
            instructionsEl.textContent = 'Tap an item to select, tap destination to move';
        }
    }
    
    // Build container inventory grid
    if (containerType === 'Chest' || containerType === 'Backpack') {
        containerLabel.textContent = containerType === 'Chest' ? 'Chest Storage' : 'Backpack Storage';
        containerGrid.style.gridTemplateColumns = 'repeat(4, 60px)';
        
        // Container has 2D array [row][col]
        for (let row = 0; row < container.inv.length; row++) {
            for (let col = 0; col < container.inv[row].length; col++) {
                const slot = createMobileSlot('container', row, col, container.inv[row][col]);
                containerGrid.appendChild(slot);
            }
        }
        
        // Add boom button for chest
        if (containerType === 'Chest') {
            const chestActionsDiv = document.createElement('div');
            chestActionsDiv.id = 'mobile-inv-chest-actions';
            chestActionsDiv.style.marginTop = '10px';
            chestActionsDiv.innerHTML = `
                <button class="mobile-inv-action-btn destroy" id="mobile-chest-boom">💥 Boom</button>
            `;
            containerSection.appendChild(chestActionsDiv);
            
            setTimeout(() => {
                const boomBtn = document.getElementById('mobile-chest-boom');
                if (boomBtn) {
                    boomBtn.onclick = () => {
                        if (confirm('Are you sure? Booming the chest will REMOVE EVERYTHING inside it!')) {
                            if (checkForSpace(player, item_name_to_num('Chest'))) {
                                addItem(player, item_name_to_num('Chest'), 1);
                                levels[currentLevel_y][currentLevel_x].map[container.pos.y / tileSize][container.pos.x / tileSize] = container.under_tile;
                                closeMobileInventory();
                            }
                        }
                    };
                }
            }, 0);
        }
    } else if (containerType === 'Robot') {
        // Robot has different structure: inv is 1D, and instructions are separate
        containerLabel.textContent = 'Robot Storage';
        containerGrid.style.gridTemplateColumns = `repeat(${Math.min(container.inv.length, 8)}, 60px)`;
        
        // Robot storage (1D)
        for (let i = 0; i < container.inv.length; i++) {
            const slot = createMobileSlot('container', 0, i, container.inv[i]);
            containerGrid.appendChild(slot);
        }
        
        // Add robot info section (fuel, status)
        const robotInfo = document.createElement('div');
        robotInfo.id = 'mobile-inv-robot-info';
        robotInfo.innerHTML = `
            <span class="mobile-inv-fuel-label">Fuel</span>
            <div class="mobile-inv-fuel-bar">
                <div class="mobile-inv-fuel-fill" style="width: ${(container.fuel / container.max_fuel) * 100}%"></div>
            </div>
            <span class="mobile-inv-fuel-label">${Math.round(container.fuel)}/${container.max_fuel}</span>
        `;
        containerSection.appendChild(robotInfo);
        
        // Add robot controls
        const robotControls = document.createElement('div');
        robotControls.id = 'mobile-inv-robot-controls';
        robotControls.innerHTML = `
            <button class="mobile-inv-robot-btn ${temp_move_bool ? 'active' : ''}" id="mobile-robot-play">▶ Play</button>
            <button class="mobile-inv-robot-btn ${!temp_move_bool ? 'active' : ''}" id="mobile-robot-pause">⏸ Pause</button>
            <button class="mobile-inv-robot-btn destroy" id="mobile-robot-destroy">🗑 Destroy</button>
        `;
        containerSection.appendChild(robotControls);
        
        // Setup robot control handlers
        setTimeout(() => {
            const playBtn = document.getElementById('mobile-robot-play');
            const pauseBtn = document.getElementById('mobile-robot-pause');
            const destroyBtn = document.getElementById('mobile-robot-destroy');
            
            if (playBtn) {
                playBtn.onclick = () => {
                    temp_move_bool = true;
                    updateMobileInventoryUI();
                };
            }
            if (pauseBtn) {
                pauseBtn.onclick = () => {
                    temp_move_bool = false;
                    updateMobileInventoryUI();
                };
            }
            if (destroyBtn) {
                destroyBtn.onclick = () => {
                    if (confirm('Are you sure? Booming the robot will REMOVE ALL its inventory and it cannot be recovered!')) {
                        if (checkForSpace(player, item_name_to_num(container.name))) {
                            addItem(player, item_name_to_num(container.name), 1);
                            levels[currentLevel_y][currentLevel_x].map[container.pos.y / tileSize][container.pos.x / tileSize] = container.under_tile;
                            closeMobileInventory();
                        }
                    }
                };
            }
        }, 0);
        
        // Add instructions grid section
        const instructionsSection = document.createElement('div');
        instructionsSection.id = 'mobile-inv-instructions-section';
        instructionsSection.innerHTML = `
            <div id="mobile-inv-instructions-label">Robot Instructions</div>
            <div id="mobile-inv-instructions-grid"></div>
        `;
        containerSection.appendChild(instructionsSection);
        
        const instructionsGrid = instructionsSection.querySelector('#mobile-inv-instructions-grid');
        for (let i = 0; i < container.instructions.length; i++) {
            const slot = createMobileInstructionSlot(i, container.instructions[i], container.current_instruction === i);
            instructionsGrid.appendChild(slot);
        }
    }
    
    // Build player inventory grid (1D array with 8 slots)
    playerGrid.style.gridTemplateColumns = 'repeat(4, 60px)';
    for (let i = 0; i < 8; i++) {
        const row = Math.floor(i / 4);
        const col = i % 4;
        const slot = createMobileSlot('player', row, col, player.inv[i], i);
        playerGrid.appendChild(slot);
    }
    
    // Update selected info
    updateMobileSelectedInfo();
}

function createMobileSlot(source, row, col, item, flatIndex = null) {
    const slot = document.createElement('div');
    slot.className = 'mobile-inv-slot' + (item === 0 ? ' empty' : '');
    slot.dataset.source = source;
    slot.dataset.row = row;
    slot.dataset.col = col;
    if (flatIndex !== null) slot.dataset.flatIndex = flatIndex;
    
    // Check if this slot is selected
    const selected = mobileInventoryState.selectedSlot;
    if (selected && selected.source === source && selected.row === row && selected.col === col) {
        slot.classList.add('selected');
    }
    
    if (item !== 0 && item) {
        // Create image
        const img = document.createElement('img');
        img.className = 'mobile-inv-slot-img';
        
        // Get the p5 image - all_imgs[png] may be an array or a single image
        try {
            let p5Img = all_imgs[item.png];
            // If it's an array, get the first element
            if (Array.isArray(p5Img)) {
                p5Img = p5Img[0];
            }
            // p5.Image has a canvas property
            if (p5Img && p5Img.canvas) {
                img.src = p5Img.canvas.toDataURL();
            } else if (p5Img && p5Img.elt) {
                // Sometimes it's an HTML element
                img.src = p5Img.elt.src || p5Img.elt.toDataURL();
            }
        } catch (e) {
            console.warn('Could not get image for item:', item.name, e);
        }
        slot.appendChild(img);
        
        // Create amount text
        if (item.amount > 1) {
            const amount = document.createElement('span');
            amount.className = 'mobile-inv-slot-amount';
            amount.textContent = item.amount > 999 ? Math.floor(item.amount / 1000) + 'K' : item.amount;
            slot.appendChild(amount);
        }
    }
    
    // Touch/click handler
    const handleSelect = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleMobileSlotTap(source, row, col, flatIndex);
    };
    
    slot.addEventListener('touchend', handleSelect, { passive: false });
    slot.addEventListener('click', handleSelect);
    
    return slot;
}

function createMobileInstructionSlot(index, item, isCurrent) {
    const slot = document.createElement('div');
    slot.className = 'mobile-inv-instruction-slot' + (isCurrent ? ' current' : '');
    slot.dataset.source = 'instructions';
    slot.dataset.index = index;
    
    // Check if selected
    const selected = mobileInventoryState.selectedSlot;
    if (selected && selected.source === 'instructions' && selected.col === index) {
        slot.classList.add('selected');
    }
    
    if (item !== 0 && item) {
        const img = document.createElement('img');
        img.className = 'mobile-inv-instruction-img';
        try {
            let p5Img = all_imgs[item.png];
            if (Array.isArray(p5Img)) {
                p5Img = p5Img[0];
            }
            if (p5Img && p5Img.canvas) {
                img.src = p5Img.canvas.toDataURL();
            } else if (p5Img && p5Img.elt) {
                img.src = p5Img.elt.src || p5Img.elt.toDataURL();
            }
        } catch (e) {
            console.warn('Could not get image for instruction:', item.name, e);
        }
        slot.appendChild(img);
    }
    
    const handleSelect = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleMobileSlotTap('instructions', 0, index, null);
    };
    
    slot.addEventListener('touchend', handleSelect, { passive: false });
    slot.addEventListener('click', handleSelect);
    
    return slot;
}

function handleMobileSlotTap(source, row, col, flatIndex) {
    const container = mobileInventoryState.containerRef;
    const containerType = mobileInventoryState.containerType;
    const selected = mobileInventoryState.selectedSlot;
    
    // Get the item in this slot
    let tappedItem = 0;
    if (source === 'player') {
        const idx = flatIndex !== null ? flatIndex : (row * 4 + col);
        tappedItem = player.inv[idx];
    } else if (source === 'container') {
        if (containerType === 'Robot') {
            tappedItem = container.inv[col];
        } else {
            tappedItem = container.inv[row][col];
        }
    } else if (source === 'instructions') {
        tappedItem = container.instructions[col];
    }
    
    // If nothing is selected yet
    if (!selected) {
        // Select this slot if it has an item
        if (tappedItem !== 0) {
            mobileInventoryState.selectedSlot = { source, row, col, flatIndex };
            updateMobileInventoryUI();
        }
        return;
    }
    
    // Something is selected - try to move/swap
    const srcSource = selected.source;
    const srcRow = selected.row;
    const srcCol = selected.col;
    const srcFlatIndex = selected.flatIndex;
    
    // Get source item
    let srcItem = 0;
    if (srcSource === 'player') {
        const idx = srcFlatIndex !== null ? srcFlatIndex : (srcRow * 4 + srcCol);
        srcItem = player.inv[idx];
    } else if (srcSource === 'container') {
        if (containerType === 'Robot') {
            srcItem = container.inv[srcCol];
        } else {
            srcItem = container.inv[srcRow][srcCol];
        }
    } else if (srcSource === 'instructions') {
        srcItem = container.instructions[srcCol];
    }
    
    // Same slot tapped - deselect
    if (srcSource === source && srcRow === row && srcCol === col) {
        mobileInventoryState.selectedSlot = null;
        updateMobileInventoryUI();
        return;
    }
    
    // Handle movement based on source and destination
    let moved = false;
    
    // Player to container
    if (srcSource === 'player' && source === 'container') {
        const playerIdx = srcFlatIndex !== null ? srcFlatIndex : (srcRow * 4 + srcCol);
        
        if (containerType === 'Robot') {
            // Player to robot storage
            if (tappedItem === 0) {
                container.inv[col] = srcItem;
                player.inv[playerIdx] = 0;
                moved = true;
            } else if (tappedItem.name === srcItem.name) {
                container.inv[col].amount += srcItem.amount;
                player.inv[playerIdx] = 0;
                moved = true;
            } else {
                // Swap
                container.inv[col] = srcItem;
                player.inv[playerIdx] = tappedItem;
                moved = true;
            }
        } else {
            // Player to chest/backpack
            // Don't allow putting backpack in backpack
            if (containerType === 'Backpack' && srcItem.class === 'Backpack') {
                // Not allowed
            } else if (tappedItem === 0) {
                container.inv[row][col] = srcItem;
                player.inv[playerIdx] = 0;
                moved = true;
            } else if (tappedItem.name === srcItem.name) {
                container.inv[row][col].amount += srcItem.amount;
                player.inv[playerIdx] = 0;
                moved = true;
            } else {
                // Swap
                container.inv[row][col] = srcItem;
                player.inv[playerIdx] = tappedItem;
                moved = true;
            }
        }
    }
    // Container to player
    else if (srcSource === 'container' && source === 'player') {
        const playerIdx = flatIndex !== null ? flatIndex : (row * 4 + col);
        
        if (containerType === 'Robot') {
            if (tappedItem === 0) {
                player.inv[playerIdx] = srcItem;
                container.inv[srcCol] = 0;
                moved = true;
            } else if (tappedItem.name === srcItem.name) {
                player.inv[playerIdx].amount += srcItem.amount;
                container.inv[srcCol] = 0;
                moved = true;
            } else {
                // Swap
                player.inv[playerIdx] = srcItem;
                container.inv[srcCol] = tappedItem;
                moved = true;
            }
        } else {
            if (tappedItem === 0) {
                player.inv[playerIdx] = srcItem;
                container.inv[srcRow][srcCol] = 0;
                moved = true;
            } else if (tappedItem.name === srcItem.name) {
                player.inv[playerIdx].amount += srcItem.amount;
                container.inv[srcRow][srcCol] = 0;
                moved = true;
            } else {
                // Swap (check backpack rule)
                if (containerType === 'Backpack' && tappedItem.class === 'Backpack') {
                    // Not allowed
                } else {
                    player.inv[playerIdx] = srcItem;
                    container.inv[srcRow][srcCol] = tappedItem;
                    moved = true;
                }
            }
        }
    }
    // Player to instructions (Robot only)
    else if (srcSource === 'player' && source === 'instructions') {
        const playerIdx = srcFlatIndex !== null ? srcFlatIndex : (srcRow * 4 + srcCol);
        
        // Only command items can go to instructions
        if (srcItem.class === 'Command') {
            if (tappedItem === 0) {
                container.instructions[col] = new_item_from_num(item_name_to_num(srcItem.name), 1);
                srcItem.amount -= 1;
                if (srcItem.amount <= 0) {
                    player.inv[playerIdx] = 0;
                }
                moved = true;
            } else if (tappedItem.name === srcItem.name) {
                // Remove from instructions, add to player
                srcItem.amount += 1;
                container.instructions[col] = 0;
                moved = true;
            } else {
                // Swap - take from instruction, put new one
                const oldInstr = tappedItem;
                container.instructions[col] = new_item_from_num(item_name_to_num(srcItem.name), 1);
                srcItem.amount -= 1;
                if (srcItem.amount <= 0) {
                    player.inv[playerIdx] = 0;
                }
                // Add old instruction back to player
                if (checkForSpace(player, item_name_to_num(oldInstr.name))) {
                    addItem(player, item_name_to_num(oldInstr.name), 1);
                }
                moved = true;
            }
        }
    }
    // Instructions to player (Robot only)
    else if (srcSource === 'instructions' && source === 'player') {
        const playerIdx = flatIndex !== null ? flatIndex : (row * 4 + col);
        
        if (tappedItem === 0) {
            player.inv[playerIdx] = new_item_from_num(item_name_to_num(srcItem.name), 1);
            container.instructions[srcCol] = 0;
            moved = true;
        } else if (tappedItem.name === srcItem.name) {
            player.inv[playerIdx].amount += 1;
            container.instructions[srcCol] = 0;
            moved = true;
        } else if (tappedItem.class === 'Command') {
            // Swap instructions
            player.inv[playerIdx] = new_item_from_num(item_name_to_num(srcItem.name), 1);
            container.instructions[srcCol] = new_item_from_num(item_name_to_num(tappedItem.name), 1);
            tappedItem.amount -= 1;
            if (tappedItem.amount <= 0) {
                // Already swapped
            }
            moved = true;
        }
    }
    // Within same container
    else if (srcSource === source) {
        if (source === 'player') {
            const srcIdx = srcFlatIndex !== null ? srcFlatIndex : (srcRow * 4 + srcCol);
            const dstIdx = flatIndex !== null ? flatIndex : (row * 4 + col);
            
            if (tappedItem === 0) {
                player.inv[dstIdx] = srcItem;
                player.inv[srcIdx] = 0;
                moved = true;
            } else if (tappedItem.name === srcItem.name) {
                player.inv[dstIdx].amount += srcItem.amount;
                player.inv[srcIdx] = 0;
                moved = true;
            } else {
                // Swap
                player.inv[dstIdx] = srcItem;
                player.inv[srcIdx] = tappedItem;
                moved = true;
            }
        } else if (source === 'container') {
            if (containerType === 'Robot') {
                if (tappedItem === 0) {
                    container.inv[col] = srcItem;
                    container.inv[srcCol] = 0;
                    moved = true;
                } else if (tappedItem.name === srcItem.name) {
                    container.inv[col].amount += srcItem.amount;
                    container.inv[srcCol] = 0;
                    moved = true;
                } else {
                    container.inv[col] = srcItem;
                    container.inv[srcCol] = tappedItem;
                    moved = true;
                }
            } else {
                if (tappedItem === 0) {
                    container.inv[row][col] = srcItem;
                    container.inv[srcRow][srcCol] = 0;
                    moved = true;
                } else if (tappedItem.name === srcItem.name) {
                    container.inv[row][col].amount += srcItem.amount;
                    container.inv[srcRow][srcCol] = 0;
                    moved = true;
                } else {
                    container.inv[row][col] = srcItem;
                    container.inv[srcRow][srcCol] = tappedItem;
                    moved = true;
                }
            }
        } else if (source === 'instructions') {
            // Swap or move within instructions
            if (tappedItem === 0) {
                container.instructions[col] = srcItem;
                container.instructions[srcCol] = 0;
                moved = true;
            } else {
                container.instructions[col] = srcItem;
                container.instructions[srcCol] = tappedItem;
                moved = true;
            }
        }
    }
    
    // Clear selection after move attempt
    mobileInventoryState.selectedSlot = null;
    updateMobileInventoryUI();
}

function mobileTransferAll() {
    const container = mobileInventoryState.containerRef;
    const containerType = mobileInventoryState.containerType;
    
    if (!container) return;
    
    // Transfer all from player to container
    for (let i = 0; i < player.inv.length; i++) {
        if (player.inv[i] !== 0) {
            // Don't transfer backpack into backpack
            if (containerType === 'Backpack' && player.inv[i].class === 'Backpack') continue;
            
            if (containerType === 'Robot') {
                // 1D array
                for (let j = 0; j < container.inv.length; j++) {
                    if (container.inv[j] === 0) {
                        container.inv[j] = player.inv[i];
                        player.inv[i] = 0;
                        break;
                    } else if (container.inv[j].name === player.inv[i].name) {
                        container.inv[j].amount += player.inv[i].amount;
                        player.inv[i] = 0;
                        break;
                    }
                }
            } else {
                // 2D array
                let placed = false;
                for (let r = 0; r < container.inv.length && !placed; r++) {
                    for (let c = 0; c < container.inv[r].length && !placed; c++) {
                        if (container.inv[r][c] === 0) {
                            container.inv[r][c] = player.inv[i];
                            player.inv[i] = 0;
                            placed = true;
                        } else if (container.inv[r][c].name === player.inv[i].name) {
                            container.inv[r][c].amount += player.inv[i].amount;
                            player.inv[i] = 0;
                            placed = true;
                        }
                    }
                }
            }
        }
    }
    
    updateMobileInventoryUI();
}

function mobileSplitStack() {
    const selected = mobileInventoryState.selectedSlot;
    if (!selected) {
        updateMobileSelectedInfo('Select an item first');
        return;
    }
    
    const container = mobileInventoryState.containerRef;
    const containerType = mobileInventoryState.containerType;
    
    let item = null;
    let setItem = null;
    
    if (selected.source === 'player') {
        const idx = selected.flatIndex !== null ? selected.flatIndex : (selected.row * 4 + selected.col);
        item = player.inv[idx];
        setItem = (newItem) => { player.inv[idx] = newItem; };
    } else if (selected.source === 'container') {
        if (containerType === 'Robot') {
            item = container.inv[selected.col];
            setItem = (newItem) => { container.inv[selected.col] = newItem; };
        } else {
            item = container.inv[selected.row][selected.col];
            setItem = (newItem) => { container.inv[selected.row][selected.col] = newItem; };
        }
    }
    
    if (!item || item === 0 || item.amount <= 1) {
        updateMobileSelectedInfo('Cannot split - need 2+ items');
        return;
    }
    
    // Split in half
    const halfAmount = Math.ceil(item.amount / 2);
    const remainingAmount = item.amount - halfAmount;
    
    // Create a new item for the split portion
    const newItem = new_item_from_num(item_name_to_num(item.name), halfAmount);
    
    // Try to find empty slot for the split portion
    let placed = false;
    
    // Try player inventory first
    for (let i = 0; i < player.inv.length && !placed; i++) {
        if (player.inv[i] === 0) {
            player.inv[i] = newItem;
            item.amount = remainingAmount;
            if (item.amount <= 0) setItem(0);
            placed = true;
        }
    }
    
    if (!placed) {
        updateMobileSelectedInfo('No empty slot for split');
        return;
    }
    
    mobileInventoryState.selectedSlot = null;
    updateMobileInventoryUI();
}

function updateMobileSelectedInfo(message = null) {
    const infoDiv = document.getElementById('mobile-inv-selected-info');
    if (!infoDiv) return;
    
    if (message) {
        infoDiv.textContent = message;
        return;
    }
    
    const selected = mobileInventoryState.selectedSlot;
    if (!selected) {
        infoDiv.textContent = '';
        return;
    }
    
    const container = mobileInventoryState.containerRef;
    const containerType = mobileInventoryState.containerType;
    
    let item = null;
    if (selected.source === 'player') {
        const idx = selected.flatIndex !== null ? selected.flatIndex : (selected.row * 4 + selected.col);
        item = player.inv[idx];
    } else if (selected.source === 'container') {
        if (containerType === 'Robot') {
            item = container.inv[selected.col];
        } else {
            item = container.inv[selected.row][selected.col];
        }
    } else if (selected.source === 'instructions') {
        item = container.instructions[selected.col];
    }
    
    if (item && item !== 0) {
        infoDiv.textContent = `Selected: ${item.name} x${item.amount}`;
    } else {
        infoDiv.textContent = '';
    }
}

// Initialize mobile inventory UI after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMobileInventoryUI);
} else {
    setupMobileInventoryUI();
}

var musicSlider;
var fxSlider;
var startButton;
var optionsButton;
var creditsButton;
var dif0button;
var dif1button;
var dif2button;
var resetControlsButton;
var controlLabels = [];
var controlKeyTexts = [];
var controlHighlight;
var creditsOn = false;
var current_reply = 0;
var temp_move_bool = true;
var questCloseButton;
var animatedGifs = []; // Track all animated GIF images
var clear_anim = false;
var clear_movephase = 0;
var clear_ticks = 0;
var clear_y = canvasHeight;
var extraCount = 0;

// Performance profiling
var fpsCounter = 0;
var lastFpsUpdate = 0;
var displayFps = 0;
var showFpsDebug = false;

// Day of week system (0-4: blue, green, yellow, orange, red)
var dayOfWeek = 0; // Calculated as days % 5
var dayOfWeekColors = ['blue', 'green', 'yellow', 'orange', 'red'];

// Weather tracking for economy effects
var lastRainDay = -999; // Track when rain last occurred
var lastFrogRainDay = -999; // Track when frog-rain last occurred

// Weather system
var currentWeather = 'clear'; // 'clear', 'overcast', 'rain'
var weatherLog = []; // Log of weather for each day

// Rain particle system
var rainDroplets = []; // Array of individual rain particles
var rainInitialized = false;

// Frog rain system
var frogRainEntities = []; // Temporary frogs that fall from sky
var frogRainSpawnChance = 0.3; // Chance to spawn a frog each frame during frog rain

// Initialize rain droplets
function initializeRain(dropletCount = 200) {
    rainDroplets = [];
    
    for (let i = 0; i < dropletCount; i++) {
        rainDroplets.push({
            x: Math.random() * canvasWidth,
            y: Math.random() * canvasHeight,
            vx: -2, // Horizontal velocity (slight wind)
            vy: 5 + Math.random() * 3, // Vertical velocity (falling speed)
            length: 8 + Math.random() * 4, // Length of rain streak
            opacity: 150 + Math.random() * 100
        });
    }
    rainInitialized = true;
}
// Generate random weather for the day
function generateDailyWeather() {
    const weatherRoll = Math.random() * 100;
    
    if (weatherRoll < 0.5) {
        currentWeather = 'frog-rain'; // 0.5% - FROGS FALL FROM THE SKY
        lastFrogRainDay = days; // Track frog-rain
    } else if (weatherRoll < 2.5) {
        currentWeather = 'thunderstorm'; // 2% - Heavy rain with lightning
        lastRainDay = days; // Track rain
    } else if (weatherRoll < 10.5) {
        currentWeather = 'rain'; // 8% - Regular rain
        lastRainDay = days; // Track rain
    } else if (weatherRoll < 18.5) {
        currentWeather = 'sunshower'; // 8% - Rain during day (bright)
        lastRainDay = days; // Track rain
    } else if (weatherRoll < 28.5) {
        currentWeather = 'overcast'; // 10% - Dark and cloudy
    } else if (weatherRoll < 43.5) {
        currentWeather = 'partly-cloudy'; // 15% - Slightly cloudy
    } else if (weatherRoll < 50.5) {
        currentWeather = 'fog'; // 7% - Foggy conditions
    } else {
        currentWeather = 'clear'; // 49.5% - Clear and sunny
    }
    
    // Log the weather
    weatherLog.push({
        day: days,
        weather: currentWeather
    });
    
    console.log(`Day ${days}: Weather is ${currentWeather.toUpperCase()}`);
}

// Calculate dynamic opacity based on time of day (0-200 range)
// Returns opacity value that's darker at night, brighter during day
function getDayNightOpacity(baseOpacity) {
    // time: 0 = midnight (darkest), 100 = noon (brightest), 200 = midnight again
    // Create a curve: lowest at 0/200, highest at 100
    const normalizedTime = time > 100 ? 200 - time : time;
    const dayNightFactor = normalizedTime / 100; // 0 at night, 1 at noon
    
    // Apply a curve to make nights darker and days brighter
    // Using squared factor for more dramatic effect
    const curve = dayNightFactor * dayNightFactor;
    
    // Return reduced opacity at night, full opacity at day
    return baseOpacity * (0.3 + curve * 0.7); // 30% opacity at night, 100% at day
}

// Apply visual effects based on current weather
function applyWeatherEffects() {
    if (currentWeather === 'clear') {
        // Clear - no effects, reset rain
        rainInitialized = false;
        frogRainEntities = [];
    } else if (currentWeather === 'partly-cloudy') {
        // Slight darkening for partly cloudy
        push();
        fill(0, 0, 0, getDayNightOpacity(30));
        rect(0, 0, canvasWidth, canvasHeight);
        pop();
    } else if (currentWeather === 'overcast') {
        // Moderate darkening for overcast weather
        push();
        fill(0, 0, 0, getDayNightOpacity(80));
        rect(0, 0, canvasWidth, canvasHeight);
        pop();
    } else if (currentWeather === 'fog') {
        // Fog effect - white overlay with reduced opacity
        push();
        fill(200, 200, 200, getDayNightOpacity(100));
        rect(0, 0, canvasWidth, canvasHeight);
        pop();
    } else if (currentWeather === 'sunshower') {
        // Sun shower - bright with rain (light overlay)
        push();
        fill(0, 0, 0, getDayNightOpacity(40));
        rect(0, 0, canvasWidth, canvasHeight);
        
        // Draw lighter rain
        drawRain(true);
        pop();
    } else if (currentWeather === 'rain') {
        // Heavy rain - dark overlay with rain
        push();
        fill(0, 0, 0, getDayNightOpacity(120));
        rect(0, 0, canvasWidth, canvasHeight);
        
        // Draw rain effect
        drawRain(false);
        pop();
    } else if (currentWeather === 'thunderstorm') {
        // Thunderstorm - very dark with heavy rain and lightning
        push();
        fill(0, 0, 0, getDayNightOpacity(140));
        rect(0, 0, canvasWidth, canvasHeight);
        
        // Draw heavy rain
        drawRain(false, true);
        
        // Lightning flashes
        drawLightning();
        pop();
    } else if (currentWeather === 'frog-rain') {
        // FROGS! - bright with frogs falling
        push();
        fill(100, 200, 100, 60); // Greenish tint
        rect(0, 0, canvasWidth, canvasHeight);
        pop();
        
        // Spawn and update frog rain
        updateFrogRain();
    }
}

// Draw animated rain with falling droplets
function drawRain(isSunshower = false, isThunderstorm = false) {
    // Initialize rain on first call
    if (!rainInitialized) {
        initializeRain(isThunderstorm ? 400 : 200);
    }
    
    push();
    
    // Update and draw each raindrop
    for (let i = 0; i < rainDroplets.length; i++) {
        const drop = rainDroplets[i];
        
        // Update droplet position (only when not paused)
        if (!paused) {
            drop.x += drop.vx;
            drop.y += drop.vy;
            
            // Wrap horizontally (wind effect)
            if (drop.x > canvasWidth) {
                drop.x = -5;
            } else if (drop.x < -5) {
                drop.x = canvasWidth;
            }
            
            // Reset to top when droplet reaches bottom
            if (drop.y > canvasHeight) {
                drop.y = -10;
                drop.x = Math.random() * canvasWidth;
            }
        }
        
        // Draw the raindrop as a line
        if (isSunshower) {
            // Lighter blue for sun showers
            stroke(150, 200, 255, drop.opacity * 0.7);
        } else {
            // Normal rain color
            stroke(180, 210, 255, drop.opacity);
        }
        
        strokeWeight(isThunderstorm ? 1.5 : 1);
        line(drop.x, drop.y, drop.x + drop.vx * 2, drop.y + drop.length);
    }
    
    pop();
}

// Draw lightning flashes for thunderstorms
function drawLightning() {
    const lightningChance = 0.008; // 0.8% chance per frame (increased from 0.2%)
    
    if (Math.random() < lightningChance) {
        push();
        
        // Flash the screen with subtle white (less aggressive)
        fill(255, 255, 255, 50);
        rect(0, 0, canvasWidth, canvasHeight);
        
        // Draw 1-2 lightning bolts per strike
        const boltCount = Math.random() < 0.3 ? 2 : 1;
        
        for (let b = 0; b < boltCount; b++) {
            // Draw jagged lightning bolt
            stroke(255, 255, 150, 180);
            strokeWeight(3);
            
            const startX = Math.random() * canvasWidth;
            const startY = 0;
            let currentX = startX;
            let currentY = startY;
            
            for (let i = 0; i < 8; i++) {
                const nextX = currentX + (Math.random() - 0.5) * 60;
                const nextY = currentY + canvasHeight / 8;
                
                line(currentX, currentY, nextX, nextY);
                currentX = nextX;
                currentY = nextY;
            }
        }
        
        pop();
    }
}

// Update and render falling frogs for frog rain
function updateFrogRain() {
    // Don't update weather when paused
    if (paused) {
        // Still render but don't update positions
        for (let i = 0; i < frogRainEntities.length; i++) {
            const frog = frogRainEntities[i];
            const age = millis() - frog.spawnTime;
            const frogImageIndex = Math.floor((age / 200) % 2) === 0 ? 0 : 2; // Alternate between back (0) and front (2)
            push();
            imageMode(CENTER);
            tint(0, 200, 0, 200 - (age / frog.lifetime) * 50);
            image(frog_imgs[frogImageIndex][0], frog.x + tileSize/2, frog.y + tileSize/2, tileSize, tileSize);
            pop();
        }
        return;
    }
    
    // SYSTEM 1: Spawn visual falling frogs from sky
    if (Math.random() < frogRainSpawnChance && frogRainEntities.length < 15) {
        const newFrog = {
            x: Math.random() * canvasWidth,
            y: -32,
            vy: 4 + Math.random() * 2,
            vx: (Math.random() - 0.5) * 2,
            spawnTime: millis(),
            lifetime: 5000 + Math.random() * 3000 // 5-8 seconds before disappearing
        };
        frogRainEntities.push(newFrog);
    }
    
    // Update and render existing falling frogs
    for (let i = frogRainEntities.length - 1; i >= 0; i--) {
        const frog = frogRainEntities[i];
        const age = millis() - frog.spawnTime;
        
        // Remove if expired
        if (age > frog.lifetime) {
            frogRainEntities.splice(i, 1);
            continue;
        }
        
        // Update position
        frog.y += frog.vy;
        frog.x += frog.vx;
        
        // Wrap horizontally
        if (frog.x > canvasWidth) {
            frog.x = -32;
        } else if (frog.x < -32) {
            frog.x = canvasWidth;
        }
        
        // If frog reaches ground, remove from rain particles
        if (frog.y > canvasHeight - tileSize) {
            frogRainEntities.splice(i, 1);
            continue;
        }
        
        // Draw falling frog
        const frogImageIndex = Math.floor((age / 200) % 2) === 0 ? 0 : 2; // Alternate between back (0) and front (2)
        push();
        imageMode(CENTER);
        tint(0, 200, 0, 200 - (age / frog.lifetime) * 50); // Fade out over time
        image(frog_imgs[frogImageIndex][0], frog.x + tileSize/2, frog.y + tileSize/2, tileSize, tileSize);
        pop();
    }
    
    // SYSTEM 2: Spawn new frogs directly on tiles periodically
    if (Math.random() < 0.02) { // 10% chance each frame to spawn a frog
        const currentLevelMap = levels[currentLevel_y][currentLevel_x].map;
        const mapHeight = currentLevelMap.length;
        const mapWidth = currentLevelMap[0].length;
        
        // Try to find an empty spot
        let attempts = 0;
        while (attempts < 5) {
            const randomY = Math.floor(Math.random() * mapHeight);
            const randomX = Math.floor(Math.random() * mapWidth);
            const tile = currentLevelMap[randomY][randomX];
            
            // Check if tile is empty or walkable (not an entity already)
            if (tile && tile.name != 'wall' && tile.name != 'satilite' && 
                tile.name != 'solarpanel' && tile.class != 'Plant' && 
                tile.class != 'Entity' && !tile.rainFrog) {
                
                // Create frog entity with the current tile as underlying tile
                const newFrog = new_tile_from_num(77, randomX * tileSize, randomY * tileSize);
                newFrog.rainFrog = true;
                newFrog.spawnedDay = days;
                newFrog.spawnTime = millis();
                newFrog.rainFrogLifetime = 15000 + Math.random() * 10000; // 15-25 seconds
                
                // Preserve the underlying tile instead of replacing it
                newFrog.under_tile = tile;
                
                currentLevelMap[randomY][randomX] = newFrog;
                break;
            }
            attempts++;
        }
    }
    
    // Check all tiles in current level for expired rain frogs
    const currentLevelMap = levels[currentLevel_y][currentLevel_x].map;
    for (let y = 0; y < currentLevelMap.length; y++) {
        for (let x = 0; x < currentLevelMap[y].length; x++) {
            const tile = currentLevelMap[y][x];
            if (tile && tile.rainFrog && tile.spawnTime) {
                const age = millis() - tile.spawnTime;
                
                // Remove if expired
                if (age > tile.rainFrogLifetime) {
                    // Restore the underlying tile if it exists
                    currentLevelMap[y][x] = tile.under_tile ? tile.under_tile : new_tile_from_num(2, x * tileSize, y * tileSize);
                }
            }
        }
    }
    
    // Also clean up any falling frogs that haven't landed yet
    for (let i = frogRainEntities.length - 1; i >= 0; i--) {
        const frog = frogRainEntities[i];
        const age = millis() - frog.spawnTime;
        
        // Remove if expired
        if (age > frog.lifetime) {
            frogRainEntities.splice(i, 1);
            continue;
        }
        
        // Update position
        frog.y += frog.vy;
        frog.x += frog.vx;
        
        // Wrap horizontally
        if (frog.x > canvasWidth) {
            frog.x = -32;
        } else if (frog.x < -32) {
            frog.x = canvasWidth;
        }
        
        // If frog reaches ground, add to level and remove from rain
        if (frog.y > canvasHeight - tileSize) {
            frogRainEntities.splice(i, 1);
            continue;
        }
        
        // Draw falling frog
        const frogImageIndex = Math.floor((age / 200) % 2) === 0 ? 0 : 2; // Alternate between back (0) and front (2)
        push();
        imageMode(CENTER);
        tint(0, 200, 0, 200 - (age / frog.lifetime) * 50); // Fade out over time
        image(frog_imgs[frogImageIndex][0], frog.x + tileSize/2, frog.y + tileSize/2, tileSize, tileSize);
        pop();
    }
}

// UI Layout Configuration - all clickable regions defined here
const UI_BOUNDS = {
    // Player inventory bar at bottom (inv_img is 512px wide, centered)
    get inventoryBar() {
        const barImageLeft = (canvasWidth/2) - 256; // Where inv_img starts
        const slotWidth = 64;
        const slotsPerBar = 8;
        const barWidth = slotWidth * slotsPerBar; // 512px
        
        return {
            top: canvasHeight - slotWidth,
            bottom: canvasHeight,
            left: barImageLeft,
            right: barImageLeft + barWidth,
            slotWidth: slotWidth,
            // Calculate which slot the mouse is over
            getSlotIndex: (mouseX) => {
                const relativeX = mouseX - barImageLeft;
                return Math.min(slotsPerBar - 1, Math.max(0, Math.floor(relativeX / slotWidth)));
            },
            // Get render position for slot i
            getSlotX: (slotIndex) => barImageLeft + (slotIndex * slotWidth)
        };
    },
    
    // Chest/Backpack grid UI
    get chestGrid() {
        return {
            top: 189,
            bottom: 457,
            left: (canvasWidth/2) - 184,
            right: (canvasWidth/2) + 184,
            cellSize: 90,
            getGridPos: (mouseX, mouseY, inv) => ({
                x: Math.min(inv[0].length - 1, Math.round((mouseX - (canvasWidth/2) + 139) / 90)),
                y: Math.min(inv.length - 1, Math.round((mouseY - 234) / 90))
            })
        };
    },
    
    // Robot UI regions
    get robotInstructions() {
        return {
            top: 78,
            getBottom: (instructionLength) => (Math.ceil(instructionLength / 6) * 86) + 78,
            left: (canvasWidth/2) - 216,
            right: (canvasWidth/2) + 314,
            cellSize: 90,
            getIndex: (mouseX, mouseY, instructionLength) => {
                const row = Math.min(instructionLength / 6, Math.round((mouseY - 78 - 43) / 86));
                const col = Math.min(5, Math.round((mouseX - (canvasWidth/2) + 216 - 45) / 90));
                return (row * 6) + col;
            }
        };
    },
    
    get robotStorage() {
        return {
            top: 435,
            bottom: 500,
            left: (canvasWidth/2) - 298,
            right: (canvasWidth/2) + 310,
            cellSize: 90,
            getSlotIndex: (mouseX, inv) => Math.min(inv.length - 1, Math.round((mouseX - (canvasWidth/2) + 298 - 45) / 90))
        };
    }
};

// Fast travel CSS animation trigger
function triggerTravelTransition(callback, destination = 'Unknown') {
    const overlay = document.getElementById('travelOverlay');
    const destinationText = overlay.querySelector('.travel-destination');
    
    if (destinationText) {
        destinationText.textContent = `Traveling to ${destination}`;
    }
    
    overlay.classList.add('active');
    
    // Call teleport callback at peak fade (1 second in)
    setTimeout(() => {
        if (callback) callback();
    }, 1000);
    
    // Remove overlay after animation completes
    setTimeout(() => {
        overlay.classList.remove('active');
    }, 2000);
}

// Menu fade transition trigger
function triggerMenuFadeOut(callback) {
    const overlay = document.getElementById('menuOverlay');
    overlay.classList.add('active');
    
    // Call callback at peak fade (500ms in)
    setTimeout(() => {
        if (callback) callback();
    }, 500);
    
    // Remove overlay after animation completes
    setTimeout(() => {
        overlay.classList.remove('active');
    }, 1000);
}

function draw() {
    musicplayer.update()

    // Update mobile controls visibility
    updateMobileControlsVisibility();

    takeInput();
    if (title_screen) {
        showTitle();
        if(save_anim > 0){
            save_anim -= 1;
            push()
            tint(255, save_anim);
            image(save_img, canvasWidth - 128 + 5, canvasHeight - (128));
            pop()
        }
    }
    else if (dificulty_screen){
        showDificulty();
    }
    else if (lose_screen) {
        showLoseScreen();
    }
    else {
        clear_anim = false;
        clear_movephase = 0;
        clear_ticks = 0;
        clear_y = canvasHeight;
        clearButton.hide()
        QuitButton.hide()
        startButton.hide();
        optionsButton.hide();
        creditsButton.hide();
        background(135, 206, 235);
        image(background_img, 0, 0);
        levels[currentLevel_y][currentLevel_x].fore_render();
        levels[currentLevel_y][currentLevel_x].render();
        
        // Apply weather visual effects
        applyWeatherEffects();
        
        if (!paused){
            // Resume GIF animations
            animatedGifs.forEach(gif => gif.play());
            // Update all levels so plants grow offscreen
            for(let y = 0; y < levels.length; y++){
                for(let x = 0; x < levels[y].length; x++){
                    if(levels[y][x]){
                        levels[y][x].update(x, y);
                    }
                }
            }
            // Track visited location and dispatch event
            const currentLevel = levels[currentLevel_y][currentLevel_x];
            if (currentLevel) {
                if (!visitedLocations.has(currentLevel.name)) {
                    visitedLocations.add(currentLevel.name);
                    window.dispatchEvent(new CustomEvent('locationVisited', {
                        detail: { locationName: currentLevel.name }
                    }));
                }
            }
        }
        else{
            // Pause GIF animations
            animatedGifs.forEach(gif => gif.pause());
        }
        player.render();
        
        // Apply night overlay (but not to tree tops or lights)
        if(!player.dead){
            push();
            fill(0, 0, 0, time);
            noStroke();
            rect(0, 0, canvasWidth, canvasHeight);
            pop();
            
            // Lights and tree tops render after night overlay so they stay bright
            // Only render when player is alive
            levels[currentLevel_y][currentLevel_x].renderLights();
            levels[currentLevel_y][currentLevel_x].renderTreeTops();
        }
        
        if(!player.dead){
            render_ui();
        } else {
            hideUIPopups();
        }
        
        if (!paused){
            // Check for quest goal completions and fire events
            for(let i = 0; i < player.quests.length; i++){
                if(player.quests[i] != undefined && !player.quests[i].done && !player.quests[i].failed){
                    player.quests[i].checkGoalCompletions();
                }
            }
            if (millis() - lastTimeMili > 300) { //300 for 2 min 1 day, 150 for 1 min 1 day
                if (timephase == 0) {
                    if (player.touching.name == 'bed') {
                        time += 3;
                    }
                    else {
                        time += 1;
                    }
                }
                if (timephase == 1) {
                    if (player.touching.name == 'bed') {
                        time -= 3;
                    }
                    else {
                        time -= 1;
                    }
                }
                if (time >= 200) {
                    time = 200;
                    timephase = 1;
                    days += 1;
                    dayOfWeek = days % 5; // Update day of week (0-4)
                    
                    // Generate weather for the new day
                    generateDailyWeather();
                    
                    if(days >= 100 && level5.map[9][2].name != 'Mr.C'){
                        level5.map[9][2] = new_tile_from_num(98, 2*tileSize, 9*tileSize);
                        if(player.quests[0].done){
                            level5.map[9][2].current_dialouge = 2;
                        }
                        else{
                            level5.map[9][2].current_dialouge = 3;
                        }
                    }
                    // Jake appears in park every 10 days
                    if(days % 10 == 0 && level10.map[9][5].name != 'Jake'){
                        level10.map[9][5] = new_tile_from_num(88, 5*tileSize, 9*tileSize);
                    }
                    else if(days % 10 != 0 && level10.map[9][5].name == 'Jake'){
                        level10.map[9][5] = new_tile_from_num(57, 5*tileSize, 9*tileSize);
                    }
                    for(let i = 0; i < player.quests.length; i++){
                        if(player.quests[i] != undefined){
                            player.quests[i].daily_update();
                            
                            // Check if main quest failed
                            if (player.quests[i].og_name === "Save Cloudy Meadows" && player.quests[i].failed) {
                                lose_screen = true;
                                paused = true;
                            }
                        }
                    }
                    
                    // Remove temporary frog rain frogs from yesterday
                    for(let y = 0; y < levels.length; y++){
                        for(let x = 0; x < levels[y].length; x++){
                            if(levels[y][x]){
                                const mapGrid = levels[y][x].map;
                                for(let my = 0; my < mapGrid.length; my++){
                                    for(let mx = 0; mx < mapGrid[my].length; mx++){
                                        const tile = mapGrid[my][mx];
                                        if(tile && tile.rainFrog && tile.spawnedDay < days - 1){
                                            // Restore the underlying tile if it exists
                                            mapGrid[my][mx] = tile.under_tile ? tile.under_tile : new_tile_from_num(2, mx * tileSize, my * tileSize);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    saveAll();
                    newDayChime.play();
                }
                if (time <= 0) {
                    time = 0;
                    timephase = 0;
                    for (let y = 0; y < levels.length; y++) {
                        for (let x = 0; x < levels[y].length; x++) {
                            if (levels[y][x] != 0) {
                                levels[y][x].daily_update();
                                // Update all shops in this level's map with day/weather info
                                for(let my = 0; my < levels[y][x].map.length; my++){
                                    for(let mx = 0; mx < levels[y][x].map[my].length; mx++){
                                        const tile = levels[y][x].map[my][mx];
                                        if(tile && tile.class == 'Shop'){
                                            tile.daily_update(dayOfWeek, lastRainDay, lastFrogRainDay);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                lastTimeMili = millis();
            }
        }
    }

    // Update FPS counter
    fpsCounter++;
    if (millis() - lastFpsUpdate > 500) { // Update every 500ms
        displayFps = round(fpsCounter * 2); // multiply by 2 since we update every 500ms
        fpsCounter = 0;
        lastFpsUpdate = millis();
    }
}

//Christian's function to make UI more readible, positioning + math stuff
function render_ui() {
    //calendar with day-of-week color
    push();
    image(calendar_img, canvasWidth - 70, 6);
    textFont(player_2);
    
    // Color based on day of week (0=blue, 1=green, 2=yellow, 3=orange, 4=red)
    const dayColors = [
        [0, 0, 255],      // 0: blue
        [0, 255, 0],      // 1: green
        [255, 255, 0],    // 2: yellow
        [255, 165, 0],    // 3: orange
        [255, 0, 0]       // 4: red
    ];
    const color = dayColors[dayOfWeek];
    fill(color[0], color[1], color[2]);
    textAlign(CENTER, CENTER);
    stroke(0);
    strokeWeight(2);
    textSize(13);
    text('day', canvasWidth - 39, 30);
    stroke(255);
    textSize(15);
    fill(0);
    text(days, canvasWidth - 40, 50);
    if(days == 69){
        text("nice !", canvasWidth - 40, 60);
    }

    pop();

 
    if(levels[currentLevel_y][currentLevel_x].level_name_popup){
        levels[currentLevel_y][currentLevel_x].name_render();
    }

    if(player.inv_warn_anim > 0){
        let mod = ((player.talking.class == 'NPC' || player.talking.class == 'Shop') ? 182: 0)
        player.inv_warn_anim -= 3;
        push()
        textFont(player_2);
        textSize(10);
        fill(255, 0, 0, player.inv_warn_anim);
        text("Full", 67, canvasHeight - mod - 10)
        tint(255, player.inv_warn_anim);
        image(inv_warn_img, 55, (canvasHeight - 64) - mod);
        pop()
    }

    if(player.quests[player.current_quest] != undefined){
        player.quests[player.current_quest].renderCurrentGoal(2, levels[currentLevel_y][currentLevel_x].y+52, 0, 0);
        
        
    }

    if (player.talking != undefined && player.talking != 0 && player.talking.class != 'Chest' && player.talking.class != 'Robot' && player.talking.class != 'Backpack') {
        if (player.talking.class == 'NPC' ){
            player.talking.move_bool = false;
            player.talking.dialouge_render();
            noStroke();
        }
        else if (player.talking.class == 'Shop'){
            player.talking.shop_render();
        }
        else if (player.talking.class == 'AirBallon'){
            player.talking.tp_render();
        }
        for (let i = 0; i < maxHunger; i++) {
            image(hunger_e, (canvasWidth / 20) + (30 * i), (canvasHeight - 185));
        }
        for (let i = 0; i < player.hunger; i++) {
            image(hunger_f, (canvasWidth / 20) + (30 * i), (canvasHeight - 185));
        }
        textFont(player_2);
        textSize(30.5);
        fill(0);
        textAlign(LEFT, TOP);
        let amountS = str(player.coins)
        if(player.coins > 9999999){
            let amountS = str(round(player.coins/1000000) + 'B')
            image(coin_img, canvasWidth - 130  - (amountS.length > 3 ? ((amountS.length-3)*20):0), (canvasHeight - 185));
            textSize(30 - ((amountS.length-4)*3));
            text(round(player.coins/1000000) + 'B', (canvasWidth / 2) + (512 / 2) - 64  - (amountS.length > 3 ? ((amountS.length-3)*20):0), (canvasHeight - 182.5) + ((amountS.length-4)*2.8));
        }
        else if(player.coins > 9999){
            image(coin_img, canvasWidth - 130 - (amountS.length-3)*20, (canvasHeight - 185));
            textSize(30 - ((amountS.length-4)*3));
            text(player.coins, canvasWidth - 100 - (amountS.length-3)*20, (canvasHeight - 182.5) - ((amountS.length-4)*3));
        }
        else{
            image(coin_img, canvasWidth - 130 - (amountS.length > 3 ? ((amountS.length-3)*25):0), (canvasHeight - 185));
            textSize(30);
            text(player.coins, canvasWidth - 80 - (amountS.length > 3 ? ((amountS.length-3)*25):0), (canvasHeight - 182.5));
        }
    }
    else{
        if(player.talking != undefined && player.talking != 0){
            if (player.talking.class == 'Chest'){
                player.talking.chest_render();
            }
            else if(player.talking.class == 'Backpack'){
                player.talking.bag_render();
            }
            else if(player.talking.class == 'Robot'){
                player.talking.move_bool = false;
                player.talking.render_pc();
            }
        }
        image(inv_img, (canvasWidth / 2) - (512 / 2), canvasHeight - 64);
        image(inv_hand_img, (canvasWidth / 2) - (512 / 2) + (64 * player.hand), canvasHeight - 64);

        for (let i = 0; i < maxHunger; i++) {
            image(hunger_e, (canvasWidth / 2) - (512 / 2) + (30 * i), (canvasHeight - 100));
        }
        for (let i = 0; i < player.hunger; i++) {
            image(hunger_f, (canvasWidth / 2) - (512 / 2) + (30 * i), (canvasHeight - 100));
        }
        textFont(player_2);
        textSize(32.5);
        fill(0);
        textAlign(LEFT, TOP);
        
        let amountS = str(player.coins)
        if(player.coins > 9999999){
            let amountS = str(round(player.coins/1000000) + 'B')
            image(coin_img, (canvasWidth / 2) + (512 / 2) - 130 + (amountS.length > 3 ? ((amountS.length-3)*20):0), (canvasHeight - 95));
            textSize(Math.max(12, 32.5 - ((amountS.length-4)*6)));
            text(round(player.coins/1000000) + 'B', (canvasWidth / 2) + (512 / 2) - 94 + (amountS.length > 3 ? ((amountS.length-3)*20):0), (canvasHeight - 92.5) + ((amountS.length-4)*2.8));
        }
        else if(player.coins > 9999){
            image(coin_img, (canvasWidth / 2) + (512 / 2) - 130 + (amountS.length-3)*20, (canvasHeight - 95));
            textSize(Math.max(14, 32.5 - ((amountS.length-4)*6)));
            text(player.coins, (canvasWidth / 2) + (512 / 2) - 94 + (amountS.length-3)*20, (canvasHeight - 92.5) + ((amountS.length-4)*2.8));
        }
        else{
            image(coin_img, (canvasWidth / 2) + (512 / 2) - 85 - (amountS.length > 3 ? ((amountS.length-3)*25):0), (canvasHeight - 95));
            textSize(30);
            text(player.coins, (canvasWidth / 2) + (512 / 2) - 45 - (amountS.length > 3 ? ((amountS.length-3)*25):0), (canvasHeight - 92.5));
        }
        if(player.money_anim > 0 && player.money_anim_amount > 0){
            player.money_anim -= 3;
            push()
            textFont(player_2);
            fill(0, 255, 0, player.money_anim);
            stroke(0, 0, 0, player.money_anim);
            strokeWeight(2);
            
            let amountS = str(player.money_anim_amount)
            if(player.money_anim_amount > 9999999){
                let amountS = str(round(player.money_anim_amount/1000000) + 'B')
                textSize(32.5 - ((amountS.length-4)*3));
                text(round(player.money_anim_amount/1000000) + 'B', (canvasWidth / 2) + (512 / 2) - 64, (canvasHeight - 92.5) + ((amountS.length-4)*2.8));
            }
            else if(player.money_anim_amount > 9999){
                textSize(32.5 - ((amountS.length-4)*3));
                text('+' + player.money_anim_amount, (canvasWidth / 2) + (512 / 2) - 100, (canvasHeight - 125) - ((amountS.length-4)*3));
            }
            else{
                textSize(32.5);
                text('+' + player.money_anim_amount, (canvasWidth / 2) + (512 / 2) - 100, (canvasHeight - 125));
            }
            pop();
        }
        else{
            player.money_anim_amount = 0;
        }
        if(save_anim > 0){
            save_anim -= 1;
            push()
            tint(255, save_anim);
            image(save_img, canvasWidth - 128 + 5, canvasHeight - (128));
            pop()
        }
        if(player.show_quests){
            showQuests();
        }
        else{
            questSlider.hide();
            questCloseButton.hide();
            if(questsContainer){
                questsContainer.style.display = 'none';
            }
            // Re-enable canvas pointer events
            const canvas = document.querySelector('canvas');
            if(canvas){
                canvas.style.pointerEvents = 'auto';
            }
        }
        if (player.looking(currentLevel_x, currentLevel_y) != undefined && player.looking(currentLevel_x, currentLevel_y).name == "cart_s" && player.talking == 0) {
            push()
            stroke(0)
            stroke(149, 108, 65);
            strokeWeight(5);
            fill(187, 132, 75);
            rectMode(CENTER)
            rect(player.looking(currentLevel_x, currentLevel_y).pos.x + (tileSize / 2), player.looking(currentLevel_x, currentLevel_y).pos.y - tileSize, 90, 70);
            textAlign(CENTER, CENTER);
            textSize(15);
            fill(255);
            stroke(0);
            strokeWeight(4);
            text('Sell', player.looking(currentLevel_x, currentLevel_y).pos.x + (tileSize / 2), player.looking(currentLevel_x, currentLevel_y).pos.y - (tileSize * 1.5), 90, 70);
            image(coin_img, player.looking(currentLevel_x, currentLevel_y).pos.x - (tileSize / 2) - 5, player.looking(currentLevel_x, currentLevel_y).pos.y - (tileSize * 1));
            if (player.inv[player.hand].price == 0 || player.inv[player.hand] == 0) {
                fill(255, 0, 0);
                text("No", player.looking(currentLevel_x, currentLevel_y).pos.x + (tileSize), player.looking(currentLevel_x, currentLevel_y).pos.y - (tileSize / 2));
            }
            if (player.inv[player.hand].price > 0) {
                fill(255);
                // Find shop and calculate actual sell price
                let sellPrice = round(player.inv[player.hand].price * 0.75); // Default fallback
                const currentLevel = levels[currentLevel_y][currentLevel_x];
                if(currentLevel && currentLevel.map) {
                    for(let my = 0; my < currentLevel.map.length; my++){
                        for(let mx = 0; mx < currentLevel.map[my].length; mx++){
                            const tile = currentLevel.map[my][mx];
                            if(tile && tile.class == 'Shop'){
                                let price = tile.getSellPrice(player.inv[player.hand].name);
                                if(price > 0) {
                                    sellPrice = price;
                                    break;
                                }
                            }
                        }
                        if(sellPrice !== round(player.inv[player.hand].price * 0.75)) break;
                    }
                }
                text(sellPrice, player.looking(currentLevel_x, currentLevel_y).pos.x + (tileSize), player.looking(currentLevel_x, currentLevel_y).pos.y - (tileSize / 2));
            }
            pop()
        }
        if(player.looking(currentLevel_x, currentLevel_y) != undefined && player.looking(currentLevel_x, currentLevel_y).class == "PayToMoveEntity" && player.talking == 0){
            player.looking(currentLevel_x, currentLevel_y).price_render();
        }
        // Render player inventory slots
        const invBar = UI_BOUNDS.inventoryBar;
        for (let i = 0; i < 8; i++) {
            if (player.inv[i] == undefined) {
                player.inv[i] = 0;
            }
            if (player.inv[i] != 0) {
                player.inv[i].render(invBar.getSlotX(i), invBar.top);
                if (i == player.hand) {
                    push();
                    // Background box for item name
                    fill(0, 0, 0, 200);
                    stroke(100);
                    strokeWeight(1);
                    rectMode(CENTER);
                    const itemNameLength = player.inv[i].name.length;
                    const boxWidth = itemNameLength * 15;
                    rect((9 * canvasWidth / 16), (canvasHeight - 80), boxWidth, 20);
                    
                    // Item name text
                    fill(255);
                    textFont(player_2);
                    const itemNameSize = itemNameLength > 20 ? 9 : (itemNameLength > 15 ? 11 : 13);
                    textSize(itemNameSize);
                    textAlign(CENTER, CENTER);
                    text(player.inv[i].name, (9 * canvasWidth / 16), (canvasHeight - 80));
                    pop();
                }
            }
        }
        if(mouse_item != 0){
            mouse_item.render(mouseX - Item.HALF_SIZE, mouseY - Item.HALF_SIZE);
        }
    }

    if(paused){
        showPaused();
        // Disable canvas pointer events so pause menu can receive clicks
        const canvas = document.querySelector('canvas');
        if(canvas){
            canvas.style.pointerEvents = 'none';
        }
    }
    else{
        hidePaused();
        musicSlider.hide();
        fxSlider.hide();
        QuitButton.hide()
        hideControls();
        // Re-enable canvas pointer events
        const canvas = document.querySelector('canvas');
        if(canvas){
            canvas.style.pointerEvents = 'auto';
        }
    }

    // Draw FPS counter if debug mode enabled
    if(showFpsDebug){
        push();
        fill(255, 0, 0);
        textSize(16);
        textAlign(LEFT, TOP);
        text('FPS: ' + displayFps, 10, 10);
        pop();
    }
}

function mouseReleased() {
    if(!title_screen){
        if(mouseButton == LEFT){
            console.log("left click");
            if(!player.show_quests){
                if(keyIsDown(special_key) || virtualInput.special){ //16 == shift
                    if(player.looking(currentLevel_x, currentLevel_y) != undefined && player.talking != 0 && (player.talking.class == 'Chest' || player.talking.class == 'Backpack' )){
                        const inv = UI_BOUNDS.inventoryBar;
                        console.log(inv);
                        if(mouseY >= inv.top && mouseY <= inv.bottom){
                            console.log("touching inv");
                            if(mouseX >= inv.left && mouseX <= inv.right){
                                let currentX = inv.getSlotIndex(mouseX);
                                if(player.inv[currentX] != 0){
                                    if(player.talking.class == 'Chest' || (player.talking.class == 'Backpack' && player.inv[currentX].class != 'Backpack')){
                                        for (let i = 0; i < player.talking.inv.length; i++) {
                                            for(let j = 0; j < player.talking.inv[i].length; j++){
                                                if (player.talking.inv[i][j] != 0 && player.inv[currentX] != 0) { // stack items
                                                    if (player.talking.inv[i][j].name == player.inv[currentX].name) {
                                                        player.talking.inv[i][j].amount += player.inv[currentX].amount;
                                                        player.inv[currentX] = 0;
                                                    }
                                                }
                                            }
                                        }
                                        for (let i = 0; i < player.talking.inv.length; i++) {
                                            for(let j = 0; j < player.talking.inv[i].length; j++){
                                                if (player.talking.inv[i][j] == 0 && player.inv[currentX] != 0) { // empty space
                                                    player.talking.inv[i][j] = new_item_from_num(item_name_to_num(player.inv[currentX].name), player.inv[currentX].amount);
                                                    player.inv[currentX] = 0;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        const chest = UI_BOUNDS.chestGrid;
                        if(mouseY >= chest.top && mouseY <= chest.bottom){
                            if(mouseX >= chest.left && mouseX <= chest.right){
                                const pos = chest.getGridPos(mouseX, mouseY, player.talking.inv);
                                let currentX = pos.x;
                                let currentY = pos.y;
                                if(checkForSpace(player, item_name_to_num(player.talking.inv[currentY][currentX].name))){
                                    addItem(player, item_name_to_num(player.talking.inv[currentY][currentX].name), player.talking.inv[currentY][currentX].amount);
                                    player.talking.inv[currentY][currentX] = 0;
                                }
                            }
                        }
                    }
                    if(player.looking(currentLevel_x, currentLevel_y) != undefined && player.talking != 0 && player.looking(currentLevel_x, currentLevel_y).class == 'Robot'){
                        const inv = UI_BOUNDS.inventoryBar;
                        if(mouseY >= inv.top && mouseY <= inv.bottom){
                            if(mouseX >= inv.left && mouseX <= inv.right){
                                let currentX = inv.getSlotIndex(mouseX);
                                if(player.inv[currentX] != 0){
                                    if(checkForSpace(player.talking, item_name_to_num(player.inv[currentX].name))){
                                        addItem(player.talking, item_name_to_num(player.inv[currentX].name), player.inv[currentX].amount);
                                        player.inv[currentX] = 0;
                                    }
                                }
                            }
                        }
                        const storage = UI_BOUNDS.robotStorage;
                        if(mouseY >= storage.top && mouseY <= storage.bottom){
                            if(mouseX >= storage.left && mouseX <= storage.right){
                                let currentX = storage.getSlotIndex(mouseX, player.talking.inv);
                                if(checkForSpace(player, item_name_to_num(player.talking.inv[currentX].name))){
                                    addItem(player, item_name_to_num(player.talking.inv[currentX].name), player.talking.inv[currentX].amount);
                                    player.talking.inv[currentX] = 0;
                                }
                            }
                        }
                    }
                }
                else{
                    const inv = UI_BOUNDS.inventoryBar;
                    if(mouseY >= inv.top && mouseY <= inv.bottom){
                        if(mouseX >= inv.left && mouseX <= inv.right){
                            let currentX = inv.getSlotIndex(mouseX);
                            if(mouse_item == 0 || player.inv[currentX] == 0){
                                let temp = mouse_item;
                                mouse_item = player.inv[currentX]
                                player.inv[currentX] = temp;
                            }
                            else if(player.inv[currentX].name == mouse_item.name){
                                player.inv[currentX].amount += mouse_item.amount;
                                mouse_item = 0;
                            }
                            else{
                                let temp = mouse_item;
                                mouse_item = player.inv[currentX]
                                player.inv[currentX] = temp;
                            }
                        }
                    }
                    if(player.looking(currentLevel_x, currentLevel_y) != undefined && player.talking != 0 && (player.talking.class == 'Chest' || player.talking.class == 'Backpack' )){
                        const chest = UI_BOUNDS.chestGrid;
                        if(mouseY >= chest.top && mouseY <= chest.bottom){
                            if(mouseX >= chest.left && mouseX <= chest.right){
                                const pos = chest.getGridPos(mouseX, mouseY, player.talking.inv);
                                let currentX = pos.x;
                                let currentY = pos.y;
                                if(mouse_item == 0 || player.talking.inv[currentY][currentX] == 0){
                                    if(mouse_item.class == 'Backpack' && player.talking.class == 'Backpack'){
                                        return;
                                    }
                                    let temp = mouse_item;
                                    mouse_item = player.talking.inv[currentY][currentX]
                                    player.talking.inv[currentY][currentX] = temp;
                                }
                                else if(player.talking.inv[currentY][currentX].name == mouse_item.name){
                                    player.talking.inv[currentY][currentX].amount += mouse_item.amount;
                                    mouse_item = 0;
                                }
                                else{
                                    if(mouse_item.class == 'Backpack' && player.talking.class == 'Backpack'){
                                        return;
                                    }
                                    let temp = mouse_item;
                                    mouse_item = player.talking.inv[currentY][currentX]
                                    player.talking.inv[currentY][currentX] = temp;
                                }
                            }
                        }
                    }
                    if(player.looking(currentLevel_x, currentLevel_y) != undefined && player.talking != 0 && player.looking(currentLevel_x, currentLevel_y).class == 'Robot'){
                        const instructions = UI_BOUNDS.robotInstructions;
                        if(mouseY >= instructions.top && mouseY <= instructions.getBottom(player.talking.instructions.length)){
                            if(mouseX >= instructions.left && mouseX <= instructions.right){
                                let currentX = instructions.getIndex(mouseX, mouseY, player.talking.instructions.length);
                                if(mouse_item == 0){
                                    mouse_item = player.talking.instructions[currentX];
                                    player.talking.instructions[currentX] = 0;
                                }
                                else if(player.talking.instructions[currentX] == 0){
                                    player.talking.instructions[currentX] = new_item_from_num(item_name_to_num(mouse_item.name), 1);
                                    mouse_item.amount -= 1;
                                    if(mouse_item.amount == 0){
                                    mouse_item = 0;
                                    }
                                }
                                else if (player.talking.instructions[currentX].name == mouse_item.name){
                                    mouse_item.amount += 1;
                                    player.talking.instructions[currentX] = 0;
                                }
                                else{
                                    let temp = mouse_item;
                                    mouse_item = player.talking.instructions[currentX];
                                    player.talking.instructions[currentX] = temp;
                                }
                            }
                        }
                        const storage = UI_BOUNDS.robotStorage;
                        if(mouseY >= storage.top && mouseY <= storage.bottom){
                            if(mouseX >= storage.left && mouseX <= storage.right){
                                let currentX = storage.getSlotIndex(mouseX, player.talking.inv);
                                if(mouse_item == 0 || player.talking.inv[currentX] == 0){
                                    let temp = mouse_item;
                                    mouse_item = player.talking.inv[currentX]
                                    player.talking.inv[currentX] = temp;
                                }
                                else if(player.talking.inv[currentX].name == mouse_item.name){
                                    player.talking.inv[currentX].amount += mouse_item.amount;
                                    mouse_item = 0;
                                }
                                else{
                                    let temp = mouse_item;
                                    mouse_item = player.talking.inv[currentX]
                                    player.talking.inv[currentX] = temp;
                                }
                            }
                        }
                    }
                }
            }
        }
        if(mouseButton == RIGHT){
            const inv = UI_BOUNDS.inventoryBar;
            if(mouseY >= inv.top && mouseY <= inv.bottom){
                if(mouseX >= inv.left && mouseX <= inv.right){
                    let currentX = inv.getSlotIndex(mouseX);
                    if(mouse_item == 0 && player.inv[currentX] != 0){
                        mouse_item = new_item_from_num(item_name_to_num(player.inv[currentX].name), ceil(player.inv[currentX].amount/2));
                        player.inv[currentX].amount -= ceil(player.inv[currentX].amount/2)
                        if (player.inv[currentX].amount <= 0){
                            player.inv[currentX] = 0;
                        }
                    }
                    else if(mouse_item.name == player.inv[currentX].name){
                        mouse_item.amount += ceil(player.inv[currentX].amount/2);
                        player.inv[currentX].amount -= ceil(player.inv[currentX].amount/2)
                        if (player.inv[currentX].amount <= 0){
                            player.inv[currentX] = 0;
                        }
                    }
                }
            }
            if(player.looking(currentLevel_x, currentLevel_y) != undefined && player.talking != 0 && (player.talking.class == 'Chest' || player.talking.class == 'Backpack' )){
                const chest = UI_BOUNDS.chestGrid;
                if(mouseY >= chest.top && mouseY <= chest.bottom){
                    if(mouseX >= chest.left && mouseX <= chest.right){
                        const pos = chest.getGridPos(mouseX, mouseY, player.talking.inv);
                        let currentX = pos.x;
                        let currentY = pos.y;
                        if(mouse_item == 0 && player.talking.inv[currentY][currentX] != 0){
                            mouse_item = new_item_from_num(item_name_to_num(player.talking.inv[currentY][currentX].name), ceil(player.talking.inv[currentY][currentX].amount/2));
                            player.talking.inv[currentY][currentX].amount -= ceil(player.talking.inv[currentY][currentX].amount/2)
                            if (player.talking.inv[currentY][currentX].amount <= 0){
                                player.talking.inv[currentY][currentX] = 0;
                            }
                        }
                        else if(mouse_item.name == player.talking.inv[currentY][currentX].name){
                            mouse_item.amount += ceil(player.talking.inv[currentY][currentX].amount/2);
                            player.talking.inv[currentY][currentX].amount -= ceil(player.talking.inv[currentY][currentX].amount/2)
                            if (player.talking.inv[currentY][currentX].amount <= 0){
                                player.talking.inv[currentY][currentX] = 0;
                            }
                        }
                    }
                }
            }
            if(player.looking(currentLevel_x, currentLevel_y) != undefined && player.talking != 0 && player.looking(currentLevel_x, currentLevel_y).class == 'Robot'){
                const storage = UI_BOUNDS.robotStorage;
                if(mouseY >= storage.top && mouseY <= storage.bottom){
                    if(mouseX >= storage.left && mouseX <= storage.right){
                        let currentX = storage.getSlotIndex(mouseX, player.talking.inv);
                        if(mouse_item == 0 && player.talking.inv[currentX] != 0){
                            mouse_item = new_item_from_num(item_name_to_num(player.talking.inv[currentX].name), ceil(player.talking.inv[currentX].amount/2));
                            player.talking.inv[currentX].amount -= ceil(player.talking.inv[currentX].amount/2)
                            if (player.talking.inv[currentX].amount <= 0){
                                player.talking.inv[currentX] = 0;
                            }
                        }
                        else if(mouse_item.name == player.talking.inv[currentX].name){
                            mouse_item.amount += ceil(player.talking.inv[currentX].amount/2);
                            player.talking.inv[currentX].amount -= ceil(player.talking.inv[currentX].amount/2)
                            if (player.talking.inv[currentX].amount <= 0){
                                player.talking.inv[currentX] = 0;
                            }
                        }
                    }
                }
            }
        }
    }
  }