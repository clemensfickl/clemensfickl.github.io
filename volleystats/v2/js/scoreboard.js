// Scoreboard shown below the tabs on every screen: one row per team with the points of every set.
import { getCurrentSet, getEvents } from './actions.js';
import { replaySet, getTeamNames, isSetOver, isSetInPlay, rotationOf } from './match.js';
import { setsWithEvents } from './stats.js';
import { el } from './dom.js';

export function renderScoreboard() {
    const board = document.getElementById('scoreboard');
    const current = getCurrentSet();
    const state = replaySet(current);
    const names = getTeamNames();
    const lastSet = Math.max(current, ...setsWithEvents(getEvents()));
    const sets = [];
    for (let set = 1; set <= lastSet; set++) sets.push({ set, state: set === current ? state : replaySet(set) });

    const serving = isSetInPlay(state, current) ? state.serving : null;

    board.innerHTML = '';
    board.style.setProperty('--sb-sets', sets.length);
    board.appendChild(teamRow(names.team, 'us', serving === 'us', sets, current));
    board.appendChild(teamRow(names.opponent, 'them', serving === 'them', sets, current));

    const meta = el('div', 'sb-meta');
    meta.appendChild(el('span', null, `Set ${current}`));
    if (state.setterPos) meta.appendChild(el('span', null, `Rot ${rotationOf(state)}`));
    board.appendChild(meta);
}

function teamRow(name, side, serving, sets, current) {
    const row = el('div', `sb-team sb-${side}`);
    const nameCell = el('div', 'sb-name');
    const dot = el('span', 'sb-serve' + (serving ? ' on' : ''));
    if (serving) dot.title = 'Serving';
    nameCell.append(dot, el('span', 'sb-name-text', name));
    row.appendChild(nameCell);

    sets.forEach(({ set, state }) => {
        const other = side === 'us' ? 'them' : 'us';
        let className = 'sb-set';
        if (set === current) className += ' current';
        if (isSetOver(state, set) && state[side] > state[other]) className += ' won';
        row.appendChild(el('span', className, state[side]));
    });
    return row;
}
