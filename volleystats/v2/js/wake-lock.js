// Keeps the screen on while tracking. Browsers drop the lock when the page is hidden, so it is re-requested on return.
let sentinel = null;
let pending = false;
let wanted = false;

async function acquire() {
    if (!('wakeLock' in navigator) || sentinel || pending) return;
    pending = true;
    try {
        sentinel = await navigator.wakeLock.request('screen');
        sentinel.addEventListener('release', () => { sentinel = null; });
        if (!wanted) release();
    } catch (err) {
        console.warn('Screen wake lock unavailable:', err);
    } finally {
        pending = false;
    }
}

function release() {
    if (!sentinel) return;
    sentinel.release();
    sentinel = null;
}

export function setWakeLock(on) {
    wanted = on;
    if (on) acquire();
    else release();
}

document.addEventListener('visibilitychange', () => {
    if (wanted && document.visibilityState === 'visible') acquire();
});
