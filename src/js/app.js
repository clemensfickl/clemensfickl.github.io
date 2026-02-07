// Entry point for the volleyball statistics application
// Initializes the app, sets up event listeners, and manages the flow between different screens

import ui from './ui.js';
import { loadPlayers } from './players.js';
import { loadActionStack } from './actions.js';

document.addEventListener('DOMContentLoaded', () => {
    // load persisted players then initialize UI
    loadPlayers();
    loadActionStack();
    ui.initUI();
});