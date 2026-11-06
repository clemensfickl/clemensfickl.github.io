// Rally-based statistics: per-rotation table, point log with score progression and its CSV export.
import { getEvents } from './actions.js';
import { getPlayers } from './players.js';
import { replaySet, rotationStats, getTeamNames } from './match.js';
import { setsWithEvents } from './stats.js';
import { el } from './dom.js';

const OUTCOME_SYMBOLS = { positive: '+', neutral: '~', negative: '-' };

function percent(won, total) {
    return total ? `${Math.round((won / total) * 100)}%` : '–';
}

export function buildRotationTable(sets) {
    const rows = rotationStats(sets);
    const table = el('table', 'stats-table rotation-table');
    const head = el('tr');
    ['Rotation', 'Won', 'Lost', 'Side-out', 'Break'].forEach((label, i) => {
        head.appendChild(el('th', i === 0 ? 'player-name-col' : null, label));
    });
    const thead = el('thead');
    thead.appendChild(head);
    table.appendChild(thead);

    const tbody = el('tbody');
    const total = { won: 0, lost: 0, recvWon: 0, recvRallies: 0, servWon: 0, servRallies: 0 };
    Object.entries(rows).forEach(([rotation, r]) => {
        if (r.won + r.lost === 0) return;
        tbody.appendChild(rotationRow(`R${rotation}`, r));
        Object.keys(total).forEach(key => { total[key] += r[key]; });
    });
    if (!tbody.children.length) return null;
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

function rateCell(won, total) {
    const td = el('td', 'rate-cell', percent(won, total));
    if (total) td.appendChild(el('span', 'rate-detail', `${won}/${total}`));
    return td;
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

        const strip = el('div', 'score-strip');
        state.log.forEach(entry => {
            const dot = el('span', `strip-point ${entry.winner}`);
            dot.title = `${entry.us}:${entry.them}`;
            strip.appendChild(dot);
        });
        details.appendChild(strip);

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
