const express = require('express');
const router = express.Router();
const pollyController = require('../controllers/pollyController');

// Middleware pour vérifier si l'utilisateur est connecté
function isLoggedIn(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  next();
}

// Route pour convertir du texte en parole avec Amazon Polly
router.post('/', isLoggedIn, pollyController.checkPollyClient, pollyController.synthesizeSpeech);

// Route pour récupérer la liste des voix disponibles
router.get('/voices', isLoggedIn, pollyController.checkPollyClient, pollyController.getVoices);

// Route simplifiée pour parler un texte
router.post('/speak', isLoggedIn, pollyController.checkPollyClient, pollyController.speakText);

module.exports = router;