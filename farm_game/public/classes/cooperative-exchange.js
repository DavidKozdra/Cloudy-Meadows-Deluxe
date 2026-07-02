const COOP_DISTRICTS = [
    'Cloudy Meadows',
    'Poly Park',
    'Auto Farms',
    'Swiggy Swamps',
    'The Big City',
    'Beach'
];

const COOP_CONTRACT_TEMPLATES = [
    { district: 'Cloudy Meadows', title: 'Community Pantry', itemName: 'Corn', amount: 30, reward: 240 },
    { district: 'Cloudy Meadows', title: 'Soil Recovery Drive', itemName: 'Compost', amount: 18, reward: 280 },
    { district: 'Poly Park', title: 'Festival Fruit Stall', itemName: 'Strawberries', amount: 24, reward: 300 },
    { district: 'Poly Park', title: 'Park Picnic Supply', itemName: 'Watermelon', amount: 14, reward: 340 },
    { district: 'Auto Farms', title: 'Robot Fuel Reserve', itemName: 'Veggie Oil', amount: 16, reward: 440 },
    { district: 'Auto Farms', title: 'Precision Seed Order', itemName: 'Carrot Seed', amount: 20, reward: 360 },
    { district: 'Swiggy Swamps', title: 'Wetland Crop Trial', itemName: 'Hemp Flower', amount: 12, reward: 420 },
    { district: 'Swiggy Swamps', title: 'Swamp Food Reserve', itemName: 'Sweet Potatoes', amount: 28, reward: 320 },
    { district: 'The Big City', title: 'Restaurant Juice Order', itemName: 'Fruit Juice', amount: 18, reward: 520 },
    { district: 'The Big City', title: 'Downtown Produce Order', itemName: 'Tomato', amount: 32, reward: 390 },
    { district: 'Beach', title: 'Tournament Refreshments', itemName: 'Watermelon', amount: 18, reward: 430 },
    { district: 'Beach', title: 'Boardwalk Food Stall', itemName: 'Pumpkin', amount: 12, reward: 470 }
];

function createDefaultCooperativeState() {
    const prosperity = {};
    COOP_DISTRICTS.forEach(district => prosperity[district] = 0);
    return {
        unlocked: false,
        unlockedDay: null,
        contractWeek: -1,
        contracts: [],
        completedContracts: 0,
        reputation: 0,
        prosperity: prosperity,
        lastEvaluationYear: 0,
        lastEvaluationCompletedContracts: 0
    };
}

function normalizeCooperativeState(raw) {
    const state = Object.assign(createDefaultCooperativeState(), raw || {});
    state.prosperity = Object.assign(createDefaultCooperativeState().prosperity, raw?.prosperity || {});
    state.contracts = Array.isArray(raw?.contracts) ? raw.contracts.filter(Boolean) : [];
    state.completedContracts = Math.max(0, Number(state.completedContracts) || 0);
    state.reputation = Math.max(0, Number(state.reputation) || 0);
    state.contractWeek = Number.isInteger(state.contractWeek) ? state.contractWeek : -1;
    state.lastEvaluationYear = Math.max(0, Number(state.lastEvaluationYear) || 0);
    state.lastEvaluationCompletedContracts = Math.max(0, Number(state.lastEvaluationCompletedContracts) || 0);
    return state;
}

function getCooperativeState() {
    if (typeof player === 'undefined' || !player) return null;
    player.cooperativeExchange = normalizeCooperativeState(player.cooperativeExchange);
    return player.cooperativeExchange;
}

function hasCompletedMainQuest() {
    return !!(typeof player !== 'undefined' && player?.quests?.some(quest =>
        quest && quest.og_name === 'Save Cloudy Meadows' && quest.done
    ));
}

function unlockCooperativeExchange() {
    const state = getCooperativeState();
    if (!state || state.unlocked) return false;
    state.unlocked = true;
    state.unlockedDay = typeof days === 'number' ? days : 0;
    refreshCooperativeContracts(true);
    return true;
}

function getCooperativeWeek() {
    return Math.max(0, Math.floor((Number(days) || 0) / 5));
}

function isCooperativeItemEnabled(itemName) {
    const itemNum = typeof item_name_to_num === 'function' ? item_name_to_num(itemName) : undefined;
    if (itemNum === undefined) return false;
    return typeof getEffectiveItem !== 'function' || getEffectiveItem(itemNum);
}

function refreshCooperativeContracts(force = false) {
    const state = getCooperativeState();
    if (!state || !state.unlocked) return;
    const week = getCooperativeWeek();
    if (!force && state.contractWeek === week && state.contracts.length) return;

    // Accepted work survives a rotation. Unaccepted and finished listings are replaced.
    const accepted = state.contracts.filter(contract => contract.status === 'accepted');
    const pool = COOP_CONTRACT_TEMPLATES.filter(template => isCooperativeItemEnabled(template.itemName));
    const tier = 1 + Math.floor(state.completedContracts / 8);
    const generated = [];
    for (let offset = 0; offset < pool.length && generated.length < 4; offset++) {
        const template = pool[(week * 4 + offset) % pool.length];
        if (!template || accepted.some(contract => contract.title === template.title) || generated.some(contract => contract.title === template.title)) continue;
        generated.push({
            id: `coop-${week}-${generated.length}-${template.itemName}`,
            district: template.district,
            title: template.title,
            itemName: template.itemName,
            amount: Math.ceil(template.amount * (1 + (tier - 1) * 0.2)),
            reward: Math.ceil(template.reward * (1 + (tier - 1) * 0.3)),
            prosperityReward: Math.min(5, 1 + Math.floor(tier / 2)),
            status: 'available',
            postedWeek: week
        });
    }
    state.contractWeek = week;
    state.contracts = accepted.concat(generated).slice(0, 8);
}

function countPlayerItem(itemName) {
    if (typeof player === 'undefined' || !Array.isArray(player.inv)) return 0;
    return player.inv.reduce((total, item) => total + (item && item.name === itemName ? Number(item.amount) || 0 : 0), 0);
}

function removePlayerItem(itemName, amount) {
    if (countPlayerItem(itemName) < amount) return false;
    let remaining = amount;
    for (let i = 0; i < player.inv.length && remaining > 0; i++) {
        const item = player.inv[i];
        if (!item || item.name !== itemName) continue;
        const removed = Math.min(remaining, item.amount);
        item.amount -= removed;
        remaining -= removed;
        if (item.amount <= 0) player.inv[i] = 0;
    }
    return remaining === 0;
}

function acceptCooperativeContract(contractId) {
    const state = getCooperativeState();
    const contract = state?.contracts.find(entry => entry.id === contractId);
    if (!contract || contract.status !== 'available') return false;
    contract.status = 'accepted';
    return true;
}

function abandonCooperativeContract(contractId) {
    const state = getCooperativeState();
    const contract = state?.contracts.find(entry => entry.id === contractId);
    if (!contract || contract.status !== 'accepted') return false;
    state.contracts = state.contracts.filter(entry => entry.id !== contractId);
    return true;
}

function deliverCooperativeContract(contractId) {
    const state = getCooperativeState();
    const contract = state?.contracts.find(entry => entry.id === contractId);
    if (!contract || contract.status !== 'accepted') return false;
    if (!removePlayerItem(contract.itemName, contract.amount)) return false;

    contract.status = 'completed';
    state.completedContracts += 1;
    state.reputation += 1;
    state.prosperity[contract.district] = (state.prosperity[contract.district] || 0) + contract.prosperityReward;
    if (typeof addMoney === 'function') addMoney(contract.reward);
    if (typeof moneySound !== 'undefined' && moneySound?.play) moneySound.play();
    return true;
}

function getCooperativeRank(state) {
    if (state.reputation >= 24) return 'Cooperative Director';
    if (state.reputation >= 12) return 'Regional Partner';
    if (state.reputation >= 4) return 'Trusted Supplier';
    return 'Local Supplier';
}

function getCooperativeEvaluation(state) {
    const elapsedDays = Math.max(0, (Number(days) || 0) - (Number(state.unlockedDay) || 0));
    const availableYear = Math.floor(elapsedDays / 100);
    const contractsSinceLastEvaluation = state.completedContracts - state.lastEvaluationCompletedContracts;
    return {
        availableYear: availableYear,
        eligible: availableYear > state.lastEvaluationYear && contractsSinceLastEvaluation >= 4,
        contractsSinceLastEvaluation: contractsSinceLastEvaluation,
        daysUntilNext: Math.max(0, ((state.lastEvaluationYear + 1) * 100) - elapsedDays)
    };
}

function claimCooperativeEvaluation() {
    const state = getCooperativeState();
    if (!state) return false;
    const evaluation = getCooperativeEvaluation(state);
    if (!evaluation.eligible) return false;
    const prosperityTotal = Object.values(state.prosperity).reduce((sum, value) => sum + (Number(value) || 0), 0);
    const reward = 500 + prosperityTotal * 10;
    state.lastEvaluationYear = evaluation.availableYear;
    state.lastEvaluationCompletedContracts = state.completedContracts;
    addMoney(reward);
    return reward;
}

let cooperativeWasPaused = false;

function closeCooperativeExchange() {
    const overlay = document.getElementById('cooperative-exchange-overlay');
    if (overlay) overlay.style.display = 'none';
    if (!cooperativeWasPaused && typeof paused !== 'undefined') paused = false;
    if (typeof updateCanvasPointerEvents === 'function') updateCanvasPointerEvents();
}

function showCooperativeExchange() {
    const state = getCooperativeState();
    if (!state) return;
    if (hasCompletedMainQuest()) unlockCooperativeExchange();
    refreshCooperativeContracts();

    let overlay = document.getElementById('cooperative-exchange-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'cooperative-exchange-overlay';
        overlay.className = 'cooperative-exchange-overlay';
        overlay.addEventListener('click', event => {
            if (event.target === overlay) closeCooperativeExchange();
        });
        document.body.appendChild(overlay);
    }

    const wasAlreadyOpen = overlay.style.display === 'flex';
    if (!wasAlreadyOpen) cooperativeWasPaused = typeof paused !== 'undefined' ? paused : false;
    if (typeof paused !== 'undefined') paused = true;
    overlay.innerHTML = '';
    overlay.style.display = 'flex';

    const panel = document.createElement('section');
    panel.className = 'cooperative-exchange-panel';
    const close = document.createElement('button');
    close.className = 'cooperative-exchange-close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close Cooperative Exchange');
    close.addEventListener('click', closeCooperativeExchange);
    panel.appendChild(close);

    const title = document.createElement('h2');
    title.textContent = 'Regional Cooperative Exchange';
    panel.appendChild(title);

    if (!state.unlocked) {
        const locked = document.createElement('div');
        locked.className = 'cooperative-exchange-locked';
        locked.innerHTML = '<strong>Exchange closed</strong><span>Save Cloudy Meadows to unlock Cooperative Mode.</span>';
        panel.appendChild(locked);
        overlay.appendChild(panel);
        if (typeof updateCanvasPointerEvents === 'function') updateCanvasPointerEvents();
        return;
    }

    const summary = document.createElement('div');
    summary.className = 'cooperative-summary';
    summary.innerHTML = `<span>Rank: <strong>${getCooperativeRank(state)}</strong></span><span>Completed: <strong>${state.completedContracts}</strong></span><span>Listings refresh in <strong>${5 - ((Number(days) || 0) % 5)} day(s)</strong></span>`;
    panel.appendChild(summary);

    const prosperity = document.createElement('div');
    prosperity.className = 'cooperative-prosperity';
    COOP_DISTRICTS.forEach(district => {
        const badge = document.createElement('span');
        badge.textContent = `${district}: ${state.prosperity[district] || 0}`;
        prosperity.appendChild(badge);
    });
    panel.appendChild(prosperity);

    const evaluation = getCooperativeEvaluation(state);
    const evaluationCard = document.createElement('div');
    evaluationCard.className = 'cooperative-evaluation';
    if (evaluation.availableYear > state.lastEvaluationYear) {
        const needed = Math.max(0, 4 - evaluation.contractsSinceLastEvaluation);
        evaluationCard.textContent = needed > 0
            ? `Annual evaluation ready after ${needed} more completed contract(s).`
            : 'Annual evaluation ready.';
        if (evaluation.eligible) {
            const claim = document.createElement('button');
            claim.textContent = 'Complete Evaluation';
            claim.addEventListener('click', () => {
                claimCooperativeEvaluation();
                showCooperativeExchange();
            });
            evaluationCard.appendChild(claim);
        }
    } else {
        evaluationCard.textContent = `Next annual evaluation in ${evaluation.daysUntilNext} day(s).`;
    }
    panel.appendChild(evaluationCard);

    const list = document.createElement('div');
    list.className = 'cooperative-contract-list';
    const visibleContracts = state.contracts.filter(contract => contract.status !== 'completed');
    if (!visibleContracts.length) {
        list.textContent = 'All posted contracts are complete. New listings arrive next week.';
    }
    visibleContracts.forEach(contract => {
        const card = document.createElement('article');
        card.className = `cooperative-contract cooperative-contract-${contract.status}`;
        const owned = countPlayerItem(contract.itemName);
        card.innerHTML = `<div class="cooperative-contract-district">${contract.district}</div><h3>${contract.title}</h3><p>Deliver ${contract.amount} ${contract.itemName}</p><p>You have ${owned} · Reward ${contract.reward} coins · +${contract.prosperityReward} prosperity</p>`;
        const action = document.createElement('button');
        if (contract.status === 'available') {
            action.textContent = 'Accept Contract';
            action.addEventListener('click', () => {
                acceptCooperativeContract(contract.id);
                showCooperativeExchange();
            });
        } else {
            action.textContent = owned >= contract.amount ? 'Deliver Order' : `Need ${contract.amount - owned} More`;
            action.disabled = owned < contract.amount;
            action.addEventListener('click', () => {
                deliverCooperativeContract(contract.id);
                showCooperativeExchange();
            });
            const abandon = document.createElement('button');
            abandon.className = 'cooperative-contract-abandon';
            abandon.textContent = 'Abandon';
            abandon.addEventListener('click', () => {
                abandonCooperativeContract(contract.id);
                showCooperativeExchange();
            });
            card.appendChild(abandon);
        }
        card.appendChild(action);
        list.appendChild(card);
    });
    panel.appendChild(list);
    overlay.appendChild(panel);
    if (typeof updateCanvasPointerEvents === 'function') updateCanvasPointerEvents();
}

window.addEventListener('questCompleted', event => {
    if (event.detail?.quest?.og_name === 'Save Cloudy Meadows') unlockCooperativeExchange();
});

window.addEventListener('newDay', () => refreshCooperativeContracts());
