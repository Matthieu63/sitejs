const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs/promises");
const DialoguePg = require("../models/DialoguePg");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Voir tous les dialogues
router.get("/", async (req, res) => {
  try {
    const userId = req.session.userId;
    const dialogues = await DialoguePg.getAllDialogues(userId);
    res.render("espagnol/dialogues_index", { dialogues });
  } catch (error) {
    console.error("Erreur lors de la récupération des dialogues:", error);
    res.status(500).send("Erreur serveur");
  }
});

// Voir un dialogue spécifique
router.get("/view/:id", async (req, res) => {
  const userId = req.session.userId; // ou req.user.id selon ton auth
  const dialogueId = await DialoguePg.processAndGenerateDialoguesFromPDF(filePath, originalFilename, userId);
    try {
    const dialogue = await DialoguePg.getDialogueById(dialogueId);
    if (!dialogue) return res.status(404).send("Dialogue introuvable");
    res.render("espagnol/dialogues_view", { dialogue });
  } catch (error) {
    console.error("Erreur lors de l'affichage du dialogue:", error);
    res.status(500).send("Erreur serveur");
  }
});

// Upload PDF & générer dialogues
router.post("/", upload.single("pdfFile"), async (req, res) => {
  const filePath = req.file.path;
  const originalFilename = req.file.originalname;
  const dialogueId = await DialoguePg.processAndGenerateDialoguesFromPDF(filePath, originalFilename, userId);
  const originalFilename = path.basename(req.file.originalname, path.extname(req.file.originalname));

  try {
    const userId = req.session.userId;
    const dialogueId = await DialoguePg.processAndGenerateDialoguesFromPDF(filePath, originalFilename, userId);
    await fs.unlink(filePath); // Supprime le fichier après traitement
    return res.redirect(`/espagnol/dialogues/view/${dialogueId}`);
  } catch (error) {
    console.error("Erreur lors du traitement du PDF:", error);
    res.status(500).send("Erreur serveur lors de la génération du dialogue");
  }
});

module.exports = router;
