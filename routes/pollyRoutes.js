const express = require('express');
const router = express.Router();
const polly = require('../database/pollyInit'); // ← middleware Polly

// Middleware pour vérifier si l'utilisateur est connecté
function isLoggedIn(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  next();
}

// Route pour parler un texte
router.post('/speak', isLoggedIn, polly.checkPollyClient, polly.speakText);

// Route pour obtenir les voix disponibles
router.get('/voices', isLoggedIn, polly.checkPollyClient, polly.getVoices);

module.exports = router;
