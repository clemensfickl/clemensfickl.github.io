// This file contains the logic for player registration and management. 
// It exports functions to add, remove, and retrieve players, as well as to assign them to positions.

const players = [];

// Function to add a player
export function addPlayer(name, position) {
    const player = { id: uuidv4(), name, position };
    players.push(player);
    savePlayers();
    return player;
}

// Generate a RFC4122 version 4 UUID (browser friendly)
function uuidv4() {
    // Use crypto if available for better randomness
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const buf = new Uint8Array(16);
        crypto.getRandomValues(buf);
        // Per RFC4122 section 4.4
        buf[6] = (buf[6] & 0x0f) | 0x40; // version 4
        buf[8] = (buf[8] & 0x3f) | 0x80; // variant
        const hex = Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
        return `${hex.substr(0,8)}-${hex.substr(8,4)}-${hex.substr(12,4)}-${hex.substr(16,4)}-${hex.substr(20,12)}`;
    }
    // Fallback to Math.random-based implementation (less secure)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Function to remove a player by ID
export function removePlayer(id) {
    const index = players.findIndex(player => player.id === id);
    if (index !== -1) {
        players.splice(index, 1);
        savePlayers();
    }
}

// Function to get all players
export function getPlayers() {
    return players;
}

// Function to assign a player to a position
export function assignPosition(id, position) {
    // If position is null/undefined we interpret as unassigning the player
    const player = players.find(player => player.id === id);
    if (!player) return;

    // Clear this position from any other player (ensure exclusivity)
    if (position) {
        players.forEach(p => {
            if (p.position === position && p.id !== id) {
                p.position = null;
                // If someone else had the libero position, remove their libero flag
                if (position === 'libero') {
                    p.isLibero = false;
                }
            }
        });
        player.position = position;
        // Mark as libero if assigning to libero position
        if (position === 'libero') {
            player.isLibero = true;
        }
    } else {
        // unassign
        player.position = null;
        // Don't remove isLibero flag on unassign - they're still the designated libero
    }
    savePlayers();
}

// Swap a player with the current libero. If there is no libero assigned, assign this player to libero and clear their previous position.
export function swapWithLibero(id) {
    const player = players.find(p => p.id === id);
    if (!player) return;
    const libero = players.find(p => p.position === 'libero');

    if (libero && libero.id !== id) {
        // swap positions
        const playerPos = player.position || null;
        libero.position = playerPos;
        player.position = 'libero';
    } else if (!libero) {
        // no libero: put this player to libero and unassign their old position
        player.position = 'libero';
    }
    savePlayers();
}

// Exchange a player on the field with a bench player (bench player must have position == null)
export function exchangeWithBench(fieldPlayerId, benchPlayerId) {
    const field = players.find(p => p.id === fieldPlayerId);
    const bench = players.find(p => p.id === benchPlayerId);
    if (!field || !bench) return;
    // bench must not have a position
    const benchPos = bench.position;
    if (benchPos) {
        console.warn('Bench player is not on bench:', bench);
        return;
    }
    // move bench to field player's position, and put field player to bench (null)
    bench.position = field.position || null;
    field.position = null;
    savePlayers();
}

// Function to save players to local storage
function savePlayers() {
    localStorage.setItem('players', JSON.stringify(players));
}

// Function to load players from local storage
export function loadPlayers() {
    const storedPlayers = localStorage.getItem('players');
    if (storedPlayers) {
        try {
            const parsed = JSON.parse(storedPlayers);
            if (Array.isArray(parsed)) {
                // replace current in-memory players to avoid duplicates
                // normalize ids to strings (in case older entries used numbers)
                const normalized = parsed.map(p => ({ ...p, id: String(p.id) }));
                players.length = 0;
                players.push(...normalized);
            } else {
                console.warn('Stored players is not an array:', parsed);
            }
        } catch (err) {
            console.error('Failed to parse stored players:', err);
        }
    }
}