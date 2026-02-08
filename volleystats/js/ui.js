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

function updateStatsDisplay(playerStats, selectedSetFilter = 'total') {
    const disp = statsDisplay();
    if (!disp) return;
    disp.innerHTML = '';

    const players = getPlayers();
    const actionKeys = Object.keys(ACTIONS_MAP);
    const actionNames = Object.values(ACTIONS_MAP);
    const opponentStats = getOpponentErrors();

    // Create set filter dropdown in header
    const filterContainer = document.getElementById('stats-filter-container');
    if (filterContainer) {
        filterContainer.innerHTML = '';
        
        const filterSelect = document.createElement('select');
        filterSelect.className = 'btn';
        filterSelect.style.display = 'inline-block';
        filterSelect.style.width = 'auto';
        
        // Add "Total" option
        const totalOpt = document.createElement('option');
        totalOpt.value = 'total';
        totalOpt.textContent = 'Total (All Sets)';
        if (selectedSetFilter === 'total') totalOpt.selected = true;
        filterSelect.appendChild(totalOpt);
        
        // Add individual set options based on available sets
        const availableSets = new Set();
        Object.values(playerStats).forEach(pStats => {
            if (pStats.sets) {
                Object.keys(pStats.sets).forEach(setNum => availableSets.add(parseInt(setNum)));
            }
        });
        if (opponentStats) {
            Object.keys(opponentStats).forEach(setNum => availableSets.add(parseInt(setNum)));
        }
        
        Array.from(availableSets).sort((a, b) => a - b).forEach(setNum => {
            const setOpt = document.createElement('option');
            setOpt.value = setNum;
            setOpt.textContent = `Set ${setNum}`;
            if (selectedSetFilter == setNum) setOpt.selected = true;
            filterSelect.appendChild(setOpt);
        });
        
        filterSelect.addEventListener('change', () => {
            updateStatsDisplay(getPlayerStatistics() || {}, filterSelect.value);
        });
        
        filterContainer.appendChild(filterSelect);
    }

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

    const winnersHeader = document.createElement('th');
    winnersHeader.rowSpan = 2;
    winnersHeader.textContent = '+';
    headerRow1.appendChild(winnersHeader);

    const errorsHeader = document.createElement('th');
    errorsHeader.rowSpan = 2;
    errorsHeader.textContent = '-';
    headerRow1.appendChild(errorsHeader);

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
        
        let displayStats = {};
        let winners = 0;
        let errors = 0;
        let hasStats = false;
        
        actionKeys.forEach(key => {
            const actionName = ACTIONS_MAP[key];
            displayStats[actionName] = { positive: 0, neutral: 0, negative: 0 };
        });
        
        if (selectedSetFilter === 'total') {
            // Calculate totals across all sets
            if (pStats.sets) {
                Object.values(pStats.sets).forEach(setStats => {
                    actionKeys.forEach(key => {
                        const actionName = ACTIONS_MAP[key];
                        if (setStats[actionName]) {
                            displayStats[actionName].positive += setStats[actionName].positive;
                            displayStats[actionName].neutral += setStats[actionName].neutral;
                            displayStats[actionName].negative += setStats[actionName].negative;
                        }
                    });
                });
            }
        } else {
            // Show specific set
            if (pStats.sets && pStats.sets[selectedSetFilter]) {
                const setStats = pStats.sets[selectedSetFilter];
                actionKeys.forEach(key => {
                    const actionName = ACTIONS_MAP[key];
                    if (setStats[actionName]) {
                        displayStats[actionName].positive = setStats[actionName].positive;
                        displayStats[actionName].neutral = setStats[actionName].neutral;
                        displayStats[actionName].negative = setStats[actionName].negative;
                    }
                });
            }
        }
        
        // Calculate winners and errors
        actionKeys.forEach(key => {
            const actionName = ACTIONS_MAP[key];
            if (actionName === 'Serv' || actionName === 'Atk' || actionName === 'Blk') {
                winners += displayStats[actionName].positive;
            }
            errors += displayStats[actionName].negative;
        });
        
        hasStats = winners > 0 || errors > 0 || 
            Object.values(displayStats).some(stats => stats.neutral > 0);

        if (hasStats) {
            const row = document.createElement('tr');
            
            const nameCell = document.createElement('td');
            nameCell.className = 'player-name-col';
            nameCell.textContent = p.name;
            row.appendChild(nameCell);

            const winnersCell = document.createElement('td');
            winnersCell.className = 'stat-positive';
            winnersCell.textContent = winners || '';
            row.appendChild(winnersCell);

            const errorsCell = document.createElement('td');
            errorsCell.className = 'stat-negative';
            errorsCell.textContent = errors || '';
            row.appendChild(errorsCell);

            actionKeys.forEach(key => {
                const actionName = ACTIONS_MAP[key];
                const counts = displayStats[actionName];
                
                const posCell = document.createElement('td');
                posCell.className = 'stat-positive';
                posCell.textContent = counts.positive || '';
                row.appendChild(posCell);

                const neutCell = document.createElement('td');
                neutCell.textContent = counts.neutral || '';
                row.appendChild(neutCell);

                const negCell = document.createElement('td');
                negCell.className = 'stat-negative';
                negCell.textContent = counts.negative || '';
                row.appendChild(negCell);
            });

            tbody.appendChild(row);
        }
    });

    // Add opponent errors
    if (opponentStats && Object.keys(opponentStats).length > 0) {
        let displayStats = {};
        let totalErrors = 0;
        
        actionKeys.forEach(key => {
            const actionName = ACTIONS_MAP[key];
            displayStats[actionName] = 0;
        });

        if (selectedSetFilter === 'total') {
            // Sum up all sets
            Object.values(opponentStats).forEach(setStats => {
                actionKeys.forEach(key => {
                    const actionName = ACTIONS_MAP[key];
                    if (setStats[actionName]) {
                        displayStats[actionName] += setStats[actionName];
                        totalErrors += setStats[actionName];
                    }
                });
            });
        } else {
            // Show specific set
            if (opponentStats[selectedSetFilter]) {
                const setStats = opponentStats[selectedSetFilter];
                actionKeys.forEach(key => {
                    const actionName = ACTIONS_MAP[key];
                    if (setStats[actionName]) {
                        displayStats[actionName] = setStats[actionName];
                        totalErrors += setStats[actionName];
                    }
                });
            }
        }

        if (totalErrors > 0) {
            const row = document.createElement('tr');
            row.className = 'opponent-total-row';
            
            const nameCell = document.createElement('td');
            nameCell.className = 'player-name-col';
            nameCell.textContent = 'Opponent';
            row.appendChild(nameCell);

            const winnersCell = document.createElement('td');
            winnersCell.textContent = '';
            row.appendChild(winnersCell);

            const errorsCell = document.createElement('td');
            errorsCell.className = 'stat-negative';
            errorsCell.textContent = totalErrors;
            row.appendChild(errorsCell);

            actionKeys.forEach(key => {
                const actionName = ACTIONS_MAP[key];
                
                const posCell = document.createElement('td');
                posCell.textContent = '';
                row.appendChild(posCell);

                const neutCell = document.createElement('td');
                neutCell.textContent = '';
                row.appendChild(neutCell);

                const negCell = document.createElement('td');
                negCell.className = 'stat-negative';
                negCell.textContent = displayStats[actionName] || '';
                row.appendChild(negCell);
            });

            tbody.appendChild(row);
        }
    }

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

        // Only show players without a position, or the player currently assigned to this position
        players.forEach(p => {
            if (!p.position || p.position === pos.key) {
                const opt = document.createElement('option');
                opt.value = String(p.id);
                opt.textContent = p.name;
                if (p.position === pos.key) opt.selected = true;
                select.appendChild(opt);
            }
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
                    let grandTotalWinners = 0;
                    let grandTotalErrors = 0;
                    
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
                        if (actionName === 'Serv' || actionName === 'Atk' || actionName === 'Blk') {
                            grandTotalWinners += totalsByAction[actionName].positive;
                        }
                        grandTotalErrors += totalsByAction[actionName].negative;
                    });

                    const hasStats = grandTotalWinners > 0 || grandTotalErrors > 0 || 
                        Object.values(totalsByAction).some(stats => stats.neutral > 0);

                    if (hasStats) {
                        // Add total row
                        const totalRow = {
                            id: p.id,
                            name: p.name,
                            Winners: grandTotalWinners || '',
                            Errors: grandTotalErrors || ''
                        };

                        actionNames.forEach(an => {
                            const counts = totalsByAction[an];
                            totalRow[`${an}_+`] = counts.positive || '';
                            totalRow[`${an}_~`] = counts.neutral || '';
                            totalRow[`${an}_-`] = counts.negative || '';
                        });

                        rows.push(totalRow);

                        // Add individual set rows
                        if (pStats.sets) {
                            Object.keys(pStats.sets).sort((a, b) => parseInt(a) - parseInt(b)).forEach(setNum => {
                                const setStats = pStats.sets[setNum];
                                
                                let setWinners = 0;
                                let setErrors = 0;
                                let setHasStats = false;

                                actionKeys.forEach(key => {
                                    const actionName = ACTIONS_MAP[key];
                                    const counts = setStats[actionName] || { positive: 0, neutral: 0, negative: 0 };
                                    
                                    if (counts.positive > 0 || counts.neutral > 0 || counts.negative > 0) {
                                        setHasStats = true;
                                    }
                                    
                                    if (actionName === 'Serv' || actionName === 'Atk' || actionName === 'Blk') {
                                        setWinners += counts.positive;
                                    }
                                    setErrors += counts.negative;
                                });

                                if (setHasStats) {
                                    const setRow = {
                                        id: p.id,
                                        name: `${p.name} Set ${setNum}`,
                                        Winners: setWinners || '',
                                        Errors: setErrors || ''
                                    };

                                    actionNames.forEach(an => {
                                        const counts = setStats[an] || { positive: 0, neutral: 0, negative: 0 };
                                        setRow[`${an}_+`] = counts.positive || '';
                                        setRow[`${an}_~`] = counts.neutral || '';
                                        setRow[`${an}_-`] = counts.negative || '';
                                    });

                                    rows.push(setRow);
                                }
                            });
                        }
                    }
                });

                // Add opponent errors
                const opponentStats = getOpponentErrors();
                if (opponentStats && Object.keys(opponentStats).length > 0) {
                    // Calculate totals across all sets
                    let totalsByAction = {};
                    let grandTotalErrors = 0;
                    
                    actionKeys.forEach(key => {
                        const actionName = ACTIONS_MAP[key];
                        totalsByAction[actionName] = 0;
                    });

                    // Sum up all sets
                    Object.values(opponentStats).forEach(setStats => {
                        actionKeys.forEach(key => {
                            const actionName = ACTIONS_MAP[key];
                            if (setStats[actionName]) {
                                totalsByAction[actionName] += setStats[actionName];
                                grandTotalErrors += setStats[actionName];
                            }
                        });
                    });

                    // Only add if there are errors
                    if (grandTotalErrors > 0) {
                        // Add total row
                        const totalRow = {
                            id: 'opponent',
                            name: 'Opponent',
                            Winners: '',
                            Errors: grandTotalErrors
                        };

                        actionNames.forEach(an => {
                            totalRow[`${an}_+`] = '';
                            totalRow[`${an}_~`] = '';
                            totalRow[`${an}_-`] = totalsByAction[an] || '';
                        });

                        rows.push(totalRow);

                        // Add individual set rows
                        Object.keys(opponentStats).sort((a, b) => parseInt(a) - parseInt(b)).forEach(setNum => {
                            const setStats = opponentStats[setNum];
                            
                            let setErrors = 0;
                            let setHasStats = false;

                            actionKeys.forEach(key => {
                                const actionName = ACTIONS_MAP[key];
                                const count = setStats[actionName] || 0;
                                
                                if (count > 0) {
                                    setHasStats = true;
                                    setErrors += count;
                                }
                            });

                            if (setHasStats) {
                                const setRow = {
                                    id: 'opponent',
                                    name: `Opponent Set ${setNum}`,
                                    Winners: '',
                                    Errors: setErrors
                                };

                                actionNames.forEach(an => {
                                    const count = setStats[an] || 0;
                                    setRow[`${an}_+`] = '';
                                    setRow[`${an}_~`] = '';
                                    setRow[`${an}_-`] = count || '';
                                });

                                rows.push(setRow);
                            }
                        });
                    }
                }

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

    // Check if the designated libero is currently on the field
    const liberoPlayer = players.find(pl => pl.isLibero);
    const isLiberoOnField = liberoPlayer && liberoPlayer.position !== 'libero';

    onFieldPlayers.forEach(p => {
        const row = document.createElement('div');
        row.className = 'onfield-row';

        const name = document.createElement('div');
        name.className = 'onfield-name';
        // Check if someone else is in the libero position (meaning a libero swap occurred)
        // and this player might be the libero who swapped in
        const someoneInLiberoPosition = players.find(pl => pl.position === 'libero');
        // If there's someone in libero position, check if this player has isLibero flag or was originally libero
        const isLiberoSwappedIn = someoneInLiberoPosition && p.isLibero;
        
        name.textContent = isLiberoSwappedIn ? `${p.name} (L)` : p.name;
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
                if ((actionToRecord === 'Serv' && outcome === 'neutral') || (actionToRecord === 'Recv' && ['positive', 'neutral'].includes(outcome))) {
                    selectedAction = 'Atk';
                } else if (outcome === 'positive') {
                    selectedAction = 'Serv';
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

        // Exchange button (open modal) - always shown first
        const exchangeBtn = document.createElement('button');
        exchangeBtn.className = 'btn btn-secondary exchange-btn';
        exchangeBtn.textContent = 'Bench';
        exchangeBtn.addEventListener('click', () => openExchangeModal(p.id));
        actionControls.appendChild(exchangeBtn);

        // Show libero swap button:
        // - If libero is NOT on field: show for all players
        // - If libero IS on field: only show for the libero themselves
        const showLiberoButton = !isLiberoOnField || p.isLibero;
        
        if (showLiberoButton) {
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
        }

        row.appendChild(actionControls);

        // show current winners and errors
        const counts = document.createElement('div');
        counts.className = 'player-counts';
        
        const currentSet = getCurrentSet();
        const actionKeys = Object.keys(ACTIONS_MAP);
        
        // Calculate current set winners and errors
        let currentSetWinners = 0;
        let currentSetErrors = 0;
        
        if (stats && stats[p.id] && stats[p.id].sets && stats[p.id].sets[currentSet]) {
            const setStats = stats[p.id].sets[currentSet];
            actionKeys.forEach(key => {
                const actionName = ACTIONS_MAP[key];
                if (setStats[actionName]) {
                    if (actionName === 'Serv' || actionName === 'Atk' || actionName === 'Blk') {
                        currentSetWinners += setStats[actionName].positive || 0;
                    }
                    currentSetErrors += setStats[actionName].negative || 0;
                }
            });
        }
        
        // Calculate total winners and errors across all sets
        let totalWinners = 0;
        let totalErrors = 0;
        
        if (stats && stats[p.id] && stats[p.id].sets) {
            Object.values(stats[p.id].sets).forEach(setStats => {
                actionKeys.forEach(key => {
                    const actionName = ACTIONS_MAP[key];
                    if (setStats[actionName]) {
                        if (actionName === 'Serv' || actionName === 'Atk' || actionName === 'Blk') {
                            totalWinners += setStats[actionName].positive || 0;
                        }
                        totalErrors += setStats[actionName].negative || 0;
                    }
                });
            });
        }

        counts.textContent = `+${currentSetWinners}(${totalWinners}) -${currentSetErrors}(${totalErrors})`;
        
        row.appendChild(counts);

        list.appendChild(row);
    });

    const opponentRow = document.createElement('div');
    opponentRow.className = 'onfield-row opponent-row';

    const opponentLabel = document.createElement('div');
    opponentLabel.className = 'onfield-name';
    opponentLabel.textContent = 'Opp Error';
    opponentRow.appendChild(opponentLabel);

    const opponentControls = document.createElement('div');
    opponentControls.className = 'onfield-controls stats-controls opponent-controls';

    const opponentActions = ['Serv', 'Atk', 'Oth'];
    opponentActions.forEach(actionName => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-danger opponent-action-btn';
        btn.textContent = actionName;
        btn.addEventListener('click', () => {
            recordOpponentError(actionName);
            selectedAction = 'Serv';
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
    
    // Calculate total errors across all sets
    let totalErrors = 0;
    Object.values(opponentStats || {}).forEach(setStats => {
        opponentActions.forEach(actionName => {
            totalErrors += (setStats && setStats[actionName]) ? setStats[actionName] : 0;
        });
    });

    // Calculate current set errors
    const currentSetStats = (opponentStats && opponentStats[currentSet]) ? opponentStats[currentSet] : {};
    let currentSetErrors = 0;
    opponentActions.forEach(actionName => {
        currentSetErrors += currentSetStats[actionName] || 0;
    });
    
    opponentCounts.textContent = `-${currentSetErrors}(${totalErrors})`;

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
    
    // Only show OK button if there are bench players available
    if (benchPlayers.length > 0) {
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
        btnRow.appendChild(ok);
    }
    
    const cancel = document.createElement('button');
    cancel.className = 'btn';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => {
        document.body.removeChild(overlay);
    });
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