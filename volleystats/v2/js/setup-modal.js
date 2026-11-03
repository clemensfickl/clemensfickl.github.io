// Set setup: where the setter starts and which team serves first.
import { getSetSetup, setSetSetup, courtPosition, getTeamNames, ROLE_ORDER } from './match.js';
import { getPlayers } from './players.js';
import { el, button, notifyChange } from './dom.js';
import { openModal } from './modal.js';

// Seen from our side of the net: front row on top.
const COURT_LAYOUT = [4, 3, 2, 5, 6, 1];

export function openSetupModal(set, onSaved = () => {}) {
    const existing = getSetSetup(set);
    let setterStart = existing ? existing.setterStart : 1;
    let weServeFirst = existing ? existing.weServeFirst : true;
    const names = getTeamNames();

    openModal(`Set ${set}: starting rotation`, (modal, close) => {
        modal.appendChild(el('p', 'modal-label', 'Tap where the setter starts'));
        const court = el('div', 'court');
        modal.appendChild(el('div', 'court-net', 'Net'));
        modal.appendChild(court);

        modal.appendChild(el('p', 'modal-label', 'First serve'));
        const serveToggle = el('div', 'segmented');
        modal.appendChild(serveToggle);

        const render = () => {
            court.innerHTML = '';
            const byPosition = playersByPosition(setterStart);
            COURT_LAYOUT.forEach(pos => {
                const isSetter = pos === setterStart;
                const cell = button('', 'court-cell' + (isSetter ? ' active' : ''), () => {
                    setterStart = pos;
                    render();
                });
                cell.appendChild(el('span', 'court-pos', pos));
                cell.appendChild(el('span', 'court-player', byPosition[pos] || '–'));
                court.appendChild(cell);
            });

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
        btnRow.appendChild(button('Cancel', 'btn', close));
        btnRow.appendChild(button('Start set', 'btn btn-primary', () => {
            setSetSetup(set, { setterStart, weServeFirst });
            close();
            onSaved();
            notifyChange();
        }));
        modal.appendChild(btnRow);
    });
}

function playersByPosition(setterPos) {
    const result = {};
    getPlayers().forEach(p => {
        if (!ROLE_ORDER.includes(p.role)) return;
        result[courtPosition(p.role, setterPos)] = p.name;
    });
    return result;
}
