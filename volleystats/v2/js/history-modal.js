// The undo history of the current set: newest steps on top, undone ones above the current state.
import { getCurrentSet } from './actions.js';
import { getTimeline, canUndo, canRedo } from './history.js';
import { replaySet } from './match.js';
import { el, button } from './dom.js';
import { icon } from './icons.js';
import { openModal } from './modal.js';

// `hooks.undo` and `hooks.redo` run the step with the tracker's feedback.
export function openHistoryModal(hooks) {
    const set = getCurrentSet();
    openModal(`Set ${set}: History`, (modal, close) => {
        modal.classList.add('history-modal');
        const list = el('ol', 'history-list');
        const note = el('p', 'modal-text muted');
        const undoBtn = iconButton('undo', 'Undo', () => { hooks.undo(); render(); });
        const redoBtn = iconButton('redo', 'Redo', () => { hooks.redo(); render(); });

        const render = () => {
            const { done, undone, blockedBy } = getTimeline(set);
            list.innerHTML = '';
            [...undone].reverse().forEach(step => list.appendChild(stepItem(step, 'undone')));
            const state = replaySet(set);
            const now = el('li', 'history-now');
            now.append(el('span', null, 'Now'), el('span', 'history-score', `${state.us}:${state.them}`));
            list.appendChild(now);
            [...done].reverse().forEach(step => list.appendChild(stepItem(step, 'done')));
            if (done.length === 0) list.appendChild(el('li', 'history-empty', 'Nothing recorded in this set yet.'));

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

function stepItem(step, state) {
    const item = el('li', `history-step ${state}`);
    item.append(el('span', 'history-text', step.text), el('span', 'history-score', step.score));
    return item;
}

function iconButton(name, label, onClick) {
    const btn = button('', 'btn btn-secondary icon-text-btn', onClick);
    btn.append(icon(name), el('span', null, label));
    return btn;
}
