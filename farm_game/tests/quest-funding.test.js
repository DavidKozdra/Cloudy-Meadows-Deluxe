'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { installBaseGlobals } = require('./support/mocks');
const { loadClasses } = require('./support/load');

installBaseGlobals();
global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};

loadClasses(
    ['i18n.js', 'classes/quest.js'],
    ['tGoal', 'fundingGoalRemainingCoins', 'FundingGoal']
);

test('Save Cloudy funding goal reloads with the exact coins left to collect', () => {
    global.player = { coins: 1375 };
    const goal = new FundingGoal(10000);
    goal.update();

    const saved = JSON.parse(JSON.stringify({
        coins: global.player.coins,
        goal
    }));

    global.player = { coins: saved.coins };
    const reloadedGoal = new FundingGoal(saved.goal.amount);
    reloadedGoal.done = saved.goal.done;
    reloadedGoal.update();

    assert.equal(fundingGoalRemainingCoins(reloadedGoal), 8625);
    assert.equal(reloadedGoal.name, 'Get 8625 more coins');
    assert.equal(tGoal(reloadedGoal), 'Get 8625 more coins');
});

test('completed funding goals display zero remaining after their coins are collected', () => {
    global.player = { coins: 10000 };
    const goal = new FundingGoal(10000);
    goal.update();

    assert.equal(global.player.coins, 0);
    assert.equal(goal.done, true);
    assert.equal(fundingGoalRemainingCoins(goal), 0);
    assert.equal(tGoal(goal), 'Get 0 more coins');
});
