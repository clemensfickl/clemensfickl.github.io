// A short message at the bottom of the screen that fades out by itself.
import { el } from './dom.js';

const DURATION_MS = 1800;
let timer = null;

export function showToast(text) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = el('div', 'toast');
        toast.id = 'toast';
        toast.setAttribute('role', 'status');
        document.body.appendChild(toast);
    }
    toast.textContent = text;
    // Forces a reflow so a toast that is already showing pops in again.
    toast.classList.remove('visible');
    void toast.offsetWidth;
    toast.classList.add('visible');
    clearTimeout(timer);
    timer = setTimeout(() => toast.classList.remove('visible'), DURATION_MS);
}
