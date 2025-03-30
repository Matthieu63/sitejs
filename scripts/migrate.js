// scripts/migrate.js
const db = require('../config/postgres');

async function createTables() {
  try {
    // Créer la table words
    await db.query(`
      CREATE TABLE IF NOT EXISTS words (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        word TEXT,
        synthese TEXT,
        youglish TEXT,
        note INTEGER,
        tags TEXT,
        image TEXT,
        exemples TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Créer la table tags
    await db.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT,
        UNIQUE(user_id, name)
      )
    `);
    
    // Tables pour dialogues
    await db.query(`
      CREATE TABLE IF NOT EXISTS dialogues_files (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        filename TEXT,
        upload_date TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS dialogues (
        id SERIAL PRIMARY KEY,
        file_id INTEGER,
        dialogue_number INTEGER,
        personne_a TEXT,
        personne_b TEXT,
        FOREIGN KEY(file_id) REFERENCES dialogues_files(id) ON DELETE CASCADE
      )
    `);
    
    // Tables pour histoires
    await db.query(`
      CREATE TABLE IF NOT EXISTS stories (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT,
        rating INTEGER,
        tags TEXT,
        theme TEXT,
        creation_date TEXT,
        words_used TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS stories_dialogues (
        id SERIAL PRIMARY KEY,
        story_id INTEGER,
        dialogue_number INTEGER,
        personne_a TEXT,
        personne_b TEXT,
        FOREIGN KEY(story_id) REFERENCES stories(id) ON DELETE CASCADE
      )
    `);
    
    // Table progression
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_progress (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        language TEXT NOT NULL,
        module TEXT NOT NULL,
        progress REAL DEFAULT 0,
        last_activity TEXT,
        stats TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, language, module)
      )
    `);
    
    console.log('Toutes les tables ont été créées avec succès');
  } catch (error) {
    console.error('Erreur lors de la création des tables:', error);
  } finally {
    // Fermer le pool à la fin du script
    db.pool.end();
  }
}

createTables();