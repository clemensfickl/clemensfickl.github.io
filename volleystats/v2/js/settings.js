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

// Whether the libero automatically replaces the back-row middle.
export function getAutoLibero() {
    return load('autoLibero', true) !== false;
}

export function setAutoLibero(enabled) {
    save('autoLibero', enabled);
}
