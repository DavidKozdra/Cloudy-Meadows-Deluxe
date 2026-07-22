'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const { readPublic, extractFunction } = require('./support/load');

const source = readPublic('miscfunctions.js');
const tracker = { endCalls: 0 };
const sandbox = {
    window: {
        bridgeTutorialActive: true,
        bridgeTutorialStartLevel: 'Cloudy Meadows: Home'
    },
    endBridgeTutorial() {
        tracker.endCalls += 1;
        sandbox.window.bridgeTutorialActive = false;
    }
};

vm.runInNewContext(
    `${extractFunction(source, 'updateBridgeTutorialState')}
     globalThis.testUpdateBridgeTutorialState = updateBridgeTutorialState;`,
    sandbox
);

test('bridge tutorial stays active in its starting room', () => {
    assert.equal(
        sandbox.testUpdateBridgeTutorialState({ name: 'Cloudy Meadows: Home' }),
        true
    );
    assert.equal(tracker.endCalls, 0);
});

test('bridge tutorial ends and dismisses its banner after crossing rooms', () => {
    assert.equal(
        sandbox.testUpdateBridgeTutorialState({ name: 'Cloudy Meadows: Farm' }),
        false
    );
    assert.equal(tracker.endCalls, 1);
    assert.equal(sandbox.window.bridgeTutorialActive, false);
});
