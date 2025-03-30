// config/db.js
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("La variable d'environnement MONGODB_URI n'est pas définie.");
}

const client = new MongoClient(uri);

async function connect() {
  if (!client.isConnected()) {
    await client.connect();
  }
  // Remplacez 'polyglot' par le nom de votre base de données si besoin
  return client.db('polyglot');
}

module.exports = { connect, client };
