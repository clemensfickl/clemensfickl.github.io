// Pointer-based dragging; HTML5 drag and drop doesn't work with touch.
const DRAG_THRESHOLD = 6;

// Drop targets are the elements matching `targetSelector` inside `scope` for which `accepts(target)` is true.
// A press on a button inside `node` is left to the button. The click that ends a drag is swallowed.
export function makeDraggable(node, { scope, targetSelector, accepts = () => true, onDrop, ghost }) {
    let dragged = false;

    node.addEventListener('click', e => {
        if (!dragged) return;
        dragged = false;
        e.stopImmediatePropagation();
    }, true);
    node.addEventListener('dragstart', e => e.preventDefault());
    node.addEventListener('pointerdown', down => {
        if (down.button !== 0 || down.target.closest('button')) return;
        dragged = false;
        let ghostNode = null;
        let target = null;
        let allowed = [];
        node.setPointerCapture(down.pointerId);

        const isDrag = e => Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) >= DRAG_THRESHOLD;
        const targetAt = e => {
            const under = document.elementFromPoint(e.clientX, e.clientY);
            const hit = under && scope.contains(under) ? under.closest(targetSelector) : null;
            return hit && allowed.includes(hit) ? hit : null;
        };
        const start = () => {
            dragged = true;
            allowed = [...scope.querySelectorAll(targetSelector)].filter(t => t !== node && accepts(t));
            allowed.forEach(t => t.classList.add('drop-allowed'));
            ghostNode = ghost ? ghost() : node.cloneNode(true);
            ghostNode.classList.add('drag-ghost');
            document.body.appendChild(ghostNode);
            node.classList.add('dragging');
        };
        const move = e => {
            if (!ghostNode) {
                if (!isDrag(e)) return;
                start();
            }
            ghostNode.style.left = `${e.clientX}px`;
            ghostNode.style.top = `${e.clientY}px`;
            const next = targetAt(e);
            if (next !== target) {
                if (target) target.classList.remove('drop-target');
                if (next) next.classList.add('drop-target');
                target = next;
            }
        };
        const end = e => {
            node.removeEventListener('pointermove', move);
            node.removeEventListener('pointerup', end);
            node.removeEventListener('pointercancel', end);
            if (e.type === 'pointerup' && isDrag(e) && !ghostNode) start();
            if (!ghostNode) return;
            ghostNode.remove();
            node.classList.remove('dragging');
            allowed.forEach(t => t.classList.remove('drop-allowed', 'drop-target'));
            const drop = e.type === 'pointerup' ? targetAt(e) : null;
            if (drop) onDrop(drop);
        };
        node.addEventListener('pointermove', move);
        node.addEventListener('pointerup', end);
        node.addEventListener('pointercancel', end);
    });
}
