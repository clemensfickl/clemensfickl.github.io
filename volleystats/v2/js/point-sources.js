// Where the points came from: won through our winners or opponent errors, lost through our errors or opponent
// winners, each split by action. Points added in Adjust have no known source.
import { replaySet, getTeamNames } from './match.js';
import { actionLabel } from './rally-view.js';
import { el } from './dom.js';

function sourceOf(entry) {
    const e = entry.event;
    if (e.type === 'player') return { group: entry.winner === 'us' ? 'own' : 'ownErrors', label: actionLabel(e.action, e.outcome) };
    if (e.type === 'oppError') return { group: 'oppErrors', label: actionLabel(e.action, 'negative') };
    if (e.type === 'oppPoint') return { group: 'opp', label: actionLabel(e.action, 'positive') };
    return { group: entry.winner === 'us' ? 'adjustedWon' : 'adjustedLost', label: null };
}

function tally(sets) {
    const groups = {};
    sets.forEach(set => replaySet(set).log.forEach(entry => {
        const { group, label } = sourceOf(entry);
        groups[group] ??= { total: 0, labels: {} };
        groups[group].total++;
        if (label) groups[group].labels[label] = (groups[group].labels[label] || 0) + 1;
    }));
    return groups;
}

// Returns null while no point was played in `sets`.
export function buildPointSources(sets) {
    const groups = tally(sets);
    const names = getTeamNames();
    const sides = [
        { title: 'Points won', side: 'us', parts: [['own', `${names.team} winners`], ['oppErrors', `${names.opponent} errors`], ['adjustedWon', 'Added in Adjust']] },
        { title: 'Points lost', side: 'them', parts: [['ownErrors', `${names.team} errors`], ['opp', `${names.opponent} winners`], ['adjustedLost', 'Added in Adjust']] }
    ];
    const blocks = sides.map(side => renderSide(side, groups)).filter(Boolean);
    if (blocks.length === 0) return null;
    const wrap = el('div', 'point-sources');
    blocks.forEach(block => wrap.appendChild(block));
    return wrap;
}

function renderSide({ title, side, parts }, groups) {
    const total = parts.reduce((sum, [group]) => sum + (groups[group]?.total || 0), 0);
    if (total === 0) return null;
    const block = el('div', `source-side ${side}`);
    const head = el('div', 'source-head');
    head.append(el('span', null, title), el('span', 'source-total', total));
    block.appendChild(head);

    const bar = el('div', 'source-bar');
    parts.forEach(([group], i) => {
        const count = groups[group]?.total || 0;
        if (count) bar.appendChild(barPart(`part-${i}`, count, total));
    });
    block.appendChild(bar);

    parts.forEach(([group, label], i) => {
        const data = groups[group];
        if (!data) return;
        const part = el('div', 'source-part');
        const partHead = el('div', 'source-part-head');
        partHead.append(el('span', `source-swatch part-${i}`), el('span', 'source-label', label),
            el('span', 'source-count', `${data.total} · ${Math.round((data.total / total) * 100)}%`));
        part.appendChild(partHead);
        Object.entries(data.labels).sort((a, b) => b[1] - a[1]).forEach(([action, count]) => {
            const row = el('div', 'source-action');
            row.append(el('span', null, action), el('span', 'source-count', count));
            part.appendChild(row);
        });
        block.appendChild(part);
    });
    return block;
}

function barPart(className, count, total) {
    const part = el('span', `source-bar-part ${className}`);
    part.style.width = `${(count / total) * 100}%`;
    return part;
}
