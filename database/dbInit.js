// dbInit.js
const { initVocabDB, initDialoguesDB, initStoriesDB } = require('../routes/authRoutes');

function initAllDatabases() {
  initVocabDB();
  initDialoguesDB();
  initStoriesDB();
  console.log("Toutes les tables ont été initialisées dans la base de données");
}

module.exports = {
  initAllDatabases
};
