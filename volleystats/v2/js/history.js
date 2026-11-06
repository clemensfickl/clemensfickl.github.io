// Undo and redo for the Actions screen: recorded events, substitutions and lineup moves.
// Each undo step is a snapshot of the state before the change: the number of events, the roster, the applied
// libero target, and where the user was (set and selected action). Redo steps also keep the removed events.
import { load, save, remove } from './storage.js';
import { getEvents, truncateEvents, appendEvents, getCurrentSet, setCurrentSet } from './actions.js';
import { getPlayers, rosterSnapshot, restoreRoster } from './players.js';
import { getAppliedLiberoTarget, setAppliedLiberoTarget, getTeamNames, replaySet, ROLE_ORDER } from './match.js';
import { actionLabel } from './rally-view.js';

const LIMIT = 200;

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

// Runs `change` as one undo step, unless it didn't change any event or role. The step's description is taken
// right away, before the automatic libero switch reacts to it.
export function undoable(change) {
    const before = capture();
    const result = change();
    const roster = rosterSnapshot();
    const changed = getEvents().length !== before.eventCount || JSON.stringify(roster) !== JSON.stringify(before.roster);
    if (changed) {
        const step = describe(before.roster, roster, getEvents().slice(before.eventCount));
        history.undo.push({ ...before, step });
        if (history.undo.length > LIMIT) history.undo.shift();
        history.redo = [];
        saveHistory();
    }
    return result;
}

// Undo and redo only work in the set the next step belongs to, so a set can't be changed once a later set has
// newer steps, and Undo in set 2 never reaches into set 1.
function nextUndoSet() {
    const top = history.undo[history.undo.length - 1];
    if (top) return top.set;
    const events = getEvents();
    return events.length > 0 ? events[events.length - 1].set : null;
}

export function canUndo(set = getCurrentSet()) {
    return nextUndoSet() === set;
}

export function canRedo(set = getCurrentSet()) {
    const top = history.redo[history.redo.length - 1];
    return !!top && top.set === set;
}

// Returns { text, key } describing what was undone (key: the player or opponent group to highlight), or null.
export function undo() {
    if (!canUndo()) return null;
    const events = getEvents();
    let before = history.undo.pop();
    if (before && before.eventCount > events.length) {
        history.undo = [];
        before = null;
    }
    // Events recorded before undo history existed, or beyond its limit, are undone one by one.
    if (!before) {
        if (events.length === 0) return null;
        const last = events[events.length - 1];
        before = { ...capture(), eventCount: events.length - 1, set: last.set, view: null, step: describeEvent(last) };
    }
    const after = capture();
    const removed = truncateEvents(before.eventCount);
    const step = before.step || describe(before.roster, after.roster, removed);
    restore(before);
    history.redo.push({ ...after, events: removed, step });
    saveHistory();
    return step;
}

export function redo() {
    if (!canRedo()) return null;
    const after = history.redo.pop();
    const before = capture();
    if (before.eventCount + after.events.length !== after.eventCount) {
        history.redo = [];
        saveHistory();
        return null;
    }
    appendEvents(after.events);
    restore(after);
    history.undo.push({ ...before, step: after.step });
    saveHistory();
    return after.step;
}

// The steps of `set` in order, for the history popup: { done, undone, blockedBy }. Each step is
// { text, event, score }: `event` is the step's (last) event, null for substitutions, and the score is the one
// after the step. `blockedBy` is the later set whose steps must be undone first.
export function getTimeline(set) {
    const events = getEvents();
    const undone = [...history.redo].reverse();
    const timeline = events.concat(...undone.map(entry => entry.events));
    const stepOf = (entry, start, end) => {
        const stepEvents = timeline.slice(start, end);
        const state = replaySet(set, timeline.slice(0, end));
        return {
            text: (entry?.step || describeRange(stepEvents)).text,
            event: stepEvents[stepEvents.length - 1] || null,
            score: `${state.us}:${state.them}`
        };
    };

    const firstTracked = history.undo.length > 0 ? history.undo[0].eventCount : events.length;
    const done = [];
    events.slice(0, firstTracked).forEach((event, i) => {
        if (event.set === set) done.push(stepOf(null, i, i + 1));
    });
    history.undo.forEach((entry, i) => {
        if (entry.set !== set) return;
        const end = i + 1 < history.undo.length ? history.undo[i + 1].eventCount : events.length;
        done.push(stepOf(entry, entry.eventCount, end));
    });
    const redoable = undone
        .filter(entry => entry.set === set)
        .map(entry => stepOf(entry, entry.eventCount - entry.events.length, entry.eventCount));

    const next = nextUndoSet();
    const blockedBy = done.length > 0 && next !== set ? next : null;
    return { done, undone: redoable, blockedBy };
}

function describeRange(events) {
    return events.length > 0 ? describeEvent(events[events.length - 1]) : { text: 'Substitution', key: null };
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
            return { text: `${playerName(event.playerId)} · ${actionLabel(event.action, event.outcome)}`, key: event.playerId };
        case 'oppPoint':
            return { text: `${names.opponent} · ${actionLabel(event.action, 'positive')}`, key: `opp-${event.action}` };
        case 'oppError':
            return { text: `${names.opponent} · ${actionLabel(event.action, 'negative')}`, key: `opp-${event.action}` };
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
