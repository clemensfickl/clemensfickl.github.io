// Player roster: registration, role assignment, libero swaps and substitutions.
import { load, save, readV1 } from './storage.js';

export const ROLES = [
    { key: 'setter', label: 'Setter', short: 'S' },
    { key: 'outsideHitter1', label: 'Outside 1', short: 'OH1' },
    { key: 'middleBlocker1', label: 'Middle 1', short: 'MB1' },
    { key: 'oppositeHitter', label: 'Opposite', short: 'OPP' },
    { key: 'outsideHitter2', label: 'Outside 2', short: 'OH2' },
    { key: 'middleBlocker2', label: 'Middle 2', short: 'MB2' },
    { key: 'libero', label: 'Libero', short: 'L' }
];

const players = [];

export function loadPlayers() {
    const stored = load('players', []);
    players.length = 0;
    if (Array.isArray(stored)) players.push(...stored);
}

function savePlayers() {
    save('players', players);
}

export function getPlayers() {
    return players;
}

export function addPlayer(name) {
    const player = { id: uuidv4(), name, role: null, isLibero: false };
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

// v1 stores the role as `position`; role keys are identical in both versions.
export function importV1Players() {
    const roleKeys = ROLES.map(r => r.key);
    v1Players().forEach(p => {
        players.push({
            id: uuidv4(),
            name: p.name,
            role: roleKeys.includes(p.position) ? p.position : null,
            isLibero: !!p.isLibero
        });
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

// The lineup as planned, ignoring a libero who currently covers someone: role key -> player.
export function baseLineup() {
    const lineup = {};
    players.forEach(p => {
        if (p.role) lineup[p.role] = p;
    });
    const libero = players.find(p => p.isLibero);
    if (libero && libero.role && libero.role !== 'libero' && lineup.libero) {
        lineup[libero.role] = lineup.libero;
        lineup.libero = libero;
    }
    return lineup;
}

// Moves a player to a role (null: bench). Whoever held that role takes the player's old place.
export function placePlayer(id, role) {
    setLiberoCoverage(null);
    const player = players.find(p => p.id === id);
    if (!player || player.role === role) return;

    const holder = role ? players.find(p => p.role === role) : null;
    if (holder) holder.role = player.role;
    player.role = role;
    players.forEach(p => {
        p.isLibero = p.role === 'libero';
    });
    savePlayers();
}

// Swaps the given player with whoever currently sits in the libero slot.
export function swapWithLibero(id) {
    const player = players.find(p => p.id === id);
    if (!player) return;
    const inLiberoSlot = players.find(p => p.role === 'libero');

    if (inLiberoSlot && inLiberoSlot.id !== id) {
        inLiberoSlot.role = player.role || null;
        player.role = 'libero';
    } else if (!inLiberoSlot) {
        player.role = 'libero';
    }
    savePlayers();
}

// Brings the libero back to the libero slot, then lets them replace whoever holds `role` (null: libero stays out).
export function setLiberoCoverage(role) {
    const libero = players.find(p => p.isLibero);
    if (!libero || !libero.role) return;

    if (libero.role !== 'libero') {
        const replaced = players.find(p => p.role === 'libero');
        if (!replaced) return;
        replaced.role = libero.role;
        libero.role = 'libero';
    }
    if (role) {
        const covered = players.find(p => p.role === role);
        if (covered) {
            covered.role = 'libero';
            libero.role = role;
        }
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
