class Foreground {
    constructor(type, x, y){
        this.type = type;
        if(this.type == 1){ // Front of the building
            this.png = 90;
        }
        if(this.type == 2){ // Clouds
            this.png = 91;
        }
        if(this.type == 3){ // buildings
            this.png = 92;
        }
        if(this.type == 4){  // Front left
            this.png = 131
        }
        if(this.type == 5){ // Front right
            this.png = 132
        }
        if(this.type == 6){ // Front both
            this.png = 133
        }
        this.dim = 0;
        this.variant = round(random(0, all_imgs[this.png].length-1));
        this.pos = createVector(x, y);
    }

    render(){
        image(all_imgs[this.png][this.variant], this.pos.x, this.pos.y);
        if(this.type != 1 && this.type != 4 && this.type != 5 && this.type != 6){
            push()
            fill(255, 255*0.3)
            noStroke();
            rect(this.pos.x, this.pos.y, tileSize, tileSize);
            pop()
        }
        if(this.dim != 0){
            push()
            fill(0, this.dim)
            noStroke();
            rect(this.pos.x, this.pos.y, tileSize, tileSize);
            pop()
        }
    }
}
class Level {
    constructor(name, map, fore) {
        this.name = name;
        this.lights = [];
        this.fore = fore;
        this.map = map;
        this.ladybugs = 0;
        this.level_name_popup = false;
        this.done = false;
        this.movephase = 0;
        this.ticks = 0;
        this.y = -50;
        for(let i = 0; i < fore.length; i++){
            for(let j = 0; j < fore[i].length; j++){
                if(this.fore[i][j] != 0){
                    this.fore[i][j] = new Foreground(fore[i][j], j * tileSize, i * tileSize);
                }
            }
        }
        for (let i = 0; i < map.length; i++) {
            for (let j = 0; j < map[i].length; j++) {
                if (map[i][j] == 0) {
                    this.map[i][j] = 0;
                } else {
                    if (map[i][j] > 0 && map[i][j] <= all_tiles.length) {
                        map[i][j] = new_tile_from_num(map[i][j], j * tileSize, i * tileSize);
                    } else {
                        this.map[i][j] = 0;
                        console.error('Tile doesnt exist');
                    }
                    // Ensure sprinklers always have a base tile for rendering (covers legacy saves)
                    if (this.map[i][j] && this.map[i][j].name === 'sprinkler' && !this.map[i][j].under_tile) {
                        this.map[i][j].under_tile = new_tile_from_num(3, j * tileSize, i * tileSize); // plot
                        this.map[i][j].last_under_png = this.map[i][j].under_tile.png;
                    }
                    if (this.map[i][j].name == 'lamppost') {
                        append(this.lights, new Light(this.map[i][j].pos.x, this.map[i][j].pos.y, (tileSize * 6), 255, 255, 255));
                    }
                    if (this.map[i][j].name == 'satilite') {
                        append(this.lights, new Light(this.map[i][j].pos.x, this.map[i][j].pos.y, (tileSize * 1)+5, 255, 255, 0));
                    }
                    if (this.map[i][j].name == 'bridge'){
                        if(this.fore[i+2][j] != undefined && this.fore[i+2][j].type != 1 && this.type != 4 && this.type != 5 && this.type != 6){
                            this.fore[i+2][j].dim = 100;
                        }
                    }
                    if (this.map[i][j].name == 'LightBug'){
                        let light = new Light(this.map[i][j].pos.x, this.map[i][j].pos.y, (tileSize * 1)-5, 150, 255, 0);
                        append(this.lights, light);
                        this.map[i][j].light = light;
                        this.map[i][j].lightI = this.lights.length - 1;
                    }
                }
            }
        }

        // After constructing tiles, optionally add extra trees then adjust park grass variants
        this.sprinkleParkTrees();
        this.applyParkGrassLeafVariants();
    }

    sprinkleParkTrees(){
        // Quickly boost canopy coverage on park grass without hand-editing every map
        const candidates = [];

        // Start at row 1 so the row above exists for the tree top
        for (let i = 1; i < this.map.length; i++) {
            for (let j = 0; j < this.map[i].length; j++) {
                if (!this.map[i][j] || !this.map[i - 1] || !this.map[i - 1][j]) continue;
                if (this.map[i][j].name !== 'park_grass' || this.map[i - 1][j].name !== 'park_grass') continue;
                candidates.push({ y: i, x: j });
            }
        }

        // Skip small non-park levels that happen to use a few park grass tiles
        if (candidates.length < 15) return;

        // Scale trees to map size, lightly clamped so parks never feel empty or overstuffed
        const target = Math.round(candidates.length * 0.04);
        const clampedTarget = Math.min(Math.max(target, 4), 18);
        const treesToPlace = Math.min(clampedTarget, candidates.length);

        // Shuffle to spread randomness
        for (let i = candidates.length - 1; i > 0; i--) {
            const swap = Math.floor(Math.random() * (i + 1));
            const temp = candidates[i];
            candidates[i] = candidates[swap];
            candidates[swap] = temp;
        }

        let placed = 0;
        for (let idx = 0; idx < candidates.length && placed < treesToPlace; idx++) {
            const { y, x } = candidates[idx];
            const bottom = this.map[y][x];
            const top = this.map[y - 1][x];

            if (!bottom || !top) continue;
            if (bottom.name !== 'park_grass' || top.name !== 'park_grass') continue;

            this.map[y][x] = new_tile_from_num(68, x * tileSize, y * tileSize);
            this.map[y - 1][x] = new_tile_from_num(69, x * tileSize, (y - 1) * tileSize);
            placed += 1;
        }
    }

    applyParkGrassLeafVariants(){
        const leafIndex = all_imgs[94].length - 1; // Last variant is leaves
        for (let i = 0; i < this.map.length; i++) {
            for (let j = 0; j < this.map[i].length; j++) {
                const tile = this.map[i][j];
                if (!tile || tile.name !== 'park_grass') continue;

                let nearTree = false;
                for (let dy = -1; dy <= 1 && !nearTree; dy++) {
                    for (let dx = -1; dx <= 1 && !nearTree; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        if (this.map[i + dy] && this.map[i + dy][j + dx]) {
                            const neighbor = this.map[i + dy][j + dx];
                            if (neighbor.name === 'tree_bottom' || neighbor.name === 'tree_top') {
                                nearTree = true;
                            }
                        }
                    }
                }

                if (nearTree) {
                    tile.variant = leafIndex;
                } else {
                    tile.variant = round(random(0, all_imgs[tile.png].length - 2));
                }
            }
        }
    }

    //Controls movement for top-left level box when you enter a new level (DOM version in shared container)
    name_render() {
        if(!this.done){
            if(!paused){
                if(this.movephase == 0){
                    if(this.ticks >= 50){
                        this.movephase = 1;
                        this.ticks = 0;
                    }
                    this.y += 1;
                }
                if(this.movephase == 1){
                    if(this.ticks >= 70){
                        this.movephase = 2;
                        this.ticks = 0;
                    }
                }
                if(this.movephase == 2){
                    this.y -= 1;
                    if(this.ticks >= 50){
                        this.done = true;
                        this.ticks = 0;
                    }
                }
                
            this.ticks += 1;
        }
        
        // Create shared popup container if needed
        this.ensurePopupContainer();
        
        // Create or update the level name popup in container
        let levelPopup = document.getElementById('level-name-popup');
        if (!levelPopup) {
            levelPopup = document.createElement('div');
            levelPopup.id = 'level-name-popup';
            const container = document.getElementById('ui-popup-container');
            if (container) {
                container.insertBefore(levelPopup, container.firstChild); // Insert at top
            }
        }
        
        // Check for mobile to use smaller dimensions
        const isMobileOrSmall = (typeof isMobile !== 'undefined' && isMobile) || window.innerWidth <= 768;
        
        const charWidth = isMobileOrSmall ? 11 : 17;
        const panelWidth = (this.name.length * charWidth) + 6;
        const panelHeight = isMobileOrSmall ? 35 : 50;
        const fontSize = isMobileOrSmall ? '11px' : '15px';
        const borderWidth = isMobileOrSmall ? '3px' : '5px';
        
        // Apply styling to match original canvas rendering
        levelPopup.style.width = panelWidth + 'px';
        levelPopup.style.height = panelHeight + 'px';
        levelPopup.style.backgroundColor = 'rgb(187, 132, 75)';
        levelPopup.style.border = borderWidth + ' solid rgb(149, 108, 65)';
        levelPopup.style.padding = '0px';
        levelPopup.style.boxSizing = 'border-box';
        levelPopup.style.fontFamily = 'pixelFont, monospace';
        levelPopup.style.color = 'rgb(255, 255, 255)';
        levelPopup.style.fontSize = fontSize;
        levelPopup.style.display = 'flex';
        levelPopup.style.alignItems = 'center';
        levelPopup.style.justifyContent = 'center';
        levelPopup.style.textAlign = 'center';
        levelPopup.style.fontWeight = 'bold';
        levelPopup.style.textShadow = (isMobileOrSmall ? '2px 2px' : '4px 4px') + ' 0px rgba(0, 0, 0, 0.5)';
        levelPopup.style.marginBottom = '5px';
        // Animate position based on y value
        levelPopup.style.transform = 'translateY(' + this.y + 'px)';
        
        levelPopup.textContent = this.name;

        }
        else{
            // Hide popup when done
            let levelPopup = document.getElementById('level-name-popup');
            if (levelPopup) {
                levelPopup.style.display = 'none';
            }
            this.level_name_popup = false;
        }
    }
    
    ensurePopupContainer(){
        // Create a shared container for all UI popups to prevent overlap
        if (!document.getElementById('ui-popup-container')) {
            const container = document.createElement('div');
            container.id = 'ui-popup-container';
            document.body.appendChild(container);
            
            const canvas = document.querySelector('canvas');
            if (canvas) {
                const canvasRect = canvas.getBoundingClientRect();
                container.style.position = 'fixed';
                container.style.top = (canvasRect.top + 2) + 'px';
                container.style.left = (canvasRect.left + 2) + 'px';
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.zIndex = '1000';
                container.style.pointerEvents = 'none';
            }
        }
    }
    fore_render() {
        for (let i = 0; i < this.fore.length; i++) {
            for (let j = 0; j < this.fore[i].length; j++) {
                if(this.fore[i][j] != 0){
                    this.fore[i][j].render()
                }
            }
        }
    }

    render() {
        for (let i = 0; i < this.map.length; i++) {
            for (let j = 0; j < this.map[i].length; j++) {
                const tile = this.map[i][j];
                if (tile === 0 || tile === undefined) continue;
                if (tile.name === 'tree_top') continue; // Render canopy in a second pass above player

                tile.render();
                
                // Show quest/gift icons above NPCs when not talking
                if(tile.class === 'NPC' && player.talking === 0) {
                    push();
                    imageMode(CENTER);
                    
                    if(tile.hasQuestForPlayer && tile.hasQuestForPlayer()) {
                        // Quest marker sprite
                        image(quest_marker_img, tile.pos.x + (tileSize / 2), tile.pos.y - 8);
                    } else if(tile.hasGiftForPlayer && tile.hasGiftForPlayer()) {
                        // Gift indication sprite
                        image(gift_indication_img, tile.pos.x + (tileSize / 2), tile.pos.y - 8);
                    }
                    
                    pop();
                }
            }
        }
    }

    renderLights() {
        // Create a graphics buffer for the lighting mask (transient, not saved)
        if (!this.lightingBuffer) {
            this.lightingBuffer = createGraphics(canvasWidth, canvasHeight);
        }
        
        // Get camera offset (0 if camera disabled)
        const camX = (typeof camera !== 'undefined' && camera.enabled) ? camera.x : 0;
        const camY = (typeof camera !== 'undefined' && camera.enabled) ? camera.y : 0;
        
        // Draw to the buffer
        this.lightingBuffer.clear();
        this.lightingBuffer.noStroke();
        
        // Fill with darkness
        this.lightingBuffer.fill(0, 0, 0, time);
        this.lightingBuffer.rect(0, 0, canvasWidth, canvasHeight);
        
        // Use erase mode to cut holes for lights
        this.lightingBuffer.erase(255, 255);
        for (let i = 0; i < this.lights.length; i++) {
            this.lights[i].renderToBuffer(this.lightingBuffer, camX, camY);
        }
        this.lightingBuffer.noErase();
        
        // Draw the lighting buffer to main canvas at camera position in world space
        image(this.lightingBuffer, camX, camY);
    }

    getReadyForSave() {
        // Remove non-serializable objects before saving
        if (this.lightingBuffer) {
            delete this.lightingBuffer;
        }
    }

    renderTreeTops(){
        // Draw tree canopies in a late pass so they appear above the player
        for (let i = 0; i < this.map.length; i++) {
            for (let j = 0; j < this.map[i].length; j++) {
                const tile = this.map[i][j];
                if (!tile || tile.name !== 'tree_top') continue;
                tile.render();
            }
        }
    }

    update(x, y) {
        // Iterate through all tiles in this level and update them
        for (let i = 0; i < this.map.length; i++) {
            for (let j = 0; j < this.map[i].length; j++) {
                const tile = this.map[i][j];
                if (tile && tile != 0 && typeof tile !== 'undefined') {
                    // Handle different tile types
                    if (tile.class === 'Plant') {
                        tile.grow(x, y);
                    }
                    if (tile.class === 'NPC') {
                        tile.move(x, y);
                    }
                    if (tile.class === 'Robot') {
                        tile.move(x, y);
                    }
                    if (tile.class === 'FreeMoveEntity'){
                        tile.randomMove(x, y);
                    }
                    if (tile.class === 'LightMoveEntity'){
                        tile.randomMove(x, y);
                    }
                    if (tile.name === 'flower') {
                        // Check if Bees are enabled before spawning
                        const beesEnabled = !window.customRules || !window.customRules.crittersEnabled || 
                                           window.customRules.crittersEnabled['Bees'] !== false;
                        if (beesEnabled && tile.age == 1 && round(random(0,3)) == 2) {
                            this.map[i][j] = new_tile_from_num(49, (j * tileSize), (i * tileSize));
                            this.map[i][j].age = 0;
                            this.map[i][j].under_tile = new_tile_from_num(50, (j * tileSize), (i * tileSize));
                        }
                    }
                }
            }
        }
    }

    // Viewport culling optimization: only update visible tiles
    // This provides an additional 4-10x performance improvement
    updateWithCulling(cameraX = 0, cameraY = 0) {
        // Calculate viewport bounds with 2-tile margin for off-screen updates
        const margin = 2;
        const viewportStartX = Math.max(0, Math.floor(cameraX / tileSize) - margin);
        const viewportEndX = Math.min(this.map[0].length, Math.ceil((cameraX + canvasWidth) / tileSize) + margin);
        const viewportStartY = Math.max(0, Math.floor(cameraY / tileSize) - margin);
        const viewportEndY = Math.min(this.map.length, Math.ceil((cameraY + canvasHeight) / tileSize) + margin);

        // Only update tiles within viewport
        for (let i = viewportStartY; i < viewportEndY; i++) {
            for (let j = viewportStartX; j < viewportEndX; j++) {
                if (this.map[i][j] != 0 && this.map[i][j] != undefined) {
                    // Handle different tile types
                    if (this.map[i][j].class == 'Plant') {
                        this.map[i][j].grow(j, i);
                    }
                    if (this.map[i][j].class == 'NPC') {
                        this.map[i][j].move(j, i);
                    }
                    if (this.map[i][j].class == 'Robot') {
                        this.map[i][j].move(j, i);
                    }
                    if (this.map[i][j].class == 'FreeMoveEntity'){
                        this.map[i][j].randomMove(j, i);
                    }
                    if (this.map[i][j].class == 'LightMoveEntity'){
                        this.map[i][j].randomMove(j, i);
                    }
                    if (this.map[i][j].name == 'flower') {
                        // Check if Bees are enabled before spawning
                        const beesEnabled = !window.customRules || !window.customRules.crittersEnabled || 
                                           window.customRules.crittersEnabled['Bees'] !== false;
                        if (beesEnabled && this.map[i][j].age == 1 && round(random(0,3)) == 2) {
                            this.map[i][j] = new_tile_from_num(49, (j * tileSize), (i * tileSize));
                            this.map[i][j].age = 0;
                            this.map[i][j].under_tile = new_tile_from_num(50, (j * tileSize), (i * tileSize));
                        }
                    }
                }
            }
        }
    }

    daily_update() {
        if(days % 10 == 0){
            level17.map[7][12] = new_tile_from_num(88, 12*tileSize, 7*tileSize)
        }
        else{
            level17.map[7][12] = new_tile_from_num(57, 12*tileSize, 7*tileSize)
        }
        for (let i = 0; i < this.map.length; i++) {
            for (let j = 0; j < this.map[i].length; j++) {
                if(this.map[i][j].class == 'Shop'){
                    this.map[i][j].daily_update();
                }
                if (this.map[i][j].age >= 0 && this.map[i][j].class != 'Plant') {
                    this.map[i][j].age += 1;
                    if (this.map[i][j].name == 'compost_tile') {
                        if (this.map[i][j].age >= 2) {
                            this.map[i][j] = new_tile_from_num(2, (j * tileSize), (i * tileSize));
                        }
                    }
                    if (this.map[i][j].name == 'plot') {
                        if (this.map[i][j].age >= 5) {
                            this.map[i][j] = new_tile_from_num(4, (j * tileSize), (i * tileSize));
                        }
                    }
                    if (this.map[i][j].name == 'ladybug') {
                        if (this.map[i][j].age >= 10) {
                            this.ladybugs -= 1;
                            this.map[i][j] = new_tile_from_num(2, (j * tileSize), (i * tileSize));
                        }
                    }
                    if (this.map[i][j].name == 'Bees') {
                        if (this.map[i][j].age >= 7) {
                            this.map[i][j] = this.map[i][j].under_tile;
                        }
                    }
                    if (this.map[i][j].name == 'Flower_Done'){
                        if (this.map[i][j].age >= 5) {
                            this.map[i][j] = new_tile_from_num(2, (j * tileSize), (i * tileSize));
                        }
                    }
                }
            }
        }
    }
};

class Light {
    constructor(x, y, size, r, g, b) {
        this.pos = createVector(x, y);
        this.size = size;
        this.r = r;
        this.g = g;
        this.b = b;
    }

    renderToBuffer(buffer, camX = 0, camY = 0) {
        // Draw light circle to cut hole in darkness (in erase mode)
        // Offset by camera position so lights appear in correct screen position
        const centerX = this.pos.x - camX + (tileSize / 2);
        const centerY = this.pos.y - camY + (tileSize / 2);
        const maxRadius = this.size / 2;
        const steps = 15;
        
        // Only render if light is visible in viewport
        if (centerX < -maxRadius || centerX > canvasWidth + maxRadius ||
            centerY < -maxRadius || centerY > canvasHeight + maxRadius) {
            return;
        }
        
        buffer.noStroke();
        
        // Draw gradient from fully erased center to no erasure at edges
        for (let i = steps; i > 0; i--) {
            const ratio = i / steps;
            const radius = maxRadius * ratio;
            // Erase strength decreases toward edges for smooth gradient
            const eraseStrength = 255 * (1 - Math.pow(ratio, 1.5));
            
            buffer.fill(255, eraseStrength);
            buffer.circle(centerX, centerY, radius * 2);
        }
    }

    render() {
        // Fallback render for main canvas (not used in buffer system)
        this.renderToBuffer(window, 0, 0);
    }
}