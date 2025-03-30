const express = require('express');
const router = express.Router();
const polly = require('../database/pollyInit');

// Middleware auth corrigé pour utiliser la bonne propriété de session
function isLoggedIn(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  next();
}

// Routes corrigées pour correspondre à ce qu'attend le frontend

// ✅ Synthèse vocale via POST
router.post('/polly', isLoggedIn, polly.checkPollyClient, polly.speakText);

// ✅ Liste des voix (accessible à /espagnol/api/polly/voices)
router.get('/polly/voices', isLoggedIn, polly.checkPollyClient, polly.getVoices);

// ✅ Réglages voix (accessible à /espagnol/api/voice-settings)
router.get('/voice-settings', isLoggedIn, (req, res) => {
  // Ajouter un log pour le débogage
  console.log('Requête reçue pour les réglages voix');
  
  res.json({
    voice_a: 'Enrique', // Voix par défaut pour personne A
    voice_b: 'Lucia',   // Voix par défaut pour personne B
    languageCode: 'es-ES'
  });
});

// Ancienne route qui peut être supprimée si elle n'est plus utilisée
router.get('/voice-settings/default', isLoggedIn, (req, res) => {
  res.json({ voiceId: 'Lucia' });
});

module.exports = router;