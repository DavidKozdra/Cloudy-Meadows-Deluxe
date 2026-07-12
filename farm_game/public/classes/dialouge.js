// Tell-phrase whitelist: replies that should only appear when a matching TellGoal is active
const TELL_PHRASE_WHITELIST = [
    'Your son needs help',
    'Liam sent you a love letter'
];

class Dialouge {
    constructor(phrase, replies = [], hand_num, amount){
        this.phrase = phrase;
        this.sourcePhrase = Array.isArray(phrase) ? phrase.join('') : String(phrase || '');
        this.phrase2 = [];
        for(let i = 0; i < this.phrase.length; i++){
          this.phrase2[i] = this.phrase[i];
        }
        this.phrase = [];
        this.new_phrase = -1;
        this.replies = replies;
        for(let i = 0; i < this.replies.length; i++){
            this.replies[i].consumed = !!this.replies[i].consumed;
            if(this.replies[i].quest != -1){
                this.replies[i].quest = new Quest(this.replies[i].quest.name, this.replies[i].quest.goals, this.replies[i].quest.days, this.replies[i].quest.reward_item, this.replies[i].quest.reward_coins);
            }
        }
        this.new_replies = -1;
        this.replyScrollTop = 0;
        this.hand_num = hand_num;
        this.amount = amount;
        this.textWait = 1;
        this.maxTextWait = this.textWait;
        this.text_i = -1;
        this.done = false;
        this.noise = true;
    }

    getDisplayPhraseChars(){
        return t(this.sourcePhrase).split('');
    }

    // Determine whether a reply is tied to a TellGoal and its state
    getTellGoalState(npcName, phrase){
        const state = { isTell: TELL_PHRASE_WHITELIST.includes(phrase), hasTodo: false, hasDone: false };
        if (typeof player === 'undefined' || !player || !player.quests) {
            return state;
        }
        for (let qi = 0; qi < player.quests.length; qi++) {
            const q = player.quests[qi];
            if (!q || !q.goals || q.failed) continue;
            for (let gi = 0; gi < q.goals.length; gi++) {
                const g = q.goals[gi];
                if (g.class === 'TellGoal' && g.npc_name === npcName && g.reply_phrase === phrase) {
                    state.isTell = true;
                    if (g.done) {
                        state.hasDone = true;
                    } else {
                        state.hasTodo = true;
                    }
                }
            }
        }
        return state;
    }

    getActiveReplies(npcName){
        // Filter replies so TellGoal phrases appear only when their goal is TODO and vanish once done
        const baseReplies = this.replies || [];
        if (typeof player === 'undefined' || !player || !player.quests) {
            return baseReplies;
        }
        return baseReplies.filter(reply => {
            const tellState = this.getTellGoalState(npcName, reply.phrase);
            if (!tellState.isTell) return true; // Regular chatter stays
            if (tellState.hasDone) return false; // Hide once completed
            return tellState.hasTodo; // Show only if an active TellGoal is waiting
        });
    }

    render(name, inv){
        push();
        stroke(149, 108, 65);
        strokeWeight(5);
        fill(187, 132, 75);
        rect(canvasWidth / 20, canvasHeight - 150, canvasWidth - (canvasWidth/10), 150);
        rect(canvasWidth / 20, canvasHeight - 150, (canvasWidth / 2) - (canvasWidth/10) + 20, 150);
        textFont(player_2);
        textSize(15);
        fill(255);
        stroke(0);
        strokeWeight(4);
        text(t(name), (canvasWidth / 20) + 10, canvasHeight - 140);
        text(t('Replies:'), (canvasWidth / 2) - 10, canvasHeight - 140);
        textSize(13);
        strokeWeight(2);
        text((typeof Controls_Eat_button_key !== 'undefined' ? Controls_Eat_button_key.toUpperCase() : 'Q') + ' ' + t('to leave'), ((3*canvasWidth) / 4) + 10, canvasHeight - 140);
        if (this.done == false){
            this.textWait -= 1;
            if(this.textWait <= 0){
                this.text_i += 1;
                this.textWait = this.maxTextWait
            }
            const displayPhrase = this.getDisplayPhraseChars();
            this.phrase[this.text_i] = displayPhrase[this.text_i];
            text(this.phrase.join(''), (canvasWidth / 20) + 10, canvasHeight - 115, (canvasWidth / 2) - (canvasWidth / 20) - 20);
            if(this.noise){
                npc_talkingSound.play();
            }
            this.noise = !this.noise;
            if (this.text_i == displayPhrase.length - 1){
                this.done = true;
                if(this.hand_num != -1 && inv[this.hand_num] != 0 && inv[this.hand_num].amount > 0){
                    if (this.amount >= inv[this.hand_num].amount){
                        if(checkForSpace(player, item_name_to_num(inv[this.hand_num].name))){
                            addItem(player, item_name_to_num(inv[this.hand_num].name), inv[this.hand_num].amount);
                            inv[this.hand_num].amount = 0;
                            this.new_phrase = [];
                            let phrase = t("Sorry I dont have any more") + " " + tItem(inv[this.hand_num].name);
                            for(let i = 0; i < phrase.length; i++){
                                this.new_phrase[i] = phrase[i];
                            }
                            this.new_replies = [];
                            this.new_replies[0] = {phrase: 'Oh ok', dialouge_num: -1, quest: -1};
                        }
                    }
                    else {
                        if(checkForSpace(player, item_name_to_num(inv[this.hand_num].name))){
                            addItem(player, item_name_to_num(inv[this.hand_num].name), this.amount);
                            inv[this.hand_num].amount -= this.amount;
                        }
                    }
                }
            }
        }
        else{
            text(t(this.sourcePhrase), (canvasWidth / 20) + 10, canvasHeight - 115, (canvasWidth / 2) - (canvasWidth / 20) - 20);
        }
        stroke(0);
        const replies = this.getActiveReplies(name);
        if (current_reply > replies.length - 1) {
            current_reply = max(0, replies.length - 1);
        }
        // Geometry of the reply list: it lives inside the dialogue box, starting a
        // little below the top and stopping before the box bottom edge.
        const LINE_H = 17;
        const REPLY_TOP = canvasHeight - 115;
        const REPLY_BOTTOM = canvasHeight - 10; // stay inside the 5px box stroke
        const MAX_LINES = floor((REPLY_BOTTOM - REPLY_TOP) / LINE_H);
        const REPLY_X = (canvasWidth / 2) - 10;
        const REPLY_W = (canvasWidth / 2) - (canvasWidth / 20) - 10;
        // How many wrapped text lines a reply occupies (label included).
        const linesFor = (i) => {
            const tellState = this.getTellGoalState(name, replies[i].phrase);
            const label = (tellState.isTell && tellState.hasTodo) ? ' [' + t('quest') + ']' : '';
            const len = t(replies[i].phrase).length + label.length;
            return len > 22 ? ceil(len / 22) : 1;
        };

        if(replies.length === 0){
            fill(255);
            text('- ' + t('No replies available'), REPLY_X, REPLY_TOP, REPLY_W);
        }
        else {
            // Pick the first visible reply so the selected one stays on screen and
            // the window never draws more than MAX_LINES of wrapped text.
            let startIndex = min(current_reply, this.replyScrollTop || 0);
            let lineBudget = MAX_LINES;
            let lastFit = current_reply;
            for (let i = startIndex; i < replies.length; i++){
                const need = linesFor(i);
                if (need > lineBudget) break;
                lineBudget -= need;
                lastFit = i;
            }
            // If the selected reply fell past the visible window, scroll down until
            // it fits (accounting for its own possibly multi-line height).
            while (current_reply > lastFit && startIndex < current_reply){
                startIndex++;
                lineBudget = MAX_LINES;
                lastFit = startIndex - 1;
                for (let i = startIndex; i < replies.length; i++){
                    const need = linesFor(i);
                    if (need > lineBudget) break;
                    lineBudget -= need;
                    lastFit = i;
                }
            }
            this.replyScrollTop = startIndex;

            let current_y = 0;
            let lastVisible = startIndex - 1;
            for (let i = startIndex; i < replies.length; i++){
                const need = linesFor(i);
                if (current_y + need * LINE_H > (REPLY_BOTTOM - REPLY_TOP)) break;
                const tellState = this.getTellGoalState(name, replies[i].phrase);
                const label = (tellState.isTell && tellState.hasTodo) ? ' [' + t('quest') + ']' : '';
                const replyText = t(replies[i].phrase);
                if(current_reply == i){
                    fill(255, 255, 0);
                    text('>' + replyText + label, REPLY_X, REPLY_TOP + current_y, REPLY_W);
                }
                else{
                    fill(255);
                    text('-' + replyText + label, REPLY_X, REPLY_TOP + current_y, REPLY_W);
                }
                current_y += need * LINE_H;
                lastVisible = i;
            }
            // Down arrow: more replies exist below the visible window.
            if(lastVisible < replies.length - 1){
                image(done_dot, (canvasWidth / 20) + 632, (canvasHeight - 90) + (2 * 32) + 8);
            }
            // Up arrow: replies are hidden above the visible window.
            if(startIndex > 0){
                image(up_dot, (canvasWidth / 20) + 632, (canvasHeight - 120));
            }
        }
        pop()
    }
}
