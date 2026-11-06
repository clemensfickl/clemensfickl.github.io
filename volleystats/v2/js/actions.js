// Event log: every tap on the Actions screen appends one event. All statistics are derived from it.
import { load, save, remove } from './storage.js';

export const ACTIONS = ['Serv', 'Recv', 'Atk', 'Blk', 'Oth'];

let events = [];
let currentSet = 1;

export function loadEvents() {
    events = load('events', []);
    currentSet = load('currentSet', 1);
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

function record(event) {
    events.push({ ...event, set: currentSet });
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
    events = [];
    remove('events');
    setCurrentSet(1);
}
