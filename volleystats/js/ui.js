// UI module: handles registration form, player list rendering and basic UI helpers.
import { addPlayer, removePlayer, getPlayers, assignPosition, swapWithLibero, exchangeWithBench } from './players.js';
import { actions as ACTIONS_MAP, recordPlayerAction, recordOpponentError, getPlayerStatistics, getOpponentErrors, getCurrentSet, setCurrentSet, undoLastAction, resetAllStatistics } from './actions.js';
import { exportCSV } from './export-csv.js';

let selectedAction = null;

const playerListEl = () => document.getElementById('player-list');
const playerFormEl = () => document.getElementById('player-form');
const playerNameInputEl = () => document.getElementById('player-name');
const actionButtonsContainer = () => document.getElementById('action-buttons');
const statsDisplay = () => document.getElementById('stats-display');

function renderPlayers(players) {
    const playerList = playerListEl();
    playerList.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        li.className = 'player-item';

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'x';
        deleteBtn.className = 'btn btn-danger delete-player';
        deleteBtn.dataset.id = player.id;
        deleteBtn.addEventListener('click', () => {
            removePlayer(deleteBtn.dataset.id);
            renderPlayers(getPlayers());
            renderPositions();
        });
        li.appendChild(deleteBtn);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'player-name';
        nameSpan.textContent = player.name;
        li.appendChild(nameSpan);

        playerList.appendChild(li);
    });
}

function renderActions(actions) {
    const container = actionButtonsContainer();
    if (!container) return;
    container.innerHTML = '';
    actions.forEach(action => {
        const button = document.createElement('button');
        button.textContent = action.name;
        button.addEventListener('click', () => action.handler());
        container.appendChild(button);
    });
}

function updateStatsDisplay(playerStats) {
    const disp = statsDisplay();
    if (!disp) return;
    disp.innerHTML = '';

    const players = getPlayers();
    const actionKeys = Object.keys(ACTIONS_MAP);
    const actionNames = Object.values(ACTIONS_MAP);

    const table = document.createElement('table');
    table.className = 'stats-table';

    // Create table header
    const thead = document.createElement('thead');
    const headerRow1 = document.createElement('tr');
    const headerRow2 = document.createElement('tr');

    const playerHeader = document.createElement('th');
    playerHeader.rowSpan = 2;
    playerHeader.className = 'player-name-col';
    playerHeader.textContent = 'Player';
    headerRow1.appendChild(playerHeader);

    const pointsHeader = document.createElement('th');
    pointsHeader.rowSpan = 2;
    pointsHeader.textContent = '+';
    headerRow1.appendChild(pointsHeader);

    const mistakesHeader = document.createElement('th');
    mistakesHeader.rowSpan = 2;
    mistakesHeader.textContent = '-';
    headerRow1.appendChild(mistakesHeader);

    actionNames.forEach(name => {
        const th = document.createElement('th');
        th.colSpan = 3;
        th.className = 'action-header';
        th.textContent = name;
        headerRow1.appendChild(th);

        ['+', '~', '-'].forEach(symbol => {
            const subTh = document.createElement('th');
            subTh.textContent = symbol;
            headerRow2.appendChild(subTh);
        });
    });

    thead.appendChild(headerRow1);
    thead.appendChild(headerRow2);
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement('tbody');
    players.forEach(p => {
        const pStats = playerStats[p.id] || { sets: {} };
        
        // Calculate totals across all sets
        let totalsByAction = {};
        let grandTotalPoints = 0;
        let grandTotalMistakes = 0;
        
        actionKeys.forEach(key => {
            const actionName = ACTIONS_MAP[key];
            totalsByAction[actionName] = { positive: 0, neutral: 0, negative: 0 };
        });

        // Sum up all sets
        if (pStats.sets) {
            Object.values(pStats.sets).forEach(setStats => {
                actionKeys.forEach(key => {
                    const actionName = ACTIONS_MAP[key];
                    if (setStats[actionName]) {
                        totalsByAction[actionName].positive += setStats[actionName].positive;
                        totalsByAction[actionName].neutral += setStats[actionName].neutral;
                        totalsByAction[actionName].negative += setStats[actionName].negative;
                    }
                });
            });
        }

        // Calculate grand totals for points and mistakes
        actionKeys.forEach(key => {
            const actionName = ACTIONS_MAP[key];
            if (actionName === 'Serve' || actionName === 'Atk' || actionName === 'Blk') {
                grandTotalPoints += totalsByAction[actionName].positive;
            }
            grandTotalMistakes += totalsByAction[actionName].negative;
        });

        // Only show player if they have any stats
        const hasStats = grandTotalPoints > 0 || grandTotalMistakes > 0 || 
            Object.values(totalsByAction).some(stats => stats.neutral > 0);

        if (hasStats) {
            // Add total row for this player
            const totalRow = document.createElement('tr');
            totalRow.style.fontWeight = 'bold';
            
            const nameCell = document.createElement('td');
            nameCell.className = 'player-name-col';
            nameCell.textContent = p.name;
            totalRow.appendChild(nameCell);

            const pointsCell = document.createElement('td');
            pointsCell.textContent = grandTotalPoints || '';
            totalRow.appendChild(pointsCell);

            const mistakesCell = document.createElement('td');
            mistakesCell.textContent = grandTotalMistakes || '';
            totalRow.appendChild(mistakesCell);

            actionKeys.forEach(key => {
                const actionName = ACTIONS_MAP[key];
                const counts = totalsByAction[actionName];
                
                const posCell = document.createElement('td');
                posCell.textContent = counts.positive || '';
                totalRow.appendChild(posCell);

                const neutCell = document.createElement('td');
                neutCell.textContent = counts.neutral || '';
                totalRow.appendChild(neutCell);

                const negCell = document.createElement('td');
                negCell.textContent = counts.negative || '';
                totalRow.appendChild(negCell);
            });

            tbody.appendChild(totalRow);

            // Add individual set rows
            if (pStats.sets) {
                Object.keys(pStats.sets).sort((a, b) => parseInt(a) - parseInt(b)).forEach(setNum => {
                    const setStats = pStats.sets[setNum];
                    
                    let setPoints = 0;
                    let setMistakes = 0;
                    let setHasStats = false;

                    actionKeys.forEach(key => {
                        const actionName = ACTIONS_MAP[key];
                        const counts = setStats[actionName] || { positive: 0, neutral: 0, negative: 0 };
                        
                        if (counts.positive > 0 || counts.neutral > 0 || counts.negative > 0) {
                            setHasStats = true;
                        }
                        
                        if (actionName === 'Serve' || actionName === 'Atk' || actionName === 'Blk') {
                            setPoints += counts.positive;
                        }
                        setMistakes += counts.negative;
                    });

                    if (setHasStats) {
                        const setRow = document.createElement('tr');
                        
                        const setNameCell = document.createElement('td');
                        setNameCell.className = 'player-name-col';
                        setNameCell.textContent = `  Set ${setNum}`;
                        setNameCell.style.paddingLeft = '2rem';
                        setRow.appendChild(setNameCell);

                        const setPointsCell = document.createElement('td');
                        setPointsCell.textContent = setPoints || '';
                        setRow.appendChild(setPointsCell);

                        const setMistakesCell = document.createElement('td');
                        setMistakesCell.textContent = setMistakes || '';
                        setRow.appendChild(setMistakesCell);

                        actionKeys.forEach(key => {
                            const actionName = ACTIONS_MAP[key];
                            const counts = setStats[actionName] || { positive: 0, neutral: 0, negative: 0 };
                            
                            const posCell = document.createElement('td');
                            posCell.textContent = counts.positive || '';
                            setRow.appendChild(posCell);

                            const neutCell = document.createElement('td');
                            neutCell.textContent = counts.neutral || '';
                            setRow.appendChild(neutCell);

                            const negCell = document.createElement('td');
                            negCell.textContent = counts.negative || '';
                            setRow.appendChild(negCell);
                        });

                        tbody.appendChild(setRow);
                    }
                });
            }
        }
    });

    table.appendChild(tbody);
    disp.appendChild(table);
}

function initUI() {
    // Initial render (players should already be loaded by app.js)
    renderPlayers(getPlayers());
    renderPositions();

    // Wire top navigation
    const navReg = document.getElementById('nav-registration');
    const navActions = document.getElementById('nav-actions');
    const navStats = document.getElementById('nav-statistics');

    if (navReg) navReg.addEventListener('click', () => { showScreen('registration'); });
    if (navActions) navActions.addEventListener('click', () => { showScreen('actions'); });
    if (navStats) navStats.addEventListener('click', () => { showScreen('statistics'); });

    // Handle hash changes to show the correct screen
    window.addEventListener('hashchange', handleHashChange);
    // Handle initial load
    handleHashChange();

    // Attach form handler
    const form = playerFormEl();
    const input = playerNameInputEl();
    if (form && input) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = input.value.trim();
            if (!name) return;
            addPlayer(name);
            input.value = '';
                renderPlayers(getPlayers());
                renderPositions();
            input.focus();
        });
    }
}

// Positions UI
const POSITION_LIST = [
    { key: 'setter', label: 'Setter' },
    { key: 'outsideHitter1', label: 'Outside 1' },
    { key: 'middleBlocker1', label: 'Middle 1' },
    { key: 'oppositeHitter', label: 'Opposite' },
    { key: 'outsideHitter2', label: 'Outside 2' },
    { key: 'middleBlocker2', label: 'Middle 2' },
    { key: 'libero', label: 'Libero' }
];

function renderPositions() {
    const container = document.getElementById('positions');
    if (!container) return;
    const players = getPlayers();
    container.innerHTML = '';

    POSITION_LIST.forEach(pos => {
        const wrap = document.createElement('div');
        wrap.className = 'position-item';

        const label = document.createElement('label');
        label.textContent = pos.label + ':';
        label.htmlFor = `pos-${pos.key}`;
        wrap.appendChild(label);

        const select = document.createElement('select');
        select.id = `pos-${pos.key}`;
        select.dataset.position = pos.key;

        const noneOpt = document.createElement('option');
        noneOpt.value = '';
        noneOpt.textContent = '-- None --';
        select.appendChild(noneOpt);

        players.forEach(p => {
            const opt = document.createElement('option');
            opt.value = String(p.id);
            opt.textContent = p.name;
            if (p.position === pos.key) opt.selected = true;
            select.appendChild(opt);
        });

        select.addEventListener('change', () => {
            const selected = select.value;
            if (selected === '') {
                // unassign current occupant (if any)
                const current = players.find(p => p.position === pos.key);
                if (current) assignPosition(current.id, null);
            } else {
                assignPosition(selected, pos.key);
            }
            // re-render both lists to reflect changes
            renderPlayers(getPlayers());
            renderPositions();
        });

        wrap.appendChild(select);
        container.appendChild(wrap);
    });
}

function handleHashChange() {
    const screen = window.location.hash.replace('#/', '') || 'registration';
    
    const regSection = document.getElementById('registration');
    const posSection = document.getElementById('position-assignment');
    const actionSection = document.getElementById('action-tracking');
    const statsSection = document.getElementById('statistics');
    
    // hide all
    [regSection, posSection, actionSection, statsSection].forEach(el => { if (el) el.style.display = 'none'; });

    const navReg = document.getElementById('nav-registration');
    const navActions = document.getElementById('nav-actions');
    const navStats = document.getElementById('nav-statistics');
    
    function setActive(button) {
        [navReg, navActions, navStats].forEach(b => {
            if (!b) return;
            b.classList.toggle('active', b === button);
        });
    }

    if (screen === 'registration') {
        if (regSection) regSection.style.display = '';
        if (posSection) posSection.style.display = '';
        setActive(navReg);
    } else if (screen === 'actions') {
        if (actionSection) actionSection.style.display = '';
        renderActionTracker();
        setActive(navActions);
    } else if (screen === 'statistics') {
        if (statsSection) statsSection.style.display = '';
        updateStatsDisplay(getPlayerStatistics() || {});
        const exportBtn = document.getElementById('export-csv');
        if (exportBtn) {
            exportBtn.onclick = () => {
                const players = getPlayers();
                const playerStats = getPlayerStatistics() || {};
                const actionKeys = Object.keys(ACTIONS_MAP);
                const actionNames = Object.values(ACTIONS_MAP);

                const rows = [];

                players.forEach(p => {
                    const pStats = playerStats[p.id] || { sets: {} };
                    
                    // Calculate totals across all sets
                    let totalsByAction = {};
                    let grandTotalPoints = 0;
                    let grandTotalMistakes = 0;
                    
                    actionKeys.forEach(key => {
                        const actionName = ACTIONS_MAP[key];
                        totalsByAction[actionName] = { positive: 0, neutral: 0, negative: 0 };
                    });

                    // Sum up all sets
                    if (pStats.sets) {
                        Object.values(pStats.sets).forEach(setStats => {
                            actionKeys.forEach(key => {
                                const actionName = ACTIONS_MAP[key];
                                if (setStats[actionName]) {
                                    totalsByAction[actionName].positive += setStats[actionName].positive;
                                    totalsByAction[actionName].neutral += setStats[actionName].neutral;
                                    totalsByAction[actionName].negative += setStats[actionName].negative;
                                }
                            });
                        });
                    }

                    // Calculate grand totals
                    actionKeys.forEach(key => {
                        const actionName = ACTIONS_MAP[key];
                        if (actionName === 'Serve' || actionName === 'Atk' || actionName === 'Blk') {
                            grandTotalPoints += totalsByAction[actionName].positive;
                        }
                        grandTotalMistakes += totalsByAction[actionName].negative;
                    });

                    const hasStats = grandTotalPoints > 0 || grandTotalMistakes > 0 || 
                        Object.values(totalsByAction).some(stats => stats.neutral > 0);

                    if (hasStats) {
                        // Add total row
                        const totalRow = {
                            id: p.id,
                            name: p.name,
                            Points: grandTotalPoints,
                            Mistakes: grandTotalMistakes
                        };

                        actionNames.forEach(an => {
                            const counts = totalsByAction[an];
                            totalRow[`${an}_+`] = counts.positive;
                            totalRow[`${an}_~`] = counts.neutral;
                            totalRow[`${an}_-`] = counts.negative;
                        });

                        rows.push(totalRow);

                        // Add individual set rows
                        if (pStats.sets) {
                            Object.keys(pStats.sets).sort((a, b) => parseInt(a) - parseInt(b)).forEach(setNum => {
                                const setStats = pStats.sets[setNum];
                                
                                let setPoints = 0;
                                let setMistakes = 0;
                                let setHasStats = false;

                                actionKeys.forEach(key => {
                                    const actionName = ACTIONS_MAP[key];
                                    const counts = setStats[actionName] || { positive: 0, neutral: 0, negative: 0 };
                                    
                                    if (counts.positive > 0 || counts.neutral > 0 || counts.negative > 0) {
                                        setHasStats = true;
                                    }
                                    
                                    if (actionName === 'Serve' || actionName === 'Atk' || actionName === 'Blk') {
                                        setPoints += counts.positive;
                                    }
                                    setMistakes += counts.negative;
                                });

                                if (setHasStats) {
                                    const setRow = {
                                        id: p.id,
                                        name: `${p.name} Set ${setNum}`,
                                        Points: setPoints,
                                        Mistakes: setMistakes
                                    };

                                    actionNames.forEach(an => {
                                        const counts = setStats[an] || { positive: 0, neutral: 0, negative: 0 };
                                        setRow[`${an}_+`] = counts.positive;
                                        setRow[`${an}_~`] = counts.neutral;
                                        setRow[`${an}_-`] = counts.negative;
                                    });

                                    rows.push(setRow);
                                }
                            });
                        }
                    }
                });

                exportCSV(rows, 'volleyball-stats.csv');
            };
        }
        
        const resetBtn = document.getElementById('reset-stats');
        if (resetBtn) {
            resetBtn.onclick = () => {
                if (confirm('Are you sure you want to reset all statistics? This cannot be undone!')) {
                    resetAllStatistics();
                    updateStatsDisplay({});
                    // Refresh action tracker if it's visible
                    const actionSection = document.getElementById('action-tracking');
                    if (actionSection && actionSection.style.display !== 'none') {
                        renderActionTracker();
                    }
                }
            };
        }
        
        setActive(navStats);
    }
}

// Screen switching
function showScreen(screen) {
    window.location.hash = `#/${screen}`;
}

function renderActionTracker() {
    const container = document.getElementById('action-buttons');
    if (!container) return;
    container.innerHTML = '';

    renderSetSelector();
    
    // Setup undo button
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
        undoBtn.onclick = () => {
            if (undoLastAction()) {
                renderActionTracker(); // Refresh the display
            } else {
                alert('No action to undo');
            }
        };
    }

    // action selector at top
    const actionSelectWrap = document.createElement('div');
    actionSelectWrap.className = 'action-select-wrap';
    
    Object.values(ACTIONS_MAP).forEach(actName => {
        const button = document.createElement('button');
        button.textContent = actName;
        button.className = 'action-select-btn';
        if (selectedAction === actName) {
            button.classList.add('active');
        }
        button.addEventListener('click', () => {
            selectedAction = actName;
            renderActionTracker();
        });
        actionSelectWrap.appendChild(button);
    });

    container.appendChild(actionSelectWrap);

    // players on field (exclude libero)
    const players = getPlayers();
    // order by POSITION_LIST to ensure consistent ordering
    const onFieldKeys = POSITION_LIST.map(p => p.key).filter(k => k !== 'libero');
    let onFieldPlayers = players.filter(p => p.position && p.position !== 'libero');
    // sort by position order if positions are present
    onFieldPlayers.sort((a, b) => onFieldKeys.indexOf(a.position) - onFieldKeys.indexOf(b.position));

    const stats = getPlayerStatistics();
    const opponentStats = getOpponentErrors();

    const list = document.createElement('div');
    list.className = 'onfield-list';

    onFieldPlayers.forEach(p => {
        const row = document.createElement('div');
        row.className = 'onfield-row';

        const name = document.createElement('div');
        name.className = 'onfield-name';
        name.textContent = p.name;
        row.appendChild(name);

        const controls = document.createElement('div');
        controls.className = 'onfield-controls stats-controls';

        // three big buttons: positive, neutral, negative
        ['positive', 'neutral', 'negative'].forEach(outcome => {
            const btn = document.createElement('button');
            btn.className = `big-btn ${outcome}`;
            btn.textContent = outcome === 'positive' ? '+' : (outcome === 'neutral' ? '~' : '-');
            btn.addEventListener('click', () => {
                if (!selectedAction) return alert('Select an action first');
                
                const actionToRecord = selectedAction;
                // record per-player statistic
                recordPlayerAction(p.id, actionToRecord, outcome);

                // If service or receive, auto-switch to attack
                if ((actionToRecord === 'Serve' && outcome === 'neutral') || (actionToRecord === 'Recv' && ['positive', 'neutral'].includes(outcome))) {
                    selectedAction = 'Atk';
                } else if (outcome === 'positive') {
                    selectedAction = 'Serve';
                } else if (outcome === 'negative') {
                    selectedAction = 'Recv';
                }

                // update stats display on the statistics page
                updateStatsDisplay(getPlayerStatistics() || {});
                // refresh player list to update counts and reflect new selected action
                renderActionTracker();
            });
            controls.appendChild(btn);
        });
        row.appendChild(controls);

        const actionControls = document.createElement('div');
        actionControls.className = 'onfield-controls action-controls';

        // small swap with libero button
        const swapBtn = document.createElement('button');
        swapBtn.className = 'btn btn-secondary swap-libero';
        swapBtn.textContent = 'Libero';
        swapBtn.addEventListener('click', () => {
            swapWithLibero(p.id);
            renderPlayers(getPlayers());
            renderPositions();
            renderActionTracker();
        });
        actionControls.appendChild(swapBtn);

        // exchange button (open modal)
        const exchangeBtn = document.createElement('button');
        exchangeBtn.className = 'btn btn-secondary exchange-btn';
        exchangeBtn.textContent = 'Exch.';
        exchangeBtn.addEventListener('click', () => openExchangeModal(p.id));
        actionControls.appendChild(exchangeBtn);
        row.appendChild(actionControls);

        // show current counts for selected action
        const counts = document.createElement('div');
        counts.className = 'player-counts';
        
        if (selectedAction) {
            const currentSetStats = (stats && stats[p.id] && stats[p.id].sets && stats[p.id].sets[getCurrentSet()] && stats[p.id].sets[getCurrentSet()][selectedAction])
                ? stats[p.id].sets[getCurrentSet()][selectedAction]
                : { positive: 0, neutral: 0, negative: 0 };

            let totalStats = { positive: 0, neutral: 0, negative: 0 };
            if (stats && stats[p.id] && stats[p.id].sets) {
                Object.values(stats[p.id].sets).forEach(setStats => {
                    if (setStats[selectedAction]) {
                        totalStats.positive += setStats[selectedAction].positive;
                        totalStats.neutral += setStats[selectedAction].neutral;
                        totalStats.negative += setStats[selectedAction].negative;
                    }
                });
            }

            counts.textContent = `+${currentSetStats.positive}(${totalStats.positive}) ~${currentSetStats.neutral}(${totalStats.neutral}) -${currentSetStats.negative}(${totalStats.negative})`;
        }
        
        row.appendChild(actionControls);
        row.appendChild(counts);

        list.appendChild(row);
    });

    const opponentRow = document.createElement('div');
    opponentRow.className = 'onfield-row opponent-row';

    const opponentLabel = document.createElement('div');
    opponentLabel.className = 'onfield-name';
    opponentLabel.textContent = 'Opp Err';
    opponentRow.appendChild(opponentLabel);

    const opponentControls = document.createElement('div');
    opponentControls.className = 'onfield-controls stats-controls opponent-controls';

    const opponentActions = ['Serve', 'Atk', 'Oth'];
    opponentActions.forEach(actionName => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-danger opponent-action-btn';
        btn.textContent = actionName;
        btn.addEventListener('click', () => {
            recordOpponentError(actionName);
            selectedAction = 'Serve';
            updateStatsDisplay(getPlayerStatistics() || {});
            renderActionTracker();
        });
        opponentControls.appendChild(btn);
    });
    opponentRow.appendChild(opponentControls);

    const opponentActionsSpacer = document.createElement('div');
    opponentActionsSpacer.className = 'onfield-controls action-controls opponent-actions-spacer';
    opponentRow.appendChild(opponentActionsSpacer);

    const opponentCounts = document.createElement('div');
    opponentCounts.className = 'player-counts opponent-counts';

    const currentSet = getCurrentSet();
    const totals = { Serve: 0, Atk: 0, Oth: 0 };
    Object.values(opponentStats || {}).forEach(setStats => {
        opponentActions.forEach(actionName => {
            totals[actionName] += (setStats && setStats[actionName]) ? setStats[actionName] : 0;
        });
    });

    const currentSetStats = (opponentStats && opponentStats[currentSet]) ? opponentStats[currentSet] : {};
    const shortLabels = { Serve: 'S', Atk: 'A', Oth: 'O' };
    opponentCounts.textContent = opponentActions.map(actionName => {
        const current = currentSetStats[actionName] || 0;
        return `${shortLabels[actionName]} ${current}(${totals[actionName]})`;
    }).join('  ');

    opponentRow.appendChild(opponentCounts);
    list.appendChild(opponentRow);

    container.appendChild(list);
}

function renderSetSelector() {
    const container = document.getElementById('set-selector-container');
    if (!container) return;
    container.innerHTML = '';

    const label = document.createElement('label');
    label.htmlFor = 'set-selector';
    label.textContent = 'Set:';
    container.appendChild(label);

    const select = document.createElement('select');
    select.id = 'set-selector';
    select.className = 'btn';

    const currentSet = getCurrentSet();
    // Allow creating a new set, we show up to currentSet + 1
    const maxSet = Math.max(currentSet + 1, 5); 

    for (let i = 1; i <= maxSet; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i;
        if (i === currentSet) {
            opt.selected = true;
        }
        select.appendChild(opt);
    }

    select.addEventListener('change', () => {
        setCurrentSet(select.value);
        renderActionTracker(); // Re-render to update stats
    });

    container.appendChild(select);
}

function openExchangeModal(fieldPlayerId) {
    // build overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal';
    const title = document.createElement('h3');
    title.textContent = 'Select bench player to exchange';
    modal.appendChild(title);

    const select = document.createElement('select');
    const benchPlayers = getPlayers().filter(p => !p.position || p.position === null);
    if (benchPlayers.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'No bench players available';
        modal.appendChild(p);
    } else {
        benchPlayers.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.name;
            select.appendChild(opt);
        });
        modal.appendChild(select);
    }

    const btnRow = document.createElement('div');
    btnRow.className = 'modal-buttons';
    const ok = document.createElement('button');
    ok.className = 'btn btn-primary';
    ok.textContent = 'OK';
    ok.addEventListener('click', () => {
        const selected = select.value;
        if (!selected) return;
        exchangeWithBench(fieldPlayerId, selected);
        document.body.removeChild(overlay);
        renderPlayers(getPlayers());
        renderPositions();
        renderActionTracker();
    });
    const cancel = document.createElement('button');
    cancel.className = 'btn';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => {
        document.body.removeChild(overlay);
    });
    btnRow.appendChild(ok);
    btnRow.appendChild(cancel);
    modal.appendChild(btnRow);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

export default {
    initUI,
    renderPlayers,
    renderActions,
    updateStatsDisplay
};