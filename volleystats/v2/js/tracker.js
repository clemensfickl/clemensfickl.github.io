// Actions screen: records player actions and opponent errors and points for the current set.
import { ACTIONS, recordPlayerAction, recordOppError, recordOppPoint, getEvents, getCurrentSet, setCurrentSet, undoLastAction } from './actions.js';
import { getPlayers, getLiberos, liberoOnCourt, swapWithLibero, exchangeWithBench } from './players.js';
import { aggregate, playerCounts, winnersErrors, sumOpp } from './stats.js';
import { replaySet, pointWinner, courtPosition, getTeamNames, ROLE_ORDER, FRONT_ROW } from './match.js';
import { openSetupModal } from './setup-modal.js';
import { recordAndCheckSetEnd, openAdjustModal } from './set-flow.js';
import { el, button, notifyChange } from './dom.js';
import { openModal } from './modal.js';

const OUTCOME_SYMBOLS = { positive: '+', neutral: '~', negative: '-' };
const OPP_ACTIONS = ['Serv', 'Atk', 'Blk', 'Oth'];
const POSITION_FILTER = { Serv: [1], Blk: FRONT_ROW };

let selectedAction = null;
const promptedSets = new Set();

export function initTracker() {
    document.getElementById('undo-btn').addEventListener('click', () => {
        if (!undoLastAction()) return alert('No action to undo');
        notifyChange();
    });
}

// Called when navigating to the Actions screen, so a missing lineup is asked for again.
export function resetSetupPrompts() {
    promptedSets.clear();
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
    const allowed = POSITION_FILTER[selectedAction];
    courtPlayers(state).forEach(({ player, pos }) => {
        const active = !pos || !allowed || allowed.includes(pos);
        list.appendChild(renderPlayerRow(player, pos, active, setAgg, totalAgg));
    });
    list.appendChild(renderOpponentRow(setAgg, totalAgg));
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
    return onCourt
        .map(player => ({ player, pos: courtPosition(player.role, state.setterPos) }))
        .sort((a, b) => a.pos - b.pos);
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

// Inactive rows (e.g. everyone but the server) keep only the substitution buttons.
function renderPlayerRow(player, pos, active, setAgg, totalAgg) {
    const liberos = getLiberos();
    const onCourt = liberoOnCourt();
    const liberoLabel = n => (liberos.length > 1 ? `L${n}` : 'L');

    const row = el('div', 'onfield-row' + (active ? '' : ' inactive'));
    const name = el('div', 'onfield-name');
    if (pos) name.appendChild(el('span', 'pos-badge' + (FRONT_ROW.includes(pos) ? ' front' : ''), pos));
    name.appendChild(document.createTextNode(player.liberoNo ? `${player.name} (${liberoLabel(player.liberoNo)})` : player.name));
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

    // Liberos are substituted with the libero buttons only; while one is on court, only that row can swap.
    const actionControls = el('div', 'onfield-controls action-controls');
    if (!player.liberoNo) {
        actionControls.appendChild(button('Bench', 'btn btn-secondary exchange-btn', () => openExchangeModal(player.id)));
    }
    if (!onCourt || onCourt === player) {
        const liberoButtons = el('div', 'libero-buttons');
        liberos.forEach(libero => {
            const label = liberos.length > 1 ? `L${libero.liberoNo}` : 'Libero';
            liberoButtons.appendChild(button(label, 'btn btn-secondary swap-libero', () => {
                swapWithLibero(player.id, libero.liberoNo);
                notifyChange();
            }));
        });
        if (liberos.length > 0) actionControls.appendChild(liberoButtons);
    }
    row.appendChild(actionControls);

    const cur = winnersErrors(playerCounts(setAgg, player.id));
    const total = winnersErrors(playerCounts(totalAgg, player.id));
    row.appendChild(el('div', 'player-counts', `+${cur.winners}(${total.winners}) -${cur.errors}(${total.errors})`));
    return row;
}

// Same meaning as for our players: + is a point won by the opponent, - an opponent error.
function renderOpponentRow(setAgg, totalAgg) {
    const row = el('div', 'opponent-row');
    row.appendChild(el('div', 'onfield-name', getTeamNames().opponent));

    const controls = el('div', 'opponent-controls');
    OPP_ACTIONS.forEach(action => {
        const group = el('div', 'opp-group');
        group.appendChild(el('span', 'opp-group-label', action));
        group.appendChild(opponentButton('+', 'positive', () => recordOppPoint(action)));
        group.appendChild(opponentButton('-', 'negative', () => recordOppError(action)));
        controls.appendChild(group);
    });
    row.appendChild(controls);

    const points = `+${sumOpp(setAgg.oppPoints)}(${sumOpp(totalAgg.oppPoints)})`;
    const errors = `-${sumOpp(setAgg.oppErrors)}(${sumOpp(totalAgg.oppErrors)})`;
    row.appendChild(el('div', 'player-counts', `${points} ${errors}`));
    return row;
}

function opponentButton(symbol, outcome, recordFn) {
    return button(symbol, `opp-btn ${outcome}`, () => {
        recordAndCheckSetEnd(recordFn, resetAction);
        selectedAction = actionForServe(replaySet(getCurrentSet()));
        notifyChange();
    });
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
