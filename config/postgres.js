// config/postgres.js
const { Pool } = require('pg');

// Heroku fournit automatiquement la variable DATABASE_URL
const connectionString = process.env.DATABASE_URL;

// Configurer SSL pour Heroku
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Nécessaire pour Heroku
  }
});

// Test de connexion
pool.connect()
  .then(() => console.log('Connecté à PostgreSQL'))
  .catch(err => console.error('Erreur de connexion à PostgreSQL:', err));

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};