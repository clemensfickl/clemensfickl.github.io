// Event log: every tap on the Actions screen appends one event. All statistics are derived from it.
import { load, save, remove } from './storage.js';
import { onCourtIds } from './players.js';

export const ACTIONS = ['Serv', 'Recv', 'Atk', 'Blk', 'Oth'];

// A + on these ends the rally with our point; Recv + only keeps the rally going.
export const SCORING_ACTIONS = ['Serv', 'Atk', 'Blk', 'Oth'];

// Returns 'us', 'them', or null if the event did not end a rally.
export function pointWinner(event) {
    switch (event.type) {
        case 'player':
            if (event.outcome === 'negative') return 'them';
            if (event.outcome === 'positive' && SCORING_ACTIONS.includes(event.action)) return 'us';
            return null;
        case 'oppError':
            return 'us';
        case 'oppPoint':
            return 'them';
        case 'manualPoint':
            return event.to;
        default:
            return null;
    }
}

let events = [];
let currentSet = 1;
let startedAt = null;

export function loadEvents() {
    events = load('events', []);
    currentSet = load('currentSet', 1);
    startedAt = load('startedAt', null);
}

// When the first event of the match was recorded (ms), or null.
export function getStartedAt() {
    return startedAt;
}

export function getEvents() {
    return events;
}

export function getCurrentSet() {
    return currentSet;
}

export function setCurrentSet(setNumber) {
    currentSet = parseInt(setNumber, 10);
    save('currentSet', currentSet);
}

// Points also store who was on court, for plus/minus. Events recorded before this have no `onCourt`.
function record(event) {
    const entry = { ...event, set: currentSet };
    if (pointWinner(entry)) entry.onCourt = onCourtIds();
    if (!startedAt) {
        startedAt = Date.now();
        save('startedAt', startedAt);
    }
    events.push(entry);
    save('events', events);
}

export function recordPlayerAction(playerId, action, outcome) {
    record({ type: 'player', playerId, action, outcome });
}

export function recordOppError(action) {
    record({ type: 'oppError', action });
}

export function recordOppPoint(action) {
    record({ type: 'oppPoint', action });
}

// Corrections: they affect score, rotation or serve but no player statistics.
export function recordManualPoint(to) {
    record({ type: 'manualPoint', to });
}

export function recordRotate(delta) {
    record({ type: 'rotate', delta });
}

export function recordSwitchServe() {
    record({ type: 'switchServe' });
}

// The teams change sides mid-set; only the sideline view shows it.
export function recordSwitchSides() {
    record({ type: 'switchSides' });
}

// Double substitution: the players in the setter and opposite slots swap jobs (and swap back the same way).
export function recordSetterSwap() {
    record({ type: 'setterSwap' });
}

// Removes and returns every event after the first `count`.
export function truncateEvents(count) {
    const removed = events.splice(count);
    save('events', events);
    return removed;
}

export function appendEvents(list) {
    events.push(...list);
    save('events', events);
}

export function resetEvents() {
    replaceEvents([], 1, null);
}

export function replaceEvents(list, set, started) {
    events = list;
    startedAt = started;
    if (list.length) save('events', events);
    else remove('events');
    if (started) save('startedAt', started);
    else remove('startedAt');
    setCurrentSet(set);
}
