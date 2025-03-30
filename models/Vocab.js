// models/Vocab.js
const { connect } = require('../config/db');
const axios = require('axios');
const { ObjectId } = require('mongodb');

/**
 * Génère la synthèse pour un mot avec l'API Claude.
 */
async function generateSynthese(word) {
  try {
    const prompt = (
      `Est-ce que le mot '${word}' est fréquemment utilisé ? Si oui, explique pour quels usages, ` +
      "avec plusieurs phrases exemples en espagnol (sans traduction). " +
      "Puis, à la fin, liste 'synonymes :' suivi des synonymes et 'antonymes :' suivi des antonymes."
    );

    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      throw new Error("Clé API Claude manquante dans les variables d'environnement");
    }

    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }]
      },
      {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        }
      }
    );

    let rawText = "";
    if (response.data.content && response.data.content.length > 0) {
      rawText = response.data.content[0].text.trim();
    } else {
      console.error("[ERROR] Format de réponse Claude inattendu:", response.data);
      return "<em>Pas de synthèse générée par Claude.</em>";
    }

    if (!rawText) {
      return "<em>Pas de synthèse générée par Claude.</em>";
    }
    return formatResponseText(rawText);
  } catch (error) {
    console.error("[ERROR] Erreur lors de la génération de la synthèse:", error);
    return `<em>Erreur lors de la génération de la synthèse: ${error.message}</em>`;
  }
}

/**
 * Formate le texte en paragraphes HTML.
 */
function formatResponseText(text) {
  const paragraphs = text.split("\n\n");
  const formattedParagraphs = paragraphs
    .map(p => {
      p = p.replace(/\n/g, "<br>");
      return p.trim() ? `<p>${p.trim()}</p>` : "";
    })
    .filter(p => p.length > 0);
  return formattedParagraphs.join("\n");
}

/**
 * Génère une image via l'API OpenAI (DALL-E).
 */
async function generateImage(word) {
  try {
    const prompt = `Crée moi une image qui illustre le mieux pour toi le mot ${word} selon les usages courants.`;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Clé API OpenAI manquante dans les variables d'environnement");
    }

    const response = await axios.post(
      "https://api.openai.com/v1/images/generations",
      {
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024"
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        }
      }
    );

    if (response.data && response.data.data && response.data.data.length > 0) {
      return response.data.data[0].url || "";
    }
    return "";
  } catch (error) {
    console.error("[ERROR] Erreur lors de la génération de l'image:", error);
    return "";
  }
}

const Vocab = {
  /**
   * Récupère les mots d'un utilisateur avec pagination et filtres.
   */
  async getAllWords(userId, page, limit, filters = {}) {
    const db = await connect();
    const collection = db.collection('words');
    const query = { user: userId };

    if (filters.tag) {
      query.tags = { $regex: new RegExp(filters.tag, 'i') };
    }
    if (filters.rating) {
      query.note = parseInt(filters.rating);
    }

    const totalCount = await collection.countDocuments(query);
    const words = await collection.find(query)
      .sort({ word: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    return {
      words,
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
    const db = await connect();
    const collection = db.collection('words');
    const allTagsSet = new Set();
    const cursor = collection.find({ user: userId, tags: { $exists: true, $ne: "" } });
    await cursor.forEach(doc => {
      if (doc.tags) {
        doc.tags.split(',').map(t => t.trim()).forEach(tag => {
          if (tag) allTagsSet.add(tag);
        });
      }
    });
    return Array.from(allTagsSet).sort();
  },

  /**
   * Ajoute un nouveau mot pour un utilisateur.
   */
  async addWord(userId, wordData) {
    const collection = (await connect()).collection('words');

    if (!wordData.force_add) {
      const duplicate = await collection.findOne({
        user: userId,
        word: { $regex: new RegExp(`^${wordData.word}$`, 'i') }
      });
      if (duplicate) {
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

    const doc = {
      user: userId,
      word: wordData.word,
      synthese: finalSynthese || "",
      youglish: finalYouglish,
      note: wordData.note || 0,
      tags: wordData.tags || "",
      image: finalImage || "",
      exemples: wordData.exemples || ""
    };

    const result = await collection.insertOne(doc);
    return {
      status: "success",
      message: "Mot ajouté avec succès",
      wordId: result.insertedId,
      ...doc
    };
  },

  /**
   * Vérifie si un mot existe déjà pour un utilisateur.
   */
  async checkDuplicate(word, userId) {
    const collection = (await connect()).collection('words');
    const duplicate = await collection.findOne({
      user: userId,
      word: { $regex: new RegExp(`^${word}$`, 'i') }
    });
    return duplicate ? { status: "duplicate", word: duplicate } : { status: "ok" };
  },

  /**
   * Met à jour un champ spécifique d'un mot.
   */
  async updateWord(id, userId, field, value) {
    if (!['word', 'synthese', 'youglish', 'tags', 'image', 'note'].includes(field)) {
      return { status: "error", message: "Champ non autorisé" };
    }
    const collection = (await connect()).collection('words');
    const update = { $set: { [field]: value } };
    const result = await collection.updateOne(
      { _id: new ObjectId(id), user: userId },
      update
    );
    return result.modifiedCount > 0
      ? { status: "success" }
      : { status: "error", message: "Aucune modification effectuée" };
  },

  /**
   * Supprime un mot.
   */
  async deleteWord(id, userId) {
    const collection = (await connect()).collection('words');
    const result = await collection.deleteOne({ _id: new ObjectId(id), user: userId });
    return result.deletedCount > 0
      ? { status: "success" }
      : { status: "error", message: "Erreur lors de la suppression" };
  },

  /**
   * Récupère un mot par son ID.
   */
  async getWordById(id, userId) {
    const collection = (await connect()).collection('words');
    return await collection.findOne({ _id: new ObjectId(id), user: userId });
  },

  /**
   * Récupère des statistiques sur les mots d'un utilisateur.
   */
  async getStats(userId) {
    const collection = (await connect()).collection('words');
    const total = await collection.countDocuments({ user: userId });
    const with_image = await collection.countDocuments({ user: userId, image: { $exists: true, $ne: "" } });
    const with_tags = await collection.countDocuments({ user: userId, tags: { $exists: true, $ne: "" } });
    const ratings = await collection.aggregate([
      { $match: { user: userId } },
      { $group: { _id: "$note", count: { $sum: 1 } } },
      { $project: { rating: "$_id", count: 1, _id: 0 } }
    ]).toArray();
    return { total, with_image, with_tags, ratings };
  }
};

module.exports = { Vocab, generateSynthese, generateImage };
