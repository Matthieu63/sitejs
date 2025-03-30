// routes/vocabRoutes.js
// routes/vocabRoutes.js
const express = require('express');
const router = express.Router();
const { VocabPg: Vocab } = require('../models/VocabPg');
const UserProgress = require('../models/UserProgress');
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
  if (!req.session || !req.session.user) {
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
      page: result.pagination.current_page,
      limit: result.pagination.items_per_page,
      total_pages: result.pagination.total_pages,
      tag_filter: filters.tag || '',
      rating_filter: filters.rating || '',
      all_tags: tags,
      available_tags: tags,  // Si c'est la même liste pour les deux usages
      stats,
      progress,
      currentUrl: req.originalUrl.split('?')[0],
      req: req, // Passer l'objet req pour accéder aux query parameters dans le template
      success: req.query.success,
      word: req.query.word
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
    
    // Gestion de la synthèse automatique
    if (!req.body.disable_auto_synthese && !wordData.synthese) {
      wordData.disable_auto_synthese = false;
    } else {
      wordData.disable_auto_synthese = true;
    }
    
    // Gestion de l'image automatique
    if (!req.body.disable_auto_image && !wordData.image) {
      wordData.disable_auto_image = false;
    } else {
      wordData.disable_auto_image = true;
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
    
    // Déterminer si c'est une requête AJAX
    const isAjax = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
    
    if (isAjax) {
      // Réponse JSON pour les requêtes AJAX
      return res.json(result);
    } else {
      // Redirection avec message flash pour les requêtes normales
      req.flash('success', `Le mot "${wordData.word}" a été ajouté avec succès!`);
      return res.redirect('/espagnol/');
    }
  } catch (error) {
    console.error('Erreur lors de l\'ajout du mot:', error);
    
    // Déterminer si c'est une requête AJAX
    const isAjax = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
    
    if (isAjax) {
      return res.status(500).json({ status: 'error', message: error.message || 'Erreur serveur' });
    } else {
      req.flash('error', `Erreur lors de l'ajout du mot: ${error.message}`);
      return res.redirect('/espagnol/add');
    }
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
    res.status(500).json({ status: 'error', message: error.message || 'Erreur serveur' });
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
    res.status(500).json({ status: 'error', message: error.message || 'Erreur serveur' });
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
    res.status(500).json({ status: 'error', message: error.message || 'Erreur serveur' });
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
    res.status(500).json({ status: 'error', message: error.message || 'Erreur serveur' });
  }
});

// Route pour ajouter des mots en masse
router.get('/bulk_add', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const tags = await Vocab.getAllTags(userId);
    
    res.render('espagnol/bulk_add', { available_tags: tags });
  } catch (error) {
    console.error('Erreur lors de l\'affichage du formulaire d\'ajout en masse:', error);
    res.status(500).send('Erreur serveur');
  }
});

// Traitement de l'ajout en masse
router.post('/bulk_add', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const { words_text, tags_bulk, disable_auto_synthese, disable_auto_image, skip_duplicates } = req.body;
    
    // Traiter le texte pour obtenir la liste des mots
    const words = words_text
      .split('\n')
      .map(word => word.trim())
      .filter(word => word.length > 0);
    
    if (words.length === 0) {
      req.flash('error', 'Aucun mot valide fourni');
      return res.redirect('/espagnol/bulk_add');
    }
    
    // Préparer les tags
    const tagsStr = Array.isArray(tags_bulk) ? tags_bulk.join(', ') : (tags_bulk || '');
    
    // Compteurs pour le résultat
    let added = 0;
    let skipped = 0;
    let errors = [];
    
    // Traiter chaque mot
    for (const word of words) {
      // Vérifier si le mot existe déjà
      const checkResult = await Vocab.checkDuplicate(word, userId);
      
      if (checkResult.status === 'duplicate') {
        if (skip_duplicates === 'on') {
          skipped++;
          continue;
        }
      }
      
      // Préparer les données du mot
      const wordData = {
        word,
        tags: tagsStr,
        youglish: `https://youglish.com/pronounce/${encodeURIComponent(word)}/spanish`,
        note: 0,
        disable_auto_synthese: disable_auto_synthese === 'on',
        disable_auto_image: disable_auto_image === 'on',
        force_add: true // Pour permettre l'ajout même si le mot existe
      };
      
      // Ajouter le mot
      const result = await Vocab.addWord(userId, wordData);
      
      if (result.status === 'success') {
        added++;
      } else {
        errors.push({ word, reason: result.message });
      }
    }
    
    // Mettre à jour la progression de l'utilisateur
    if (added > 0) {
      await UserProgress.updateProgress(userId, 'espagnol', 'vocabulaire', {
        stats: {
          completedItems: added,
          bulkAddCount: added
        },
        activity: {
          type: 'bulk_add',
          details: `Ajout de ${added} mots en masse`
        }
      });
    }
    
    // Message de résultat
    let message = `${added} mots ajoutés avec succès.`;
    if (skipped > 0) {
      message += ` ${skipped} doublons ignorés.`;
    }
    if (errors.length > 0) {
      message += ` ${errors.length} erreurs rencontrées.`;
    }
    
    req.flash('success', message);
    return res.redirect('/espagnol/');
  } catch (error) {
    console.error('Erreur lors de l\'ajout en masse:', error);
    req.flash('error', `Erreur: ${error.message}`);
    return res.redirect('/espagnol/bulk_add');
  }
});

// Route pour exporter le vocabulaire de l'utilisateur
router.get('/export', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    
    // Récupérer tous les mots de l'utilisateur
    const result = await Vocab.getAllWords(userId, 1, 1000000); // Très grand nombre pour tout récupérer
    
    // Formater les données pour l'export
    const exportData = result.words.map(word => ({
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
    res.status(500).json({ status: 'error', message: error.message || 'Erreur serveur' });
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
    res.status(500).json({ status: 'error', message: error.message || 'Erreur serveur' });
  }
});

// Route pour accéder à un mot spécifique
router.get('/word/:id', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const wordId = req.params.id;
    
    // Récupérer le mot spécifique
    const word = await Vocab.getWordById(wordId, userId);
    
    if (!word) {
      req.flash('error', 'Mot non trouvé');
      return res.redirect('/espagnol/');
    }
    
    // Récupérer les mots précédent et suivant pour la navigation
    const db = await getDbConnection();
    const allWordIds = await db.all("SELECT id FROM words ORDER BY lower(word)");
    await db.close();
    
    const ids = allWordIds.map(row => row.id);
    const currentIndex = ids.findIndex(id => id === parseInt(wordId));
    
    const prevId = currentIndex > 0 ? ids[currentIndex - 1] : null;
    const nextId = currentIndex < ids.length - 1 ? ids[currentIndex + 1] : null;
    
    res.render('espagnol/word_detail', { 
      word, 
      prev_id: prevId, 
      next_id: nextId 
    });
  } catch (error) {
    console.error('Erreur lors de l\'affichage du mot:', error);
    req.flash('error', `Erreur: ${error.message}`);
    res.redirect('/espagnol/');
  }
});

// Route de gestion des tags
router.get('/admin/tags', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const db = await getDbConnection();
    
    const tagsData = [];
    const tagsRaw = await db.all("SELECT name FROM tags ORDER BY name");
    
    for (const tag of tagsRaw) {
      // Compter les occurrences de ce tag dans les mots
      const count = await db.get(
        "SELECT COUNT(*) as count FROM words WHERE tags LIKE ?", 
        [`%${tag.name}%`]
      );
      
      tagsData.push({
        name: tag.name,
        count: count.count
      });
    }
    
    await db.close();
    
    res.render('espagnol/manage_tags', { tags: tagsData });
  } catch (error) {
    console.error('Erreur lors de l\'affichage des tags:', error);
    req.flash('error', `Erreur: ${error.message}`);
    res.redirect('/espagnol/');
  }
});

// Route pour ajouter un tag
router.post('/admin/tags', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const { new_tag, delete_tag } = req.body;
    
    if (new_tag) {
      // Ajout d'un nouveau tag
      const db = await getDbConnection();
      
      // Vérifier si le tag existe déjà
      const existing = await db.get(
        "SELECT name FROM tags WHERE lower(name) = lower(?)",
        [new_tag.trim()]
      );
      
      if (!existing) {
        await db.run("INSERT INTO tags (name) VALUES (?)", [new_tag.trim()]);
        req.flash('success', `Le tag "${new_tag}" a été ajouté avec succès!`);
      } else {
        req.flash('warning', `Le tag "${new_tag}" existe déjà.`);
      }
      
      await db.close();
    } else if (delete_tag) {
      // Suppression d'un tag
      const db = await getDbConnection();
      
      // Supprimer le tag
      await db.run("DELETE FROM tags WHERE name = ?", [delete_tag]);
      
      // Mettre à jour les mots qui utilisent ce tag
      const rows = await db.all(
        "SELECT id, tags FROM words WHERE tags LIKE ?",
        [`%${delete_tag}%`]
      );
      
      for (const row of rows) {
        const tagsList = row.tags.split(',').map(t => t.trim()).filter(t => t);
        const newTags = tagsList.filter(t => t.toLowerCase() !== delete_tag.toLowerCase());
        const updatedTags = newTags.join(', ');
        
        await db.run(
          "UPDATE words SET tags = ? WHERE id = ?",
          [updatedTags, row.id]
        );
      }
      
      await db.close();
      req.flash('success', `Le tag "${delete_tag}" a été supprimé avec succès!`);
    }
    
    res.redirect('/espagnol/admin/tags');
  } catch (error) {
    console.error('Erreur lors de la gestion des tags:', error);
    req.flash('error', `Erreur: ${error.message}`);
    res.redirect('/espagnol/admin/tags');
  }
});

// Route pour le diagnostic des tags
router.get('/debug/check_tags', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const result = {
      status: 'success',
      messages: [],
      tags_in_db: [],
      tags_in_words: []
    };
    
    const db = await getDbConnection();
    
    // 1. Vérifier la table tags
    const tagCount = await db.get("SELECT COUNT(*) as count FROM tags");
    result.messages.push(`Nombre de tags dans la table tags: ${tagCount.count}`);
    
    if (tagCount.count > 0) {
      const tagsInDb = await db.all("SELECT name FROM tags ORDER BY name");
      result.tags_in_db = tagsInDb.map(tag => tag.name);
      result.messages.push(`Tags trouvés: ${result.tags_in_db.join(', ')}`);
    } else {
      result.messages.push("AUCUN TAG trouvé dans la table tags!");
      
      // Ajouter des tags par défaut
      const defaultTags = ["médecine", "nourriture", "voyage", "famille", "maison", "commerce", "éducation"];
      for (const tag of defaultTags) {
        try {
          await db.run("INSERT INTO tags (name) VALUES (?)", [tag]);
          result.messages.push(`Tag par défaut ajouté: ${tag}`);
        } catch (error) {
          if (error.code === 'SQLITE_CONSTRAINT') {
            result.messages.push(`Erreur: Le tag '${tag}' existe déjà`);
          } else {
            throw error;
          }
        }
      }
      
      const tagsInDb = await db.all("SELECT name FROM tags ORDER BY name");
      result.tags_in_db = tagsInDb.map(tag => tag.name);
      result.messages.push(`Tags après correction: ${result.tags_in_db.join(', ')}`);
    }
    
    // 2. Vérifier les tags utilisés dans les mots
    const tagsFromWords = new Set();
    const wordsWithTags = await db.all(
      "SELECT id, word, tags FROM words WHERE tags IS NOT NULL AND tags != ''"
    );
    
    for (const word of wordsWithTags) {
      if (word.tags) {
        const tags = word.tags.split(',').map(t => t.trim()).filter(t => t);
        result.messages.push(`Mot '${word.word}' (ID: ${word.id}) a les tags: ${tags.join(', ')}`);
        tags.forEach(tag => tagsFromWords.add(tag));
      }
    }
    
    result.tags_in_words = Array.from(tagsFromWords);
    result.messages.push(`Tags extraits des mots: ${result.tags_in_words.join(', ')}`);
    
    // Vérifier si tous les tags des mots existent dans la table tags
    const missingTags = result.tags_in_words.filter(tag => !result.tags_in_db.includes(tag));
    if (missingTags.length > 0) {
      result.messages.push(`Tags manquants dans la table tags: ${missingTags.join(', ')}`);
      
      // Ajouter les tags manquants
      for (const tag of missingTags) {
        try {
          await db.run("INSERT INTO tags (name) VALUES (?)", [tag]);
          result.messages.push(`Tag manquant ajouté: ${tag}`);
        } catch (error) {
          if (error.code === 'SQLITE_CONSTRAINT') {
            result.messages.push(`Erreur: Impossible d'ajouter le tag '${tag}'`);
          } else {
            throw error;
          }
        }
      }
    }
    
    await db.close();
    
    // Générer une réponse HTML
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Diagnostic des Tags</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
              h1 { color: #3f51b5; }
              .success { color: green; }
              .error { color: red; }
              .info { color: blue; }
              pre { background: #f5f5f5; padding: 10px; border-radius: 5px; }
          </style>
      </head>
      <body>
          <h1>Diagnostic des Tags</h1>
          <p class="${result.status}">Statut: ${result.status.toUpperCase()}</p>
          
          <h2>Messages de diagnostic:</h2>
          <ul>
          ${result.messages.map(msg => `<li>${msg}</li>`).join('')}
          </ul>
          
          <h2>Tags dans la base de données:</h2>
          <pre>${result.tags_in_db.length > 0 ? result.tags_in_db.join(", ") : "Aucun"}</pre>
          
          <h2>Tags utilisés dans les mots:</h2>
          <pre>${result.tags_in_words.length > 0 ? result.tags_in_words.join(", ") : "Aucun"}</pre>
          
          <p><a href="/espagnol/">Retour à la page d'accueil</a></p>
          <p><a href="/espagnol/admin/tags">Aller à la gestion des tags</a></p>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error('Erreur lors du diagnostic des tags:', error);
    res.status(500).send(`<html><body><h1>Erreur</h1><p>${error.message}</p><a href="/espagnol/">Retour</a></body></html>`);
  }
});

module.exports = router;