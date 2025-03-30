// config/postgres.js
const { Pool } = require('pg');

// Créer une connexion à partir des variables d'environnement ou des valeurs par défaut
const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'polyglot',
  password: process.env.PGPASSWORD || 'postgres',
  port: process.env.PGPORT || 5432,
});

pool.on('error', (err, client) => {
  console.error('Erreur inattendue sur le client PostgreSQL', err);
  process.exit(-1);
});

// Wrapper pour exécuter des requêtes
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Requête exécutée', { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    console.error('Erreur lors de l\'exécution de la requête', { text, error: err });
    throw err;
  }
};

// Fonction pour obtenir un client du pool
const getClient = async () => {
  const client = await pool.connect();
  return client;
};

module.exports = {
  query,
  getClient,
  pool
};