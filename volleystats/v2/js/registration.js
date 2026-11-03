// Registration screen: team names, roster and role assignment.
import { addPlayer, removePlayer, getPlayers, assignRole, ROLES, countImportableV1Players, importV1Players } from './players.js';
import { getRawTeamNames, setTeamNames } from './match.js';
import { renderScoreboard } from './scoreboard.js';
import { el, button, notifyChange } from './dom.js';

const teamInput = () => document.getElementById('team-name');
const opponentInput = () => document.getElementById('opponent-name');

export function initRegistration() {
    // Re-rendering the whole screen while typing would drop input focus, so only the scoreboard updates.
    [teamInput(), opponentInput()].forEach(input => {
        input.addEventListener('input', () => {
            setTeamNames(teamInput().value.trim(), opponentInput().value.trim());
            renderScoreboard();
        });
    });

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
    const names = getRawTeamNames();
    if (document.activeElement !== teamInput()) teamInput().value = names.team;
    if (document.activeElement !== opponentInput()) opponentInput().value = names.opponent;
    renderPlayerList();
    renderRoles();
}

function renderImportOffer() {
    const container = document.getElementById('v1-import');
    container.innerHTML = '';
    const count = countImportableV1Players();
    if (getPlayers().length > 0 || count === 0) return;

    container.appendChild(el('span', null, `Found ${count} players from VolleyStats v1 on this device.`));
    container.appendChild(button('Import', 'btn btn-primary', () => {
        importV1Players();
        notifyChange();
    }));
}

function renderPlayerList() {
    renderImportOffer();
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    getPlayers().forEach(player => {
        const li = el('li', 'player-item');
        li.appendChild(button('×', 'delete-player', () => {
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
