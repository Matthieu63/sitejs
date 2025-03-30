// models/Vocab.js
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Chemin vers la base de données
const DATABASE_PATH = path.join(__dirname, '../data/polyglot.db');

// Fonction pour obtenir une connexion à la base de données
async function getDbConnection() {
  return open({
    filename: DATABASE_PATH,
    driver: sqlite3.Database
  });
}

// Fonction pour vérifier si un mot existe déjà
async function wordExists(word) {
  const db = await getDbConnection();
  const result = await db.get(
    "SELECT id FROM words WHERE lower(word) = ?", 
    [word.toLowerCase()]
  );
  await db.close();
  return result !== undefined;
}

// Fonction pour formater le texte de réponse
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

// Fonction pour vérifier si l'éditeur est vide
function isEditorEmpty(html) {
  const text = html.replace(/<[^<]+?>/g, '').replace(/&nbsp;/g, ' ').trim();
  return text.length === 0;
}

// Fonction pour générer la synthèse avec Claude
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

    console.log("[DEBUG Claude] Response status:", response.status);
    
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

// Fonction pour générer une image avec DALL-E
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

// Fonction pour initialiser la base de données
async function initVocabDb() {
  console.log("[INFO] Initialisation de la base de données vocab...");
  const db = await getDbConnection();
  
  try {
    // Créer la table words si elle n'existe pas déjà
    await db.exec(`
      CREATE TABLE IF NOT EXISTS words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT,
        synthese TEXT,
        youglish TEXT,
        note INTEGER,
        tags TEXT,
        image TEXT,
        exemples TEXT NOT NULL DEFAULT ''
      )
    `);
    
    // Créer la table tags si elle n'existe pas déjà
    await db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
      )
    `);
    
    // Vérifier si la table tags est vide
    const tagCount = await db.get("SELECT COUNT(*) as count FROM tags");
    console.log(`[DEBUG] Nombre de tags dans la base de données: ${tagCount.count}`);
    
    if (tagCount.count === 0) {
      console.log("[DEBUG] Ajout des tags par défaut...");
      const defaultTags = ["médecine", "nourriture", "voyage", "famille", "maison", "commerce", "éducation"];
      
      for (const tag of defaultTags) {
        try {
          await db.run("INSERT INTO tags (name) VALUES (?)", tag);
          console.log(`[DEBUG] Tag ajouté: ${tag}`);
        } catch (error) {
          if (error.code === 'SQLITE_CONSTRAINT') {
            console.log(`[DEBUG] Le tag '${tag}' existe déjà`);
          } else {
            console.error(`[ERROR] Erreur lors de l'ajout du tag '${tag}':`, error);
          }
        }
      }
    }
    
    // Vérifier si la table words est vide
    const wordCount = await db.get("SELECT COUNT(*) as count FROM words");
    console.log(`[DEBUG] Nombre de mots dans la base de données: ${wordCount.count}`);
    
    if (wordCount.count === 0) {
      console.log("[DEBUG] Ajout du mot par défaut 'Hola'...");
      const defaultWord = "Hola";
      const defaultSynthese = await generateSynthese(defaultWord);
      const defaultImage = await generateImage(defaultWord);
      
      await db.run(
        "INSERT INTO words (word, synthese, youglish, note, tags, image, exemples) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [defaultWord, defaultSynthese, "https://youglish.com/pronounce/hola/spanish", 0, "salutation, espagnol", defaultImage, ""]
      );
      
      console.log("[DEBUG] Mot par défaut ajouté avec succès");
    }
    
    // Vérification finale
    const finalTagCount = await db.get("SELECT COUNT(*) as count FROM tags");
    const finalWordCount = await db.get("SELECT COUNT(*) as count FROM words");
    console.log(`[DEBUG] Vérification après initialisation: ${finalTagCount.count} tags et ${finalWordCount.count} mots`);
    
    if (finalTagCount.count > 0) {
      const tags = await db.all("SELECT name FROM tags");
      console.log(`[DEBUG] Tags dans la base: ${tags.map(t => t.name).join(', ')}`);
    }
    
  } catch (error) {
    console.error("[ERROR] Erreur lors de l'initialisation de la base de données:", error);
  } finally {
    await db.close();
  }
}

// Fonctions exportées pour les routes
const Vocab = {
  // Récupération des mots
  async getAllWords(userId, page, limit, filters = {}) {
    const db = await getDbConnection();
    const offset = (page - 1) * limit;
    
    let query = "SELECT * FROM words";
    const params = [];
    const conditions = [];
    
    if (filters.tag) {
      conditions.push("lower(tags) LIKE ?");
      params.push(`%${filters.tag.toLowerCase()}%`);
    }
    
    if (filters.rating) {
      conditions.push("note = ?");
      params.push(filters.rating);
    }
    
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    
    // Compter le total pour la pagination
    const countResult = await db.get(`SELECT COUNT(*) as count FROM (${query})`, params);
    const totalCount = countResult.count;
    
    // Requête principale avec limite et offset pour pagination
    query += " ORDER BY lower(word) LIMIT ? OFFSET ?";
    params.push(limit, offset);
    
    const words = await db.all(query, params);
    await db.close();
    
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
  
  // Récupération des tags
  async getAllTags(userId) {
    const db = await getDbConnection();
    
    // Récupérer tous les tags de la table tags
    let allTags = [];
    try {
      const rows = await db.all("SELECT name FROM tags ORDER BY name");
      allTags = rows.map(row => row.name);
      
      // Si aucun tag n'est trouvé, afficher un avertissement
      if (allTags.length === 0) {
        console.log("[DEBUG] ATTENTION: Aucun tag trouvé dans la table tags");
      }
    } catch (error) {
      console.error(`[DEBUG] ERREUR lors de la récupération des tags: ${error}`);
    }
    
    // Récupérer également les tags des mots (pour être sûr)
    const tagsFromWords = new Set();
    try {
      const wordsWithTags = await db.all("SELECT DISTINCT tags FROM words WHERE tags IS NOT NULL AND tags != ''");
      
      for (const word of wordsWithTags) {
        if (word.tags) {
          const tags = word.tags.split(',').map(t => t.trim()).filter(t => t);
          tags.forEach(tag => tagsFromWords.add(tag));
        }
      }
      
      console.log(`[DEBUG] Tags extraits des mots: ${Array.from(tagsFromWords).join(', ')}`);
      
      // Ajouter les tags des mots qui ne sont pas déjà dans allTags
      for (const tag of tagsFromWords) {
        if (!allTags.includes(tag)) {
          allTags.push(tag);
          console.log(`[DEBUG] Ajout du tag '${tag}' depuis les mots`);
        }
      }
    } catch (error) {
      console.error(`[DEBUG] ERREUR lors de l'extraction des tags des mots: ${error}`);
    }
    
    // Trier les tags par ordre alphabétique
    allTags.sort();
    
    await db.close();
    return allTags;
  },
  
  // Ajout d'un nouveau mot
  async addWord(userId, wordData) {
    const { word, synthese, youglish, tags, note = 0, image = "", force_add = false } = wordData;
    
    if (!word) {
      return { status: "error", message: "Aucun mot fourni" };
    }
    
    // Vérifier si le mot existe déjà
    if (!force_add) {
      const exists = await wordExists(word);
      if (exists) {
        return { status: "error", message: "Ce mot existe déjà dans la base de données" };
      }
    }
    
    // Générer la synthèse si nécessaire
    let finalSynthese = synthese;
    if (!synthese && !wordData.disable_auto_synthese) {
      try {
        finalSynthese = await generateSynthese(word);
        console.log(`[DEBUG] Synthèse générée : ${finalSynthese.substring(0, 100)}...`);
      } catch (error) {
        console.error(`[DEBUG] generate_synthese error: ${error}`);
        finalSynthese = `<em>Erreur lors de la génération de la synthèse: ${error.message}</em>`;
      }
    }
    
    // Générer l'image si nécessaire
    let finalImage = image;
    if (!image && !wordData.disable_auto_image) {
      try {
        finalImage = await generateImage(word);
        console.log(`[DEBUG] Image générée : ${finalImage.substring(0, 50)}...`);
      } catch (error) {
        console.error(`[DEBUG] generate_image error: ${error}`);
        finalImage = "";
      }
    }
    
    // Si youglish n'est pas fourni, générer l'URL
    const finalYouglish = youglish || `https://youglish.com/pronounce/${encodeURIComponent(word)}/spanish`;
    
    try {
      const db = await getDbConnection();
      
      // Insérer le nouveau mot
      const result = await db.run(
        "INSERT INTO words (word, synthese, youglish, note, tags, image, exemples) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [word, finalSynthese, finalYouglish, note, tags, finalImage, ""]
      );
      
      await db.close();
      
      return { 
        status: "success", 
        message: "Mot ajouté avec succès", 
        wordId: result.lastID,
        synthese: finalSynthese,
        image: finalImage
      };
    } catch (error) {
      console.error(`[DEBUG] DB insert error: ${error}`);
      return { status: "error", message: error.message };
    }
  },
  
  // Vérification de doublon
  async checkDuplicate(word, userId) {
    const db = await getDbConnection();
    
    try {
      const existing = await db.get(
        "SELECT id, word, synthese, tags, image FROM words WHERE lower(word) = ?", 
        [word.toLowerCase()]
      );
      
      await db.close();
      
      if (existing) {
        return {
          status: "duplicate",
          word: existing
        };
      } else {
        return { status: "ok" };
      }
    } catch (error) {
      await db.close();
      console.error(`[DEBUG] Error in checkDuplicate: ${error}`);
      return { status: "error", message: error.message };
    }
  },
  
  // Vérification de doublons en masse
  async checkDuplicatesBulk(words, userId) {
    const db = await getDbConnection();
    const result = {
      new_words: [],
      duplicates: []
    };
    
    try {
      for (const word of words) {
        const trimmedWord = word.trim();
        if (!trimmedWord) continue;
        
        const existing = await db.get(
          "SELECT id, word, synthese, tags, image FROM words WHERE lower(word) = ?",
          [trimmedWord.toLowerCase()]
        );
        
        if (existing) {
          result.duplicates.push({
            word: trimmedWord,
            existing
          });
        } else {
          result.new_words.push(trimmedWord);
        }
      }
    } catch (error) {
      console.error(`[DEBUG] Error in checkDuplicatesBulk: ${error}`);
    } finally {
      await db.close();
    }
    
    return result;
  },
  
  // Mise à jour d'un mot
  async updateWord(id, userId, field, value) {
    if (!['word', 'synthese', 'youglish', 'tags', 'image', 'note'].includes(field)) {
      return { status: "error", message: "Champ non autorisé" };
    }
    
    try {
      const db = await getDbConnection();
      await db.run(`UPDATE words SET ${field} = ? WHERE id = ?`, [value, id]);
      await db.close();
      
      return { status: "success" };
    } catch (error) {
      console.error(`[DEBUG] Error in updateWord: ${error}`);
      return { status: "error", message: error.message };
    }
  },
  
  // Suppression d'un mot
  async deleteWord(id, userId) {
    try {
      const db = await getDbConnection();
      await db.run("DELETE FROM words WHERE id = ?", [id]);
      await db.close();
      
      return { status: "success" };
    } catch (error) {
      console.error(`[DEBUG] Error in deleteWord: ${error}`);
      return { status: "error", message: error.message };
    }
  },
  
  // Récupération d'un mot par ID
  async getWordById(id, userId) {
    try {
      const db = await getDbConnection();
      const word = await db.get("SELECT * FROM words WHERE id = ?", [id]);
      await db.close();
      
      return word;
    } catch (error) {
      console.error(`[DEBUG] Error in getWordById: ${error}`);
      return null;
    }
  },
  
  // Récupération des statistiques
  async getStats(userId) {
    try {
      const db = await getDbConnection();
      
      const totalWords = await db.get("SELECT COUNT(*) as count FROM words");
      const withImage = await db.get("SELECT COUNT(*) as count FROM words WHERE image IS NOT NULL AND image != ''");
      const withTags = await db.get("SELECT COUNT(*) as count FROM words WHERE tags IS NOT NULL AND tags != ''");
      
      const ratings = [];
      for (let i = 0; i <= 5; i++) {
        const ratingCount = await db.get("SELECT COUNT(*) as count FROM words WHERE note = ?", [i]);
        ratings.push({ rating: i, count: ratingCount.count });
      }
      
      await db.close();
      
      return {
        total: totalWords.count,
        with_image: withImage.count,
        with_tags: withTags.count,
        ratings
      };
    } catch (error) {
      console.error(`[DEBUG] Error in getStats: ${error}`);
      return {
        total: 0,
        with_image: 0,
        with_tags: 0,
        ratings: []
      };
    }
  }
};

module.exports = { 
  Vocab, 
  initVocabDb, 
  generateSynthese, 
  generateImage 
};