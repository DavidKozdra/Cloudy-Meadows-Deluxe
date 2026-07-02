class Robot extends GridMoveEntity{
    constructor(name, png, x, y, inv, under_tile_num, instructions, moving_timer){
        super(name, png, x, y, inv, 0, 2, under_tile_num, instructions, moving_timer);
        this.class = 'Robot';
        this.fuel = 190;
        this.max_fuel = 190;
        this.fuel_timer = moving_timer;
        this.max_fuel_timer = this.fuel_timer;
        this.day_pause = false;
        this.day_paused = 0;
        this.status = 'idle';
    }

    capasity(){
        var full = true;
        for(let i = 0; i < this.inv.length; i++){
            if(this.inv[i] == 0 ){
               return full=false;
            }
        }
        return full;
    }

    render() {
        push();
        imageMode(CENTER);
        if(this.under_tile != 0){
            this.under_tile.render();
        }
        if(this.fuel < 10){
            image(battery_low_img, this.pos.x + tileSize - 5, this.pos.y + tileSize/4)
        }
        if(this.capasity()){
       
            image(inv_full_img, this.pos.x + tileSize - 5, this.pos.y + tileSize/2)
        }
        image(all_imgs[this.png][this.facing][0], this.pos.x + (tileSize / 2), this.pos.y + (tileSize / 2)); //[this.anim]

        pop();

 
    }

    render_pc(){
        // On mobile, use the DOM-based inventory UI
        if (typeof isMobile !== 'undefined' && isMobile && typeof openMobileInventory === 'function') {
            if (typeof mobileInventoryState !== 'undefined' && !mobileInventoryState.isOpen) {
                openMobileInventory('Robot', this);
            }
            return; // Don't render p5 UI on mobile
        }
        
        if (this.playerOwned) {
            robotPlayButton.show();
            robotPauseButton.show();
            robotBoomButton.show();
        } else {
            robotPlayButton.hide();
            robotPauseButton.hide();
            robotBoomButton.hide();
        }
        robotBoomButton.style('background-color','rgb(50, 50, 50)');
        robotBoomButton.style('color','rgb(255, 0, 0)');
        robotBoomButton.position(canvasWidth - (canvasWidth/8) - 50, canvasHeight/8 + (canvasHeight - (canvasWidth/3) - 17) - 50);
        if(temp_move_bool){
            robotPlayButton.style('background-color','rgb(255, 255, 255)');
            robotPauseButton.style('background-color','rgb(50, 50, 50)');
        }
        else{
            robotPauseButton.style('background-color','rgb(255, 255, 255)');
            robotPlayButton.style('background-color','rgb(50, 50, 50)');
        }
        push()
        stroke(149, 108, 65);
        strokeWeight(5);
        fill(187, 132, 75);
        rect(canvasWidth/16, canvasHeight/8 + (canvasHeight - (canvasWidth/3) - 17), canvasWidth - (canvasWidth/8), (canvasHeight/8)+ 7);
        stroke(100);
        strokeWeight(6);
        fill(50);
        rect(canvasWidth/16, canvasHeight/8, canvasWidth - (canvasWidth/8), canvasHeight - (canvasWidth/3) - 17);
        stroke(149, 108, 65);
        strokeWeight(5);
        fill(187, 132, 75);
        rect(canvasWidth/16, canvasHeight/8 + (canvasHeight - (canvasWidth/3) - 40), canvasWidth/11, (canvasHeight/24)-1);
        noStroke();
        rect((canvasWidth/16) + 2, canvasHeight/8 + (canvasHeight - (canvasWidth/3) - 35), (canvasWidth/11) - 4, canvasHeight/25)
        textFont(player_2);
        textSize(15);
        fill(0, 255, 0);
        stroke(0);
        strokeWeight(4);
        text(this.name, (canvasWidth/16)+10, (canvasHeight/8)+10);
        if (!this.playerOwned) text('VIEW ONLY', (canvasWidth/16)+105, (canvasHeight/8)+10);
        text('Inst->', (canvasWidth/16)+10, (canvasHeight/8)+30);
        text('Fuel', (canvasWidth/16)+25, (canvasHeight/8)+65);
        fill(255);
        text('Inv', (canvasWidth/16)+10, canvasHeight/8 + (canvasHeight - (canvasWidth/3) - 32))
        let y = 0;
        let x = 0;
        for(let i = 0; i < this.instructions.length; i++){
            if(i%6 == 0){
                y+=86;
                x = 0;
            }
            stroke(0, 255, 0);
            strokeWeight(5);
            fill(0);
            if(this.current_instruction == i){
                stroke(255);
            }
            rect((x*90)+160, y, 64, 64);
            if(this.instructions[i] != 0){
                this.instructions[i].render((x*90)+160, y);
            }
            x += 1;
        }
        stroke(255);
        rect((canvasWidth/16)+45, (canvasHeight/8)+90, 20, 200);
        stroke(0);
        strokeWeight(2);
        fill(0, 255, 0);
        rect((canvasWidth/16)+45+5, (canvasHeight/8)+90+200-this.fuel-5, 10, this.fuel);
        for(let i = 0; i < this.inv.length; i++){
            stroke(255, 255, 0);
            strokeWeight(5);
            fill(149, 108, 65);
            rect((i*90)+70, 432, 64, 64);
            if(this.inv[i] != 0){
                this.inv[i].render((i*90)+70, 432);
            }
        }
        pop()
    }

    advanceInstruction(count = 1) {
        if (!this.instructions.length) return;
        this.current_instruction = (this.current_instruction + count) % this.instructions.length;
    }

    getSelector() {
        if (!this.instructions.length) return null;
        if (this.current_instruction + 1 >= this.instructions.length) return null;
        const next = this.instructions[this.current_instruction + 1];
        return next && next !== 0 && next.command === undefined ? next : null;
    }

    selectInventoryItem(name) {
        if (!name) return this.inv[this.hand] && this.inv[this.hand] !== 0;
        const index = this.inv.findIndex(item => item && item !== 0 && item.name === name);
        if (index < 0) return false;
        this.hand = index;
        return true;
    }

    canUseChest(chest) {
        return chest && chest.class === 'Chest' && chest.playerOwned === this.playerOwned;
    }

    tryMove(direction, x, y) {
        const vectors = { up: [0, -1, 0], right: [1, 0, 1], down: [0, 1, 2], left: [-1, 0, 3] };
        const vector = vectors[direction];
        if (!vector) return false;
        this.facing = vector[2];

        const sourceLevel = levels[y] && levels[y][x];
        if (!sourceLevel || !sourceLevel.map) return false;
        const row = this.pos.y / tileSize;
        const col = this.pos.x / tileSize;
        let targetLevelX = x;
        let targetLevelY = y;
        let targetRow = row + vector[1];
        let targetCol = col + vector[0];

        if (targetRow < 0) {
            targetLevelY -= 1;
            const targetLevel = levels[targetLevelY] && levels[targetLevelY][targetLevelX];
            if (!targetLevel || !targetLevel.map) return false;
            targetRow = targetLevel.map.length - 1;
        } else if (targetRow >= sourceLevel.map.length) {
            targetLevelY += 1;
            targetRow = 0;
        }
        if (targetCol < 0) {
            targetLevelX -= 1;
            const targetLevel = levels[targetLevelY] && levels[targetLevelY][targetLevelX];
            if (!targetLevel || !targetLevel.map) return false;
            targetCol = targetLevel.map[0].length - 1;
        } else if (targetCol >= sourceLevel.map[0].length) {
            targetLevelX += 1;
            targetCol = 0;
        }

        const targetLevel = levels[targetLevelY] && levels[targetLevelY][targetLevelX];
        const destination = targetLevel && targetLevel.map && targetLevel.map[targetRow] && targetLevel.map[targetRow][targetCol];
        if (!destination || destination.collide === true) return false;

        sourceLevel.map[row][col] = this.under_tile;
        this.under_tile = destination;
        targetLevel.map[targetRow][targetCol] = this;
        this.pos.x = targetCol * tileSize;
        this.pos.y = targetRow * tileSize;
        return true;
    }

    canInteract(x, y, selector) {
        const held = this.inv[this.hand];
        const under = this.under_tile;
        const ahead = this.looking(x, y);
        if (selector && !this.selectInventoryItem(selector.name)) return false;
        const selected = this.inv[this.hand];
        if (under && under.class === 'Plant') {
            return under.age === all_imgs[under.png].length - 2 || (selected && selected.name === 'Shovel');
        }
        if (ahead && ahead.name === 'cart_s') return !!(selected && selected.price);
        if (!selected || selected === 0) return false;
        if (under.name === 'plot') return selected.class === 'Seed';
        if (under.name === 'grass') return selected.name === 'Hoe';
        if (under.name === 'sprinkler') return selected.name === 'Shovel';
        if (under.name === 'compost_bucket') return selected.name === 'Junk' || selected.class === 'Seed';
        if (under.name === 'Veggie_Press') return selected.class === 'Eat';
        if (under.name === 'grinder') return selected.class === 'Eat' && !!selected.seed_num;
        if (under.name === 'junk') return true;
        if (selected.class === 'Placeable') return true;
        return false;
    }

    transferToChest(chest, itemName) {
        if (!this.canUseChest(chest) || !this.selectInventoryItem(itemName)) return false;
        const item = this.inv[this.hand];
        for (const row of chest.inv) {
            const stack = row.find(slot => slot && slot !== 0 && slot.name === item.name);
            if (stack) {
                stack.amount += item.amount;
                this.inv[this.hand] = 0;
                return true;
            }
        }
        for (const row of chest.inv) {
            const empty = row.indexOf(0);
            if (empty >= 0) {
                row[empty] = new_item_from_num(item_name_to_num(item.name), item.amount);
                this.inv[this.hand] = 0;
                return true;
            }
        }
        return false;
    }

    transferFromChest(chest, itemName) {
        if (!this.canUseChest(chest) || !itemName) return false;
        const itemNum = item_name_to_num(itemName);
        if (!checkForSpace(this, itemNum)) return false;
        for (const row of chest.inv) {
            const index = row.findIndex(slot => slot && slot !== 0 && slot.name === itemName);
            if (index >= 0) {
                addItem(this, itemNum, row[index].amount);
                row[index] = 0;
                return true;
            }
        }
        return false;
    }

    recharge() {
        if (this.fuel_timer > 0 || this.fuel >= this.max_fuel) return;
        let fueled = false;
        if (this.name === 'Robot1') {
            const oilIndex = this.inv.findIndex(item => item && item !== 0 && item.name === 'Veggie Oil');
            if (oilIndex >= 0) {
                this.inv[oilIndex].amount -= 1;
                if (this.inv[oilIndex].amount <= 0) this.inv[oilIndex] = 0;
                fueled = true;
            }
        } else if (this.name === 'Robot2') {
            fueled = !!(this.under_tile && this.under_tile.name === 'sprinkler');
        } else if (this.name === 'Robot3') {
            fueled = time <= 100;
        }
        if (fueled) {
            this.fuel = Math.min(this.max_fuel, this.fuel + 10);
            this.fuel_timer = this.max_fuel_timer;
        }
    }

    move(x, y) {
        const bedBoost = player && player.touching && player.touching.name === 'bed' ? 3 : 1;
        this.moving_timer -= bedBoost;
        this.fuel_timer -= bedBoost;
        this.recharge();

        if (this.day_pause && days > this.day_paused) {
            this.move_bool = true;
            this.day_pause = false;
        }
        if (this.moving_timer > 0 || !this.move_bool || this.fuel <= 0 || !this.instructions.length) return;

        const instruction = this.instructions[this.current_instruction];
        this.moving_timer = this.max_moving_timer;
        if (!instruction || instruction === 0 || instruction.command === undefined) {
            this.status = 'skipping empty slot';
            this.advanceInstruction();
            return;
        }

        const command = instruction.command;
        const selector = this.getSelector();
        const selectorCount = selector ? 2 : 1;
        let completed = false;
        if (['up', 'right', 'down', 'left'].includes(command)) {
            completed = this.tryMove(command, x, y);
            this.status = completed ? 'moving' : 'blocked';
        } else if (command === 'interact') {
            completed = this.canInteract(x, y, selector);
            if (completed) this.onInteract(x, y);
            this.status = completed ? 'working' : 'waiting for valid target/item';
        } else if (command === 'add_to_chest') {
            completed = !!selector && this.transferToChest(this.looking(x, y), selector.name);
            this.status = completed ? 'deposited items' : 'waiting for owned chest/item/space';
        } else if (command === 'add_from_chest') {
            completed = !!selector && this.transferFromChest(this.looking(x, y), selector.name);
            this.status = completed ? 'collected items' : 'waiting for owned chest/item/space';
        } else if (command === 'restart') {
            this.current_instruction = 0;
            completed = true;
            this.status = 'restarting program';
        } else if (command === '1day_pause') {
            this.day_pause = true;
            this.day_paused = days;
            this.move_bool = false;
            completed = true;
            this.status = 'paused until tomorrow';
        }

        if (!completed) return;
        this.fuel = Math.max(0, this.fuel - 1);
        if (command !== 'restart') this.advanceInstruction(selectorCount);
        if (currentLevel_x === x && currentLevel_y === y && typeof robot_talkingSound !== 'undefined') robot_talkingSound.play();
        this.anim = (this.anim + 1) % all_imgs[this.png][this.facing].length;
    }

    load(obj){
        this.age = obj.age;
        this.hand = obj.hand;
        this.under_tile = new_tile_from_num(tile_name_to_num(obj.under_tile.name), obj.under_tile.pos.x, obj.under_tile.pos.y);
        this.under_tile.load(obj.under_tile);
        this.anim = obj.anim;
        this.facing = obj.facing;
        this.moving_timer = obj.moving_timer;
        this.current_instruction = obj.current_instruction;
        this.move_bool = obj.move_bool;
        this.fuel = obj.fuel;
        this.fuel_timer = typeof obj.fuel_timer === 'number' ? obj.fuel_timer : this.max_fuel_timer;
        this.status = obj.status || 'idle';
        if (typeof obj.playerOwned === 'boolean') this.playerOwned = obj.playerOwned;
        this.day_pause = obj.day_pause;
        this.day_paused = obj.day_paused;
        for(let i = 0; i < obj.instructions.length; i++){
            if(obj.instructions[i] != 0 && obj.instructions[i]){
                const itemNum = item_name_to_num(obj.instructions[i].name);
                if(itemNum === undefined){ this.instructions[i] = 0; continue; }
                this.instructions[i] = new_item_from_num(itemNum, obj.instructions[i].amount);
                if(this.instructions[i] && this.instructions[i].class == 'Backpack'){
                    this.instructions[i].load(obj.instructions[i])
                }
            } else {
                this.instructions[i] = 0;
            }
        }
        for(let i = 0; i < obj.inv.length; i++){
            if(obj.inv[i] != 0 && obj.inv[i]){
                const itemNum = item_name_to_num(obj.inv[i].name);
                if(itemNum === undefined){ this.inv[i] = 0; continue; }
                this.inv[i] = new_item_from_num(itemNum, obj.inv[i].amount);
                if(this.inv[i] && this.inv[i].class == 'Backpack'){
                    this.inv[i].load(obj.inv[i])
                }
            } else {
                this.inv[i] = 0;
            }
        }
    }
}
