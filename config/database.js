// config/database.js - version temporaire pour la migration
console.warn("Le module database.js est déprécié, utilisez postgres.js à la place");

// Rediriger vers postgres pour la connexion
const postgres = require('./postgres');

// Fonctions stub pour émuler l'interface SQLite
module.exports = {
  DB_PATH: '/app/data/polyglot.db',
  
  getDB: () => {
    console.warn("Appel de getDB() déprécié");
    return {
      run: (query, params, callback) => {
        if (callback) callback(null, { lastID: 0, changes: 0 });
        return { lastID: 0, changes: 0 };
      },
      all: (query, params, callback) => {
        if (callback) callback(null, []);
        return [];
      },
      get: (query, params, callback) => {
        if (callback) callback(null, {});
        return {};
      },
      close: () => {}
    };
  },
  
  runQuery: async () => ({ lastID: 0, changes: 0 }),
  getAllRows: async () => [],
  getRow: async () => ({}),
  
  initDatabase: () => {
    console.warn("Initialisation de la base de données SQLite ignorée, PostgreSQL est utilisé à la place");
  }
};