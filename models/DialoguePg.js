// models/DialoguePg.js
const db = require('../config/postgres');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse'); // ✅ pas de destructuring

// Fonction pour générer des dialogues à partir d'un texte avec l'API Claude
async function generateDialoguesFromText(text, numDialogues = 3) {
  try {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      throw new Error("Clé API Claude manquante dans les variables d'environnement");
    }

    const prompt = `
      A partir du texte en espagnol suivant, crée ${numDialogues} dialogues naturels et cohérents.

      TEXTE:
      ${text}

      INSTRUCTIONS:
      1. Crée ${numDialogues} dialogues distincts basés sur le texte fourni.
      2. Chaque dialogue doit être entre deux personnes (Personne A et Personne B).
      3. Chaque réplique doit être composée de 2 à 3 phrases naturelles et complètes.
      4. Les dialogues doivent être naturels, cohérents et refléter une conversation authentique.
      5. Utilise le vocabulaire et les expressions présents dans le texte source.
      6. Format exact à suivre (n'ajoute pas d'autres éléments):

      DIALOGUE 1:
      Personne A: [réplique de A]
      Personne B: [réplique de B]
      FIN DIALOGUE 1

      DIALOGUE 2:
      Personne A: [réplique de A]
      Personne B: [réplique de B]
      FIN DIALOGUE 2

      [et ainsi de suite jusqu'à ${numDialogues} dialogues]
    `;

    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
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

    if (response.data.content && response.data.content.length > 0) {
      return extractDialoguesFromText(response.data.content[0].text, numDialogues);
    } else {
      throw new Error("Format de réponse Claude inattendu");
    }
  } catch (error) {
    console.error('Erreur lors de la génération des dialogues:', error);
    throw error;
  }
}

// Fonction pour extraire les dialogues du texte généré
function extractDialoguesFromText(text, numDialogues) {
  const dialogues = [];
  
  for (let i = 1; i <= numDialogues; i++) {
    const pattern = new RegExp(`DIALOGUE\\s*${i}:([\\s\\S]*?)FIN DIALOGUE\\s*${i}`, 'i');
    const match = pattern.exec(text);
    
    if (match) {
      const dialogueText = match[1].trim();
      const personneAMatch = /Personne\s*A\s*:\s*([\s\S]*?)(?=Personne\s*B\s*:)/i.exec(dialogueText);
      const personneBMatch = /Personne\s*B\s*:\s*([\s\S]*?)(?=$)/i.exec(dialogueText);
      
      if (personneAMatch && personneBMatch) {
        dialogues.push({
          personne_a: personneAMatch[1].trim(),
          personne_b: personneBMatch[1].trim()
        });
      } else {
        // Dialogue par défaut si le format ne correspond pas
        dialogues.push({
          personne_a: "Lo siento, hubo un problema al generar este diálogo.",
          personne_b: "Por favor, inténtalo de nuevo."
        });
      }
    } else {
      // Dialogue par défaut si le dialogue n'est pas trouvé
      dialogues.push({
        personne_a: "Lo siento, hubo un problema al generar este diálogo.",
        personne_b: "Por favor, inténtalo de nuevo."
      });
    }
  }
  
  return dialogues;
}

// Fonction pour extraire le texte d'un PDF
async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
} catch (error) {
    console.error('Erreur lors de l\'extraction du texte du PDF:', error);
    throw error;
  }
}

// Fonction pour générer des dialogues à partir d'une vidéo YouTube
async function generateDialoguesFromYouTube(youtubeUrl, numDialogues = 3) {
  try {
    // Ici, vous pourriez utiliser une API pour extraire les sous-titres de YouTube
    // Pour simplifier, nous allons simuler en générant des dialogues sans contenu réel
    
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      throw new Error("Clé API Claude manquante dans les variables d'environnement");
    }

    const prompt = `
      Imagine que tu as visionné une vidéo YouTube en espagnol à l'URL suivante: ${youtubeUrl}
      
      Crée ${numDialogues} dialogues en espagnol qui pourraient provenir de cette vidéo.
      
      INSTRUCTIONS:
      1. Crée ${numDialogues} dialogues distincts imaginant le contenu de la vidéo YouTube.
      2. Chaque dialogue doit être entre deux personnes (Personne A et Personne B).
      3. Chaque réplique doit être composée de 3 à 4 phrases naturelles et complètes.
      4. Les dialogues doivent être naturels, cohérents et refléter une conversation authentique en espagnol.
      5. Format exact à suivre (n'ajoute pas d'autres éléments):

      DIALOGUE 1:
      Personne A: [réplique de A]
      Personne B: [réplique de B]
      FIN DIALOGUE 1

      DIALOGUE 2:
      Personne A: [réplique de A]
      Personne B: [réplique de B]
      FIN DIALOGUE 2

      [et ainsi de suite jusqu'à ${numDialogues} dialogues]
    `;

    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
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

    if (response.data.content && response.data.content.length > 0) {
      return extractDialoguesFromText(response.data.content[0].text, numDialogues);
    } else {
      throw new Error("Format de réponse Claude inattendu");
    }
  } catch (error) {
    console.error('Erreur lors de la génération des dialogues depuis YouTube:', error);
    throw error;
  }
}

const DialoguePg = {
  // Récupérer tous les fichiers de dialogues d'un utilisateur
  async getAllFiles(userId) {
    try {
      const query = 'SELECT * FROM dialogues_files WHERE user_id = $1 ORDER BY upload_date DESC';
      const result = await db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('Erreur lors de la récupération des fichiers de dialogues:', error);
      throw error;
    }
  },
  
  // Récupérer un fichier de dialogue par son ID pour un utilisateur
  async getFileById(fileId, userId) {
    try {
      const query = 'SELECT * FROM dialogues_files WHERE id = $1 AND user_id = $2';
      const result = await db.query(query, [fileId, userId]);
      return result.rows[0];
    } catch (error) {
      console.error(`Erreur lors de la récupération du fichier de dialogue ${fileId}:`, error);
      throw error;
    }
  },
  
  // Récupérer tous les dialogues d'un fichier
  async getDialoguesByFileId(fileId, userId) {
    try {
      // Vérifier d'abord que le fichier appartient à l'utilisateur
      const fileQuery = 'SELECT id FROM dialogues_files WHERE id = $1 AND user_id = $2';
      const fileResult = await db.query(fileQuery, [fileId, userId]);
      
      if (fileResult.rows.length === 0) {
        return { status: 'error', message: 'Fichier non trouvé ou accès non autorisé' };
      }
      
      const dialoguesQuery = 'SELECT * FROM dialogues WHERE file_id = $1 ORDER BY dialogue_number';
      const dialoguesResult = await db.query(dialoguesQuery, [fileId]);
      
      return dialoguesResult.rows;
    } catch (error) {
      console.error(`Erreur lors de la récupération des dialogues du fichier ${fileId}:`, error);
      throw error;
    }
  },
  
  // Ajouter un nouveau fichier de dialogue pour un utilisateur
  async addFile(userId, filename, uploadDate) {
    try {
      const query = 'INSERT INTO dialogues_files (user_id, filename, upload_date) VALUES ($1, $2, $3) RETURNING id';
      const result = await db.query(query, [userId, filename, uploadDate]);
      
      return { 
        status: 'success', 
        message: 'Fichier de dialogue ajouté avec succès', 
        fileId: result.rows[0].id 
      };
    } catch (error) {
      console.error('Erreur lors de l\'ajout du fichier de dialogue:', error);
      throw error;
    }
  },
  
  // Ajouter plusieurs dialogues à un fichier
  async addDialogues(fileId, dialoguesList, userId) {
    try {
      const client = await db.getClient();
      
      try {
        await client.query('BEGIN');
        
        // Vérifier d'abord que le fichier appartient à l'utilisateur
        const fileQuery = 'SELECT id FROM dialogues_files WHERE id = $1 AND user_id = $2';
        const fileResult = await client.query(fileQuery, [fileId, userId]);
        
        if (fileResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return { status: 'error', message: 'Fichier non trouvé ou accès non autorisé' };
        }
        
        for (let i = 0; i < dialoguesList.length; i++) {
          const dialogue = dialoguesList[i];
          const query = `
            INSERT INTO dialogues (file_id, dialogue_number, personne_a, personne_b)
            VALUES ($1, $2, $3, $4)
          `;
          await client.query(query, [fileId, i + 1, dialogue.personne_a, dialogue.personne_b]);
        }
        
        await client.query('COMMIT');
        
        return { 
          status: 'success', 
          message: `${dialoguesList.length} dialogues ajoutés avec succès` 
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout des dialogues:', error);
      throw error;
    }
  },
  
  // Supprimer un fichier de dialogue et tous ses dialogues associés
  async deleteFile(fileId, userId) {
    try {
      const client = await db.getClient();
      
      try {
        await client.query('BEGIN');
        
        // Vérifier d'abord que le fichier appartient à l'utilisateur
        const fileQuery = 'SELECT id FROM dialogues_files WHERE id = $1 AND user_id = $2';
        const fileResult = await client.query(fileQuery, [fileId, userId]);
        
        if (fileResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return { status: 'error', message: 'Fichier non trouvé ou accès non autorisé' };
        }
        
        // Supprimer d'abord les dialogues associés
        await client.query('DELETE FROM dialogues WHERE file_id = $1', [fileId]);
        
        // Puis supprimer le fichier
        await client.query('DELETE FROM dialogues_files WHERE id = $1 AND user_id = $2', [fileId, userId]);
        
        await client.query('COMMIT');
        
        return { status: 'success', message: 'Fichier et dialogues supprimés avec succès' };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`Erreur lors de la suppression du fichier de dialogue ${fileId}:`, error);
      throw error;
    }
  },
  
  // Obtenir les statistiques de dialogues pour un utilisateur
  async getStats(userId) {
    try {
      // Nombre total de fichiers
      const totalFilesQuery = 'SELECT COUNT(*) as count FROM dialogues_files WHERE user_id = $1';
      const totalFilesResult = await db.query(totalFilesQuery, [userId]);
      
      // Nombre total de dialogues
      const totalDialoguesQuery = `
        SELECT COUNT(*) as count 
        FROM dialogues d 
        JOIN dialogues_files f ON d.file_id = f.id 
        WHERE f.user_id = $1
      `;
      const totalDialoguesResult = await db.query(totalDialoguesQuery, [userId]);
      
      // Fichiers récents
      const recentFilesQuery = `
        SELECT * FROM dialogues_files 
        WHERE user_id = $1 
        ORDER BY upload_date DESC 
        LIMIT 5
      `;
      const recentFilesResult = await db.query(recentFilesQuery, [userId]);
      
      return {
        totalFiles: parseInt(totalFilesResult.rows[0].count),
        totalDialogues: parseInt(totalDialoguesResult.rows[0].count),
        recentFiles: recentFilesResult.rows
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques de dialogues:', error);
      throw error;
    }
  },

  // Traiter un fichier PDF pour générer des dialogues
  async processAndGenerateDialoguesFromPDF(filePath, userId, filename) {
    try {
      // Extraire le texte du PDF
      const text = await extractTextFromPDF(filePath);
      
      // Générer des dialogues à partir du texte
      const dialogues = await generateDialoguesFromText(text);
      
      // Créer une entrée de fichier
      const now = new Date().toISOString();
      const fileResult = await this.addFile(userId, filename, now);
      
      if (fileResult.status === 'success' && fileResult.fileId) {
        // Ajouter les dialogues générés
        await this.addDialogues(fileResult.fileId, dialogues, userId);
        
        return {
          status: 'success',
          message: 'Dialogues générés avec succès',
          fileId: fileResult.fileId
        };
      } else {
        throw new Error('Erreur lors de la création du fichier de dialogues');
      }
    } catch (error) {
      console.error('Erreur lors du traitement du PDF et de la génération des dialogues:', error);
      throw error;
    }
  },

  // Générer des dialogues à partir d'une URL YouTube
  async processAndGenerateDialoguesFromYouTube(youtubeUrl, userId) {
    try {
      // Générer des dialogues à partir de l'URL YouTube
      const dialogues = await generateDialoguesFromYouTube(youtubeUrl);
      
      // Extraire l'ID de la vidéo pour le nom du fichier
      let videoId = youtubeUrl;
      const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
      const match = youtubeRegex.exec(youtubeUrl);
      if (match && match[1]) {
        videoId = match[1];
      }
      
      // Créer une entrée de fichier
      const now = new Date().toISOString();
      const filename = `YouTube_${videoId}`;
      const fileResult = await this.addFile(userId, filename, now);
      
      if (fileResult.status === 'success' && fileResult.fileId) {
        // Ajouter les dialogues générés
        await this.addDialogues(fileResult.fileId, dialogues, userId);
        
        return {
          status: 'success',
          message: 'Dialogues générés avec succès à partir de YouTube',
          fileId: fileResult.fileId
        };
      } else {
        throw new Error('Erreur lors de la création du fichier de dialogues');
      }
    } catch (error) {
      console.error('Erreur lors de la génération des dialogues depuis YouTube:', error);
      throw error;
    }
  },

  // Génération de dialogues à partir de texte
  generateDialoguesFromText,
  
  // Extraction de texte depuis un PDF
  extractTextFromPDF,
  
  // Génération de dialogues depuis YouTube
  generateDialoguesFromYouTube
};

module.exports = DialoguePg;