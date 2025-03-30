// config/db.js
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("La variable d'environnement MONGODB_URI n'est pas définie.");
}

// Ajoutez l'option tlsAllowInvalidCertificates pour contourner temporairement les erreurs TLS
const client = new MongoClient(uri, { useUnifiedTopology: true, tlsAllowInvalidCertificates: true });
let dbInstance = null;

async function connect() {
  if (dbInstance) return dbInstance;
  await client.connect();
  dbInstance = client.db('polyglot'); // Assurez-vous que 'polyglot' correspond au nom de votre base
  console.log("Connecté à MongoDB");
  return dbInstance;
}

module.exports = { connect, client };
