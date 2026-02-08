// actions.js: handles game actions and statistics tracking.

const actions = {
    SERVICE: 'Serve',
    RECEIVE: 'Recv',
    ATTACK: 'Atk',
    BLOCK: 'Blk',
    OTHER: 'Oth'
};

let playerStatistics = {}; // { [playerId]: { sets: { [setNumber]: { [actionName]: ... } } } }
let opponentErrors = {}; // { [setNumber]: { [actionName]: count } }
let currentSet = 1;
let actionStack = []; // Store all actions for undo

function getPlayerStatistics() {
    const stats = localStorage.getItem('volleyballPlayerStatistics');
    if (stats) {
        playerStatistics = JSON.parse(stats);
    }
    return playerStatistics;
}

function savePlayerStatistics() {
    localStorage.setItem('volleyballPlayerStatistics', JSON.stringify(playerStatistics));
}

function getOpponentErrors() {
    const stats = localStorage.getItem('volleyballOpponentErrors');
    if (stats) {
        opponentErrors = JSON.parse(stats);
    }
    return opponentErrors;
}

function saveOpponentErrors() {
    localStorage.setItem('volleyballOpponentErrors', JSON.stringify(opponentErrors));
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
    actionStack.push({ type: 'player', playerId, action, outcome, set: currentSet });
    saveActionStack();
    
    savePlayerStatistics();
}

function recordOpponentError(action) {
    if (!Object.keys(opponentErrors).length) {
        getOpponentErrors();
    }
    if (!opponentErrors[currentSet]) {
        opponentErrors[currentSet] = {};
    }
    if (!opponentErrors[currentSet][action]) {
        opponentErrors[currentSet][action] = 0;
    }

    opponentErrors[currentSet][action]++;

    actionStack.push({ type: 'opponent', action, set: currentSet });
    saveActionStack();
    saveOpponentErrors();
}

function undoLastAction() {
    if (actionStack.length === 0) {
        return false; // Nothing to undo
    }

    const lastAction = actionStack.pop();
    const { playerId, action, outcome, set } = lastAction;
    const actionType = lastAction.type || 'player';

    if (actionType === 'opponent') {
        if (!opponentErrors[set]) {
            getOpponentErrors();
        }
        if (opponentErrors[set] && opponentErrors[set][action] > 0) {
            opponentErrors[set][action]--;
            saveActionStack();
            saveOpponentErrors();
            return true;
        }
        return false;
    }
    
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
    opponentErrors = {};
    actionStack = [];
    currentSet = 1;
    localStorage.removeItem('volleyballPlayerStatistics');
    localStorage.removeItem('volleyballOpponentErrors');
    localStorage.removeItem('volleyballActionStack');
    localStorage.setItem('volleyballCurrentSet', '1');
}

// expose functions
export { actions, recordPlayerAction, recordOpponentError, getPlayerStatistics, getOpponentErrors, getCurrentSet, setCurrentSet, undoLastAction, loadActionStack, resetAllStatistics };