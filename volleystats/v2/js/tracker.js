// Actions screen: records player actions and opponent errors and points for the current set.
import { ACTIONS, recordPlayerAction, recordOppError, recordOppPoint, getEvents, getCurrentSet, setCurrentSet, undoLastAction } from './actions.js';
import { getPlayers, swapWithLibero, exchangeWithBench } from './players.js';
import { aggregate, playerCounts, winnersErrors, sumOpp } from './stats.js';
import { replaySet, pointWinner, courtPosition, ROLE_ORDER, FRONT_ROW } from './match.js';
import { openSetupModal } from './setup-modal.js';
import { recordAndCheckSetEnd, openAdjustModal } from './set-flow.js';
import { el, button, notifyChange } from './dom.js';
import { openModal } from './modal.js';

const OUTCOME_SYMBOLS = { positive: '+', neutral: '~', negative: '-' };
const OPP_ERROR_ACTIONS = ['Serv', 'Atk', 'Oth'];
const OPP_POINT_ACTIONS = ['Serv', 'Atk', 'Blk', 'Oth'];
const POSITION_FILTER = { Serv: [1], Blk: FRONT_ROW };

let selectedAction = null;
const promptedSets = new Set();

export function initTracker() {
    document.getElementById('undo-btn').addEventListener('click', () => {
        if (!undoLastAction()) return alert('No action to undo');
        notifyChange();
    });
}

export function renderTracker() {
    const set = getCurrentSet();
    const state = replaySet(set);
    if (!selectedAction && state.serving) selectedAction = actionForServe(state);

    renderToolbar(set);

    const events = getEvents();
    const setAgg = aggregate(events, set);
    const totalAgg = aggregate(events);

    const container = document.getElementById('action-buttons');
    container.innerHTML = '';
    container.appendChild(renderActionSelect());
    if (!state.hasSetup) container.appendChild(renderSetupBanner(set));

    const list = el('div', 'onfield-list');
    courtPlayers(state).forEach(({ player, pos }) => list.appendChild(renderPlayerRow(player, pos, setAgg, totalAgg)));
    list.appendChild(renderOpponentRows(setAgg, totalAgg));
    container.appendChild(list);

    if (!state.hasSetup && !promptedSets.has(set)) {
        promptedSets.add(set);
        openSetup(set);
    }
}

// Ordered by court position once the rotation is known, otherwise by role.
function courtPlayers(state) {
    const onCourt = getPlayers().filter(p => ROLE_ORDER.includes(p.role));
    if (!state.setterPos) {
        return onCourt
            .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
            .map(player => ({ player, pos: null }));
    }
    const withPos = onCourt
        .map(player => ({ player, pos: courtPosition(player.role, state.setterPos) }))
        .sort((a, b) => a.pos - b.pos);
    const allowed = POSITION_FILTER[selectedAction];
    return allowed ? withPos.filter(({ pos }) => allowed.includes(pos)) : withPos;
}

function resetAction() {
    selectedAction = null;
}

function openSetup(set) {
    openSetupModal(set, resetAction);
}

function actionForServe(state) {
    return state.serving === 'us' ? 'Serv' : 'Recv';
}

function selectNextAction(action, outcome) {
    const events = getEvents();
    if (pointWinner(events[events.length - 1])) {
        selectedAction = actionForServe(replaySet(getCurrentSet()));
    } else if (action === 'Serv' || action === 'Recv') {
        selectedAction = 'Atk';
    }
}

function renderSetupBanner(set) {
    const banner = el('div', 'setup-banner');
    banner.appendChild(el('span', null, `No starting rotation for set ${set} yet.`));
    banner.appendChild(button('Set lineup', 'btn btn-primary', () => openSetup(set)));
    return banner;
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

function renderPlayerRow(player, pos, setAgg, totalAgg) {
    const players = getPlayers();
    const libero = players.find(p => p.isLibero);
    const isLiberoOnField = libero && libero.role !== 'libero';

    const row = el('div', 'onfield-row');
    const name = el('div', 'onfield-name');
    if (pos) name.appendChild(el('span', 'pos-badge' + (FRONT_ROW.includes(pos) ? ' front' : ''), pos));
    name.appendChild(document.createTextNode(player.isLibero ? `${player.name} (L)` : player.name));
    row.appendChild(name);

    const controls = el('div', 'onfield-controls stats-controls');
    Object.entries(OUTCOME_SYMBOLS).forEach(([outcome, symbol]) => {
        controls.appendChild(button(symbol, `big-btn ${outcome}`, () => {
            if (!selectedAction) return alert('Select an action first');
            const action = selectedAction;
            recordAndCheckSetEnd(() => recordPlayerAction(player.id, action, outcome), resetAction);
            selectNextAction(action, outcome);
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
        onTap: action => recordOppError(action)
    }));
    wrap.appendChild(renderOpponentRow({
        label: 'Opp point',
        hint: 'their point',
        className: 'opp-point',
        actions: OPP_POINT_ACTIONS,
        counts: `+${sumOpp(setAgg.oppPoints)}(${sumOpp(totalAgg.oppPoints)})`,
        onTap: action => recordOppPoint(action)
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
            recordAndCheckSetEnd(() => onTap(action), resetAction);
            selectedAction = actionForServe(replaySet(getCurrentSet()));
            notifyChange();
        }));
    });
    row.appendChild(controls);
    row.appendChild(el('div', 'player-counts', counts));
    return row;
}

function renderToolbar(set) {
    const container = document.getElementById('set-selector-container');
    container.innerHTML = '';
    container.appendChild(renderSetSelector());
    container.appendChild(button('Lineup', 'btn btn-secondary', () => openSetup(set)));
    container.appendChild(button('Adjust', 'btn btn-secondary', () => openAdjustModal(resetAction)));
}

function renderSetSelector() {
    const select = el('select', 'btn');
    select.id = 'set-selector';
    select.setAttribute('aria-label', 'Set');
    const currentSet = getCurrentSet();
    for (let i = 1; i <= 5; i++) {
        select.appendChild(new Option(`Set ${i}`, i, false, i === currentSet));
    }
    select.addEventListener('change', () => {
        setCurrentSet(select.value);
        resetAction();
        notifyChange();
    });
    return select;
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
