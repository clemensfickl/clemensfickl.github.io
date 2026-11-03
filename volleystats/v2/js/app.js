// Entry point: loads persisted state, then initializes the UI.
import { initUI } from './ui.js';
import { loadPlayers } from './players.js';
import { loadEvents } from './actions.js';

document.addEventListener('DOMContentLoaded', () => {
    loadPlayers();
    loadEvents();
    initUI();
});
