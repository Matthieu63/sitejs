const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Dossier contenant les bases utilisateurs
const USER_DB_FOLDER = path.join(__dirname, '../user-databases');

// Créer le dossier s’il n’existe pas
if (!fs.existsSync(USER_DB_FOLDER)) {
  fs.mkdirSync(USER_DB_FOLDER, { recursive: true });
}

// Obtenir le chemin vers la base d’un utilisateur
function getUserDBPath(username) {
  return path.join(USER_DB_FOLDER, `${username}.db`);
}

// Créer toutes les tables dans la base utilisateur
function initUserDatabase(username) {
  const dbPath = getUserDBPath(username);
  const db = new sqlite3.Database(dbPath);

  db.serialize(() => {
    // Table vocabulaire
    db.run(`CREATE TABLE IF NOT EXISTS mots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT,
      langue TEXT,
      synthese TEXT,
      youglish TEXT,
      image TEXT,
      tags TEXT,
      note INTEGER DEFAULT 0,
      exemples TEXT
    )`);

    // Table dialogues
    db.run(`CREATE TABLE IF NOT EXISTS dialogues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titre TEXT,
      langue TEXT,
      texte TEXT,
      audio TEXT,
      note INTEGER DEFAULT 0,
      tags TEXT
    )`);

    // Table histoires
    db.run(`CREATE TABLE IF NOT EXISTS stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titre TEXT,
      langue TEXT,
      contenu TEXT,
      audio TEXT,
      note INTEGER DEFAULT 0,
      tags TEXT
    )`);
  });

  db.close();
  console.log(`Base utilisateur ${username}.db initialisée`);
}

module.exports = {
  initUserDatabase,
  getUserDBPath
};
