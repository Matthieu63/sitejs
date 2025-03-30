const express = require('express');
const router = express.Router();
const axios = require('axios');
const Story = require('../models/Story');
const { VocabPg: Vocab } = require('../models/VocabPg');
const UserProgress = require('../models/UserProgress');

// Middleware pour vérifier si l'utilisateur est connecté
function isLoggedIn(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

// Fonction pour générer une histoire avec des mots
async function generateStory(words, theme) {
  try {
    // Limiter le nombre de mots à utiliser
    let selectedWords = words;
    if (words.length > 75) {
      selectedWords = [...words].sort(() => 0.5 - Math.random()).slice(0, 75);
    }
    
    // Extraire les mots en texte simple
    const wordsList = selectedWords.map(word => word.word);
    
    // Diviser les mots en deux groupes pour les deux dialogues
    const wordsGroup1 = wordsList.slice(0, Math.ceil(wordsList.length / 2));
    const wordsGroup2 = wordsList.slice(Math.ceil(wordsList.length / 2));
    
    const group1Text = wordsGroup1.join(', ');
    const group2Text = wordsGroup2.join(', ');
    
    // Utiliser l'API Claude pour générer l'histoire
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      throw new Error('Clé API Claude manquante');
    }
    
    const prompt = `
      Por favor, crea exactamente 2 diálogos narrativos, naturales y coherentes en español, que simulen una conversación real entre dos personas.

      INSTRUCCIONES IMPORTANTES:
      1. Utiliza exclusivamente las etiquetas 'Personne A:' y 'Personne B:' (no uses nombres propios).
      2. Cada intervención debe consistir en 4 a 5 frases completas, descriptivas y naturales, sin limitarse a un número fijo de palabras por frase.
      3. Cada frase debe terminar con un punto u otro signo de puntuación apropiado.
      4. No escribas frases incompletas ni uses 'etc.' o '...'.
      5. Incorpora de forma coherente el tema y las siguientes palabras clave obligatorias, pero utiliza también otras palabras que enriquezcan la narrativa y permitan transiciones lógicas entre las ideas.
      6. Si las palabras clave son verbos, conjúgalos correctamente según el contexto, y ajusta el género de los sustantivos o adjetivos para que la conversación sea natural.
      7. El diálogo debe parecer una conversación real: incluye preguntas, respuestas, comentarios espontáneos, interjecciones y transiciones naturales.
      8. El tema es: ${theme}

      Para el PRIMER diálogo, integra obligatoriamente las siguientes palabras clave: ${group1Text}
      Para el SEGUNDO diálogo, integra obligatoriamente las siguientes palabras clave: ${group2Text}

      FORMATO EXACTO A SEGUIR:

      Dialogue 1:
      Personne A: [Frase 1. Frase 2. Frase 3. Frase 4.]
      Personne B: [Frase 1. Frase 2. Frase 3. Frase 4.]
      FIN DIALOGUE 1

      Dialogue 2:
      Personne A: [Frase 1. Frase 2. Frase 3. Frase 4.]
      Personne B: [Frase 1. Frase 2. Frase 3. Frase 4.]
      FIN DIALOGUE 2

      Asegúrate de que ambos diálogos estén completos, sean coherentes, parezcan una conversación real y no se corten.
    `;
    
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }]
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }
      }
    );
    
    if (response.status === 200 && response.data.content && response.data.content[0]) {
      return { storyText: response.data.content[0].text, wordsUsed: wordsList };
    } else {
      throw new Error(`Erreur API Claude: ${response.status}`);
    }
  } catch (error) {
    console.error('Erreur lors de la génération de l\'histoire:', error);
    throw error;
  }
}

// Fonction pour extraire les dialogues d'une histoire
function extractDialoguesFromStory(storyText) {
  const dialogues = [];
  
  for (let i = 1; i <= 2; i++) {
    const pattern = new RegExp(`Dialogue\\s+${i}:\\s*(.*?)\\s*FIN DIALOGUE ${i}`, 's');
    const match = pattern.exec(storyText);
    
    if (match) {
      const dialogueContent = match[1].trim();
      const personneAMatch = /Personne\s+A:\s*(.*?)(?=Personne\s+B:)/s.exec(dialogueContent);
      const personneBMatch = /Personne\s+B:\s*(.*?)(?=$)/s.exec(dialogueContent);
      
      if (personneAMatch && personneBMatch) {
        dialogues.push({
          personne_a: personneAMatch[1].trim(),
          personne_b: personneBMatch[1].trim()
        });
      } else {
        // Si la structure n'est pas reconnue, utiliser un dialogue par défaut
        dialogues.push({
          personne_a: "Lo siento, hubo un problema al generar este diálogo.",
          personne_b: "Por favor, inténtalo de nuevo."
        });
      }
    } else {
      // Si le dialogue n'est pas trouvé, utiliser un dialogue par défaut
      dialogues.push({
        personne_a: "Lo siento, hubo un problema al generar este diálogo.",
        personne_b: "Por favor, inténtalo de nuevo."
      });
    }
  }
  
  return dialogues;
}

// Route principale pour afficher la liste des histoires
router.get('/', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    
    // Récupérer toutes les histoires de l'utilisateur
    const stories = await Story.getAllStories(userId);
    
    // Récupérer la progression de l'utilisateur
    const progress = await UserProgress.getProgress(userId, 'espagnol', 'histoires');
    
    // Mettre à jour l'activité de l'utilisateur
    await UserProgress.updateProgress(userId, 'espagnol', 'histoires', {
      activity: {
        type: 'view',
        details: 'Consultation de la liste des histoires'
      }
    });
    
    res.render('espagnol/stories_index', { stories, progress });
  } catch (error) {
    console.error('Erreur lors de l\'affichage des histoires:', error);
    res.status(500).send('Erreur serveur');
  }
});

// Route pour afficher le formulaire de création d'histoire
router.get('/create', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    
    // Récupérer tous les tags de l'utilisateur
    const tags = await Vocab.getAllTags(userId);
    
    res.render('espagnol/stories_create', { available_tags: tags });
  } catch (error) {
    console.error('Erreur lors de l\'affichage du formulaire de création:', error);
    res.status(500).send('Erreur serveur');
  }
});

// Route pour créer une nouvelle histoire
router.post('/create', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const { title, theme, tags, rating } = req.body;
    
    if (!title) {
      return res.status(400).json({ status: 'error', message: 'Le titre est requis' });
    }
    
    // Récupérer les mots filtrés pour l'histoire
    const selectedTags = Array.isArray(tags) ? tags : tags ? [tags] : [];
    const filteredWords = await Story.getFilteredWords(userId, selectedTags, rating);
    
    if (filteredWords.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Aucun mot ne correspond aux critères' });
    }
    
    // Générer l'histoire
    const { storyText, wordsUsed } = await generateStory(filteredWords, theme || 'Un jour ordinaire');
    
    // Extraire les dialogues
    const dialogues = extractDialoguesFromStory(storyText);
    
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
    
    const result = await Story.addStory(userId, storyData);
    
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

// Route pour afficher une histoire
router.get('/view/:storyId', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const storyId = req.params.storyId;
    
    // Récupérer l'histoire et ses dialogues
    const story = await Story.getStoryById(storyId, userId);
    if (!story) {
      return res.status(404).send('Histoire non trouvée');
    }
    
    const dialogues = await Story.getDialoguesByStoryId(storyId, userId);
    
    // Mettre à jour l'activité de l'utilisateur
    await UserProgress.updateProgress(userId, 'espagnol', 'histoires', {
      activity: {
        type: 'read',
        details: `Lecture de l'histoire "${story.title}"`
      }
    });
    
    res.render('espagnol/stories_view', { story, dialogues });
  } catch (error) {
    console.error('Erreur lors de l\'affichage de l\'histoire:', error);
    res.status(500).send('Erreur serveur');
  }
});

// Route pour supprimer une histoire
router.delete('/delete/:storyId', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user;
    const storyId = req.params.storyId;
    
    // Récupérer l'histoire pour l'historique
    const story = await Story.getStoryById(storyId, userId);
    if (!story) {
      return res.status(404).json({ status: 'error', message: 'Histoire non trouvée' });
    }
    
    // Supprimer l'histoire et ses dialogues
    const result = await Story.deleteStory(storyId, userId);
    
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
    const stats = await Story.getStats(userId);
    
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
    
    const result = await Story.addStory(userId, storyData);
    
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
    const story = await Story.getStoryById(storyId, userId);
    if (!story) {
      return res.status(404).json({ status: 'error', message: 'Histoire non trouvée' });
    }
    
    // Extraire les mots utilisés
    const wordsUsed = story.words_used ? story.words_used.split(',').map(word => word.trim()) : [];
    
    // Récupérer les détails des mots depuis le vocabulaire de l'utilisateur
    const wordDetails = [];
    
    for (const word of wordsUsed) {
      try {
        // Rechercher le mot dans le vocabulaire
        const vocabDb = db.getDB();
        const wordData = await db.getRow(
          vocabDb,
          'SELECT * FROM words WHERE user_id = ? AND word = ?',
          [userId, word]
        );
        vocabDb.close();
        
        if (wordData) {
          wordDetails.push(wordData);
        } else {
          // Si le mot n'est pas trouvé, ajouter une version simplifiée
          wordDetails.push({ word, found: false });
        }
      } catch (error) {
        console.error(`Erreur lors de la récupération du mot ${word}:`, error);
      }
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