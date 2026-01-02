class Quest {

    constructor(name, goals, days, reward_item, reward_coins){
        this.name = name;
        this.done = false;
        this.failed = false;
        this.days = days;
        this.maxDays = this.days;
        this.og_name = this.name;
        if(this.maxDays > 0){
            this.name = this.og_name + ' ' + this.days + ' days left';
        }
        if(reward_item == 0){
            this.reward_item = 0;
        }
        else{
            this.reward_item = new_item_from_num(reward_item.num, reward_item.amount);
        }
        this.reward_coins = reward_coins;
        this.current_Goal = 0;
        this.goals = goals;
        for(let i = 0; i < this.goals.length; i++){
            if (this.goals[i] == 0){
                let rand = ceil(random(0, 4))
                if(rand == 0){
                    this.goals[i] = new TalkingGoal() //add random parameters
                }
                else if (rand == 1){
                    this.goals[i] = new fundingGoal() //add random parameters
                }
                else if (rand == 2){
                    this.goals[i] = new LocationGoal() //add random parameters
                }
                else if (rand == 3){
                    this.goals[i] = new SellGoal() //add random parameters
                }
                else if (rand == 4){
                    this.goals[i] = new HaveGoal() //add random parameters
                }
            }
            else{
                if(this.goals[i].class == 'TalkingGoal'){
                    this.goals[i] = new TalkingGoal(this.goals[i].npc_name, this.goals[i].item_name, this.goals[i].amount)
                }
                else if (this.goals[i].class == 'FundingGoal'){
                    this.goals[i] = new FundingGoal(this.goals[i].amount)
                }
                else if (this.goals[i].class == 'LocationGoal'){
                    this.goals[i] = new LocationGoal(this.goals[i].level_name)
                }
                else if (this.goals[i].class == 'SellGoal'){
                    this.goals[i] = new SellGoal(this.goals[i].item_name, this.goals[i].amount)
                }
                else if (this.goals[i].class == 'HaveGoal'){
                    this.goals[i] = new HaveGoal(this.goals[i].item_name, this.goals[i].amount)
                }
                else if (this.goals[i].class == 'OneTileCheck'){
                    if(this.goals[i].old_tile_name == undefined){
                        this.goals[i].old_tile_name = "Rock"
                    }
                    this.goals[i] = new OneTileCheck(this.goals[i].tile_name, this.goals[i].x, this.goals[i].y, this.goals[i].level_name,  this.goals[i].old_tile_name) 
                }
            }
        }
    }
    load(obj){
        this.done = obj.done;
        this.failed = obj.failed;
        this.days = obj.days;
        this.maxDays = obj.maxDays;
        this.current_Goal = obj.current_Goal;
    }
    renderCurrentGoal(x, y, strokeC, width){
        // Display current goal as a DOM popup inside the container
        if(this.goals[this.current_Goal] != undefined){
            const goalName = this.goals[this.current_Goal].name;
            
            // Ensure popup container exists
            this.ensurePopupContainer();
            
            // Create or update the goal popup
            let goalPopup = document.getElementById('current-goal-popup');
            if (!goalPopup) {
                goalPopup = document.createElement('div');
                goalPopup.id = 'current-goal-popup';
                const container = document.getElementById('ui-popup-container');
                if (container) container.appendChild(goalPopup);
            }
            
            // Calculate panel dimensions
            const panelWidth = Math.max((goalName.length * 12), 150);
            const panelHeight = 50;
            
            // Determine stroke color
            const strokeColor = (strokeC == 'yellow') ? 'rgb(255, 255, 0)' : 'rgb(139, 98, 55)';
            
            // Style the popup
            goalPopup.style.width = panelWidth + 'px';
            goalPopup.style.height = panelHeight + 'px';
            goalPopup.style.backgroundColor = 'rgb(187, 132, 75)';
            goalPopup.style.border = '5px solid ' + strokeColor;
            goalPopup.style.padding = '0px';
            goalPopup.style.boxSizing = 'border-box';
            goalPopup.style.fontFamily = 'pixelFont, monospace';
            goalPopup.style.color = 'rgb(255, 255, 255)';
            goalPopup.style.fontSize = (goalName.length > 25 ? '11px' : '13px');
            goalPopup.style.display = 'flex';
            goalPopup.style.alignItems = 'center';
            goalPopup.style.justifyContent = 'center';
            goalPopup.style.textAlign = 'center';
            goalPopup.style.wordWrap = 'break-word';
            goalPopup.style.textShadow = '2px 2px 0px rgba(0, 0, 0, 0.5)';
            goalPopup.style.lineHeight = '1.2';
            goalPopup.style.overflow = 'hidden';
            goalPopup.style.marginTop = '5px';
            
            goalPopup.textContent = goalName;
        }
    }
    
    ensurePopupContainer(){
        // Create a shared container for all UI popups to prevent overlap
        if (!document.getElementById('ui-popup-container')) {
            const container = document.createElement('div');
            container.id = 'ui-popup-container';
            document.body.appendChild(container);
            
            const canvas = document.querySelector('canvas');
            if (canvas) {
                const canvasRect = canvas.getBoundingClientRect();
                container.style.position = 'fixed';
                container.style.top = (canvasRect.top + 2) + 'px';
                container.style.left = (canvasRect.left + 2) + 'px';
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.zIndex = '1000';
                container.style.pointerEvents = 'none';
            }
        }
    }

    RenderQuestList(container){
        // Clear container
        container.innerHTML = '';
        
        // Create quest title
        const titleDiv = document.createElement('div');
        titleDiv.className = 'quest-title';
        titleDiv.textContent = this.name;
        container.appendChild(titleDiv);
        
        // Create progress bar container
        const progressContainer = document.createElement('div');
        progressContainer.className = 'quest-progress-container';
        container.appendChild(progressContainer);
        
        // Create progress bar
        const progressBar = document.createElement('div');
        progressBar.className = 'quest-progress-bar';
        progressContainer.appendChild(progressBar);
        
        // Create progress fill
        const progressFill = document.createElement('div');
        progressFill.className = 'quest-progress-fill';
        const progress = (this.current_Goal / this.goals.length) * 100;
        progressFill.style.width = progress + '%';
        
        if (this.failed) {
            progressFill.style.backgroundColor = 'rgb(255, 0, 0)';
        } else if (this.goals[this.current_Goal] === undefined) {
            progressFill.style.backgroundColor = 'rgb(0, 255, 0)';
        } else {
            progressFill.style.backgroundColor = 'rgb(255, 255, 0)';
        }
        
        progressBar.appendChild(progressFill);
        
        // Create status text
        const statusDiv = document.createElement('div');
        statusDiv.className = 'quest-status';

        // Inline goal details container
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'quest-details-container';
        detailsContainer.style.display = 'none';

        // Details button in the progress row
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
            for (let i = 0; i < this.goals.length; i++) {
                const goal = this.goals[i];
                const card = this.createGoalCard(goal, i === this.current_Goal && !goal.done);
                detailsContainer.appendChild(card);
            }
            detailsContainer.style.display = 'flex';
            detailsButton.textContent = 'Hide';
        };
        progressContainer.appendChild(detailsButton);
        container.appendChild(detailsContainer);

        if (this.failed) {
            statusDiv.textContent = 'Failed';
            statusDiv.style.color = 'rgb(255, 0, 0)';
        } else if (this.goals[this.current_Goal] === undefined) {
            // Quest completed
            if (this.reward_item !== 0 || this.reward_coins !== 0) {
                statusDiv.textContent = 'Rewards Ready';
                statusDiv.style.color = 'rgb(255, 255, 0)';
            } else {
                statusDiv.textContent = 'Done';
                statusDiv.style.color = 'rgb(0, 255, 0)';
            }
        } else {
            // Show current goal
            //statusDiv.textContent = this.goals[this.current_Goal].name;
            statusDiv.style.color = 'rgb(255, 255, 255)';
        }
        
        titleDiv.appendChild(statusDiv);
    }


    createGoalCard(goal, isActive){
        const card = document.createElement('div');
        card.style.padding = '14px';
        card.style.marginBottom = '10px';
        card.style.border = '2px solid rgb(149, 108, 65)';
        card.style.backgroundColor = isActive ? 'rgb(220, 200, 180)' : 'rgb(240, 225, 205)';
        card.style.borderRadius = '4px';
        card.style.display = 'flex';
        card.style.gap = '14px';
        card.style.alignItems = 'flex-start';
        card.style.minHeight = '80px';
        card.style.boxShadow = isActive ? '0 2px 4px rgba(0, 0, 0, 0.2)' : 'none';
    
        card.className = 'quest-goal-card';
        // Goal image/icon
        const imageDiv = document.createElement('div');
        imageDiv.style.minWidth = '64px';
        imageDiv.style.width = '64px';
        imageDiv.style.height = '64px';
        imageDiv.style.backgroundColor = 'rgb(187, 132, 75)';
        imageDiv.style.border = '2px solid rgb(149, 108, 65)';
        imageDiv.style.borderRadius = '4px';
        imageDiv.style.display = 'flex';
        imageDiv.style.alignItems = 'center';
        imageDiv.style.justifyContent = 'center';
        imageDiv.style.overflow = 'hidden';
        imageDiv.style.flexShrink = '0';
        
        const img = document.createElement('img');
        img.src = this.getGoalImagePath(goal);
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.imageRendering = 'pixelated';
        img.onerror = () => {
            img.style.display = 'none';
            const fallbackEmoji = document.createElement('div');
            fallbackEmoji.textContent = this.getGoalTypeEmoji(goal);
            fallbackEmoji.style.fontSize = '36px';
            fallbackEmoji.style.lineHeight = '1';
            imageDiv.appendChild(fallbackEmoji);
        };
        
        imageDiv.appendChild(img);
        card.appendChild(imageDiv);
        
        // Content
        const contentDiv = document.createElement('div');
        contentDiv.style.flex = '1';
        contentDiv.style.minWidth = '0';
        contentDiv.style.overflow = 'hidden';
        contentDiv.style.display = 'flex';
        contentDiv.style.flexDirection = 'column';
        contentDiv.style.justifyContent = 'center';
        
        const goalName = document.createElement('div');
        goalName.textContent = goal.name;
        goalName.style.fontWeight = 'bold';
        goalName.style.marginBottom = '6px';
        goalName.style.fontSize = '12px';
        goalName.style.lineHeight = '1.3';
        goalName.style.color = 'rgb(50, 50, 50)';
        contentDiv.appendChild(goalName);
        
        // Goal details - single line where possible
        const detailsDiv = document.createElement('div');
        detailsDiv.style.fontSize = '11px';
        detailsDiv.style.color = 'rgb(90, 90, 90)';
        detailsDiv.style.marginBottom = '6px';
        detailsDiv.style.lineHeight = '1.4';
        
        if (goal.class === 'TalkingGoal') {
            detailsDiv.textContent = `NPC: ${goal.npc_name}`;
            if (goal.item_name) {
                const itemLine = document.createElement('div');
                itemLine.textContent = `Give: ${goal.amount}x ${goal.item_name}`;
                itemLine.style.marginTop = '3px';
                detailsDiv.appendChild(itemLine);
            }
        } else if (goal.class === 'LocationGoal') {
            detailsDiv.textContent = `Location: ${goal.level_name}`;
        } else if (goal.class === 'SellGoal') {
            detailsDiv.textContent = `Sell: ${goal.amount}x ${goal.item_name}`;
        } else if (goal.class === 'HaveGoal') {
            detailsDiv.textContent = `Collect: ${goal.amount}x ${goal.item_name}`;
        } else if (goal.class === 'FundingGoal') {
            detailsDiv.textContent = `Earn: ${goal.amount} coins`;
        } else if (goal.class === 'OneTileCheck') {
            detailsDiv.textContent = `Tile: ${goal.tile_name}`;
        }
        
        contentDiv.appendChild(detailsDiv);
        
        // Status
        const statusDiv = document.createElement('div');
        statusDiv.style.fontSize = '11px';
        statusDiv.style.fontWeight = 'bold';
        statusDiv.style.color = goal.done ? 'rgb(50, 150, 50)' : 'rgb(180, 100, 0)';
        statusDiv.textContent = goal.done ? '✓ Complete' : '○ Active';
        contentDiv.appendChild(statusDiv);
        
        card.appendChild(contentDiv);
        
        return card;
    }
    
    getGoalImagePath(goal){
        // Return appropriate image path based on goal type
        if (goal.class === 'TalkingGoal' && goal.npc_name) {
            return `images/npc/${goal.npc_name.toLowerCase()}.png`;
        } else if (goal.class === 'HaveGoal' && goal.item_name) {
            return `images/items/${goal.item_name.toLowerCase()}.png`;
        } else if (goal.class === 'SellGoal' && goal.item_name) {
            return `images/items/${goal.item_name.toLowerCase()}.png`;
        } else if (goal.class === 'LocationGoal' && goal.level_name) {
            return `images/tiles/grass.png`; // placeholder
        } else if (goal.class === 'OneTileCheck' && goal.tile_name) {
            return `images/tiles/${goal.tile_name.toLowerCase()}.png`;
        }
        return 'images/ui/default.png';
    }
    
    getItemImagePath(itemName){
        return `images/items/${itemName.toLowerCase()}.png`;
    }
    
    getGoalTypeEmoji(goal){
        const emojiMap = {
            'TalkingGoal': '💬',
            'LocationGoal': '🗺️',
            'FundingGoal': '💰',
            'SellGoal': '🛒',
            'HaveGoal': '📦',
            'OneTileCheck': '🔨'
        };
        return emojiMap[goal.class] || '❓';
    }


    daily_update(){
        if(this.maxDays > 0){
            this.days -= 1;
            if(this.days < 0){
                this.days = 0;
            }
            this.name = this.og_name + ' ' + this.days + ' days left';
            if(this.days <= 0 && !this.done){
                this.days = 0;
                this.failed = true;
            }
        }
    }
    update(){
        if(!this.failed){
            if(this.goals[this.current_Goal] != undefined){
                this.goals[this.current_Goal].update()
                if(this.goals[this.current_Goal].done){
                    this.current_Goal += 1;
                    // Dispatch goal completion event
                    window.dispatchEvent(new CustomEvent('questGoalCompleted', {
                        detail: { quest: this, goalIndex: this.current_Goal - 1 }
                    }));
                    
                    if(this.current_Goal > this.goals.length-1 && !this.done){
                        this.done = true;
                        
                        // Dispatch quest completion event
                        window.dispatchEvent(new CustomEvent('questCompleted', {
                            detail: { quest: this }
                        }));
                        
                        // Give item reward if inventory has space
                        if(this.reward_item != 0){
                            if(checkForSpace(player, item_name_to_num(this.reward_item.name))){
                                addItem(player, item_name_to_num(this.reward_item.name), this.reward_item.amount)
                                this.reward_item = 0;
                            }
                            // If no space, quest stays done but item reward remains claimable
                        }
                        
                        // Always give coin reward regardless of inventory space
                        if(this.reward_coins > 0){
                            addMoney(this.reward_coins);
                            this.reward_coins = 0;
                        }
                    }
                }
            }
        }
    }

}





class Goal {
    constructor(name){
        this.name = name;
        this.done = false;
    }

    render(x, y){
        push()
        textFont(player_2);
        textSize(this.name.length > 20 ? 8 : 12);
        fill(255);
        stroke(0);
        strokeWeight(4);
        textAlign(CENTER, CENTER);
        text(this.name, x, y);
        pop()
    }

}

class TalkingGoal extends Goal{  // Talk to _(npc_name)  and Give _(amount) _(item_name) to _(npc_name)

    constructor(npc_name, item_name, amount){
        if(item_name != 0){
            super('Give ' + amount + ' ' + item_name + ' to ' + npc_name);
        }
        else{
            super('Talk to ' + npc_name);
        }
        this.npc_name = npc_name;
        this.item_name = item_name;
        this.amount = amount;
        this.class = 'TalkingGoal';
    }

    update(){
        if(player.looking(currentLevel_x, currentLevel_y) != undefined && player.talking.name === this.npc_name){
            if(this.item_name != 0){
                for(let i = 0; i < player.inv.length; i++){
                    if(!this.done && player.inv[i].name == this.item_name && player.inv[i].amount >= this.amount){
                        player.inv[i].amount -= this.amount;
                        if(player.inv[i].amount <= 0){
                            player.inv[i] = 0;
                        }
                        this.done = true;
                    }
                }
            }
            else if (!this.done){
                this.done = true;
            }
        }
    }
}

class FundingGoal extends Goal{  //Get _(amount) coins, take those coins

    constructor(amount){
        super('Get ' + amount + ' more coins')
        this.amount = amount;
        this.class = 'FundingGoal';
    }

    update(){
        if(player.coins >= this.amount){
            this.done = true;
            player.coins -= this.amount;
        }
        if(!this.done){
            this.name = 'Get ' + (this.amount-player.coins) + ' more coins';
        }
        else{
            this.name = 'Get ' + 0 + ' more coins';
        }
    }
}

class LocationGoal extends Goal{ // Go to _(level_name)

    constructor(level_name){
        super('Go to ' + level_name)
        this.level_name = level_name;
        this.class = 'LocationGoal';
    }

    update(){
        if(levels[currentLevel_y][currentLevel_x].name == this.level_name){
            this.done = true ;
        }
    }
}

class SellGoal extends Goal{ // Sell _(amount) more of _(item)

    constructor(item_name, amount){
        super('Sell ' + amount + ' more of ' + item_name)
        this.item_name = item_name;
        this.amount = amount;
        this.class = 'SellGoal';
    }

    update(){
        if(this.amount == 0){
            this.done = true;
        }
        if(!this.done){
            this.name = 'Sell ' + this.amount + ' more of ' + this.item_name;
        }
        else{
            this.name = 'Sell ' + 0 + ' more of ' + this.item_name;
        }
    }
}

class HaveGoal extends Goal{ // Have _(amount) of _(item_name)
    constructor(item_name, amount){
        super('Have ' + amount + ' of ' + item_name);
        this.item_name = item_name;
        this.amount = amount;
        this.class = 'HaveGoal';
    }

    update(){
        for(let i = 0; i < player.inv.length; i++){
            if(player.inv[i].name == this.item_name && player.inv[i].amount >= this.amount){
                this.done = true;
            }
        }
    }
}

class OneTileCheck extends Goal{
    constructor(tile_name, x, y, level_name , oldTileName){
        super('Make x:' + x + ' y:' + y + ' into ' + tile_name + ' at ' + level_name + " instead of " + oldTileName);
        this.level_name = level_name;
        this.tile_name = tile_name;
        this.x = x;
        this.y = y;
        this.class = 'OneTileCheck';
    }

    update(){
        // Optimized: Only check current level instead of all 36 levels every frame
        const currentLevel = levels[currentLevel_y][currentLevel_x];
        if (currentLevel && this.level_name == currentLevel.name) {
            if (currentLevel.map[this.y][this.x].name == this.tile_name) {
                this.done = true;
            }
        }
    }
}






























