class Chest extends Entity{
    constructor(name, png, x, y, inv, under_tile_num){
        super(name, png, x, y, -1, inv, 0, under_tile_num);
        this.inv = [[this.inv[0], this.inv[1], this.inv[2], this.inv[3]], [this.inv[4], this.inv[5], this.inv[6], this.inv[7]], [this.inv[8], this.inv[9], this.inv[10], this.inv[11]]];
        this.class = 'Chest';
    }

    chest_render(){
        // On mobile, use the DOM-based inventory UI
        if (typeof isMobile !== 'undefined' && isMobile && typeof openMobileInventory === 'function') {
            if (typeof mobileInventoryState !== 'undefined' && !mobileInventoryState.isOpen) {
                openMobileInventory('Chest', this);
            }
            return; // Don't render p5 UI on mobile
        }
        
        if (this.playerOwned) robotBoomButton.show();
        else robotBoomButton.hide();
        robotBoomButton.style('background-color','rgb(187, 132, 75)');
        robotBoomButton.style('color','rgb(255, 0, 0)');
        robotBoomButton.position((canvasWidth/4) + (canvasWidth/2) + 10, (canvasHeight/4) - 35);
        push()
        stroke(149, 108, 65);
        strokeWeight(5);
        fill(187, 132, 75);
        const panelLeft = canvasWidth / 4;
        const panelTop = canvasHeight / 4;
        const panelWidth = canvasWidth / 2;
        rect(panelLeft, panelTop, panelWidth, canvasHeight/2);
        textFont(player_2);
        fill(255);
        stroke(0);
        const headerLeft = panelLeft + 10;
        const headerRight = panelLeft + panelWidth - 10;
        const headerWidth = headerRight - headerLeft;
        const titleText = String(this.name || 'Chest');
        const statusText = this.playerOwned ? '' : 'VIEW ONLY';
        const leaveText = String.fromCharCode(eat_button) + ' ' + t('to leave');
        const headerGap = 14;

        textSize(15);
        const titleWidth = textWidth(titleText);
        textSize(13);
        const statusWidth = statusText ? textWidth(statusText) : 0;
        const leaveWidth = textWidth(leaveText);
        const requiredWidth = titleWidth + leaveWidth + headerGap +
            (statusText ? statusWidth + headerGap : 0);

        textAlign(LEFT, TOP);
        if (requiredWidth <= headerWidth) {
            strokeWeight(4);
            textSize(15);
            text(t(titleText), headerLeft, panelTop + 8);

            if (statusText) {
                textSize(13);
                strokeWeight(2);
                text(t(statusText), headerLeft + titleWidth + headerGap, panelTop + 9);
            }

            textAlign(RIGHT, TOP);
            textSize(13);
            strokeWeight(2);
            text(leaveText, headerRight, panelTop + 9);
        } else {
            // Narrow canvases get two rows so every label remains readable.
            const topRowGap = statusText ? 10 : 0;
            const topRowWidth = titleWidth + statusWidth + topRowGap;
            const scale = Math.min(1, headerWidth / Math.max(topRowWidth, 1));
            const titleSize = Math.max(10, Math.floor(15 * scale));
            const statusSize = Math.max(9, Math.floor(13 * scale));

            strokeWeight(3);
            textSize(titleSize);
            text(t(titleText), headerLeft, panelTop + 5);

            if (statusText) {
                textAlign(RIGHT, TOP);
                textSize(statusSize);
                strokeWeight(2);
                text(t(statusText), headerRight, panelTop + 6);
            }

            textAlign(RIGHT, TOP);
            textSize(11);
            strokeWeight(2);
            text(leaveText, headerRight, panelTop + 23);
        }
        stroke(255, 255, 0);
        strokeWeight(5);
        fill(149, 108, 65);
        for(let i = 0; i < this.inv.length; i++){
            for(let j = 0; j < this.inv[i].length; j++){
                rect((canvasWidth/4)+10+(j*90), (canvasHeight/4)+40+(i*90), 74, 74)
                if(this.inv[i][j] != 0){
                    this.inv[i][j].render((j * 90)+(canvasWidth/4)+15, (i * 90)+(canvasWidth/4)+10);
                }
            }
        }
        pop()
    }

    load(obj){
        this.age = obj.age;
        this.hand = obj.hand;
        if (typeof obj.playerOwned === 'boolean') {
            this.playerOwned = obj.playerOwned;
        }
        this.under_tile = new_tile_from_num(tile_name_to_num(obj.under_tile.name), obj.under_tile.pos.x, obj.under_tile.pos.y);
        this.under_tile.load(obj.under_tile);
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
