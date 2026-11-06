// Set setup: the lineup, where the setter starts, which team serves first and, for the sideline view, which
// side we play on.
import { getSetSetup, setSetSetup, getTeamNames, getOurSide } from './match.js';
import { renderLineupBoard } from './lineup-board.js';
import { courtOrientation } from './court-layout.js';
import { getActionsLayout } from './settings.js';
import { el, button, notifyChange } from './dom.js';
import { openModal } from './modal.js';

export function openSetupModal(set, onSaved = () => {}) {
    const existing = getSetSetup(set);
    let weServeFirst = existing ? existing.weServeFirst : defaultFirstServe(set);
    let setterStart = existing ? existing.setterStart : defaultSetterStart(weServeFirst);
    let setterChosen = !!existing;
    let ourSide = getOurSide(set);
    const sideView = getActionsLayout() === 'side';
    const names = getTeamNames();

    openModal(`Set ${set}: Lineup`, (modal, close) => {
        modal.classList.add('setup-modal');
        modal.appendChild(el('p', 'modal-label', 'First serve'));
        const serveToggle = el('div', 'segmented');
        modal.appendChild(serveToggle);

        const sideToggle = el('div', 'segmented');
        if (sideView) {
            modal.appendChild(el('p', 'modal-label', `Side of ${names.team} (as you see it)`));
            modal.appendChild(sideToggle);
        }

        modal.appendChild(el('p', 'modal-label', 'Setter starts on'));
        const setterPicker = el('div', 'segmented setter-picker');
        modal.appendChild(setterPicker);

        const board = el('div');
        modal.appendChild(board);

        const render = () => {
            setterPicker.innerHTML = '';
            for (let pos = 1; pos <= 6; pos++) {
                setterPicker.appendChild(button(pos, 'segmented-btn' + (pos === setterStart ? ' active' : ''), () => {
                    setterStart = pos;
                    setterChosen = true;
                    render();
                }));
            }
            renderLineupBoard(board, setterStart, courtOrientation(set, ourSide));

            sideToggle.innerHTML = '';
            [['left', 'Left'], ['right', 'Right']].forEach(([value, label]) => {
                sideToggle.appendChild(button(label, 'segmented-btn' + (ourSide === value ? ' active' : ''), () => {
                    ourSide = value;
                    render();
                }));
            });

            serveToggle.innerHTML = '';
            [[true, names.team], [false, names.opponent]].forEach(([value, label]) => {
                serveToggle.appendChild(button(label, 'segmented-btn' + (weServeFirst === value ? ' active' : ''), () => {
                    weServeFirst = value;
                    if (!setterChosen) setterStart = defaultSetterStart(value);
                    render();
                }));
            });
        };
        render();

        const btnRow = el('div', 'modal-buttons');
        btnRow.appendChild(button('Close', 'btn', close));
        btnRow.appendChild(button(existing ? 'Save' : 'Start set', 'btn btn-primary', () => {
            const setup = { setterStart, weServeFirst };
            if (sideView || existing?.ourSide) setup.ourSide = sideView ? ourSide : existing.ourSide;
            setSetSetup(set, setup);
            close();
            onSaved();
            notifyChange();
        }));
        modal.appendChild(btnRow);
    });
}

// Most teams start with the setter serving, or on position 2 when receiving.
function defaultSetterStart(weServeFirst) {
    return weServeFirst ? 1 : 2;
}

// The first serve alternates between sets; set 5 starts with a new coin toss.
function defaultFirstServe(set) {
    const first = getSetSetup(1);
    if (!first || set === 1 || set === 5) return true;
    return set % 2 === 1 ? first.weServeFirst : !first.weServeFirst;
}
