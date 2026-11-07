// Statistics screen: stats tables with set filter, CSV exports and reset.
import { ACTIONS, getEvents, resetEvents } from './actions.js';
import { getPlayers } from './players.js';
import { aggregate, winnersErrors, sumOpp, setsWithEvents } from './stats.js';
import { getTeamNames, clearSetSetups } from './match.js';
import { clearHistory } from './history.js';
import { buildRotationTable, buildPointLog, pointLogCsvRows } from './rally-view.js';
import { buildEfficiencyTable } from './efficiency-view.js';
import { buildPointSources } from './point-sources.js';
import { el, button, notifyChange } from './dom.js';
import { exportCSV } from './export-csv.js';

const TABS = [['players', 'Players'], ['rotations', 'Rotations'], ['points', 'Points']];

let statsFilter = 'total';
let statsTab = 'players';

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
        clearHistory();
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
    document.getElementById('export-csv').hidden = statsTab !== 'players';
    document.getElementById('export-points-csv').hidden = statsTab !== 'points';
    const disp = document.getElementById('stats-display');
    disp.innerHTML = '';
    if (events.length === 0) {
        disp.appendChild(el('p', 'empty-state', 'No actions recorded yet. Track a rally on the Actions screen to see statistics here.'));
        return;
    }

    disp.appendChild(renderTabs());
    const filteredSets = statsFilter === 'total' ? sets : [Number(statsFilter)];
    if (statsTab === 'players') {
        const agg = aggregate(events, statsFilter);
        disp.appendChild(section(buildStatsTable(agg), { cardClass: 'table-card' }));
        const efficiency = buildEfficiencyTable(agg);
        if (efficiency) {
            disp.appendChild(section(efficiency, {
                title: 'Efficiency',
                cardClass: 'table-card',
                note: 'Share of attempts. Good: reception +. Kill: attack point. Eff: kills minus errors per attack.'
            }));
        }
    } else if (statsTab === 'rotations') {
        const rotations = buildRotationTable(filteredSets);
        disp.appendChild(rotations
            ? section(rotations, { cardClass: 'table-card', note: 'Rotation = setter position. Side-out: points won when receiving. Break: points won when serving.' })
            : emptyTab('No points with a known rotation yet. Set the lineup to track rotations.'));
    } else {
        const sources = buildPointSources(filteredSets);
        const pointLog = buildPointLog(filteredSets);
        if (!sources && !pointLog) disp.appendChild(emptyTab('No points recorded yet.'));
        if (sources) disp.appendChild(section(sources, { title: 'Where points came from' }));
        if (pointLog) disp.appendChild(section(pointLog, { title: 'Point log' }));
    }
}

function renderTabs() {
    const tabs = el('div', 'action-select-wrap stats-tabs');
    tabs.setAttribute('role', 'tablist');
    TABS.forEach(([tab, label]) => {
        const btn = button(label, 'action-select-btn' + (tab === statsTab ? ' active' : ''), () => {
            statsTab = tab;
            renderStats();
        });
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', String(tab === statsTab));
        tabs.appendChild(btn);
    });
    return tabs;
}

function emptyTab(text) {
    return el('p', 'empty-state', text);
}

function section(content, { title = '', cardClass = '', note = '' } = {}) {
    const wrap = el('section', 'stats-section');
    if (title) wrap.appendChild(el('h3', null, title));
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
