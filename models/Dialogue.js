const db = require('../config/database');

class Dialogue {
  // Récupérer tous les fichiers de dialogues d'un utilisateur
  static async getAllFiles(userId) {
    const database = db.getDB();
    
    try {
      const files = await db.getAllRows(
        database, 
        'SELECT * FROM dialogues_files WHERE user_id = ? ORDER BY upload_date DESC', 
        [userId]
      );
      database.close();
      return files;
    } catch (error) {
      console.error('Erreur lors de la récupération des fichiers de dialogues:', error);
      database.close();
      throw error;
    }
  }
  
  // Récupérer un fichier de dialogue par son ID pour un utilisateur
  static async getFileById(fileId, userId) {
    const database = db.getDB();
    
    try {
      const file = await db.getRow(
        database, 
        'SELECT * FROM dialogues_files WHERE id = ? AND user_id = ?', 
        [fileId, userId]
      );
      database.close();
      return file;
    } catch (error) {
      console.error(`Erreur lors de la récupération du fichier de dialogue ${fileId}:`, error);
      database.close();
      throw error;
    }
  }
  
  // Récupérer tous les dialogues d'un fichier
  static async getDialoguesByFileId(fileId, userId) {
    const database = db.getDB();
    
    try {
      // Vérifier d'abord que le fichier appartient à l'utilisateur
      const file = await db.getRow(
        database, 
        'SELECT id FROM dialogues_files WHERE id = ? AND user_id = ?', 
        [fileId, userId]
      );
      
      if (!file) {
        database.close();
        return { status: 'error', message: 'Fichier non trouvé ou accès non autorisé' };
      }
      
      const dialogues = await db.getAllRows(
        database,
        'SELECT * FROM dialogues WHERE file_id = ? ORDER BY dialogue_number',
        [fileId]
      );
      database.close();
      return dialogues;
    } catch (error) {
      console.error(`Erreur lors de la récupération des dialogues du fichier ${fileId}:`, error);
      database.close();
      throw error;
    }
  }
  
  // Ajouter un nouveau fichier de dialogue pour un utilisateur
  static async addFile(userId, filename, uploadDate) {
    const database = db.getDB();
    
    try {
      const result = await db.runQuery(
        database,
        'INSERT INTO dialogues_files (user_id, filename, upload_date) VALUES (?, ?, ?)',
        [userId, filename, uploadDate]
      );
      
      database.close();
      return { 
        status: 'success', 
        message: 'Fichier de dialogue ajouté avec succès', 
        fileId: result.lastID 
      };
    } catch (error) {
      console.error('Erreur lors de l\'ajout du fichier de dialogue:', error);
      database.close();
      throw error;
    }
  }
  
  // Ajouter un dialogue à un fichier
  static async addDialogue(fileId, dialogueNumber, personneA, personneB, userId) {
    const database = db.getDB();
    
    try {
      // Vérifier d'abord que le fichier appartient à l'utilisateur
      const file = await db.getRow(
        database, 
        'SELECT id FROM dialogues_files WHERE id = ? AND user_id = ?', 
        [fileId, userId]
      );
      
      if (!file) {
        database.close();
        return { status: 'error', message: 'Fichier non trouvé ou accès non autorisé' };
      }
      
      const result = await db.runQuery(
        database,
        'INSERT INTO dialogues (file_id, dialogue_number, personne_a, personne_b) VALUES (?, ?, ?, ?)',
        [fileId, dialogueNumber, personneA, personneB]
      );
      
      database.close();
      return { 
        status: 'success', 
        message: 'Dialogue ajouté avec succès', 
        dialogueId: result.lastID 
      };
    } catch (error) {
      console.error('Erreur lors de l\'ajout du dialogue:', error);
      database.close();
      throw error;
    }
  }
  
  // Ajouter plusieurs dialogues à un fichier
  static async addDialogues(fileId, dialoguesList, userId) {
    const database = db.getDB();
    
    try {
      // Vérifier d'abord que le fichier appartient à l'utilisateur
      const file = await db.getRow(
        database, 
        'SELECT id FROM dialogues_files WHERE id = ? AND user_id = ?', 
        [fileId, userId]
      );
      
      if (!file) {
        database.close();
        return { status: 'error', message: 'Fichier non trouvé ou accès non autorisé' };
      }
      
      for (let i = 0; i < dialoguesList.length; i++) {
        const dialogue = dialoguesList[i];
        await db.runQuery(
          database,
          'INSERT INTO dialogues (file_id, dialogue_number, personne_a, personne_b) VALUES (?, ?, ?, ?)',
          [fileId, i + 1, dialogue.personne_a, dialogue.personne_b]
        );
      }
      
      database.close();
      return { 
        status: 'success', 
        message: `${dialoguesList.length} dialogues ajoutés avec succès` 
      };
    } catch (error) {
      console.error('Erreur lors de l\'ajout des dialogues:', error);
      database.close();
      throw error;
    }
  }
  
  // Supprimer un fichier de dialogue et tous ses dialogues associés
  static async deleteFile(fileId, userId) {
    const database = db.getDB();
    
    try {
      // Vérifier d'abord que le fichier appartient à l'utilisateur
      const file = await db.getRow(
        database, 
        'SELECT id FROM dialogues_files WHERE id = ? AND user_id = ?', 
        [fileId, userId]
      );
      
      if (!file) {
        database.close();
        return { status: 'error', message: 'Fichier non trouvé ou accès non autorisé' };
      }
      
      // Supprimer d'abord les dialogues associés
      await db.runQuery(database, 'DELETE FROM dialogues WHERE file_id = ?', [fileId]);
      
      // Puis supprimer le fichier
      await db.runQuery(database, 'DELETE FROM dialogues_files WHERE id = ? AND user_id = ?', [fileId, userId]);
      
      database.close();
      return { status: 'success', message: 'Fichier et dialogues supprimés avec succès' };
    } catch (error) {
      console.error(`Erreur lors de la suppression du fichier de dialogue ${fileId}:`, error);
      database.close();
      throw error;
    }
  }
  
  // Obtenir les statistiques de dialogues pour un utilisateur
  static async getStats(userId) {
    const database = db.getDB();
    
    try {
      const totalFiles = await db.getRow(
        database, 
        'SELECT COUNT(*) as count FROM dialogues_files WHERE user_id = ?', 
        [userId]
      );
      
      const totalDialogues = await db.getRow(
        database, 
        `SELECT COUNT(*) as count 
         FROM dialogues d 
         JOIN dialogues_files f ON d.file_id = f.id 
         WHERE f.user_id = ?`, 
        [userId]
      );
      
      const recentFiles = await db.getAllRows(
        database, 
        `SELECT * FROM dialogues_files 
         WHERE user_id = ? 
         ORDER BY upload_date DESC 
         LIMIT 5`, 
        [userId]
      );
      
      database.close();
      
      return {
        totalFiles: totalFiles.count,
        totalDialogues: totalDialogues.count,
        recentFiles: recentFiles
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques de dialogues:', error);
      database.close();
      throw error;
    }
  }
}

module.exports = Dialogue;