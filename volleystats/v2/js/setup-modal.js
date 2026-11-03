// Set setup: the lineup, where the setter starts and which team serves first.
import { getSetSetup, setSetSetup, getTeamNames } from './match.js';
import { renderLineupBoard } from './lineup-board.js';
import { el, button, notifyChange } from './dom.js';
import { openModal } from './modal.js';

export function openSetupModal(set, onSaved = () => {}) {
    const existing = getSetSetup(set);
    let setterStart = existing ? existing.setterStart : 1;
    let weServeFirst = existing ? existing.weServeFirst : true;
    const names = getTeamNames();

    openModal(`Set ${set}: lineup`, (modal, close) => {
        modal.classList.add('setup-modal');
        modal.appendChild(el('p', 'modal-label', 'Setter starts on'));
        const setterPicker = el('div', 'segmented setter-picker');
        modal.appendChild(setterPicker);

        modal.appendChild(el('p', 'modal-label', 'First serve'));
        const serveToggle = el('div', 'segmented');
        modal.appendChild(serveToggle);

        const board = el('div');
        modal.appendChild(board);

        const render = () => {
            setterPicker.innerHTML = '';
            for (let pos = 1; pos <= 6; pos++) {
                setterPicker.appendChild(button(pos, 'segmented-btn' + (pos === setterStart ? ' active' : ''), () => {
                    setterStart = pos;
                    render();
                }));
            }
            renderLineupBoard(board, setterStart);

            serveToggle.innerHTML = '';
            [[true, names.team], [false, names.opponent]].forEach(([value, label]) => {
                serveToggle.appendChild(button(label, 'segmented-btn' + (weServeFirst === value ? ' active' : ''), () => {
                    weServeFirst = value;
                    render();
                }));
            });
        };
        render();

        const btnRow = el('div', 'modal-buttons');
        btnRow.appendChild(button('Close', 'btn', close));
        btnRow.appendChild(button(existing ? 'Save' : 'Start set', 'btn btn-primary', () => {
            setSetSetup(set, { setterStart, weServeFirst });
            close();
            onSaved();
            notifyChange();
        }));
        modal.appendChild(btnRow);
    });
}
