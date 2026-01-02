
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
        title_screen = false;
        if(localData.get('Day_curLvl_Dif') == null){
            dificulty_screen = true;
        }
        paused = false;
        levels[currentLevel_y][currentLevel_x].level_name_popup = true;
    });
}

/*
button types   
wasd and <- up v -> down
12345678

interact 
eat secoundary interact 

inventory quick move 

*/


function showTitle(){
    push()
    background(135, 206, 235);
    for (let i = 0; i < clouds.length; i++) {
        clouds[i].update(clouds[i].vel)
        clouds[i].render()
    }
    imageMode(CENTER);
    image(title_screen_img, canvasWidth / 2, (canvasHeight / 2) - 40);
    
    textFont(player_2);
    fill('black');
    textAlign(CENTER, CENTER);
    textSize(13);
    
    startButton.show();
    optionsButton.show();
    creditsButton.show();
    
    pop();

    if(paused){
        showOptions();
    }
    else{
        musicSlider.hide();
        fxSlider.hide();
        resetControlsButton.hide();
        clearButton.hide();
        hideControls();

    }
    if(creditsOn){
        showCredits();
    }
    else{
        cursor('default');
    }
    if(clear_anim){
        clear_data_render();
    }
}

function showDificulty(){
    push();
    background(135, 206, 235);
    musicSlider.hide();
    fxSlider.hide();
    clearButton.hide();
    for (let i = 0; i < clouds.length; i++) {
        clouds[i].update(clouds[i].vel)
        clouds[i].render()
    }
    stroke(149, 108, 65);
    strokeWeight(5);
    fill(187, 132, 75);
    image(dif_background_img, -20, (canvasHeight/4));
    image(dif_background_img, canvasWidth - 236, (canvasHeight/4));
    image(dif_background_img, (canvasWidth/2)-(256/2), (canvasHeight/4));
    image(dif_background_img, (canvasWidth/2)-(256/2), 10);
    rect((canvasWidth/2)-220, (canvasWidth/2)-300, 440, 100);
    textFont(player_2);
    fill('black');
    textAlign(CENTER, CENTER);
    textSize(20);
    stroke(255);
    strokeWeight(3);
    text('Select Your Dificulty', (canvasWidth/2)-10, (canvasWidth/2)-250);

    fill(100, 255, 100);
    stroke(0, 200, 0);
    strokeWeight(5);
    rect((canvasWidth/4)-90-13, (canvasWidth/2)-150-13, 170, 290);
    fill(0, 255, 0);
    stroke(0);
    strokeWeight(3);
    textSize(20);
    text('Easy', (canvasWidth/4)-90-13+(170/2), (canvasWidth/2)-150-13+20);
    textSize(14);
    text('Money Loss', (canvasWidth/4)-90-13+(170/2), (canvasWidth/2)-150-13+70);
    text('Food Rot', (canvasWidth/4)-90-13+(170/2), (canvasWidth/2)-150-13+140);
    text('Perma Death', (canvasWidth/4)-90-13+(170/2), (canvasWidth/2)-150-13+210);
    image(check_img, (canvasWidth/4)-90-13+(170/2)-8, (canvasWidth/2)-150-13+90)
    image(x_img, (canvasWidth/4)-90-13+(170/2)-8, (canvasWidth/2)-150-13+160)
    image(x_img, (canvasWidth/4)-90-13+(170/2)-8, (canvasWidth/2)-150-13+230)

    fill(100, 100, 255);
    stroke(0, 0, 200);
    strokeWeight(5);
    rect(((2*canvasWidth)/4)-90-13, (canvasWidth/2)-150-13, 170, 290);
    fill(0, 0, 255);
    stroke(0);
    strokeWeight(3);
    textSize(20);
    text('Medium', ((2*canvasWidth)/4)-90-13+(170/2), (canvasWidth/2)-150-13+20);
    textSize(14);
    text('Money Loss', ((2*canvasWidth)/4)-90-13+(170/2), (canvasWidth/2)-150-13+70);
    text('Food Rot', ((2*canvasWidth)/4)-90-13+(170/2), (canvasWidth/2)-150-13+140);
    text('Perma Death', ((2*canvasWidth)/4)-90-13+(170/2), (canvasWidth/2)-150-13+210);
    image(check_img, ((2*canvasWidth)/4)-90-13+(170/2)-8, (canvasWidth/2)-150-13+90)
    image(check_img, ((2*canvasWidth)/4)-90-13+(170/2)-8, (canvasWidth/2)-150-13+160)
    image(x_img, ((2*canvasWidth)/4)-90-13+(170/2)-8, (canvasWidth/2)-150-13+230)

    fill(255, 100, 100);
    stroke(200, 0, 0);
    strokeWeight(5);
    rect(((3*canvasWidth)/4)-90-13, (canvasWidth/2)-150-13, 170, 290);
    fill(255, 0, 0);
    stroke(0);
    strokeWeight(3);
    textSize(20);
    text('Hard', ((3*canvasWidth)/4)-90-13+(170/2), (canvasWidth/2)-150-13+20);
    textSize(14);
    text('Money Loss', ((3*canvasWidth)/4)-90-13+(170/2), (canvasWidth/2)-150-13+70);
    text('Food Rot', ((3*canvasWidth)/4)-90-13+(170/2), (canvasWidth/2)-150-13+140);
    text('Perma Death', ((3*canvasWidth)/4)-90-13+(170/2), (canvasWidth/2)-150-13+210);
    image(x_img, ((3*canvasWidth)/4)-90-13+(170/2)-8, (canvasWidth/2)-150-13+90)
    image(x_img, ((3*canvasWidth)/4)-90-13+(170/2)-8, (canvasWidth/2)-150-13+160)
    image(check_img, ((3*canvasWidth)/4)-90-13+(170/2)-8, (canvasWidth/2)-150-13+230)

    dif0button.show()
    dif1button.show()
    dif2button.show()

    pop();
}

let controlsContainer = null;
let controlRows = [];

function renderControlButtons(x, y) {
    const controlItems = [
        { label: 'Interact:', key: () => Controls_Interact_button_key, controlIndex: 1 },
        { label: 'Eat:', key: () => Controls_Eat_button_key, controlIndex: 2 },
        { label: 'Up:', key: () => Controls_Up_button_key, controlIndex: 3 },
        { label: 'Down:', key: () => Controls_Down_button_key, controlIndex: 4 },
        { label: 'Left:', key: () => Controls_Left_button_key, controlIndex: 5 },
        { label: 'Right:', key: () => Controls_Right_button_key, controlIndex: 6 },
        { label: 'Special:', key: () => Controls_Special_button_key, controlIndex: 7 },
        { label: 'Quest:', key: () => Controls_Quest_button_key, controlIndex: 8 }
    ];
    
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
                if (control_set === 0) {
                    control_set = item.controlIndex;
                    key = item.key();
                    lastKey = key;
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
    musicSlider.show();
    fxSlider.show();
    musicSlider.position(((4*canvasWidth)/5)-30, (canvasHeight/6)-25);
    fxSlider.position(((4*canvasWidth)/5)-30, (canvasHeight/6)+15);
    
    renderControlButtons(((4*canvasWidth)/5)-80, canvasHeight/2-127);

    resetControlsButton.show();
    clearButton.show();
    //deleate data button
    image(music_note_img, ((4*canvasWidth)/5)-80, (canvasHeight/6)-50);
    image(fx_img, ((4*canvasWidth)/5)-80, (canvasHeight/6)-10);
    pop()
}

function showPaused(){
    push()
    stroke(149, 108, 65);
    strokeWeight(5);
    fill(187, 132, 75);
    rectMode(CENTER);
    rect(canvasWidth/2, (canvasHeight/2)-30, 400, 400);
    fill(255);
    stroke(0);
    strokeWeight(2);
    textFont(player_2);
    textAlign(CENTER, CENTER);
    textSize(30);
    text('Paused', canvasWidth/2, (canvasHeight/5)-20);
    musicSlider.show();
    fxSlider.show();
    QuitButton.show();
    musicSlider.position((canvasWidth/2)-10, (canvasHeight/5)+25);
    fxSlider.position((canvasWidth/2)-10, (canvasHeight/5)+65);

    image(music_note_img, (canvasWidth/2)-65, (canvasHeight/5));
    image(fx_img, (canvasWidth/2)-65, (canvasHeight/5)+40);

    renderControlButtons(((2*canvasWidth)/5)-60, canvasHeight/2-102);

    pop()
}

function showCredits(){
    push()
    stroke(149, 108, 65);
    strokeWeight(5);
    fill(187, 132, 75);
    rectMode(CENTER);
    rect(canvasWidth/2 + 120, 150/2, 490, 150 );
    fill(255);
    stroke(0);
    strokeWeight(2);
    textFont(player_2);
    textAlign(CENTER, CENTER);
    textSize(11);
    text('Credits', canvasWidth/2 + 120, 20);
    
    // Credits text
    textSize(10);
    text('Christian Rodriguez - Lead programmer', (canvasWidth/2)+120, 50);
    
    // David Kozdra line with links
    textSize(10);
    let davidY = 65;
    text('David Kozdra - Code Art and sound', (canvasWidth/2)+120, davidY);
    
    // Calculate link positions for David's links
    let websiteLinkX = (canvasWidth/2)+120 - 80;
    let websiteLinkY = davidY + 12;
    let itchLinkX = (canvasWidth/2)+120 + 60;
    let itchLinkY = davidY + 12;
    
    // Check if mouse is hovering over website link
    let websiteHover = mouseX > websiteLinkX - 50 && mouseX < websiteLinkX + 50 && 
                       mouseY > websiteLinkY - 8 && mouseY < websiteLinkY + 8;
    
    // Check if mouse is hovering over itch link
    let itchHover = mouseX > itchLinkX - 40 && mouseX < itchLinkX + 40 && 
                    mouseY > itchLinkY - 8 && mouseY < itchLinkY + 8;
    
    // Website link
    fill(websiteHover ? color(100, 200, 255) : color(150, 200, 255));
    textSize(9);
    text('davidkozdra.com', websiteLinkX, websiteLinkY);
    
    // Itch.io link
    fill(itchHover ? color(100, 200, 255) : color(150, 200, 255));
    text('itch.io page', itchLinkX, itchLinkY);
    
    // Change cursor on hover
    if(websiteHover || itchHover){
        cursor('pointer');
    }
    
    // Handle clicks
    if(mouseIsPressed && !window.creditLinkClicked){
        window.creditLinkClicked = true;
        if(websiteHover){
            window.open('https://davidkozdra.com', '_blank');
        }
        if(itchHover){
            window.open('https://zoda39089.itch.io/', '_blank');
        }
    }
    if(!mouseIsPressed){
        window.creditLinkClicked = false;
    }
    
    // Rest of credits
    fill(255);
    textSize(10);
    text('Patrick Mayer - Misc', (canvasWidth/2)+120, 90);
    text('Christian "Sealand" Rodriguez - Music', (canvasWidth/2)+120, 105);
    text('Ethan Davis - Dialogue and Testing', (canvasWidth/2)+120, 120);
    text('and thanks to our play testers', (canvasWidth/2)+120, 135);
    
    pop()
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
    if(localData.get('player') != null ){
        player.load(localData.get('player'));
    }
    if(localData.get('Day_curLvl_Dif') != null){
        days = localData.get('Day_curLvl_Dif').days;
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
