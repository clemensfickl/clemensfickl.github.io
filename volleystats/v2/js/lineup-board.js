// Court, libero slots and bench. Players move by dragging, or by tapping a player and then their new place.
import { getPlayers, baseLineup, placePlayer, liberoSlot, ROLES } from './players.js';
import { setAppliedLiberoTarget, courtPosition, ROLE_ORDER } from './match.js';
import { el, notifyChange } from './dom.js';
import { makeDraggable } from './drag.js';

// Seen from our side of the net: front row on top.
const COURT_LAYOUT = [4, 3, 2, 5, 6, 1];

const roleLabel = Object.fromEntries(ROLES.map(r => [r.key, r.short]));

export function renderLineupBoard(container, setterPos) {
    let selectedId = null;

    const render = () => {
        container.innerHTML = '';
        const lineup = baseLineup();
        const board = el('div', 'lineup-board');

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
        benchPlayers.forEach(p => chips.appendChild(chip(p)));
        if (benchPlayers.length === 0) chips.appendChild(el('span', 'slot-empty', 'nobody'));
        bench.appendChild(chips);
        reserve.appendChild(bench);
        board.appendChild(reserve);

        board.appendChild(el('p', 'lineup-hint', selectedId
            ? 'Now tap where the player goes.'
            : 'Drag players to their spot, or tap a player and then the spot.'));
        container.appendChild(board);
    };

    const place = (playerId, role) => {
        selectedId = null;
        placePlayer(playerId, role || null);
        setAppliedLiberoTarget(null);
        notifyChange();
        render();
    };

    const slot = (className, role) => {
        const node = el('div', `lineup-slot ${className}`);
        node.dataset.role = role;
        node.addEventListener('click', () => {
            if (selectedId) place(selectedId, role);
        });
        return node;
    };

    const chip = player => {
        const node = el('div', 'player-chip' + (player.id === selectedId ? ' selected' : ''), player.name);
        node.setAttribute('role', 'button');
        node.addEventListener('click', e => {
            e.stopPropagation();
            if (!selectedId) selectedId = player.id;
            else if (selectedId === player.id) selectedId = null;
            else return place(selectedId, node.closest('.lineup-slot').dataset.role);
            render();
        });
        makeDraggable(node, {
            scope: container,
            targetSelector: '.lineup-slot',
            onDrop: drop => place(player.id, drop.dataset.role)
        });
        return node;
    };

    render();
}
