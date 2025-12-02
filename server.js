// server.js - FINALE VERSION MIT FIREBASE FIRESTORE FÜR PERSISTENTE DATEN
// DIESER CODE ERSETZT DIE LOKALE DATEISPEICHERUNG (fs) UND STARTET DEN SERVER
console.log("\n--- SYSTEM START: Firebase Server wird initialisiert ---");

// 1. Core-Module laden
const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// 2. Firebase Admin SDK laden
let admin;
try {
    // Stellt sicher, dass das Modul geladen werden kann (muss in package.json als Abhängigkeit sein)
    admin = require('firebase-admin');
    console.log("✓ Firebase Admin SDK geladen.");
} catch (e) {
    console.error("\n!!! KRITISCHER FEHLER: firebase-admin konnte nicht geladen werden.");
    console.error("BITTE PRÜFEN SIE die Abhängigkeit in package.json.");
    process.exit(1);
}

// --- SERVER SETUP ---
// WICHTIG: Hier wird der Port definiert und Express initialisiert.
// process.env.PORT wird von Render automatisch gesetzt.
const PORT = process.env.PORT || 3000;
const app = express();

// --- FIREBASE KONFIGURATION ---
// Definieren des Namens der Firestore Collection und des Dokuments
const FIRESTORE_COLLECTION = 'lob-app-data';
const FIRESTORE_DOC_ID = 'db';

// Funktion zur Initialisierung des Firebase Admin SDK
function initializeFirebase() {
    // Liest den JSON-Schlüssel aus der Render Umgebungsvariable (MUSS gesetzt werden)
    const serviceAccountJson = process.env.FIREBASE_CREDENTIALS_JSON;
    if (!serviceAccountJson) {
        console.error("!!! FIREBASE FEHLER: Umgebungsvariable FIREBASE_CREDENTIALS_JSON fehlt.");
        console.error("Datenbank kann NICHT persistent speichern. Läuft im Fallback-Modus.");
        return { isRunning: false, db: null };
    }

    try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('✓ Firebase Admin SDK erfolgreich initialisiert.');
        // Gib die Firestore-Instanz zurück
        return { isRunning: true, db: admin.firestore() };
    } catch (e) {
        console.error("!!! FEHLER beim Parsen/Initialisieren der Firebase Credentials:", e.message);
        return { isRunning: false, db: null };
    }


}

const { isRunning: isDbConnected, db: firestoreDb } = initializeFirebase();
let db = null; // Lokaler Cache für die Daten

// --- DEFAULT DATEN ---
// Diese Daten werden nur in Firestore gespeichert, wenn das Dokument noch nicht existiert.
const DEFAULT_DB = {
    users: {
        "Thomas": { password: "nacke", image: "https://api.dicebear.com/7.x/notionists/svg?seed=Thomas", lastSeenScore: 0, received: { "Emil": 0, "Marius": 0 }, badges: [], autoLogin: false, chips: { "Admin": 0, "Emil": 0, "Casino": 0 } },
        "Emil": { password: "nacke", image: "https://api.dicebear.com/7.x/notionists/svg?seed=Emil", lastSeenScore: 0, received: { "Thomas": 0, "Marius": 0 }, badges: [], autoLogin: false, chips: { "Thomas": 0, "Marius": 0, "Casino": 0 } },
        "Marius": { password: "nacke", image: "https://api.dicebear.com/7.x/notionists/svg?seed=Marius", lastSeenScore: 0, received: { "Thomas": 0, "Emil": 0 }, badges: [], autoLogin: false, chips: { "Thomas": 0, "Emil": 0, "Casino": 0 } },
        "Admin": { password: "nacke", image: "https://api.dicebear.com/7.x/micah/svg?seed=Admin", lastSeenScore: 0, received: {}, adminLobs: 0, badges: [], autoLogin: false, chips: { "Thomas": 0, "Emil": 0, "Marius": 0 } }
    },
    logs: [],
    rewards: [
        { id: 1, name: 'Kaffeepause gespendet', cost: 20, desc: 'Ein leckerer Kaffee aufs Haus.' },
        { id: 2, name: 'Pizza-Mittagessen', cost: 50, desc: 'Pizza für das Team, bezahlt aus deinem Lob-Konto.' }
    ],
    badgeDefinitions: [
        { name: "Starter-Rucksack", threshold: 10, color: "#4caf50", desc: "10 Lobs sammeln", icon: "fa-walking" }
    ]
};

// --- DATENBANK LOGIK (ASYNCHRON) ---

async function loadDatabase() {
    if (!isDbConnected) {
        // Fallback-Modus (NUR LOKAL, NICHT persistent auf Render)
        try {
            // Wir benötigen 'fs' nur für den Fallback-Modus (lokales Laden)
            const fs = require('fs');
            const dbPath = path.join(__dirname, 'db.json');
            if (fs.existsSync(dbPath)) {
                const data = fs.readFileSync(dbPath, 'utf8');
                db = JSON.parse(data);
                console.log('✓ Fallback: db.json lokal geladen.');
            } else {
                db = DEFAULT_DB;
            }
        } catch (e) {
            console.error('! FEHLER beim Fallback-Laden:', e.message);
            db = DEFAULT_DB;
        }
        return;
    }

    // Firestore-Modus (PERSISTENT)
    try {
        const docRef = firestoreDb.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC_ID);
        const doc = await docRef.get(); // Ruft das Dokument ab

        if (doc.exists) {
            db = doc.data();
            console.log('✓ Datenbank erfolgreich aus Firestore geladen.');
        } else {
            console.log('! Dokument in Firestore nicht gefunden. Erstelle es mit Standarddaten.');
            db = DEFAULT_DB;
            await saveDatabase(DEFAULT_DB); // Speichere die Standarddaten initial
        }
    } catch (e) {
        console.error('! FEHLER beim Laden aus Firestore (nutze Standardwerte):', e.message);
        db = DEFAULT_DB;
    }


}

async function saveDatabase(data) {
    if (!isDbConnected) {
        console.log("! Speichern ignoriert: Datenbank nicht verbunden.");
        return;
    }

    try {
        const docRef = firestoreDb.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC_ID);
        // set() überschreibt das gesamte Dokument
        await docRef.set(data);
        console.log('✓ Änderungen erfolgreich in Firestore gespeichert.');
    } catch (e) {
        console.error('! FEHLER beim Speichern in Firestore:', e.message);
    }


}

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// --- API ROUTES (Umstellung auf asynchrone DB-Operationen) ---

// Gibt die Datenbank zurück
app.get('/db', (req, res) => {
    // Gibt den aktuellen In-Memory-Cache zurück
    if (db) {
        res.json(db);
    } else {
        res.status(503).send({ success: false, message: 'Server wird initialisiert...' });
    }
});

// Empfängt Updates und speichert sie
app.post('/update', async (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).send({ success: false, message: 'Keine Daten' });
    }

    db = req.body; // Lokalen Cache aktualisieren
    await saveDatabase(db); // Asynchron in Firestore speichern

    res.status(200).send({ success: true });


});

// Startseite ausliefern
app.get('/', (req, res) => {
    // Sende die index.html. Wir brauchen hierfür das 'fs' Modul.
    const fs = require('fs');
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send('<h1>Server läuft!</h1><p>index.html nicht gefunden.</p>');
    }
});

// --- SERVER START ---

async function startServer() {
    console.log("4. Lade Daten aus Firestore (Warte auf Verbindung)...");
    await loadDatabase(); // Warte auf das Laden der Daten

    console.log("5. Versuche Port zu binden...");

    // DIESER TEIL startet den Server und bindet den Port
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n==================================================`);
        console.log(`🚀 SERVER LÄUFT ERFOLGREICH! (Modus: ${isDbConnected ? 'FIREBASE' : 'LOKAL (KEINE PERSISTENZ)'})`);
        console.log(`🌍 URL: ${PORT}`);
        console.log(`==================================================\n`);
    });

    server.on('error', (e) => {
        console.error("!!! SERVER START FEHLER:", e.message);
    });


}

startServer();
