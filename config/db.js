// config/db.js - version simplifiée qui redirige vers postgres
console.warn("Le module db.js est déprécié, utilisez postgres.js à la place");
module.exports = require('./postgres');