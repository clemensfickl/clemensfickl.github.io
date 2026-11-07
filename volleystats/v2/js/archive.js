// Saved matches. Each one is stored under its own key, gzip-compressed where the browser supports it, so many
// matches fit into localStorage; a small index with names, date and set scores keeps the list cheap to show.
// The open match is not in the archive: opening a saved match takes it out, and saving puts it back.
import { load, save, remove } from './storage.js';
import { getEvents, getCurrentSet, getStartedAt, replaceEvents, resetEvents, pointWinner } from './actions.js';
import { getPlayers, replacePlayers } from './players.js';
import { getMatchConfig, replaceMatchConfig, getMatchId, startNewMatch, setTeamNames, getRawTeamNames, isSetOver } from './match.js';
import { clearHistory } from './history.js';

let index = [];

export function loadArchive() {
    index = load('archive', []);
}

// Index entries: { id, date: 'YYYY-MM-DD', team, opponent, sets: [[us, them], ...] }.
export function getArchive() {
    return index;
}

export function setScores(events) {
    const scores = {};
    events.forEach(e => {
        const winner = pointWinner(e);
        if (!winner) return;
        const s = scores[e.set] || (scores[e.set] = { us: 0, them: 0 });
        s[winner]++;
    });
    return Object.keys(scores).map(Number).sort((a, b) => a - b).map(set => [scores[set].us, scores[set].them]);
}

// Sets won per team, from `setScores`.
export function setsWon(sets) {
    const won = { us: 0, them: 0 };
    sets.forEach(([us, them], i) => {
        if (isSetOver({ us, them }, i + 1)) won[us > them ? 'us' : 'them']++;
    });
    return won;
}

export function localDate(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// The open match as a record: everything needed to bring it back, including its roster.
export function currentRecord() {
    const id = getMatchId();
    const { date, ...match } = getMatchConfig();
    delete match.id;
    return {
        id,
        date: date || localDate(getStartedAt() || Date.now()),
        startedAt: getStartedAt(),
        match,
        events: getEvents(),
        currentSet: getCurrentSet(),
        players: getPlayers()
    };
}

export function currentSummary() {
    return summary(currentRecord());
}

export function hasCurrentMatch() {
    return getEvents().length > 0;
}

function summary(record) {
    return {
        id: record.id,
        date: record.date,
        team: record.match.teamName || '',
        opponent: record.match.opponentName || '',
        sets: setScores(record.events)
    };
}

async function pack(value) {
    const json = JSON.stringify(value);
    if (typeof CompressionStream === 'undefined') return json;
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `gz:${btoa(binary)}`;
}

async function unpack(raw) {
    if (!raw.startsWith('gz:')) return JSON.parse(raw);
    const bytes = Uint8Array.from(atob(raw.slice(3)), c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
}

// Throws when localStorage is full; nothing is changed then.
export async function putRecord(record) {
    save(`match:${record.id}`, await pack(record));
    const entry = summary(record);
    const at = index.findIndex(e => e.id === record.id);
    if (at === -1) index.push(entry);
    else index[at] = entry;
    save('archive', index);
}

export async function readRecord(id) {
    const raw = load(`match:${id}`, null);
    return raw === null ? null : unpack(raw);
}

export function deleteRecord(id) {
    remove(`match:${id}`);
    index = index.filter(e => e.id !== id);
    save('archive', index);
}

async function saveCurrent() {
    if (hasCurrentMatch()) await putRecord(currentRecord());
}

// Saves the open match (if anything was recorded) and starts an empty one with the same roster and team name.
export async function newMatch() {
    await saveCurrent();
    resetEvents();
    clearHistory();
    startNewMatch();
}

// Saves the open match and opens the saved one instead, with the roster it had.
export async function openMatch(id) {
    const record = await readRecord(id);
    if (!record) return;
    await saveCurrent();
    replaceEvents(record.events, record.currentSet || 1, record.startedAt || null);
    replacePlayers(record.players);
    replaceMatchConfig({ ...record.match, id: record.id, date: record.date });
    clearHistory();
    deleteRecord(id);
}

// Changes any of teamName, opponentName and date.
export async function updateRecord(id, { date, ...names }) {
    const record = await readRecord(id);
    if (!record) return;
    if (date) record.date = date;
    record.match = { ...record.match, ...names };
    await putRecord(record);
}

// Renames our team in every saved match with that name, and in the open match.
export async function renameTeam(from, to) {
    for (const entry of index.filter(e => e.team === from)) await updateRecord(entry.id, { teamName: to });
    const current = getRawTeamNames();
    if ((current.team || '') === from) setTeamNames(to, current.opponent);
}
