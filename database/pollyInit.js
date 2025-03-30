const AWS = require('aws-sdk');

// Initialisation de Polly avec les variables d'environnement
const polly = new AWS.Polly({
  region: 'eu-west-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

// ✅ Middleware pour vérifier l'initialisation
function checkPollyClient(req, res, next) {
  if (!polly) {
    return res.status(500).json({ error: 'Polly non initialisé.' });
  }
  next();
}

// ✅ Liste des voix disponibles
async function getVoices(req, res) {
  try {
    const { language = 'es-ES' } = req.query;
    const data = await polly.describeVoices({ LanguageCode: language }).promise();

    const voices = data.Voices.map(v => ({
      id: v.Id,
      name: v.Name,
      gender: v.Gender,
      language: v.LanguageName
    }));

    res.json(voices);
  } catch (error) {
    console.error('Erreur getVoices:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des voix.' });
  }
}

// ✅ Synthèse vocale POST /polly
async function speakText(req, res) {
  try {
    const { text, voice = 'Lucia', language = 'es-ES' } = req.body;

    const params = {
      Text: text,
      OutputFormat: 'mp3',
      VoiceId: voice,
      LanguageCode: language
    };

    const result = await polly.synthesizeSpeech(params).promise();
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': result.AudioStream.length
    });

    res.send(result.AudioStream);
  } catch (error) {
    console.error('Erreur synthèse vocale:', error);
    res.status(500).json({ error: 'Erreur lors de la synthèse vocale.' });
  }
}

module.exports = {
  checkPollyClient,
  getVoices,
  speakText
};
