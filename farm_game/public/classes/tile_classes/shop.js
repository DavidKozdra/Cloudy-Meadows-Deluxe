class Shop extends Entity {
	constructor(name, png, x, y, inv, under_tile) {
		super(name, png, x, y, -1, inv, 0, under_tile);
        // Store original item prices from item definitions
        this.originalPrices = [];
        this.itemsSold = {}; // Track items sold each market cycle
        this.lastMarketUpdate = days || 0; // Track when market last updated
        
        for(let i = 0; i < this.inv.length; i++){
            if(this.inv[i] != 0) {
                this.originalPrices[i] = this.inv[i].price;
                this.itemsSold[this.inv[i].name] = 0;
            }
        }
        this.class = 'Shop';
	}

    getBuyPrice(itemName) {
        // Price player pays to buy from shop (25% markup on BASE price)
        for(let i = 0; i < this.inv.length; i++){
            if(this.inv[i] != 0 && this.inv[i].name == itemName){
                let basePrice = this.originalPrices[i] || this.inv[i].price;
                return round(basePrice * 1.25);
            }
        }
        return 0;
    }

    getSellPrice(itemName) {
        // Price player gets for selling to shop (25% discount on BASE price)
        for(let i = 0; i < this.inv.length; i++){
            if(this.inv[i] != 0 && this.inv[i].name == itemName){
                let basePrice = this.originalPrices[i] || this.inv[i].price;
                return round(basePrice * 0.75);
            }
        }
        return 0;
    }

    render() {
        push()
        imageMode(CENTER);
        this.under_tile.render()
        if(this.name == 'Hotdog Stand'){
            image(all_imgs[this.png][this.variant], this.pos.x + (tileSize / 2)-9, this.pos.y + (tileSize / 2));
        }
        else{
            image(all_imgs[this.png][this.variant], this.pos.x + (tileSize / 2), this.pos.y + (tileSize / 2));
        }
        pop()
    }

    shop_render() {
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
        
        // Show shop name and day-of-week note
        let shopTitle = this.name;
        if(dayOfWeek === 4 && this.name === 'Fruits') {
            shopTitle += " - David's here!";
        }
        text(shopTitle, (canvasWidth / 20) + 10, canvasHeight - 140);
        
        textSize(13);
        strokeWeight(2);
        text(String.fromCharCode(eat_button) + ' to leave', ((3*canvasWidth) / 4) + 10, canvasHeight - 140);
        text('Item,                cost,   quantity in store', (canvasWidth / 20) + 42, canvasHeight - 115);
        if(current_reply < 1 || this.inv.length <= 3){
            for(let i = 0; i < min(this.inv.length, 3); i++){
                const buyPrice = this.getBuyPrice(this.inv[i].name); // Get actual buy price
                if(this.inv[i].amount <= 0){
                    fill(0, 0, 255);
                }
                else{
                    if(player.coins >= buyPrice){
                        fill(0, 255, 0);
                    }
                    else{
                        fill(255, 0, 0)
                    }
                }
                if(current_reply == i){
                    stroke(255);
                }
                else{
                    stroke(0);
                }
                image(all_imgs[this.inv[i].png], (canvasWidth / 20) + 10, (canvasHeight - 100) + (i * 32), 32, 32);
                // Dynamically size item name text based on length
                let itemNameLength = this.inv[i].name.length;
                let itemNameSize = itemNameLength > 20 ? 9 : (itemNameLength > 15 ? 11 : 13);
                textSize(itemNameSize);
                text(this.inv[i].name, (canvasWidth / 20) + 42, (canvasHeight - 100) + (i * 32) + 8);
                // Reset text size for price and amount
                textSize(13);
                text(buyPrice, (canvasWidth / 20) + 332, (canvasHeight - 100) + (i * 32) + 8);
                text(this.inv[i].amount, (canvasWidth / 20) + 492, (canvasHeight - 100) + (i * 32) + 8);
            }
        }
        else{
            for(let i = current_reply - 1; i < min(current_reply + 2, this.inv.length); i++){
                const buyPrice = this.getBuyPrice(this.inv[i].name); // Get actual buy price
                if(this.inv[i].amount <= 0){
                    fill(0, 0, 255);
                }
                else{
                    if(player.coins >= buyPrice){
                        fill(0, 255, 0);
                    }
                    else{
                        fill(255, 0, 0)
                    }
                }
                if(current_reply == i){
                    stroke(255);
                }
                else{
                    stroke(0);
                }
                image(all_imgs[this.inv[i].png], (canvasWidth / 20) + 10, (canvasHeight - 100) + ((i-(current_reply)+1) * 32), 32, 32);
                // Dynamically size item name text based on length
                let itemNameLength = this.inv[i].name.length;
                let itemNameSize = itemNameLength > 20 ? 9 : (itemNameLength > 15 ? 11 : 13);
                textSize(itemNameSize);
                text(this.inv[i].name, (canvasWidth / 20) + 42, (canvasHeight - 100) + ((i-(current_reply)+1) * 32) + 8);
                // Reset text size for price and amount
                textSize(13);
                text(buyPrice, (canvasWidth / 20) + 332, (canvasHeight - 100) + ((i-(current_reply)+1) * 32) + 8);
                text(this.inv[i].amount, (canvasWidth / 20) + 492, (canvasHeight - 100) + ((i-(current_reply)+1) * 32) + 8);
            }
        }
        if(current_reply < this.inv.length - 2){
            image(done_dot, (canvasWidth / 20) + 512, (canvasHeight - 90) + (2 * 32) + 8);
        }
        if(current_reply > this.inv.length-3 && this.inv.length > 3){
            image(up_dot, (canvasWidth / 20) + 512, (canvasHeight - 100));
        }
        pop()
    }

    recalculateItemPrice(itemName) {
        // Recalculate price for ONLY this item based on stock level
        for(let i = 0; i < this.inv.length; i++){
            if(this.inv[i] != 0 && this.inv[i].name == itemName) {
                let basePrice = this.originalPrices[i] || this.inv[i].price;
                let stock = this.inv[i].amount;
                let adjustment = 0;
                
                // Pure supply-based pricing
                if(stock == 0) {
                    adjustment = round(random(8, 12));
                }
                else if(stock < 2) {
                    adjustment = round(random(6, 8));
                }
                else if(stock < 4) {
                    adjustment = round(random(4, 6));
                }
                else if(stock < 8) {
                    adjustment = round(random(2, 4));
                }
                else if(stock < 15) {
                    adjustment = round(random(-1, 1));
                }
                else if(stock < 30) {
                    adjustment = round(random(-3, -1));
                }
                else {
                    adjustment = round(random(-5, -3));
                }
                
                this.inv[i].price = max(1, basePrice + adjustment);
                break;
            }
        }
    }

    recalculatePrices() {
        // Recalculate prices based on current stock levels
        for(let i = 0; i < this.inv.length; i++){
            if(this.inv[i] != 0) {
                let basePrice = this.originalPrices[i] || this.inv[i].price;
                let stock = this.inv[i].amount;
                let adjustment = 0;
                
                // Pure supply-based pricing
                if(stock == 0) {
                    adjustment = round(random(8, 12));
                }
                else if(stock < 2) {
                    adjustment = round(random(6, 8));
                }
                else if(stock < 4) {
                    adjustment = round(random(4, 6));
                }
                else if(stock < 8) {
                    adjustment = round(random(2, 4));
                }
                else if(stock < 15) {
                    adjustment = round(random(-1, 1));
                }
                else if(stock < 30) {
                    adjustment = round(random(-3, -1));
                }
                else {
                    adjustment = round(random(-5, -3));
                }
                
                this.inv[i].price = max(1, basePrice + adjustment);
            }
        }
    }

    isFruit(itemName) {
        // Logic-based fruit detection
        const fruits = ['Strawberries', 'Tomato', 'Watermelon', 'Apple', 'Orange', 'Banana', 'Grape', 'Peach', 'Blueberry'];
        return fruits.includes(itemName);
    }

    daily_update(dayOfWeek = 0, lastRainDay = -999, lastFrogRainDay = -999){
        // Recalculate prices with day/weather modifiers
        this.recalculatePrices();
        
        // Add pumpkin to Veggie store after day 20 (day 20 onwards)
        if(days >= 20 && this.name === 'Vegetables') {
            // Find if pumpkin is already in inventory
            let pumpkinFound = false;
            for(let i = 0; i < this.inv.length; i++){
                if(this.inv[i] != 0 && this.inv[i].name === 'Pumpkin'){
                    pumpkinFound = true;
                    break;
                }
            }
            // If not found, add pumpkin to first empty slot
            if(!pumpkinFound) {
                for(let i = 0; i < this.inv.length; i++){
                    if(this.inv[i] == 0) {
                        this.inv[i] = new_item_from_num(41, 5); // Item 41 is Pumpkin
                        break;
                    }
                }
            }
        }
        
        // Apply day-of-week and weather modifiers
        for(let i = 0; i < this.inv.length; i++){
            if(this.inv[i] != 0) {
                const itemName = this.inv[i].name;
                
                // Fruits half-off on Friday (dayOfWeek == 4, red day)
                if(dayOfWeek === 4 && this.isFruit(itemName)) {
                    this.inv[i].price = round(this.inv[i].price * 0.5);
                }
                
                // Ladybugs and Bees double price for 3 days after frog-rain
                if((itemName === 'Ladybugs' || itemName === 'Bees') && days - lastFrogRainDay < 3) {
                    this.inv[i].price = round(this.inv[i].price * 2.0);
                }
                
                // Sprinklers half-off for 3 days after rain
                if(itemName === 'Sprinkler' && days - lastRainDay < 3) {
                    this.inv[i].price = round(this.inv[i].price * 0.5);
                    // Also increase stock after rain
                    if(days - lastRainDay === 0) { // First day after rain
                        this.inv[i].amount += random(5, 10);
                    }
                }
            }
        }
        
        // Reset sold tracker every 3-4 days
        if(days - this.lastMarketUpdate >= 3 + round(random(0, 1))) {
            this.itemsSold = {};
            for(let i = 0; i < this.inv.length; i++){
                if(this.inv[i] != 0) {
                    this.itemsSold[this.inv[i].name] = 0;
                }
            }
            this.lastMarketUpdate = days;
        }
    }

    recordItemSold(itemName, amount) {
        if(!this.itemsSold[itemName]) {
            this.itemsSold[itemName] = 0;
        }
        this.itemsSold[itemName] += amount;
        
        // Add the sold items to the shop's inventory
        for(let i = 0; i < this.inv.length; i++){
            if(this.inv[i] != 0 && this.inv[i].name == itemName){
                this.inv[i].amount += amount;
                this.recalculateItemPrice(itemName); // Only recalc THIS item
                
                // Dispatch stock change event for real-time updates
                const event = new CustomEvent('stockChange', {
                    detail: { shopName: this.name, itemName: itemName, newAmount: this.inv[i].amount, newPrice: this.inv[i].price }
                });
                window.dispatchEvent(event);
                break;
            }
        }
    }

    updateItemStock(itemName, newAmount) {
        // Update item stock and recalculate prices (for purchases)
        for(let i = 0; i < this.inv.length; i++){
            if(this.inv[i] != 0 && this.inv[i].name == itemName){
                this.inv[i].amount = newAmount;
                this.recalculateItemPrice(itemName); // Only recalc THIS item
                
                // Dispatch stock change event
                const event = new CustomEvent('stockChange', {
                    detail: { shopName: this.name, itemName: itemName, newAmount: newAmount, newPrice: this.inv[i].price }
                });
                window.dispatchEvent(event);
                break;
            }
        }
    }

    load(obj){
        this.age = obj.age;
        this.hand = obj.hand;
        this.under_tile = new_tile_from_num(tile_name_to_num(obj.under_tile.name), obj.under_tile.pos.x, obj.under_tile.pos.y);
        this.under_tile.load(obj.under_tile);
        
        // Restore originalPrices if they exist in saved data
        if(obj.originalPrices) {
            this.originalPrices = obj.originalPrices;
        }
        
        for(let i = 0; i < obj.inv.length; i++){
            if(obj.inv[i] != 0 && this.inv[i] != 0){
                this.inv[i] = new_item_from_num(item_name_to_num(obj.inv[i].name), obj.inv[i].amount);
                // Store original price if not already set
                if(!this.originalPrices[i]) {
                    this.originalPrices[i] = obj.inv[i].price;
                }
                this.inv[i].price = obj.inv[i].price;
                if(this.inv[i].class == 'Backpack'){
                    this.inv[i].load(obj.inv[i])
                }
            }
            else if (obj.inv[i] != 0 && this.inv[i] == 0){
                this.inv[i] = new_item_from_num(item_name_to_num(obj.inv[i].name), obj.inv[i].amount);
                this.inv[i].price = obj.inv[i].price;
                if(this.inv[i].class == 'Backpack'){
                    this.inv[i].load(obj.inv[i])
                }
            }
            else if (obj.inv[i] == 0 && this.inv[i] != 0){
                this.inv[i] = 0;
            }
        }
    }
}