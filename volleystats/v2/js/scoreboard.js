// Scoreboard shown below the tabs on every screen.
import { getCurrentSet } from './actions.js';
import { replaySet, getTeamNames } from './match.js';
import { el } from './dom.js';

export function renderScoreboard() {
    const board = document.getElementById('scoreboard');
    const set = getCurrentSet();
    const state = replaySet(set);
    const names = getTeamNames();

    board.innerHTML = '';
    const row = el('div', 'sb-row');
    row.appendChild(el('div', 'sb-name sb-us', names.team));
    const score = el('div', 'sb-score');
    score.append(el('span', 'sb-points', state.us), el('span', 'sb-sep', ':'), el('span', 'sb-points', state.them));
    row.appendChild(score);
    row.appendChild(el('div', 'sb-name sb-them', names.opponent));
    board.appendChild(row);

    board.appendChild(el('div', 'sb-meta', `Set ${set}`));
}
