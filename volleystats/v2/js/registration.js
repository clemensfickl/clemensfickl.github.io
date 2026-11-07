// Configuration screen: team names, saved matches, roster and settings. The lineup is set per set on the Actions screen.
import { addPlayer, removePlayer, getPlayers, countImportableV1Players, importV1Players } from './players.js';
import { getRawTeamNames, setTeamNames, setAppliedLiberoTarget } from './match.js';
import { getActionsLayout, setActionsLayout, getAutoLibero, setAutoLibero, getR1OppositeOnFour, setR1OppositeOnFour,
    getCourtPositions, setCourtPositions } from './settings.js';
import { renderScoreboard } from './scoreboard.js';
import { initArchive, renderArchive } from './archive-view.js';
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
    initArchive();
}

export function renderRegistration() {
    const names = getRawTeamNames();
    if (document.activeElement !== teamInput()) teamInput().value = names.team;
    if (document.activeElement !== opponentInput()) opponentInput().value = names.opponent;
    renderArchive();
    renderPlayerList();
    renderSettings();
}

function renderSettings() {
    renderSegmented('layout-setting', [['list', 'List'], ['court', 'Baseline'], ['side', 'Sideline']], getActionsLayout(), setActionsLayout);
    const courtView = getActionsLayout() !== 'list';
    document.getElementById('positions-row').hidden = !courtView;
    document.getElementById('r1-row').hidden = !courtView || getCourtPositions() === 'rotation';
    renderSegmented('positions-setting', [['playing', 'Playing'], ['rotation', 'Rotation']], getCourtPositions(), setCourtPositions);
    renderSegmented('r1-setting', [[true, 'OPP on 4'], [false, 'OPP on 2']], getR1OppositeOnFour(), setR1OppositeOnFour);
    renderSegmented('auto-libero-setting', [[true, 'On'], [false, 'Off']], getAutoLibero(), enabled => {
        setAutoLibero(enabled);
        // Switching it on applies the coverage for the current rotation right away.
        if (enabled) setAppliedLiberoTarget(null);
    });
}

function renderSegmented(id, options, current, onSelect) {
    const container = document.getElementById(id);
    container.innerHTML = '';
    options.forEach(([value, label]) => {
        container.appendChild(button(label, 'segmented-btn' + (value === current ? ' active' : ''), () => {
            onSelect(value);
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