/**
 * Beach Area Mechanics
 * Implements swimming and fishing mechanics for the beach area
 */

class BeachMechanics {
    constructor() {
        this.swimming = false;
        this.fishing = false;
        this.fishingTimer = 0;
        this.swimStamina = 100;
        this.maxSwimStamina = 100;
        this.catchCooldown = 0;
        this.waterTiles = new Set();
        this.fishTypes = [
            { name: 'small_fish', rarity: 0.6, value: 15, minLevel: 1, itemNum: 49 },
            { name: 'medium_fish', rarity: 0.3, value: 30, minLevel: 2, itemNum: 50 },
            { name: 'large_fish', rarity: 0.08, value: 50, minLevel: 3, itemNum: 51 },
            { name: 'rare_fish', rarity: 0.02, value: 100, minLevel: 4, itemNum: 52 }
        ];
    }

    // Initialize water tiles for the beach area
    initializeWaterTiles(levelMap) {
        this.waterTiles.clear();
        for (let y = 0; y < levelMap.length; y++) {
            for (let x = 0; x < levelMap[y].length; x++) {
                const tile = levelMap[y][x];
                if (tile && tile.name === 'water') {
                    this.waterTiles.add(`${x},${y}`);
                }
            }
        }
    }

    // Check if a position is water
    isWaterTile(x, y) {
        return this.waterTiles.has(`${x},${y}`);
    }

    // Start swimming when entering water
    startSwimming() {
        if (this.swimStamina > 10) {
            this.swimming = true;
            player.inWater = true;
            player.swimAnimation = true;
            return true;
        }
        return false;
    }

    // Stop swimming when leaving water
    stopSwimming() {
        this.swimming = false;
        player.inWater = false;
        player.swimAnimation = false;
    }

    // Start fishing action
    startFishing() {
        if (!this.fishing && this.catchCooldown <= 0) {
            this.fishing = true;
            this.fishingTimer = random(2000, 5000); // 2-5 seconds to catch
            player.fishing = true;
            return true;
        }
        return false;
    }

    // Stop fishing action
    stopFishing() {
        this.fishing = false;
        player.fishing = false;
        this.fishingTimer = 0;
    }

    // Update beach mechanics
    update() {
        // Update swimming stamina
        if (this.swimming) {
            this.swimStamina = max(0, this.swimStamina - 0.1);
            if (this.swimStamina <= 0) {
                this.stopSwimming();
                // Push player back to land
                this.pushPlayerToLand();
            }
        } else {
            // Recover stamina when not swimming
            this.swimStamina = min(this.maxSwimStamina, this.swimStamina + 0.2);
        }

        // Update fishing timer
        if (this.fishing && this.fishingTimer > 0) {
            this.fishingTimer -= deltaTime;
            if (this.fishingTimer <= 0) {
                this.catchFish();
            }
        }

        // Update catch cooldown
        if (this.catchCooldown > 0) {
            this.catchCooldown -= deltaTime;
        }
    }

    // Push player to nearest land tile when stamina runs out
    pushPlayerToLand() {
        const playerX = Math.floor(player.pos.x / tileSize);
        const playerY = Math.floor(player.pos.y / tileSize);
        
        // Find nearest land tile
        for (let radius = 1; radius <= 3; radius++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const checkX = playerX + dx;
                    const checkY = playerY + dy;
                    if (!this.isWaterTile(checkX, checkY) && currentLevel.map[checkY] && currentLevel.map[checkY][checkX]) {
                        player.pos.x = checkX * tileSize;
                        player.pos.y = checkY * tileSize;
                        return;
                    }
                }
            }
        }
    }

    // Catch a fish based on rarity
    catchFish() {
        const roll = random();
        let cumulativeRarity = 0;
        let caughtFish = null;

        for (const fish of this.fishTypes) {
            cumulativeRarity += fish.rarity;
            if (roll <= cumulativeRarity) {
                caughtFish = fish;
                break;
            }
        }

        if (caughtFish) {
            // Add fish to player inventory
            const fishItem = this.createFishItem(caughtFish);
            if (checkForSpace(player, caughtFish.itemNum)) {
                addItem(player, caughtFish.itemNum, 1);
                this.showCatchMessage(caughtFish);
                this.catchCooldown = 1000; // 1 second cooldown
                moneySound.play();
            }
        }

        this.stopFishing();
    }

    // Create fish item object
    createFishItem(fishType) {
        return new_item_from_num(fishType.itemNum, 1);
    }

    // Get display name for fish
    getFishDisplayName(fishName) {
        const names = {
            'small_fish': 'Small Fish',
            'medium_fish': 'Medium Fish', 
            'large_fish': 'Large Fish',
            'rare_fish': 'Rare Fish'
        };
        return names[fishName] || fishName;
    }

    // Show catch message to player
    showCatchMessage(fish) {
        const message = `Caught a ${this.getFishDisplayName(fish.name)}! Worth $${fish.value}`;
        this.showMessage(message);
    }

    // Show message to player (integrates with existing dialogue system)
    showMessage(text) {
        if (typeof showDialogue === 'function') {
            showDialogue(text, 'System');
        } else if (typeof console !== 'undefined') {
            console.log(text);
        }
    }

    // Handle player entering water tile
    handleWaterEntry(x, y) {
        if (this.isWaterTile(x, y)) {
            return this.startSwimming();
        }
        return false;
    }

    // Handle player exiting water tile
    handleWaterExit(x, y) {
        if (!this.isWaterTile(x, y) && this.swimming) {
            this.stopSwimming();
        }
        // Stop fishing when moving away from water edge
        if (this.fishing) {
            const playerTileX = Math.floor(player.pos.x / tileSize);
            const playerTileY = Math.floor(player.pos.y / tileSize);
            
            if (!this.isWaterTile(playerTileX, playerTileY - 1) && // water above
                !this.isWaterTile(playerTileX, playerTileY + 1) && // water below
                !this.isWaterTile(playerTileX - 1, playerTileY) && // water left
                !this.isWaterTile(playerTileX + 1, playerTileY)) { // water right
                this.stopFishing();
            }
        }
    }

    // Get swim stamina percentage for UI
    getSwimStaminaPercent() {
        return (this.swimStamina / this.maxSwimStamina) * 100;
    }

    // Render beach-specific UI elements
    renderUI() {
        if (this.swimming) {
            this.renderSwimStaminaBar();
        }
        if (this.fishing) {
            this.renderFishingIndicator();
        }
    }

    // Render swimming stamina bar
    renderSwimStaminaBar() {
        push();
        const barWidth = 100;
        const barHeight = 10;
        const x = 10;
        const y = canvasHeight - 30;
        
        // Background
        fill(50, 50, 50, 200);
        rect(x, y, barWidth, barHeight);
        
        // Stamina bar
        const staminaPercent = this.getSwimStaminaPercent();
        if (staminaPercent > 50) {
            fill(0, 255, 0, 200);
        } else if (staminaPercent > 25) {
            fill(255, 255, 0, 200);
        } else {
            fill(255, 0, 0, 200);
        }
        rect(x, y, barWidth * (staminaPercent / 100), barHeight);
        
        // Border
        noFill();
        stroke(255);
        strokeWeight(1);
        rect(x, y, barWidth, barHeight);
        
        // Text
        noStroke();
        fill(255);
        textAlign(LEFT, CENTER);
        textSize(10);
        text(t('Stamina'), x, y - 5);
        pop();
    }

    // Render fishing indicator
    renderFishingIndicator() {
        push();
        fill(255, 255, 255, 200);
        textAlign(CENTER, CENTER);
        textSize(14);
        text(t('Fishing...'), canvasWidth / 2, 50);
        
        // Progress bar
        const barWidth = 100;
        const barHeight = 5;
        const progress = 1 - (this.fishingTimer / 5000);
        
        fill(50, 50, 50, 200);
        rect((canvasWidth - barWidth) / 2, 60, barWidth, barHeight);
        
        fill(0, 150, 255, 200);
        rect((canvasWidth - barWidth) / 2, 60, barWidth * progress, barHeight);
        pop();
    }
}

// Create global beach mechanics instance
let beachMechanics = new BeachMechanics();
