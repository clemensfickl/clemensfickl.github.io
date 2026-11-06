// Undo and redo for the Actions screen: recorded events, substitutions and lineup moves.
// Each undo step is a snapshot of the state before the change: the number of events, the roster, the applied
// libero target, and where the user was (set and selected action). Redo steps also keep the removed events.
import { load, save, remove } from './storage.js';
import { getEvents, truncateEvents, appendEvents, getCurrentSet, setCurrentSet } from './actions.js';
import { getPlayers, rosterSnapshot, restoreRoster } from './players.js';
import { getAppliedLiberoTarget, setAppliedLiberoTarget, getTeamNames, ROLE_ORDER } from './match.js';

const LIMIT = 200;
const SYMBOLS = { positive: '+', neutral: '~', negative: '-' };

let history = { undo: [], redo: [] };
let view = { get: () => null, set: () => {} };

export function loadHistory() {
    history = { undo: [], redo: [], ...load('history', {}) };
}

function saveHistory() {
    save('history', history);
}

export function clearHistory() {
    history = { undo: [], redo: [] };
    remove('history');
}

// The tracker's selection, so undo and redo return to it. `set(null)` lets the tracker pick one itself.
export function bindViewState(get, set) {
    view = { get, set };
}

function capture() {
    return {
        eventCount: getEvents().length,
        set: getCurrentSet(),
        roster: rosterSnapshot(),
        liberoTarget: getAppliedLiberoTarget(),
        view: view.get()
    };
}

function restore(snapshot) {
    restoreRoster(snapshot.roster);
    setAppliedLiberoTarget(snapshot.liberoTarget);
    setCurrentSet(snapshot.set);
    view.set(snapshot.view);
}

// Runs `change` as one undo step, unless it didn't change any event or role.
export function undoable(change) {
    const before = capture();
    const result = change();
    const changed = getEvents().length !== before.eventCount
        || JSON.stringify(rosterSnapshot()) !== JSON.stringify(before.roster);
    if (changed) {
        history.undo.push(before);
        if (history.undo.length > LIMIT) history.undo.shift();
        history.redo = [];
        saveHistory();
    }
    return result;
}

export function canUndo() {
    return history.undo.length > 0 || getEvents().length > 0;
}

export function canRedo() {
    return history.redo.length > 0;
}

// Returns { text, key } describing what was undone (key: the player or opponent group to highlight), or null.
export function undo() {
    const events = getEvents();
    let before = history.undo.pop();
    if (before && before.eventCount > events.length) {
        history.undo = [];
        before = null;
    }
    // Events recorded before undo history existed, or beyond its limit, are undone one by one.
    if (!before) {
        if (events.length === 0) return null;
        before = { ...capture(), eventCount: events.length - 1, set: events[events.length - 1].set, view: null };
    }
    const after = capture();
    const removed = truncateEvents(before.eventCount);
    restore(before);
    history.redo.push({ ...after, events: removed });
    saveHistory();
    return describe(before.roster, after.roster, removed);
}

export function redo() {
    const after = history.redo.pop();
    if (!after) return null;
    const before = capture();
    if (before.eventCount + after.events.length !== after.eventCount) {
        history.redo = [];
        saveHistory();
        return null;
    }
    appendEvents(after.events);
    restore(after);
    history.undo.push(before);
    saveHistory();
    return describe(before.roster, after.roster, after.events);
}

function describe(rosterBefore, rosterAfter, events) {
    const event = events[events.length - 1];
    return event ? describeEvent(event) : describeRoster(rosterBefore, rosterAfter);
}

function playerName(id) {
    return getPlayers().find(p => p.id === id)?.name || 'Unknown player';
}

function describeEvent(event) {
    const names = getTeamNames();
    switch (event.type) {
        case 'player':
            return { text: `${playerName(event.playerId)} · ${event.action} ${SYMBOLS[event.outcome]}`, key: event.playerId };
        case 'oppPoint':
            return { text: `${names.opponent} · ${event.action} +`, key: `opp-${event.action}` };
        case 'oppError':
            return { text: `${names.opponent} · ${event.action} -`, key: `opp-${event.action}` };
        case 'manualPoint':
            return { text: `+1 ${event.to === 'us' ? names.team : names.opponent}`, key: null };
        case 'rotate':
            return { text: event.delta > 0 ? 'Rotate forward' : 'Rotate back', key: null };
        case 'switchServe':
            return { text: 'Switch serve', key: null };
        case 'setterSwap':
            return { text: 'Setter ⇄ opposite swap', key: null };
        default:
            return { text: 'Action', key: null };
    }
}

function describeRoster(rosterBefore, rosterAfter) {
    const before = new Map(rosterBefore.map(([id, role]) => [id, role]));
    const onCourt = role => ROLE_ORDER.includes(role);
    const changed = rosterAfter.filter(([id, role]) => before.has(id) && before.get(id) !== role);
    const comingIn = changed.filter(([id, role]) => onCourt(role) && !onCourt(before.get(id)));
    const goingOut = changed.filter(([id, role]) => !onCourt(role) && onCourt(before.get(id)));
    if (comingIn.length === 1 && goingOut.length === 1) {
        return { text: `${playerName(comingIn[0][0])} in for ${playerName(goingOut[0][0])}`, key: comingIn[0][0] };
    }
    if (changed.length === 2) {
        return { text: `${playerName(changed[0][0])} ⇄ ${playerName(changed[1][0])}`, key: changed[0][0] };
    }
    return { text: 'Lineup change', key: null };
}
