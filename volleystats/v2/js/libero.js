// Keeps the libero on court for the back-row middle whenever the rotation or serve changes.
import { getCurrentSet } from './actions.js';
import { replaySet, liberoTarget, getAppliedLiberoTarget, setAppliedLiberoTarget } from './match.js';
import { setLiberoCoverage } from './players.js';

export function syncLibero() {
    const set = getCurrentSet();
    const state = replaySet(set);
    if (!state.setterPos) return;

    const target = liberoTarget(state);
    const key = `${set}:${target}`;
    if (key === getAppliedLiberoTarget()) return;
    setLiberoCoverage(target);
    setAppliedLiberoTarget(key);
}
