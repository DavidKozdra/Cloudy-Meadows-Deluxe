class Tile {
    constructor(name, png, x, y, collide, age, under_tile_num) {
        this.name = name;
        this.png = png;
        this.pos = createVector(x, y);
        this.collide = collide;
        this.age = age;
        this.playerOwned = false;
        // Remember what the sprinkler should render underneath if no under_tile object is present (helps after save/load or bad placement)
        this.last_under_png = undefined;
        this.last_under_variant = 0;
        // Default variant selection
        this.variant = round(random(0, all_imgs[this.png].length-1));
        // For park grass, avoid the leaf variant by default; it will be set contextually
        if (this.name === 'park_grass' && all_imgs[this.png].length > 1) {
            this.variant = round(random(0, all_imgs[this.png].length-2));
        }
        this.class = "Tile";
        // Only create under_tile for specific tiles that should have one (wall, bed, etc.)
        // Not for base tiles like grass, concrete, plot to avoid infinite recursion
        if((this.name == 'wall' || this.name == 'bed') && under_tile_num != 0 && under_tile_num != undefined){
            this.under_tile = new_tile_from_num(under_tile_num, this.pos.x, this.pos.y);
        }
        else{
            this.under_tile = 0;
        }
    }

    render() {
        push()
        imageMode(CENTER);
        if (this.name == 'bed' || this.name == 'lamppost' || this.name == 'compost_bucket' || this.name == 'cart_s' || this.name == "bush" || this.name == 'Veggie_Press' || this.name == 'table' || this.name == 'grinder' || this.name == 'computer' || this.name == 'Job Board') {
            image(all_imgs[0][0], this.pos.x + (tileSize / 2), this.pos.y + (tileSize / 2)); //concrete under
        }
        if (this.name == 'sprinkler'){
            // Use the tile underneath the sprinkler; if missing, fall back to the last known base or tilled soil
            let basePng = null;
            let baseVariant = 0;
            if(this.under_tile && typeof this.under_tile === 'object'){
                basePng = this.under_tile.png;
                baseVariant = this.under_tile.variant;
                this.last_under_png = basePng; // remember for later loads without under_tile
                this.last_under_variant = baseVariant; // remember variant too
            }
            else if(this.last_under_png !== undefined){
                basePng = this.last_under_png;
                baseVariant = this.last_under_variant !== undefined ? this.last_under_variant : 0;
            }
            else{
                basePng = 2; // tilled soil (plot) as a safe default instead of empty/grass
                baseVariant = 0;
            }
            image(all_imgs[basePng][baseVariant], this.pos.x + (tileSize / 2), this.pos.y + (tileSize / 2));
        }
        if (this.name == 'Flower_Done'){
            image(all_imgs[1][0], this.pos.x + (tileSize / 2), this.pos.y + (tileSize / 2)); //grass under
        }
        if (this.name == 'junk') {
            image(all_imgs[2][0], this.pos.x + (tileSize / 2), this.pos.y + (tileSize / 2)); //plot under
        }
        if (this.name == 'compost_tile') {
            image(all_imgs[3][0], this.pos.x + (tileSize / 2), this.pos.y + (tileSize / 2)); //dirt under
        }
        if (this.name == 'hori_fence' || this.name == 'vert_fence' || this.name == 'top_right_corner_fence' || this.name == 'bottom_right_corner_fence' || this.name == 'top_left_corner_fence' || this.name == 'bottom_left_corner_fence') {
            image(all_imgs[94][0], this.pos.x + (tileSize / 2), this.pos.y + (tileSize / 2)); //park grass under
        }
        // Safety check: ensure the image exists before rendering
        if (!all_imgs[this.png] || !all_imgs[this.png][this.variant]) {
            console.warn('Missing image for tile:', this.name, 'png:', this.png, 'variant:', this.variant);
            pop();
            return;
        }
        image(all_imgs[this.png][this.variant], this.pos.x + (tileSize / 2), this.pos.y + (tileSize / 2));
        pop()
        if (!all_imgs[this.png] || !all_imgs[this.png][this.variant]) return;
        if(paused){
            all_imgs[this.png][this.variant].pause();
        }
        else{
            all_imgs[this.png][this.variant].play();
        }
    }

    getReadyForSave(){
        if(this.touching != null && this.touching != undefined){
            this.touching = 0;
        }
        if(this.under_tile != null && this.under_tile != undefined && this.under_tile != 0){
            this.under_tile.getReadyForSave();
        }
    }

    load(obj){
        this.age = obj.age;
        this.variant = obj.variant;
        if(typeof obj.playerOwned === 'boolean'){
            this.playerOwned = obj.playerOwned;
        }
        if(obj.under_tile && obj.under_tile !== 0){
            this.under_tile = new_tile_from_num(tile_name_to_num(obj.under_tile.name), obj.under_tile.pos.x, obj.under_tile.pos.y);
            if(this.name === 'sprinkler'){
                this.last_under_png = this.under_tile.png;
                this.last_under_variant = this.under_tile.variant;
            }
        }
        else if(this.name === 'sprinkler' && obj.last_under_png !== undefined){
            this.last_under_png = obj.last_under_png;
            this.last_under_variant = obj.last_under_variant !== undefined ? obj.last_under_variant : 0;
        }
    }
};
