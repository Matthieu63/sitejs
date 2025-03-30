// models/utils.js
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

// Chemin vers la base de données
const DATABASE_PATH = path.join(__dirname, '../data/polyglot.db');

// Fonction pour obtenir une connexion à la base de données
async function getDbConnection() {
  return open({
    filename: DATABASE_PATH,
    driver: sqlite3.Database
  });
}

// Initialisation de la base de données
async function initDb() {
  console.log('[INFO] Initialisation de la base de données générale...');
  const db = await getDbConnection();
  
  try {
    // Créer la table user_progress si elle n'existe pas
    await db.exec(`
      CREATE TABLE IF NOT EXISTS user_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        language TEXT NOT NULL,
        module TEXT NOT NULL,
        progress REAL DEFAULT 0,
        stats TEXT,
        activity TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT,
        UNIQUE(user_id, language, module)
      )
    `);
    
    console.log('[INFO] Structure de la base de données vérifiée avec succès');
  } catch (error) {
    console.error('[ERROR] Erreur lors de l\'initialisation de la base de données:', error);
  } finally {
    await db.close();
  }
}

module.exports = {
  getDbConnection,
  initDb
};