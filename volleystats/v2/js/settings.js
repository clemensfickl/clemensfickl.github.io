// Device preferences that are not part of the match.
import { load, save } from './storage.js';

const LAYOUTS = ['list', 'court', 'side'];

// 'list' (by rotation), or where players play: 'court' seen from behind the baseline, 'side' from the sideline.
export function getActionsLayout() {
    const layout = load('layout', 'court');
    return LAYOUTS.includes(layout) ? layout : 'court';
}

export function setActionsLayout(layout) {
    save('layout', layout);
}

// Receiving in rotation 1, whether the opposite stays on 4 (and the front outside on 2) instead of switching.
// Changed on the court as well as on the Configuration screen, and remembered for the next time.
export function getR1OppositeOnFour() {
    return load('r1OppositeOnFour', true) !== false;
}

export function setR1OppositeOnFour(onFour) {
    save('r1OppositeOnFour', onFour);
}

// Whether the libero automatically replaces the back-row middle.
export function getAutoLibero() {
    return load('autoLibero', true) !== false;
}

export function setAutoLibero(enabled) {
    save('autoLibero', enabled);
}
