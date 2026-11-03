// Registration screen: roster and role assignment.
import { addPlayer, removePlayer, getPlayers, assignRole, ROLES } from './players.js';
import { el, button, notifyChange } from './dom.js';

export function initRegistration() {
    const form = document.getElementById('player-form');
    const input = document.getElementById('player-name');
    form.addEventListener('submit', e => {
        e.preventDefault();
        const name = input.value.trim();
        if (!name) return;
        addPlayer(name);
        input.value = '';
        input.focus();
        notifyChange();
    });
}

export function renderRegistration() {
    renderPlayerList();
    renderRoles();
}

function renderPlayerList() {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    getPlayers().forEach(player => {
        const li = el('li', 'player-item');
        li.appendChild(button('x', 'btn btn-danger delete-player', () => {
            removePlayer(player.id);
            notifyChange();
        }));
        li.appendChild(el('span', 'player-name', player.name));
        list.appendChild(li);
    });
}

function renderRoles() {
    const container = document.getElementById('positions');
    container.innerHTML = '';
    const players = getPlayers();

    ROLES.forEach(role => {
        const wrap = el('div', 'position-item');
        const label = el('label', null, role.label + ':');
        label.htmlFor = `pos-${role.key}`;
        wrap.appendChild(label);

        const select = el('select');
        select.id = `pos-${role.key}`;
        select.appendChild(new Option('-- None --', ''));
        // Only players on the bench, or the one currently holding this role, are selectable.
        players
            .filter(p => !p.role || p.role === role.key)
            .forEach(p => select.appendChild(new Option(p.name, p.id, false, p.role === role.key)));

        select.addEventListener('change', () => {
            if (select.value) {
                assignRole(select.value, role.key);
            } else {
                const current = players.find(p => p.role === role.key);
                if (current) assignRole(current.id, null);
            }
            notifyChange();
        });

        wrap.appendChild(select);
        container.appendChild(wrap);
    });
}
