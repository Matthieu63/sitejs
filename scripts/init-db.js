// database/dbInit.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Fichiers de base de données
const VOCAB_DB = path.join(__dirname, '../polyglot-node/db/vocabulaire.db');
const DIALOGUE_DB = path.join(__dirname, '../polyglot-node/db/dialogues.db');
const STORIES_DB = path.join(__dirname, '../polyglot-node/db/stories.db');

function initVocabDB() {
  const db = new sqlite3.Database(VOCAB_DB);
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS mots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT,
      synthese TEXT,
      youglish TEXT,
      image TEXT,
      tags TEXT,
      note INTEGER DEFAULT 0,
      exemples TEXT,
      user TEXT
    )`);
  });
  db.close();
}

function initDialoguesDB() {
  const db = new sqlite3.Database(DIALOGUE_DB);
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS dialogues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titre TEXT,
      texte TEXT,
      audio TEXT,
      note INTEGER DEFAULT 0,
      tags TEXT,
      user TEXT
    )`);
  });
  db.close();
}

function initStoriesDB() {
  const db = new sqlite3.Database(STORIES_DB);
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titre TEXT,
      contenu TEXT,
      audio TEXT,
      note INTEGER DEFAULT 0,
      tags TEXT,
      user TEXT
    )`);
  });
  db.close();
}

function initAllDatabases() {
  initVocabDB();
  initDialoguesDB();
  initStoriesDB();
  console.log("Toutes les tables ont été initialisées dans la base de données");
}

module.exports = {
  initAllDatabases
};
