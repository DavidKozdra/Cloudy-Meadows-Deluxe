
// Handle unhandled promise rejections from localData operations
window.addEventListener('unhandledrejection', event => {
    if (event.reason && event.reason.message && event.reason.message.includes('Permissions')) {
        console.warn('IndexedDB permissions error (expected in some environments):', event.reason);
        event.preventDefault();
    }
});

// Helper function to update canvas pointer-events based on visible menus
function updateCanvasPointerEvents() {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    
    const mainMenuVisible = document.getElementById('main-menu-container')?.style.display !== 'none';
    const difficultyMenuVisible = document.getElementById('difficulty-menu')?.style.display !== 'none';
    const optionsMenuVisible = document.getElementById('options-menu')?.style.display !== 'none';
    const creditsMenuVisible = document.getElementById('credits-menu')?.style.display !== 'none';
    const pauseMenuVisible = document.getElementById('pause-menu')?.style.display !== 'none';
    const questsVisible = document.querySelector('.quests-container')?.style.display !== 'none';
    const loseScreenVisible = document.getElementById('lose-screen')?.style.display !== 'none';
    const configModalVisible = document.getElementById('config-overlay')?.style.display !== 'none';
    
    const anyMenuVisible = mainMenuVisible || difficultyMenuVisible || optionsMenuVisible || creditsMenuVisible || pauseMenuVisible || questsVisible || loseScreenVisible || configModalVisible;
    canvas.style.pointerEvents = anyMenuVisible ? 'none' : 'auto';
}

// Helper function to add money and dispatch event
function addMoney(amount) {
    if (amount > 0 && typeof player !== 'undefined' && player) {
        player.coins += amount;
        player.money_anim = 255;
        player.money_anim_amount += amount;
        
        // Dispatch money gained event
        window.dispatchEvent(new CustomEvent('moneyGained', {
            detail: { amount: amount, totalCoins: player.coins }
        }));
        
        // Update quest UI if it's showing - only update relevant parts
        if (player.show_quests && questsContainer) {
            // Just update the quest content, not rebuild everything
            updateQuestContent();
        }
    }
}

function updateQuestContent(){
    if (!questsContainer) return; // Quest panel not open yet
    const questsList = questsContainer.querySelector('.quests-list');
    if (!questsList) return;
    
    const buttons = questsList.querySelectorAll('.quest-item');
    buttons.forEach(btn => {
        const questIndex = parseInt(btn.getAttribute('data-quest-index'));
        const questContent = btn.querySelector('.quest-content');
        if (questContent && player.quests[questIndex]) {
            questContent.innerHTML = '';
            player.quests[questIndex].render(questContent, player.current_quest === questIndex ? 'yellow' : null);
        }
    });
}

function start(){
    triggerMenuFadeOut(() => {
        startButton.hide();
        optionsButton.hide();
        creditsButton.hide();
        resetControlsButton.hide();
        clearButton.hide();
        hideControls();
        hidePaused();
        title_screen = false;
        if(localData.get('Day_curLvl_Dif') == null){
            dificulty_screen = true;
        }
        paused = false;
        levels[currentLevel_y][currentLevel_x].level_name_popup = true;

        //turn off the title screen
        title_screen = false;
        hideMainMenu();
    });
}

function hasGameSave(){
    // Check only the keys that represent an actual world state, not options
    try {
        return localData.get('player') != null || localData.get('Day_curLvl_Dif') != null || localData.get('extralvlStuff') != null;
    } catch (err) {
        console.warn('Save detection failed, assuming no save', err);
        return false;
    }
}

// Hide UI popups (goal and location) when not in gameplay
function hideUIPopups() {
    const goalPopup = document.getElementById('current-goal-popup');
    if (goalPopup) {
        goalPopup.style.display = 'none';
    }
    const levelPopup = document.getElementById('level-name-popup');
    if (levelPopup) {
        levelPopup.style.display = 'none';
    }
}

function showTitle(){
    // Hide UI popups on title screen
    hideUIPopups();
    
    // Render background on canvas
  
        /*
        
          push()
    background(135, 206, 235);
    for (let i = 0; i < clouds.length; i++) {
        clouds[i].update(clouds[i].vel)
        clouds[i].render()
    }
    imageMode(CENTER);
    image(title_screen_img, canvasWidth / 2, (canvasHeight / 2) - 40);
    pop();*/

    if(title_screen){
            // Show DOM-based menu
    showMainMenu();

    }else{
        hideMainMenu();
    }
    if(paused){
        showTitleOptions();
    }
    else{
        hideTitleOptions();
    }
    if(creditsOn){
        showCreditsMenu();
    }
    else{
        hideCreditsMenu();
        cursor('default');
    }
    if(clear_anim){
        clear_data_render();
    }
}

function showMainMenu(){
    let container = document.getElementById('main-menu-container');
    let startBtn = document.getElementById('start-btn');
    if (!container) {
        // Create structure =J BN,/
        container = document.createElement('div');
        container.id = 'main-menu-container';
        container.className = 'main-menu';
        document.body.appendChild(container);
        
        const titleImg = document.createElement('img');
        titleImg.src = 'images/ui/Title_Screen.gif';
        titleImg.alt = 'Title';
        titleImg.className = 'main-menu-title-image';
        container.appendChild(titleImg);
        
        const deluxeText = document.createElement('div');
        deluxeText.className = 'deluxe-text';
        deluxeText.textContent = 'DELUXE';
        container.appendChild(deluxeText);
        
        startBtn = document.createElement('button');
        startBtn.id = 'start-btn';
        startBtn.className = 'main-menu-button';
        startBtn.textContent = 'Start'; // Default label in case save check fails early
        startBtn.addEventListener('click', start);
        container.appendChild(startBtn);
        
        const optionsBtn = document.createElement('button');
        optionsBtn.id = 'options-btn';
        optionsBtn.className = 'main-menu-button';
        optionsBtn.textContent = 'Options';
        optionsBtn.addEventListener('click', () => {
            paused = !paused;
            creditsOn = false;
        });
        container.appendChild(optionsBtn);
        
        const creditsBtn = document.createElement('button');
        creditsBtn.id = 'credits-btn';
        creditsBtn.className = 'main-menu-button';
        creditsBtn.textContent = 'Credits';
        creditsBtn.addEventListener('click', () => {
            creditsOn = !creditsOn;
            paused = false;
        });
        container.appendChild(creditsBtn);
    }
    // Refresh label every time in case save data was added or cleared
    const hasSavedGame = hasGameSave();
    if (startBtn) {
        startBtn.textContent = hasSavedGame ? 'Continue' : 'Start';
    } else {
        console.warn('Main menu start button missing');
    }
    container.style.display = 'flex';
    updateCanvasPointerEvents();
}

function hideMainMenu(){
    const container = document.getElementById('main-menu-container');
    if (container) container.style.display = 'none';


    updateCanvasPointerEvents();

}

function showDificulty(){
    // Render background on canvas
    push();
    background(135, 206, 235);
    for (let i = 0; i < clouds.length; i++) {
        clouds[i].update(clouds[i].vel)
        clouds[i].render()
    }
    pop();
    
    // Show DOM-based difficulty menu
    showDifficultyMenu();
}

function showDifficultyMenu(){
    let difficultyMenu = document.getElementById('difficulty-menu');
    if (!difficultyMenu) {
        // Create structure once
        difficultyMenu = document.createElement('div');
        difficultyMenu.id = 'difficulty-menu';
        difficultyMenu.className = 'difficulty-menu';
        document.body.appendChild(difficultyMenu);
        
        const title = document.createElement('h2');
        title.className = 'difficulty-title';
        title.textContent = 'Select Your Difficulty';
        difficultyMenu.appendChild(title);
        
        const container = document.createElement('div');
        container.className = 'difficulty-container';
        container.id = 'difficulty-container';
        difficultyMenu.appendChild(container);
        
        const difficulties = [
            {
                id: 'easy',
                title: 'Easy',
                features: [
                    { label: 'Money Loss', icon: 'checkmark.png', enabled: true },
                    { label: 'Food Rot', icon: 'x.png', enabled: false },
                    { label: 'Perma Death', icon: 'x.png', enabled: false }
                ],
                difficulty: 0
            },
            {
                id: 'medium',
                title: 'Medium',
                features: [
                    { label: 'Money Loss', icon: 'checkmark.png', enabled: true },
                    { label: 'Food Rot', icon: 'checkmark.png', enabled: true },
                    { label: 'Perma Death', icon: 'x.png', enabled: false }
                ],
                difficulty: 1
            },
            {
                id: 'hard',
                title: 'Hard',
                features: [
                    { label: 'Money Loss', icon: 'checkmark.png', enabled: true },
                    { label: 'Food Rot', icon: 'checkmark.png', enabled: true },
                    { label: 'Perma Death', icon: 'checkmark.png', enabled: true }
                ],
                difficulty: 2
            },
            {
                id: 'custom',
                title: 'Custom',
                features: [
                    { label: 'Money Loss', icon: 'checkmark.png', enabled: true, toggleable: true },
                    { label: 'Food Rot', icon: 'checkmark.png', enabled: true, toggleable: true },
                    { label: 'Perma Death', icon: 'x.png', enabled: false, toggleable: true }
                ],
                difficulty: 3
            }
        ];
        
        for (const diff of difficulties) {
            const card = document.createElement('div');
            card.className = `difficulty-card difficulty-card-${diff.id}`;
            
            const cardTitle = document.createElement('h3');
            cardTitle.className = 'difficulty-card-title';
            cardTitle.textContent = diff.title;
            card.appendChild(cardTitle);
            
            for (const feature of diff.features) {
                const featureDiv = document.createElement('div');
                featureDiv.className = 'difficulty-feature';
                
                const label = document.createElement('span');
                label.textContent = feature.label;
                featureDiv.appendChild(label);
                
                if (feature.toggleable) {
                    // Make feature clickable for custom difficulty
                    const toggleBtn = document.createElement('button');
                    toggleBtn.className = 'feature-toggle-btn';
                    toggleBtn.style.background = 'none';
                    toggleBtn.style.border = 'none';
                    toggleBtn.style.padding = '0';
                    toggleBtn.style.cursor = 'pointer';
                    
                    const img = document.createElement('img');
                    img.src = `images/ui/${feature.icon}`;
                    img.alt = feature.label;
                    img.className = 'feature-icon';
                    toggleBtn.appendChild(img);
                    
                    toggleBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        feature.enabled = !feature.enabled;
                        img.src = `images/ui/${feature.enabled ? 'checkmark.png' : 'x.png'}`;
                    });
                    
                    featureDiv.appendChild(toggleBtn);
                } else if (feature.type === 'number') {
                    const input = document.createElement('input');
                    input.type = 'number';
                    input.value = feature.value;
                    input.id = feature.id;
                    input.style.width = '80px';
                    input.style.marginLeft = '10px';
                    input.style.padding = '2px 5px';
                    input.style.borderRadius = '4px';
                    input.style.border = '1px solid #ccc';
                    input.style.fontSize = '14px';
                    
                    // Prevent clicks on input from selecting the difficulty
                    input.addEventListener('click', (e) => e.stopPropagation());
                    
                    featureDiv.appendChild(input);
                } else {
                    const img = document.createElement('img');
                    img.src = `images/ui/${feature.icon}`;
                    img.alt = feature.label;
                    img.className = 'feature-icon';
                    featureDiv.appendChild(img);
                }
                
                card.appendChild(featureDiv);
            }
            
            const btn = document.createElement('button');
            btn.className = 'difficulty-select-btn';
            btn.textContent = 'Select';
            btn.dataset.difficulty = diff.difficulty;
            btn.addEventListener('click', () => {
                if (diff.id === 'custom') {
                    selectCustomDifficulty(diff.features);
                } else {
                    selectDifficulty(diff.difficulty);
                }
            });
            card.appendChild(btn);

            // Add Configure button for Custom difficulty to open modal
            if (diff.id === 'custom') {
                const cfgBtn = document.createElement('button');
                cfgBtn.className = 'difficulty-select-btn';
                cfgBtn.textContent = 'Configure';
                cfgBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showConfigModal();
                });
                card.appendChild(cfgBtn);
            }
            
            container.appendChild(card);
        }
        
        // Add back button
        const backBtn = document.createElement('button');
        backBtn.className = 'difficulty-back-btn';
        backBtn.textContent = 'Back';
        backBtn.addEventListener('click', () => {
            dificulty_screen = false;
            title_screen = true;
            hideDifficultyMenu();
            showMainMenu();
        });
        difficultyMenu.appendChild(backBtn);
        
        // Add scroll hint (CSS controls visibility based on screen size)
        const scrollHint = document.createElement('div');
        scrollHint.className = 'difficulty-scroll-hint';
        scrollHint.innerHTML = 'Scroll for more ↓';
        difficultyMenu.insertBefore(scrollHint, difficultyMenu.firstChild);
    }
    
    difficultyMenu.style.display = 'flex';
    updateCanvasPointerEvents();
}

function hideDifficultyMenu(){
    const difficultyMenu = document.getElementById('difficulty-menu');
    if (difficultyMenu) difficultyMenu.style.display = 'none';
    updateCanvasPointerEvents();
}

function showLoseScreen() {
    // Hide UI popups on lose screen
    hideUIPopups();
    
    let loseScreen = document.getElementById('lose-screen');
    if (!loseScreen) {
        loseScreen = document.createElement('div');
        loseScreen.id = 'lose-screen';
        loseScreen.className = 'lose-screen';
        document.body.appendChild(loseScreen);

        const title = document.createElement('h1');
        title.className = 'lose-title';
        title.textContent = 'GAME OVER';
        loseScreen.appendChild(title);

        const message = document.createElement('p');
        message.className = 'lose-message';
        message.textContent = 'MR.C now owns the meadows, you failed to gather the funds to stop him.';
        loseScreen.appendChild(message);

        const btn = document.createElement('button');
        btn.className = 'lose-btn';
        btn.textContent = 'Return to Title';
        btn.addEventListener('click', () => {
            deleteSave();
            location.reload(); // Reload to reset everything
        });
        loseScreen.appendChild(btn);
    }
    loseScreen.style.display = 'flex';
    updateCanvasPointerEvents();
}

function deleteSave() {
    localData.remove('player');
    localData.remove('Day_curLvl_Dif');
    localData.remove('extralvlStuff');
    // Remove all levels
    for(let i = 0; i < levels.length; i++){
        for(let j = 0; j < levels[i].length; j++){
            if(levels[i][j] != 0 && levels[i][j] != undefined){
                localData.remove(levels[i][j].name);
            }
        }
    }
}

function selectDifficulty(difficulty){
    dificulty = difficulty;
    
    try {
        localData.set('Day_curLvl_Dif', {day: 0, currentLevel_y, currentLevel_x, dificulty});
        console.log('Difficulty saved:', difficulty);
    } catch (e) {
        console.warn('Failed to save difficulty:', e);
    }
    
    // Proceed directly into the game without showing difficulty screen again
    hideDifficultyMenu();
    dificulty_screen = false;
    title_screen = false;
    paused = false;
    
    console.log('Starting game with difficulty:', difficulty);
    // Ensure weather is rolled for the current day when starting a game
    if (typeof generateDailyWeather === 'function') {
        try { generateDailyWeather(); } catch(e) { console.warn('Failed to roll weather at game start:', e); }
    }
    levels[currentLevel_y][currentLevel_x].level_name_popup = true;
}

function selectCustomDifficulty(features){
    dificulty = 3; // Custom difficulty
    
    const questCoinsInput = document.getElementById('custom-quest-coins');
    const questDaysInput = document.getElementById('custom-quest-days');
    // Prefer rules saved via modal; otherwise build from card state
    const modalRules = window.customRules || null;
    const rules = modalRules ? {
        moneyLoss: typeof modalRules.moneyLoss === 'boolean' ? modalRules.moneyLoss : features[0].enabled,
        foodRot: typeof modalRules.foodRot === 'boolean' ? modalRules.foodRot : features[1].enabled,
        permaDeath: typeof modalRules.permaDeath === 'boolean' ? modalRules.permaDeath : features[2].enabled,
        mainQuestCoins: (typeof modalRules.mainQuestCoins === 'number' ? modalRules.mainQuestCoins : (questCoinsInput ? parseInt(questCoinsInput.value) : 10000)),
        mainQuestDays: (typeof modalRules.mainQuestDays === 'number' ? modalRules.mainQuestDays : (questDaysInput ? parseInt(questDaysInput.value) : 100)),
        startingCoins: (typeof modalRules.startingCoins === 'number' ? modalRules.startingCoins : 0),
        // PRESERVE all custom config from modal!
        weatherWeights: modalRules.weatherWeights || null,
        npcEnabled: modalRules.npcEnabled || null,
        areasEnabled: modalRules.areasEnabled || null,
        itemsEnabled: modalRules.itemsEnabled || null,
        itemPriceMultiplier: modalRules.itemPriceMultiplier ?? 100
    } : {
        moneyLoss: features[0].enabled,
        foodRot: features[1].enabled,
        permaDeath: features[2].enabled,
        mainQuestCoins: questCoinsInput ? parseInt(questCoinsInput.value) : 10000,
        mainQuestDays: questDaysInput ? parseInt(questDaysInput.value) : 100,
        startingCoins: 0,
        weatherWeights: null,
        npcEnabled: null,
        areasEnabled: null,
        itemsEnabled: null,
        itemPriceMultiplier: 100
    };
    window.customRules = rules;
    console.log('selectCustomDifficulty: Final rules with weatherWeights:', rules.weatherWeights);
    
    try {
        localData.set('Day_curLvl_Dif', {day: 0, currentLevel_y, currentLevel_x, dificulty, customRules: window.customRules});
        console.log('Custom difficulty saved:', window.customRules);
    } catch (e) {
        console.warn('Failed to save custom difficulty:', e);
    }
    
    // Proceed directly into the game
    hideDifficultyMenu();
    dificulty_screen = false;
    title_screen = false;
    paused = false;
    
    console.log('Starting game with custom difficulty:', window.customRules);
    // Ensure weather is rolled for the current day when starting a custom game
    if (typeof generateDailyWeather === 'function') {
        try { generateDailyWeather(); } catch(e) { console.warn('Failed to roll weather at custom start:', e); }
    }
    
    // Update player quests if player already exists
    if (typeof player !== 'undefined' && player.quests) {
        for (let q of player.quests) {
            if (q.og_name === "Save Cloudy Meadows") {
                q.days = window.customRules.mainQuestDays;
                q.maxDays = q.days;
                for (let goal of q.goals) {
                    if (goal.class === 'FundingGoal') {
                        goal.amount = window.customRules.mainQuestCoins;
                    }
                }
                // Refresh name with new days
                if (q.maxDays > 0) {
                    q.name = q.og_name + ' ' + q.days + ' days left';
                }
            }
        }
        // Apply starting coins immediately on new games (no saved player yet)
        try {
            const hasSavedPlayer = localData.get('player') != null;
            if (!hasSavedPlayer && typeof window.customRules?.startingCoins === 'number') {
                player.coins = window.customRules.startingCoins;
            }
        } catch (e) {
            // If localData is unavailable, fall back to applying when coins are zero
            if (player.coins === 0 && typeof window.customRules?.startingCoins === 'number') {
                player.coins = window.customRules.startingCoins;
            }
        }
    }

    // Apply NPC/critter filter rules immediately when starting with custom difficulty
    applyNPCFilterRules();
    applyCritterFilterRules();
    applyAreaRules();
    applyItemPriceMultiplier();
    removeDisabledItemsFromInventory();

    levels[currentLevel_y][currentLevel_x].level_name_popup = true;
}

let controlsContainer = null;
let controlRows = [];

function resetControls() {
    // Reset all control key bindings to defaults
    Controls_Interact_button_key = 'e';
    Controls_Eat_button_key = 'q';
    Controls_Up_button_key = 'w';
    Controls_Down_button_key = 's';
    Controls_Left_button_key = 'a';
    Controls_Right_button_key = 'd';
    Controls_Special_button_key = 'Shift';
    Controls_Quest_button_key = 'q';
    
    // Save the reset controls
    saveOptions();
    
    // Refresh the controls display if the options menu is open
    const controlsContainer = document.getElementById('title-controls-container');
    if (controlsContainer) {
        showTitleOptions();
    }
    
    // Refresh pause menu controls if pause menu is open
    const pauseControlsContainer = document.getElementById('pause-controls-container');
    if (pauseControlsContainer && pauseControlsContainer.parentElement.style.display !== 'none') {
        renderControlButtons(pauseControlsContainer);
    }
}

function renderControlButtons(container) {
    // Skip rendering on mobile - touch controls are used instead
    const isMobileOrSmallScreen = (typeof isMobile !== 'undefined' && isMobile) || window.innerWidth <= 768;
    if (isMobileOrSmallScreen) {
        return;
    }

    const controlItems = [
        { label: 'Interact:', key: () => Controls_Interact_button_key || 'z', controlIndex: 1 },
        { label: 'Eat:', key: () => Controls_Eat_button_key || 'e', controlIndex: 2 },
        { label: 'Up:', key: () => Controls_Up_button_key || 'w', controlIndex: 3 },
        { label: 'Down:', key: () => Controls_Down_button_key || 's', controlIndex: 4 },
        { label: 'Left:', key: () => Controls_Left_button_key || 'a', controlIndex: 5 },
        { label: 'Right:', key: () => Controls_Right_button_key || 'd', controlIndex: 6 },
        { label: 'Special:', key: () => Controls_Special_button_key || 'x', controlIndex: 7 },
        { label: 'Quest:', key: () => Controls_Quest_button_key || 'q', controlIndex: 8 }
    ];
    
    // If container is provided, use it as parent (for pause menu, options, etc.)
    if (container) {
        container.innerHTML = '';
        
        for (let i = 0; i < controlItems.length; i++) {
            const item = controlItems[i];
            
            const row = document.createElement('div');
            row.className = 'control-row';
            row.style.display = 'flex';
            row.style.gap = '10px';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.width = '100%';
            row.style.padding = '4px 0';
            
            const label = document.createElement('span');
            label.className = 'control-label';
            label.textContent = item.label;
            label.style.minWidth = '70px';
            row.appendChild(label);
            
            const button = document.createElement('button');
            button.className = 'control-button';
            button.style.minWidth = '60px';
            button.style.cursor = 'pointer';
            button.style.pointerEvents = 'auto';
            const keyValue = item.key();
            button.textContent = keyValue ? String(keyValue) : '?';
            
            const clickHandler = function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('CLICK DETECTED - Control button clicked:', item.label, 'controlIndex:', item.controlIndex);
                console.log('Activating keymapping mode...');
                console.log('keymapping defined?:', typeof keymapping !== 'undefined');
                
                if (typeof keymapping !== 'undefined') {
                    keymapping = true;
                    currentMappingIndex = item.controlIndex;
                    control_set = item.controlIndex;
                    button.textContent = 'Press Key...';
                    console.log('Keymapping active for control:', item.controlIndex);
                } else {
                    console.error('keymapping variable not defined!');
                }
            };
            
            button.addEventListener('click', clickHandler);
            button.addEventListener('mousedown', function(e) {
                console.log('MOUSEDOWN on button:', item.label);
            });
            
            row.appendChild(button);
            container.appendChild(row);
        }
        console.log('Inline buttons created, total:', controlItems.length);
        return;
    }
    
    // Otherwise use the global container for game canvas (original behavior)
    if (!controlsContainer) {
        controlsContainer = document.createElement('div');
        controlsContainer.className = 'controls-container';
        document.getElementById('game-container').appendChild(controlsContainer);
        
        for (let i = 0; i < controlItems.length; i++) {
            const item = controlItems[i];
            const row = document.createElement('div');
            row.className = 'control-row';
            
            const label = document.createElement('div');
            label.className = 'control-label';
            label.textContent = item.label;
            row.appendChild(label);
            
            const button = document.createElement('button');
            button.className = 'control-button';
            button.addEventListener('click', () => {
                console.log('Control button clicked (canvas):', item.label, 'controlIndex:', item.controlIndex);
                console.log('Activating keymapping mode...');
                
                if (typeof keymapping !== 'undefined') {
                    keymapping = true;
                    currentMappingIndex = item.controlIndex;
                    control_set = item.controlIndex;
                    button.textContent = 'Press Key...';
                    console.log('Keymapping active for control:', item.controlIndex);
                } else {
                    console.error('keymapping variable not defined!');
                }
            });
            row.appendChild(button);
            
            controlsContainer.appendChild(row);
            controlRows.push({ row, button });
        }
    }
    
    controlsContainer.style.left = x + 'px';
    controlsContainer.style.top = y + 'px';
    controlsContainer.style.display = 'flex';
    
    for (let i = 0; i < controlItems.length; i++) {
        const { button } = controlRows[i];
        const keyValue = controlItems[i].key();
        const keyLength = keyValue.length;
        const fontSize = keyLength > 5 ? Math.max(15 - ((keyLength - 5) * 1.5), 8) : 15;
        
        button.style.fontSize = fontSize + 'px';
        button.textContent = keyValue;
        
        if (control_set === controlItems[i].controlIndex) {
            controlRows[i].row.classList.add('highlighted');
        } else {
            controlRows[i].row.classList.remove('highlighted');
        }
    }
}

function hideControls() {
    if (controlsContainer) {
        controlsContainer.style.display = 'none';
        // toggle labels as well
        for (let i = 0; i < controlRows.length; i++) {
            controlRows[i].row.classList.remove('highlighted');
        }
    }


}

function showOptions(){
    push()
    stroke(149, 108, 65);
    strokeWeight(5);
    fill(187, 132, 75);
    rectMode(CENTER);
    rect(((4*canvasWidth)/5)+50, canvasHeight/2, 300, canvasHeight);
    fill(255);
    stroke(0);
    strokeWeight(2);
    textFont(player_2);
    textAlign(CENTER, CENTER);
    textSize(30);
    text('Option', ((4*canvasWidth)/5)+40, 30);
    image(music_note_img, ((4*canvasWidth)/5)-80, (canvasHeight/6)-50);
    image(fx_img, ((4*canvasWidth)/5)-80, (canvasHeight/6)-10);
    pop()
    
    // Show DOM-based options menu
    showTitleOptions();
}

function showTitleOptions(){
    let optionsMenu = document.getElementById('options-menu');
    if (!optionsMenu) {
        // Create structure once
        optionsMenu = document.createElement('div');
        optionsMenu.id = 'options-menu';
        optionsMenu.className = 'title-options-menu';
        document.body.appendChild(optionsMenu);
        
        const title = document.createElement('h2');
        title.className = 'options-title';
        title.textContent = 'Options';
        optionsMenu.appendChild(title);
        
        // Audio section
        const audioSection = document.createElement('div');
        audioSection.className = 'options-section';
        
        const musicRow = document.createElement('div');
        musicRow.className = 'slider-row';
        const musicIcon = document.createElement('img');
        musicIcon.src = 'images/ui/Music_Note.png';
        musicIcon.alt = 'Music';
        musicIcon.className = 'options-icon';
        const musicLabel = document.createElement('label');
        musicLabel.htmlFor = 'music-slider-title';
        musicLabel.textContent = 'Music';
        const musicSlider = document.createElement('input');
        musicSlider.id = 'music-slider-title';
        musicSlider.type = 'range';
        musicSlider.min = '0';
        musicSlider.max = '1';
        musicSlider.step = '0.01';
        musicSlider.className = 'options-slider';
        musicSlider.addEventListener('input', () => {
            window.musicSlider.value(musicSlider.value);
        });
        musicRow.appendChild(musicIcon);
        musicRow.appendChild(musicLabel);
        musicRow.appendChild(musicSlider);
        audioSection.appendChild(musicRow);
        
        const fxRow = document.createElement('div');
        fxRow.className = 'slider-row';
        const fxIcon = document.createElement('img');
        fxIcon.src = 'images/ui/fx.png';
        fxIcon.alt = 'FX';
        fxIcon.className = 'options-icon';
        const fxLabel = document.createElement('label');
        fxLabel.htmlFor = 'fx-slider-title';
        fxLabel.textContent = 'Sound';
        const fxSlider = document.createElement('input');
        fxSlider.id = 'fx-slider-title';
        fxSlider.type = 'range';
        fxSlider.min = '0';
        fxSlider.max = '1';
        fxSlider.step = '0.01';
        fxSlider.className = 'options-slider';
        fxSlider.addEventListener('input', () => {
            window.fxSlider.value(fxSlider.value);
        });
        fxRow.appendChild(fxIcon);
        fxRow.appendChild(fxLabel);
        fxRow.appendChild(fxSlider);
        audioSection.appendChild(fxRow);
        optionsMenu.appendChild(audioSection);
        
        // Controls section (hidden on mobile)
        if (!isMobile) {
            const controlsSection = document.createElement('div');
            controlsSection.className = 'options-section options-controls-section';
            controlsSection.id = 'options-controls-section';
            const controlsTitle = document.createElement('h3');
            controlsTitle.className = 'options-section-title';
            controlsTitle.textContent = 'Controls';
            controlsSection.appendChild(controlsTitle);
            const controlsContainer = document.createElement('div');
            controlsContainer.id = 'title-controls-container';
            controlsContainer.className = 'title-controls-container';
            controlsSection.appendChild(controlsContainer);
            optionsMenu.appendChild(controlsSection);
        }
        
  
        // Buttons section
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'options-button-group';
        const resetBtn = document.createElement('button');
        resetBtn.id = 'reset-controls-btn';
        resetBtn.className = 'options-button';
        resetBtn.textContent = 'Reset Controls';
        resetBtn.addEventListener('click', () => {
            resetControls();
        });
        buttonGroup.appendChild(resetBtn);
        const clearBtn = document.createElement('button');
        clearBtn.id = 'clear-data-btn';
        clearBtn.className = 'options-button options-button-danger';
        clearBtn.textContent = 'Clear Save';
        clearBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all data? This cannot be undone!')) {
                clear_anim = true;
                try {
                    // Clear the IndexedDB
                    localData.clear();
                    console.log('Data cleared from IndexedDB');
                    
                    // After a brief delay to show animation, reload the window
                    setTimeout(() => {
                        console.log('Reloading window...');
                        window.location.reload();
                    }, 1500); // Let the animation finish
                } catch (e) {
                    console.warn('Failed to clear data:', e);
                    window.location.reload(); // Reload anyway to reset state
                }
            }
        });
        buttonGroup.appendChild(clearBtn);

        optionsMenu.appendChild(buttonGroup);
        
        const backBtn = document.createElement('button');
        backBtn.id = 'back-btn';
        backBtn.className = 'options-back-button';
        backBtn.textContent = 'Back';
        backBtn.addEventListener('click', () => {
            paused = false;
            hideTitleOptions();
        });
        optionsMenu.appendChild(backBtn);
    }
    
    // Update sliders and controls content
    const musicSliderDOM = document.getElementById('music-slider-title');
    const fxSliderDOM = document.getElementById('fx-slider-title');
    const controlsContainer = document.getElementById('title-controls-container');
    
    if (musicSliderDOM) {
        musicSliderDOM.value = musicSlider.value();
    }
    if (fxSliderDOM) {
        fxSliderDOM.value = fxSlider.value();
    }
    
    // Only render controls if the container is empty (first time or after reset)
    if (controlsContainer && controlsContainer.children.length === 0) {
        console.log('Rendering controls for first time in options');
        renderControlButtons(controlsContainer);
    }
    
    optionsMenu.style.display = 'flex';
    updateCanvasPointerEvents();
}

function hideTitleOptions(){
    const optionsMenu = document.getElementById('options-menu');
    if (optionsMenu) optionsMenu.style.display = 'none';
    updateCanvasPointerEvents();
}

// ==================== CONFIG MODAL ====================
function ensureConfigModal() {
    let overlay = document.getElementById('config-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'config-overlay';
    overlay.className = 'config-overlay';
    document.body.appendChild(overlay);

    const modal = document.createElement('div');
    modal.className = 'config-modal';
    overlay.appendChild(modal);

    const title = document.createElement('h3');
    title.className = 'config-title';
    title.textContent = 'Configure Game Rules';
    modal.appendChild(title);

    const rows = [];
    function addSliderRow(labelText, id, min = 0, max = 100, step = 1) {
        const row = document.createElement('div');
        row.className = 'config-row';
        const label = document.createElement('label');
        label.className = 'config-label';
        label.htmlFor = id;
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'range';
        input.id = id;
        input.className = 'config-slider';
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        const valueBadge = document.createElement('span');
        valueBadge.className = 'config-slider-value';
        valueBadge.textContent = '0';
        input.addEventListener('input', () => {
            valueBadge.textContent = String(input.value);
            // Keep total at 100 by balancing with Clear
            normalizeWeatherTotal(id);
        });
        row.appendChild(label);
        row.appendChild(input);
        row.appendChild(valueBadge);
        modal.appendChild(row);
        rows.push(input);
    }
    function addNumberRow(labelText, id, placeholder) {
        const row = document.createElement('div');
        row.className = 'config-row';
        const label = document.createElement('label');
        label.className = 'config-label';
        label.htmlFor = id;
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'number';
        input.id = id;
        input.className = 'config-input';
        input.placeholder = placeholder || '';
        row.appendChild(label);
        row.appendChild(input);
        modal.appendChild(row);
        rows.push(input);
    }

    function addToggleRow(labelText, id) {
        const row = document.createElement('div');
        row.className = 'config-row';
        const label = document.createElement('label');
        label.className = 'config-label';
        label.htmlFor = id;
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        input.className = 'config-checkbox';
        row.appendChild(label);
        row.appendChild(input);
        modal.appendChild(row);
        rows.push(input);
    }

    addNumberRow('Main Quest Coins', 'cfg-main-quest-coins', 'e.g. 10000');
    addNumberRow('Main Quest Days', 'cfg-main-quest-days', 'e.g. 100');
    addNumberRow('Starting Coins', 'cfg-starting-coins', 'e.g. 0');
    addToggleRow('Money Loss', 'cfg-money-loss');
    addToggleRow('Food Rot', 'cfg-food-rot');
    addToggleRow('Perma Death', 'cfg-perma-death');

    // NPC toggle grid
    const npcTitle = document.createElement('div');
    npcTitle.className = 'config-subtitle';
    npcTitle.textContent = 'NPCs (Enable/Disable)';
    modal.appendChild(npcTitle);
    const npcGrid = document.createElement('div');
    npcGrid.id = 'cfg-npc-grid';
    npcGrid.className = 'config-grid config-sprite-grid';
    // Build grid from dialogue keys (fallback to empty list)
    const npcNames = Object.keys(typeof Dialouge_JSON !== 'undefined' && Dialouge_JSON ? Dialouge_JSON : {});
    
    // NPC name to image path mapping
    const NPC_SPRITE_MAP = {
        'Deb': 'images/npc/deb.png',
        'Rick': 'images/npc/cowboy_rick.png',
        'Meb': 'images/npc/meb.png',
        'Mario': 'images/npc/mario.png',
        'Garry': 'images/npc/garry.png',
        'Mira': 'images/npc/mira.png',
        'OldManJ': 'images/npc/old_man_jay1.png',
        'Brandon': 'images/npc/brandon.png',
        'Brent': 'images/npc/brent.png',
        'BlindPete': 'images/npc/blind_pete.png',
        'James': 'images/npc/james.png',
        'Liam': 'images/npc/liam.png',
        'Zoda': 'images/npc/christian.png',
        'Super Tina': 'images/npc/supertina.png',
        'Guy': 'images/npc/Guy.png',
        'Vinny': 'images/npc/vinny.png',
        'Kenny': 'images/npc/kenny.png',
        'Ishmil': 'images/npc/Ishmil.png',
        'David': 'images/npc/David.png',
        'Adam': 'images/npc/Adam.png',
        'Barry': 'images/npc/Barry.png',
        'Mr.C': 'images/npc/mrC.png',
        'Dog': 'images/npc/dog_right.png',
        'Ticket Master': 'images/npc/Ticket_Master.png',
        'Sarah': 'images/npc/mira.png',
        'Marcus': 'images/npc/marcus.png',
        'Elena': 'images/npc/Sophia.png',
        'Thomas': 'images/npc/vinny.png',
        'Victoria': 'images/npc/supertina.png',
        'Dante': 'images/npc/Barry.png',
        'Kai': 'images/npc/kenny.png',
        'Coral': 'images/npc/coral.png',
        'Fisher Joe': 'images/npc/fisher_joe.png',
        'Sandy': 'images/npc/sandy.png',
        'Skipper': 'images/npc/skipper.png',
        'Alex Chen': 'images/npc/chen.png',
        'Priya Patel': 'images/npc/priya.png',
        'Marcus Brown': 'images/npc/marcus.png',
        'Sophia Moore': 'images/npc/Sophia.png',
        'Jordan Kim': 'images/npc/Jake.png',
        'Kiah': 'images/npc/coral.png'
    };
    
    npcNames.forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'config-grid-item config-sprite-item';
        btn.dataset.npcName = name;
        
        // Create sprite img element
        const spriteImg = document.createElement('img');
        spriteImg.className = 'config-sprite-img';
        spriteImg.width = 32;
        spriteImg.height = 32;
        spriteImg.style.imageRendering = 'pixelated';
        const imgPath = NPC_SPRITE_MAP[name] || 'images/npc/cowboy_rick.png';
        spriteImg.src = imgPath;
        spriteImg.alt = name;
        btn.appendChild(spriteImg);
        
        // Add name label
        const label = document.createElement('span');
        label.className = 'config-sprite-label';
        label.textContent = name;
        btn.appendChild(label);
        
        // Click toggles active state
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
        });
        npcGrid.appendChild(btn);
    });
    modal.appendChild(npcGrid);
    // Quick actions
    const npcActions = document.createElement('div');
    npcActions.className = 'config-actions';
    const allOnBtn = document.createElement('button');
    allOnBtn.className = 'config-btn';
    allOnBtn.textContent = 'All On';
    allOnBtn.addEventListener('click', () => {
        Array.from(npcGrid.querySelectorAll('.config-grid-item')).forEach(el => el.classList.add('active'));
    });
    const allOffBtn = document.createElement('button');
    allOffBtn.className = 'config-btn';
    allOffBtn.textContent = 'All Off';
    allOffBtn.addEventListener('click', () => {
        Array.from(npcGrid.querySelectorAll('.config-grid-item')).forEach(el => el.classList.remove('active'));
    });
    npcActions.appendChild(allOnBtn);
    npcActions.appendChild(allOffBtn);
    modal.appendChild(npcActions);

    // Critters toggle grid (frogs, fireflies, bees, bunnies, etc.)
    const crittersTitle = document.createElement('div');
    crittersTitle.className = 'config-subtitle';
    crittersTitle.textContent = 'Critters (Enable/Disable)';
    modal.appendChild(crittersTitle);
    const crittersGrid = document.createElement('div');
    crittersGrid.id = 'cfg-critters-grid';
    crittersGrid.className = 'config-grid config-sprite-grid';
    
    // Critter definitions with sprites
    const CRITTER_DEFINITIONS = [
        { name: 'Frog', sprite: 'images/npc/frog_front.png' },
        { name: 'LightBug', sprite: 'images/tiles/FireFlys.gif' },
        { name: 'Bees', sprite: 'images/tiles/Bees.gif' },
        { name: 'ladybug', sprite: 'images/tiles/LadyBugs.gif' }
    ];
    
    CRITTER_DEFINITIONS.forEach(critter => {
        const btn = document.createElement('button');
        btn.className = 'config-grid-item config-sprite-item active';
        btn.dataset.critterName = critter.name;
        
        const spriteImg = document.createElement('img');
        spriteImg.className = 'config-sprite-img';
        spriteImg.width = 32;
        spriteImg.height = 32;
        spriteImg.style.imageRendering = 'pixelated';
        spriteImg.src = critter.sprite;
        spriteImg.alt = critter.name;
        btn.appendChild(spriteImg);
        
        const label = document.createElement('span');
        label.className = 'config-sprite-label';
        label.textContent = critter.name;
        btn.appendChild(label);
        
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
        });
        crittersGrid.appendChild(btn);
    });
    modal.appendChild(crittersGrid);
    
    // Critters quick actions
    const crittersActions = document.createElement('div');
    crittersActions.className = 'config-actions';
    const crittersAllOnBtn = document.createElement('button');
    crittersAllOnBtn.className = 'config-btn';
    crittersAllOnBtn.textContent = 'All On';
    crittersAllOnBtn.addEventListener('click', () => {
        Array.from(crittersGrid.querySelectorAll('.config-grid-item')).forEach(el => el.classList.add('active'));
    });
    const crittersAllOffBtn = document.createElement('button');
    crittersAllOffBtn.className = 'config-btn';
    crittersAllOffBtn.textContent = 'All Off';
    crittersAllOffBtn.addEventListener('click', () => {
        Array.from(crittersGrid.querySelectorAll('.config-grid-item')).forEach(el => el.classList.remove('active'));
    });
    crittersActions.appendChild(crittersAllOnBtn);
    crittersActions.appendChild(crittersAllOffBtn);
    modal.appendChild(crittersActions);

    // Weather rarity sliders (weights; higher = more likely)
    const weatherTitle = document.createElement('div');
    weatherTitle.className = 'config-subtitle';
    weatherTitle.textContent = 'Weather Rarity (Weights)';
    modal.appendChild(weatherTitle);
    addSliderRow('Partly Cloudy', 'cfg-weather-partly', 0, 100, 1);
    addSliderRow('Overcast', 'cfg-weather-overcast', 0, 100, 1);
    addSliderRow('Fog', 'cfg-weather-fog', 0, 100, 1);
    addSliderRow('Sunshower', 'cfg-weather-sunshower', 0, 100, 1);
    addSliderRow('Rain', 'cfg-weather-rain', 0, 100, 1);
    addSliderRow('Thunderstorm', 'cfg-weather-thunderstorm', 0, 100, 1);
    addSliderRow('Frog Rain', 'cfg-weather-frog', 0, 100, 1);

    // Total indicator (always kept at 100%)
    const totalRow = document.createElement('div');
    totalRow.className = 'config-row';
    const totalSpacer = document.createElement('div');
    totalSpacer.style.flex = '1';
    const totalBadge = document.createElement('div');
    totalBadge.id = 'cfg-weather-total';
    totalBadge.className = 'config-slider-remaining';
    totalBadge.textContent = 'Clear: 100%';
    totalRow.appendChild(totalSpacer);
    totalRow.appendChild(totalBadge);
    modal.appendChild(totalRow);

    // Areas/Levels toggle grid
    const areasTitle = document.createElement('div');
    areasTitle.className = 'config-subtitle';
    areasTitle.textContent = 'Areas (Enable/Disable)';
    modal.appendChild(areasTitle);
    const areasGrid = document.createElement('div');
    areasGrid.id = 'cfg-areas-grid';
    areasGrid.className = 'config-grid';
    // Define areas with their sub-levels
    const AREA_DEFINITIONS = [
        { name: 'Cloudy Meadows', prefix: 'Cloudy Meadows' },
        { name: 'Poly Park', prefix: 'Poly Park' },
        { name: 'Swiggy Swamps', prefix: 'Swiggy Swamps' },
        { name: 'The Big City', prefix: 'The Big City' },
        { name: 'Beach', prefix: 'Beach' }
    ];
    AREA_DEFINITIONS.forEach(area => {
        const btn = document.createElement('button');
        btn.className = 'config-grid-item active'; // Areas on by default
        btn.dataset.areaName = area.name;
        btn.dataset.areaPrefix = area.prefix;
        btn.textContent = area.name;
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
        });
        areasGrid.appendChild(btn);
    });
    modal.appendChild(areasGrid);
    // Area quick actions
    const areasActions = document.createElement('div');
    areasActions.className = 'config-actions';
    const areasAllOnBtn = document.createElement('button');
    areasAllOnBtn.className = 'config-btn';
    areasAllOnBtn.textContent = 'All On';
    areasAllOnBtn.addEventListener('click', () => {
        Array.from(areasGrid.querySelectorAll('.config-grid-item')).forEach(el => el.classList.add('active'));
    });
    const areasAllOffBtn = document.createElement('button');
    areasAllOffBtn.className = 'config-btn';
    areasAllOffBtn.textContent = 'All Off';
    areasAllOffBtn.addEventListener('click', () => {
        Array.from(areasGrid.querySelectorAll('.config-grid-item')).forEach(el => el.classList.remove('active'));
    });
    areasActions.appendChild(areasAllOnBtn);
    areasActions.appendChild(areasAllOffBtn);
    modal.appendChild(areasActions);

    // ========== MORE OPTIONS (Expandable) ==========
    const moreBtn = document.createElement('button');
    moreBtn.className = 'config-btn config-more-btn';
    moreBtn.textContent = '▶ More Options';
    moreBtn.style.marginTop = '10px';
    moreBtn.style.width = '100%';
    modal.appendChild(moreBtn);

    const moreSection = document.createElement('div');
    moreSection.id = 'cfg-more-section';
    moreSection.className = 'config-more-section';
    moreSection.style.display = 'none';
    modal.appendChild(moreSection);

    moreBtn.addEventListener('click', () => {
        const isHidden = moreSection.style.display === 'none';
        moreSection.style.display = isHidden ? 'block' : 'none';
        moreBtn.textContent = isHidden ? '▼ More Options' : '▶ More Options';
    });

    // Item Min Cost slider
    const itemCostTitle = document.createElement('div');
    itemCostTitle.className = 'config-subtitle';
    itemCostTitle.textContent = 'Item Price Multiplier';
    moreSection.appendChild(itemCostTitle);

    const itemCostRow = document.createElement('div');
    itemCostRow.className = 'config-row';
    const itemCostLabel = document.createElement('label');
    itemCostLabel.className = 'config-label';
    itemCostLabel.textContent = 'Price Multiplier';
    const itemCostSlider = document.createElement('input');
    itemCostSlider.type = 'range';
    itemCostSlider.id = 'cfg-item-price-mult';
    itemCostSlider.className = 'config-slider';
    itemCostSlider.min = '0';
    itemCostSlider.max = '500';
    itemCostSlider.step = '10';
    itemCostSlider.value = '100';
    const itemCostBadge = document.createElement('span');
    itemCostBadge.className = 'config-slider-value';
    itemCostBadge.textContent = '100%';
    itemCostSlider.addEventListener('input', () => {
        itemCostBadge.textContent = itemCostSlider.value + '%';
    });
    itemCostRow.appendChild(itemCostLabel);
    itemCostRow.appendChild(itemCostSlider);
    itemCostRow.appendChild(itemCostBadge);
    moreSection.appendChild(itemCostRow);

    // Items toggle grid
    const itemsTitle = document.createElement('div');
    itemsTitle.className = 'config-subtitle';
    itemsTitle.textContent = 'Items (Enable/Disable)';
    moreSection.appendChild(itemsTitle);
    const itemsGrid = document.createElement('div');
    itemsGrid.id = 'cfg-items-grid';
    itemsGrid.className = 'config-grid config-sprite-grid';
    
    // Item name to image path mapping
    const ITEM_SPRITE_MAP = {
        'Hoe': 'images/items/Hoe.png',
        'Corn': 'images/items/Corn_item.png',
        'Corn Seed': 'images/items/Corn_Seed_bag.png',
        'Junk': 'images/items/junk.png',
        'Sweet Potatoes': 'images/items/SweetPotato.png',
        'Sweet Potato Seed': 'images/items/seedbag_sp.png',
        'Strawberries': 'images/items/Stawberry.png',
        'Strawberry Seed': 'images/items/SeedBag_Stawberry.png',
        'Compost': 'images/items/Compost.png',
        'Ladybugs': 'images/items/Lady_Bug_bag.png',
        'Flower Seed': 'images/items/SeedBagFlower.png',
        'Sprinkler': 'images/items/Sprinkler.png',
        'Full Course': 'images/items/FullCourse.png',
        'Tomato Seed': 'images/items/tomato_bag.png',
        'Tomato': 'images/items/tomato.png',
        'Watermelon Seed': 'images/items/seedbagwatermelon.png',
        'Watermelon': 'images/items/watermelon2.png',
        'Robot3': 'images/items/robot.png',
        'Up Command': 'images/items/floppy_up.png',
        'Right Command': 'images/items/floppy_right.png',
        'Down Command': 'images/items/floppy_down.png',
        'Left Command': 'images/items/floppy_left.png',
        'Interact Command': 'images/items/floppy_interact.png',
        'Hemp Seed': 'images/items/hemp_seeds.png',
        'Hemp Flower': 'images/items/hemp.png',
        'Restart Command': 'images/items/floppy_restart.png',
        'Robot1': 'images/items/robot.png',
        'Robot2': 'images/items/robot2.png',
        'Add to Chest Command': 'images/items/Floppy_addChestt.png',
        'Add from Chest Command': 'images/items/floppy_removechest.png',
        'Veggie Oil': 'images/items/veg_oil.png',
        'Shovel': 'images/items/shovel.png',
        'Backpack': 'images/items/backPack.png',
        '1 Day Pause Command': 'images/items/Floppy_Pause.png',
        'Hotdog': 'images/items/HotDog.png',
        'Chest': 'images/items/Chest.png',
        'Grinder': 'images/items/Grinder.png',
        'Veggie Press': 'images/items/veg_oil_maker.png',
        'Carrot': 'images/items/carrot.png',
        'Carrot Seed': 'images/items/seedbag_carrot.png',
        'Pumpkin': 'images/items/Pumpkin.png',
        'Pumpkin Seed': 'images/items/Pumpkin_seedBag.png',
        'Bed': 'images/tiles/Bed.png',
        'Wall': 'images/tiles/Wood.png',
        'Axe': 'images/items/Hoe.png',
        'Composter': 'images/tiles/Worm_Bucket.png',
        'Hemp Oil': 'images/items/veg_oil.png',
        'Fruit Juice': 'images/items/veg_oil.png'
    };
    
    // Build item list from ITEM_DEFINITIONS
    const itemDefs = typeof ITEM_DEFINITIONS !== 'undefined' ? ITEM_DEFINITIONS : [];
    itemDefs.forEach((item, idx) => {
        if (!item || idx === 0) return; // Skip empty slot
        if (!item.name) return;
        const btn = document.createElement('button');
        btn.className = 'config-grid-item config-sprite-item active'; // Items on by default
        btn.dataset.itemIdx = idx;
        btn.dataset.itemName = item.name;
        
        // Create sprite img element
        const spriteImg = document.createElement('img');
        spriteImg.className = 'config-sprite-img';
        spriteImg.width = 32;
        spriteImg.height = 32;
        spriteImg.style.imageRendering = 'pixelated';
        const imgPath = ITEM_SPRITE_MAP[item.name] || 'images/items/junk.png';
        spriteImg.src = imgPath;
        spriteImg.alt = item.name;
        btn.appendChild(spriteImg);
        
        // Add name label
        const label = document.createElement('span');
        label.className = 'config-sprite-label';
        label.textContent = item.name;
        btn.appendChild(label);
        
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
        });
        itemsGrid.appendChild(btn);
    });
    moreSection.appendChild(itemsGrid);
    // Items quick actions
    const itemsActions = document.createElement('div');
    itemsActions.className = 'config-actions';
    const itemsAllOnBtn = document.createElement('button');
    itemsAllOnBtn.className = 'config-btn';
    itemsAllOnBtn.textContent = 'All On';
    itemsAllOnBtn.addEventListener('click', () => {
        Array.from(itemsGrid.querySelectorAll('.config-grid-item')).forEach(el => el.classList.add('active'));
    });
    const itemsAllOffBtn = document.createElement('button');
    itemsAllOffBtn.className = 'config-btn';
    itemsAllOffBtn.textContent = 'All Off';
    itemsAllOffBtn.addEventListener('click', () => {
        Array.from(itemsGrid.querySelectorAll('.config-grid-item')).forEach(el => el.classList.remove('active'));
    });
    itemsActions.appendChild(itemsAllOnBtn);
    itemsActions.appendChild(itemsAllOffBtn);
    moreSection.appendChild(itemsActions);

    const actions = document.createElement('div');
    actions.className = 'config-actions';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'config-btn';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
        saveConfigModal();
    });
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'config-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', hideConfigModal);
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    modal.appendChild(actions);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) hideConfigModal();
    });

    return overlay;
}

function showConfigModal() {
    const overlay = ensureConfigModal();
    // Populate fields from current rules or defaults
    const rules = window.customRules || {};
    document.getElementById('cfg-main-quest-coins').value = (rules.mainQuestCoins ?? 10000);
    document.getElementById('cfg-main-quest-days').value = (rules.mainQuestDays ?? 100);
    document.getElementById('cfg-starting-coins').value = (rules.startingCoins ?? 0);
    document.getElementById('cfg-money-loss').checked = !!(rules.moneyLoss ?? true);
    document.getElementById('cfg-food-rot').checked = !!(rules.foodRot ?? true);
    document.getElementById('cfg-perma-death').checked = !!(rules.permaDeath ?? false);
    // NPC grid state
    const npcGrid = document.getElementById('cfg-npc-grid');
    const enabled = rules.npcEnabled || null;
    if (npcGrid) {
        const items = Array.from(npcGrid.querySelectorAll('.config-grid-item'));
        items.forEach(el => {
            const name = el.dataset.npcName;
            const isOn = enabled == null ? true : !!enabled[name];
            el.classList.toggle('active', isOn);
            // Special visual emphasis for Mr.C
            if (name === 'Mr.C') {
                el.setAttribute('data-npc-name', 'Mr.C');
            }
        });
    }
    // Weather weights defaults mirror current system probabilities
    const ww = rules.weatherWeights ?? {
        'clear': 49.5,
        'partly-cloudy': 15,
        'overcast': 10,
        'fog': 7,
        'sunshower': 8,
        'rain': 8,
        'thunderstorm': 2,
        'frog-rain': 0.5
    };
    const setSlider = (id, v) => { const el = document.getElementById(id); const badge = el?.parentElement?.querySelector('.config-slider-value'); if (el) el.value = v; if (badge) badge.textContent = String(v); };
    setSlider('cfg-weather-partly', ww['partly-cloudy']);
    setSlider('cfg-weather-overcast', ww['overcast']);
    setSlider('cfg-weather-fog', ww['fog']);
    setSlider('cfg-weather-sunshower', ww['sunshower']);
    setSlider('cfg-weather-rain', ww['rain']);
    setSlider('cfg-weather-thunderstorm', ww['thunderstorm']);
    setSlider('cfg-weather-frog', ww['frog-rain']);

    // Normalize total to 100 by adjusting Clear accordingly
    normalizeWeatherTotal(null);

    // Areas grid state
    const areasGrid = document.getElementById('cfg-areas-grid');
    const areasEnabled = rules.areasEnabled || null;
    if (areasGrid) {
        Array.from(areasGrid.querySelectorAll('.config-grid-item')).forEach(el => {
            const name = el.dataset.areaName;
            const isOn = areasEnabled == null ? true : !!areasEnabled[name];
            el.classList.toggle('active', isOn);
        });
    }

    // Items grid state (in More section)
    const itemsGrid = document.getElementById('cfg-items-grid');
    const itemsEnabled = rules.itemsEnabled || null;
    if (itemsGrid) {
        Array.from(itemsGrid.querySelectorAll('.config-grid-item')).forEach(el => {
            const idx = el.dataset.itemIdx;
            const isOn = itemsEnabled == null ? true : !!itemsEnabled[idx];
            el.classList.toggle('active', isOn);
        });
    }

    // Critters grid state
    const crittersGrid = document.getElementById('cfg-critters-grid');
    const crittersEnabled = rules.crittersEnabled || null;
    if (crittersGrid) {
        Array.from(crittersGrid.querySelectorAll('.config-grid-item')).forEach(el => {
            const name = el.dataset.critterName;
            const isOn = crittersEnabled == null ? true : !!crittersEnabled[name];
            el.classList.toggle('active', isOn);
        });
    }

    // Item price multiplier
    const priceMultSlider = document.getElementById('cfg-item-price-mult');
    const priceMultBadge = priceMultSlider?.parentElement?.querySelector('.config-slider-value');
    if (priceMultSlider) {
        priceMultSlider.value = rules.itemPriceMultiplier ?? 100;
        if (priceMultBadge) priceMultBadge.textContent = (rules.itemPriceMultiplier ?? 100) + '%';
    }

    overlay.style.display = 'flex';
    updateCanvasPointerEvents();
}

function hideConfigModal() {
    const overlay = document.getElementById('config-overlay');
    if (overlay) overlay.style.display = 'none';
    updateCanvasPointerEvents();
}

function clampInt(val, min, max, fallback) {
    const n = parseInt(val);
    if (isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}

function saveConfigModal() {
    const newRules = {
        mainQuestCoins: clampInt(document.getElementById('cfg-main-quest-coins').value, 0, 100000000, 10000),
        mainQuestDays: clampInt(document.getElementById('cfg-main-quest-days').value, 0, 100000, 100),
        startingCoins: clampInt(document.getElementById('cfg-starting-coins').value, 0, 100000000, 0),
        moneyLoss: !!document.getElementById('cfg-money-loss').checked,
        foodRot: !!document.getElementById('cfg-food-rot').checked,
        permaDeath: !!document.getElementById('cfg-perma-death').checked,
        // Build npcEnabled map from grid
        npcEnabled: (() => {
            const grid = document.getElementById('cfg-npc-grid');
            const out = {};
            if (grid) {
                Array.from(grid.querySelectorAll('.config-grid-item')).forEach(el => {
                    const name = el.dataset.npcName;
                    out[name] = el.classList.contains('active');
                });
            }
            return out;
        })(),
        weatherWeights: (() => {
            const get = (id) => clampInt(document.getElementById(id).value, 0, 100, 0);
            const ww = {
                'partly-cloudy': get('cfg-weather-partly'),
                'overcast': get('cfg-weather-overcast'),
                'fog': get('cfg-weather-fog'),
                'sunshower': get('cfg-weather-sunshower'),
                'rain': get('cfg-weather-rain'),
                'thunderstorm': get('cfg-weather-thunderstorm'),
                'frog-rain': get('cfg-weather-frog')
            };
            const sumOthers = ww['partly-cloudy'] + ww['overcast'] + ww['fog'] + ww['sunshower'] + ww['rain'] + ww['thunderstorm'] + ww['frog-rain'];
            ww['clear'] = Math.max(0, 100 - sumOthers);
            return ww;
        })(),
        // Build areasEnabled map from grid
        areasEnabled: (() => {
            const grid = document.getElementById('cfg-areas-grid');
            const out = {};
            if (grid) {
                Array.from(grid.querySelectorAll('.config-grid-item')).forEach(el => {
                    const name = el.dataset.areaName;
                    out[name] = el.classList.contains('active');
                });
            }
            return out;
        })(),
        // Build itemsEnabled map from grid
        itemsEnabled: (() => {
            const grid = document.getElementById('cfg-items-grid');
            const out = {};
            if (grid) {
                Array.from(grid.querySelectorAll('.config-grid-item')).forEach(el => {
                    const idx = el.dataset.itemIdx;
                    const isActive = el.classList.contains('active');
                    out[idx] = isActive;
                    if (!isActive) {
                        console.log('Disabling item idx:', idx, 'name:', el.dataset.itemName);
                    }
                });
            }
            console.log('Built itemsEnabled map:', out);
            return out;
        })(),
        // Build crittersEnabled map from grid
        crittersEnabled: (() => {
            const grid = document.getElementById('cfg-critters-grid');
            const out = {};
            if (grid) {
                Array.from(grid.querySelectorAll('.config-grid-item')).forEach(el => {
                    const name = el.dataset.critterName;
                    out[name] = el.classList.contains('active');
                });
            }
            return out;
        })(),
        // Item price multiplier (percentage)
        itemPriceMultiplier: clampInt(document.getElementById('cfg-item-price-mult')?.value, 0, 500, 100)
    };

    window.customRules = newRules;

    // Persist to Day_curLvl_Dif without clobbering other fields
    try {
        const prev = localData.get('Day_curLvl_Dif') || { day: days || 0, currentLevel_y, currentLevel_x, dificulty };
        prev.customRules = newRules;
        localData.set('Day_curLvl_Dif', prev);
        console.log('Updated custom rules:', newRules);
    } catch(e) {
        console.warn('Failed saving custom rules', e);
    }

    // Apply to active game for main quest values
    applyCustomRulesToActiveGame();
    applyNPCFilterRules();
    applyCritterFilterRules();
    applyAreaRules();
    applyItemPriceMultiplier();
    removeDisabledItemsFromInventory();
    // Immediately re-generate today's weather using the new weights
    if (typeof generateDailyWeather === 'function') {
        try {
            console.log('SAVE: About to re-roll weather. window.customRules.weatherWeights =', window.customRules?.weatherWeights);
            generateDailyWeather();
            console.log('Weather re-rolled with updated weights. Current:', typeof currentWeather !== 'undefined' ? currentWeather : '(unknown)');
        } catch (e) {
            console.warn('Failed to re-roll weather after saving config:', e);
        }
    }
    hideConfigModal();
}

function applyCustomRulesToActiveGame() {
    if (!window.customRules) return;
    if (typeof player !== 'undefined' && player.quests) {
        for (let q of player.quests) {
            if (q.og_name === "Save Cloudy Meadows") {
                // Update days and goal funding amount
                q.days = window.customRules.mainQuestDays ?? q.days;
                q.maxDays = q.days;
                for (let goal of q.goals) {
                    if (goal.class === 'FundingGoal') {
                        goal.amount = window.customRules.mainQuestCoins ?? goal.amount;
                    }
                }
                if (q.maxDays > 0) {
                    q.name = q.og_name + ' ' + q.days + ' days left';
                }
            }
        }
    }
}

// Keep weather sliders totaling 100% by balancing with Clear
function normalizeWeatherTotal(changedId) {
    const ids = [
        'cfg-weather-partly',
        'cfg-weather-overcast',
        'cfg-weather-fog',
        'cfg-weather-sunshower',
        'cfg-weather-rain',
        'cfg-weather-thunderstorm',
        'cfg-weather-frog'
    ];
    const get = (id) => { const el = document.getElementById(id); return el ? parseInt(el.value) || 0 : 0; };
    const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) {
            const val = Math.max(0, Math.min(100, Math.round(v)));
            el.value = String(val);
            const badge = el.parentElement?.querySelector('.config-slider-value');
            if (badge) badge.textContent = String(val);
        }
    };
    const sumAll = ids.reduce((s, id) => s + get(id), 0);
    if (changedId) {
        const desired = get(changedId);
        const sumOthers = sumAll - desired;
        const maxAllowed = Math.max(0, 100 - sumOthers);
        set(changedId, Math.min(desired, maxAllowed));
    }
    const totalBadge = document.getElementById('cfg-weather-total');
    if (totalBadge) {
        const sum = ids.reduce((s, id) => s + get(id), 0);
        const clearPct = Math.max(0, 100 - sum);
        totalBadge.textContent = `Clear: ${Math.round(clearPct)}%`;
    }
}

function applyNPCFilterRules() {
    if (!window.customRules || !levels) {
        console.log('applyNPCFilterRules: No customRules or levels');
        return;
    }
    const enabledMap = window.customRules.npcEnabled;
    const mode = window.customRules.npcMode; // legacy: 'all' | 'only-mr-c' | 'none'
    const useLegacy = !enabledMap || Object.keys(enabledMap).length === 0;
    
    console.log('applyNPCFilterRules: enabledMap=', enabledMap, 'useLegacy=', useLegacy);
    
    if (useLegacy && (!mode || mode === 'all')) {
        console.log('applyNPCFilterRules: Nothing to do (legacy all)');
        return;
    }
    
    let removedCount = 0;
    for (let y = 0; y < levels.length; y++) {
        for (let x = 0; x < levels[y].length; x++) {
            const lvl = levels[y][x];
            if (!lvl || !lvl.map) continue;
            for (let r = 0; r < lvl.map.length; r++) {
                for (let c = 0; c < lvl.map[r].length; c++) {
                    const tile = lvl.map[r][c];
                    if (tile && tile.class === 'NPC') {
                        let keep = true;
                        if (useLegacy) {
                            keep = (mode === 'only-mr-c' && tile.name === 'Mr.C') ? true : (mode === 'none' ? false : true);
                        } else {
                            // default to true if not specified in map
                            keep = enabledMap.hasOwnProperty(tile.name) ? !!enabledMap[tile.name] : true;
                        }
                        if (!keep) {
                            console.log('Removing NPC:', tile.name, 'at level', y, x);
                            // Restore the ground tile beneath the NPC when removing
                            const replacement = (tile && tile.under_tile) ? tile.under_tile : 0;
                            lvl.map[r][c] = replacement;
                            removedCount++;
                        }
                    }
                }
            }
        }
    }
    console.log('applyNPCFilterRules: Removed', removedCount, 'NPCs');
}

// Apply critter filter rules - remove disabled critters from all levels
function applyCritterFilterRules() {
    if (!window.customRules || !levels) {
        console.log('applyCritterFilterRules: No customRules or levels');
        return;
    }
    const enabledMap = window.customRules.crittersEnabled;
    if (!enabledMap || Object.keys(enabledMap).length === 0) {
        console.log('applyCritterFilterRules: No critters to filter');
        return;
    }
    
    // Classes that are considered critters
    const critterClasses = ['FreeMoveEntity', 'LightMoveEntity', 'Entity'];
    // Specific critter names we care about
    const critterNames = ['Frog', 'LightBug', 'Bees', 'ladybug'];
    
    let removedCount = 0;
    for (let y = 0; y < levels.length; y++) {
        for (let x = 0; x < levels[y].length; x++) {
            const lvl = levels[y][x];
            if (!lvl || !lvl.map) continue;
            for (let r = 0; r < lvl.map.length; r++) {
                for (let c = 0; c < lvl.map[r].length; c++) {
                    const tile = lvl.map[r][c];
                    if (!tile) continue;
                    
                    // Check if this is a critter
                    const isCritterClass = critterClasses.includes(tile.class);
                    const isCritterName = critterNames.includes(tile.name);
                    
                    if (isCritterClass && isCritterName) {
                        // Check if this critter is disabled
                        const keep = enabledMap.hasOwnProperty(tile.name) ? !!enabledMap[tile.name] : true;
                        if (!keep) {
                            console.log('Removing critter:', tile.name, 'at level', y, x);
                            const replacement = (tile && tile.under_tile) ? tile.under_tile : 0;
                            lvl.map[r][c] = replacement;
                            removedCount++;
                        }
                    }
                }
            }
        }
    }
    console.log('applyCritterFilterRules: Removed', removedCount, 'critters');
}

// Apply area access rules - block travel to disabled areas
function applyAreaRules() {
    if (!window.customRules || !window.customRules.areasEnabled) return;
    const areasEnabled = window.customRules.areasEnabled;
    // Store blocked areas globally for level transition checks
    window.blockedAreas = {};
    for (const [areaName, enabled] of Object.entries(areasEnabled)) {
        if (!enabled) {
            window.blockedAreas[areaName] = true;
        }
    }
    console.log('Blocked areas:', Object.keys(window.blockedAreas));
}

// Check if a level is in a blocked area
function isLevelBlocked(levelName) {
    if (!window.blockedAreas || !levelName) return false;
    for (const areaName of Object.keys(window.blockedAreas)) {
        if (levelName.startsWith(areaName)) {
            return true;
        }
    }
    return false;
}

// Remove disabled items from player's inventory
function removeDisabledItemsFromInventory() {
    if (!window.customRules || !window.customRules.itemsEnabled) return;
    if (typeof player === 'undefined' || !player.inv) return;
    
    const enabled = window.customRules.itemsEnabled;
    let removedCount = 0;
    
    // Check main inventory (hotbar)
    for (let i = 0; i < player.inv.length; i++) {
        if (player.inv[i] != 0 && player.inv[i] != undefined) {
            const itemNum = typeof item_name_to_num === 'function' ? item_name_to_num(player.inv[i].name) : -1;
            const strKey = String(itemNum);
            const isEnabled = !enabled.hasOwnProperty(strKey) || !!enabled[strKey];
            if (!isEnabled) {
                console.log('Removing disabled item from inventory slot', i, ':', player.inv[i].name);
                player.inv[i] = 0;
                removedCount++;
            }
        }
    }
    
    // Check backpack if player has one equipped
    for (let i = 0; i < player.inv.length; i++) {
        if (player.inv[i] != 0 && player.inv[i].class === 'Backpack' && player.inv[i].inv) {
            for (let j = 0; j < player.inv[i].inv.length; j++) {
                if (player.inv[i].inv[j] != 0 && player.inv[i].inv[j] != undefined) {
                    const itemNum = typeof item_name_to_num === 'function' ? item_name_to_num(player.inv[i].inv[j].name) : -1;
                    const strKey = String(itemNum);
                    const isEnabled = !enabled.hasOwnProperty(strKey) || !!enabled[strKey];
                    if (!isEnabled) {
                        console.log('Removing disabled item from backpack slot', j, ':', player.inv[i].inv[j].name);
                        player.inv[i].inv[j] = 0;
                        removedCount++;
                    }
                }
            }
        }
    }
    
    console.log('removeDisabledItemsFromInventory: Removed', removedCount, 'items');
}

// Apply item price multiplier to all items
function applyItemPriceMultiplier() {
    if (!window.customRules) return;
    const mult = (window.customRules.itemPriceMultiplier ?? 100) / 100;
    if (mult === 1) return; // No change needed
    
    // Store original prices if not already stored
    if (!window._originalItemPrices) {
        window._originalItemPrices = {};
        if (typeof all_items !== 'undefined') {
            for (let i = 0; i < all_items.length; i++) {
                if (all_items[i] && all_items[i].price !== undefined) {
                    window._originalItemPrices[i] = all_items[i].price;
                }
            }
        }
    }
    
    // Apply multiplier
    if (typeof all_items !== 'undefined') {
        for (let i = 0; i < all_items.length; i++) {
            if (all_items[i] && window._originalItemPrices[i] !== undefined) {
                all_items[i].price = Math.max(1, Math.round(window._originalItemPrices[i] * mult));
            }
        }
    }
    console.log('Item prices multiplied by', mult);
}

// Get effective item - returns false if item is disabled
function getEffectiveItem(itemIdx) {
    if (!window.customRules || !window.customRules.itemsEnabled) {
        return true; // No rules = all enabled
    }
    const enabled = window.customRules.itemsEnabled;
    // Check both string and number keys since dataset values are strings
    const strKey = String(itemIdx);
    const numKey = Number(itemIdx);
    
    // Check if this key exists in the map
    const hasStrKey = enabled.hasOwnProperty(strKey);
    const hasNumKey = enabled.hasOwnProperty(numKey);
    
    let result;
    if (hasStrKey) {
        result = !!enabled[strKey];
    } else if (hasNumKey) {
        result = !!enabled[numKey];
    } else {
        result = true; // Not in map = enabled by default
    }
    
    if (!result) {
        console.log('getEffectiveItem:', itemIdx, 'strKey:', strKey, 'hasStrKey:', hasStrKey, 'val:', enabled[strKey], '-> DISABLED');
    }
    return result;
}

// ======== Progress gating helpers ========
function getHasBeatenGame() {
    try {
        const prev = localData.get('Day_curLvl_Dif');
        return !!(prev && prev.hasBeatenGame);
    } catch(e) {
        return false;
    }
}

// Mark beaten state when main quest completes (global listener, independent of UI panels)
if (!window._beatFlagListenerRegistered) {
    window._beatFlagListenerRegistered = true;
    window.addEventListener('questCompleted', (e) => {
        const q = e.detail && e.detail.quest;
        if (q && (q.og_name === 'Save Cloudy Meadows' || q.name === 'Save Cloudy Meadows')) {
            try {
                const prev = localData.get('Day_curLvl_Dif') || { day: days || 0, currentLevel_y, currentLevel_x, dificulty };
                prev.hasBeatenGame = true;
                localData.set('Day_curLvl_Dif', prev);
                console.log('Beaten flag set in local storage');
            } catch(err) {
                console.warn('Failed to set beaten flag', err);
            }
        }
    });
}

function showPaused(){
    ensurePauseMenuContainer();
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) {
        pauseMenu.style.display = 'flex';
        updateCanvasPointerEvents();
        
        // Show/hide quit button based on whether we're in game or title screen
        const quitBtn = document.getElementById('pause-quit-btn');
        if (quitBtn) {
            // Show the quit button when in-game (not on title screen)
            quitBtn.style.display = title_screen ? 'none' : 'block';
        }
        
        // Update sliders
        const musicSliderDOM = document.getElementById('pause-music-slider');
        const fxSliderDOM = document.getElementById('pause-fx-slider');
        
        if (musicSliderDOM) {
            musicSliderDOM.value = musicSlider.value();
            musicSliderDOM.oninput = () => {
                musicSlider.value(musicSliderDOM.value);
            };
        }
        
        if (fxSliderDOM) {
            fxSliderDOM.value = fxSlider.value();
            fxSliderDOM.oninput = () => {
                fxSlider.value(fxSliderDOM.value);
            };
        }
    }
}

function hidePaused() {
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) {
        pauseMenu.style.display = 'none';
    }
    updateCanvasPointerEvents();
}

function ensurePauseMenuContainer() {
    if (document.getElementById('pause-menu')) return;
    
    const pauseMenu = document.createElement('div');
    pauseMenu.id = 'pause-menu';
    document.body.appendChild(pauseMenu);
    
    // Title
    const title = document.createElement('h2');
    title.className = 'pause-title';
    title.textContent = 'Paused';
    pauseMenu.appendChild(title);
    
    // Sliders section
    const sliderSection = document.createElement('div');
    sliderSection.className = 'pause-menu-section';
    
    // Music slider
    const musicRow = document.createElement('div');
    musicRow.className = 'pause-slider-row';
    const musicIcon = document.createElement('img');
    musicIcon.className = 'pause-slider-icon';
    musicIcon.src = 'images/ui/Music_Note.png';
    musicIcon.alt = 'Music';
    const musicLabel = document.createElement('span');
    musicLabel.className = 'pause-slider-label';
    musicLabel.textContent = 'Music';
    const musicSliderDOM = document.createElement('input');
    musicSliderDOM.id = 'pause-music-slider';
    musicSliderDOM.type = 'range';
    musicSliderDOM.min = '0';
    musicSliderDOM.max = '1';
    musicSliderDOM.step = '0.01';
    musicRow.appendChild(musicIcon);
    musicRow.appendChild(musicLabel);
    musicRow.appendChild(musicSliderDOM);
    sliderSection.appendChild(musicRow);
    
    // FX slider
    const fxRow = document.createElement('div');
    fxRow.className = 'pause-slider-row';
    const fxIcon = document.createElement('img');
    fxIcon.className = 'pause-slider-icon';
    fxIcon.src = 'images/ui/fx.png';
    fxIcon.alt = 'FX';
    const fxLabel = document.createElement('span');
    fxLabel.className = 'pause-slider-label';
    fxLabel.textContent = 'Sound';
    const fxSliderDOM = document.createElement('input');
    fxSliderDOM.id = 'pause-fx-slider';
    fxSliderDOM.type = 'range';
    fxSliderDOM.min = '0';
    fxSliderDOM.max = '1';
    fxSliderDOM.step = '0.01';
    fxRow.appendChild(fxIcon);
    fxRow.appendChild(fxLabel);
    fxRow.appendChild(fxSliderDOM);
    sliderSection.appendChild(fxRow);
    
    pauseMenu.appendChild(sliderSection);
    
    // Controls section - only show on desktop (not mobile)
    if (!isMobile) {
        const controlsSection = document.createElement('div');
        controlsSection.className = 'pause-controls-section';
        controlsSection.id = 'pause-controls-container';
        const controlsTitle = document.createElement('div');
        controlsTitle.className = 'pause-controls-title';
        controlsTitle.textContent = 'Controls';
        controlsSection.appendChild(controlsTitle);
        
        pauseMenu.appendChild(controlsSection);
        
        // Render control buttons once (only on desktop)
        renderControlButtons(controlsSection);
    }

    
    //back button
    const backBtn = document.createElement('button');
    backBtn.id = 'pause-back-btn';
    backBtn.className = 'pause-button';
    backBtn.textContent = 'Resume';
    backBtn.addEventListener('click', () => {
        paused = false;
        hidePaused();
    });
    pauseMenu.appendChild(backBtn);

    // Quit button
    const quitBtn = document.createElement('button');
    quitBtn.id = 'pause-quit-btn';
    quitBtn.className = 'pause-button';
    quitBtn.textContent = 'Save and Quit';
    quitBtn.addEventListener('click', () => {
        console.log('Saving and quitting to title screen...');
        title_screen = true;
        paused = false;
        hidePaused();
        startButton.show();
        creditsButton.show();
        optionsButton.show();
        clearButton.hide();
        saveAll();
    });
    pauseMenu.appendChild(quitBtn);
}

function showCredits(){
    // Show DOM-based credits menu
    showCreditsMenu();
}

function showCreditsMenu(){
    let creditsMenu = document.getElementById('credits-menu');
    if (!creditsMenu) {
        // Create structure once
        creditsMenu = document.createElement('div');
        creditsMenu.id = 'credits-menu';
        creditsMenu.className = 'credits-menu';
        document.body.appendChild(creditsMenu);
        
        const title = document.createElement('h2');
        title.className = 'credits-title';
        title.textContent = 'Credits';
        creditsMenu.appendChild(title);
        
        const content = document.createElement('div');
        content.className = 'credits-content';
        
        const credits = [
            'Christian Rodriguez - Lead programmer of old system and engine',
            'David Kozdra - Lazy Code, bad Art and sound',
            'Patrick Mayer - Misc',
            'Christian "Sealand" Rodriguez - Music',
            'Ethan Davis - Dialogue and Testing',
            'and thanks to our play testers'
        ];
        
        credits.forEach((credit, idx) => {
            const line = document.createElement('div');
            line.className = 'credits-line';
            if (idx === 1) {
                line.textContent = credit;
            } else {
                line.textContent = credit;
            }
            content.appendChild(line);
        });
        creditsMenu.appendChild(content);
        
        const backBtn = document.createElement('button');
        backBtn.id = 'credits-back-btn';
        backBtn.className = 'credits-back-button';
        backBtn.textContent = 'Back';
        backBtn.addEventListener('click', () => {
            creditsOn = false;
            hideCreditsMenu();
        });
        creditsMenu.appendChild(backBtn);
    }
    creditsMenu.style.display = 'flex';
    updateCanvasPointerEvents();
}

function hideCreditsMenu(){
    const creditsMenu = document.getElementById('credits-menu');
    if (creditsMenu) creditsMenu.style.display = 'none';
    updateCanvasPointerEvents();
}

let questsContainer = null;
let currentQuestPage = 0;
let questsPerPage = 6;
let lastSelectedQuest = -1;

function showQuests(){
    if (!questsContainer) {
        questsContainer = document.createElement('div');
        questsContainer.className = 'quests-container';
        document.getElementById('game-container').appendChild(questsContainer);
        
        // Create header wrapper with close button
        const headerWrapper = document.createElement('div');
        headerWrapper.className = 'quests-header-wrapper';
        questsContainer.appendChild(headerWrapper);
        
        const header = document.createElement('div');
        header.className = 'quests-header';
        header.innerHTML = '<h2>All Quests</h2>';
        headerWrapper.appendChild(header);
        
        const closeButton = document.createElement('button');
        closeButton.className = 'quests-close-btn';
        closeButton.textContent = '×';
        closeButton.addEventListener('click', () => {
            player.show_quests = false;
            questsContainer.style.display = 'none';
            questSlider.hide();
            questCloseButton.hide();
            currentQuestPage = 0; // Reset to first page when closing
            updateCanvasPointerEvents();
        });
        headerWrapper.appendChild(closeButton);
        
        // Create quests list container
        const questsList = document.createElement('div');
        questsList.className = 'quests-list';
        questsContainer.appendChild(questsList);
        
        // Create footer for close instruction
        // Create pagination controls
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'quest-pagination';
        questsContainer.appendChild(paginationContainer);
        
        const prevButton = document.createElement('button');
        prevButton.className = 'quest-page-btn quest-page-prev';
        prevButton.textContent = '← Prev';
        prevButton.addEventListener('click', () => {
            if (currentQuestPage > 0) {
                currentQuestPage--;
                updateQuestsDisplay();
            }
        });
        paginationContainer.appendChild(prevButton);
        
        const pageInfo = document.createElement('span');
        pageInfo.className = 'quest-page-info';
        paginationContainer.appendChild(pageInfo);
        
        const nextButton = document.createElement('button');
        nextButton.className = 'quest-page-btn quest-page-next';
        nextButton.textContent = 'Next →';
        nextButton.addEventListener('click', () => {
            const totalPages = Math.ceil(player.quests.length / questsPerPage);
            if (currentQuestPage < totalPages - 1) {
                currentQuestPage++;
                updateQuestsDisplay();
            }
        });
        paginationContainer.appendChild(nextButton);
        
        const closeInstruction = document.createElement('div');
        closeInstruction.className = 'quests-close-instruction';
        questsContainer.appendChild(closeInstruction);
        
        // Disable canvas pointer events to prevent click interception
        const canvas = document.querySelector('canvas');
        if(canvas){
            canvas.style.pointerEvents = 'none';
        }
    }

    updateQuestsDisplay();
}

function updateQuestsDisplay() {
    if (!questsContainer || !player) return;
    
    // Update if page changed or quest was selected
    if (lastSelectedQuest !== player.current_quest) {
        lastSelectedQuest = player.current_quest;
    }
    
    // Update quests list
    const questsList = questsContainer.querySelector('.quests-list');
    questsList.innerHTML = '';

    // Calculate pagination
    const totalPages = Math.ceil(player.quests.length / questsPerPage);
    const startIndex = currentQuestPage * questsPerPage;
    const endIndex = Math.min(startIndex + questsPerPage, player.quests.length);
    
    for(let i = startIndex; i < endIndex; i++){
        const questButton = document.createElement('button');
        questButton.className = 'quest-item';
        questButton.setAttribute('data-quest-index', i);
        
        if (player.current_quest === i) {
            questButton.classList.add('quest-current');
        }
        
        // Add click handler
        questButton.addEventListener('click', (e) => {
            // Don't handle clicks on the details button or its children
            if (e.target.classList.contains('quest-details-button') || 
                e.target.closest('.quest-details-button') ||
                (e.target.tagName === 'BUTTON' && e.target.textContent.includes('Details')) ||
                (e.target.tagName === 'BUTTON' && e.target.textContent.includes('Hide'))) {
                // Let the details button handle its own click
                return;
            }
            
            console.log('Quest button clicked');
            e.preventDefault();
            e.stopPropagation();
            const questIndex = parseInt(e.currentTarget.getAttribute('data-quest-index'));
            // Don't allow selecting failed or completed quests as current
            if (player.quests[questIndex].failed || player.quests[questIndex].done) {
                console.log('Cannot select failed or completed quest');
                return;
            }
            console.log('Setting current quest to:', questIndex);
            player.current_quest = questIndex;
            lastSelectedQuest = questIndex;
            // Update UI immediately without full refresh
            updateQuestButtonHighlight();
        });
        
        const questContent = document.createElement('div');
        questContent.className = 'quest-content';
        
        // Let the quest render into the DOM element
        questContent.innerHTML = '';
        player.quests[i].RenderQuestList(questContent, player.current_quest === i ? 'yellow' : null);

        // Inline details UI built here so expanded content stays within parent quest card
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'quest-details-container';
        detailsContainer.style.display = 'none';

        const detailsButton = document.createElement('button');
        detailsButton.className = 'quest-details-button';
        detailsButton.textContent = 'Details';
        detailsButton.onclick = (e) => {
            console.log(e , 'Details button clicked for quest index:', i);
            e.preventDefault();
            e.stopPropagation();
            const isOpen = detailsContainer.style.display === 'flex';
            if (isOpen) {
                detailsContainer.innerHTML = '';
                detailsContainer.style.display = 'none';
                detailsButton.textContent = 'Details';
                return;
            }
            detailsContainer.innerHTML = '';
            const quest = player.quests[i];
            for (let g = 0; g < quest.goals.length; g++) {
                const goal = quest.goals[g];
                const card = quest.createGoalCard(goal, g === quest.current_Goal && !goal.done);
                detailsContainer.appendChild(card);
            }
            
            // Always show rewards card to see what's configured
            const rewardsCard = quest.createRewardsCard();
            detailsContainer.appendChild(rewardsCard);
            
            detailsContainer.style.display = 'flex';
            detailsButton.textContent = 'Hide';
        };

        const progressRow = questContent.querySelector('.quest-progress-container');
        if (progressRow) {
            progressRow.appendChild(detailsButton);
        } else {
            questContent.appendChild(detailsButton);
        }
        questContent.appendChild(detailsContainer);
        
        questButton.appendChild(questContent);
        questsList.appendChild(questButton);

        // Sync progress immediately in case goals were completed before opening the UI
        updateQuestProgressBar(questButton);
    }
    
    // Update pagination controls
    const pageInfo = questsContainer.querySelector('.quest-page-info');
    const prevBtn = questsContainer.querySelector('.quest-page-prev');
    const nextBtn = questsContainer.querySelector('.quest-page-next');
    
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentQuestPage + 1} of ${totalPages} (${player.quests.length} quest${player.quests.length !== 1 ? 's' : ''})`;
    }
    
    if (prevBtn) {
        prevBtn.disabled = currentQuestPage === 0;
        prevBtn.style.opacity = currentQuestPage === 0 ? '0.5' : '1';
        prevBtn.style.cursor = currentQuestPage === 0 ? 'not-allowed' : 'pointer';
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentQuestPage >= totalPages - 1;
        nextBtn.style.opacity = currentQuestPage >= totalPages - 1 ? '0.5' : '1';
        nextBtn.style.cursor = currentQuestPage >= totalPages - 1 ? 'not-allowed' : 'pointer';
    }

    // Update close instruction - show mobile-friendly text on touch devices or small screens
    const closeInstruction = questsContainer.querySelector('.quests-close-instruction');
    const isMobileOrSmallScreen = (typeof isMobile !== 'undefined' && isMobile) || window.innerWidth <= 768;
    if (closeInstruction) {
        if (isMobileOrSmallScreen) {
            closeInstruction.textContent = 'Tap × to close quests';
        } else {
            closeInstruction.textContent = String.fromCharCode(quest_key) + ' to close quests';
        }
    }

    // Hide p5.js buttons and show container
    questCloseButton.hide();
    questSlider.hide();

    questsContainer.style.display = 'flex';
    updateCanvasPointerEvents();
    
    // Set up event listeners for quest updates (only once)
    if (!window._questEventsRegistered) {
        window._questEventsRegistered = true;
        
        window.addEventListener('questGoalCompleted', (e) => {
            if (!questsContainer || questsContainer.style.display === 'none') return;
            // Find which quest button this is and update it
            const quest = e.detail.quest;
            const questIndex = player.quests.indexOf(quest);
            const btn = document.querySelector(`[data-quest-index="${questIndex}"]`)?.closest('.quest-item');
            if (btn) updateQuestProgressBar(btn);
        });
        
        window.addEventListener('questCompleted', (e) => {
            if (!questsContainer || questsContainer.style.display === 'none') return;
            const questIndex = player.quests.indexOf(e.detail.quest);
            const btn = document.querySelector(`[data-quest-index="${questIndex}"]`)?.closest('.quest-item');
            if (btn) updateQuestProgressBar(btn);

            // Auto-select next incomplete quest if current was just completed
            if (questIndex === player.current_quest) {
                for (let i = 0; i < player.quests.length; i++) {
                    if (!player.quests[i].done && !player.quests[i].failed) {
                        player.current_quest = i;
                        updateQuestButtonHighlight();
                        break;
                    }
                }
            }
        });
        
        window.addEventListener('newDay', (e) => {
            if (!questsContainer || questsContainer.style.display === 'none') return;
            // Full refresh when new day occurs to update quest names with day counts
            updateQuestsDisplay();
        });
    }
}

function updateQuestProgressBar(btn) {
    const questIndex = parseInt(btn.getAttribute('data-quest-index'));
    const quest = player.quests[questIndex];
    if (!quest) return;
    
    // Update progress bar
    let completedGoals = 0;
    for (let j = 0; j < quest.goals.length; j++) {
        if (quest.goals[j].done) completedGoals++;
    }
    
    const progressFill = btn.querySelector('.quest-progress-fill');
    const statusDiv = btn.querySelector('.quest-status');
    
    if (progressFill) {
        const progress = (completedGoals / quest.goals.length) * 100;
        progressFill.style.width = progress + '%';
        if (quest.failed) {
            progressFill.style.backgroundColor = 'rgb(255, 0, 0)';
        } else if (quest.done || completedGoals === quest.goals.length) {
            progressFill.style.backgroundColor = 'rgb(50, 200, 50)';
        } else {
            progressFill.style.backgroundColor = 'rgb(255, 255, 0)';
        }
    }
    
    if (statusDiv) {
        if (quest.failed) {
            statusDiv.textContent = 'Failed';
            statusDiv.style.color = 'rgb(255, 0, 0)';
        } else if (quest.done) {
            statusDiv.textContent = 'Completed';
            statusDiv.style.color = 'rgb(50, 200, 50)';
            statusDiv.style.fontWeight = 'bold';
        } else {
            statusDiv.textContent = `${completedGoals}/${quest.goals.length} goals`;
            statusDiv.style.color = 'rgb(255, 255, 255)';
        }
    }
}

function updateQuestButtonHighlight(){
    const buttons = document.querySelectorAll('.quest-item');
    buttons.forEach(btn => {
        const questIndex = parseInt(btn.getAttribute('data-quest-index'));
        if (questIndex === player.current_quest) {
            btn.classList.add('quest-current');
        } else {
            btn.classList.remove('quest-current');
        }
    });
}

function clear_data_render() {
    if(clear_movephase == 0){
        if(clear_ticks >= 50){
            clear_movephase = 1;
            clear_ticks = 0;
        }
        clear_y -= 1;
    }
    if(clear_movephase == 1){
        if(clear_ticks >= 70){
            clear_movephase = 2;
            clear_ticks = 0;
        }
    }
    if(clear_movephase == 2){
        clear_y += 1;
        if(clear_ticks >= 50){
            clear_anim = false;
            clear_ticks = 0;
            clear_movephase = 0;
        }
    }
    clear_ticks += 1;
    push();
    stroke(0);
    strokeWeight(5);
    fill(255, 255, 0);
    rect(canvasWidth-(('Clearing Data'.length*17)+6), clear_y, ('Clearing Data'.length*17)+6, 50);
    textFont(player_2);
    textSize(15);
    fill(255);
    stroke(0);
    strokeWeight(4);
    textAlign(CENTER, CENTER);
    text('Clearing Data', canvasWidth-((('Clearing Data'.length*17)+6)/2)+2, clear_y+25);
    pop();
}

function addItem(to, item_obj_num, amount) {
    for (let i = 0; i < to.inv.length; i++) {
        if (to.inv[i] != 0) { // stack items
            if (to.inv[i].name == all_items[item_obj_num].name) {
                to.inv[i].amount += amount;
                return;
            }
        }
    }
    if (to.inv[to.hand] == 0) { // air
        to.inv[to.hand] = new_item_from_num(item_obj_num, amount);
        return;
    }

    for (let i = 0; i < 8; i++) {
        if (to.inv[i] == 0) { // find space
            to.inv[i] = new_item_from_num(item_obj_num, amount);
            return;
        }
    }
}

function checkForSpace(to, item_obj_num){
    var check = false;
    if(item_obj_num == 0){
        check = true;
        return check;
    }
    for (let i = 0; i < to.inv.length; i++) {
        if (to.inv[i] != 0) { // stack items
            if (to.inv[i].name == all_items[item_obj_num].name) {
                check = true;
                return check;
            }
        }
    }
    if (to.inv[to.hand] == 0) { // air in hand
        check = true;
        return check;
    }

    for (let i = 0; i < 8; i++) {
        if (to.inv[i] == 0) { // find space
            check = true;
            return check;
        }
    }
    if(!check){
        to.inv_warn_anim = 255;
        ErrorSound.play();
    }
    return check;
}

function item_name_to_num(item_name) {
    for (let i = 0; i < all_items.length; i++) {
        if (item_name == all_items[i].name) {
            return i;
        }
    }
    console.warn('Item name not found: ' + item_name);
    return undefined;
}

function tile_name_to_num(tile_name) {
    for (let i = 0; i < all_tiles.length; i++) {
        if (tile_name == all_tiles[i].name) {
            return i+1;
        }
    }
    return undefined;
}

function new_tile_from_num(num, x, y) {
    if (num && num > 0 && num <= all_tiles.length) {
        if (all_tiles[num - 1].class == 'Tile') {
            return new Tile(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].collide, all_tiles[num - 1].age, all_tiles[num - 1].under_tile_num);
        }
        else if (all_tiles[num - 1].class == 'Shop') {
            return new Shop(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].inv, all_tiles[num - 1].under_tile_num);
        }
        else if (all_tiles[num - 1].class == 'Plant') {
            return new Plant(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].collide, all_tiles[num - 1].eat_num, all_tiles[num - 1].waterneed, all_tiles[num - 1].growthTime);
        }
        else if (all_tiles[num - 1].class == 'Entity') {
            return new Entity(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].age, all_tiles[num - 1].inv, all_tiles[num - 1].hand, all_tiles[num - 1].under_tile_num);
        }
        else if (all_tiles[num - 1].class == 'FreeMoveEntity') {
            return new FreeMoveEntity(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].inv, all_tiles[num - 1].under_tile_num, all_tiles[num - 1].instructions, all_tiles[num - 1].moving_timer);
        }
        else if (all_tiles[num - 1].class == 'MovableEntity') {
            return new MoveableEntity(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].inv, all_tiles[num - 1].hand, all_tiles[num - 1].facing, all_tiles[num - 1].under_tile_num, all_tiles[num - 1].moving_timer);
        }
        else if (all_tiles[num - 1].class == 'GridMoveEntity') {
            return new GridMoveEntity(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].inv, all_tiles[num - 1].hand, all_tiles[num - 1].facing, all_tiles[num - 1].under_tile_num, all_tiles[num - 1].instructions, all_tiles[num - 1].moving_timer);
        }
        else if (all_tiles[num - 1].class == 'NPC') {
            const npc = new NPC(
                all_tiles[num - 1].name,
                all_tiles[num - 1].png,
                x,
                y,
                all_tiles[num - 1].inv,
                all_tiles[num - 1].hand,
                all_tiles[num - 1].facing,
                all_tiles[num - 1].under_tile_num,
                all_tiles[num - 1].instructions,
                all_tiles[num - 1].moving_timer,
                all_tiles[num - 1].random_move
            );
            if (all_tiles[num - 1].places) npc.places = all_tiles[num - 1].places.slice();
            if (all_tiles[num - 1].travel_price) npc.travel_price = all_tiles[num - 1].travel_price;
            return npc;
        }
        else if (all_tiles[num - 1].class == 'Chest'){
            return new Chest(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].inv, all_tiles[num - 1].under_tile_num);
        }
        else if (all_tiles[num - 1].class == 'Robot'){
            return new Robot(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].inv, all_tiles[num - 1].under_tile_num, all_tiles[num - 1].instructions, all_tiles[num - 1].moving_timer);
        }
        else if (all_tiles[num - 1].class == 'AirBallon'){
            return new AirBallon(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].under_tile_num);
        }
        else if (all_tiles[num-1].class == 'LightMoveEntity'){
            return new LightMoveEntity(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].inv, all_tiles[num - 1].under_tile_num, all_tiles[num - 1].instructions, all_tiles[num - 1].moving_timer);
        }
        else if (all_tiles[num-1].class == 'PayToMoveEntity'){
            return new PayToMoveEntity(all_tiles[num-1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].age, all_tiles[num - 1].under_tile_num, all_tiles[num - 1].price)
        }
    }
    else {
        return undefined;
    }
}

function new_item_from_num(num, amount) {
    if (typeof all_items !== 'undefined' && num <= all_items.length) {
        if (all_items[num].class == 'Item') {
            return new Item(all_items[num].name, amount, all_items[num].png, all_items[num].price);
        }
        else if (all_items[num].class == 'Tool') {
            return new Tool(all_items[num].name, amount, all_items[num].png);
        }
        else if (all_items[num].class == 'Eat') {
            return new Eat(all_items[num].name, amount, all_items[num].png, all_items[num].price, all_items[num].hunger, all_items[num].hunger_timer, all_items[num].seed_num);
        }
        else if (all_items[num].class == 'Seed') {
            return new Seed(all_items[num].name, amount, all_items[num].png, all_items[num].plant_num, all_items[num].price);
        }
        else if (all_items[num].class == 'Placeable') {
            return new Placeable(all_items[num].name, amount, all_items[num].png, all_items[num].price, all_items[num].tile_num, all_items[num].tile_need_num);
        }
        else if(all_items[num].class == 'Command'){
            return new Command(all_items[num].name, amount, all_items[num].png, all_items[num].command);
        }
        else if(all_items[num].class == 'Backpack'){
            return new Backpack(all_items[num].name, amount, all_items[num].png, all_items[num].inv);
        }
    }
    else {
        console.error('item created from ' + num + ' doesnt exist');
    }
}

function saveAll(){
    save_anim = 255;
    
    // 1. Prepare all levels and entities (clear circular references and non-serializable objects)
    for(let i = 0; i < levels.length; i++){
        for(let j = 0; j < levels[i].length; j++){
            if(levels[i][j] != 0 && levels[i][j] != undefined){
                // Prepare the level itself
                if(levels[i][j].getReadyForSave){
                    levels[i][j].getReadyForSave();
                }
                // Prepare all entities in the level
                for(let y = 0; y < levels[i][j].map.length; y++){
                    for(let x = 0; x < levels[i][j].map[y].length; x++){
                        if (levels[i][j].map[y][x] != 0){
                            levels[i][j].map[y][x].getReadyForSave();
                        }
                    }
                }
            }
        }
    }
    
    // 2. Prepare player (who might be touching one of those entities)
    player.getReadyForSave();

    // 3. Now save everything
    if(player.talking == 0){
        player.save()
    }
    localData.set('Day_curLvl_Dif', {
        days: days, 
        currentLevel_x: currentLevel_x, 
        currentLevel_y: currentLevel_y, 
        dificulty: dificulty,
        currentWeather: currentWeather,
        time: time,
        timephase: timephase,
        customRules: window.customRules || null
    });
    let lvlLength = 0;
    for(let i = 0; i < levels.length; i++){
        for(let j = 0; j < levels[i].length; j++){
            if(levels[i][j] != 0 && levels[i][j] != undefined){
                localData.set(levels[i][j].name, levels[i][j]);
                if(j > lvlLength){
                    lvlLength = j
                }
            }
        }
    }
    localData.set('extralvlStuff', {extraCount: extraCount, lvlLength: lvlLength});
}

function saveOptions(){
    localData.set('Options', {musicVolume: musicSlider.value(), fxVolume: fxSlider.value()});
    localData.set('Controls', {
        Controls_Interact_button_key: Controls_Interact_button_key,
        Controls_Eat_button_key: Controls_Eat_button_key,
        Controls_Up_button_key: Controls_Up_button_key,
        Controls_Down_button_key: Controls_Down_button_key,
        Controls_Left_button_key: Controls_Left_button_key,
        Controls_Right_button_key: Controls_Right_button_key,
        Controls_Special_button_key: Controls_Special_button_key,
        Controls_Quest_button_key: Controls_Quest_button_key,
        move_right_button: move_right_button,
        move_left_button: move_left_button,
        move_up_button: move_up_button,
        move_down_button: move_down_button,
        interact_button: interact_button,
        eat_button: eat_button,
        pause_button: pause_button,
        special_key: special_key,
        quest_key: quest_key
    })
}

function loadAll(){
    // Initialize days to 0 if not already set
    if (typeof days === 'undefined' || isNaN(days)) {
        days = 0;
    }
    
    if(localData.get('player') != null ){
        player.load(localData.get('player'));
        
        // Check if main quest was already failed in the save
        for (let q of player.quests) {
            if (q.og_name === "Save Cloudy Meadows" && q.failed) {
                lose_screen = true;
                paused = true;
            }
        }
    }
    if(localData.get('Day_curLvl_Dif') != null){
        days = localData.get('Day_curLvl_Dif').days || 0;
        // Ensure days is a valid number
        if (isNaN(days)) {
            days = 0;
        }
        // Recalculate dayOfWeek from days
        dayOfWeek = days % 5;
        currentLevel_x = localData.get('Day_curLvl_Dif').currentLevel_x;
        currentLevel_y = localData.get('Day_curLvl_Dif').currentLevel_y;
        dificulty = localData.get('Day_curLvl_Dif').dificulty;
        window.customRules = localData.get('Day_curLvl_Dif').customRules || null;
        console.log('LOAD: customRules from storage:', window.customRules);
        console.log('LOAD: weatherWeights:', window.customRules?.weatherWeights);
        // If this is a new game (no saved player yet), apply starting coins now
        try {
            const hasSavedPlayer = localData.get('player') != null;
            if (!hasSavedPlayer && player && typeof window.customRules?.startingCoins === 'number') {
                player.coins = window.customRules.startingCoins;
            }
        } catch (e) {
            // If localData access fails, avoid crashing
        }

        // NPC/Area/Price rules are applied AFTER levels load below
        
        // Load weather state
        currentWeather = localData.get('Day_curLvl_Dif').currentWeather || 'clear';
        
        // Load time of day
        time = localData.get('Day_curLvl_Dif').time || 0;
        timephase = localData.get('Day_curLvl_Dif').timephase || 0;
    }
    if(localData.get('Controls') != null){
        Controls_Interact_button_key = localData.get('Controls').Controls_Interact_button_key
        Controls_Eat_button_key = localData.get('Controls').Controls_Eat_button_key
        Controls_Up_button_key = localData.get('Controls').Controls_Up_button_key
        Controls_Down_button_key = localData.get('Controls').Controls_Down_button_key
        Controls_Left_button_key = localData.get('Controls').Controls_Left_button_key
        Controls_Right_button_key = localData.get('Controls').Controls_Right_button_key
        Controls_Special_button_key = localData.get('Controls').Controls_Special_button_key
        Controls_Quest_button_key = localData.get('Controls').Controls_Quest_button_key
        move_right_button = localData.get('Controls').move_right_button
        move_left_button = localData.get('Controls').move_left_button
        move_up_button = localData.get('Controls').move_up_button
        move_down_button = localData.get('Controls').move_down_button
        interact_button = localData.get('Controls').interact_button
        eat_button = localData.get('Controls').eat_button
        pause_button = localData.get('Controls').pause_button
        special_key = localData.get('Controls').special_key
        quest_key = localData.get('Controls').quest_key
    }
    if(localData.get('extralvlStuff') != null){
        extraCount = localData.get('extralvlStuff').extraCount
        let lvlLength = localData.get('extralvlStuff').lvlLength;
        for(let i = 0; i < levels.length; i++){
            for(let j = 0; j < lvlLength+1; j++){
                if(levels[i][j] != 0){
                    loadLevel(levels[i][j], j, i);
                }
            }
        }
    }
    else{
        for(let i = 0; i < levels.length; i++){
            for(let j = 0; j < levels[i].length; j++){
                if(levels[i][j] != 0){
                    loadLevel(levels[i][j]);
                }
            }
        }
    }
    
    // Apply NPC/Area/Price/Critter rules AFTER all levels have loaded from storage
    applyNPCFilterRules();
    applyCritterFilterRules();
    applyAreaRules();
    applyItemPriceMultiplier();
    removeDisabledItemsFromInventory();
}

function loadLevel(level, lvlx = 0, lvly = 0){
    let newLvl = 0;
    if(level === undefined){
        newLvl = localData.get('Extra y:'+ lvly + ' x:' + (lvlx-6));
        if(newLvl == undefined){
            return;
        }
        let fore = JSON.parse(JSON.stringify(newLvl.fore));
        for(let i = 0; i < fore.length; i++){
            for(let j = 0; j < fore[i].length; j++){
                if(fore[i][j] != 0){
                    fore[i][j] = fore[i][j].type;
                }
            }
        }
        let map = JSON.parse(JSON.stringify(newLvl.map));
        for(let i = 0; i < map.length; i++){
            for(let j = 0; j < map[i].length; j++){
                if(map[i][j] != 0){
                    map[i][j] = tile_name_to_num(map[i][j].name);
                }
            }
        }
        levels[lvly][lvlx] = new Level(newLvl.name, map, fore);
        level = levels[lvly][lvlx];
        for(let i = 0; i < levels[lvly][lvlx].fore.length; i++){
            for(let j = 0; j < levels[lvly][lvlx].fore[i].length; j++){
                levels[lvly][lvlx].fore[i][j].variant = newLvl.fore[i][j].variant;
            }
        }
    }else{
        newLvl = localData.get(level.name)
    }
    if(newLvl != null){
        level.lights = [];
        level.ladybugs = newLvl.ladybugs;
        for(let i = 0; i < newLvl.map.length; i++){
            for(let j = 0; j < newLvl.map[i].length; j++){
                if(newLvl.map[i][j] != 0 && level.map[i][j] != 0){
                    const tileNum = tile_name_to_num(newLvl.map[i][j].name);
                    if(tileNum !== undefined) {
                        level.map[i][j] = new_tile_from_num(tileNum, newLvl.map[i][j].pos.x, newLvl.map[i][j].pos.y);
                        level.map[i][j].load(newLvl.map[i][j]);
                    } else {
                        // Tile name not found, skip loading and keep original
                        console.warn('Saved tile "' + newLvl.map[i][j].name + '" not found, keeping original tile');
                    }
                    if (newLvl.map[i][j].name == 'lamppost') {
                        append(level.lights, new Light(level.map[i][j].pos.x, level.map[i][j].pos.y, (tileSize * 6), 255, 255, 255));
                    }
                    if (newLvl.map[i][j].name == 'satilite') {
                        append(level.lights, new Light(level.map[i][j].pos.x, level.map[i][j].pos.y, (tileSize * 1)+5, 255, 255, 0));
                    }
                    if (newLvl.map[i][j].name == 'LightBug'){
                        let light = new Light(level.map[i][j].pos.x, level.map[i][j].pos.y, (tileSize * 1)-5, 150, 255, 0);
                        append(level.lights, light);
                        level.map[i][j].light = light;
                        level.map[i][j].lightI = level.lights.length - 1;
                    }
                }
            }
        }
    }
}

function deleteWorld(){
    localData.remove('player');
    localData.remove('Day_curLvl_Dif');
    for(let i = 0; i < levels.length; i++){
        for(let j = 0; j < levels[i].length; j++){
            if(levels[i][j] != 0){
                localData.remove(levels[i][j].name);
            }
        }
    }
}

function restoreMainQuestNPCs() {
    if (!window.mainQuestNPCs) return;
    
    const marketLevel = levels[0][5];
    
    // Remove Mr.C from market if he exists
    for (let i = 0; i < marketLevel.map.length; i++) {
        for (let j = 0; j < marketLevel.map[i].length; j++) {
            if (marketLevel.map[i][j] && marketLevel.map[i][j].name === 'Mr.C') {
                marketLevel.map[i][j] = marketLevel.map[i][j].under_tile || 0;
            }
        }
    }
    
    for (const data of window.mainQuestNPCs) {
        const npc = data.npc;
        // Remove from market if still there
        let foundInMarket = false;
        for (let i = 0; i < marketLevel.map.length; i++) {
            for (let j = 0; j < marketLevel.map[i].length; j++) {
                if (marketLevel.map[i][j] === npc) {
                    marketLevel.map[i][j] = npc.under_tile || 0;
                    foundInMarket = true;
                    break;
                }
            }
            if (foundInMarket) break;
        }
        
        // Restore to original level and position
        npc.pos.x = data.originalPos.x;
        npc.pos.y = data.originalPos.y;
        const targetLvl = levels[data.lvlY][data.lvlX];
        if (targetLvl && targetLvl.map) {
            npc.under_tile = targetLvl.map[data.y][data.x];
            targetLvl.map[data.y][data.x] = npc;
        }
    }
    
    // Restore player position
    if (window.playerOriginalPos) {
        currentLevel_x = window.playerOriginalPos.lvlX;
        currentLevel_y = window.playerOriginalPos.lvlY;
        player.pos.x = window.playerOriginalPos.x;
        player.pos.y = window.playerOriginalPos.y;
        window.playerOriginalPos = null;
    }
    
    window.mainQuestNPCs = null;
    console.log('Cloudy Meadows NPCs and Player restored to original positions.');
}
