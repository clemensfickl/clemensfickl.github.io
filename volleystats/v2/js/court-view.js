// Court layout for our team: players are shown where they play after switching, or on their rotational positions.
// Substitutions: drag a player onto the court, a libero slot or the bench, or tap the player and then the target.
import { FRONT_ROW } from './match.js';
import { el, button } from './dom.js';
import { makeDraggable } from './drag.js';
import { spotOrder, courtFrame } from './court-layout.js';

const OUTCOMES = [['positive', '+'], ['neutral', '~'], ['negative', '-']];
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
const UNSWITCHED_FRONT_SPOTS = { outside: 2, middle: 3, right: 4 };
const BACK_SPOTS = { middle: 5, outside: 6, right: 1 };
const DROP = '.court-drop';

let selectedId = null;

function playingSpot(role, pos, unswitchedFront) {
    const front = unswitchedFront ? UNSWITCHED_FRONT_SPOTS : FRONT_SPOTS;
    return (FRONT_ROW.includes(pos) ? front : BACK_SPOTS)[KIND[role]];
}

// `players`: [{ player, pos, active }] with the rotational position.
// `ctx.substitution(player, target)` returns the substitution for a drop, or null if it isn't allowed;
// a target is { player }, { libero: n } or { bench: true }. `ctx.orientation` as in court-layout.js.
// `ctx.byRotation`: players stay on their rotational positions instead of where they play.
// `ctx.unswitchedFront`: the front outside and opposite stay on their rotational positions. `ctx.belowCourt`: an
// optional element shown between the court and the reserve.
export function renderCourt(players, reserve, ctx) {
    const byId = Object.fromEntries([...players.map(e => e.player), ...reserve.bench, ...reserve.liberos.map(s => s.player)]
        .filter(Boolean).map(p => [p.id, p]));
    if (!byId[selectedId]) selectedId = null;

    const wrap = el('div', 'court-view');
    const targetOf = node => {
        const { playerId, libero, bench } = node.dataset;
        if (playerId) return { player: byId[playerId] };
        if (libero) return { libero: Number(libero) };
        return { bench: bench === 'true' };
    };
    const substitutionFor = (player, node) => ctx.substitution(player, targetOf(node));
    const apply = run => {
        selectedId = null;
        run();
        ctx.refresh();
    };

    const draggable = (node, player) => {
        node.dataset.source = player.id;
        if (player.id === selectedId) node.classList.add('selected');
        makeDraggable(node, {
            scope: wrap,
            targetSelector: DROP,
            accepts: target => !!substitutionFor(player, target),
            onDrop: target => apply(substitutionFor(player, target)),
            ghost: () => el('div', 'player-chip', player.name)
        });
    };
    const target = node => {
        node.classList.add('court-drop');
        return node;
    };

    // Tap a player to select them, then tap where they go; tapping anything else clears the selection.
    wrap.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        const source = e.target.closest('[data-source]');
        const drop = e.target.closest(DROP);
        const selected = byId[selectedId];
        if (selected && drop && source?.dataset.source !== selectedId) {
            const run = substitutionFor(selected, drop);
            if (run) return apply(run);
        }
        selectedId = source && source.dataset.source !== selectedId ? source.dataset.source : null;
        ctx.refresh();
    });

    const bySpot = {};
    players.forEach(entry => {
        const spot = ctx.byRotation ? entry.pos : playingSpot(entry.player.role, entry.pos, ctx.unswitchedFront);
        bySpot[spot] = entry;
    });
    const court = el('div', 'court-grid');
    spotOrder(ctx.orientation).forEach(spot => {
        const entry = bySpot[spot];
        if (!entry) return court.appendChild(el('div', 'court-player-cell empty'));
        const cell = target(renderCell(entry, ctx));
        cell.dataset.playerId = entry.player.id;
        draggable(cell, entry.player);
        court.appendChild(cell);
    });
    wrap.appendChild(courtFrame(ctx.orientation, court));
    if (ctx.belowCourt) wrap.appendChild(ctx.belowCourt);
    wrap.appendChild(renderReserve(reserve, ctx, { draggable, target }));

    const selected = byId[selectedId];
    if (selected) {
        wrap.querySelectorAll(DROP).forEach(node => {
            if (substitutionFor(selected, node)) node.classList.add('drop-allowed');
        });
    }
    return wrap;
}

function renderCell({ player, pos, active }, ctx) {
    let className = 'court-player-cell';
    if (!active) className += ' inactive';
    if (player.liberoNo) className += ' libero';
    const cell = el('div', className + ctx.flashClass(player.id));

    const head = el('div', 'cp-head');
    const serving = ctx.selectedAction === 'Serv' && active && pos === 1;
    const playing = ctx.playingRole(player.role);
    const role = player.liberoNo ? ctx.liberoLabel(player.liberoNo) : SHORT[playing];
    let roleClass = 'cp-role';
    if (serving) roleClass += ' cp-serve';
    else if (playing === 'setter' && !player.liberoNo) roleClass += ' setter';
    head.appendChild(el('span', roleClass, serving ? 'Serve' : role));
    head.appendChild(el('span', 'cp-counts', ctx.counts(player)));
    cell.appendChild(head);
    cell.appendChild(el('div', 'cp-name', player.name));

    const outcomes = el('div', 'cp-outcomes');
    OUTCOMES.forEach(([outcome, symbol]) => {
        outcomes.appendChild(button(symbol, `cp-btn ${outcome}`, () => ctx.record(player, outcome)));
    });
    cell.appendChild(outcomes);
    return cell;
}

// `reserve.liberos`: [{ n, player }] with whoever waits in libero slot n (the libero, or the player she covers).
function renderReserve(reserve, ctx, { draggable, target }) {
    const strip = el('div', 'court-reserve');
    reserve.liberos.forEach(({ n, player, covered }) => {
        const slot = target(el('div', 'reserve-slot libero-reserve'));
        slot.dataset.libero = n;
        slot.appendChild(el('span', 'slot-title', ctx.liberoLabel(n)));
        if (player) {
            const chip = el('div', 'player-chip' + (covered ? ' covered' : ''), player.name);
            draggable(chip, player);
            slot.appendChild(chip);
        } else {
            slot.appendChild(el('span', 'slot-empty', 'empty'));
        }
        strip.appendChild(slot);
    });

    const bench = target(el('div', 'reserve-slot bench-reserve'));
    bench.dataset.bench = 'true';
    bench.appendChild(el('span', 'slot-title', 'Bench'));
    const chips = el('div', 'bench-chips');
    reserve.bench.forEach(player => {
        const chip = target(el('div', 'player-chip', player.name));
        chip.dataset.playerId = player.id;
        draggable(chip, player);
        chips.appendChild(chip);
    });
    if (reserve.bench.length === 0) chips.appendChild(el('span', 'slot-empty', 'nobody'));
    bench.appendChild(chips);
    strip.appendChild(bench);
    return strip;
}
