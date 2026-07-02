class MoveableEntity extends Entity {
    constructor(name, png, x, y, inv = [], hand = 0, facing, under_tile_num, moving_timer) {
        super(name, png, x, y, -1, inv, hand, under_tile_num);
        this.anim = 0;
        this.facing = facing;
        this.touching = 0;
        this.moving_timer = moving_timer;
        this.max_moving_timer = this.moving_timer;
        this.class = "MovableEntity";
    }

    render() {
        push();
        imageMode(CENTER);
        if(this.under_tile != 0){
            this.under_tile.render();
        }
        // Safety check: ensure the image exists before rendering
        if (!all_imgs[this.png] || !all_imgs[this.png][this.facing] || !all_imgs[this.png][this.facing][0]) {
            console.warn('Missing image for entity:', this.name, 'png:', this.png, 'facing:', this.facing);
            pop();
            return;
        }
        image(all_imgs[this.png][this.facing][0], this.pos.x + (tileSize / 2), this.pos.y + (tileSize / 2)); // [0] => [this.anim] if we ever get more frames
        pop();
    }

    looking(x, y) {
        this.touching = this.tileTouching(x, y);
        if (this.touching != 0) {
            if ((this.touching.pos.y / tileSize == 0 && this.facing == 0) || (this.touching.pos.y / tileSize == 18 && this.facing == 2)) {
                return undefined;
            }
            switch (this.facing) {
                case 0:
                    return levels[y][x].map[(this.touching.pos.y / tileSize) - 1][this.touching.pos.x / tileSize];
                case 1:
                    return levels[y][x].map[(this.touching.pos.y / tileSize)][(this.touching.pos.x / tileSize) + 1];
                case 2:
                    return levels[y][x].map[(this.touching.pos.y / tileSize) + 1][this.touching.pos.x / tileSize];
                case 3:
                    return levels[y][x].map[(this.touching.pos.y / tileSize)][(this.touching.pos.x / tileSize) - 1];
                default:
                    console.error("facing not understood");
            }
        }
    }

    onInteract(x, y) {
        if (this.under_tile.class == 'Plant') {
            if(this.under_tile.age == all_imgs[this.under_tile.png].length - 2){
                if(checkForSpace(this, this.under_tile.eat_num)){
                    const baseYield = typeof this.under_tile.getHarvestYield === 'function'
                        ? this.under_tile.getHarvestYield()
                        : 1;
                    addItem(this, this.under_tile.eat_num, baseYield + levels[y][x].ladybugs);
                    this.under_tile = new_tile_from_num(3, this.under_tile.pos.x, this.under_tile.pos.y);
                }
            }
            else if(this.inv[this.hand].name == 'Shovel'){
                this.under_tile = new_tile_from_num(3, this.under_tile.pos.x, this.under_tile.pos.y);
            }
        }
        if (this.looking(x, y) != undefined && this.looking(x, y).name == 'cart_s') {
            if (this.inv[this.hand].price != 0 && this.inv[this.hand] != 0) {
                addMoney(this.inv[this.hand].price);
                moneySound.play();
                // Automated sales count toward the player's active sell goal.
                if (player && player.quests && player.current_quest !== undefined) {
                    const quest = player.quests[player.current_quest];
                    const goal = quest && quest.goals && quest.goals[quest.current_Goal];
                    if (goal && goal.class === 'SellGoal' && goal.item_name === this.inv[this.hand].name) {
                        goal.amount -= 1;
                    }
                }
                // Track what was sold to all shops
                for(let i = 0; i < levels.length; i++){
                    for(let j = 0; j < levels[i].length; j++){
                        const level = levels[i][j];
                        if(level && level.map){
                            for(let my = 0; my < level.map.length; my++){
                                for(let mx = 0; mx < level.map[my].length; mx++){
                                    const tile = level.map[my][mx];
                                    if(tile && tile.class == 'Shop'){
                                        tile.recordItemSold(this.inv[this.hand].name, 1);
                                    }
                                }
                            }
                        }
                    }
                }
                this.inv[this.hand].amount -= 1;
                if (this.inv[this.hand].amount == 0) {
                    this.inv[this.hand] = 0;
                }
            }
        }
        if (this.inv[this.hand] != 0 && this.inv[this.hand].class == 'Placeable') {
            if (tile_name_to_num(this.under_tile.name) == this.inv[this.hand].tile_need_num || this.inv[this.hand].tile_need_num == 0) {
                if(this.inv[this.hand].name == 'Robot1' || this.inv[this.hand].name == 'Robot2' || this.inv[this.hand].name == 'Robot3' || this.inv[this.hand].name == 'Chest'){
                    if(this.looking(x, y) != undefined && this.looking(x, y).collide == false){
                        let temp = this.looking(x, y);
                        if (this.under_tile != 0) {
                            levels[y][x].map[(this.looking(x, y).pos.y / tileSize)][this.looking(x, y).pos.x / tileSize] = new_tile_from_num(this.inv[this.hand].tile_num, this.looking(x, y).pos.x, this.looking(x, y).pos.y);
                        }
                        const placedEntity = this.looking(x, y);
                        placedEntity.under_tile = temp;
                        // Robots may deploy infrastructure, but it belongs to the
                        // same owner as the deploying robot.
                        placedEntity.playerOwned = this.playerOwned === true;
                        if(this.inv[this.hand].name != 'Chest'){
                            placedEntity.move_bool = false;
                        }
                    }
                    else{
                        return;
                    }
                }
                else{
                    this.under_tile = new_tile_from_num(this.inv[this.hand].tile_num, this.under_tile.pos.x, this.under_tile.pos.y);
                    if (this.inv[this.hand].name == 'Ladybugs') {
                        levels[y][x].ladybugs += 1;
                    }
                }
                this.inv[this.hand].amount -= 1;
                if (this.inv[this.hand].amount == 0) {
                    this.inv[this.hand] = 0;
                }
            }
        }
        if (this.under_tile.name == 'grass') {
            if (this.inv[this.hand].name == 'Hoe') {
                hoe_sound.play();
                this.under_tile = new_tile_from_num(3, this.under_tile.pos.x, this.under_tile.pos.y);
            }
        }
        else if (this.under_tile.name == 'sprinkler'){
            if (this.inv[this.hand].name == 'Shovel'){
                if(checkForSpace(this, 12)){
                    addItem(this, 12, 1);
                    this.under_tile = new_tile_from_num(2, this.under_tile.pos.x, this.under_tile.pos.y);
                }
            }
        }
        else if (this.under_tile.name == 'plot') {
            if (this.inv[this.hand].class == 'Seed') {
                this.under_tile = new_tile_from_num(this.inv[this.hand].plant_num, this.under_tile.pos.x, this.under_tile.pos.y);
                this.inv[this.hand].amount -= 1;
                if (this.inv[this.hand].amount == 0) {
                    this.inv[this.hand] = 0;
                }
            }
        }
        else if (this.under_tile.name == 'compost_bucket') {
            if (this.inv[this.hand].name == 'Junk' || this.inv[this.hand].class == 'Seed') {
                if(checkForSpace(this, 9)){
                    this.inv[this.hand].amount -= 1;
                    if (this.inv[this.hand].amount == 0) {
                        this.inv[this.hand] = 0;
                    }
                    addItem(this, 9, 1);
                }
            }
        }
        else if (this.under_tile.name == 'Veggie_Press') {
            if (this.inv[this.hand].class == 'Eat') {
                let outputItem = 31;
                let outputAmount = 1;
                if (this.inv[this.hand].name == 'Hemp Flower') outputItem = 47;
                else if (['Strawberries', 'Tomato', 'Watermelon'].includes(this.inv[this.hand].name)) outputItem = 48;
                else if (this.inv[this.hand].name == 'Pumpkin') outputAmount = 2;
                if(checkForSpace(this, outputItem)){
                    this.inv[this.hand].amount -= 1;
                    if (this.inv[this.hand].amount == 0) {
                        this.inv[this.hand] = 0;
                    }
                    addItem(this, outputItem, outputAmount);
                }
            }
        }
        else if (this.under_tile.name == 'grinder') {
            const held = this.inv[this.hand];
            if (held && held != 0 && held.class == 'Eat' && held.seed_num) {
                const itemDefinition = all_items[item_name_to_num(held.name)] || {};
                const seedMin = (itemDefinition.seed_min || 1) + 1;
                const seedMax = (itemDefinition.seed_max || 3) + 2;
                if(checkForSpace(this, held.seed_num)){
                    const seedAmount = floor(random(seedMin, seedMax + 1));
                    held.amount -= 1;
                    if (held.amount == 0) this.inv[this.hand] = 0;
                    addItem(this, held.seed_num, seedAmount);
                }
            }
        }
        else if (this.under_tile.name == 'junk') {
            if(checkForSpace(this, 4)){
                addItem(this, 4, 1);
                this.under_tile = new_tile_from_num(3, this.under_tile.pos.x, this.under_tile.pos.y);
            }
        }
    }

    load(obj){
        this.age = obj.age;
        this.hand = obj.hand;
        this.under_tile = new_tile_from_num(tile_name_to_num(obj.under_tile.name), obj.under_tile.pos.x, obj.under_tile.pos.y);
        this.under_tile.load(obj.under_tile);
        this.anim = obj.anim;
        this.facing = obj.facing;
        this.moving_timer = obj.moving_timer;
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
