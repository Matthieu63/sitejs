// models/VocabPg.js
const db = require('../config/postgres');
const axios = require('axios');

// Reprendre les fonctions utilitaires de votre Vocab.js
async function generateSynthese(word) {
  // Copiez la fonction de votre fichier Vocab.js
}

function formatResponseText(text) {
  // Copiez la fonction de votre fichier Vocab.js
}

async function generateImage(word) {
  // Copiez la fonction de votre fichier Vocab.js
}

const VocabPg = {
  /**
   * Récupère les mots d'un utilisateur avec pagination et filtres.
   */
  async getAllWords(userId, page, limit, filters = {}) {
    const offset = (page - 1) * limit;
    let queryParams = [userId];
    let queryText = 'SELECT * FROM words WHERE user_id = $1';
    let paramIndex = 2;
    
    if (filters.tag) {
      queryText += ` AND tags LIKE $${paramIndex}`;
      queryParams.push(`%${filters.tag}%`);
      paramIndex++;
    }
    
    if (filters.rating) {
      queryText += ` AND note = $${paramIndex}`;
      queryParams.push(parseInt(filters.rating));
      paramIndex++;
    }
    
    // Compter le total pour la pagination
    const countQuery = `SELECT COUNT(*) FROM (${queryText}) AS count_query`;
    const countResult = await db.query(countQuery, queryParams);
    const totalCount = parseInt(countResult.rows[0].count);
    
    // Requête principale avec pagination
    queryText += ` ORDER BY word ASC LIMIT $${paramIndex} OFFSET $${paramIndex+1}`;
    queryParams.push(limit, offset);
    
    const result = await db.query(queryText, queryParams);
    
    return {
      words: result.rows,
      pagination: {
        current_page: page,
        items_per_page: limit,
        total_items: totalCount,
        total_pages: Math.ceil(totalCount / limit)
      }
    };
  },

  /**
   * Extrait tous les tags présents dans les mots d'un utilisateur.
   */
  async getAllTags(userId) {
    const query = "SELECT DISTINCT unnest(string_to_array(tags, ',')) AS tag FROM words WHERE user_id = $1 AND tags IS NOT NULL AND tags != ''";
    const result = await db.query(query, [userId]);
    return result.rows.map(row => row.tag.trim()).sort();
  },

  /**
   * Ajoute un nouveau mot pour un utilisateur.
   */
  async addWord(userId, wordData) {
    if (!wordData.force_add) {
      const duplicateQuery = "SELECT * FROM words WHERE user_id = $1 AND LOWER(word) = LOWER($2)";
      const duplicateResult = await db.query(duplicateQuery, [userId, wordData.word]);
      if (duplicateResult.rows.length > 0) {
        return { status: "error", message: "Ce mot existe déjà dans la base de données" };
      }
    }

    let finalSynthese = wordData.synthese;
    if (!finalSynthese && !wordData.disable_auto_synthese) {
      try {
        finalSynthese = await generateSynthese(wordData.word);
      } catch (error) {
        finalSynthese = `<em>Erreur lors de la génération de la synthèse: ${error.message}</em>`;
      }
    }

    let finalImage = wordData.image;
    if (!finalImage && !wordData.disable_auto_image) {
      try {
        finalImage = await generateImage(wordData.word);
      } catch (error) {
        finalImage = "";
      }
    }

    const finalYouglish = wordData.youglish || `https://youglish.com/pronounce/${encodeURIComponent(wordData.word)}/spanish`;

    const insertQuery = `
      INSERT INTO words (user_id, word, synthese, youglish, note, tags, image, exemples, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      RETURNING id`;
    
    const values = [
      userId,
      wordData.word,
      finalSynthese || "",
      finalYouglish,
      wordData.note || 0,
      wordData.tags || "",
      finalImage || "",
      wordData.exemples || ""
    ];
    
    const result = await db.query(insertQuery, values);
    
    return {
      status: "success",
      message: "Mot ajouté avec succès",
      wordId: result.rows[0].id,
      user_id: userId,
      word: wordData.word,
      synthese: finalSynthese || "",
      youglish: finalYouglish,
      note: wordData.note || 0,
      tags: wordData.tags || "",
      image: finalImage || "",
      exemples: wordData.exemples || ""
    };
  },

  /**
   * Vérifie si un mot existe déjà pour un utilisateur.
   */
  async checkDuplicate(word, userId) {
    const query = "SELECT * FROM words WHERE user_id = $1 AND LOWER(word) = LOWER($2)";
    const result = await db.query(query, [userId, word]);
    return result.rows.length > 0 ? { status: "duplicate", word: result.rows[0] } : { status: "ok" };
  },

  /**
   * Met à jour un champ spécifique d'un mot.
   */
  async updateWord(id, userId, field, value) {
    if (!['word', 'synthese', 'youglish', 'tags', 'image', 'note'].includes(field)) {
      return { status: "error", message: "Champ non autorisé" };
    }
    
    const query = `UPDATE words SET ${field} = $1 WHERE id = $2 AND user_id = $3`;
    const result = await db.query(query, [value, id, userId]);
    
    return result.rowCount > 0
      ? { status: "success" }
      : { status: "error", message: "Aucune modification effectuée" };
  },

  /**
   * Supprime un mot.
   */
  async deleteWord(id, userId) {
    const query = "DELETE FROM words WHERE id = $1 AND user_id = $2";
    const result = await db.query(query, [id, userId]);
    
    return result.rowCount > 0
      ? { status: "success" }
      : { status: "error", message: "Erreur lors de la suppression" };
  },

  /**
   * Récupère un mot par son ID.
   */
  async getWordById(id, userId) {
    const query = "SELECT * FROM words WHERE id = $1 AND user_id = $2";
    const result = await db.query(query, [id, userId]);
    return result.rows[0];
  },

  /**
   * Récupère des statistiques sur les mots d'un utilisateur.
   */
  async getStats(userId) {
    const totalQuery = "SELECT COUNT(*) as count FROM words WHERE user_id = $1";
    const totalResult = await db.query(totalQuery, [userId]);
    const total = parseInt(totalResult.rows[0].count);
    
    const withImageQuery = "SELECT COUNT(*) as count FROM words WHERE user_id = $1 AND image IS NOT NULL AND image != ''";
    const withImageResult = await db.query(withImageQuery, [userId]);
    const with_image = parseInt(withImageResult.rows[0].count);
    
    const withTagsQuery = "SELECT COUNT(*) as count FROM words WHERE user_id = $1 AND tags IS NOT NULL AND tags != ''";
    const withTagsResult = await db.query(withTagsQuery, [userId]);
    const with_tags = parseInt(withTagsResult.rows[0].count);
    
    const ratingsQuery = "SELECT note as rating, COUNT(*) as count FROM words WHERE user_id = $1 GROUP BY note";
    const ratingsResult = await db.query(ratingsQuery, [userId]);
    const ratings = ratingsResult.rows;
    
    return { total, with_image, with_tags, ratings };
  }
};

module.exports = { VocabPg, generateSynthese, generateImage };