// Court, libero slots and bench. Players move by dragging, or by tapping a player and then their new place.
import { getPlayers, baseLineup, placePlayer, liberoSlot, ROLES } from './players.js';
import { setAppliedLiberoTarget, courtPosition, ROLE_ORDER } from './match.js';
import { el, notifyChange } from './dom.js';
import { makeDraggable } from './drag.js';
import { undoable } from './history.js';

// Seen from our side of the net: front row on top.
const COURT_LAYOUT = [4, 3, 2, 5, 6, 1];

const roleLabel = Object.fromEntries(ROLES.map(r => [r.key, r.short]));

export function renderLineupBoard(container, setterPos) {
    let selectedId = null;

    const render = () => {
        container.innerHTML = '';
        const lineup = baseLineup();
        const roleOf = Object.fromEntries(Object.entries(lineup).map(([role, p]) => [p.id, role]));
        const board = el('div', 'lineup-board');

        // A slot takes the player (its holder moves to the player's old place); a bench player takes the
        // place of a player who isn't on the bench.
        const moveTo = (playerId, target) => {
            const own = roleOf[playerId] || null;
            const benchId = target.dataset.benchPlayer;
            if (benchId) return benchId !== playerId && own ? () => place(benchId, own) : null;
            const role = target.dataset.role || null;
            return role !== own ? () => place(playerId, role) : null;
        };
        const slot = (className, role) => {
            const node = el('div', `lineup-slot lineup-drop ${className}`);
            node.dataset.role = role;
            return node;
        };
        const chip = player => {
            const node = el('div', 'player-chip' + (player.id === selectedId ? ' selected' : ''), player.name);
            node.setAttribute('role', 'button');
            node.dataset.source = player.id;
            makeDraggable(node, {
                scope: container,
                targetSelector: '.lineup-drop',
                accepts: target => !!moveTo(player.id, target),
                onDrop: target => moveTo(player.id, target)()
            });
            return node;
        };

        // Tap a player, then where they go; tapping another player that can't take the place selects that one.
        board.addEventListener('click', e => {
            const source = e.target.closest('[data-source]');
            const target = e.target.closest('.lineup-drop');
            if (selectedId && target && source?.dataset.source !== selectedId) {
                const run = moveTo(selectedId, target);
                if (run) return run();
            }
            selectedId = source && source.dataset.source !== selectedId ? source.dataset.source : null;
            render();
        });

        board.appendChild(el('div', 'court-net', 'Net'));
        const court = el('div', 'court');
        const roleAt = Object.fromEntries(ROLE_ORDER.map(role => [courtPosition(role, setterPos), role]));
        COURT_LAYOUT.forEach(pos => {
            const role = roleAt[pos];
            const cell = slot('court-cell' + (role === 'setter' ? ' setter' : ''), role);
            const head = el('div', 'court-cell-head');
            head.append(el('span', 'court-pos', pos), el('span', 'court-role', roleLabel[role]));
            cell.appendChild(head);
            cell.appendChild(lineup[role] ? chip(lineup[role]) : el('span', 'slot-empty', 'empty'));
            court.appendChild(cell);
        });
        board.appendChild(court);

        const reserve = el('div', 'lineup-reserve');
        [1, 2].forEach(n => {
            const role = liberoSlot(n);
            const node = slot('libero-slot', role);
            node.appendChild(el('span', 'slot-title', `Libero ${n}`));
            node.appendChild(lineup[role] ? chip(lineup[role]) : el('span', 'slot-empty', 'empty'));
            reserve.appendChild(node);
        });

        const bench = slot('bench-slot', '');
        bench.appendChild(el('span', 'slot-title', 'Bench'));
        const benchPlayers = getPlayers().filter(p => !p.role);
        const chips = el('div', 'bench-chips');
        benchPlayers.forEach(p => {
            const node = chip(p);
            node.classList.add('lineup-drop');
            node.dataset.benchPlayer = p.id;
            chips.appendChild(node);
        });
        if (benchPlayers.length === 0) chips.appendChild(el('span', 'slot-empty', 'nobody'));
        bench.appendChild(chips);
        reserve.appendChild(bench);
        board.appendChild(reserve);

        board.appendChild(el('p', 'lineup-hint', selectedId
            ? 'Now tap where the player goes.'
            : 'Drag players to their spot, or tap a player and then the spot.'));
        if (selectedId) {
            board.querySelectorAll('.lineup-drop').forEach(target => {
                if (moveTo(selectedId, target)) target.classList.add('drop-allowed');
            });
        }
        container.appendChild(board);
    };

    const place = (playerId, role) => {
        selectedId = null;
        undoable(() => {
            placePlayer(playerId, role);
            setAppliedLiberoTarget(null);
        });
        notifyChange();
        render();
    };

    render();
}
