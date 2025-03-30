// config/db.js
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("La variable d'environnement MONGODB_URI n'est pas définie.");
}

const client = new MongoClient(uri, { useUnifiedTopology: true });
let dbInstance = null;

async function connect() {
  if (dbInstance) return dbInstance;
  await client.connect();
  dbInstance = client.db('polyglot'); // Remplacez 'polyglot' par le nom de votre base de données
  console.log("Connecté à MongoDB");
  return dbInstance;
}

module.exports = { connect, client };
