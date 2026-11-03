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
    Object.entries(rows).forEach(([rotation, r]) => {
        if (r.won + r.lost === 0) return;
        const tr = el('tr');
        tr.appendChild(el('td', 'player-name-col', `R${rotation}`));
        tr.appendChild(el('td', 'stat-positive', r.won));
        tr.appendChild(el('td', 'stat-negative', r.lost));
        tr.appendChild(rateCell(r.recvWon, r.recvRallies));
        tr.appendChild(rateCell(r.servWon, r.servRallies));
        tbody.appendChild(tr);
    });
    if (!tbody.children.length) return null;
    table.appendChild(tbody);
    return table;
}

function rateCell(won, total) {
    const td = el('td', 'rate-cell', percent(won, total));
    if (total) td.appendChild(el('span', 'rate-detail', `${won}/${total}`));
    return td;
}

function describe(entry, playersById, names) {
    const e = entry.event;
    switch (e.type) {
        case 'player':
            return `${playersById[e.playerId] || 'Unknown'} · ${e.action} ${OUTCOME_SYMBOLS[e.outcome]}`;
        case 'oppPoint':
            return `${names.opponent} · ${e.action} +`;
        case 'oppError':
            return `${names.opponent} · ${e.action} -`;
        default:
            return 'Adjusted';
    }
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
            li.appendChild(el('span', 'point-desc', describe(entry, playersById, names)));
            if (entry.setterPos) li.appendChild(el('span', 'point-rot', `R${entry.setterPos}`));
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
                rotation: entry.setterPos || '',
                type: e.type,
                player: e.type === 'player' ? playersById[e.playerId] || 'Unknown' : '',
                action: e.action || '',
                outcome: e.outcome ? OUTCOME_SYMBOLS[e.outcome] : ''
            });
        });
    });
    return rows;
}
