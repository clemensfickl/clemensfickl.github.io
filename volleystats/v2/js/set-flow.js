// Score corrections and the end-of-set / end-of-match prompts.
import { getCurrentSet, setCurrentSet, recordManualPoint, recordRotate, recordSwitchServe, recordSetterSwap, undoLastAction } from './actions.js';
import { replaySet, isSetOver, getMatchScore, isMatchOver, getTeamNames, rotationOf } from './match.js';
import { el, button, notifyChange } from './dom.js';
import { openModal } from './modal.js';

// Runs `recordFn` and opens the set-end prompt if that event decided the set. Returns whether it did.
// `onNextSet` resets the tracker's selected action, after moving on or after undoing the deciding point.
export function recordAndCheckSetEnd(recordFn, onNextSet) {
    const set = getCurrentSet();
    const wasOver = isSetOver(replaySet(set), set);
    recordFn();
    const state = replaySet(set);
    const decided = !wasOver && isSetOver(state, set);
    if (decided) openSetEndModal(set, state, onNextSet);
    return decided;
}

function openSetEndModal(set, state, onNextSet) {
    const names = getTeamNames();
    const sets = getMatchScore();
    const winner = state.us > state.them ? names.team : names.opponent;
    const matchOver = isMatchOver(sets);

    openModal(matchOver ? 'Match finished' : `Set ${set} finished`, (modal, close) => {
        const summary = matchOver
            ? `${winner} wins the match ${Math.max(sets.us, sets.them)}–${Math.min(sets.us, sets.them)}.`
            : `${winner} wins set ${set} ${state.us}:${state.them}.`;
        modal.appendChild(el('p', 'modal-text', summary));
        modal.appendChild(el('p', 'modal-text muted', `Sets: ${names.team} ${sets.us}–${sets.them} ${names.opponent}`));

        const btnRow = el('div', 'modal-buttons');
        btnRow.appendChild(button('Undo', 'btn btn-secondary modal-undo', () => {
            undoLastAction();
            close();
            onNextSet();
            notifyChange();
        }));
        if (matchOver) {
            btnRow.appendChild(button('OK', 'btn btn-primary', close));
        } else {
            btnRow.appendChild(button('Close', 'btn', close));
            btnRow.appendChild(button(`Start set ${set + 1}`, 'btn btn-primary', () => {
                setCurrentSet(set + 1);
                close();
                onNextSet();
                notifyChange();
            }));
        }
        modal.appendChild(btnRow);
    });
}

// `resetAction` lets the tracker re-derive the selected action from the new serve.
export function openAdjustModal(resetAction) {
    const names = getTeamNames();
    openModal('Adjust score', (modal, close) => {
        const status = el('div', 'adjust-status');
        const statusScore = el('div', 'adjust-score');
        const statusMeta = el('div', 'adjust-meta');
        status.append(statusScore, statusMeta);
        modal.appendChild(status);

        const update = () => {
            const state = replaySet(getCurrentSet());
            statusScore.textContent = `${state.us}:${state.them}`;
            const meta = [];
            if (state.serving) meta.push(`${state.serving === 'us' ? names.team : names.opponent} serves`);
            if (state.setterPos) meta.push(`Rotation ${rotationOf(state)}`);
            if (state.setterSwapped) meta.push('Setter and opposite swapped');
            statusMeta.textContent = meta.join(' · ');
        };
        const pointButton = (name, className, to) => {
            const btn = button('', `btn ${className}`, act(() => recordManualPoint(to)));
            btn.append(el('span', 'adjust-plus', '+1'), el('span', 'adjust-team', name));
            return btn;
        };
        const act = recordFn => () => {
            const decided = recordAndCheckSetEnd(recordFn, resetAction);
            resetAction();
            if (decided) close();
            else update();
            notifyChange();
        };

        const grid = el('div', 'adjust-grid');
        grid.appendChild(pointButton(names.team, 'adjust-us', 'us'));
        grid.appendChild(pointButton(names.opponent, 'adjust-them', 'them'));
        grid.appendChild(button('Rotate forward', 'btn', act(() => recordRotate(1))));
        grid.appendChild(button('Rotate back', 'btn', act(() => recordRotate(-1))));
        grid.appendChild(button('Switch serve', 'btn adjust-wide', act(() => recordSwitchServe())));
        grid.appendChild(button('Swap setter ⇄ opposite', 'btn adjust-wide', act(() => recordSetterSwap())));
        modal.appendChild(grid);
        modal.appendChild(el('p', 'modal-text muted', 'Points added here count for score and rotation, not for player stats. Use Undo to remove a wrong entry.'));

        const btnRow = el('div', 'modal-buttons');
        btnRow.appendChild(button('Done', 'btn btn-primary', close));
        modal.appendChild(btnRow);
        update();
    });
}
