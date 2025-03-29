const db = require('../config/database');

class Vocab {
  // Récupérer tous les mots d'un utilisateur avec pagination
  static async getAllWords(userId, page = 1, limit = 10, filters = {}) {
    const offset = (page - 1) * limit;
    const database = db.getDB();
    
    try {
      // Construire la requête avec les filtres
      let query = 'SELECT * FROM words WHERE user_id = ?';
      const params = [userId];
      
      // Ajouter les conditions de filtre si elles existent
      if (filters.tag) {
        query += ' AND tags LIKE ?';
        params.push(`%${filters.tag}%`);
      }
      
      if (filters.rating) {
        query += ' AND note = ?';
        params.push(filters.rating);
      }
      
      if (filters.search) {
        query += ' AND word LIKE ?';
        params.push(`%${filters.search}%`);
      }
      
      // Ajouter l'ordre et la pagination
      query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);
      
      // Exécuter la requête
      const words = await db.getAllRows(database, query, params);
      
      // Récupérer le nombre total de mots pour la pagination
      let countQuery = 'SELECT COUNT(*) as total FROM words WHERE user_id = ?';
      const countParams = [userId];
      
      if (filters.tag) {
        countQuery += ' AND tags LIKE ?';
        countParams.push(`%${filters.tag}%`);
      }
      
      if (filters.rating) {
        countQuery += ' AND note = ?';
        countParams.push(filters.rating);
      }
      
      if (filters.search) {
        countQuery += ' AND word LIKE ?';
        countParams.push(`%${filters.search}%`);
      }
      
      const countResult = await db.getRow(database, countQuery, countParams);
      const total = countResult.total;
      
      database.close();
      
      return {
        words,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des mots:', error);
      database.close();
      throw error;
    }
  }
  
  // Récupérer un mot par son ID pour un utilisateur spécifique
  static async getWordById(id, userId) {
    const database = db.getDB();
    
    try {
      const word = await db.getRow(database, 'SELECT * FROM words WHERE id = ? AND user_id = ?', [id, userId]);
      database.close();
      return word;
    } catch (error) {
      console.error(`Erreur lors de la récupération du mot ${id}:`, error);
      database.close();
      throw error;
    }
  }
  
  // Ajouter un nouveau mot pour un utilisateur
  static async addWord(userId, wordData) {
    const database = db.getDB();
    
    try {
      // Vérifier si le mot existe déjà pour cet utilisateur
      const existingWord = await db.getRow(
        database, 
        'SELECT * FROM words WHERE word = ? AND user_id = ?', 
        [wordData.word, userId]
      );
      
      if (existingWord && !wordData.force_add) {
        database.close();
        return { 
          status: 'duplicate', 
          message: 'Ce mot existe déjà dans votre vocabulaire.',
          word: existingWord
        };
      }
      
      // Insérer le nouveau mot
      const query = `
        INSERT INTO words (user_id, word, synthese, youglish, note, tags, image, exemples)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        userId,
        wordData.word,
        wordData.synthese || '',
        wordData.youglish || '',
        wordData.note || 0,
        wordData.tags || '',
        wordData.image || '',
        wordData.exemples || ''
      ];
      
      const result = await db.runQuery(database, query, params);
      
      // Mettre à jour les tags si nécessaire
      if (wordData.tags) {
        const tagsList = wordData.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
        
        for (const tag of tagsList) {
          await db.runQuery(
            database,
            'INSERT OR IGNORE INTO tags (user_id, name) VALUES (?, ?)',
            [userId, tag]
          );
        }
      }
      
      database.close();
      
      return { 
        status: 'success', 
        message: 'Mot ajouté avec succès', 
        wordId: result.lastID 
      };
    } catch (error) {
      console.error('Erreur lors de l\'ajout du mot:', error);
      database.close();
      throw error;
    }
  }
  
  // Mettre à jour un mot pour un utilisateur
  static async updateWord(id, userId, field, value) {
    const database = db.getDB();
    
    try {
      // S'assurer que le champ est valide
      const validFields = ['word', 'synthese', 'youglish', 'note', 'tags', 'image', 'exemples'];
      
      if (!validFields.includes(field)) {
        database.close();
        return { status: 'error', message: 'Champ invalide' };
      }
      
      // Vérifier que le mot appartient à l'utilisateur
      const word = await db.getRow(database, 'SELECT id FROM words WHERE id = ? AND user_id = ?', [id, userId]);
      if (!word) {
        database.close();
        return { status: 'error', message: 'Mot non trouvé ou accès non autorisé' };
      }
      
      // Mettre à jour le champ spécifié
      const query = `UPDATE words SET ${field} = ? WHERE id = ? AND user_id = ?`;
      await db.runQuery(database, query, [value, id, userId]);
      
      // Si on met à jour les tags, mettre à jour la table des tags
      if (field === 'tags' && value) {
        const tagsList = value.split(',').map(tag => tag.trim()).filter(tag => tag);
        
        for (const tag of tagsList) {
          await db.runQuery(
            database,
            'INSERT OR IGNORE INTO tags (user_id, name) VALUES (?, ?)',
            [userId, tag]
          );
        }
      }
      
      database.close();
      
      return { status: 'success', message: 'Mot mis à jour avec succès' };
    } catch (error) {
      console.error(`Erreur lors de la mise à jour du mot ${id}:`, error);
      database.close();
      throw error;
    }
  }
  
  // Supprimer un mot pour un utilisateur
  static async deleteWord(id, userId) {
    const database = db.getDB();
    
    try {
      // Vérifier que le mot appartient à l'utilisateur
      const word = await db.getRow(database, 'SELECT id FROM words WHERE id = ? AND user_id = ?', [id, userId]);
      if (!word) {
        database.close();
        return { status: 'error', message: 'Mot non trouvé ou accès non autorisé' };
      }
      
      await db.runQuery(database, 'DELETE FROM words WHERE id = ? AND user_id = ?', [id, userId]);
      database.close();
      
      return { status: 'success', message: 'Mot supprimé avec succès' };
    } catch (error) {
      console.error(`Erreur lors de la suppression du mot ${id}:`, error);
      database.close();
      throw error;
    }
  }
  
  // Récupérer tous les tags d'un utilisateur
  static async getAllTags(userId) {
    const database = db.getDB();
    
    try {
      // Récupérer les tags définis dans la table tags
      const tagsFromTable = await db.getAllRows(database, 'SELECT name FROM tags WHERE user_id = ?', [userId]);
      
      // Récupérer les tags utilisés dans les mots
      const wordsWithTags = await db.getAllRows(database, 'SELECT tags FROM words WHERE user_id = ? AND tags IS NOT NULL AND tags != ""', [userId]);
      
      // Extraire les tags des mots
      const tagsFromWords = new Set();
      wordsWithTags.forEach(row => {
        if (row.tags) {
          row.tags.split(',').map(tag => tag.trim()).filter(tag => tag).forEach(tag => {
            tagsFromWords.add(tag);
          });
        }
      });
      
      // Combinaison et déduplication des tags
      const allTags = new Set([
        ...tagsFromTable.map(tag => tag.name),
        ...tagsFromWords
      ]);
      
      database.close();
      
      return [...allTags].sort();
    } catch (error) {
      console.error('Erreur lors de la récupération des tags:', error);
      database.close();
      throw error;
    }
  }
  
  // Vérifier si un mot existe déjà pour un utilisateur
  static async checkDuplicate(word, userId) {
    const database = db.getDB();
    
    try {
      const existingWord = await db.getRow(
        database, 
        'SELECT * FROM words WHERE word = ? AND user_id = ?', 
        [word, userId]
      );
      
      database.close();
      
      if (existingWord) {
        return { 
          status: 'duplicate', 
          message: 'Ce mot existe déjà dans votre vocabulaire', 
          word: existingWord 
        };
      } else {
        return { status: 'ok', message: 'Ce mot n\'existe pas encore dans votre vocabulaire' };
      }
    } catch (error) {
      console.error('Erreur lors de la vérification de doublon:', error);
      database.close();
      throw error;
    }
  }
  
  // Vérifier les doublons pour une liste de mots pour un utilisateur
  static async checkDuplicatesBulk(wordsList, userId) {
    const database = db.getDB();
    
    try {
      const duplicates = [];
      const newWords = [];
      
      for (const word of wordsList) {
        const existingWord = await db.getRow(
          database, 
          'SELECT * FROM words WHERE word = ? AND user_id = ?', 
          [word, userId]
        );
        
        if (existingWord) {
          duplicates.push({
            word: word,
            existing: existingWord
          });
        } else {
          newWords.push(word);
        }
      }
      
      database.close();
      
      return {
        duplicates,
        new_words: newWords
      };
    } catch (error) {
      console.error('Erreur lors de la vérification des doublons en masse:', error);
      database.close();
      throw error;
    }
  }
  
  // Obtenir les statistiques de vocabulaire pour un utilisateur
  static async getStats(userId) {
    const database = db.getDB();
    
    try {
      const totalWords = await db.getRow(database, 'SELECT COUNT(*) as count FROM words WHERE user_id = ?', [userId]);
      
      const ratingStats = await db.getAllRows(database, `
        SELECT note, COUNT(*) as count 
        FROM words 
        WHERE user_id = ? 
        GROUP BY note 
        ORDER BY note DESC
      `, [userId]);
      
      const recentWords = await db.getAllRows(database, `
        SELECT * FROM words 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 5
      `, [userId]);
      
      database.close();
      
      return {
        totalWords: totalWords.count,
        byRating: ratingStats,
        recentWords: recentWords
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      database.close();
      throw error;
    }
  }
}

module.exports = Vocab;
