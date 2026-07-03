class FarmRobot extends GridMoveEntity {
    constructor(name, png, x, y, instructions, moving_timer) {
        super(name, png, x, y, [0, 0, 0, 0], 0, 2, 1, instructions, moving_timer);
        this.class = 'FarmRobot';
        this.collide = true;
        this.task_label = 'ONLINE';
    }

    render() {
        push();
        imageMode(CENTER);
        if (this.under_tile != 0) {
            this.under_tile.render();
        }
        image(all_imgs[this.png][this.facing][0], this.pos.x + (tileSize / 2), this.pos.y + (tileSize / 2));

        // "FARM BOT" label above
        noStroke();
        fill(50, 200, 50);
        textFont(player_2);
        textSize(7);
        textAlign(CENTER);
        const stored = this.inv.reduce((sum, item) => sum + (item && item !== 0 ? item.amount : 0), 0);
        const botName = this.name.replace(/Bot$/, ' BOT').toUpperCase();
        text(botName + (stored ? ' [' + stored + ']' : ''), this.pos.x + tileSize / 2, this.pos.y - 2);
        fill(190, 255, 190);
        textSize(5);
        text(this.task_label, this.pos.x + tileSize / 2, this.pos.y - 9);
        textAlign(LEFT);
        pop();
    }

    move(x, y) {
        this.moving_timer -= 1;
        if (player && player.touching && player.touching.name == 'bed') {
            this.moving_timer -= 2;
        }
        if (this.moving_timer <= 0 && this.move_bool && this.instructions.length) {
            const cmd = this.instructions[this.current_instruction];
            let completed = false;
            let attempted = false;
            if (cmd == 'up') {
                this.facing = 0;
                if (this.pos.y - tileSize >= 0) {
                    const look = this.looking(x, y);
                    if (look !== 0 && look && look.collide !== true) {
                        let temp = this;
                        levels[y][x].map[this.pos.y / tileSize][this.pos.x / tileSize] = this.under_tile;
                        temp.under_tile = levels[y][x].map[(this.pos.y / tileSize) - 1][this.pos.x / tileSize];
                        levels[y][x].map[(this.pos.y / tileSize) - 1][this.pos.x / tileSize] = temp;
                        this.pos.y -= tileSize;
                        completed = true;
                        this.task_label = 'MOVING';
                    }
                }
            } else if (cmd == 'down') {
                this.facing = 2;
                if (this.pos.y + tileSize < canvasHeight) {
                    const look = this.looking(x, y);
                    if (look !== 0 && look && look.collide !== true) {
                        let temp = this;
                        levels[y][x].map[this.pos.y / tileSize][this.pos.x / tileSize] = this.under_tile;
                        temp.under_tile = levels[y][x].map[(this.pos.y / tileSize) + 1][this.pos.x / tileSize];
                        levels[y][x].map[(this.pos.y / tileSize) + 1][this.pos.x / tileSize] = temp;
                        this.pos.y += tileSize;
                        completed = true;
                        this.task_label = 'MOVING';
                    }
                }
            } else if (cmd == 'left') {
                this.facing = 3;
                if (this.pos.x - tileSize >= 0) {
                    const look = this.looking(x, y);
                    if (look !== 0 && look && look.collide !== true) {
                        let temp = this;
                        levels[y][x].map[this.pos.y / tileSize][this.pos.x / tileSize] = this.under_tile;
                        temp.under_tile = levels[y][x].map[this.pos.y / tileSize][(this.pos.x / tileSize) - 1];
                        levels[y][x].map[this.pos.y / tileSize][(this.pos.x / tileSize) - 1] = temp;
                        this.pos.x -= tileSize;
                        completed = true;
                        this.task_label = 'MOVING';
                    }
                }
            } else if (cmd == 'right') {
                this.facing = 1;
                if (this.pos.x + tileSize < canvasWidth) {
                    const look = this.looking(x, y);
                    if (look !== 0 && look && look.collide !== true) {
                        let temp = this;
                        levels[y][x].map[this.pos.y / tileSize][this.pos.x / tileSize] = this.under_tile;
                        temp.under_tile = levels[y][x].map[this.pos.y / tileSize][(this.pos.x / tileSize) + 1];
                        levels[y][x].map[this.pos.y / tileSize][(this.pos.x / tileSize) + 1] = temp;
                        this.pos.x += tileSize;
                        completed = true;
                        this.task_label = 'MOVING';
                    }
                }
            } else if (cmd == 'harvest') {
                // An action is a single attempt. Waiting on an unripe crop must
                // not pin the instruction pointer and deadlock the patrol route.
                attempted = true;
                const look = this.looking(x, y);
                if (look && look.class == 'Plant' && look.age == all_imgs[look.png].length - 2 && checkForSpace(this, look.eat_num)) {
                    const cropTileNum = tile_name_to_num(look.name);
                    const baseYield = typeof look.getHarvestYield === 'function' ? look.getHarvestYield() : 1;
                    addItem(this, look.eat_num, baseYield + levels[y][x].ladybugs);
                    // Specialized showcase harvesters include an integrated seed
                    // hopper, so harvested beds are immediately replanted.
                    levels[y][x].map[look.pos.y / tileSize][look.pos.x / tileSize] = new_tile_from_num(cropTileNum, look.pos.x, look.pos.y);
                    if (typeof PlantingSound !== 'undefined') PlantingSound.play();
                    completed = true;
                    this.task_label = 'HARVESTED';
                } else if (look && look.class == 'Plant' && look.age != all_imgs[look.png].length - 2) {
                    this.task_label = 'CROP GROWING';
                } else if (look && look.class == 'Plant') {
                    this.task_label = 'STORAGE FULL';
                } else {
                    this.task_label = 'SCANNING';
                }
            } else if (cmd == 'water') {
                attempted = true;
                const look = this.looking(x, y);
                if (look && look.class == 'Plant') {
                    look.wateredDay = days;
                    completed = true;
                    this.task_label = 'WATERED';
                } else {
                    this.task_label = 'SCANNING';
                }
            } else {
                // A bad showcase program should remain observable instead of
                // locking the bot forever on an unknown instruction.
                attempted = true;
                this.task_label = 'PROGRAM ERROR';
            }

            if (!completed && !attempted) this.task_label = 'ROUTE BLOCKED';
            if (completed || attempted) {
                this.current_instruction = (this.current_instruction + 1) % this.instructions.length;
            }
            this.moving_timer = this.max_moving_timer;
        }
    }

    load(obj) {
        this.age = obj.age;
        this.hand = obj.hand;
        this.under_tile = new_tile_from_num(tile_name_to_num(obj.under_tile.name), obj.under_tile.pos.x, obj.under_tile.pos.y);
        this.under_tile.load(obj.under_tile);
        this.anim = obj.anim;
        this.facing = obj.facing;
        this.moving_timer = obj.moving_timer;
        this.instructions = obj.instructions;
        this.current_instruction = obj.current_instruction;
        this.move_bool = obj.move_bool;
        if (typeof obj.playerOwned === 'boolean') this.playerOwned = obj.playerOwned;
        for(let i = 0; i < (obj.inv || []).length; i++){
            this.inv[i] = obj.inv[i] && obj.inv[i] !== 0
                ? new_item_from_num(item_name_to_num(obj.inv[i].name), obj.inv[i].amount)
                : 0;
        }
    }
}
