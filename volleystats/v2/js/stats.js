// Aggregates the event log into per-player and opponent counts.
import { ACTIONS } from './actions.js';

export const SCORING_ACTIONS = ['Serv', 'Atk', 'Blk'];

function emptyPlayerCounts() {
    return Object.fromEntries(ACTIONS.map(a => [a, { positive: 0, neutral: 0, negative: 0 }]));
}

function emptyOppCounts() {
    return Object.fromEntries(ACTIONS.map(a => [a, 0]));
}

// `setFilter` is a set number or 'total'.
export function aggregate(events, setFilter = 'total') {
    const result = { players: {}, oppErrors: emptyOppCounts(), oppPoints: emptyOppCounts() };
    events.forEach(e => {
        if (setFilter !== 'total' && e.set !== Number(setFilter)) return;
        if (e.type === 'player') {
            if (!result.players[e.playerId]) result.players[e.playerId] = emptyPlayerCounts();
            result.players[e.playerId][e.action][e.outcome]++;
        } else if (e.type === 'oppError') {
            result.oppErrors[e.action]++;
        } else if (e.type === 'oppPoint') {
            result.oppPoints[e.action]++;
        }
    });
    return result;
}

export function playerCounts(agg, playerId) {
    return agg.players[playerId] || emptyPlayerCounts();
}

export function winnersErrors(counts) {
    let winners = 0;
    let errors = 0;
    ACTIONS.forEach(a => {
        if (SCORING_ACTIONS.includes(a)) winners += counts[a].positive;
        errors += counts[a].negative;
    });
    return { winners, errors };
}

export function sumOpp(oppCounts) {
    return Object.values(oppCounts).reduce((sum, n) => sum + n, 0);
}

export function setsWithEvents(events) {
    return [...new Set(events.map(e => e.set))].sort((a, b) => a - b);
}
