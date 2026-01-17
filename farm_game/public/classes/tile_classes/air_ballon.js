class AirBallon extends Entity {
	constructor(name, png, x, y, under_tile) {
		super(name, png, x, y, -1, [], 0, under_tile);
        this.places = ['Poly Park', 'Swiggy Swamps', 'Cloudy Meadows'];
        this.class = 'AirBallon';
	}

    render() {
        push()
        imageMode(CENTER);
        this.under_tile.render()
        image(all_imgs[this.png][this.variant], this.pos.x, this.pos.y-(tileSize/2));
        pop()
    }

    tp_render() {
        push()
        stroke(149, 108, 65);
        strokeWeight(5);
        fill(187, 132, 75);
        rect(canvasWidth / 20, canvasHeight - 150, canvasWidth - (canvasWidth/10), 150);
        textFont(player_2);
        textSize(15);
        fill(255);
        stroke(0);
        strokeWeight(4);
        text(this.name, (canvasWidth / 20) + 10, canvasHeight - 140);
        strokeWeight(2);
        text(String.fromCharCode(eat_button) + ' to leave', ((3*canvasWidth) / 4)- 10, canvasHeight - 140);
        textAlign(CENTER, TOP);
        text('Where to?', (canvasWidth / 2), canvasHeight - 140);
        
        // Filter out current location and disabled areas from the list
        const currentLocationName = levels[currentLevel_y][currentLevel_x].name;
        this.availablePlaces = this.places.filter(place => {
            // Check if the place name is in the current level name
            if (currentLocationName.includes(place)) {
                return false;
            }
            // Check if area is blocked in custom rules
            if (typeof window !== 'undefined' && window.blockedAreas && window.blockedAreas[place]) {
                return false;
            }
            return true;
        });
        
        const maxLen = this.availablePlaces.reduce((m,p)=>Math.max(m, (p ? p.length : 0)), 10);
        for(let i = 0; i < this.availablePlaces.length; i++){
            fill(149, 108, 65)
            rectMode(CENTER)
            rect((canvasWidth / 2), (canvasHeight - 110) + (i * 32) + 8 + 8, maxLen*18, 25)
            if(current_reply == i){
                fill(255, 255, 0);
            }
            else{
                fill(255);
            }
            text(this.availablePlaces[i], (canvasWidth / 2), (canvasHeight - 110) + (i * 32) + 8);
        }
        pop()
    }

    load(obj){
        this.age = obj.age;
        this.hand = obj.hand;
        this.under_tile = new_tile_from_num(tile_name_to_num(obj.under_tile.name), obj.under_tile.pos.x, obj.under_tile.pos.y);
        this.under_tile.load(obj.under_tile);
    }
}