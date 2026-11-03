// Entry point: loads persisted state, then initializes the UI.
import { initUI } from './ui.js';
import { loadPlayers } from './players.js';
import { loadEvents } from './actions.js';
import { loadMatch } from './match.js';

document.addEventListener('DOMContentLoaded', () => {
    loadPlayers();
    loadEvents();
    loadMatch();
    initUI();
});
