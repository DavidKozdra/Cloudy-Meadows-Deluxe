class FarmRobot extends GridMoveEntity {
    constructor(name, png, x, y, instructions, moving_timer) {
        super(name, png, x, y, [], 0, 2, 1, instructions, moving_timer);
        this.class = 'FarmRobot';
        this.collide = true;
        this.task_label = '';
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
        text('FARM BOT', this.pos.x + tileSize / 2, this.pos.y - 2);
        textAlign(LEFT);
        pop();
    }

    move(x, y) {
        this.moving_timer -= 1;
        if (player.touching.name == 'bed') {
            this.moving_timer -= 2;
        }
        if (this.moving_timer <= 0) {
            const cmd = this.instructions[this.current_instruction];
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
                    }
                }
            } else if (cmd == 'harvest') {
                // Harvest any ripe plant in front
                const look = this.looking(x, y);
                if (look && look.class == 'Plant' && look.age == all_imgs[look.png].length - 2) {
                    levels[y][x].map[look.pos.y / tileSize][look.pos.x / tileSize] = new_tile_from_num(3, look.pos.x, look.pos.y);
                    if (typeof PlantingSound !== 'undefined') PlantingSound.play();
                }
            } else if (cmd == 'water') {
                // Water the plot in front
                const look = this.looking(x, y);
                if (look && look.class == 'Plant') {
                    look.waterneed = 0;
                }
            }

            this.current_instruction = (this.current_instruction + 1) % this.instructions.length;
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
    }
}
