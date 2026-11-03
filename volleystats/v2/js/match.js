// Match logic derived from the event log: who won each point, the score, serve and rotation.
import { load, save } from './storage.js';
import { getEvents } from './actions.js';
import { SCORING_ACTIONS, setsWithEvents } from './stats.js';

// Serving order of a 5-1 lineup: the opposite stands across from the setter, middles and outsides across from each other.
export const ROLE_ORDER = ['setter', 'outsideHitter1', 'middleBlocker1', 'oppositeHitter', 'outsideHitter2', 'middleBlocker2'];
export const FRONT_ROW = [2, 3, 4];

let config = { teamName: '', opponentName: '', sets: {} };

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

// `{ setterStart: 1-6, weServeFirst: bool }` or null.
export function getSetSetup(set) {
    return config.sets[set] || null;
}

export function setSetSetup(set, setup) {
    config.sets[set] = setup;
    saveMatch();
}

export function clearSetSetups() {
    config.sets = {};
    config.liberoTarget = null;
    saveMatch();
}

// Rotating moves everyone one spot clockwise, so the setter goes from p to p-1 and from 1 to 6.
export function rotate(setterPos, steps = 1) {
    return ((setterPos - 1 - steps) % 6 + 6) % 6 + 1;
}

export function courtPosition(role, setterPos) {
    const index = ROLE_ORDER.indexOf(role);
    if (index === -1 || !setterPos) return null;
    return (setterPos - 1 + index) % 6 + 1;
}

const MIDDLES = ['middleBlocker1', 'middleBlocker2'];
const BACK_ROW = [5, 6, 1];

// The middle in the back row is replaced by the libero, except while serving from position 1.
export function liberoTarget(state) {
    return MIDDLES.find(role => {
        const pos = courtPosition(role, state.setterPos);
        return BACK_ROW.includes(pos) && !(pos === 1 && state.serving === 'us');
    }) || null;
}

// Stored as "set:role" so a new set or a changed target re-applies, while manual swaps persist until then.
export function getAppliedLiberoTarget() {
    return config.liberoTarget || null;
}

export function setAppliedLiberoTarget(key) {
    config.liberoTarget = key;
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
        case 'manualPoint':
            return event.to;
        default:
            return null;
    }
}

// Without a setup, serve becomes known after the first point and the rotation stays unknown.
export function replaySet(set, events = getEvents()) {
    const setup = getSetSetup(set);
    const state = {
        us: 0,
        them: 0,
        log: [],
        hasSetup: !!setup,
        serving: setup ? (setup.weServeFirst ? 'us' : 'them') : null,
        setterPos: setup ? setup.setterStart : null
    };

    events.forEach(e => {
        if (e.set !== set) return;
        if (e.type === 'rotate') {
            if (state.setterPos) state.setterPos = rotate(state.setterPos, e.delta);
            return;
        }
        if (e.type === 'switchServe') {
            if (state.serving) state.serving = state.serving === 'us' ? 'them' : 'us';
            return;
        }
        const winner = pointWinner(e);
        if (!winner) return;

        const servedBy = state.serving;
        const setterPos = state.setterPos;
        state[winner]++;
        if (winner === 'us' && servedBy === 'them' && state.setterPos) {
            state.setterPos = rotate(state.setterPos);
        }
        state.serving = winner;
        state.log.push({ us: state.us, them: state.them, winner, event: e, servedBy, setterPos });
    });
    return state;
}

export function isSetOver(state, set) {
    const target = set === 5 ? 15 : 25;
    return Math.max(state.us, state.them) >= target && Math.abs(state.us - state.them) >= 2;
}

export function getMatchScore(events = getEvents()) {
    const score = { us: 0, them: 0 };
    setsWithEvents(events).forEach(set => {
        const state = replaySet(set, events);
        if (isSetOver(state, set)) score[state.us > state.them ? 'us' : 'them']++;
    });
    return score;
}

export function isMatchOver(score) {
    return score.us >= 3 || score.them >= 3;
}
