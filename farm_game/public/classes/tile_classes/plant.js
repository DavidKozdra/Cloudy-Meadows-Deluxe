
class Plant extends Tile {
    constructor(name, png, x, y, collide, eat_num, waterneeded, growthTime) {
        super(name, png, x, y, collide, 0);
        this.eat_num = eat_num;
        this.waterneeded = waterneeded;
        this.watermet = false;
        this.waterChecked = false; // Track if we've checked water at least once
        this.deathAttempts = 3;
        this.growTimer = 0;
        this.growthTime = growthTime;
        this.class = 'Plant';

    }


    render() {
        push();
        imageMode(CENTER);
        if(this.waterneeded > 0 && this.watermet){
            // Has water - show water overlay
            image(all_imgs[93][0], this.pos.x + (tileSize / 2), this.pos.y + (tileSize / 2));
        }
        else{
            image(all_imgs[2][0], this.pos.x + (tileSize / 2), this.pos.y + (tileSize / 2));
        }
        
        // Draw plant with drought tint if it needs water but doesn't have it
        if(this.waterneeded > 0 && !this.watermet){
            tint(100, 30, 30); // Darker red for drought
        }
        image(all_imgs[this.png][this.age], this.pos.x + (tileSize / 2), this.pos.y + (tileSize / 2));
        noTint();
        
        // Draw sprinkler icon with red X when water is NOT met
        if(this.waterneeded > 0 && !this.watermet && this.waterChecked){
            // Draw sprinkler icon
            fill(100, 150, 200);
            noStroke();
            circle(this.pos.x + (tileSize / 2), this.pos.y - 8, 6);
            circle(this.pos.x + (tileSize / 2) - 5, this.pos.y - 2, 3);
            circle(this.pos.x + (tileSize / 2) + 5, this.pos.y - 2, 3);
            
            // Draw red X through it
            image(x_img, this.pos.x + (tileSize / 2), this.pos.y - (tileSize / 4));
        }
        
        if(this.age == all_imgs[this.png].length - 2){
            image(done_dot, this.pos.x + (tileSize/2), this.pos.y - (tileSize/4));
        }
        pop();
    }

    grow(x, y) {
        this.growTimer++;
        
        // Apply weather modifiers to growth rate
        if (typeof currentWeather !== 'undefined') {
            if (currentWeather === 'rain') {
                // Rain makes plants grow faster (80 ticks instead of 100)
                this.growTimer += 0.25;
            } else if (currentWeather === 'overcast') {
                // Overcast makes plants grow slower (125 ticks instead of 100)
                this.growTimer -= 0.2;
            }
            // Clear weather has no modifier (normal growth)
        }
        
        // Bonus growth rate when planted on beds
        if (player && player.touching && player.touching.name == 'bed') {
            this.growTimer += 2;
        }
        
        // Check for water every frame so texture updates immediately
        let water_found = 0;
        const plant_grid_x = this.pos.x / tileSize;
        const plant_grid_y = this.pos.y / tileSize;
        
        // Check 3x3 area around plant for sprinklers with bounds checking
        for(let i = -1; i <= 1; i++){
            for(let j = -1; j <= 1; j++){
                const check_y = plant_grid_y + i;
                const check_x = plant_grid_x + j;
                
                // Bounds check
                if(check_y < 0 || check_y >= levels[y][x].map.length || 
                   check_x < 0 || check_x >= levels[y][x].map[0].length) {
                    continue;
                }
                
                const tile = levels[y][x].map[check_y][check_x];
                if(tile && tile.name == 'sprinkler'){
                    water_found += 1;
                }
                else if(tile && tile.under_tile && typeof tile.under_tile === 'object' && tile.under_tile.name == 'sprinkler'){
                    water_found += 1;
                }
            }
        }
        
        this.watermet = (water_found >= this.waterneeded);
        this.waterChecked = true; // Mark that we've checked water at least once
        
        // Only grow when it's time to grow
        if (this.growTimer >= this.growthTime) {
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