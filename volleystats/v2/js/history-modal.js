// The undo history of the current set: newest steps on top, undone ones above the current state.
import { getCurrentSet } from './actions.js';
import { getTimeline, canUndo, canRedo } from './history.js';
import { getPlayers } from './players.js';
import { replaySet, pointWinner, getTeamNames } from './match.js';
import { describeEvent, renderDescription } from './rally-view.js';
import { el, button } from './dom.js';
import { icon } from './icons.js';
import { openModal } from './modal.js';

// `hooks.undo` and `hooks.redo` run the step with the tracker's feedback.
export function openHistoryModal(hooks) {
    const set = getCurrentSet();
    openModal(`Set ${set}: History`, (modal, close) => {
        modal.classList.add('history-modal');
        const list = el('ol', 'point-list history-list');
        const note = el('p', 'modal-text muted');
        const undoBtn = iconButton('undo', 'Undo', () => { hooks.undo(); render(); });
        const redoBtn = iconButton('redo', 'Redo', () => { hooks.redo(); render(); });

        const render = () => {
            const { done, undone, blockedBy } = getTimeline(set);
            const playersById = Object.fromEntries(getPlayers().map(p => [p.id, p.name]));
            const names = getTeamNames();
            const item = (step, className) => stepItem(step, className, playersById, names);
            list.innerHTML = '';
            [...undone].reverse().forEach(step => list.appendChild(item(step, 'undone')));
            const state = replaySet(set);
            const now = el('li', 'point-item history-now');
            now.append(el('span', 'point-score', `${state.us}:${state.them}`), el('span', 'point-desc', 'Now'));
            list.appendChild(now);
            [...done].reverse().forEach(step => list.appendChild(item(step, 'done')));
            if (done.length === 0) list.appendChild(el('li', 'point-item history-empty', 'Nothing recorded in this set yet.'));

            now.scrollIntoView({ block: 'nearest' });
            note.textContent = blockedBy ? `Set ${blockedBy} has newer steps. Undo them there first.` : '';
            note.hidden = !blockedBy;
            undoBtn.disabled = !canUndo(set);
            redoBtn.disabled = !canRedo(set);
        };

        modal.appendChild(list);
        modal.appendChild(note);
        const btnRow = el('div', 'modal-buttons');
        btnRow.append(undoBtn, redoBtn, button('Close', 'btn', close));
        modal.appendChild(btnRow);
        render();
    });
}

// Like a point log entry. Rally-ending steps get the winner's color; substitutions and corrections have no actor.
function stepItem(step, state, playersById, names) {
    const winner = step.event && pointWinner(step.event);
    const item = el('li', `point-item history-step ${state}` + (winner ? ` ${winner}` : ''));
    item.appendChild(el('span', 'point-score', step.score));
    item.appendChild(renderDescription(stepDescription(step, winner, playersById, names)));
    return item;
}

function stepDescription(step, winner, playersById, names) {
    const event = step.event;
    if (!event) return { actor: null, outcome: 'substitution', text: step.text };
    if (!['player', 'oppPoint', 'oppError'].includes(event.type)) return { actor: null, outcome: null, text: step.text };
    const desc = describeEvent(event, playersById, names);
    return winner ? desc : { ...desc, outcome: 'neutral' };
}

function iconButton(name, label, onClick) {
    const btn = button('', 'btn btn-secondary icon-text-btn', onClick);
    btn.append(icon(name), el('span', null, label));
    return btn;
}
