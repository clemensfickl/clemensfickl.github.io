// Statistics screen: stats tables with set filter, CSV exports and reset.
import { ACTIONS, getEvents, resetEvents } from './actions.js';
import { getPlayers } from './players.js';
import { aggregate, winnersErrors, sumOpp, setsWithEvents } from './stats.js';
import { getTeamNames, clearSetSetups } from './match.js';
import { buildRotationTable, buildPointLog, pointLogCsvRows } from './rally-view.js';
import { el, notifyChange } from './dom.js';
import { exportCSV } from './export-csv.js';

let statsFilter = 'total';

export function initStats() {
    document.getElementById('export-csv').addEventListener('click', () => {
        exportCSV(statsCsvRows(), 'volleyball-stats.csv');
    });
    document.getElementById('export-points-csv').addEventListener('click', () => {
        exportCSV(pointLogCsvRows(), 'volleyball-point-log.csv');
    });
    document.getElementById('reset-stats').addEventListener('click', () => {
        if (!confirm('Start a new match? This deletes all recorded actions, scores and set lineups. Players and team names are kept. This cannot be undone!')) return;
        resetEvents();
        clearSetSetups();
        statsFilter = 'total';
        notifyChange();
    });
}

export function renderStats() {
    const events = getEvents();
    const sets = setsWithEvents(events);
    if (statsFilter !== 'total' && !sets.includes(Number(statsFilter))) statsFilter = 'total';

    renderFilter(sets);
    const disp = document.getElementById('stats-display');
    disp.innerHTML = '';
    if (events.length === 0) {
        disp.appendChild(el('p', 'empty-state', 'No actions recorded yet. Track a rally on the Actions screen to see statistics here.'));
        return;
    }

    const filteredSets = statsFilter === 'total' ? sets : [Number(statsFilter)];
    disp.appendChild(section('Players', buildStatsTable(aggregate(events, statsFilter)), 'table-card'));
    const rotations = buildRotationTable(filteredSets);
    if (rotations) {
        disp.appendChild(section('Rotations', rotations, 'table-card',
            'Rotation = setter position. Side-out: points won when receiving. Break: points won when serving.'));
    }
    const pointLog = buildPointLog(filteredSets);
    if (pointLog) disp.appendChild(section('Point log', pointLog));
}

function section(title, content, cardClass = '', note = '') {
    const wrap = el('section', 'stats-section');
    wrap.appendChild(el('h3', null, title));
    const card = el('div', `card ${cardClass}`.trim());
    card.appendChild(content);
    wrap.appendChild(card);
    if (note) wrap.appendChild(el('p', 'stats-note', note));
    return wrap;
}

function renderFilter(sets) {
    const container = document.getElementById('stats-filter-container');
    container.innerHTML = '';
    const select = el('select', 'btn');
    select.appendChild(new Option('Total (All Sets)', 'total', false, statsFilter === 'total'));
    sets.forEach(s => select.appendChild(new Option(`Set ${s}`, s, false, String(statsFilter) === String(s))));
    select.addEventListener('change', () => {
        statsFilter = select.value;
        renderStats();
    });
    container.appendChild(select);
}

function cell(tag, text, className) {
    return el(tag, className, text);
}

function buildStatsTable(agg) {
    const table = el('table', 'stats-table');
    const thead = el('thead');
    const head1 = el('tr');
    const head2 = el('tr');

    const playerTh = cell('th', 'Player', 'player-name-col');
    playerTh.rowSpan = 2;
    head1.appendChild(playerTh);
    ['+', '-'].forEach(symbol => {
        const th = cell('th', symbol);
        th.rowSpan = 2;
        head1.appendChild(th);
    });
    ACTIONS.forEach(action => {
        const th = cell('th', action, 'action-header');
        th.colSpan = 3;
        head1.appendChild(th);
        ['+', '~', '-'].forEach(symbol => head2.appendChild(cell('th', symbol, symbol === '+' ? 'group-start' : null)));
    });
    thead.append(head1, head2);
    table.appendChild(thead);

    const tbody = el('tbody');
    getPlayers().forEach(p => {
        const counts = agg.players[p.id];
        if (!counts) return;
        const { winners, errors } = winnersErrors(counts);
        const row = el('tr');
        row.appendChild(cell('td', p.name, 'player-name-col'));
        row.appendChild(cell('td', winners || '', 'stat-positive'));
        row.appendChild(cell('td', errors || '', 'stat-negative'));
        ACTIONS.forEach(action => {
            row.appendChild(cell('td', counts[action].positive || '', 'stat-positive group-start'));
            row.appendChild(cell('td', counts[action].neutral || ''));
            row.appendChild(cell('td', counts[action].negative || '', 'stat-negative'));
        });
        tbody.appendChild(row);
    });

    const oppPoints = sumOpp(agg.oppPoints);
    const oppErrors = sumOpp(agg.oppErrors);
    if (oppPoints > 0 || oppErrors > 0) {
        const row = el('tr', 'opponent-total-row');
        row.appendChild(cell('td', getTeamNames().opponent, 'player-name-col'));
        row.appendChild(cell('td', oppPoints || '', 'stat-positive'));
        row.appendChild(cell('td', oppErrors || '', 'stat-negative'));
        ACTIONS.forEach(action => {
            row.appendChild(cell('td', agg.oppPoints[action] || '', 'stat-positive group-start'));
            row.appendChild(cell('td', ''));
            row.appendChild(cell('td', agg.oppErrors[action] || '', 'stat-negative'));
        });
        tbody.appendChild(row);
    }

    table.appendChild(tbody);
    return table;
}

function playerCsvRow(id, name, counts) {
    const { winners, errors } = winnersErrors(counts);
    const row = { id, name, Winners: winners || '', Errors: errors || '' };
    ACTIONS.forEach(action => {
        row[`${action}_+`] = counts[action].positive || '';
        row[`${action}_~`] = counts[action].neutral || '';
        row[`${action}_-`] = counts[action].negative || '';
    });
    return row;
}

function hasOppStats(agg) {
    return sumOpp(agg.oppPoints) > 0 || sumOpp(agg.oppErrors) > 0;
}

function opponentCsvRow(name, agg) {
    const row = { id: 'opponent', name, Winners: sumOpp(agg.oppPoints) || '', Errors: sumOpp(agg.oppErrors) || '' };
    ACTIONS.forEach(action => {
        row[`${action}_+`] = agg.oppPoints[action] || '';
        row[`${action}_~`] = '';
        row[`${action}_-`] = agg.oppErrors[action] || '';
    });
    return row;
}

function statsCsvRows() {
    const events = getEvents();
    const total = aggregate(events);
    const perSet = setsWithEvents(events).map(s => [s, aggregate(events, s)]);
    const rows = [];

    getPlayers().forEach(p => {
        if (!total.players[p.id]) return;
        rows.push(playerCsvRow(p.id, p.name, total.players[p.id]));
        perSet.forEach(([s, agg]) => {
            if (agg.players[p.id]) rows.push(playerCsvRow(p.id, `${p.name} Set ${s}`, agg.players[p.id]));
        });
    });

    if (hasOppStats(total)) {
        const opponent = getTeamNames().opponent;
        rows.push(opponentCsvRow(opponent, total));
        perSet.forEach(([s, agg]) => {
            if (hasOppStats(agg)) rows.push(opponentCsvRow(`${opponent} Set ${s}`, agg));
        });
    }
    return rows;
}
