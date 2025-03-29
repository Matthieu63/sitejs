const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Créer le dossier data s'il n'existe pas
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Définir les chemins des bases de données
const VOCAB_DB = path.join(dataDir, 'vocab.db');
const DIALOGUE_DB = path.join(dataDir, 'dialogue.db');
const STORIES_DB = path.join(dataDir, 'stories.db');

// Fonction pour obtenir une connexion à la base de données
function getDB(dbPath) {
  return new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error(`Erreur de connexion à la base de données ${dbPath}:`, err.message);
    } else {
      console.log(`Connecté à la base de données ${dbPath}`);
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

// Initialiser la base de données de vocabulaire
function initVocabDB() {
  const db = getDB(VOCAB_DB);
  
  // Créer les tables si elles n'existent pas
  const createWordsTable = `
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT,
      synthese TEXT,
      youglish TEXT,
      note INTEGER,
      tags TEXT,
      image TEXT,
      exemples TEXT DEFAULT ''
    )
  `;
  
  const createTagsTable = `
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE
    )
  `;
  
  db.serialize(() => {
    db.run(createWordsTable);
    db.run(createTagsTable);
  });
  
  db.close();
}

// Initialiser la base de données de dialogues
function initDialoguesDB() {
  const db = getDB(DIALOGUE_DB);
  
  // Créer les tables si elles n'existent pas
  const createFilesTable = `
    CREATE TABLE IF NOT EXISTS dialogues_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      upload_date TEXT
    )
  `;
  
  const createDialoguesTable = `
    CREATE TABLE IF NOT EXISTS dialogues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER,
      dialogue_number INTEGER,
      personne_a TEXT,
      personne_b TEXT,
      FOREIGN KEY(file_id) REFERENCES dialogues_files(id)
    )
  `;
  
  db.serialize(() => {
    db.run(createFilesTable);
    db.run(createDialoguesTable);
  });
  
  db.close();
}

// Initialiser la base de données d'histoires
function initStoriesDB() {
  const db = getDB(STORIES_DB);
  
  // Créer les tables si elles n'existent pas
  const createStoriesTable = `
    CREATE TABLE IF NOT EXISTS stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      rating INTEGER,
      tags TEXT,
      theme TEXT,
      creation_date TEXT,
      words_used TEXT
    )
  `;
  
  const createDialoguesTable = `
    CREATE TABLE IF NOT EXISTS dialogues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id INTEGER,
      dialogue_number INTEGER,
      personne_a TEXT,
      personne_b TEXT,
      FOREIGN KEY(story_id) REFERENCES stories(id)
    )
  `;
  
  db.serialize(() => {
    db.run(createStoriesTable);
    db.run(createDialoguesTable);
  });
  
  db.close();
}

// Initialiser toutes les bases de données
function initAllDatabases() {
  initVocabDB();
  initDialoguesDB();
  initStoriesDB();
  console.log('Toutes les bases de données ont été initialisées');
}

// Exporter les fonctions et constantes
module.exports = {
  VOCAB_DB,
  DIALOGUE_DB,
  STORIES_DB,
  getDB,
  runQuery,
  getAllRows,
  getRow,
  initVocabDB,
  initDialoguesDB,
  initStoriesDB,
  initAllDatabases
};