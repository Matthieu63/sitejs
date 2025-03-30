// test.js
const { connect } = require('./config/db');

async function testConnection() {
  try {
    const db = await connect();
    console.log("Connexion à MongoDB réussie !");
    process.exit(0);
  } catch (err) {
    console.error("Erreur lors de la connexion à MongoDB :", err);
    process.exit(1);
  }
}

testConnection();
