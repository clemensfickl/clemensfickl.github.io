// Players tab tables built from rallies.
import { getPlayers } from './players.js';
import { servingStats, attackDistribution, plusMinus } from './rally-stats.js';
import { rateCell, tableHead, markBest, rateOrNull } from './rally-view.js';
import { el } from './dom.js';

export function buildServingTable(sets) {
    const stats = servingStats(sets);
    const rows = getPlayers().filter(p => stats[p.id]).map(p => [p.name, stats[p.id]]);
    if (rows.length === 0) return null;

    const table = el('table', 'stats-table rotation-table');
    table.appendChild(tableHead(['Server', 'Break', 'Best run']));
    const tbody = el('tbody');
    const breaks = [];
    const runs = [];
    const most = Math.max(...rows.map(([, s]) => s.serves));
    rows.forEach(([name, s]) => {
        const tr = servingRow(name, s);
        breaks.push({ td: tr.children[1], value: rateOrNull(s.won, s.serves, most) });
        runs.push({ td: tr.children[2], value: s.bestRun });
        tbody.appendChild(tr);
    });
    markBest(breaks);
    markBest(runs);
    table.appendChild(tbody);
    const total = rows.reduce((sum, [, s]) => ({
        serves: sum.serves + s.serves, won: sum.won + s.won, bestRun: Math.max(sum.bestRun, s.bestRun)
    }), { serves: 0, won: 0, bestRun: 0 });
    const tfoot = el('tfoot');
    tfoot.appendChild(servingRow('Team', total));
    table.appendChild(tfoot);
    return table;
}

// Each column shows the players' share of that column's attacks; the biggest share per column is highlighted.
export function buildAttackDistributionTable(sets) {
    const { total, players } = attackDistribution(sets);
    if (total.all === 0) return null;
    const columns = ['all', 1, 2, 3, 4, 5, 6].filter(key => total[key]);
    const rows = getPlayers().filter(p => players[p.id]).map(p => [p.name, players[p.id]]);

    const table = el('table', 'stats-table distribution-table');
    table.appendChild(tableHead(['Attacker', ...columns.map(key => (key === 'all' ? 'All' : `R${key}`))]));
    const tbody = el('tbody');
    const cells = columns.map(() => []);
    rows.forEach(([name, counts]) => {
        const tr = el('tr');
        tr.appendChild(el('td', 'player-name-col', name));
        columns.forEach((key, i) => {
            const n = counts[key] || 0;
            const td = n ? rateCell(n, total[key]) : el('td', 'rate-cell', '–');
            cells[i].push({ td, value: n || null });
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    cells.forEach(column => markBest(column));
    table.appendChild(tbody);
    const tfoot = el('tfoot');
    const tr = el('tr');
    tr.appendChild(el('td', 'player-name-col', 'Attacks'));
    columns.forEach(key => tr.appendChild(el('td', null, total[key])));
    tfoot.appendChild(tr);
    table.appendChild(tfoot);
    return table;
}

export function buildPlusMinusTable(sets) {
    const stats = plusMinus(sets);
    const rows = getPlayers().filter(p => stats[p.id]).map(p => [p.name, stats[p.id]]);
    if (rows.length === 0) return null;

    const table = el('table', 'stats-table rotation-table');
    table.appendChild(tableHead(['Player', 'Won', 'Lost', '+/−']));
    const tbody = el('tbody');
    const diffs = [];
    rows.forEach(([name, s]) => {
        const diff = s.won - s.lost;
        const tr = el('tr');
        tr.appendChild(el('td', 'player-name-col', name));
        tr.appendChild(el('td', 'stat-positive', s.won));
        tr.appendChild(el('td', 'stat-negative', s.lost));
        const td = el('td', diff > 0 ? 'stat-positive' : diff < 0 ? 'stat-negative' : null, diff > 0 ? `+${diff}` : diff < 0 ? `−${-diff}` : '0');
        diffs.push({ td, value: diff });
        tr.appendChild(td);
        tbody.appendChild(tr);
    });
    markBest(diffs);
    table.appendChild(tbody);
    return table;
}

function servingRow(name, s) {
    const tr = el('tr');
    tr.appendChild(el('td', 'player-name-col', name));
    tr.appendChild(rateCell(s.won, s.serves));
    tr.appendChild(el('td', null, s.bestRun || '–'));
    return tr;
}
