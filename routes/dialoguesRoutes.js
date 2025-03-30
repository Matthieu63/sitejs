const express = require('express');
const router = express.Router();
const DialoguePg = require('../models/DialoguePg');
const UserProgress = require('../models/UserProgress');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration de multer pour les téléchargements de PDF
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'pdfs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const pdfUpload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limite de 10MB
  fileFilter: (req, file, cb) => {
    // Vérifier que c'est bien un PDF
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers PDF sont autorisés'), false);
    }
  }
});

// Middleware pour vérifier si l'utilisateur est connecté
function isLoggedIn(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

// Page d'index des dialogues
router.get('/', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    
    // Récupérer tous les fichiers de dialogues de l'utilisateur
    const files = await DialoguePg.getAllFiles(userId);
    
    // Récupérer la progression de l'utilisateur
    const progress = await UserProgress.getProgress(userId, 'espagnol', 'dialogues');
    
    // Mettre à jour l'activité de l'utilisateur
    await UserProgress.updateProgress(userId, 'espagnol', 'dialogues', {
      activity: {
        type: 'view',
        details: 'Consultation de la liste des dialogues'
      }
    });
    
    // Récupérer les messages flash si disponibles
    const messages = req.flash ? req.flash() : [];
    
    res.render('espagnol/dialogues_index', { files, progress, messages });
  } catch (error) {
    console.error('Erreur lors de l\'affichage des dialogues:', error);
    if (req.flash) {
      req.flash('error', 'Erreur lors du chargement des dialogues');
    }
    res.status(500).render('error', { message: 'Erreur serveur', error });
  }
});

// Page pour afficher un fichier de dialogues spécifique
router.get('/view/:fileId', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const fileId = req.params.fileId;
    
    // Récupérer le fichier de dialogues
    const file = await DialoguePg.getFileById(fileId, userId);
    if (!file) {
      if (req.flash) {
        req.flash('error', 'Fichier de dialogues non trouvé');
      }
      return res.redirect('/espagnol/dialogues');
    }
    
    // Récupérer les dialogues associés
    const dialogues = await DialoguePg.getDialoguesByFileId(fileId, userId);
    
    // Mettre à jour l'activité de l'utilisateur
    await UserProgress.updateProgress(userId, 'espagnol', 'dialogues', {
      activity: {
        type: 'read',
        details: `Consultation des dialogues du fichier "${file.filename}"`
      }
    });
    
    // Récupérer les messages flash si disponibles
    const messages = req.flash ? req.flash() : [];
    
    res.render('espagnol/dialogues_view', { file, dialogues, messages });
  } catch (error) {
    console.error('Erreur lors de l\'affichage des dialogues:', error);
    if (req.flash) {
      req.flash('error', 'Erreur lors du chargement des dialogues');
    }
    res.status(500).render('error', { message: 'Erreur serveur', error });
  }
});

// Page pour générer des dialogues à partir d'une vidéo YouTube
router.get('/youtube', isLoggedIn, (req, res) => {
  const messages = req.flash ? req.flash() : [];
  res.render('espagnol/youtube_dialogues', { messages });
});

// Traitement du formulaire YouTube
router.post('/youtube', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const { youtube_url } = req.body;
    
    if (!youtube_url) {
      if (req.flash) {
        req.flash('error', 'URL YouTube requise');
      }
      return res.redirect('/espagnol/dialogues/youtube');
    }
    
    // Générer des dialogues à partir de l'URL YouTube
    const result = await DialoguePg.processAndGenerateDialoguesFromYouTube(youtube_url, userId);
    
    if (result.status === 'success') {
      // Mettre à jour la progression de l'utilisateur
      await UserProgress.updateProgress(userId, 'espagnol', 'dialogues', {
        activity: {
          type: 'create',
          details: `Génération de dialogues à partir de YouTube`
        }
      });
      
      if (req.flash) {
        req.flash('success', 'Dialogues générés avec succès');
      }
      return res.redirect(`/espagnol/dialogues/view/${result.fileId}`);
    } else {
      throw new Error(result.message || 'Erreur lors de la génération des dialogues');
    }
  } catch (error) {
    console.error('Erreur lors de la génération des dialogues depuis YouTube:', error);
    if (req.flash) {
      req.flash('error', `Erreur: ${error.message}`);
    }
    res.redirect('/espagnol/dialogues/youtube');
  }
});

// Traitement du téléchargement de PDF
router.post('/', isLoggedIn, pdfUpload.single('pdf_file'), async (req, res) => {
  try {
    const userId = req.session.user;
    
    if (!req.file) {
      if (req.flash) {
        req.flash('error', 'Fichier PDF requis');
      }
      return res.redirect('/espagnol/dialogues');
    }
    
    const filePath = req.file.path;
    const originalFilename = req.file.originalname;
    
    // Traiter le PDF et générer des dialogues
    const result = await DialoguePg.processAndGenerateDialoguesFromPDF(filePath, userId, originalFilename);
    
    if (result.status === 'success') {
      // Mettre à jour la progression de l'utilisateur
      await UserProgress.updateProgress(userId, 'espagnol', 'dialogues', {
        activity: {
          type: 'create',
          details: `Génération de dialogues à partir du PDF "${originalFilename}"`
        }
      });
      
      if (req.flash) {
        req.flash('success', 'Dialogues générés avec succès');
      }
      return res.redirect(`/espagnol/dialogues/view/${result.fileId}`);
    } else {
      throw new Error(result.message || 'Erreur lors de la génération des dialogues');
    }
  } catch (error) {
    console.error('Erreur lors du traitement du PDF:', error);
    if (req.flash) {
      req.flash('error', `Erreur: ${error.message}`);
    }
    res.redirect('/espagnol/dialogues');
  }
});

// API pour la synthèse vocale avec Polly (Amazon)
router.post('/api/polly', isLoggedIn, async (req, res) => {
  try {
    const { text, voice, language } = req.body;
    
    // Cette route devrait être implémentée avec le SDK AWS pour Polly
    // Pour cet exemple, nous simulons une réponse
    res.status(200).send('Audio simulé');
  } catch (error) {
    console.error('Erreur Polly:', error);
    res.status(500).json({ error: 'Erreur lors de la synthèse vocale' });
  }
});

// API pour récupérer les voix disponibles
router.get('/api/polly/voices', isLoggedIn, async (req, res) => {
  try {
    const { language } = req.query;
    
    // Cette route devrait être implémentée avec le SDK AWS pour Polly
    // Pour cet exemple, nous renvoyons des données simulées
    const voices = [
      { id: 'Enrique', name: 'Enrique', gender: 'Male' },
      { id: 'Lucia', name: 'Lucia', gender: 'Female' }
    ];
    
    res.json(voices);
  } catch (error) {
    console.error('Erreur lors de la récupération des voix:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// API pour la sauvegarde des préférences de voix
router.post('/api/voice-settings', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const { voice_a, voice_b } = req.body;
    
    // Ici, vous pourriez sauvegarder ces préférences dans la base de données
    
    res.json({ status: 'success' });
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des préférences de voix:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// API pour récupérer les préférences de voix
router.get('/api/voice-settings', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    
    // Ici, vous pourriez récupérer ces préférences depuis la base de données
    // Pour cet exemple, nous renvoyons des valeurs par défaut
    res.json({
      voice_a: 'Enrique',
      voice_b: 'Lucia'
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des préférences de voix:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;