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

// `{ setterStart: 1-6, weServeFirst: bool, ourSide?: 'left' | 'right' }` or null.
export function getSetSetup(set) {
    return config.sets[set] || null;
}

// The half our team plays on in `set`, as seen from the sideline.
export function getOurSide(set) {
    return getSetSetup(set)?.ourSide || defaultSide(set);
}

// Set 2 starts on the same side as set 1, every later set on the other one.
export function defaultSide(set) {
    const first = getSetSetup(1)?.ourSide || 'left';
    if (set <= 2) return first;
    return first === 'left' ? 'right' : 'left';
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
        setterPos: setup ? setup.setterStart : null,
        setterSwapped: false
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
        if (e.type === 'setterSwap') {
            state.setterSwapped = !state.setterSwapped;
            return;
        }
        const winner = pointWinner(e);
        if (!winner) return;

        const servedBy = state.serving;
        const rotation = rotationOf(state);
        state[winner]++;
        if (winner === 'us' && servedBy === 'them' && state.setterPos) {
            state.setterPos = rotate(state.setterPos);
        }
        state.serving = winner;
        state.log.push({ us: state.us, them: state.them, winner, event: e, servedBy, rotation });
    });
    return state;
}

// The rotation is where the playing setter stands. `setterPos` is the setter slot's position, which a double
// substitution hands to the opposite; the slots still decide who stands where.
export function rotationOf(state) {
    if (!state.setterPos) return null;
    return state.setterSwapped ? courtPosition('oppositeHitter', state.setterPos) : state.setterPos;
}

// The role a slot's player currently plays: setter and opposite trade places during a double substitution.
export function playingRole(role, state) {
    if (!state.setterSwapped) return role;
    if (role === 'setter') return 'oppositeHitter';
    if (role === 'oppositeHitter') return 'setter';
    return role;
}

// Per rotation (setter position): points won and lost, split by whether we served the rally.
export function rotationStats(sets, events = getEvents()) {
    const rows = {};
    for (let r = 1; r <= 6; r++) rows[r] = { won: 0, lost: 0, servRallies: 0, servWon: 0, recvRallies: 0, recvWon: 0 };

    sets.forEach(set => replaySet(set, events).log.forEach(entry => {
        if (!entry.rotation) return;
        const row = rows[entry.rotation];
        const won = entry.winner === 'us';
        if (won) row.won++;
        else row.lost++;
        if (entry.servedBy === 'us') {
            row.servRallies++;
            if (won) row.servWon++;
        } else if (entry.servedBy === 'them') {
            row.recvRallies++;
            if (won) row.recvWon++;
        }
    }));
    return rows;
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

// Nothing more is recorded in a set once it or the match is decided; Undo still works.
export function isSetInPlay(state, set) {
    return !isSetOver(state, set) && !isMatchOver(getMatchScore());
}
