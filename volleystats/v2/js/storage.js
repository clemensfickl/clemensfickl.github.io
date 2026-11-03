// v1 runs on the same origin and uses unprefixed keys, so every v2 key must carry this prefix.
const PREFIX = 'vs2:';

export function load(key, fallback) {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    try {
        return JSON.parse(raw);
    } catch (err) {
        console.error(`Failed to parse stored ${key}:`, err);
        return fallback;
    }
}

export function save(key, value) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function remove(key) {
    localStorage.removeItem(PREFIX + key);
}

// Read-only access to v1 data, which must never be modified from v2.
export function readV1(key) {
    try {
        return JSON.parse(localStorage.getItem(key));
    } catch {
        return null;
    }
}
