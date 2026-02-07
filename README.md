# Volleyball Game Statistics Tracker

This project is a web application designed to track statistics for volleyball games. It allows for player registration, position assignment, action tracking, and data storage using local storage. Additionally, it provides functionality to export the statistics as a CSV file.

## Features

- **Player Registration**: Register players and manage their details.
- **Position Assignment**: Assign players to specific positions on the court.
- **Action Tracking**: Track various actions during the game, including Service, Receive, Attack, Block, and Other.
- **Data Storage**: Store player statistics and game data in the browser's local storage for persistence.
- **CSV Export**: Export the collected statistics in CSV format for easy sharing and analysis.

## Project Structure

```
volleyball-stats
├── src
│   ├── index.html          # Main HTML structure
│   ├── styles
│   │   └── main.css       # Styles for the application
│   ├── js
│   │   ├── app.js         # Entry point for the JavaScript application
│   │   ├── ui.js          # User interface interactions
│   │   ├── store.js       # Local storage management
│   │   ├── players.js     # Player registration and management
│   │   ├── positions.js    # Player position assignment
│   │   ├── actions.js     # Action tracking logic
│   │   └── export-csv.js  # CSV export functionality
│   └── utils
│       └── helpers.js     # Utility functions
├── package.json            # npm configuration file
├── .gitignore              # Files to ignore in version control
└── README.md               # Project documentation
```

## Getting Started

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```
   cd volleyball-stats
   ```

3. Open `src/index.html` in your web browser to start using the application.

## Usage

- Register players by entering their names and details.
- Assign players to positions on the court.
- Track actions during the game to update statistics.
- Use the export functionality to download the statistics as a CSV file.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for any enhancements or bug fixes.

## License

This project is open-source and available under the MIT License.