const db = require('../config/database');

console.log('Initialisation de la base de données...');

// Initialiser la base de données unique
db.initDatabase();

console.log('Initialisation terminée avec succès.');
console.log(`La base de données a été créée ou mise à jour: ${db.DB_PATH}`);
console.log(`Cette base de données contient maintenant les tables pour:`);
console.log('- Vocabulaire (words, tags)');
console.log('- Dialogues (dialogues_files, dialogues)');
console.log('- Histoires (stories, stories_dialogues)');