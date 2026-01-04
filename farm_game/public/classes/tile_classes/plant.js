class Plant extends Tile {
    constructor(name, png, x, y, collide, eat_num, waterneeded, growthTime) {
        super(name, png, x, y, collide, 0);
        this.eat_num = eat_num;
        this.waterneeded = waterneeded;
        this.watermet = false;
        this.deathAttempts = 3;
        this.growTimer = 0;
        this.growthTime = growthTime;
        this.class = 'Plant';
    }


    render() {
        push();
        imageMode(CENTER);
        if(this.waterneeded > 0 && this.watermet){
            image(all_imgs[93][0], this.pos.x + (tileSize / 2), this.pos.y + (tileSize / 2));
        }
        else{
            image(all_imgs[2][0], this.pos.x + (tileSize / 2), this.pos.y + (tileSize / 2));
        }
        image(all_imgs[this.png][this.age], this.pos.x + (tileSize / 2), this.pos.y + (tileSize / 2));
        if(this.age == all_imgs[this.png].length - 2){
            image(done_dot, this.pos.x + (tileSize/2), this.pos.y - (tileSize/4));
        }
        pop();
    }

    grow(x, y) {
        this.growTimer++;
        // Bonus growth rate when planted on beds
        if (player && player.touching && player.touching.name == 'bed') {
            this.growTimer += 2;
        }
        
        // Only check for water when it's time to grow to avoid unnecessary iteration
        if (this.growTimer >= this.growthTime) {
            let water_found = 0;
            const plant_grid_x = this.pos.x / tileSize;
            const plant_grid_y = this.pos.y / tileSize;
            
            // Check 3x3 area around plant for sprinklers with bounds checking
            for(let i = -1; i <= 1; i++){
                for(let j = -1; j <= 1; j++){
                    const check_y = plant_grid_y + i;
                    const check_x = plant_grid_x + j;
                    
                    // Bounds check
                    if(check_y < 0 || check_y >= levels[y].map.length || 
                       check_x < 0 || check_x >= levels[y].map[0].length) {
                        continue;
                    }
                    
                    const tile = levels[y][x].map[check_y][check_x];
                    if(tile && tile.name == 'sprinkler'){
                        water_found += 1;
                    }
                    else if(tile && tile.under_tile != undefined && tile.under_tile.name == 'sprinkler'){
                        water_found += 1;
                    }
                }
            }
            
            this.watermet = (water_found >= this.waterneeded);
            
            if (this.watermet) {
                this.age += 1;
                
                // Carrot special mutation case
                if(this.name == 'carrot' && this.age == all_imgs[this.png].length - 2){
                    let rand = random(0, 100);
                    if(rand <= 0.1){
                        levels[y][x].map[plant_grid_y][plant_grid_x] = new_tile_from_num(91, this.pos.x, this.pos.y);
                    }
                }
                
                // Plant overcrowding - cap age and start losing attempts
                if (this.age > all_imgs[this.png].length - 2 && this.deathAttempts > 0) {
                    this.age = all_imgs[this.png].length - 2;
                    this.deathAttempts -= 1;
                }
                
                // Plant died from overcrowding (stayed ripe too long without harvest)
                if (this.age > all_imgs[this.png].length - 1 && this.deathAttempts <= 0) {
                    this.age = all_imgs[this.png].length - 1;
                    levels[y][x].map[plant_grid_y][plant_grid_x] = new_tile_from_num(5, this.pos.x, this.pos.y);
                }
            }
            else {
                // No water - lose an attempt
                this.deathAttempts -= 1;
                if (this.deathAttempts <= 0) {
                    // Plant died from lack of water
                    this.age = Math.min(all_imgs[this.png].length - 1, this.age);
                    levels[y][x].map[plant_grid_y][plant_grid_x] = new_tile_from_num(5, this.pos.x, this.pos.y);
                }
            }
            this.growTimer = 0;
        }
    }

    load(obj){
        this.age = obj.age;
        this.variant = obj.variant;
        this.watermet = obj.watermet;
        this.deathAttempts = obj.deathAttempts;
        this.growTimer = obj.growTimer;
    }
}