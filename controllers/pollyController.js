const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configuration AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'eu-west-1'
});

// Créer le client Polly
let pollyClient;
try {
  pollyClient = new AWS.Polly({
    apiVersion: '2016-06-10'
  });
  console.log('AWS Polly client initialized successfully.');
} catch (error) {
  console.error('Failed to initialize AWS Polly client:', error);
}

// Voix disponibles par langue
const AVAILABLE_VOICES = {
  'es-ES': ['Lucia', 'Enrique', 'Conchita', 'Sergio'],
  'fr-FR': ['Léa', 'Mathieu', 'Céline'],
  'en-US': ['Joanna', 'Matthew', 'Salli', 'Joey'],
  'pt-BR': ['Camila', 'Ricardo', 'Vitória']
};

// Configuration des moteurs par voix
const VOICE_ENGINE_MAP = {
  "Lucia": "neural",     // Lucia fonctionne mieux avec neural
  "Enrique": "standard", // Enrique avec standard
  "Sergio": "neural",    // Sergio nécessite neural
  "Conchita": "standard", // Conchita avec standard
  "Léa": "neural",
  "Mathieu": "standard",
  "Céline": "standard",
  "Joanna": "neural",
  "Matthew": "neural",
  "Salli": "neural",
  "Joey": "standard",
  "Camila": "neural",
  "Ricardo": "standard",
  "Vitória": "standard"
};

// Vérifier si Polly est initialisé
function checkPollyClient(req, res, next) {
  if (!pollyClient) {
    return res.status(500).json({ error: 'AWS Polly client not initialized' });
  }
  next();
}

// Synthétiser la parole
async function synthesizeSpeech(req, res) {
  try {
    const data = req.body;
    
    if (!data || !data.text) {
      return res.status(400).json({ error: 'Missing text parameter' });
    }
    
    const text = data.text;
    if (!text.trim()) {
      return res.status(400).json({ error: 'Empty text parameter' });
    }
    
    // Paramètres configurables
    const voiceId = data.voice || 'Lucia';  // Lucia pour l'espagnol par défaut
    const languageCode = data.language || 'es-ES';
    
    console.log(`Synthesizing speech for text: ${text.substring(0, 50)}... with voice: ${voiceId}`);
    
    // Obtenir le moteur approprié pour cette voix
    const engine = VOICE_ENGINE_MAP[voiceId] || "standard";
    
    console.log(`Utilisation du moteur '${engine}' pour la voix '${voiceId}'`);
    
    // Paramètres pour la synthèse vocale
    const params = {
      Text: text,
      OutputFormat: 'mp3',
      VoiceId: voiceId,
      LanguageCode: languageCode,
      Engine: engine
    };
    
    try {
      // Essayer avec le moteur spécifié
      const data = await pollyClient.synthesizeSpeech(params).promise();
      
      // Créer une réponse MP3
      res.set('Content-Type', 'audio/mpeg');
      res.set('Content-Disposition', 'attachment; filename=speech.mp3');
      res.send(data.AudioStream);
    } catch (e) {
      console.error(`Error with ${engine} engine:`, e);
      
      // Si cela échoue, essayer avec l'autre moteur
      try {
        const fallbackEngine = engine === "standard" ? "neural" : "standard";
        console.log(`Tentative avec moteur de secours '${fallbackEngine}'`);
        
        params.Engine = fallbackEngine;
        const data = await pollyClient.synthesizeSpeech(params).promise();
        
        res.set('Content-Type', 'audio/mpeg');
        res.set('Content-Disposition', 'attachment; filename=speech.mp3');
        res.send(data.AudioStream);
      } catch (nestedErr) {
        console.error(`Error with fallback engine:`, nestedErr);
        throw nestedErr;
      }
    }
  } catch (error) {
    console.error('Error in speech synthesis:', error);
    res.status(500).json({ error: error.message });
  }
}

// Récupérer la liste des voix disponibles
async function getVoices(req, res) {
  try {
    const language = req.query.language || 'es-ES';
    
    // Si la langue est dans notre dictionnaire prédéfini, utiliser ces voix
    if (AVAILABLE_VOICES[language]) {
      const voices = AVAILABLE_VOICES[language].map(voiceId => ({
        id: voiceId,
        name: voiceId,
        gender: ['Lucia', 'Conchita', 'Léa', 'Céline', 'Joanna', 'Salli', 'Camila', 'Vitória'].includes(voiceId) ? 'Female' : 'Male'
      }));
      
      return res.json(voices);
    }
    
    // Sinon, essayer de récupérer les voix depuis l'API AWS
    try {
      const response = await pollyClient.describeVoices({ LanguageCode: language }).promise();
      
      const voices = response.Voices.map(voice => ({
        id: voice.Id,
        name: voice.Name,
        gender: voice.Gender
      }));
      
      if (voices.length === 0) {
        // Si aucune voix n'est trouvée, utiliser les valeurs par défaut pour l'espagnol
        const defaultVoices = [
          { id: 'Lucia', name: 'Lucia', gender: 'Female' },
          { id: 'Enrique', name: 'Enrique', gender: 'Male' },
          { id: 'Conchita', name: 'Conchita', gender: 'Female' },
          { id: 'Sergio', name: 'Sergio', gender: 'Male' }
        ];
        
        console.warn(`No voices found for language ${language}, using defaults`);
        return res.json(defaultVoices);
      }
      
      res.json(voices);
    } catch (e) {
      console.error('Error calling describe_voices:', e);
      
      // En cas d'erreur, utiliser des voix par défaut
      const defaultVoices = [
        { id: 'Lucia', name: 'Lucia', gender: 'Female' },
        { id: 'Enrique', name: 'Enrique', gender: 'Male' },
        { id: 'Conchita', name: 'Conchita', gender: 'Female' },
        { id: 'Sergio', name: 'Sergio', gender: 'Male' }
      ];
      
      res.json(defaultVoices);
    }
  } catch (error) {
    console.error('Error in get_voices endpoint:', error);
    res.status(500).json({ error: error.message });
  }
}

// Simplifier l'API pour parler un texte
async function speakText(req, res) {
  // Cette fonction est identique à synthesizeSpeech, mais avec une interface plus simple
  return synthesizeSpeech(req, res);
}

module.exports = {
  checkPollyClient,
  synthesizeSpeech,
  getVoices,
  speakText
};