// Players tab tables built from rallies.
import { getPlayers } from './players.js';
import { servingStats } from './rally-stats.js';
import { rateCell, tableHead } from './rally-view.js';
import { el } from './dom.js';

export function buildServingTable(sets) {
    const stats = servingStats(sets);
    const rows = getPlayers().filter(p => stats[p.id]).map(p => [p.name, stats[p.id]]);
    if (rows.length === 0) return null;

    const table = el('table', 'stats-table rotation-table');
    table.appendChild(tableHead(['Server', 'Break', 'Best run']));
    const tbody = el('tbody');
    rows.forEach(([name, s]) => tbody.appendChild(servingRow(name, s)));
    table.appendChild(tbody);
    const total = rows.reduce((sum, [, s]) => ({
        serves: sum.serves + s.serves, won: sum.won + s.won, bestRun: Math.max(sum.bestRun, s.bestRun)
    }), { serves: 0, won: 0, bestRun: 0 });
    const tfoot = el('tfoot');
    tfoot.appendChild(servingRow('Team', total));
    table.appendChild(tfoot);
    return table;
}

function servingRow(name, s) {
    const tr = el('tr');
    tr.appendChild(el('td', 'player-name-col', name));
    tr.appendChild(rateCell(s.won, s.serves));
    tr.appendChild(el('td', null, s.bestRun || '–'));
    return tr;
}
