# charts-dashboard

Generates worklists for charts with support for uploading source data and attachments.

## Development

The application now persists data to a SQLite database via a small Node.js API. To run the dashboard locally:

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the server:

   ```bash
   npm start
   ```

The application will be available at [http://localhost:3000](http://localhost:3000). Uploaded data and tags are stored in `data/app.db`.
