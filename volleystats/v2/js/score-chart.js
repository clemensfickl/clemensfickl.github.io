// Lead chart of a set: one bar per point, above the line while we lead and below while the opponent leads.
import { el } from './dom.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const BAR = 4;
const HEIGHT = 60;

function svgEl(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
}

// `log` from `replaySet`.
export function buildScoreChart(log) {
    const leads = log.map(entry => entry.us - entry.them);
    const maxUs = Math.max(0, ...leads);
    const maxThem = Math.max(0, ...leads.map(lead => -lead));
    const scale = Math.max(3, maxUs, maxThem);
    const mid = HEIGHT / 2;

    const svg = svgEl('svg', {
        viewBox: `0 0 ${leads.length * BAR} ${HEIGHT}`,
        preserveAspectRatio: 'none',
        'shape-rendering': 'crispEdges',
        role: 'img',
        'aria-label': `Lead per point, largest lead ${maxUs} for us and ${maxThem} for the opponent`
    });
    leads.forEach((lead, i) => {
        if (lead === 0) return;
        const size = (Math.abs(lead) / scale) * mid;
        const bar = svgEl('rect', {
            class: lead > 0 ? 'lead-us' : 'lead-them',
            x: i * BAR + 0.5,
            y: lead > 0 ? mid - size : mid,
            width: BAR - 1,
            height: size
        });
        const title = svgEl('title', {});
        title.textContent = `${log[i].us}:${log[i].them}`;
        bar.appendChild(title);
        svg.appendChild(bar);
    });
    svg.appendChild(svgEl('line', { class: 'lead-axis', x1: 0, x2: leads.length * BAR, y1: mid, y2: mid }));

    const wrap = el('div', 'score-chart');
    wrap.appendChild(svg);
    const scaleLabels = el('div', 'score-chart-scale');
    scaleLabels.appendChild(el('span', null, `+${scale}`));
    scaleLabels.appendChild(el('span', null, `−${scale}`));
    wrap.appendChild(scaleLabels);
    return wrap;
}
