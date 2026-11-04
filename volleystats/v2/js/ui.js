// Screen routing: shows the screen named in the URL hash and re-renders it on every change.
import { initRegistration, renderRegistration } from './registration.js';
import { initTracker, renderTracker, resetSetupPrompts } from './tracker.js';
import { initStats, renderStats } from './stats-view.js';
import { renderScoreboard } from './scoreboard.js';
import { syncLibero } from './libero.js';
import { setWakeLock } from './wake-lock.js';
import { onChange } from './dom.js';
import { closeAllModals } from './modal.js';

const SCREENS = {
    registration: { sections: ['match-setup', 'registration', 'settings', 'version-hint'], render: renderRegistration },
    actions: { sections: ['action-tracking'], render: renderTracker },
    statistics: { sections: ['statistics'], render: renderStats }
};

function currentScreen() {
    const screen = window.location.hash.replace('#/', '');
    return SCREENS[screen] ? screen : 'registration';
}

function render() {
    const screen = currentScreen();
    Object.entries(SCREENS).forEach(([name, cfg]) => {
        cfg.sections.forEach(id => { document.getElementById(id).hidden = name !== screen; });
        document.getElementById(`nav-${name}`).classList.toggle('active', name === screen);
    });
    setWakeLock(screen === 'actions');
    syncLibero();
    renderScoreboard();
    SCREENS[screen].render();
}

export function initUI() {
    initRegistration();
    initTracker();
    initStats();

    Object.keys(SCREENS).forEach(name => {
        document.getElementById(`nav-${name}`).addEventListener('click', () => {
            window.location.hash = `#/${name}`;
        });
    });
    window.addEventListener('hashchange', () => {
        closeAllModals();
        resetSetupPrompts();
        render();
    });
    onChange(render);
    render();
}
