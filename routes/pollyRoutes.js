const express = require('express');
const router = express.Router();
const polly = require('../database/pollyInit'); // ton nouveau fichier centralisé

// Middleware auth si nécessaire
function isLoggedIn(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  next();
}

// ✅ Synthèse vocale via POST
router.post('/polly', isLoggedIn, polly.checkPollyClient, polly.speakText);

// ✅ Liste des voix
router.get('/voices', isLoggedIn, polly.checkPollyClient, polly.getVoices);

// ✅ Réglages voix
router.get('/voice-settings', isLoggedIn, (req, res) => {
  res.json({
    defaultVoiceId: 'Lucia',
    languageCode: 'es-ES'
  });
});

router.get('/voice-settings/default', isLoggedIn, (req, res) => {
  res.json({ voiceId: 'Lucia' });
});

module.exports = router;
