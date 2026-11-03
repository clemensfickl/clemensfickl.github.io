// Player roster: registration, role assignment, libero swaps and substitutions.
import { load, save, readV1 } from './storage.js';

export const ROLES = [
    { key: 'setter', label: 'Setter', short: 'S' },
    { key: 'outsideHitter1', label: 'Outside 1', short: 'OH1' },
    { key: 'middleBlocker1', label: 'Middle 1', short: 'MB1' },
    { key: 'oppositeHitter', label: 'Opposite', short: 'OPP' },
    { key: 'outsideHitter2', label: 'Outside 2', short: 'OH2' },
    { key: 'middleBlocker2', label: 'Middle 2', short: 'MB2' },
    { key: 'libero1', label: 'Libero 1', short: 'L1' },
    { key: 'libero2', label: 'Libero 2', short: 'L2' }
];

// A libero's own slot. While libero n is on court, the player they replace waits in that slot.
export const liberoSlot = n => `libero${n}`;

const players = [];

export function loadPlayers() {
    const stored = load('players', []);
    players.length = 0;
    if (Array.isArray(stored)) players.push(...stored.map(migrateSingleLibero));
}

// Earlier v2 builds had one libero: role 'libero' and an isLibero flag.
function migrateSingleLibero(p) {
    if (!('isLibero' in p)) return p;
    const { isLibero, ...rest } = p;
    return { ...rest, role: p.role === 'libero' ? liberoSlot(1) : p.role, liberoNo: isLibero ? 1 : null };
}

function savePlayers() {
    save('players', players);
}

export function getPlayers() {
    return players;
}

export function addPlayer(name) {
    const player = { id: uuidv4(), name, role: null, liberoNo: null };
    players.push(player);
    savePlayers();
    return player;
}

function v1Players() {
    const stored = readV1('players');
    return Array.isArray(stored) ? stored.filter(p => p && p.name) : [];
}

export function countImportableV1Players() {
    return v1Players().length;
}

// v1 stores the role as `position` and has a single libero.
export function importV1Players() {
    const roleKeys = ROLES.map(r => r.key);
    v1Players().forEach(p => {
        players.push(migrateSingleLibero({
            id: uuidv4(),
            name: p.name,
            role: p.position === 'libero' || roleKeys.includes(p.position) ? p.position : null,
            isLibero: !!p.isLibero
        }));
    });
    savePlayers();
}

// crypto.randomUUID is only available in secure contexts, so build a v4 UUID by hand.
function uuidv4() {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    const hex = Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function removePlayer(id) {
    const index = players.findIndex(p => p.id === id);
    if (index === -1) return;
    players.splice(index, 1);
    savePlayers();
}

// Assigned liberos, ordered by number.
export function getLiberos() {
    return players.filter(p => p.liberoNo && p.role).sort((a, b) => a.liberoNo - b.liberoNo);
}

export function liberoOnCourt() {
    return players.find(p => p.liberoNo && p.role && p.role !== liberoSlot(p.liberoNo)) || null;
}

function bringBack(libero) {
    const covered = players.find(p => p.role === liberoSlot(libero.liberoNo));
    if (covered) covered.role = libero.role;
    libero.role = liberoSlot(libero.liberoNo);
}

function cover(libero, role) {
    const covered = players.find(p => p.role === role);
    if (!covered) return;
    covered.role = liberoSlot(libero.liberoNo);
    libero.role = role;
    save('lastLibero', libero.liberoNo);
}

// The lineup as planned, ignoring a libero who currently covers someone: role key -> player.
export function baseLineup() {
    const lineup = {};
    players.forEach(p => {
        if (p.role) lineup[p.role] = p;
    });
    const libero = liberoOnCourt();
    if (libero) {
        const slot = liberoSlot(libero.liberoNo);
        if (lineup[slot]) lineup[libero.role] = lineup[slot];
        lineup[slot] = libero;
    }
    return lineup;
}

// Moves a player to a role (null: bench). Whoever held that role takes the player's old place.
export function placePlayer(id, role) {
    const active = liberoOnCourt();
    if (active) bringBack(active);
    const player = players.find(p => p.id === id);
    if (player && player.role !== role) {
        const holder = role ? players.find(p => p.role === role) : null;
        if (holder) holder.role = player.role;
        player.role = role;
    }
    players.forEach(p => {
        p.liberoNo = p.role === liberoSlot(1) ? 1 : p.role === liberoSlot(2) ? 2 : null;
    });
    savePlayers();
}

// Tapping libero n on a player: brings libero n in, takes libero n back out, or exchanges the two liberos.
export function swapWithLibero(playerId, n) {
    const player = players.find(p => p.id === playerId);
    const libero = getLiberos().find(p => p.liberoNo === n);
    if (!player || !libero) return;

    if (player === libero) {
        bringBack(libero);
    } else if (player.liberoNo) {
        const role = player.role;
        bringBack(player);
        cover(libero, role);
    } else if (libero.role === liberoSlot(n)) {
        cover(libero, player.role);
    }
    savePlayers();
}

// Takes the libero on court back out, then lets the libero used last replace whoever holds `role`.
export function setLiberoCoverage(role) {
    const active = liberoOnCourt();
    if (active) bringBack(active);
    if (role) {
        const liberos = getLiberos();
        const libero = liberos.find(p => p.liberoNo === load('lastLibero', 1)) || liberos[0];
        if (libero) cover(libero, role);
    }
    savePlayers();
}

export function exchangeWithBench(fieldPlayerId, benchPlayerId) {
    const field = players.find(p => p.id === fieldPlayerId);
    const bench = players.find(p => p.id === benchPlayerId);
    if (!field || !bench || bench.role) return;
    bench.role = field.role || null;
    field.role = null;
    savePlayers();
}
