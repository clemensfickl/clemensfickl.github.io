// Match logic derived from the event log: who won each point and the resulting score.
import { load, save } from './storage.js';
import { getEvents } from './actions.js';
import { SCORING_ACTIONS } from './stats.js';

let config = { teamName: '', opponentName: '' };

export function loadMatch() {
    config = { ...config, ...load('match', {}) };
}

function saveMatch() {
    save('match', config);
}

export function getTeamNames() {
    return { team: config.teamName || 'Us', opponent: config.opponentName || 'Opponent' };
}

export function getRawTeamNames() {
    return { team: config.teamName, opponent: config.opponentName };
}

export function setTeamNames(teamName, opponentName) {
    config.teamName = teamName;
    config.opponentName = opponentName;
    saveMatch();
}

// Returns 'us', 'them', or null if the event did not end a rally.
export function pointWinner(event) {
    switch (event.type) {
        case 'player':
            if (event.outcome === 'negative') return 'them';
            if (event.outcome === 'positive' && SCORING_ACTIONS.includes(event.action)) return 'us';
            return null;
        case 'oppError':
            return 'us';
        case 'oppPoint':
            return 'them';
        default:
            return null;
    }
}

export function replaySet(set, events = getEvents()) {
    const state = { us: 0, them: 0, log: [] };
    events.forEach(e => {
        if (e.set !== set) return;
        const winner = pointWinner(e);
        if (!winner) return;
        state[winner]++;
        state.log.push({ us: state.us, them: state.them, winner, event: e });
    });
    return state;
}
