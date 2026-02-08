// This file manages the assignment of players to the 7 positions (6 players + libero).
// It exports functions to set and get the current positions of players on the field.

const positions = {
    setter: null,
    outsideHitter1: null,
    outsideHitter2: null,
    middleBlocker1: null,
    middleBlocker2: null,
    oppositeHitter: null,
    libero: null
};

function setPosition(player, position) {
    if (positions.hasOwnProperty(position)) {
        positions[position] = player;
    } else {
        console.error('Invalid position');
    }
}

function getPositions() {
    return positions;
}

function clearPositions() {
    for (let position in positions) {
        positions[position] = null;
    }
}

export { setPosition, getPositions, clearPositions };