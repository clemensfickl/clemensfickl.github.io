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
    row.appendChild(teamName(names.team, 'sb-us', state.serving === 'us'));
    const score = el('div', 'sb-score');
    score.append(el('span', 'sb-points', state.us), el('span', 'sb-sep', ':'), el('span', 'sb-points', state.them));
    row.appendChild(score);
    row.appendChild(teamName(names.opponent, 'sb-them', state.serving === 'them'));
    board.appendChild(row);

    const meta = [`Set ${set}`];
    if (state.setterPos) meta.push(`Rotation ${state.setterPos}`);
    board.appendChild(el('div', 'sb-meta', meta.join(' · ')));
}

function teamName(name, className, serving) {
    const node = el('div', `sb-name ${className}`);
    node.appendChild(el('span', 'sb-name-text', name));
    if (serving) {
        const dot = el('span', 'sb-serve');
        dot.title = 'Serving';
        node.appendChild(dot);
    }
    return node;
}
