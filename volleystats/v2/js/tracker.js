// Actions screen: records player actions and opponent errors and points for the current set.
import { ACTIONS, recordPlayerAction, recordOppError, recordOppPoint, recordSetterSwap, getEvents, getCurrentSet, setCurrentSet } from './actions.js';
import { undoable, undo, redo, canUndo, canRedo, bindViewState } from './history.js';
import { showToast } from './toast.js';
import { openHistoryModal } from './history-modal.js';
import { icon } from './icons.js';
import { getPlayers, getLiberos, liberoOnCourt, liberoSlot, swapWithLibero, exchangeWithBench } from './players.js';
import { aggregate, playerCounts, winnersErrors, sumOpp } from './stats.js';
import { replaySet, pointWinner, courtPosition, playingRole, getTeamNames, isSetOver, isSetInPlay, getMatchScore, isMatchOver, ROLE_ORDER, FRONT_ROW } from './match.js';
import { openSetupModal } from './setup-modal.js';
import { recordAndCheckSetEnd, openAdjustModal } from './set-flow.js';
import { el, button, notifyChange } from './dom.js';
import { openModal } from './modal.js';
import { renderCourt } from './court-view.js';
import { getActionsLayout } from './settings.js';

const OUTCOME_SYMBOLS = { positive: '+', neutral: '~', negative: '-' };
// The opponent can't win a point with a reception, and a block error ends up as our attack point or Oth.
const OPP_ACTIONS = {
    Serv: ['positive', 'negative'],
    Recv: ['negative'],
    Atk: ['positive', 'negative'],
    Blk: ['positive'],
    Oth: ['positive', 'negative']
};
const POSITION_FILTER = { Serv: [1], Blk: FRONT_ROW };

let selectedAction = null;
let flash = null;
const promptedSets = new Set();

export function initTracker() {
    bindViewState(() => ({ action: selectedAction }), view => { selectedAction = view ? view.action : null; });
    const historyButtons = [
        ['undo-btn', 'undo', undoWithFeedback],
        ['redo-btn', 'redo', redoWithFeedback],
        ['history-btn', 'history', () => openHistoryModal({ undo: undoWithFeedback, redo: redoWithFeedback })]
    ];
    historyButtons.forEach(([id, name, onClick]) => {
        const btn = document.getElementById(id);
        btn.appendChild(icon(name));
        btn.addEventListener('click', onClick);
    });
}

function undoWithFeedback() {
    showHistoryStep('Undone', undo());
}

function redoWithFeedback() {
    showHistoryStep('Redone', redo());
}

// Undo and redo flash the affected player like a recorded action, and say what changed.
function showHistoryStep(verb, step) {
    if (!step) return;
    if (step.key) flash = { key: step.key, outcome: 'history' };
    showToast(`${verb}: ${step.text}`);
    navigator.vibrate?.(15);
    notifyChange();
}

// What the set-end prompt and the Adjust modal need from the tracker.
const flowHooks = { resetAction, undo: undoWithFeedback };

// Called when navigating to the Actions screen, so a missing lineup is asked for again.
export function resetSetupPrompts() {
    promptedSets.clear();
}

// Only the receiving team can record a reception and only the serving team a serve.
function blockedActions(serving) {
    if (serving === 'us') return { us: ['Recv'], them: ['Serv'] };
    if (serving === 'them') return { us: ['Serv'], them: ['Recv'] };
    return { us: [], them: [] };
}

export function renderTracker() {
    const set = getCurrentSet();
    const state = replaySet(set);
    const inPlay = isSetInPlay(state, set);
    const blocked = inPlay ? blockedActions(state.serving) : { us: ACTIONS, them: Object.keys(OPP_ACTIONS) };
    if (inPlay && (!selectedAction || blocked.us.includes(selectedAction)) && state.serving) selectedAction = actionForServe(state);

    renderToolbar(set, inPlay);

    const events = getEvents();
    const setAgg = aggregate(events, set);
    const totalAgg = aggregate(events);

    const container = document.getElementById('action-buttons');
    container.innerHTML = '';
    container.appendChild(renderActionSelect(blocked.us));
    if (!inPlay) container.appendChild(renderSetOverBanner(set, state));
    else if (!state.hasSetup) container.appendChild(renderSetupBanner(set));

    const list = el('div', 'onfield-list');
    const allowed = POSITION_FILTER[selectedAction];
    const players = courtPlayers(state).map(({ player, pos }) => ({
        player, pos, active: inPlay && (!pos || !allowed || allowed.includes(pos))
    }));
    // The court needs the rotation; until the lineup is set the list is shown.
    if (getActionsLayout() === 'court' && state.setterPos) {
        const backRow = player => !FRONT_ROW.includes(courtPosition(player.role, state.setterPos));
        list.appendChild(renderCourt(players, reservePlayers(), {
            selectedAction,
            record: recordOutcome,
            substitution: (player, target) => {
                const run = substitution(player, target, { backRow, inPlay });
                return run && (() => undoable(run));
            },
            playingRole: role => playingRole(role, state),
            refresh: notifyChange,
            counts: player => countsText(player, setAgg, totalAgg),
            flashClass,
            liberoLabel
        }));
    } else {
        players.forEach(({ player, pos, active }) => list.appendChild(renderPlayerRow(player, pos, active, setAgg, totalAgg)));
    }
    list.appendChild(renderOpponentRow(setAgg, totalAgg, blocked.them));
    container.appendChild(list);
    flash = null;

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

// After a rally continues past a serve, reception or block touch, an attack is usually next.
const LEADS_TO_ATTACK = ['Serv', 'Recv', 'Blk'];

function selectNextAction(action) {
    const events = getEvents();
    if (pointWinner(events[events.length - 1])) {
        selectedAction = actionForServe(replaySet(getCurrentSet()));
    } else if (LEADS_TO_ATTACK.includes(action)) {
        selectedAction = 'Atk';
    }
}

function renderSetupBanner(set) {
    const banner = el('div', 'setup-banner');
    banner.appendChild(el('span', null, `No starting rotation for set ${set} yet.`));
    banner.appendChild(button('Set lineup', 'btn btn-primary', () => openSetup(set)));
    return banner;
}

function renderSetOverBanner(set, state) {
    const banner = el('div', 'setup-banner set-over-banner');
    const matchOver = isMatchOver(getMatchScore());
    const text = isSetOver(state, set)
        ? `Set ${set} is over (${state.us}:${state.them}). Use Undo to correct it.`
        : 'The match is over.';
    banner.appendChild(el('span', null, text));
    if (!matchOver && set < 5) {
        banner.appendChild(button(`Go to set ${set + 1}`, 'btn btn-primary', () => {
            setCurrentSet(set + 1);
            resetAction();
            notifyChange();
        }));
    }
    return banner;
}

function renderActionSelect(blocked) {
    const wrap = el('div', 'action-select-wrap');
    ACTIONS.forEach(action => {
        const disabled = blocked.includes(action);
        const className = 'action-select-btn' + (selectedAction === action && !disabled ? ' active' : '');
        const btn = button(action, className, () => {
            selectedAction = action;
            notifyChange();
        });
        btn.disabled = disabled;
        wrap.appendChild(btn);
    });
    return wrap;
}

function liberoLabel(n) {
    return getLiberos().length > 1 ? `L${n}` : 'L';
}

function recordOutcome(player, outcome) {
    if (!selectedAction) return alert('Select an action first');
    const action = selectedAction;
    recordAndCheckSetEnd(() => recordPlayerAction(player.id, action, outcome), flowHooks);
    selectNextAction(action);
    confirmRecorded(player.id, outcome);
    notifyChange();
}

// The next render flashes whatever was just recorded, so it's clear the tap counted.
function confirmRecorded(key, outcome) {
    flash = { key, outcome };
    navigator.vibrate?.(25);
}

function flashClass(key) {
    return flash && flash.key === key ? ` flash flash-${flash.outcome}` : '';
}

function countsText(player, setAgg, totalAgg) {
    const cur = winnersErrors(playerCounts(setAgg, player.id));
    const total = winnersErrors(playerCounts(totalAgg, player.id));
    return `+${cur.winners}(${total.winners}) -${cur.errors}(${total.errors})`;
}

// Liberos are substituted with the libero buttons only; while one is on court, only that player can swap.
function substitutionButtons(player) {
    const liberos = getLiberos();
    const onCourt = liberoOnCourt();
    const buttons = { bench: null, liberos: null };
    if (!player.liberoNo) {
        buttons.bench = button('Bench', 'btn btn-secondary exchange-btn', () => openExchangeModal(player.id));
    }
    if (liberos.length > 0 && (!onCourt || onCourt === player)) {
        buttons.liberos = el('div', 'libero-buttons');
        liberos.forEach(libero => {
            const label = liberos.length > 1 ? `L${libero.liberoNo}` : 'Libero';
            buttons.liberos.appendChild(button(label, 'btn btn-secondary swap-libero', () => {
                undoable(() => swapWithLibero(player.id, libero.liberoNo));
                notifyChange();
            }));
        });
    }
    return buttons;
}

// Libero slots hold the libero, or while she is on court the player she covers.
function reservePlayers() {
    const players = getPlayers();
    return {
        liberos: getLiberos().map(libero => {
            const n = libero.liberoNo;
            const waiting = players.find(p => p.role === liberoSlot(n));
            return { n, player: waiting, covered: waiting && waiting !== libero };
        }),
        bench: players.filter(p => !p.role)
    };
}

// The court view's drag and drop counterpart of `substitutionButtons`. `target` is { player }, { libero: n } or
// { bench: true }; returns the substitution to run, or null if the drop isn't allowed. A libero only comes in
// for a player for whom `backRow(player)` holds. Dropping the setter on the opposite (or the other way round)
// records that they swap jobs, which only works while the set is `inPlay`.
function substitution(player, target, { backRow, inPlay }) {
    const onCourt = liberoOnCourt();
    const isOnCourt = p => ROLE_ORDER.includes(p.role);
    const other = target.player;
    if (other === player) return null;

    const setterPair = ['setter', 'oppositeHitter'];
    if (other && !player.liberoNo && !other.liberoNo && setterPair.includes(player.role) && setterPair.includes(other.role)) {
        return inPlay ? () => recordSetterSwap() : null;
    }

    if (!player.role) {
        return other && isOnCourt(other) && !other.liberoNo ? () => exchangeWithBench(other.id, player.id) : null;
    }
    if (player === onCourt) {
        const n = player.liberoNo;
        if (target.bench || target.libero === n) return () => swapWithLibero(player.id, n);
        if (target.libero) return () => swapWithLibero(player.id, target.libero);
        return null;
    }
    if (player.liberoNo) {
        const allowed = other && isOnCourt(other) && (onCourt ? other === onCourt : backRow(other));
        return allowed ? () => swapWithLibero(other.id, player.liberoNo) : null;
    }
    if (!isOnCourt(player)) {
        return onCourt && other === onCourt ? () => swapWithLibero(onCourt.id, onCourt.liberoNo) : null;
    }
    if (other && !other.role) return () => exchangeWithBench(player.id, other.id);
    if (target.bench) {
        const bench = getPlayers().filter(p => !p.role);
        if (bench.length === 0) return null;
        return bench.length === 1 ? () => exchangeWithBench(player.id, bench[0].id) : () => openExchangeModal(player.id);
    }
    return target.libero && !onCourt && backRow(player) ? () => swapWithLibero(player.id, target.libero) : null;
}

// Inactive rows (e.g. everyone but the server) keep only the substitution buttons.
function renderPlayerRow(player, pos, active, setAgg, totalAgg) {
    let className = 'onfield-row';
    if (!active) className += ' inactive';
    if (player.liberoNo) className += ' libero';
    const row = el('div', className + flashClass(player.id));
    const name = el('div', 'onfield-name');
    if (pos) name.appendChild(el('span', 'pos-badge' + (FRONT_ROW.includes(pos) ? ' front' : ''), pos));
    name.appendChild(document.createTextNode(player.liberoNo ? `${player.name} (${liberoLabel(player.liberoNo)})` : player.name));
    row.appendChild(name);

    const controls = el('div', 'onfield-controls stats-controls');
    Object.entries(OUTCOME_SYMBOLS).forEach(([outcome, symbol]) => {
        controls.appendChild(button(symbol, `big-btn ${outcome}`, () => recordOutcome(player, outcome)));
    });
    row.appendChild(controls);

    const actionControls = el('div', 'onfield-controls action-controls');
    const subs = substitutionButtons(player);
    if (subs.bench) actionControls.appendChild(subs.bench);
    if (subs.liberos) actionControls.appendChild(subs.liberos);
    row.appendChild(actionControls);

    row.appendChild(el('div', 'player-counts', countsText(player, setAgg, totalAgg)));
    return row;
}

// Same meaning as for our players: + is a point won by the opponent, - an opponent error.
function renderOpponentRow(setAgg, totalAgg, blocked) {
    const row = el('div', 'opponent-row');
    row.appendChild(el('div', 'onfield-name', getTeamNames().opponent));

    const controls = el('div', 'opponent-controls');
    Object.entries(OPP_ACTIONS).forEach(([action, outcomes]) => {
        const disabled = blocked.includes(action);
        let className = 'opp-group';
        if (outcomes.length === 1) className += ' single';
        if (disabled) className += ' disabled';
        const group = el('div', className + flashClass(`opp-${action}`));
        group.appendChild(el('span', 'opp-group-label', action));
        if (outcomes.includes('positive')) group.appendChild(opponentButton('+', 'positive', action, () => recordOppPoint(action)));
        if (outcomes.includes('negative')) group.appendChild(opponentButton('-', 'negative', action, () => recordOppError(action)));
        group.querySelectorAll('button').forEach(btn => { btn.disabled = disabled; });
        controls.appendChild(group);
    });
    row.appendChild(controls);

    const points = `+${sumOpp(setAgg.oppPoints)}(${sumOpp(totalAgg.oppPoints)})`;
    const errors = `-${sumOpp(setAgg.oppErrors)}(${sumOpp(totalAgg.oppErrors)})`;
    row.appendChild(el('div', 'player-counts', `${points} ${errors}`));
    return row;
}

function opponentButton(symbol, outcome, action, recordFn) {
    return button(symbol, `opp-btn ${outcome}`, () => {
        recordAndCheckSetEnd(recordFn, flowHooks);
        selectedAction = actionForServe(replaySet(getCurrentSet()));
        confirmRecorded(`opp-${action}`, outcome);
        notifyChange();
    });
}

function renderToolbar(set, inPlay) {
    const container = document.getElementById('set-selector-container');
    container.innerHTML = '';
    container.appendChild(renderSetSelector());
    container.appendChild(button('Lineup', 'btn btn-secondary', () => openSetup(set)));
    const adjust = button('Adjust', 'btn btn-secondary', () => openAdjustModal(flowHooks));
    adjust.disabled = !inPlay;
    container.appendChild(adjust);
    document.getElementById('undo-btn').disabled = !canUndo();
    document.getElementById('redo-btn').disabled = !canRedo();
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
                undoable(() => exchangeWithBench(fieldPlayerId, select.value));
                close();
                notifyChange();
            }));
        }
        btnRow.appendChild(button('Cancel', 'btn', close));
        modal.appendChild(btnRow);
    });
}
