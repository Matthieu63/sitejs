// models/UserProgress.js

// Cette fonction renvoie toujours une progression par défaut.
module.exports.getProgress = async function(userId, language, moduleName) {
  return { progress: 0, details: "Aucune progression gérée" };
};

// Cette fonction ne fait rien de particulier.
module.exports.updateProgress = async function(userId, language, moduleName, data) {
  // Pas d'action effectuée, car nous ne gérons pas la progression.
  return;
};
