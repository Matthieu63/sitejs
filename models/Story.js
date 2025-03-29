const db = require('../config/database');

class Story {
  // Récupérer toutes les histoires d'un utilisateur
  static async getAllStories(userId) {
    const database = db.getDB();
    
    try {
      const stories = await db.getAllRows(
        database, 
        'SELECT * FROM stories WHERE user_id = ? ORDER BY creation_date DESC', 
        [userId]
      );
      database.close();
      return stories;
    } catch (error) {
      console.error('Erreur lors de la récupération des histoires:', error);
      database.close();
      throw error;
    }
  }
  
  // Récupérer une histoire par son ID pour un utilisateur
  static async getStoryById(storyId, userId) {
    const database = db.getDB();
    
    try {
      const story = await db.getRow(
        database, 
        'SELECT * FROM stories WHERE id = ? AND user_id = ?', 
        [storyId, userId]
      );
      database.close();
      return story;
    } catch (error) {
      console.error(`Erreur lors de la récupération de l'histoire ${storyId}:`, error);
      database.close();
      throw error;
    }
  }
  
  // Récupérer tous les dialogues d'une histoire
  static async getDialoguesByStoryId(storyId, userId) {
    const database = db.getDB();
    
    try {
      // Vérifier d'abord que l'histoire appartient à l'utilisateur
      const story = await db.getRow(
        database, 
        'SELECT id FROM stories WHERE id = ? AND user_id = ?', 
        [storyId, userId]
      );
      
      if (!story) {
        database.close();
        return { status: 'error', message: 'Histoire non trouvée ou accès non autorisé' };
      }
      
      const dialogues = await db.getAllRows(
        database,
        'SELECT * FROM stories_dialogues WHERE story_id = ? ORDER BY dialogue_number',
        [storyId]
      );
      database.close();
      return dialogues;
    } catch (error) {
      console.error(`Erreur lors de la récupération des dialogues de l'histoire ${storyId}:`, error);
      database.close();
      throw error;
    }
  }
  
  // Récupérer les mots filtrés par tags et/ou rating pour un utilisateur
  static async getFilteredWords(userId, tags = null, rating = null) {
    const database = db.getDB();
    
    try {
      let query = "SELECT * FROM words WHERE user_id = ?";
      const params = [userId];
      const conditions = [];
      
      if (tags && tags.length > 0) {
        for (const tag of tags) {
          conditions.push("lower(tags) LIKE ?");
          params.push('%' + tag.toLowerCase() + '%');
        }
      }
      
      if (rating) {
        conditions.push("note = ?");
        params.push(rating);
      }
      
      if (conditions.length > 0) {
        query += " AND (" + conditions.join(" OR ") + ")";
      }
      
      const words = await db.getAllRows(database, query, params);
      database.close();
      return words;
    } catch (error) {
      console.error('Erreur lors de la récupération des mots filtrés:', error);
      database.close();
      throw error;
    }
  }
  
  // Récupérer l'historique d'utilisation des mots pour un utilisateur
  static async getWordsUsageHistory(userId, limit = 10) {
    const database = db.getDB();
    
    try {
      const recentStories = await db.getAllRows(
        database,
        "SELECT words_used FROM stories WHERE user_id = ? ORDER BY creation_date DESC LIMIT ?",
        [userId, limit]
      );
      
      database.close();
      
      const wordUsage = {};
      for (const story of recentStories) {
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
      database.close();
      throw error;
    }
  }
  
  // Ajouter une nouvelle histoire pour un utilisateur
  static async addStory(userId, storyData) {
    const database = db.getDB();
    
    try {
      const query = `
        INSERT INTO stories (user_id, title, rating, tags, theme, creation_date, words_used)
        VALUES (?, ?, ?, ?, ?, ?, ?)
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
      
      const result = await db.runQuery(database, query, params);
      const storyId = result.lastID;
      
      // Ajouter les dialogues si présents
      if (storyData.dialogues && storyData.dialogues.length > 0) {
        for (let i = 0; i < storyData.dialogues.length; i++) {
          const dialogue = storyData.dialogues[i];
          await db.runQuery(
            database,
            'INSERT INTO stories_dialogues (story_id, dialogue_number, personne_a, personne_b) VALUES (?, ?, ?, ?)',
            [storyId, i + 1, dialogue.personne_a, dialogue.personne_b]
          );
        }
      }
      
      database.close();
      
      return { 
        status: 'success', 
        message: 'Histoire ajoutée avec succès', 
        storyId: storyId 
      };
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'histoire:', error);
      database.close();
      throw error;
    }
  }
  
  // Supprimer une histoire et ses dialogues associés pour un utilisateur
  static async deleteStory(storyId, userId) {
    const database = db.getDB();
    
    try {
      // Vérifier d'abord que l'histoire appartient à l'utilisateur
      const story = await db.getRow(
        database, 
        'SELECT id FROM stories WHERE id = ? AND user_id = ?', 
        [storyId, userId]
      );
      
      if (!story) {
        database.close();
        return { status: 'error', message: 'Histoire non trouvée ou accès non autorisé' };
      }
      
      // Supprimer d'abord les dialogues associés
      await db.runQuery(database, 'DELETE FROM stories_dialogues WHERE story_id = ?', [storyId]);
      
      // Puis supprimer l'histoire
      await db.runQuery(database, 'DELETE FROM stories WHERE id = ? AND user_id = ?', [storyId, userId]);
      
      database.close();
      return { status: 'success', message: 'Histoire et dialogues supprimés avec succès' };
    } catch (error) {
      console.error(`Erreur lors de la suppression de l'histoire ${storyId}:`, error);
      database.close();
      throw error;
    }
  }
  
  // Obtenir les statistiques d'histoires pour un utilisateur
  static async getStats(userId) {
    const database = db.getDB();
    
    try {
      const totalStories = await db.getRow(
        database, 
        'SELECT COUNT(*) as count FROM stories WHERE user_id = ?', 
        [userId]
      );
      
      const totalDialogues = await db.getRow(
        database, 
        `SELECT COUNT(*) as count 
         FROM stories_dialogues sd 
         JOIN stories s ON sd.story_id = s.id 
         WHERE s.user_id = ?`, 
        [userId]
      );
      
      const recentStories = await db.getAllRows(
        database, 
        `SELECT * FROM stories 
         WHERE user_id = ? 
         ORDER BY creation_date DESC 
         LIMIT 5`, 
        [userId]
      );
      
      database.close();
      
      return {
        totalStories: totalStories.count,
        totalDialogues: totalDialogues.count,
        recentStories: recentStories
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques d\'histoires:', error);
      database.close();
      throw error;
    }
  }
}

module.exports = Story;