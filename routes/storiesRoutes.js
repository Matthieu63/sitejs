const express = require('express');
const router = express.Router();
const StoryPg = require('../models/StoryPg');
const { VocabPg } = require('../models/VocabPg');
const UserProgress = require('../models/UserProgress');

// Middleware pour vérifier si l'utilisateur est connecté
function isLoggedIn(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

// Route principale pour afficher la liste des histoires
router.get('/', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    
    // Récupérer toutes les histoires de l'utilisateur
    const stories = await StoryPg.getAllStories(userId);
    
    // Récupérer la progression de l'utilisateur
    const progress = await UserProgress.getProgress(userId, 'espagnol', 'histoires');
    
    // Mettre à jour l'activité de l'utilisateur
    await UserProgress.updateProgress(userId, 'espagnol', 'histoires', {
      activity: {
        type: 'view',
        details: 'Consultation de la liste des histoires'
      }
    });
    
    // Récupérer les messages flash si disponibles
    const messages = req.flash ? req.flash() : [];
    
    res.render('espagnol/stories_index', { stories, progress, messages });
  } catch (error) {
    console.error('Erreur lors de l\'affichage des histoires:', error);
    if (req.flash) {
      req.flash('error', 'Erreur lors du chargement des histoires');
    }
    res.status(500).render('error', { message: 'Erreur serveur', error });
  }
});

// Route pour afficher le formulaire de création d'histoire
router.get('/create', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    
    // Récupérer tous les tags de l'utilisateur
    const tags = await VocabPg.getAllTags(userId);
    
    // Récupérer les messages flash si disponibles
    const messages = req.flash ? req.flash() : [];
    
    res.render('espagnol/stories_create', { available_tags: tags, messages });
  } catch (error) {
    console.error('Erreur lors de l\'affichage du formulaire de création:', error);
    if (req.flash) {
      req.flash('error', 'Erreur lors du chargement du formulaire');
    }
    res.status(500).render('error', { message: 'Erreur serveur', error });
  }
});

// Route pour créer une nouvelle histoire (traitement du formulaire)
router.post('/create', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const { title, theme, tags, rating } = req.body;
    
    // Vérification du titre
    if (!title) {
      return res.status(400).json({ status: 'error', message: 'Le titre est requis' });
    }
    
    // Récupérer les mots filtrés pour l'histoire
    const selectedTags = Array.isArray(tags) ? tags : tags ? [tags] : [];
    const filteredWords = await StoryPg.getFilteredWords(userId, selectedTags, rating);
    
    if (filteredWords.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Aucun mot ne correspond aux critères' });
    }
    
    // Générer l'histoire avec Claude
    const { storyText, wordsUsed } = await StoryPg.generateStoryWithClaude(filteredWords, theme || 'Un jour ordinaire');
    
    // Extraire les dialogues de l'histoire
    const dialogues = StoryPg.extractDialoguesFromStory(storyText);
    
    // Créer l'histoire en base de données
    const storyData = {
      title,
      rating: rating || 0,
      tags: selectedTags.join(', '),
      theme: theme || 'Un jour ordinaire',
      creation_date: new Date().toISOString(),
      words_used: wordsUsed.join(', '),
      dialogues
    };
    
    const result = await StoryPg.addStory(userId, storyData);
    
    // Mettre à jour la progression de l'utilisateur
    await UserProgress.updateProgress(userId, 'espagnol', 'histoires', {
      stats: {
        completedItems: 1,
        lastAddedStory: title
      },
      activity: {
        type: 'create',
        details: `Création de l'histoire "${title}"`
      }
    });
    
    res.json({
      status: 'success',
      message: 'Histoire créée avec succès',
      storyId: result.storyId
    });
  } catch (error) {
    console.error('Erreur lors de la création de l\'histoire:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Erreur serveur' });
  }
});

// Route pour afficher une histoire spécifique
router.get('/view/:storyId', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const storyId = req.params.storyId;
    
    // Récupérer l'histoire
    const story = await StoryPg.getStoryById(storyId, userId);
    if (!story) {
      if (req.flash) {
        req.flash('error', 'Histoire non trouvée');
      }
      return res.redirect('/espagnol/stories');
    }
    
    // Récupérer les dialogues associés
    const dialogues = await StoryPg.getDialoguesByStoryId(storyId, userId);
    
    // Mettre à jour l'activité de l'utilisateur
    await UserProgress.updateProgress(userId, 'espagnol', 'histoires', {
      activity: {
        type: 'read',
        details: `Lecture de l'histoire "${story.title}"`
      }
    });
    
    // Récupérer les messages flash si disponibles
    const messages = req.flash ? req.flash() : [];
    
    res.render('espagnol/stories_view', { story, dialogues, messages });
  } catch (error) {
    console.error('Erreur lors de l\'affichage de l\'histoire:', error);
    if (req.flash) {
      req.flash('error', 'Erreur lors du chargement de l\'histoire');
    }
    res.status(500).render('error', { message: 'Erreur serveur', error });
  }
});

// Route pour supprimer une histoire
router.post('/delete/:storyId', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const storyId = req.params.storyId;
    
    // Récupérer l'histoire pour l'historique
    const story = await StoryPg.getStoryById(storyId, userId);
    if (!story) {
      return res.json({ status: 'error', message: 'Histoire non trouvée' });
    }
    
    // Supprimer l'histoire
    const result = await StoryPg.deleteStory(storyId, userId);
    
    // Mettre à jour la progression de l'utilisateur
    await UserProgress.updateProgress(userId, 'espagnol', 'histoires', {
      activity: {
        type: 'delete',
        details: `Suppression de l'histoire "${story.title}"`
      }
    });
    
    res.json(result);
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'histoire:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Erreur serveur' });
  }
});

// Route pour récupérer les statistiques des histoires
router.get('/stats', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    
    // Récupérer les statistiques
    const stats = await StoryPg.getStats(userId);
    
    res.json({
      status: 'success',
      stats
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Erreur serveur' });
  }
});

// Route pour créer une histoire personnalisée
router.post('/custom', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const { title, theme, dialogues } = req.body;
    
    if (!title || !dialogues || !Array.isArray(dialogues) || dialogues.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Données invalides pour la création d\'histoire' });
    }
    
    // Formater les dialogues
    const formattedDialogues = dialogues.map((dialogue, index) => ({
      personne_a: dialogue.question || `Pregunta ${index + 1}`,
      personne_b: dialogue.response || `Respuesta ${index + 1}`
    }));
    
    // Créer l'histoire en base de données
    const storyData = {
      title,
      theme: theme || 'Histoire personnalisée',
      creation_date: new Date().toISOString(),
      dialogues: formattedDialogues
    };
    
    const result = await StoryPg.addStory(userId, storyData);
    
    // Mettre à jour la progression de l'utilisateur
    await UserProgress.updateProgress(userId, 'espagnol', 'histoires', {
      stats: {
        completedItems: 1,
        lastAddedStory: title
      },
      activity: {
        type: 'custom',
        details: `Création de l'histoire personnalisée "${title}"`
      }
    });
    
    res.json({
      status: 'success',
      message: 'Histoire personnalisée créée avec succès',
      storyId: result.storyId
    });
  } catch (error) {
    console.error('Erreur lors de la création de l\'histoire personnalisée:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Erreur serveur' });
  }
});

// Route pour récupérer les mots utilisés dans une histoire
router.get('/words/:storyId', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const storyId = req.params.storyId;
    
    // Récupérer l'histoire
    const story = await StoryPg.getStoryById(storyId, userId);
    if (!story) {
      return res.status(404).json({ status: 'error', message: 'Histoire non trouvée' });
    }
    
    // Extraire les mots utilisés
    const wordsUsed = story.words_used ? story.words_used.split(',').map(word => word.trim()) : [];
    
    // Récupérer les détails des mots depuis le vocabulaire de l'utilisateur
    const wordDetails = [];
    
    if (wordsUsed.length > 0) {
      // Créer une chaîne de paramètres placeholders pour la requête SQL
      const placeholders = wordsUsed.map((_, idx) => `$${idx + 2}`).join(',');
      const query = `SELECT * FROM words WHERE user_id = $1 AND word IN (${placeholders})`;
      const params = [userId, ...wordsUsed];
      
      const db = require('../config/postgres');
      const result = await db.query(query, params);
      
      // Ajouter les mots trouvés aux détails
      const foundWords = result.rows;
      const foundWordsMap = {};
      
      foundWords.forEach(word => {
        foundWordsMap[word.word.toLowerCase()] = word;
      });
      
      // Ajouter tous les mots, même ceux qui n'ont pas été trouvés dans la base
      wordsUsed.forEach(word => {
        const wordLower = word.toLowerCase();
        if (foundWordsMap[wordLower]) {
          wordDetails.push({ ...foundWordsMap[wordLower], found: true });
        } else {
          wordDetails.push({ word, found: false });
        }
      });
    }
    
    res.json({
      status: 'success',
      words: wordDetails
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des mots de l\'histoire:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Erreur serveur' });
  }
});

module.exports = router;