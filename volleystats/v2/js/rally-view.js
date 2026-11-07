// Rally-based statistics: per-rotation table, point log with score progression and its CSV export.
import { getEvents } from './actions.js';
import { getPlayers } from './players.js';
import { replaySet, rotationStats, getTeamNames } from './match.js';
import { setsWithEvents } from './stats.js';
import { buildScoreChart } from './score-chart.js';
import { longestRuns } from './rally-stats.js';
import { el } from './dom.js';

const OUTCOME_SYMBOLS = { positive: '+', neutral: '~', negative: '-' };

export function percent(won, total) {
    return total ? `${Math.round((won / total) * 100)}%` : '–';
}

// A single header row whose first column holds the row labels.
export function tableHead(labels) {
    const thead = el('thead');
    const tr = el('tr');
    labels.forEach((label, i) => tr.appendChild(el('th', i === 0 ? 'player-name-col' : null, label)));
    thead.appendChild(tr);
    return thead;
}

export function buildRotationTable(sets) {
    const rows = rotationStats(sets);
    const table = el('table', 'stats-table rotation-table');
    table.appendChild(tableHead(['Rotation', 'Won', 'Lost', 'Side-out', 'Break']));

    const tbody = el('tbody');
    const total = { won: 0, lost: 0, recvWon: 0, recvRallies: 0, servWon: 0, servRallies: 0 };
    const played = Object.entries(rows).filter(([, r]) => r.won + r.lost > 0);
    if (played.length === 0) return null;
    const mostRecv = Math.max(...played.map(([, r]) => r.recvRallies));
    const mostServ = Math.max(...played.map(([, r]) => r.servRallies));
    const sideOuts = [];
    const breaks = [];
    played.forEach(([rotation, r]) => {
        const tr = rotationRow(`R${rotation}`, r);
        sideOuts.push({ td: tr.children[3], value: rateOrNull(r.recvWon, r.recvRallies, mostRecv) });
        breaks.push({ td: tr.children[4], value: rateOrNull(r.servWon, r.servRallies, mostServ) });
        tbody.appendChild(tr);
        Object.keys(total).forEach(key => { total[key] += r[key]; });
    });
    [sideOuts, breaks].forEach(column => {
        markBest(column);
        markWorst(column);
    });
    table.appendChild(tbody);
    const tfoot = el('tfoot');
    tfoot.appendChild(rotationRow('Overall', total));
    table.appendChild(tfoot);
    return table;
}

function rotationRow(label, r) {
    const tr = el('tr');
    tr.appendChild(el('td', 'player-name-col', label));
    tr.appendChild(el('td', 'stat-positive', r.won));
    tr.appendChild(el('td', 'stat-negative', r.lost));
    tr.appendChild(rateCell(r.recvWon, r.recvRallies));
    tr.appendChild(rateCell(r.servWon, r.servRallies));
    return tr;
}

// A percentage with the count it comes from below it, or – without any attempts.
export function rateCell(won, total) {
    const td = el('td', 'rate-cell', percent(won, total));
    if (total) td.appendChild(el('span', 'rate-detail', `${won}/${total}`));
    return td;
}

// Highlights the cells with a column's best value: the highest, or the lowest with `lowerIsBetter`.
// Entries with a null value don't compete, and nothing is highlighted while all competitors tie.
export function markBest(entries, lowerIsBetter = false, className = 'best-value') {
    const values = entries.map(e => e.value).filter(v => v !== null);
    if (values.length < 2) return;
    const best = lowerIsBetter ? Math.min(...values) : Math.max(...values);
    if (values.every(v => v === best)) return;
    entries.forEach(e => {
        if (e.value === best) e.td.classList.add(className);
    });
}

export function markWorst(entries, lowerIsBetter = false) {
    markBest(entries, !lowerIsBetter, 'worst-value');
}

// A rate competes for best or worst only with a fair share of the attempts, so 1 of 1 doesn't win.
export function rateOrNull(made, attempts, mostAttempts) {
    return attempts >= Math.max(3, mostAttempts / 3) ? made / attempts : null;
}

// How an action reads in the point log and history, for whichever team made it. A good reception and every ~
// keep the rally going.
const ACTION_LABELS = {
    positive: { Serv: 'Ace', Recv: 'Good reception', Atk: 'Attack point', Blk: 'Block point', Oth: 'Point' },
    neutral: { Serv: 'Serve in play', Recv: 'Reception', Atk: 'Attack defended', Blk: 'Block touch', Oth: 'Ball kept in play' },
    negative: { Serv: 'Serve error', Recv: 'Reception error', Atk: 'Attack error', Blk: 'Block error', Oth: 'Error' }
};

export function actionLabel(action, outcome) {
    return ACTION_LABELS[outcome]?.[action] || `${action} ${OUTCOME_SYMBOLS[outcome]}`;
}

// Who made the action (one of our players or the opponent) and what it was. The outcome is null for anything
// that wasn't a player or opponent action, such as score adjustments.
export function describeEvent(e, playersById, names) {
    switch (e.type) {
        case 'player':
            return { actor: playersById[e.playerId] || 'Unknown', side: 'us', outcome: e.outcome, text: actionLabel(e.action, e.outcome) };
        case 'oppPoint':
            return { actor: names.opponent, side: 'them', outcome: 'positive', text: actionLabel(e.action, 'positive') };
        case 'oppError':
            return { actor: names.opponent, side: 'them', outcome: 'negative', text: actionLabel(e.action, 'negative') };
        default:
            return { actor: null, side: null, outcome: null, text: 'Score adjusted' };
    }
}

// `outcome` styles the action text: positive, negative, or another class such as rally; null means adjusted.
export function renderDescription({ actor, side, outcome, text }) {
    const desc = el('span', 'point-desc');
    const actorCol = el('span', 'point-actor-col');
    if (actor) actorCol.appendChild(el('span', `point-actor ${side}`, actor));
    desc.appendChild(actorCol);
    desc.appendChild(el('span', 'point-action' + (outcome ? ` ${outcome}` : ' adjusted'), text));
    return desc;
}

export function buildPointLog(sets) {
    const playersById = Object.fromEntries(getPlayers().map(p => [p.id, p.name]));
    const names = getTeamNames();
    const wrap = el('div', 'point-log');

    sets.forEach((set, index) => {
        const state = replaySet(set);
        if (state.log.length === 0) return;

        const details = el('details', 'point-log-set');
        details.open = index === sets.length - 1;
        const summary = el('summary');
        summary.appendChild(el('span', 'point-log-title', `Set ${set}`));
        summary.appendChild(el('span', 'point-log-score', `${state.us}:${state.them}`));
        details.appendChild(summary);

        details.appendChild(buildScoreChart(state.log));
        details.appendChild(renderRuns(longestRuns(state.log), names));

        const list = el('ol', 'point-list');
        state.log.forEach(entry => {
            const li = el('li', `point-item ${entry.winner}`);
            li.appendChild(el('span', 'point-score', `${entry.us}:${entry.them}`));
            li.appendChild(renderDescription(describeEvent(entry.event, playersById, names)));
            if (entry.rotation) li.appendChild(el('span', 'point-rot', `R${entry.rotation}`));
            list.appendChild(li);
        });
        details.appendChild(list);
        wrap.appendChild(details);
    });
    return wrap.children.length ? wrap : null;
}

function renderRuns(runs, names) {
    const wrap = el('div', 'set-runs');
    wrap.appendChild(el('span', 'set-runs-label', 'Longest run'));
    [['us', names.team], ['them', names.opponent]].forEach(([side, name]) => {
        const run = runs[side];
        if (!run) return;
        const row = el('span', 'set-run');
        row.appendChild(el('span', `point-actor ${side}`, name));
        row.appendChild(el('strong', null, `${run.length}`));
        row.appendChild(el('span', 'set-run-range', `${run.from} → ${run.to}`));
        wrap.appendChild(row);
    });
    return wrap;
}

export function pointLogCsvRows() {
    const events = getEvents();
    const playersById = Object.fromEntries(getPlayers().map(p => [p.id, p.name]));
    const names = getTeamNames();
    const teamName = side => (side === 'us' ? names.team : side === 'them' ? names.opponent : '');
    const rows = [];

    setsWithEvents(events).forEach(set => {
        replaySet(set, events).log.forEach((entry, i) => {
            const e = entry.event;
            rows.push({
                set,
                point: i + 1,
                our_score: entry.us,
                their_score: entry.them,
                winner: teamName(entry.winner),
                served_by: teamName(entry.servedBy),
                rotation: entry.rotation || '',
                type: e.type,
                player: e.type === 'player' ? playersById[e.playerId] || 'Unknown' : '',
                action: e.action || '',
                outcome: e.outcome ? OUTCOME_SYMBOLS[e.outcome] : ''
            });
        });
    });
    return rows;
}
