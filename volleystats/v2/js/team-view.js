// Team tab tables built from rallies.
import { receptionSideOut, pressureStats, pressureFrom, setComparison } from './rally-stats.js';
import { rateCell, tableHead } from './rally-view.js';
import { el } from './dom.js';

const RECEPTION_ROWS = [['positive', 'Good +'], ['neutral', 'OK ~'], ['negative', 'Error / ace']];

export function buildReceptionTable(sets) {
    const rows = receptionSideOut(sets);
    const total = Object.values(rows).reduce((sum, r) => ({
        rallies: sum.rallies + r.rallies, won: sum.won + r.won, firstBall: sum.firstBall + r.firstBall
    }), { rallies: 0, won: 0, firstBall: 0 });
    if (total.rallies === 0) return null;

    const table = el('table', 'stats-table rotation-table');
    table.appendChild(tableHead(['Reception', 'Side-out', 'First ball']));
    const tbody = el('tbody');
    RECEPTION_ROWS.forEach(([quality, label]) => {
        if (rows[quality].rallies) tbody.appendChild(receptionRow(label, rows[quality]));
    });
    table.appendChild(tbody);
    const tfoot = el('tfoot');
    tfoot.appendChild(receptionRow('All', total));
    table.appendChild(tfoot);
    return table;
}

const COMPARISON_ROWS = [
    ['Side-out', s => rateCell(s.recvWon, s.recvRallies)],
    ['Break', s => rateCell(s.servWon, s.servRallies)],
    ['Aces', s => el('td', 'stat-positive', s.aces)],
    ['Own errors', s => el('td', 'stat-negative', s.ownErrors)],
    ['Attack eff', s => rateCell(s.kills - s.attackErrors, s.attacks)]
];

// Sets as columns, so trends from set to set read left to right.
export function buildSetComparisonTable(sets) {
    const columns = setComparison(sets).filter(s => s.us + s.them > 0);
    if (columns.length < 2) return null;
    const table = el('table', 'stats-table comparison-table');
    table.appendChild(tableHead(['', ...columns.map(s => `Set ${s.set}`)]));
    const tbody = el('tbody');
    const scoreRow = el('tr', 'comparison-score');
    scoreRow.appendChild(el('td', 'player-name-col', 'Score'));
    columns.forEach(s => scoreRow.appendChild(el('td', s.us > s.them ? 'stat-positive' : s.us < s.them ? 'stat-negative' : null, `${s.us}:${s.them}`)));
    tbody.appendChild(scoreRow);
    COMPARISON_ROWS.forEach(([label, render]) => {
        const tr = el('tr');
        tr.appendChild(el('td', 'player-name-col', label));
        columns.forEach(s => tr.appendChild(render(s)));
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
}

export function buildPressureTable(sets) {
    const { early, late } = pressureStats(sets);
    if (late.rallies === 0) return null;
    const table = el('table', 'stats-table rotation-table');
    table.appendChild(tableHead(['Score', 'Side-out', 'Break', 'Own errors']));
    const tbody = el('tbody');
    const from = sets.length === 1 ? pressureFrom(sets[0]) : pressureFrom(1);
    [[`Before ${from}`, early], [`From ${from}`, late]].forEach(([label, p]) => {
        const tr = el('tr');
        tr.appendChild(el('td', 'player-name-col', label));
        tr.appendChild(rateCell(p.recvWon, p.recvRallies));
        tr.appendChild(rateCell(p.servWon, p.servRallies));
        tr.appendChild(rateCell(p.ownErrors, p.rallies));
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
}

function receptionRow(label, r) {
    const tr = el('tr');
    tr.appendChild(el('td', 'player-name-col', label));
    tr.appendChild(rateCell(r.won, r.rallies));
    tr.appendChild(rateCell(r.firstBall, r.rallies));
    return tr;
}
