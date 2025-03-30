// models/StoryPg.js
const db = require('../config/postgres');
const axios = require('axios');

// Fonction pour générer une histoire avec Claude
async function generateStoryWithClaude(words, theme) {
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

const StoryPg = {
  // Récupérer toutes les histoires d'un utilisateur
  async getAllStories(userId) {
    try {
      const query = 'SELECT * FROM stories WHERE user_id = $1 ORDER BY creation_date DESC';
      const result = await db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('Erreur lors de la récupération des histoires:', error);
      throw error;
    }
  },
  
  // Récupérer une histoire par son ID pour un utilisateur
  async getStoryById(storyId, userId) {
    try {
      const query = 'SELECT * FROM stories WHERE id = $1 AND user_id = $2';
      const result = await db.query(query, [storyId, userId]);
      return result.rows[0];
    } catch (error) {
      console.error(`Erreur lors de la récupération de l'histoire ${storyId}:`, error);
      throw error;
    }
  },
  
  // Récupérer tous les dialogues d'une histoire
  async getDialoguesByStoryId(storyId, userId) {
    try {
      // Vérifier d'abord que l'histoire appartient à l'utilisateur
      const storyQuery = 'SELECT id FROM stories WHERE id = $1 AND user_id = $2';
      const storyResult = await db.query(storyQuery, [storyId, userId]);
      
      if (storyResult.rows.length === 0) {
        return { status: 'error', message: 'Histoire non trouvée ou accès non autorisé' };
      }
      
      const dialoguesQuery = 'SELECT * FROM stories_dialogues WHERE story_id = $1 ORDER BY dialogue_number';
      const dialoguesResult = await db.query(dialoguesQuery, [storyId]);
      
      return dialoguesResult.rows;
    } catch (error) {
      console.error(`Erreur lors de la récupération des dialogues de l'histoire ${storyId}:`, error);
      throw error;
    }
  },
  
  // Récupérer les mots filtrés par tags et/ou rating pour un utilisateur
  async getFilteredWords(userId, tags = null, rating = null) {
    try {
      let query = "SELECT * FROM words WHERE user_id = $1";
      const params = [userId];
      let paramIndex = 2;
      
      // Construire les conditions pour les tags
      if (tags && tags.length > 0) {
        const tagConditions = tags.map(tag => {
          params.push(`%${tag.toLowerCase()}%`);
          return `LOWER(tags) LIKE $${paramIndex++}`;
        });
        query += ` AND (${tagConditions.join(" OR ")})`;
      }
      
      // Ajouter la condition pour le rating si présent
      if (rating) {
        query += ` AND note = $${paramIndex}`;
        params.push(parseInt(rating));
      }
      
      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Erreur lors de la récupération des mots filtrés:', error);
      throw error;
    }
  },
  
  // Récupérer l'historique d'utilisation des mots pour un utilisateur
  async getWordsUsageHistory(userId, limit = 10) {
    try {
      const query = `
        SELECT words_used FROM stories 
        WHERE user_id = $1 
        ORDER BY creation_date DESC 
        LIMIT $2
      `;
      const result = await db.query(query, [userId, limit]);
      
      const wordUsage = {};
      for (const story of result.rows) {
        if (story.words_used) {
          const words = story.words_used.split(',');
          for (const word of words) {
            const trimmedWord = word.trim();
            if (trimmedWord) {
              wordUsage[trimmedWord] = (wordUsage[trimmedWord] || 0) + 1;
            }
          }
        }
      }
      
      return wordUsage;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique d\'utilisation des mots:', error);
      throw error;
    }
  },
  
  // Ajouter une nouvelle histoire pour un utilisateur
  async addStory(userId, storyData) {
    try {
      const client = await db.getClient();
      
      try {
        await client.query('BEGIN');
        
        // Insérer l'histoire
        const storyQuery = `
          INSERT INTO stories (user_id, title, rating, tags, theme, creation_date, words_used)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `;
        
        const params = [
          userId,
          storyData.title,
          storyData.rating || 0,
          storyData.tags || '',
          storyData.theme || '',
          storyData.creation_date || new Date().toISOString(),
          storyData.words_used || ''
        ];
        
        const storyResult = await client.query(storyQuery, params);
        const storyId = storyResult.rows[0].id;
        
        // Ajouter les dialogues si présents
        if (storyData.dialogues && storyData.dialogues.length > 0) {
          for (let i = 0; i < storyData.dialogues.length; i++) {
            const dialogue = storyData.dialogues[i];
            const dialogueQuery = `
              INSERT INTO stories_dialogues (story_id, dialogue_number, personne_a, personne_b)
              VALUES ($1, $2, $3, $4)
            `;
            await client.query(dialogueQuery, [
              storyId,
              i + 1,
              dialogue.personne_a,
              dialogue.personne_b
            ]);
          }
        }
        
        await client.query('COMMIT');
        
        return { 
          status: 'success', 
          message: 'Histoire ajoutée avec succès', 
          storyId
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'histoire:', error);
      throw error;
    }
  },
  
  // Supprimer une histoire et ses dialogues associés pour un utilisateur
  async deleteStory(storyId, userId) {
    try {
      const client = await db.getClient();
      
      try {
        await client.query('BEGIN');
        
        // Vérifier d'abord que l'histoire appartient à l'utilisateur
        const storyQuery = 'SELECT id FROM stories WHERE id = $1 AND user_id = $2';
        const storyResult = await client.query(storyQuery, [storyId, userId]);
        
        if (storyResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return { status: 'error', message: 'Histoire non trouvée ou accès non autorisé' };
        }
        
        // Supprimer d'abord les dialogues associés
        await client.query('DELETE FROM stories_dialogues WHERE story_id = $1', [storyId]);
        
        // Puis supprimer l'histoire
        await client.query('DELETE FROM stories WHERE id = $1 AND user_id = $2', [storyId, userId]);
        
        await client.query('COMMIT');
        
        return { status: 'success', message: 'Histoire et dialogues supprimés avec succès' };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`Erreur lors de la suppression de l'histoire ${storyId}:`, error);
      throw error;
    }
  },
  
  // Obtenir les statistiques d'histoires pour un utilisateur
  async getStats(userId) {
    try {
      // Nombre total d'histoires
      const totalStoriesQuery = 'SELECT COUNT(*) as count FROM stories WHERE user_id = $1';
      const totalStoriesResult = await db.query(totalStoriesQuery, [userId]);
      
      // Nombre total de dialogues
      const totalDialoguesQuery = `
        SELECT COUNT(*) as count 
        FROM stories_dialogues sd 
        JOIN stories s ON sd.story_id = s.id 
        WHERE s.user_id = $1
      `;
      const totalDialoguesResult = await db.query(totalDialoguesQuery, [userId]);
      
      // Histoires récentes
      const recentStoriesQuery = `
        SELECT * FROM stories 
        WHERE user_id = $1 
        ORDER BY creation_date DESC 
        LIMIT 5
      `;
      const recentStoriesResult = await db.query(recentStoriesQuery, [userId]);
      
      return {
        totalStories: parseInt(totalStoriesResult.rows[0].count),
        totalDialogues: parseInt(totalDialoguesResult.rows[0].count),
        recentStories: recentStoriesResult.rows
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques d\'histoires:', error);
      throw error;
    }
  },

  // Générer une histoire avec Claude
  generateStoryWithClaude,
  
  // Extraire les dialogues d'une histoire
  extractDialoguesFromStory
};

module.exports = StoryPg;