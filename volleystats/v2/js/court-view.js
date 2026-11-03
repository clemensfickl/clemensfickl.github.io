// Court layout for our team: players are shown where they play after switching, not by rotation.
import { FRONT_ROW } from './match.js';
import { el, button } from './dom.js';

const OUTCOMES = [['positive', '+'], ['neutral', '~'], ['negative', '-']];
const COURT_LAYOUT = [4, 3, 2, 5, 6, 1];
const KIND = {
    setter: 'right', oppositeHitter: 'right',
    outsideHitter1: 'outside', outsideHitter2: 'outside',
    middleBlocker1: 'middle', middleBlocker2: 'middle'
};
const SHORT = {
    setter: 'S', oppositeHitter: 'OPP',
    outsideHitter1: 'OH', outsideHitter2: 'OH',
    middleBlocker1: 'MB', middleBlocker2: 'MB'
};
// Outside left, middle in the middle, setter/opposite right; in the back the middle (libero) plays 5.
const FRONT_SPOTS = { outside: 4, middle: 3, right: 2 };
const BACK_SPOTS = { middle: 5, outside: 6, right: 1 };

function playingSpot(role, pos) {
    return (FRONT_ROW.includes(pos) ? FRONT_SPOTS : BACK_SPOTS)[KIND[role]];
}

// `players`: [{ player, pos, active }] with the rotational position.
export function renderCourt(players, ctx) {
    const bySpot = {};
    players.forEach(entry => {
        bySpot[playingSpot(entry.player.role, entry.pos)] = entry;
    });

    const wrap = el('div', 'court-view');
    wrap.appendChild(el('div', 'court-net', 'Net'));
    const court = el('div', 'court-grid');
    COURT_LAYOUT.forEach(spot => {
        const entry = bySpot[spot];
        court.appendChild(entry ? renderCell(entry, ctx) : el('div', 'court-player-cell empty'));
    });
    wrap.appendChild(court);
    return wrap;
}

function renderCell({ player, pos, active }, ctx) {
    let className = 'court-player-cell';
    if (!active) className += ' inactive';
    if (player.liberoNo) className += ' libero';
    const cell = el('div', className);

    const head = el('div', 'cp-head');
    const serving = ctx.selectedAction === 'Serv' && active && pos === 1;
    const role = player.liberoNo ? ctx.liberoLabel(player.liberoNo) : SHORT[player.role];
    head.appendChild(el('span', serving ? 'cp-role cp-serve' : 'cp-role', serving ? 'Serve' : role));
    head.appendChild(el('span', 'cp-counts', ctx.counts(player)));
    cell.appendChild(head);
    cell.appendChild(el('div', 'cp-name', player.name));

    const outcomes = el('div', 'cp-outcomes');
    OUTCOMES.forEach(([outcome, symbol]) => {
        outcomes.appendChild(button(symbol, `cp-btn ${outcome}`, () => ctx.record(player, outcome)));
    });
    cell.appendChild(outcomes);

    const subs = el('div', 'cp-subs');
    const buttons = ctx.substitutionButtons(player);
    if (buttons.bench) subs.appendChild(buttons.bench);
    if (buttons.liberos) subs.appendChild(buttons.liberos);
    cell.appendChild(subs);
    return cell;
}
