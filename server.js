// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors'); // Für lokale Entwicklung wichtig

const app = express();
const PORT = 3000;
const dbPath = path.join(__dirname, 'db.json');

// --- MIDDLEWARE ---
// Erlaube CORS (Cross-Origin Resource Sharing) für das Frontend, 
// das wahrscheinlich unter einer anderen Adresse läuft (z.B. file:// oder Vercel/Render)
app.use(cors()); 

// Middleware, um JSON-Körper in Anfragen zu parsen
app.use(express.json()); 

// --- DATENBANK MANAGEMENT ---

// Standard-Datenbankstruktur (als Fallback)
const DEFAULT_DB = {
    users: {
        "Thomas": { 
            password: "nacke", 
            image: "https://api.dicebear.com/7.x/notionists/svg?seed=Thomas", 
            lastSeenScore: 0, 
            received: { "Emil": 0, "Marius": 0 }, 
            badges: [],
            autoLogin: false
        },
        "Emil":   { 
            password: "nacke", 
            image: "https://api.dicebear.com/7.x/notionists/svg?seed=Emil", 
            lastSeenScore: 0, 
            received: { "Thomas": 0, "Marius": 0 }, 
            badges: [],
            autoLogin: false
        },
        "Marius": { 
            password: "nacke", 
            image: "https://api.dicebear.com/7.x/notionists/svg?seed=Marius", 
            lastSeenScore: 0, 
            received: { "Thomas": 0, "Emil": 0 }, 
            badges: [],
            autoLogin: false
        },
        "Admin": { 
            password: "nacke", 
            image: "https://api.dicebear.com/7.x/micah/svg?seed=Admin", 
            lastSeenScore: 0, 
            received: {},
            adminLobs: 0,
            badges: [],
            autoLogin: false
        }
    },
    logs: [],
    rewards: [
        { id: 1, name: 'Kaffeepause gespendet', cost: 20, desc: 'Ein leckerer Kaffee aufs Haus.' },
        { id: 2, name: 'Pizza-Mittagessen', cost: 50, desc: 'Pizza für das Team, bezahlt aus deinem Lob-Konto.' },
        { id: 3, name: 'Extra Urlaubstag', cost: 100, desc: 'Nimm dir einen Tag frei. Gönn es dir!' }
    ]
};

let db = DEFAULT_DB;

/**
 * Lädt die Datenbank aus der db.json Datei. 
 * Erstellt die Datei, falls sie nicht existiert, oder lädt die Standarddaten.
 */
function loadDatabase() {
    try {
        if (fs.existsSync(dbPath)) {
            const data = fs.readFileSync(dbPath, 'utf8');
            db = JSON.parse(data);
            
            // WICHTIG: Stellt sicher, dass das Admin-Konto in der geladenen DB existiert,
            // falls es in einer älteren Version fehlte.
            if (!db.users['Admin']) {
                db.users['Admin'] = DEFAULT_DB.users['Admin'];
            }
            if (typeof db.users['Admin'].adminLobs === 'undefined') {
                 db.users['Admin'].adminLobs = 0;
            }

            console.log('Datenbank erfolgreich geladen.');
        } else {
            // Speichere die Standard-Datenbank, falls db.json nicht existiert
            saveDatabase();
            console.log('db.json nicht gefunden. Standard-Datenbank erstellt und gespeichert.');
        }
    } catch (e) {
        console.error('FEHLER beim Laden/Parsen der Datenbank:', e);
        // Fallback auf Standarddaten bei Fehler
        db = DEFAULT_DB;
    }
}

/**
 * Speichert die aktuelle In-Memory-Datenbank in die db.json Datei.
 */
function saveDatabase() {
    try {
        // Schreibt die gesamte JS-Datenstruktur in die db.json
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
    } catch (e) {
        console.error('FEHLER beim Speichern der Datenbank:', e);
    }
}


// --- API ENDPUNKTE ---

/**
 * GET /db
 * Gibt den gesamten Zustand der Datenbank zurück. 
 * Wird vom Frontend beim Start zum Initialisieren verwendet.
 */
app.get('/db', (req, res) => {
    // Sende die gesamte Datenbank an den Client
    res.json(db);
});

/**
 * POST /update
 * Erhält den kompletten, aktualisierten Zustand der Datenbank vom Frontend 
 * und speichert ihn persistent.
 */
app.post('/update', (req, res) => {
    // Validiere, ob der Request-Body existiert und ein Objekt ist
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).send({ success: false, message: 'Ungültige Daten gesendet.' });
    }

    // Ersetze die In-Memory-Datenbank durch die vom Client gesendeten Daten
    db = req.body;
    
    // Speichern auf Festplatte
    fs.writeFile(dbPath, JSON.stringify(db, null, 2), err => {
        if (err) {
            console.error('Fehler beim Speichern der DB:', err);
            return res.status(500).send({ success: false, message: 'Speichern fehlgeschlagen.' });
        }
        
        // Füge eine kleine Log-Meldung für den Admin-Stand hinzu, um das Debuggen zu erleichtern
        const adminLobs = db.users.Admin ? db.users.Admin.adminLobs : 'N/A';
        console.log(`DB erfolgreich gespeichert. (Admin Lobs: ${adminLobs})`);
        
        res.status(200).send({ success: true });
    });
});


// --- SERVER START ---
loadDatabase(); // Lade die DB vor dem Start

// server.js (Code ZUSÄTZLICH einfügen)

// NEUER ENDPUNKT FÜR DIE STARTSEITE
app.get('/', (req, res) => {
    // Sende die index.html Datei als Antwort
    res.sendFile(path.join(__dirname, 'index.html'));
});

// app.listen(PORT, ...); // Der Server-Start-Befehl bleibt unverändert

app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
    console.log('Wichtig: Server muss laufen, damit das Frontend im Online-Modus funktioniert.');
});
