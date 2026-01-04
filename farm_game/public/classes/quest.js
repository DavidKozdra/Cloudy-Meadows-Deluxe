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
                    const savedGoal = this.goals[i];
                    this.goals[i] = new TalkingGoal(savedGoal.npc_name, savedGoal.item_name, savedGoal.amount, savedGoal.receive_type);
                    if(savedGoal.done !== undefined) {
                        this.goals[i].done = savedGoal.done;
                    }
                }
                else if (this.goals[i].class == 'FundingGoal'){
                    const savedGoal = this.goals[i];
                    this.goals[i] = new FundingGoal(savedGoal.amount);
                    if(savedGoal.done !== undefined) {
                        this.goals[i].done = savedGoal.done;
                    }
                }
                else if (this.goals[i].class == 'LocationGoal'){
                    const savedGoal = this.goals[i];
                    this.goals[i] = new LocationGoal(savedGoal.level_name);
                    if(savedGoal.done !== undefined) {
                        this.goals[i].done = savedGoal.done;
                    }
                }
                else if (this.goals[i].class == 'SellGoal'){
                    const savedGoal = this.goals[i];
                    this.goals[i] = new SellGoal(savedGoal.item_name, savedGoal.amount);
                    if(savedGoal.done !== undefined) {
                        this.goals[i].done = savedGoal.done;
                    }
                }
                else if (this.goals[i].class == 'HaveGoal'){
                    const savedGoal = this.goals[i];
                    this.goals[i] = new HaveGoal(savedGoal.item_name, savedGoal.amount);
                    if(savedGoal.done !== undefined) {
                        this.goals[i].done = savedGoal.done;
                    }
                }
                else if (this.goals[i].class == 'OneTileCheck'){
                    const savedGoal = this.goals[i];
                    if(savedGoal.old_tile_name == undefined){
                        savedGoal.old_tile_name = "Rock"
                    }
                    this.goals[i] = new OneTileCheck(savedGoal.tile_name, savedGoal.x, savedGoal.y, savedGoal.level_name, savedGoal.old_tile_name);
                    if(savedGoal.done !== undefined) {
                        this.goals[i].done = savedGoal.done;
                    }
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
        // Restore reward information if it exists
        if (obj.reward_item !== undefined) {
            this.reward_item = obj.reward_item;
        }
        if (obj.reward_coins !== undefined) {
            this.reward_coins = obj.reward_coins;
        }
    }

    render(container){
        // Called by miscfunctions to render quest UI
        this.RenderQuestList(container);
    }

    renderCurrentGoal(x, y, strokeC, width){
        // Advance to next incomplete goal if current is done
        while(this.current_Goal < this.goals.length && this.goals[this.current_Goal].done){
            this.current_Goal += 1;
        }
        
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
        
        // Add completed indicator to title if quest is done
        if (this.done) {
            titleDiv.style.textDecoration = 'none';
            titleDiv.style.opacity = '0.85';
            const completedBadge = document.createElement('span');
            completedBadge.textContent = ' ✓';
            completedBadge.style.color = 'rgb(50, 200, 50)';
            completedBadge.style.fontWeight = 'bold';
            completedBadge.style.fontSize = '18px';
            titleDiv.appendChild(completedBadge);
        }
        
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
        
        // Calculate progress based on completed goals
        let completedGoals = 0;
        for (let i = 0; i < this.goals.length; i++) {
            if (this.goals[i].done) {
                completedGoals++;
            }
        }
        const progress = (completedGoals / this.goals.length) * 100;
        progressFill.style.width = progress + '%';
        
        if (this.failed) {
            progressFill.style.backgroundColor = 'rgb(255, 0, 0)';
        } else if (this.done || completedGoals === this.goals.length) {
            progressFill.style.backgroundColor = 'rgb(50, 200, 50)';
        } else {
            progressFill.style.backgroundColor = 'rgb(255, 255, 0)';
        }
        
        progressBar.appendChild(progressFill);
        
        // Create status text
        const statusDiv = document.createElement('div');
        statusDiv.className = 'quest-status';

        if (this.failed) {
            statusDiv.textContent = 'Failed';
            statusDiv.style.color = 'rgb(255, 0, 0)';
        } else if (this.done) {
            // Quest completed
            statusDiv.textContent = 'Completed';
            statusDiv.style.color = 'rgb(50, 200, 50)';
            statusDiv.style.fontWeight = 'bold';
        } else if (this.goals[this.current_Goal] === undefined) {
            // Quest completed but with unclaimed rewards
            if (this.reward_item !== 0 || this.reward_coins !== 0) {
                statusDiv.textContent = 'Rewards Ready';
                statusDiv.style.color = 'rgb(255, 255, 0)';
            } else {
                statusDiv.textContent = 'Completed';
                statusDiv.style.color = 'rgb(50, 200, 50)';
            }
        } else {
            // Show active status
            statusDiv.textContent = `${completedGoals}/${this.goals.length} goals`;
            statusDiv.style.color = 'rgb(255, 255, 255)';
        }
        
        titleDiv.appendChild(statusDiv);
        // Details button is managed by miscfunctions.js in showQuestsPanel()
    }


    createGoalCard(goal, isActive){
        const card = document.createElement('div');
        card.style.padding = '14px';
        card.style.marginBottom = '10px';
        card.style.border = '2px solid rgb(149, 108, 65)';
        // Don't highlight as active if quest is failed
        const shouldHighlight = isActive && !this.failed;
        card.style.backgroundColor = shouldHighlight ? 'rgb(220, 200, 180)' : 'rgb(240, 225, 205)';
        card.style.borderRadius = '4px';
        card.style.display = 'flex';
        card.style.gap = '14px';
        card.style.alignItems = 'flex-start';
        card.style.minHeight = '80px';
        card.style.boxShadow = shouldHighlight ? '0 2px 4px rgba(0, 0, 0, 0.2)' : 'none';
    
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
        
        if (this.failed) {
            statusDiv.style.color = 'rgb(200, 50, 50)';
            statusDiv.textContent = '✗ Failed';
        } else if (goal.done) {
            statusDiv.style.color = 'rgb(50, 150, 50)';
            statusDiv.textContent = '✓ Complete';
        } else {
            statusDiv.style.color = 'rgb(180, 100, 0)';
            statusDiv.textContent = '○ To Do ';
        }
        contentDiv.appendChild(statusDiv);
        
        card.appendChild(contentDiv);
        
        return card;
    }
    
    getGoalImagePath(goal){
        // Return appropriate image path based on goal type
        if (goal.class === 'TalkingGoal' && goal.npc_name) {
            return this.map_quest_images('npc', goal.npc_name);
        } else if (goal.class === 'HaveGoal' && goal.item_name) {
            return this.map_quest_images('items', goal.item_name);
        } else if (goal.class === 'SellGoal' && goal.item_name) {
            return this.map_quest_images('items', goal.item_name);
        } else if (goal.class === 'LocationGoal' && goal.level_name) {
            return 'images/tiles/grass_tile.png'; // Use existing grass tile
        } else if (goal.class === 'OneTileCheck' && goal.tile_name) {
            return this.map_quest_images('tiles', goal.tile_name);
        } else if (goal.class === 'FundingGoal') {
            return 'images/ui/coin.png'; // Show coin for money goals
        }
        return 'images/ui/Chat_Icon.png'; // Safe default that exists
    }
    
    getItemImagePath(itemName){
        return this.map_quest_images('items', itemName);
    }
    
    map_quest_images(folder, name){
        // Create a mapping of known items to their actual image files
        const itemMap = {
            'flower seed': 'SeedBagFlower',
            'flowerseed': 'SeedBagFlower',
            'wheat seed': 'seedbag_sp',
            'wheatseed': 'seedbag_sp',
            'sweet potato seed': 'seedbag_sp',
            'sweetpotatoseed': 'seedbag_sp',
            'corn seed': 'Corn_Seed_bag',
            'cornseed': 'Corn_Seed_bag',
            'tomato seed': 'tomato_bag',
            'tomatoseed': 'tomato_bag',
            'strawberry seed': 'SeedBag_Stawberry',
            'strawberryseed': 'SeedBag_Stawberry',
            'watermelon seed': 'seedbagwatermelon',
            'watermelonseed': 'seedbagwatermelon',
            'hemp seed': 'hemp_seeds',
            'hempseed': 'hemp_seeds',
            'carrot seed': 'seedbag_carrot',
            'carrotseed': 'seedbag_carrot',
            'pumpkin seed': 'Pumpkin_seedBag',
            'pumpkinseed': 'Pumpkin_seedBag',
            'ladybug': 'Lady_Bug_bag',
            'ladybugs': 'Lady_Bug_bag',
            'hot dog': 'HotDog',
            'hotdog': 'HotDog',
            'chest': 'Chest',
            'sprinkler': 'Sprinkler',
            'full course': 'FullCourse',
            'fullcourse': 'FullCourse',
            'robot': 'robot',
            'robot1': 'robot',
            'robot2': 'robot2',
            'robot3': 'robot',
            'hemp': 'hemp',
            'hemp flower': 'hemp',
            'hempflower': 'hemp',
            'corn': 'Corn_item',
            'tomato': 'tomato',
            'strawberry': 'Stawberry',
            'strawberries': 'Stawberry',
            'watermelon': 'watermelon2',
            'sweet potatoes': 'SweetPotato',
            'sweetpotatoes': 'SweetPotato',
            'carrot': 'carrot',
            'pumpkin': 'Pumpkin',
            'compost': 'Compost',
            'junk': 'junk',
            'hoe': 'Hoe',
            'shovel': 'shovel',
            'veggie oil': 'veg_oil',
            'veggieoil': 'veg_oil',
            'backpack': 'backPack',
            'grinder': 'Grinder',
            'veggie press': 'veg_oil_maker',
            'veggiepress': 'veg_oil_maker',
            'up command': 'floppy_up',
            'down command': 'floppy_down',
            'left command': 'floppy_left',
            'right command': 'floppy_right',
            'interact command': 'floppy_interact',
            'restart command': 'floppy_restart',
            'add to chest command': 'Floppy_addChestt',
            'add from chest command': 'floppy_removechest',
            '1 day pause command': 'Floppy_Pause'
        };
        
        const tileMap = {
            'grass': 'grass_tile',
            'concrete': 'concrete_tile',
            'dirt': 'dirt_tile',
            'plot': 'plot_tile',
            'air balloon': 'air_ballon_tile',
            'airballoon': 'air_ballon_tile'
        };
        
        const npcMap = {
            'rick': 'cowboy_rick',
            'cowboyrick': 'cowboy_rick',
            'deb': 'deb',
            'mira': 'mira',
            'mario': 'mario',
            'jake': 'Jake',
            'jake player': 'Jake',
            
            // Old Man J - handle ALL variations (FIXED to use actual file)
            'oldmanj': 'old_man_jay1',
            'old man j': 'old_man_jay1',
            'oldmanjay': 'old_man_jay1',
            'old man jay': 'old_man_jay1',
            
            // Other available NPCs from image files
            'blindpete': 'blind_pete',
            'blind pete': 'blind_pete',
            'brandon': 'brandon',
            'brent': 'brent',
            'chef': 'chef',
            'christian': 'christian',
            'garry': 'garry',
            'james': 'james',
            'kenny': 'kenny',
            'liam': 'liam',
            'mrc': 'mrC',
            'mr c': 'mrC',
            'mister c': 'mrC',
            'robb': 'Rob_Botus',
            'robbot': 'Rob_Botus',
            'rob botus': 'Rob_Botus',
            'supertina': 'supertina',
            'tina': 'supertina',
            'vinny': 'vinny',
            'meb': 'meb',
            
            // Animals
            'bunny': 'bunny_front',
            'frog': 'frog_front',
            'dog': 'dog_left'
        };
        
        // Normalize the name
        const normalized = name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_-]/g, '');
        
        // Try to find in the appropriate map
        let mapped = null;
        if (folder === 'items') {
            mapped = itemMap[normalized] || itemMap[name.toLowerCase()];
        } else if (folder === 'tiles') {
            mapped = tileMap[normalized] || tileMap[name.toLowerCase()];
        } else if (folder === 'npc') {
            mapped = npcMap[normalized] || npcMap[name.toLowerCase()];
        }
        
        // If we found a mapping, use it; otherwise use the normalized name
        const filename = mapped || normalized;
        return `images/${folder}/${filename}.png`;
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
    
    createRewardsCard(){
        const card = document.createElement('div');
        card.style.padding = '14px';
        card.style.marginBottom = '10px';
        card.style.border = '2px solid rgba(255, 215, 0, 0.5)';
        card.style.backgroundColor = 'rgba(255, 235, 180, 0.9)';
        card.style.borderRadius = '4px';
        card.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
        
        const header = document.createElement('div');
        header.style.fontSize = '14px';
        header.style.fontWeight = 'bold';
        header.style.color = 'rgb(139, 98, 55)';
        header.style.marginBottom = '10px';
        header.textContent = '🎁 Rewards';
        card.appendChild(header);
        
        const rewardsContainer = document.createElement('div');
        rewardsContainer.style.display = 'flex';
        rewardsContainer.style.flexDirection = 'column';
        rewardsContainer.style.gap = '8px';
        
        let hasRewards = false;
        
        // Special handling for main quest "Save Cloudy Meadows"
        if (this.og_name === "Save Cloudy Meadows") {
            hasRewards = true;
            const mainReward = document.createElement('div');
            mainReward.style.display = 'flex';
            mainReward.style.alignItems = 'center';
            mainReward.style.gap = '8px';
            mainReward.style.padding = '6px';
            mainReward.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
            mainReward.style.borderRadius = '4px';
            
            const cloudImg = document.createElement('img');
            cloudImg.src = 'images/foreground/cloud_tile2.png';
            cloudImg.style.width = '32px';
            cloudImg.style.height = '32px';
            cloudImg.style.imageRendering = 'pixelated';
            mainReward.appendChild(cloudImg);
            
            const rewardText = document.createElement('span');
            rewardText.textContent = 'Freedom from Capitalism';
            rewardText.style.fontSize = '13px';
            rewardText.style.color = 'rgb(100, 70, 40)';
            rewardText.style.fontWeight = 'bold';
            mainReward.appendChild(rewardText);
            
            rewardsContainer.appendChild(mainReward);
        }
        // Add item reward with image
        // Check if reward_item is an object with name property (Item/Tool/Seed/etc object)
        else if (this.reward_item && typeof this.reward_item === 'object' && this.reward_item.name) {
            hasRewards = true;
            const itemReward = document.createElement('div');
            itemReward.style.display = 'flex';
            itemReward.style.alignItems = 'center';
            itemReward.style.gap = '8px';
            itemReward.style.padding = '6px';
            itemReward.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
            itemReward.style.borderRadius = '4px';
            
            const itemImg = document.createElement('img');
            itemImg.src = this.getItemImagePath(this.reward_item.name);
            itemImg.style.width = '32px';
            itemImg.style.height = '32px';
            itemImg.style.imageRendering = 'pixelated';
            itemImg.onerror = () => {
                // Fallback to a default image if the specific item image is not found
                itemImg.src = 'images/ui/Chat_Icon.png';
            };
            itemReward.appendChild(itemImg);
            
            const itemText = document.createElement('span');
            itemText.textContent = `${this.reward_item.amount || 1}x ${this.reward_item.name}`;
            itemText.style.fontSize = '13px';
            itemText.style.color = 'rgb(100, 70, 40)';
            itemText.style.fontWeight = 'bold';
            itemReward.appendChild(itemText);
            
            rewardsContainer.appendChild(itemReward);
        }
        
        // Add coin reward with icon
        if (this.reward_coins && this.reward_coins > 0) {
            hasRewards = true;
            const coinReward = document.createElement('div');
            coinReward.style.display = 'flex';
            coinReward.style.alignItems = 'center';
            coinReward.style.gap = '8px';
            coinReward.style.padding = '6px';
            coinReward.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
            coinReward.style.borderRadius = '4px';
            
            const coinImg = document.createElement('img');
            coinImg.src = 'images/ui/coin.png';
            coinImg.style.width = '28px';
            coinImg.style.height = '28px';
            coinImg.style.imageRendering = 'pixelated';
            coinReward.appendChild(coinImg);
            
            const coinText = document.createElement('span');
            coinText.textContent = `${this.reward_coins} coins`;
            coinText.style.fontSize = '13px';
            coinText.style.color = 'rgb(100, 70, 40)';
            coinText.style.fontWeight = 'bold';
            coinReward.appendChild(coinText);
            
            rewardsContainer.appendChild(coinReward);
        }
        
        // If no rewards were added, show a message
        if (!hasRewards) {
            const noRewardsText = document.createElement('div');
            noRewardsText.textContent = 'No rewards for this quest';
            noRewardsText.style.fontSize = '12px';
            noRewardsText.style.color = 'rgb(120, 90, 60)';
            noRewardsText.style.fontStyle = 'italic';
            noRewardsText.style.padding = '6px';
            rewardsContainer.appendChild(noRewardsText);
        }
        
        card.appendChild(rewardsContainer);
        return card;
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
    // Check all goals retroactively when quest is first received
    checkPastProgress(){
        // Check all goals to see if any were already completed
        for(let i = 0; i < this.goals.length; i++){
            if(!this.goals[i].done){
                this.goals[i].update();
            }
        }
        
        // Advance current_Goal to first incomplete goal (for display)
        while(this.current_Goal < this.goals.length && this.goals[this.current_Goal].done){
            this.current_Goal += 1;
        }
        
        // Check if quest is already complete
        if(this.current_Goal >= this.goals.length && !this.done){
            this.completeQuest();
        }
    }
    
    completeQuest(){
        this.done = true;
        
        // Dispatch quest completion event
        window.dispatchEvent(new CustomEvent('questCompleted', {
            detail: { quest: this }
        }));
        
        // Give item reward - force into inventory even if full
        if(this.reward_item != 0){
            const itemNum = item_name_to_num(this.reward_item.name);
            if(itemNum !== undefined) {
                // Try to add normally first
                if(checkForSpace(player, itemNum)){
                    addItem(player, itemNum, this.reward_item.amount);
                }
                else {
                    // Inventory full - drop in hand or force stack
                    let added = false;
                    // Try to stack with existing item
                    for(let i = 0; i < player.inv.length; i++){
                        if(player.inv[i] != 0 && player.inv[i].name === this.reward_item.name){
                            player.inv[i].amount += this.reward_item.amount;
                            added = true;
                            break;
                        }
                    }
                    // If can't stack, drop in first empty slot or show warning
                    if(!added) {
                        console.warn('Quest reward inventory full, reward not given: ' + this.reward_item.name);
                    }
                }
                this.reward_item = 0;
            }
        }
        
        // Always give coin reward regardless of inventory space
        if(this.reward_coins > 0){
            addMoney(this.reward_coins);
            this.reward_coins = 0;
        }
    }

    update(){
        if(!this.failed){
            // Check ALL goals, not just current one - goals can complete in any order
            let allGoalsComplete = true;
            for(let i = 0; i < this.goals.length; i++){
                if(!this.goals[i].done){
                    this.goals[i].update();
                }
                if(!this.goals[i].done){
                    allGoalsComplete = false;
                }
            }
            
            // Update current_Goal pointer for UI display (first incomplete goal)
            while(this.current_Goal < this.goals.length && this.goals[this.current_Goal].done){
                this.current_Goal += 1;
                // Dispatch goal completion event
                window.dispatchEvent(new CustomEvent('questGoalCompleted', {
                    detail: { quest: this, goalIndex: this.current_Goal - 1 }
                }));
            }
            
            // Complete quest if all goals are done
            if(allGoalsComplete && !this.done){
                this.completeQuest();
            }
        }
    }
    
    checkGoalCompletions(){
        // Lightweight check for goal completions that fires events
        if(this.failed) return;
        
        let anyCompleted = false;
        for(let i = 0; i < this.goals.length; i++){
            if(!this.goals[i].done){
                // Call update to check completion
                this.goals[i].update();
                
                // If goal just completed, fire event
                if(this.goals[i].done){
                    anyCompleted = true;
                    // Dispatch goal completion event
                    window.dispatchEvent(new CustomEvent('questGoalCompleted', {
                        detail: { quest: this, goalIndex: i }
                    }));
                }
            }
        }
        
        // Check if all goals are complete
        if(anyCompleted){
            let allComplete = true;
            for(let i = 0; i < this.goals.length; i++){
                if(!this.goals[i].done){
                    allComplete = false;
                    break;
                }
            }
            if(allComplete && !this.done){
                this.completeQuest();
            }
        }
    }
    
    markGoalComplete(goalIndex){
        // Called by goals when they complete to trigger UI update
        if (this.goals[goalIndex] && !this.goals[goalIndex].done) {
            this.goals[goalIndex].done = true;
            
            // Dispatch goal completion event
            window.dispatchEvent(new CustomEvent('questGoalCompleted', {
                detail: { quest: this, goalIndex: goalIndex }
            }));
            
            // Check if all goals complete
            let allComplete = true;
            for (let i = 0; i < this.goals.length; i++) {
                if (!this.goals[i].done) {
                    allComplete = false;
                    break;
                }
            }
            
            if (allComplete && !this.done) {
                this.completeQuest();
            }
        }
    }

}





class Goal {
    constructor(name){
        this.name = name;
        this.done = false;
        this.eventListeners = []; // Track event listeners for cleanup
    }
    
    // Register an event listener that will be cleaned up when goal is destroyed
    addEventListener(eventName, handler){
        const boundHandler = handler.bind(this);
        window.addEventListener(eventName, boundHandler);
        this.eventListeners.push({ eventName, handler: boundHandler });
    }
    
    // Clean up event listeners
    removeEventListeners(){
        for(let listener of this.eventListeners){
            window.removeEventListener(listener.eventName, listener.handler);
        }
        this.eventListeners = [];
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

class TalkingGoal extends Goal{  // Talk to _(npc_name)  and Give _(amount) _(item_name) to _(npc_name)  or Get _(amount) _(item_name) from _(npc_name)

    constructor(npc_name, item_name, amount, receive_type){
        // receive_type: undefined/false = give items, true = receive items from NPC
        if(item_name && item_name != 0){
            if(receive_type){
                super('Get ' + amount + ' ' + item_name + ' from ' + npc_name);
            }
            else{
                super('Give ' + amount + ' ' + item_name + ' to ' + npc_name);
            }
        }
        else{
            super('Talk to ' + npc_name);
        }
        this.npc_name = npc_name;
        this.item_name = item_name || 0;  // Default to 0 if undefined
        this.amount = amount || 0;  // Default to 0 if undefined
        this.receive_type = receive_type || false;  // true if receiving from NPC
        this.npc_gave_items = false;  // Track if NPC actually gave us the items
        this.class = 'TalkingGoal';
        
        // Listen for NPC giving items through dialogue
        this.addEventListener('npcGaveItems', (e) => {
            if(e.detail.npcName === this.npc_name && e.detail.itemName === this.item_name && e.detail.amount >= this.amount){
                this.npc_gave_items = true;
            }
        });
        
        // Listen for NPC interaction events
        this.addEventListener('npcInteraction', (e) => {
            if(e.detail.npcName === this.npc_name && !this.done){
                if(this.item_name == 0){
                    // Just need to talk
                    this.done = true;
                } else if(this.receive_type){
                    // For receive type: only complete if NPC actually gave us the items
                    if(this.npc_gave_items){
                        // Verify we still have the items
                        for(let i = 0; i < player.inv.length; i++){
                            if(player.inv[i].name == this.item_name && player.inv[i].amount >= this.amount){
                                this.done = true;
                                break;
                            }
                        }
                    }
                } else {
                    // Need to give item to NPC
                    for(let i = 0; i < player.inv.length; i++){
                        if(player.inv[i].name == this.item_name && player.inv[i].amount >= this.amount){
                            player.inv[i].amount -= this.amount;
                            if(player.inv[i].amount <= 0){
                                player.inv[i] = 0;
                            }
                            this.done = true;
                            break;
                        }
                    }
                }
            }
        });
    }

    update(){
        // Check if talking to the right NPC (either looking at them OR already in conversation)
        const isTalkingToNPC = (player.talking != 0 && player.talking.name === this.npc_name) || 
                               (player.looking(currentLevel_x, currentLevel_y) != undefined && 
                                player.looking(currentLevel_x, currentLevel_y).name === this.npc_name);
        
        if(isTalkingToNPC){
            if(this.item_name != 0){
                if(this.receive_type){
                    // For receive type: only complete if NPC actually gave us the items
                    if(this.npc_gave_items){
                        // Verify we still have the items
                        for(let i = 0; i < player.inv.length; i++){
                            if(!this.done && player.inv[i].name == this.item_name && player.inv[i].amount >= this.amount){
                                this.done = true;
                                break;
                            }
                        }
                    }
                }
                else{
                    // For give type: check if we have items to give, then remove them
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
        
        // Listen for location visit events
        this.addEventListener('locationVisited', (e) => {
            if(e.detail.locationName === this.level_name && !this.done){
                this.done = true;
            }
        });
    }

    update(){
        // Check if player is currently at the location
        if(levels[currentLevel_y][currentLevel_x].name == this.level_name){
            this.done = true;
        }
        // Also check if player has ever visited this location
        if(typeof visitedLocations !== 'undefined' && visitedLocations.has(this.level_name)){
            this.done = true;
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






























