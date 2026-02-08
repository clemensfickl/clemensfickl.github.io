// actions.js: handles game actions and statistics tracking.

const actions = {
    SERVICE: 'Serve',
    RECEIVE: 'Recv',
    ATTACK: 'Attack',
    BLOCK: 'Block',
    OTHER: 'Other'
};

let playerStatistics = {}; // { [playerId]: { sets: { [setNumber]: { [actionName]: ... } } } }
let currentSet = 1;
let actionStack = []; // Store all actions for undo

function getPlayerStatistics() {
    const stats = localStorage.getItem('volleyballPlayerStatistics');
    if (stats) {
        playerStatistics = JSON.parse(stats);
    }
    // Ensure the structure is what we expect, migrate if necessary
    Object.keys(playerStatistics).forEach(playerId => {
        if (!playerStatistics[playerId].sets) {
            // Old format detected, migrate it.
            const oldStats = playerStatistics[playerId];
            playerStatistics[playerId] = { sets: { 1: oldStats } };
        }
    });
    return playerStatistics;
}

function savePlayerStatistics() {
    localStorage.setItem('volleyballPlayerStatistics', JSON.stringify(playerStatistics));
}

function saveActionStack() {
    localStorage.setItem('volleyballActionStack', JSON.stringify(actionStack));
}

function loadActionStack() {
    const stack = localStorage.getItem('volleyballActionStack');
    if (stack) {
        actionStack = JSON.parse(stack);
    }
}

function recordPlayerAction(playerId, action, outcome) {
    if (!playerStatistics[playerId]) {
        playerStatistics[playerId] = { sets: {} };
    }
    if (!playerStatistics[playerId].sets[currentSet]) {
        playerStatistics[playerId].sets[currentSet] = {};
    }
    if (!playerStatistics[playerId].sets[currentSet][action]) {
        playerStatistics[playerId].sets[currentSet][action] = { positive: 0, neutral: 0, negative: 0 };
    }

    playerStatistics[playerId].sets[currentSet][action][outcome]++;
    
    // Push to action stack for undo
    actionStack.push({ playerId, action, outcome, set: currentSet });
    saveActionStack();
    
    savePlayerStatistics();
}

function undoLastAction() {
    if (actionStack.length === 0) {
        return false; // Nothing to undo
    }

    const lastAction = actionStack.pop();
    const { playerId, action, outcome, set } = lastAction;
    
    if (playerStatistics[playerId] && 
        playerStatistics[playerId].sets[set] && 
        playerStatistics[playerId].sets[set][action] &&
        playerStatistics[playerId].sets[set][action][outcome] > 0) {
        
        playerStatistics[playerId].sets[set][action][outcome]--;
        saveActionStack();
        savePlayerStatistics();
        return true;
    }
    
    return false;
}

function getCurrentSet() {
    const savedSet = localStorage.getItem('volleyballCurrentSet');
    currentSet = savedSet ? parseInt(savedSet, 10) : 1;
    return currentSet;
}

function setCurrentSet(setNumber) {
    currentSet = parseInt(setNumber, 10);
    localStorage.setItem('volleyballCurrentSet', currentSet);
}

function resetAllStatistics() {
    playerStatistics = {};
    actionStack = [];
    currentSet = 1;
    localStorage.removeItem('volleyballPlayerStatistics');
    localStorage.removeItem('volleyballActionStack');
    localStorage.setItem('volleyballCurrentSet', '1');
}

// expose functions
export { actions, recordPlayerAction, getPlayerStatistics, getCurrentSet, setCurrentSet, undoLastAction, loadActionStack, resetAllStatistics };