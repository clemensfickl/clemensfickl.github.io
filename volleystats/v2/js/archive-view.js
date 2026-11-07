// Configuration screen: New match and the saved matches, grouped by our team name.
import { getArchive, currentSummary, hasCurrentMatch, setsWon, newMatch, openMatch, deleteRecord, updateRecord, renameTeam } from './archive.js';
import { getRawTeamNames } from './match.js';
import { openModal } from './modal.js';
import { showToast } from './toast.js';
import { el, button, notifyChange } from './dom.js';

export function initArchive() {
    document.getElementById('new-match').addEventListener('click', () => run(async () => {
        if (hasCurrentMatch() && !confirm('Start a new match? The current one is kept under Saved matches. Players and our team name stay.')) return;
        const saved = hasCurrentMatch();
        await newMatch();
        notifyChange();
        if (saved) showToast('Match saved. New match started.');
    }));
}

// Storage errors (usually a full localStorage) leave the open match untouched.
async function run(action) {
    try {
        await action();
    } catch (err) {
        console.error(err);
        alert(err?.name === 'QuotaExceededError'
            ? 'Not enough storage left on this device. Delete some saved matches first.'
            : `Something went wrong: ${err?.message || err}`);
    }
}

export function renderArchive() {
    const container = document.getElementById('saved-match-list');
    container.innerHTML = '';
    const entries = getArchive().map(entry => ({ ...entry, open: false }));
    if (hasCurrentMatch()) entries.push({ ...currentSummary(), open: true });
    if (entries.length === 0) {
        container.appendChild(el('p', 'setting-hint', 'Matches are kept here when you start a new match or open another one.'));
        return;
    }

    const groups = new Map();
    entries.forEach(entry => {
        if (!groups.has(entry.team)) groups.set(entry.team, []);
        groups.get(entry.team).push(entry);
    });
    const ourTeam = getRawTeamNames().team || '';
    [...groups.keys()]
        .sort((a, b) => (a === ourTeam ? -1 : b === ourTeam ? 1 : a.localeCompare(b)))
        .forEach(team => container.appendChild(renderGroup(team, groups.get(team))));
}

function renderGroup(team, entries) {
    const group = el('div', 'saved-team');
    const header = el('div', 'saved-team-header');
    header.appendChild(el('h3', null, team || 'Unnamed team'));
    header.appendChild(button('Rename', 'btn btn-link', () => openRenameModal(team, entries.length)));
    group.appendChild(header);

    const list = el('ul', 'saved-match-list');
    entries
        .sort((a, b) => (a.open !== b.open ? (a.open ? -1 : 1) : b.date.localeCompare(a.date)))
        .forEach(entry => list.appendChild(renderEntry(entry)));
    group.appendChild(list);
    return group;
}

function renderEntry(entry) {
    const li = el('li');
    const row = entry.open ? el('div', 'saved-match open') : button('', 'saved-match', () => openMatchModal(entry));
    row.appendChild(el('span', 'saved-date', formatDate(entry.date)));
    row.appendChild(el('span', 'saved-opponent', `vs ${entry.opponent || 'Opponent'}`));
    if (entry.open) row.appendChild(el('span', 'saved-open', 'Open'));
    const won = setsWon(entry.sets);
    const result = won.us >= 3 ? 'win' : won.them >= 3 ? 'loss' : '';
    const score = el('span', `saved-score ${result}`.trim(), `${won.us}:${won.them}`);
    score.title = setList(entry.sets);
    row.appendChild(score);
    li.appendChild(row);
    return li;
}

function formatDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const options = { day: 'numeric', month: 'short' };
    if (y !== new Date().getFullYear()) options.year = 'numeric';
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', options);
}

function setList(sets) {
    return sets.map(([us, them]) => `${us}:${them}`).join(' · ');
}

function field(form, id, label, input) {
    const labelEl = el('label', null, label);
    labelEl.htmlFor = id;
    input.id = id;
    form.append(labelEl, input);
    return input;
}

function textInput(value, placeholder) {
    const input = el('input');
    input.type = 'text';
    input.value = value;
    input.placeholder = placeholder;
    return input;
}

function openMatchModal(entry) {
    openModal(`vs ${entry.opponent || 'Opponent'}`, (modal, close) => {
        modal.appendChild(el('p', 'modal-text muted', `${formatDate(entry.date)} · ${setList(entry.sets) || 'No points'}`));

        const form = el('div', 'team-names saved-match-form');
        const team = field(form, 'saved-team', 'Our team', textInput(entry.team, 'Us'));
        const opponent = field(form, 'saved-opponent', 'Opponent', textInput(entry.opponent, 'Opponent'));
        const date = el('input');
        date.type = 'date';
        date.value = entry.date;
        field(form, 'saved-date', 'Date', date);
        modal.appendChild(form);

        const changes = () => ({ teamName: team.value.trim(), opponentName: opponent.value.trim(), date: date.value || entry.date });
        const unchanged = () => {
            const c = changes();
            return c.teamName === entry.team && c.opponentName === entry.opponent && c.date === entry.date;
        };
        const saveChanges = async () => {
            if (!unchanged()) await updateRecord(entry.id, changes());
        };

        const buttons = el('div', 'modal-buttons');
        buttons.appendChild(button('Delete', 'btn btn-danger modal-start', () => {
            if (!confirm('Delete this match? This cannot be undone.')) return;
            deleteRecord(entry.id);
            close();
            notifyChange();
        }));
        buttons.appendChild(button('Done', 'btn btn-secondary', () => run(async () => {
            await saveChanges();
            close();
            notifyChange();
        })));
        buttons.appendChild(button('Open', 'btn btn-primary', () => run(async () => {
            await saveChanges();
            await openMatch(entry.id);
            close();
            notifyChange();
            showToast(`Opened the match vs ${changes().opponentName || 'Opponent'}`);
        })));
        modal.appendChild(buttons);
        modal.appendChild(el('p', 'modal-text muted', 'Open brings the match back with its players, so you can look at its statistics or keep recording. The match you have open now is kept here.'));
    });
}

function openRenameModal(team, count) {
    openModal('Rename team', (modal, close) => {
        const form = el('div', 'team-names');
        const input = field(form, 'rename-team', 'Team name', textInput(team, 'Us'));
        modal.appendChild(form);
        modal.appendChild(el('p', 'modal-text muted', count === 1
            ? 'Renames the team in its match.'
            : `Renames the team in ${count === 2 ? 'both' : `all ${count}`} matches. To change just one match, tap it in the list instead.`));
        const buttons = el('div', 'modal-buttons');
        buttons.appendChild(button('Cancel', 'btn btn-secondary', close));
        buttons.appendChild(button('Rename', 'btn btn-primary', () => run(async () => {
            const name = input.value.trim();
            if (name !== team) await renameTeam(team, name);
            close();
            notifyChange();
        })));
        modal.appendChild(buttons);
        input.focus();
        input.select();
    });
}
