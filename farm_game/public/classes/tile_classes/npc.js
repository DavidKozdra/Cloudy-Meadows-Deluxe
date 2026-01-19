class NPC extends GridMoveEntity {

    constructor(name, png, x, y, inv = [], hand = 0, facing = 3, under_tile_num, instructions = [], moving_timer, random_move = false) {
        super(name, png, x, y, inv, hand, facing, under_tile_num, instructions, moving_timer);
        this.class = 'NPC';
        this.random_move = random_move;
        this.options = ['up', 'down', 'left', 'right'];
        if(this.name == 'Mr.C'){
            this.move_bool = false;
        }
        this.dialouges = JSON.parse(JSON.stringify(Dialouge_JSON[this.name]));
        for(let i = 0; i < this.dialouges.length; i++){
            this.dialouges[i] = new Dialouge(this.dialouges[i].phrase, this.dialouges[i].replies, this.dialouges[i].hand_num, this.dialouges[i].amount);
        }
        this.current_dialouge = 0;
    }

    // Allow NPCs flagged as random movers to wander like FreeMoveEntity while staying talkable
    move(x, y) {
        if (typeof player !== 'undefined' && player.talking === this) return;
        if(this.random_move){
            if(this.instructions.length < 1){
                this.instructions.push(random(this.options));
            }
            super.move(x, y);
            this.instructions = [];
            return;
        }
        super.move(x, y);
    }

    // Check if this NPC has a quest the player doesn't have
    hasQuestForPlayer() {
        if(!this.dialouges) return false;
        
        // Check ALL dialogues, not just the current one
        for(let dialogue of this.dialouges) {
            const replies = (dialogue.getActiveReplies && dialogue.getActiveReplies(this.name)) || dialogue.replies;
            if(!replies) continue;
            
            // Check if any reply has a quest
            for(let reply of replies) {
                if(reply.quest && reply.quest != -1) {
                    // Check if player already has this quest
                    const questName = reply.quest.og_name || reply.quest.name;
                    let hasQuest = false;
                    for(let playerQuest of player.quests) {
                        if(playerQuest.og_name === questName || playerQuest.name === questName) {
                            hasQuest = true;
                            break;
                        }
                    }
                    if(!hasQuest) return true;
                }
            }
        }
        return false;
    }

    // Check if this NPC has a gift (items in dialogue)
    hasGiftForPlayer() {
        if(!this.dialouges) return false;
        
        // Check ALL dialogues, not just the current one
        for(let dialogue of this.dialouges) {
            // Check if dialogue has a gift AND the NPC still has items
            if(dialogue.hand_num != -1 && dialogue.hand_num != undefined) {
                // Make sure the inventory slot exists and has items
                if(this.inv[dialogue.hand_num] && 
                   this.inv[dialogue.hand_num] != 0 && 
                   this.inv[dialogue.hand_num].amount > 0) {
                    return true;
                }
            }
        }
        return false;
    }

    dialouge_render() {
        if (this.places && this.places.length) {
            // Ticket Master travel UI
            // Check if player can afford travel
            const travel_price = this.travel_price || 10;
            if (typeof player !== 'undefined' && player.talking === this && player.coins < travel_price) {
                push();
                stroke(255,0,0);
                strokeWeight(1);
                fill(255, 200, 200);
                rect(canvasWidth / 4, canvasHeight - 500, 320, 40, 12);
                textFont(player_2);
                textSize(10);
                fill(255,0,0);
                textAlign(CENTER, CENTER);
                text('You cannot afford to travel! (Cost: ' + travel_price + ')', canvasWidth / 4 ,  canvasHeight - 480, 320);
                pop();
            }
            AirBallon.prototype.tp_render.call(this);
        }
        else {
            this.dialouges[this.current_dialouge].render(this.name, this.inv);
        }
    }

    load(obj){
        this.age = obj.age;
        this.hand = obj.hand;
        this.under_tile = new_tile_from_num(tile_name_to_num(obj.under_tile.name), obj.under_tile.pos.x, obj.under_tile.pos.y);
        this.under_tile.load(obj.under_tile);
        this.anim = obj.anim;
        this.facing = obj.facing;
        this.moving_timer = obj.moving_timer;
        this.random_move = !!obj.random_move;
        this.instructions = obj.instructions;
        this.current_instruction = obj.current_instruction;
        this.options = obj.options || this.options || ['up', 'down', 'left', 'right'];
        
        for(let i = 0; i < obj.dialouges.length; i++){
            this.dialouges[i].phrase2 = obj.dialouges[i].phrase2;
            this.dialouges[i].amount = obj.dialouges[i].amount;
            this.dialouges[i].replies = obj.dialouges[i].replies;
            for(let j = 0; j < obj.dialouges[i].replies.length; j++){
                this.dialouges[i].replies[j].consumed = !!obj.dialouges[i].replies[j].consumed;
                if(obj.dialouges[i].replies[j].quest != -1){
                    this.dialouges[i].replies[j].quest = new Quest(obj.dialouges[i].replies[j].quest.og_name, obj.dialouges[i].replies[j].quest.goals, obj.dialouges[i].replies[j].quest.days, (obj.dialouges[i].replies[j].quest.reward_item == 0 ? 0 : {num: item_name_to_num(obj.dialouges[i].replies[j].quest.reward_item.name), amount: obj.dialouges[i].replies[j].quest.reward_item.amount}), obj.dialouges[i].replies[j].quest.reward_coins);
                    this.dialouges[i].replies[j].quest.load(obj.dialouges[i].replies[j].quest);
                }
            }
        }
        for(let i = 0; i < obj.inv.length; i++){
            if(obj.inv[i] != 0 && this.inv[i] != 0){
                this.inv[i] = new_item_from_num(item_name_to_num(obj.inv[i].name), obj.inv[i].amount);
                if(this.inv[i].class == 'Backpack'){
                    this.inv[i].load(obj.inv[i])
                }
            }
            else if (obj.inv[i] != 0 && this.inv[i] == 0){
                this.inv[i] = new_item_from_num(item_name_to_num(obj.inv[i].name), obj.inv[i].amount);
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