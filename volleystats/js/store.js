const store = {
    saveData: function (key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },
    getData: function (key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    },
    clearData: function (key) {
        localStorage.removeItem(key);
    },
    savePlayerStats: function (playerStats) {
        this.saveData('playerStats', playerStats);
    },
    getPlayerStats: function () {
        return this.getData('playerStats');
    },
    clearPlayerStats: function () {
        this.clearData('playerStats');
    },
    saveGameData: function (gameData) {
        this.saveData('gameData', gameData);
    },
    getGameData: function () {
        return this.getData('gameData');
    },
    clearGameData: function () {
        this.clearData('gameData');
    }
};

export default store;