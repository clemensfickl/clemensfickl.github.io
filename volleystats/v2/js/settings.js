// Device preferences that are not part of the match.
import { load, save } from './storage.js';

// 'list' (by rotation) or 'court' (where players play).
export function getActionsLayout() {
    return load('layout', 'court') === 'list' ? 'list' : 'court';
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
