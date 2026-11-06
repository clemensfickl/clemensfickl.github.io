// How our half of the court is drawn, as seen by the user. 'behind': from behind our baseline, net on top.
// 'left' / 'right': from the sideline, with our team on that half and the net next to it. Facing the net, our
// right-hand side (positions 1 and 2) is the near sideline when we play on the left and the far one on the right.
import { getOurSide } from './match.js';
import { getActionsLayout } from './settings.js';
import { el } from './dom.js';

// Spots (court positions 1-6) in grid order, row by row.
const SPOT_ORDER = {
    behind: [4, 3, 2, 5, 6, 1],
    left: [5, 4, 6, 3, 1, 2],
    right: [2, 1, 3, 6, 4, 5]
};

// The orientation for `set`; `ourSide` overrides the stored side, e.g. while it is being picked.
export function courtOrientation(set, ourSide = getOurSide(set)) {
    return getActionsLayout() === 'side' ? ourSide : 'behind';
}

export function spotOrder(orientation) {
    return SPOT_ORDER[orientation] || SPOT_ORDER.behind;
}

// Wraps `grid` (the court cells in `spotOrder`) together with the net on the right side.
export function courtFrame(orientation, grid) {
    const frame = el('div', `court-frame court-${orientation}`);
    const net = el('div', 'court-net', 'Net');
    if (orientation === 'left') frame.append(grid, net);
    else frame.append(net, grid);
    return frame;
}
