class Item {
	constructor(name, amount = 0, png, price = 0) {
		this.name = name;
		this.amount = amount;
		this.png = png;
		this.price = price;
		this.class = 'Item';
	}

	static get SIZE() { return 64; } // Item icon size
	static get HALF_SIZE() { return 32; }
	static get TOOLTIP_OFFSET() { return 7; }
	static get TOOLTIP_CHAR_WIDTH_SHORT() { return 6; }
	static get TOOLTIP_CHAR_WIDTH_LONG() { return 8; }
	
	// Check if mouse is hovering over item at position
	static isMouseOver(x, y) {
		return mouseX >= x && mouseX <= x + Item.SIZE && 
		       mouseY >= y && mouseY <= y + Item.SIZE;
	}

	render(x, y) {
		push();
		image(all_imgs[this.png], x, y);
		fill(255);
		let amountS = str(this.amount)
		textSize(20 - ((amountS.length-1)*5));
		if(amountS.length > 3){
			amountS = (round(this.amount/100)/10)+'K';
			textSize(20 - ((amountS.length-2)*4));
		}
		textAlign(CENTER, CENTER);
		textFont(player_2);
		stroke(0)
		strokeWeight(1);
		
		// Render amount in bottom-right corner
		text(amountS, x + Item.SIZE - Item.HALF_SIZE/2.5 - (amountS.length*2), 
		     y + Item.SIZE - Item.HALF_SIZE/2.5 + (amountS.length));

		// Show tooltip on hover
		if(Item.isMouseOver(x, y)){
			fill(0);
			const nameStr = str(this.name);
			const tooltipWidth = nameStr.length * (nameStr.length > 5 ? Item.TOOLTIP_CHAR_WIDTH_LONG : Item.TOOLTIP_CHAR_WIDTH_SHORT);
			rectMode(CENTER)
			rect(x + Item.HALF_SIZE, y - Item.TOOLTIP_OFFSET, tooltipWidth, Item.TOOLTIP_OFFSET);
			textSize(8);
			textFont(player_2);
			fill(255);
			text(this.name, x + Item.HALF_SIZE, y - Item.TOOLTIP_OFFSET);
		}

		pop();
	}
}

class Seed extends Item {
	constructor(name, amount, png, plant_num, price=1) {
		super(name, amount, png, price);
		this.class = "Seed";
		this.plant_num = plant_num;
	}
}

class Eat extends Item {
	constructor(name, amount, png, price, hunger, hunger_timer, seed_num) {
		super(name, amount, png, price);
		this.class = "Eat";
		this.hunger = hunger;
		this.hunger_timer = hunger_timer;
		this.seed_num = seed_num;
	}
}

class Tool extends Item {
	constructor(name, amount, png) {
		super(name, amount, png, 0);
		this.class = "Tool";
	}
}

class Placeable extends Item {
	constructor(name, amount, png, price, tile_num, tile_need_num) {
		super(name, amount, png, price);
		this.class = "Placeable";
		this.tile_num = tile_num;
		this.tile_need_num = tile_need_num;
	}
}

class Command extends Item {
	constructor(name, amount, png, command){
		super(name, amount, png, 10)
		this.command = command;
		this.class = 'Command';
	}
}

class Backpack extends Item {
	constructor(name, amount, png, inv){
		super(name, amount, png, 0)
		this.inv = JSON.parse(JSON.stringify(inv));
		for (let i = 0; i < this.inv.length; i++) {
            if (this.inv[i] != 0) {
                this.inv[i] = new_item_from_num(this.inv[i].num, this.inv[i].amount);
            }
        }
		this.inv = [[this.inv[0], this.inv[1], this.inv[2], this.inv[3]], [this.inv[4], this.inv[5], this.inv[6], this.inv[7]], [this.inv[8], this.inv[9], this.inv[10], this.inv[11]]];
		this.class = 'Backpack';
	}

	bag_render(){
        // On mobile, use the DOM-based inventory UI
        if (typeof isMobile !== 'undefined' && isMobile && typeof openMobileInventory === 'function') {
            if (typeof mobileInventoryState !== 'undefined' && !mobileInventoryState.isOpen) {
                openMobileInventory('Backpack', this);
            }
            return; // Don't render p5 UI on mobile
        }
        
        const chest = UI_BOUNDS.chestGrid;
        const cellSize = chest.cellSize;
        const gridLeft = (canvasWidth/4) + 10;
        const gridTop = (canvasHeight/4) + 40;
        
        push()
        stroke(149, 108, 65);
        strokeWeight(5);
        fill(187, 132, 75);
        rect(canvasWidth/4, canvasHeight/4, canvasWidth/2, canvasHeight/2);
        textFont(player_2);
        textSize(15);
        fill(255);
        stroke(0);
        strokeWeight(4);
        text(this.name, (canvasWidth / 4) + 10, (canvasHeight/4) + 10);
        textSize(13);
        strokeWeight(2);
        text(String.fromCharCode(eat_button) +' to leave', ((2*canvasWidth) / 4) + 45, (canvasHeight/4) + 10);
        stroke(255, 255, 0);
        strokeWeight(5);
        fill(149, 108, 65);
        for(let i = 0; i < this.inv.length; i++){
            for(let j = 0; j < this.inv[i].length; j++){
                rect(gridLeft + (j * cellSize), gridTop + (i * cellSize), 74, 74)
                if(this.inv[i][j] != 0){
                    this.inv[i][j].render(gridLeft + (j * cellSize) + 5, gridTop + (i * cellSize) + 10);
                }
            }
        }
        pop()
    }

	load(obj){
		for(let i = 0; i < obj.inv.length; i++){
			for(let j = 0; j < obj.inv[i].length; j++){
				if(obj.inv[i][j] != 0 && this.inv[i][j] != 0){
					this.inv[i][j] = new_item_from_num(item_name_to_num(obj.inv[i][j].name), obj.inv[i][j].amount);
				}
				else if (obj.inv[i][j] != 0 && this.inv[i][j] == 0){
					this.inv[i][j] = new_item_from_num(item_name_to_num(obj.inv[i][j].name), obj.inv[i][j].amount);
				}
				else if (obj.inv[i][j] == 0 && this.inv[i][j] != 0){
					this.inv[i][j] = 0;
				}
			}
		}
	}
}