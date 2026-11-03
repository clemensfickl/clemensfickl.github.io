import { el } from './dom.js';

export function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => overlay.remove());
}

// `build(modal, close)` fills the modal body. Returns the close function.
export function openModal(title, build) {
    const overlay = el('div', 'modal-overlay');
    const modal = el('div', 'modal');
    modal.appendChild(el('h3', null, title));

    const close = () => overlay.remove();
    build(modal, close);

    overlay.addEventListener('click', e => {
        if (e.target === overlay) close();
    });
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    return close;
}
