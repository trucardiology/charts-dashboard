const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIRECTORY = path.join(__dirname, 'data');
const DATABASE_PATH = path.join(DATA_DIRECTORY, 'app.db');
const PUBLIC_DIRECTORY = path.join(__dirname, 'public');

app.use(express.json({ limit: '25mb' }));
app.use(express.static(PUBLIC_DIRECTORY));

let db;

async function initialiseDatabase() {
    if (!fs.existsSync(DATA_DIRECTORY)) {
        fs.mkdirSync(DATA_DIRECTORY, { recursive: true });
    }

    db = await open({
        filename: DATABASE_PATH,
        driver: sqlite3.Database,
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS patient_lists (
            dos TEXT PRIMARY KEY,
            data TEXT NOT NULL
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            name TEXT PRIMARY KEY,
            values_json TEXT NOT NULL
        );
    `);
}

async function loadState() {
    const patientRows = await db.all('SELECT dos, data FROM patient_lists ORDER BY dos');
    const settingsRows = await db.all('SELECT name, values_json FROM settings');

    const patientLists = {};
    for (const row of patientRows) {
        try {
            patientLists[row.dos] = JSON.parse(row.data);
        } catch (error) {
            console.warn(`Unable to parse patient list for ${row.dos}:`, error);
            patientLists[row.dos] = [];
        }
    }

    const settings = {};
    for (const row of settingsRows) {
        try {
            settings[row.name] = JSON.parse(row.values_json);
        } catch (error) {
            console.warn(`Unable to parse settings value for ${row.name}:`, error);
            settings[row.name] = [];
        }
    }

    return {
        patientLists,
        reasonTags: settings.reasonTags || [],
        resultsNeededTags: settings.resultsNeededTags || [],
        visitTypeTags: settings.visitTypeTags || [],
    };
}

async function persistState({ patientLists, reasonTags, resultsNeededTags, visitTypeTags }) {
    if (typeof patientLists !== 'object' || patientLists === null || Array.isArray(patientLists)) {
        throw new Error('Invalid patientLists payload');
    }

    const serialisedSettings = [
        ['reasonTags', Array.isArray(reasonTags) ? reasonTags : []],
        ['resultsNeededTags', Array.isArray(resultsNeededTags) ? resultsNeededTags : []],
        ['visitTypeTags', Array.isArray(visitTypeTags) ? visitTypeTags : []],
    ];

    await db.exec('BEGIN');
    try {
        await db.run('DELETE FROM patient_lists');
        const insertPatient = await db.prepare('INSERT INTO patient_lists (dos, data) VALUES (?, ?)');
        for (const [dos, patients] of Object.entries(patientLists)) {
            await insertPatient.run(dos, JSON.stringify(Array.isArray(patients) ? patients : []));
        }
        await insertPatient.finalize();

        await db.run('DELETE FROM settings');
        const insertSetting = await db.prepare('INSERT INTO settings (name, values_json) VALUES (?, ?)');
        for (const [name, values] of serialisedSettings) {
            await insertSetting.run(name, JSON.stringify(values));
        }
        await insertSetting.finalize();

        await db.exec('COMMIT');
    } catch (error) {
        await db.exec('ROLLBACK');
        throw error;
    }
}

app.get('/api/state', async (req, res) => {
    try {
        const state = await loadState();
        res.json(state);
    } catch (error) {
        console.error('Failed to load application state:', error);
        res.status(500).json({ error: 'Failed to load application state.' });
    }
});

app.post('/api/state', async (req, res) => {
    try {
        await persistState(req.body || {});
        res.status(204).end();
    } catch (error) {
        console.error('Failed to save application state:', error);
        const statusCode = error.message === 'Invalid patientLists payload' ? 400 : 500;
        res.status(statusCode).json({ error: error.message || 'Failed to save application state.' });
    }
});

app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return next();
    }
    res.sendFile(path.join(PUBLIC_DIRECTORY, 'index.html'));
});

initialiseDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
