// config/db.js
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("La variable d'environnement MONGODB_URI n'est pas définie.");
}

// Configuration améliorée pour résoudre les problèmes TLS
const client = new MongoClient(uri, {
  useUnifiedTopology: true,
  tls: true,
  serverSelectionTimeoutMS: 5000,  // Timeout de sélection du serveur à 5 secondes
  connectTimeoutMS: 10000,         // Timeout de connexion à 10 secondes
  socketTimeoutMS: 45000           // Timeout de socket à 45 secondes
});
let dbInstance = null;

async function connect() {
  if (dbInstance) return dbInstance;
  try {
    await client.connect();
    dbInstance = client.db('polyglot'); // Le nom de la base doit correspondre à celui dans l'URI
    console.log("Connecté à MongoDB");
    return dbInstance;
  } catch (error) {
    console.error("Erreur de connexion à MongoDB:", error);
    throw error;
  }
}

module.exports = { connect, client };