// Registration screen: team names, roster and role assignment.
import { addPlayer, removePlayer, getPlayers, countImportableV1Players, importV1Players } from './players.js';
import { getRawTeamNames, setTeamNames, getSetSetup } from './match.js';
import { getCurrentSet } from './actions.js';
import { renderLineupBoard } from './lineup-board.js';
import { getActionsLayout, setActionsLayout } from './settings.js';
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
    renderLayoutSetting();
    renderPlayerList();
    renderLineup();
}

function renderLayoutSetting() {
    const container = document.getElementById('layout-setting');
    container.innerHTML = '';
    const current = getActionsLayout();
    [['list', 'List'], ['court', 'Court']].forEach(([layout, label]) => {
        container.appendChild(button(label, 'segmented-btn' + (layout === current ? ' active' : ''), () => {
            setActionsLayout(layout);
            notifyChange();
        }));
    });
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

// Shown in the starting rotation of the current set, or rotation 1 before it is set up.
function renderLineup() {
    const setup = getSetSetup(getCurrentSet());
    renderLineupBoard(document.getElementById('positions'), setup ? setup.setterStart : 1);
}
