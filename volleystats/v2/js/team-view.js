// Team tab tables built from rallies.
import { receptionSideOut } from './rally-stats.js';
import { rateCell } from './rally-view.js';
import { el } from './dom.js';

const RECEPTION_ROWS = [['positive', 'Good +'], ['neutral', 'OK ~'], ['negative', 'Error / ace']];

function headRow(labels) {
    const thead = el('thead');
    const tr = el('tr');
    labels.forEach((label, i) => tr.appendChild(el('th', i === 0 ? 'player-name-col' : null, label)));
    thead.appendChild(tr);
    return thead;
}

export function buildReceptionTable(sets) {
    const rows = receptionSideOut(sets);
    const total = Object.values(rows).reduce((sum, r) => ({
        rallies: sum.rallies + r.rallies, won: sum.won + r.won, firstBall: sum.firstBall + r.firstBall
    }), { rallies: 0, won: 0, firstBall: 0 });
    if (total.rallies === 0) return null;

    const table = el('table', 'stats-table rotation-table');
    table.appendChild(headRow(['Reception', 'Side-out', 'First ball']));
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

function receptionRow(label, r) {
    const tr = el('tr');
    tr.appendChild(el('td', 'player-name-col', label));
    tr.appendChild(rateCell(r.won, r.rallies));
    tr.appendChild(rateCell(r.firstBall, r.rallies));
    return tr;
}
