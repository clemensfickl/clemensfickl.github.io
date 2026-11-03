// Actions screen: records player actions and opponent errors and points for the current set.
import { ACTIONS, recordPlayerAction, recordOppError, recordOppPoint, getEvents, getCurrentSet, setCurrentSet, undoLastAction } from './actions.js';
import { getPlayers, ROLES, swapWithLibero, exchangeWithBench } from './players.js';
import { aggregate, playerCounts, winnersErrors, sumOpp } from './stats.js';
import { el, button, notifyChange } from './dom.js';
import { openModal } from './modal.js';

const OUTCOME_SYMBOLS = { positive: '+', neutral: '~', negative: '-' };
const OPP_ERROR_ACTIONS = ['Serv', 'Atk', 'Oth'];
const OPP_POINT_ACTIONS = ['Serv', 'Atk', 'Blk', 'Oth'];
const COURT_ROLES = ROLES.map(r => r.key).filter(k => k !== 'libero');

let selectedAction = null;

export function initTracker() {
    document.getElementById('undo-btn').addEventListener('click', () => {
        if (!undoLastAction()) return alert('No action to undo');
        notifyChange();
    });
}

export function renderTracker() {
    renderSetSelector();

    const events = getEvents();
    const setAgg = aggregate(events, getCurrentSet());
    const totalAgg = aggregate(events);

    const container = document.getElementById('action-buttons');
    container.innerHTML = '';
    container.appendChild(renderActionSelect());

    const list = el('div', 'onfield-list');
    onFieldPlayers().forEach(p => list.appendChild(renderPlayerRow(p, setAgg, totalAgg)));
    list.appendChild(renderOpponentRows(setAgg, totalAgg));
    container.appendChild(list);
}

function onFieldPlayers() {
    return getPlayers()
        .filter(p => COURT_ROLES.includes(p.role))
        .sort((a, b) => COURT_ROLES.indexOf(a.role) - COURT_ROLES.indexOf(b.role));
}

function renderActionSelect() {
    const wrap = el('div', 'action-select-wrap');
    ACTIONS.forEach(action => {
        const className = 'action-select-btn' + (selectedAction === action ? ' active' : '');
        wrap.appendChild(button(action, className, () => {
            selectedAction = action;
            notifyChange();
        }));
    });
    return wrap;
}

function nextActionAfter(action, outcome) {
    if ((action === 'Serv' && outcome === 'neutral') || (action === 'Recv' && outcome !== 'negative')) return 'Atk';
    if (outcome === 'positive') return 'Serv';
    if (outcome === 'negative') return 'Recv';
    return action;
}

function renderPlayerRow(player, setAgg, totalAgg) {
    const players = getPlayers();
    const libero = players.find(p => p.isLibero);
    const isLiberoOnField = libero && libero.role !== 'libero';

    const row = el('div', 'onfield-row');
    row.appendChild(el('div', 'onfield-name', player.isLibero ? `${player.name} (L)` : player.name));

    const controls = el('div', 'onfield-controls stats-controls');
    Object.entries(OUTCOME_SYMBOLS).forEach(([outcome, symbol]) => {
        controls.appendChild(button(symbol, `big-btn ${outcome}`, () => {
            if (!selectedAction) return alert('Select an action first');
            recordPlayerAction(player.id, selectedAction, outcome);
            selectedAction = nextActionAfter(selectedAction, outcome);
            notifyChange();
        }));
    });
    row.appendChild(controls);

    const actionControls = el('div', 'onfield-controls action-controls');
    actionControls.appendChild(button('Bench', 'btn btn-secondary exchange-btn', () => openExchangeModal(player.id)));
    // While the libero is on court, only the libero can swap back.
    if (!isLiberoOnField || player.isLibero) {
        actionControls.appendChild(button('Libero', 'btn btn-secondary swap-libero', () => {
            swapWithLibero(player.id);
            notifyChange();
        }));
    }
    row.appendChild(actionControls);

    const cur = winnersErrors(playerCounts(setAgg, player.id));
    const total = winnersErrors(playerCounts(totalAgg, player.id));
    row.appendChild(el('div', 'player-counts', `+${cur.winners}(${total.winners}) -${cur.errors}(${total.errors})`));
    return row;
}

function renderOpponentRows(setAgg, totalAgg) {
    const wrap = el('div', 'opponent-rows');
    wrap.appendChild(renderOpponentRow({
        label: 'Opp error',
        hint: 'our point',
        className: 'opp-error',
        actions: OPP_ERROR_ACTIONS,
        counts: `-${sumOpp(setAgg.oppErrors)}(${sumOpp(totalAgg.oppErrors)})`,
        onTap: action => {
            recordOppError(action);
            selectedAction = 'Serv';
        }
    }));
    wrap.appendChild(renderOpponentRow({
        label: 'Opp point',
        hint: 'their point',
        className: 'opp-point',
        actions: OPP_POINT_ACTIONS,
        counts: `+${sumOpp(setAgg.oppPoints)}(${sumOpp(totalAgg.oppPoints)})`,
        onTap: action => {
            recordOppPoint(action);
            selectedAction = 'Recv';
        }
    }));
    return wrap;
}

function renderOpponentRow({ label, hint, className, actions, counts, onTap }) {
    const row = el('div', `opponent-row ${className}`);
    const name = el('div', 'onfield-name', label);
    name.appendChild(el('span', 'opp-hint', hint));
    row.appendChild(name);

    const controls = el('div', 'opponent-controls');
    actions.forEach(action => {
        controls.appendChild(button(action, 'opponent-action-btn', () => {
            onTap(action);
            notifyChange();
        }));
    });
    row.appendChild(controls);
    row.appendChild(el('div', 'player-counts', counts));
    return row;
}

function renderSetSelector() {
    const container = document.getElementById('set-selector-container');
    container.innerHTML = '';

    const label = el('label', null, 'Set:');
    label.htmlFor = 'set-selector';
    container.appendChild(label);

    const select = el('select', 'btn');
    select.id = 'set-selector';
    const currentSet = getCurrentSet();
    const maxSet = Math.max(currentSet + 1, 5);
    for (let i = 1; i <= maxSet; i++) {
        select.appendChild(new Option(i, i, false, i === currentSet));
    }
    select.addEventListener('change', () => {
        setCurrentSet(select.value);
        notifyChange();
    });
    container.appendChild(select);
}

function openExchangeModal(fieldPlayerId) {
    openModal('Select bench player to exchange', (modal, close) => {
        const benchPlayers = getPlayers().filter(p => !p.role);
        const select = el('select');
        if (benchPlayers.length === 0) {
            modal.appendChild(el('p', null, 'No bench players available'));
        } else {
            benchPlayers.forEach(b => select.appendChild(new Option(b.name, b.id)));
            modal.appendChild(select);
        }

        const btnRow = el('div', 'modal-buttons');
        if (benchPlayers.length > 0) {
            btnRow.appendChild(button('OK', 'btn btn-primary', () => {
                exchangeWithBench(fieldPlayerId, select.value);
                close();
                notifyChange();
            }));
        }
        btnRow.appendChild(button('Cancel', 'btn', close));
        modal.appendChild(btnRow);
    });
}
