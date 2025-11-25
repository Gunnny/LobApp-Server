const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'database.json');

// --- Middleware ---
// Wichtig: Limit muss für Base64-Bilder erhöht werden (hier 5MB)
app.use(cors()); 
app.use(bodyParser.json({ limit: '5mb' })); 

// --- DB Lese/Schreib Funktionen ---

function readDB() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Fehler beim Lesen der Datenbankdatei. Wird mit Standard-Daten fortgefahren.");
        // Fallback zur Erstellung der Datei mit Standard-Daten, falls nicht vorhanden.
        const initialData = { 
            users: {
                "Thomas": { password: "nacke", image: "https://api.dicebear.com/7.x/notionists/svg?seed=Thomas", lastSeenScore: 0, received: { "Emil": 0, "Marius": 0 }, badges: [] },
                "Emil":   { password: "nacke", image: "https://api.dicebear.com/7.x/notionists/svg?seed=Emil", lastSeenScore: 0, received: { "Thomas": 0, "Marius": 0 }, badges: [] },
                "Marius": { password: "nacke", image: "https://api.dicebear.com/7.x/notionists/svg?seed=Marius", lastSeenScore: 0, received: { "Thomas": 0, "Emil": 0 }, badges: [] } 
            },
            logs: [],
            rewards: [
                { id: 1, name: 'Kaffeepause gespendet', cost: 20 },
                { id: 2, name: 'Pizza-Mittagessen', cost: 50 },
                { id: 3, name: 'Extra Urlaubstag', cost: 100 }
            ]
        };
        writeDB(initialData);
        return initialData;
    }
}

function writeDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error("Fehler beim Schreiben der Datenbankdatei:", error);
    }
}

// --- API Endpunkte ---

// 1. Gibt den aktuellen DB-Stand zurück (für Init und Lese-Vorgänge)
app.get('/db', (req, res) => {
    const db = readDB();
    res.json(db);
});

// 2. Erhält den neuen DB-Stand und speichert ihn (für Schreib-Vorgänge)
app.post('/update', (req, res) => {
    const newDb = req.body;
    writeDB(newDb);
    res.status(200).send({ message: 'Datenbank erfolgreich aktualisiert.' });
});

// --- Server starten ---
app.listen(PORT, () => {
    console.log(`🚀 Lob App Server läuft auf http://localhost:${PORT}`);
    console.log(`Stelle sicher, dass database.json existiert oder erstellt wird.`);
});