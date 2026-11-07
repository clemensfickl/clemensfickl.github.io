// Entry point: loads persisted state, then initializes the UI.
import { initUI } from './ui.js';
import { loadPlayers } from './players.js';
import { loadEvents } from './actions.js';
import { loadMatch } from './match.js';
import { loadHistory } from './history.js';
import { loadArchive } from './archive.js';

document.addEventListener('DOMContentLoaded', () => {
    loadPlayers();
    loadEvents();
    loadMatch();
    loadHistory();
    loadArchive();
    initUI();
});
