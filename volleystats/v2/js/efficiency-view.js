// Ratings per player: how often serves, receptions and attacks went well or wrong, relative to their attempts.
import { getPlayers } from './players.js';
import { rateCell } from './rally-view.js';
import { el } from './dom.js';

// Eff (attack efficiency) is kills minus errors per attempt, so it can be negative.
const COLUMNS = [
    { action: 'Serv', label: 'Serve', rates: [['Ace', c => c.positive], ['Err', c => c.negative]] },
    { action: 'Recv', label: 'Reception', rates: [['Good', c => c.positive], ['Err', c => c.negative]] },
    { action: 'Atk', label: 'Attack', rates: [['Kill', c => c.positive], ['Eff', c => c.positive - c.negative]] }
];

const attempts = c => c.positive + c.neutral + c.negative;

// `agg` from stats.js `aggregate`. Returns null while no player has a serve, reception or attack.
export function buildEfficiencyTable(agg) {
    const rows = getPlayers()
        .filter(p => agg.players[p.id] && COLUMNS.some(col => attempts(agg.players[p.id][col.action]) > 0))
        .map(p => [p.name, agg.players[p.id]]);
    if (rows.length === 0) return null;

    const table = el('table', 'stats-table efficiency-table');
    const thead = el('thead');
    const head1 = el('tr');
    const head2 = el('tr');
    const playerTh = el('th', 'player-name-col', 'Player');
    playerTh.rowSpan = 2;
    head1.appendChild(playerTh);
    COLUMNS.forEach(col => {
        const th = el('th', 'action-header', col.label);
        th.colSpan = col.rates.length;
        head1.appendChild(th);
        col.rates.forEach(([label], i) => head2.appendChild(el('th', i === 0 ? 'group-start' : null, label)));
    });
    thead.append(head1, head2);
    table.appendChild(thead);

    const tbody = el('tbody');
    rows.forEach(([name, counts]) => tbody.appendChild(efficiencyRow(name, counts)));
    table.appendChild(tbody);

    const tfoot = el('tfoot');
    tfoot.appendChild(efficiencyRow('Team', teamCounts(rows.map(([, counts]) => counts))));
    table.appendChild(tfoot);
    return table;
}

function efficiencyRow(name, counts) {
    const tr = el('tr');
    tr.appendChild(el('td', 'player-name-col', name));
    COLUMNS.forEach(col => {
        const c = counts[col.action];
        col.rates.forEach(([, value], i) => {
            const td = rateCell(value(c), attempts(c));
            if (i === 0) td.classList.add('group-start');
            tr.appendChild(td);
        });
    });
    return tr;
}

function teamCounts(list) {
    return Object.fromEntries(COLUMNS.map(({ action }) => [action, list.reduce((sum, counts) => ({
        positive: sum.positive + counts[action].positive,
        neutral: sum.neutral + counts[action].neutral,
        negative: sum.negative + counts[action].negative
    }), { positive: 0, neutral: 0, negative: 0 })]));
}
