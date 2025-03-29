const express = require('express');
const router = express.Router();
const Vocab = require('../models/Vocab');
const UserProgress = require('../models/UserProgress');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration de multer pour les téléchargements d'images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
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

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
  fileFilter: (req, file, cb) => {
    // Vérifier que c'est bien une image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'), false);
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

// Route principale pour afficher les mots
router.get('/', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    
    // Récupérer les paramètres de pagination et de filtrage
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filters = {
      tag: req.query.tag,
      rating: req.query.rating ? parseInt(req.query.rating) : null,
      search: req.query.search
    };
    
    // Récupérer les mots de l'utilisateur
    const result = await Vocab.getAllWords(userId, page, limit, filters);
    
    // Récupérer tous les tags de l'utilisateur pour le filtre
    const tags = await Vocab.getAllTags(userId);
    
    // Récupérer les statistiques de l'utilisateur
    const stats = await Vocab.getStats(userId);
    
    // Récupérer la progression de l'utilisateur
    const progress = await UserProgress.getProgress(userId, 'espagnol', 'vocabulaire');
    
    // Mettre à jour l'activité de l'utilisateur
    await UserProgress.updateProgress(userId, 'espagnol', 'vocabulaire', {
      activity: {
        type: 'view',
        details: 'Consultation de la liste de vocabulaire'
      }
    });
    
    // Rendre la vue avec les données
    res.render('espagnol/vocab', {
      words: result.words,
      pagination: result.pagination,
      tags,
      filters,
      stats,
      progress,
      currentUrl: req.originalUrl.split('?')[0]
    });
  } catch (error) {
    console.error('Erreur lors de l\'affichage des mots:', error);
    res.status(500).send('Erreur serveur');
  }
});

// Route pour afficher le formulaire d'ajout
router.get('/add', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    
    // Récupérer tous les tags de l'utilisateur pour le formulaire
    const tags = await Vocab.getAllTags(userId);
    
    res.render('espagnol/add_word', { tags });
  } catch (error) {
    console.error('Erreur lors de l\'affichage du formulaire d\'ajout:', error);
    res.status(500).send('Erreur serveur');
  }
});

// Route pour ajouter un nouveau mot
router.post('/add', isLoggedIn, upload.single('image'), async (req, res) => {
  try {
    const userId = req.session.user;
    
    // Préparer les données du mot
    const wordData = {
      word: req.body.word,
      synthese: req.body.synthese,
      youglish: req.body.youglish,
      tags: req.body.tags,
      note: 0, // Note par défaut
      force_add: req.body.force_add === 'true'
    };
    
    // Ajouter l'image si elle existe
    if (req.file) {
      wordData.image = `/uploads/${req.file.filename}`;
    } else if (req.body.image) {
      // Si l'image est envoyée en base64
      wordData.image = req.body.image;
    }
    
    // Si la synthèse automatique est activée
    if (!req.body.disable_auto_synthese && !wordData.synthese) {
      try {
        // Appeler une API pour générer la synthèse (à adapter selon votre besoin)
        // Par exemple, on pourrait utiliser l'API Claude ici
        // Simulation avec une synthèse simple
        wordData.synthese = `<p>Définition automatique du mot <strong>${wordData.word}</strong></p>`;
      } catch (apiError) {
        console.error('Erreur lors de la génération automatique de synthèse:', apiError);
      }
    }
    
    // Ajouter le mot
    const result = await Vocab.addWord(userId, wordData);
    
    // Si le mot a été ajouté avec succès, mettre à jour la progression de l'utilisateur
    if (result.status === 'success') {
      await UserProgress.updateProgress(userId, 'espagnol', 'vocabulaire', {
        progress: null, // Calculé automatiquement par le modèle
        stats: {
          completedItems: 1, // Incrémenter de 1
          lastAddedWord: wordData.word
        },
        activity: {
          type: 'add',
          details: `Ajout du mot "${wordData.word}"`
        }
      });
    }
    
    // Envoyer la réponse
    res.json(result);
  } catch (error) {
    console.error('Erreur lors de l\'ajout du mot:', error);
    res.status(500).json({ status: 'error', message: 'Erreur serveur' });
  }
});

// Route pour mettre à jour un mot
router.post('/update_word', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const { id, field, value } = req.body;
    
    if (!id || !field) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'ID et champ requis' 
      });
    }
    
    const result = await Vocab.updateWord(id, userId, field, value);
    
    // Si la mise à jour a réussi et que c'est une mise à jour de note, mettre à jour la progression
    if (result.status === 'success' && field === 'note') {
      await UserProgress.updateProgress(userId, 'espagnol', 'vocabulaire', {
        activity: {
          type: 'rate',
          details: `Note modifiée pour le mot ID ${id}: ${value}`
        }
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du mot:', error);
    res.status(500).json({ status: 'error', message: 'Erreur serveur' });
  }
});

// Route pour supprimer un mot
router.post('/delete', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'ID requis'
      });
    }
    
    // Récupérer le mot avant de le supprimer pour l'historique
    const word = await Vocab.getWordById(id, userId);
    
    const result = await Vocab.deleteWord(id, userId);
    
    // Mettre à jour la progression si la suppression a réussi
    if (result.status === 'success' && word) {
      await UserProgress.updateProgress(userId, 'espagnol', 'vocabulaire', {
        activity: {
          type: 'delete',
          details: `Suppression du mot "${word.word}"`
        }
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Erreur lors de la suppression du mot:', error);
    res.status(500).json({ status: 'error', message: 'Erreur serveur' });
  }
});

// Route pour mettre à jour la note d'un mot
router.post('/update_note', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const { id, note } = req.body;
    
    if (!id || note === undefined) {
      return res.status(400).json({
        status: 'error',
        message: 'ID et note requis'
      });
    }
    
    const result = await Vocab.updateWord(id, userId, 'note', note);
    
    // Mettre à jour la progression si la mise à jour a réussi
    if (result.status === 'success') {
      // Récupérer le mot pour l'historique
      const word = await Vocab.getWordById(id, userId);
      
      await UserProgress.updateProgress(userId, 'espagnol', 'vocabulaire', {
        activity: {
          type: 'rate',
          details: `Note ${note}/5 attribuée à "${word ? word.word : `ID ${id}`}"`
        }
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la note:', error);
    res.status(500).json({ status: 'error', message: 'Erreur serveur' });
  }
});

// Route pour vérifier si un mot existe déjà
router.post('/check_duplicate', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const { word } = req.body;
    
    if (!word) {
      return res.status(400).json({
        status: 'error',
        message: 'Mot requis'
      });
    }
    
    const result = await Vocab.checkDuplicate(word, userId);
    res.json(result);
  } catch (error) {
    console.error('Erreur lors de la vérification de doublon:', error);
    res.status(500).json({ status: 'error', message: 'Erreur serveur' });
  }
});

// Route pour vérifier les doublons en masse
router.post('/check_duplicates_bulk', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const { words } = req.body;
    
    if (!words || !Array.isArray(words)) {
      return res.status(400).json({
        status: 'error',
        message: 'Liste de mots requise'
      });
    }
    
    const result = await Vocab.checkDuplicatesBulk(words, userId);
    res.json(result);
  } catch (error) {
    console.error('Erreur lors de la vérification des doublons en masse:', error);
    res.status(500).json({ status: 'error', message: 'Erreur serveur' });
  }
});

// Route pour ajouter des mots en masse
router.post('/add_bulk', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const { words, tags, force_add } = req.body;
    
    if (!words || !Array.isArray(words)) {
      return res.status(400).json({
        status: 'error',
        message: 'Liste de mots requise'
      });
    }
    
    const results = {
      success: [],
      errors: []
    };
    
    for (const word of words) {
      try {
        const wordData = {
          word: word,
          tags: tags || '',
          note: 0,
          force_add: force_add === true
        };
        
        const result = await Vocab.addWord(userId, wordData);
        
        if (result.status === 'success') {
          results.success.push(word);
        } else {
          results.errors.push({ word, reason: result.message });
        }
      } catch (error) {
        results.errors.push({ word, reason: 'Erreur interne' });
      }
    }
    
    // Mettre à jour la progression de l'utilisateur
    if (results.success.length > 0) {
      await UserProgress.updateProgress(userId, 'espagnol', 'vocabulaire', {
        stats: {
          completedItems: results.success.length, // Ajouter le nombre de mots ajoutés
          bulkAddCount: results.success.length
        },
        activity: {
          type: 'bulk_add',
          details: `Ajout de ${results.success.length} mots en masse`
        }
      });
    }
    
    res.json({
      status: 'completed',
      added: results.success.length,
      failed: results.errors.length,
      results
    });
  } catch (error) {
    console.error('Erreur lors de l\'ajout en masse:', error);
    res.status(500).json({ status: 'error', message: 'Erreur serveur' });
  }
});

// Route pour exporter le vocabulaire de l'utilisateur
router.get('/export', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    
    // Récupérer tous les mots de l'utilisateur
    const allWords = await Vocab.getAllWords(userId, 1, 1000000); // Très grand nombre pour tout récupérer
    
    // Formater les données pour l'export
    const exportData = allWords.words.map(word => ({
      word: word.word,
      synthese: word.synthese,
      youglish: word.youglish,
      note: word.note,
      tags: word.tags,
      exemples: word.exemples
    }));
    
    // Envoyer le fichier JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=vocabulaire.json');
    res.json(exportData);
    
    // Mettre à jour la progression
    await UserProgress.updateProgress(userId, 'espagnol', 'vocabulaire', {
      activity: {
        type: 'export',
        details: `Export de ${exportData.length} mots de vocabulaire`
      }
    });
  } catch (error) {
    console.error('Erreur lors de l\'export du vocabulaire:', error);
    res.status(500).json({ status: 'error', message: 'Erreur serveur' });
  }
});

// Route pour importer du vocabulaire
router.post('/import', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const { words, overwrite } = req.body;
    
    if (!words || !Array.isArray(words)) {
      return res.status(400).json({
        status: 'error',
        message: 'Format d\'import invalide. La liste de mots est requise.'
      });
    }
    
    const results = {
      imported: 0,
      skipped: 0,
      errors: []
    };
    
    for (const wordData of words) {
      try {
        // Vérifier si le mot existe déjà
        const existingWord = await Vocab.checkDuplicate(wordData.word, userId);
        
        if (existingWord.status === 'duplicate' && !overwrite) {
          results.skipped++;
          continue;
        }
        
        // Préparer les données du mot
        const newWordData = {
          word: wordData.word,
          synthese: wordData.synthese || '',
          youglish: wordData.youglish || '',
          tags: wordData.tags || '',
          note: wordData.note || 0,
          exemples: wordData.exemples || '',
          force_add: overwrite // Forcer l'ajout si on veut écraser
        };
        
        // Ajouter ou mettre à jour le mot
        const result = await Vocab.addWord(userId, newWordData);
        
        if (result.status === 'success') {
          results.imported++;
        } else {
          results.errors.push({ word: wordData.word, reason: result.message });
        }
      } catch (error) {
        results.errors.push({ word: wordData.word, reason: 'Erreur interne' });
      }
    }
    
    // Mettre à jour la progression
    if (results.imported > 0) {
      await UserProgress.updateProgress(userId, 'espagnol', 'vocabulaire', {
        stats: {
          completedItems: results.imported,
          importCount: results.imported
        },
        activity: {
          type: 'import',
          details: `Import de ${results.imported} mots de vocabulaire`
        }
      });
    }
    
    res.json({
      status: 'success',
      message: `${results.imported} mots importés, ${results.skipped} ignorés, ${results.errors.length} erreurs`,
      results
    });
  } catch (error) {
    console.error('Erreur lors de l\'import du vocabulaire:', error);
    res.status(500).json({ status: 'error', message: 'Erreur serveur' });
  }
});

module.exports = router;