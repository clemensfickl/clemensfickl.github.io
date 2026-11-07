// Statistics built from whole rallies: what happened between one point and the next.
import { getEvents } from './actions.js';
import { replaySet } from './match.js';

// Every completed rally of the sets, as point log entries from `replaySet` with their set.
export function rallies(sets, events = getEvents()) {
    return sets.flatMap(set => replaySet(set, events).log.map(entry => ({ ...entry, set })));
}

const isOur = (e, action) => e?.type === 'player' && e.action === action;

// Receiving rallies grouped by our first reception. An opponent ace counts as a failed reception; rallies
// without a recorded reception (an opponent serve error, a manually added point) are left out.
// First ball: the action right after the reception is our attack point.
export function receptionSideOut(sets) {
    const rows = Object.fromEntries(['positive', 'neutral', 'negative']
        .map(q => [q, { rallies: 0, won: 0, firstBall: 0 }]));
    rallies(sets).forEach(({ rally, winner, servedBy }) => {
        if (servedBy !== 'them') return;
        const index = rally.findIndex(e => isOur(e, 'Recv'));
        if (index === -1) {
            if (rally[0].type === 'oppPoint' && rally[0].action === 'Serv') rows.negative.rallies++;
            return;
        }
        const row = rows[rally[index].outcome];
        row.rallies++;
        if (winner === 'us') row.won++;
        const next = rally[index + 1];
        if (isOur(next, 'Atk') && next.outcome === 'positive') row.firstBall++;
    });
    return rows;
}

// The longest run of consecutive points per team in a set's `replaySet` log, with the scores it went from
// and to; null for a team without points.
export function longestRuns(log) {
    const best = { us: null, them: null };
    let start = 0;
    log.forEach((entry, i) => {
        if (i > 0 && log[i - 1].winner !== entry.winner) start = i;
        const length = i - start + 1;
        if (!best[entry.winner] || length > best[entry.winner].length) {
            const before = start > 0 ? log[start - 1] : { us: 0, them: 0 };
            best[entry.winner] = { length, from: `${before.us}:${before.them}`, to: `${entry.us}:${entry.them}` };
        }
    });
    return best;
}

// Key figures of each set side by side.
export function setComparison(sets, events = getEvents()) {
    return sets.map(set => {
        const state = replaySet(set, events);
        const s = { set, us: state.us, them: state.them, recvRallies: 0, recvWon: 0, servRallies: 0, servWon: 0, aces: 0, ownErrors: 0, attacks: 0, kills: 0, attackErrors: 0 };
        state.log.forEach(({ winner, servedBy }) => {
            if (servedBy === 'them') {
                s.recvRallies++;
                if (winner === 'us') s.recvWon++;
            } else if (servedBy === 'us') {
                s.servRallies++;
                if (winner === 'us') s.servWon++;
            }
        });
        events.forEach(e => {
            if (e.set !== set || e.type !== 'player') return;
            if (e.outcome === 'negative') s.ownErrors++;
            if (e.action === 'Serv' && e.outcome === 'positive') s.aces++;
            if (e.action === 'Atk') {
                s.attacks++;
                if (e.outcome === 'positive') s.kills++;
                if (e.outcome === 'negative') s.attackErrors++;
            }
        });
        return s;
    });
}

export function pressureFrom(set) {
    return set === 5 ? 10 : 20;
}

// Rallies before and after one team reached `pressureFrom` points in the set (by the score before the rally).
export function pressureStats(sets) {
    const empty = () => ({ rallies: 0, recvRallies: 0, recvWon: 0, servRallies: 0, servWon: 0, ownErrors: 0 });
    const phases = { early: empty(), late: empty() };
    rallies(sets).forEach(({ us, them, winner, servedBy, event, set }) => {
        const before = Math.max(us - (winner === 'us' ? 1 : 0), them - (winner === 'them' ? 1 : 0));
        const p = phases[before >= pressureFrom(set) ? 'late' : 'early'];
        p.rallies++;
        if (servedBy === 'them') {
            p.recvRallies++;
            if (winner === 'us') p.recvWon++;
        } else if (servedBy === 'us') {
            p.servRallies++;
            if (winner === 'us') p.servWon++;
        }
        if (event.type === 'player' && event.outcome === 'negative') p.ownErrors++;
    });
    return phases;
}

// Our attacks per player, in total and per rotation (where the rotation is known).
// Returns { total: {all, [rotation]}, players: {id: {all, [rotation]}} }.
export function attackDistribution(sets) {
    const total = { all: 0 };
    const players = {};
    rallies(sets).forEach(({ rally, rotation }) => rally.forEach(e => {
        if (!isOur(e, 'Atk')) return;
        const p = players[e.playerId] || (players[e.playerId] = { all: 0 });
        p.all++;
        total.all++;
        if (rotation) {
            p[rotation] = (p[rotation] || 0) + 1;
            total[rotation] = (total[rotation] || 0) + 1;
        }
    }));
    return { total, players };
}

// Per server: rallies they served, how many we won, and the most points in a row in one service turn.
// The server is whoever recorded the rally's first serve; a turn without one keeps its last known server.
export function servingStats(sets) {
    const stats = {};
    let server = null;
    let run = 0;
    let lastSet = null;
    rallies(sets).forEach(({ rally, winner, servedBy, set }) => {
        if (set !== lastSet || servedBy !== 'us') {
            server = null;
            run = 0;
            lastSet = set;
            if (servedBy !== 'us') return;
        }
        if (isOur(rally[0], 'Serv') && rally[0].playerId !== server) {
            server = rally[0].playerId;
            run = 0;
        }
        if (!server) return;
        const s = stats[server] || (stats[server] = { serves: 0, won: 0, bestRun: 0 });
        s.serves++;
        if (winner === 'us') {
            s.won++;
            run++;
            s.bestRun = Math.max(s.bestRun, run);
        }
    });
    return stats;
}
