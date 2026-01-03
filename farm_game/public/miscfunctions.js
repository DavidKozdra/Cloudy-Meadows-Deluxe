
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
    
    const anyMenuVisible = mainMenuVisible || difficultyMenuVisible || optionsMenuVisible || creditsMenuVisible || pauseMenuVisible || questsVisible;
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
    const questsList = questsContainer.querySelector('.quests-list');
    if (!questsList) return;
    
    const buttons = questsList.querySelectorAll('.quest-item');
    buttons.forEach(btn => {
        const questIndex = parseInt(btn.getAttribute('data-quest-index'));
        const questContent = btn.querySelector('.quest-content');
        questContent.innerHTML = '';
        player.quests[questIndex].render(questContent, player.current_quest === questIndex ? 'yellow' : null);
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



function showTitle(){
    // Render background on canvas
    push()
    background(135, 206, 235);
    for (let i = 0; i < clouds.length; i++) {
        clouds[i].update(clouds[i].vel)
        clouds[i].render()
    }
    imageMode(CENTER);
    image(title_screen_img, canvasWidth / 2, (canvasHeight / 2) - 40);
    pop();

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
    if (!container) {
        // Create structure once
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
        
        const startBtn = document.createElement('button');
        startBtn.id = 'start-btn';
        startBtn.className = 'main-menu-button';
        // Check if there's any saved data (keys that can be deleted)
        const hasSavedGame = localData.keys() > 0;
        startBtn.textContent = hasSavedGame ? 'Continue' : 'Start';
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
                    { label: 'Money Loss', icon: 'checkmark.png' },
                    { label: 'Food Rot', icon: 'x.png' },
                    { label: 'Perma Death', icon: 'x.png' }
                ],
                difficulty: 0
            },
            {
                id: 'medium',
                title: 'Medium',
                features: [
                    { label: 'Money Loss', icon: 'checkmark.png' },
                    { label: 'Food Rot', icon: 'checkmark.png' },
                    { label: 'Perma Death', icon: 'x.png' }
                ],
                difficulty: 1
            },
            {
                id: 'hard',
                title: 'Hard',
                features: [
                    { label: 'Money Loss', icon: 'x.png' },
                    { label: 'Food Rot', icon: 'x.png' },
                    { label: 'Perma Death', icon: 'checkmark.png' }
                ],
                difficulty: 2
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
                
                const img = document.createElement('img');
                img.src = `images/ui/${feature.icon}`;
                img.alt = feature.label;
                img.className = 'feature-icon';
                featureDiv.appendChild(img);
                
                card.appendChild(featureDiv);
            }
            
            const btn = document.createElement('button');
            btn.className = 'difficulty-select-btn';
            btn.textContent = 'Select';
            btn.dataset.difficulty = diff.difficulty;
            btn.addEventListener('click', () => {
                selectDifficulty(diff.difficulty);
            });
            card.appendChild(btn);
            
            container.appendChild(card);
        }
    }
    difficultyMenu.style.display = 'flex';
    updateCanvasPointerEvents();
}

function hideDifficultyMenu(){
    const difficultyMenu = document.getElementById('difficulty-menu');
    if (difficultyMenu) difficultyMenu.style.display = 'none';
    updateCanvasPointerEvents();
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
        
        // Controls section
        const controlsSection = document.createElement('div');
        controlsSection.className = 'options-section';
        const controlsTitle = document.createElement('h3');
        controlsTitle.className = 'options-section-title';
        controlsTitle.textContent = 'Controls';
        controlsSection.appendChild(controlsTitle);
        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'title-controls-container';
        controlsContainer.className = 'title-controls-container';
        controlsSection.appendChild(controlsContainer);
        optionsMenu.appendChild(controlsSection);
        
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

function showPaused(){
    ensurePauseMenuContainer();
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) {
        pauseMenu.style.display = 'flex';
        updateCanvasPointerEvents();
        
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
    const musicSliderDOM = document.createElement('input');
    musicSliderDOM.id = 'pause-music-slider';
    musicSliderDOM.type = 'range';
    musicSliderDOM.min = '0';
    musicSliderDOM.max = '1';
    musicSliderDOM.step = '0.01';
    musicRow.appendChild(musicIcon);
    musicRow.appendChild(musicSliderDOM);
    sliderSection.appendChild(musicRow);
    
    // FX slider
    const fxRow = document.createElement('div');
    fxRow.className = 'pause-slider-row';
    const fxIcon = document.createElement('img');
    fxIcon.className = 'pause-slider-icon';
    fxIcon.src = 'images/ui/fx.png';
    fxIcon.alt = 'FX';
    const fxSliderDOM = document.createElement('input');
    fxSliderDOM.id = 'pause-fx-slider';
    fxSliderDOM.type = 'range';
    fxSliderDOM.min = '0';
    fxSliderDOM.max = '1';
    fxSliderDOM.step = '0.01';
    fxRow.appendChild(fxIcon);
    fxRow.appendChild(fxSliderDOM);
    sliderSection.appendChild(fxRow);
    
    pauseMenu.appendChild(sliderSection);
    
    // Controls section - using renderControlButtons
    const controlsSection = document.createElement('div');
    controlsSection.className = 'pause-controls-section';
    controlsSection.id = 'pause-controls-container';
    const controlsTitle = document.createElement('div');
    controlsTitle.className = 'pause-controls-title';
    controlsTitle.textContent = 'Controls';
    controlsSection.appendChild(controlsTitle);
    
    pauseMenu.appendChild(controlsSection);
    
    // Render control buttons once
    renderControlButtons(controlsSection);
    
    // Quit button
    const quitBtn = document.createElement('button');
    quitBtn.id = 'pause-quit-btn';
    quitBtn.className = 'pause-quit-button';
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
        QuitButton.hide();
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
            'Christian Rodriguez - Lead programmer',
            'David Kozdra - Code Art and sound',
            'Patrick Mayer - Misc',
            'Christian "Sealand" Rodriguez - Music',
            'Ethan Davis - Dialogue and Testing',
            'and thanks to our play testers'
        ];
        
        credits.forEach((credit, idx) => {
            const line = document.createElement('div');
            line.className = 'credits-line';
            if (idx === 1) {
                line.innerHTML = `David Kozdra - Code Art and sound<br><a href="https://davidkozdra.com" target="_blank" class="credits-link">davidkozdra.com</a> | <a href="https://zoda39089.itch.io/" target="_blank" class="credits-link">itch.io page</a>`;
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
let lastQuestSliderValue = -1;
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
            updateCanvasPointerEvents();
        });
        headerWrapper.appendChild(closeButton);
        
        // Create quests list container
        const questsList = document.createElement('div');
        questsList.className = 'quests-list';
        questsContainer.appendChild(questsList);
        
        // Create footer for close instruction
        const closeInstruction = document.createElement('div');
        closeInstruction.className = 'quests-close-instruction';
        questsContainer.appendChild(closeInstruction);
        
        // Disable canvas pointer events to prevent click interception
        const canvas = document.querySelector('canvas');
        if(canvas){
            canvas.style.pointerEvents = 'none';
        }
    }

    // Only update if slider position changed or quest was selected
    const currentSliderValue = questSlider.value();
    if (currentSliderValue !== lastQuestSliderValue || lastSelectedQuest !== player.current_quest) {
        lastQuestSliderValue = currentSliderValue;
        lastSelectedQuest = player.current_quest;
        
        // Update quests list
        const questsList = questsContainer.querySelector('.quests-list');
        questsList.innerHTML = '';

        // Render visible quests
        const startIndex = currentSliderValue;
        const endIndex = Math.min(player.quests.length > 6 ? 6 + startIndex : player.quests.length, player.quests.length);
        
        for(let i = startIndex; i < endIndex; i++){
            const questButton = document.createElement('button');
            questButton.className = 'quest-item';
            questButton.setAttribute('data-quest-index', i);
            
            if (player.current_quest === i) {
                questButton.classList.add('quest-current');
            }
            
            // Add click handler
            questButton.addEventListener('click', (e) => {
                console.log('Quest button clicked');
                e.preventDefault();
                e.stopPropagation();
                const questIndex = parseInt(e.currentTarget.getAttribute('data-quest-index'));
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
        }
    }

    // Update close instruction
    const closeInstruction = questsContainer.querySelector('.quests-close-instruction');
    closeInstruction.textContent = String.fromCharCode(quest_key) + ' to close quests';

    // Hide p5.js button and show container
    questCloseButton.hide();

    // Show slider only if there are more than 6 quests
    if(player.quests.length > 6){
        questSlider.show();
        questSlider.style('position', 'absolute');
        questSlider.style('bottom', 'calc(12.5% + 50px)');
        questSlider.style('left', '50%');
        questSlider.style('transform', 'translateX(-50%)');
        questSlider.style('z-index', '999');
        questSlider.style('pointer-events', 'auto');
        questSlider.attribute('max', Math.max(0, player.quests.length - 6));
    }
    else{
        questSlider.hide();
    }

    questsContainer.style.display = 'flex';
    updateCanvasPointerEvents();
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
}

function tile_name_to_num(tile_name) {
    for (let i = 0; i < all_tiles.length; i++) {
        if (tile_name == all_tiles[i].name) {
            return i+1;
        }
    }
}

function new_tile_from_num(num, x, y) {
    if (num-1 <= all_tiles.length) {
        if (all_tiles[num - 1].class == 'Tile') {
            return new Tile(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].collide, all_tiles[num - 1].age);
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
            return new NPC(all_tiles[num - 1].name, all_tiles[num - 1].png, x, y, all_tiles[num - 1].inv, all_tiles[num - 1].hand, all_tiles[num - 1].facing, all_tiles[num - 1].under_tile_num, all_tiles[num - 1].instructions, all_tiles[num - 1].moving_timer);
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
        console.error('tile created from ' + num + ' doesnt exist');
    }
}

function new_item_from_num(num, amount) {
    if (num <= all_items.length) {
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
            return new Seed(all_items[num].name, amount, all_items[num].png, all_items[num].plant_num);
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
    if(player.talking == 0){
        player.save()
    }
    localData.set('Day_curLvl_Dif', {days: days, currentLevel_x: currentLevel_x, currentLevel_y: currentLevel_y, dificulty: dificulty});
    let lvlLength = 0;
    for(let i = 0; i < levels.length; i++){
        for(let j = 0; j < levels[i].length; j++){
            if(levels[i][j] != 0 && levels[i][j] != undefined){
                for(let y = 0; y < levels[i][j].map.length; y++){
                    for(let x = 0; x < levels[i][j].map[y].length; x++){
                        if (levels[i][j].map[y][x] != 0){
                            levels[i][j].map[y][x].getReadyForSave();
                        }
                    }
                }
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
    }
    if(localData.get('Day_curLvl_Dif') != null){
        days = localData.get('Day_curLvl_Dif').days || 0;
        // Ensure days is a valid number
        if (isNaN(days)) {
            days = 0;
        }
        currentLevel_x = localData.get('Day_curLvl_Dif').currentLevel_x;
        currentLevel_y = localData.get('Day_curLvl_Dif').currentLevel_y;
        dificulty = localData.get('Day_curLvl_Dif').dificulty;
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
                    
                    level.map[i][j] = new_tile_from_num(tile_name_to_num(newLvl.map[i][j].name), newLvl.map[i][j].pos.x, newLvl.map[i][j].pos.y);
                    level.map[i][j].load(newLvl.map[i][j]);
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
