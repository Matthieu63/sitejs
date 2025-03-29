const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Créer le dossier data s'il n'existe pas
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Définir le chemin de la base de données unique
const DB_PATH = path.join(dataDir, 'polyglot.db');

// Fonction pour obtenir une connexion à la base de données
function getDB() {
  return new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error(`Erreur de connexion à la base de données ${DB_PATH}:`, err.message);
    } else {
      console.log(`Connecté à la base de données ${DB_PATH}`);
    }
  });
}

// Fonction pour exécuter une requête SQL
function runQuery(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

// Fonction pour récupérer tous les résultats d'une requête
function getAllRows(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Fonction pour récupérer une seule ligne
function getRow(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// Initialiser la base de données
function initDatabase() {
  const db = getDB();
  
  // Créer les tables pour le vocabulaire
  const createWordsTable = `
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      word TEXT,
      synthese TEXT,
      youglish TEXT,
      note INTEGER,
      tags TEXT,
      image TEXT,
      exemples TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `;
  
  const createTagsTable = `
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT,
      UNIQUE(user_id, name)
    )
  `;
  
  // Créer les tables pour les dialogues
  const createDialoguesFilesTable = `
    CREATE TABLE IF NOT EXISTS dialogues_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      filename TEXT,
      upload_date TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `;
  
  const createDialoguesTable = `
    CREATE TABLE IF NOT EXISTS dialogues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER,
      dialogue_number INTEGER,
      personne_a TEXT,
      personne_b TEXT,
      FOREIGN KEY(file_id) REFERENCES dialogues_files(id) ON DELETE CASCADE
    )
  `;
  
  // Créer les tables pour les histoires
  const createStoriesTable = `
    CREATE TABLE IF NOT EXISTS stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      title TEXT,
      rating INTEGER,
      tags TEXT,
      theme TEXT,
      creation_date TEXT,
      words_used TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `;
  
  const createStoriesDialoguesTable = `
    CREATE TABLE IF NOT EXISTS stories_dialogues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id INTEGER,
      dialogue_number INTEGER,
      personne_a TEXT,
      personne_b TEXT,
      FOREIGN KEY(story_id) REFERENCES stories(id) ON DELETE CASCADE
    )
  `;
  
  // Table de progression de l'utilisateur
  const createUserProgressTable = `
    CREATE TABLE IF NOT EXISTS user_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      language TEXT NOT NULL,
      module TEXT NOT NULL,
      progress REAL DEFAULT 0,
      last_activity TEXT,
      stats TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(user_id, language, module)
    )
  `;
  
  db.serialize(() => {
    // Initialiser les tables de vocabulaire
    db.run(createWordsTable);
    db.run(createTagsTable);
    
    // Initialiser les tables de dialogues
    db.run(createDialoguesFilesTable);
    db.run(createDialoguesTable);
    
    // Initialiser les tables d'histoires
    db.run(createStoriesTable);
    db.run(createStoriesDialoguesTable);
    
    // Initialiser la table de progression
    db.run(createUserProgressTable);
    
    console.log('Toutes les tables ont été initialisées dans la base de données');
  });
  
  db.close();
}

// Exporter les fonctions et constantes
module.exports = {
  DB_PATH,
  getDB,
  runQuery,
  getAllRows,
  getRow,
  initDatabase
};