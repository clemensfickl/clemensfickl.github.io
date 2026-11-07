// Configuration screen: New match and the saved matches, grouped by our team name, with export and import.
import { getArchive, currentSummary, hasCurrentMatch, setsWon, newMatch, openMatch, deleteRecord, updateRecord, renameTeam,
    exportFile, parseMatchesFile, importConflicts, importRecords } from './archive.js';
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

    const fileInput = document.getElementById('import-file');
    document.getElementById('import-matches').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => run(async () => {
        const files = [...fileInput.files];
        fileInput.value = '';
        const records = [];
        for (const file of files) records.push(...parseMatchesFile(await file.text()));
        await importMatches(records);
    }));
    document.getElementById('export-matches').addEventListener('click', openExportModal);
}

// Storage errors (usually a full localStorage) leave the open match untouched.
async function run(action) {
    try {
        await action();
    } catch (err) {
        console.error(err);
        alert(err?.name === 'QuotaExceededError'
            ? 'Not enough storage left on this device. Delete some saved matches first.'
            : err?.message || String(err));
    }
}

async function importMatches(records) {
    const conflicts = importConflicts(records);
    const replace = conflicts.saved > 0 && confirm(conflicts.saved === 1
        ? 'One of these matches is already saved here. Replace it with the imported version?'
        : `${conflicts.saved} of these matches are already saved here. Replace them with the imported versions?`);
    const count = await importRecords(records, replace);
    notifyChange();
    const skippedOpen = conflicts.open ? ' The match you have open was not replaced.' : '';
    showToast(`Imported ${count} ${count === 1 ? 'match' : 'matches'}.${skippedOpen}`);
}

// Saved matches plus the open one, grouped by our team name: the open match's team first.
function groupedEntries() {
    const entries = getArchive().map(entry => ({ ...entry, open: false }));
    if (hasCurrentMatch()) entries.push({ ...currentSummary(), open: true });
    const groups = new Map();
    entries.forEach(entry => {
        if (!groups.has(entry.team)) groups.set(entry.team, []);
        groups.get(entry.team).push(entry);
    });
    groups.forEach(list => list.sort((a, b) => (a.open !== b.open ? (a.open ? -1 : 1) : b.date.localeCompare(a.date))));
    const ourTeam = getRawTeamNames().team || '';
    return [...groups.entries()].sort(([a], [b]) => (a === ourTeam ? -1 : b === ourTeam ? 1 : a.localeCompare(b)));
}

export function renderArchive() {
    const container = document.getElementById('saved-match-list');
    container.innerHTML = '';
    const groups = groupedEntries();
    document.getElementById('export-matches').disabled = groups.length === 0;
    if (groups.length === 0) {
        container.appendChild(el('p', 'setting-hint', 'Matches are kept here when you start a new match or open another one.'));
        return;
    }
    groups.forEach(([team, entries]) => container.appendChild(renderGroup(team, entries)));
}

function renderGroup(team, entries) {
    const group = el('div', 'saved-team');
    const header = el('div', 'saved-team-header');
    header.appendChild(el('h3', null, team || 'Unnamed team'));
    header.appendChild(button('Rename', 'btn btn-link', () => openRenameModal(team, entries.length)));
    group.appendChild(header);

    const list = el('ul', 'saved-match-list');
    entries.forEach(entry => list.appendChild(renderEntry(entry)));
    group.appendChild(list);
    return group;
}

function canShareFiles() {
    return !!navigator.canShare?.({ files: [new File(['{}'], 'test.json', { type: 'application/json' })] });
}

function download(file) {
    const url = URL.createObjectURL(file);
    const a = el('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function share(file) {
    try {
        await navigator.share({ files: [file], title: file.name });
    } catch (err) {
        if (err.name !== 'AbortError') throw err;
    }
}

function openExportModal() {
    openModal('Export matches', (modal, close) => {
        modal.appendChild(el('p', 'modal-text muted', 'The file includes the players of each match, so it can be imported on another device.'));
        const boxes = [];
        const list = el('div', 'export-list');
        groupedEntries().forEach(([team, entries]) => {
            list.appendChild(el('div', 'export-team', team || 'Unnamed team'));
            entries.forEach(entry => {
                const label = el('label', 'export-match');
                const box = el('input');
                box.type = 'checkbox';
                box.checked = true;
                box.value = entry.id;
                box.addEventListener('change', update);
                boxes.push(box);
                label.appendChild(box);
                label.appendChild(el('span', 'saved-date', formatDate(entry.date)));
                label.appendChild(el('span', 'saved-opponent', `vs ${entry.opponent || 'Opponent'}`));
                if (entry.open) label.appendChild(el('span', 'saved-open', 'Open'));
                list.appendChild(label);
            });
        });
        const toggle = button('', 'btn btn-link export-toggle', () => {
            const check = !boxes.every(b => b.checked);
            boxes.forEach(b => { b.checked = check; });
            update();
        });
        modal.append(toggle, list);

        const selected = () => boxes.filter(b => b.checked).map(b => b.value);
        const buttons = el('div', 'modal-buttons');
        buttons.appendChild(button('Cancel', 'btn btn-secondary modal-start', close));
        const actions = [];
        if (canShareFiles()) {
            actions.push(button('Share', 'btn btn-secondary', () => run(async () => {
                await share(await exportFile(selected()));
                close();
            })));
        }
        actions.push(button('Download', 'btn btn-primary', () => run(async () => {
            download(await exportFile(selected()));
            close();
        })));
        buttons.append(...actions);
        modal.appendChild(buttons);

        function update() {
            toggle.textContent = boxes.every(b => b.checked) ? 'Select none' : 'Select all';
            actions.forEach(b => { b.disabled = selected().length === 0; });
        }
        update();
    });
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
