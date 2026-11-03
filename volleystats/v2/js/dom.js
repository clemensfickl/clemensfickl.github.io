// Small DOM helpers and a change notification that triggers a re-render of the visible screen.

export function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
}

export function button(text, className, onClick) {
    const btn = el('button', className, text);
    btn.type = 'button';
    btn.addEventListener('click', onClick);
    return btn;
}

const CHANGE_EVENT = 'vs2:change';

export function notifyChange() {
    document.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function onChange(handler) {
    document.addEventListener(CHANGE_EVENT, handler);
}
