const express = require('express');
const router = express.Router();
const AWS = require('aws-sdk');

// Config AWS (tu peux aussi mettre ça dans un service séparé si tu préfères)
AWS.config.update({
  region: 'eu-west-1', // ajuste selon tes besoins
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const polly = new AWS.Polly();

// POST /espagnol/api/polly
router.post('/polly', async (req, res) => {
  const { text, voiceId } = req.body;

  const params = {
    Text: text,
    OutputFormat: 'mp3',
    VoiceId: voiceId || 'Lucia', // par défaut voix espagnole
    TextType: 'text'
  };

  try {
    const data = await polly.synthesizeSpeech(params).promise();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(data.AudioStream);
  } catch (err) {
    console.error('Erreur avec Polly:', err);
    res.status(500).send('Erreur lors de la synthèse vocale');
  }
});

// GET /espagnol/api/voices
router.get('/voices', async (req, res) => {
  const languageCode = req.query.language || 'es-ES';
  const params = { LanguageCode: languageCode };

  try {
    const result = await polly.describeVoices(params).promise();
    res.json(result.Voices);
  } catch (err) {
    console.error('Erreur lors de la récupération des voix:', err);
    res.status(500).json({ error: 'Impossible de récupérer les voix' });
  }
});

// GET /espagnol/api/voice-settings
router.get('/voice-settings', (req, res) => {
  res.json({
    defaultVoiceId: 'Lucia',
    languageCode: 'es-ES'
  });
});

module.exports = router;
