// models/DialoguePg.js
const fs = require("fs/promises");
const path = require("path");
const pdfParse = require("pdf-parse");
const Anthropic = require("@anthropic-ai/sdk");
const db = require("../config/postgres");

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error("Erreur lors de l'extraction du texte du PDF:", error);
    throw error;
  }
}

function extractDialoguesFromText(text, numDialogues = 3) {
  const dialogues = [];
  const parts = text.split("\n").filter((line) => line.trim() !== "");

  for (let i = 0; i < parts.length - 1; i += 2) {
    const personneA = parts[i];
    const personneB = parts[i + 1];
    dialogues.push({ personneA, personneB });

    if (dialogues.length >= numDialogues) break;
  }

  return dialogues;
}

async function generateDialoguesFromText(originalText, numDialogues = 3) {
  try {
    const prompt = `Tu es un assistant pédagogique spécialisé en espagnol. À partir du texte suivant, génère ${numDialogues} dialogues courts (1 réplique par personne), simples et naturels entre deux personnes. Retourne uniquement les dialogues, sans introduction ni conclusion :\n\n"""${originalText}"""`;

    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 1000,
      temperature: 0.7,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    if (response && response.content && response.content.length > 0) {
      const dialogues = extractDialoguesFromText(
        response.content[0].text,
        numDialogues
      );
      console.log("Dialogue extrait :", dialogues);
      return dialogues;
    } else {
      throw new Error("Format de réponse Claude inattendu");
    }
  } catch (error) {
    console.error("Erreur lors de la génération des dialogues:", error);
    throw error;
  }
}

const DialoguePg = {
  async getAllDialogues() {
    const result = await db.query("SELECT * FROM dialogues ORDER BY id DESC");
    return result.rows;
  },

  async getDialogueById(id) {
    const result = await db.query("SELECT * FROM dialogues WHERE id = $1", [id]);
    return result.rows[0];
  },

  async addDialogues(titre, dialogues) {
    const client = await db.getClient();
    try {
      await client.query("BEGIN");

      const insertDialogueQuery =
        "INSERT INTO dialogues (titre) VALUES ($1) RETURNING id";
      const result = await client.query(insertDialogueQuery, [titre]);
      const dialogueId = result.rows[0].id;

      const insertLineQuery =
        "INSERT INTO lignes (dialogue_id, personne, texte, ordre) VALUES ($1, $2, $3, $4)";

      let order = 0;
      for (const pair of dialogues) {
        await client.query(insertLineQuery, [
          dialogueId,
          "A",
          pair.personneA,
          order++,
        ]);
        await client.query(insertLineQuery, [
          dialogueId,
          "B",
          pair.personneB,
          order++,
        ]);
      }

      await client.query("COMMIT");
      return dialogueId;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Erreur lors de l'ajout des dialogues:", error);
      throw error;
    } finally {
      client.release();
    }
  },

  async processAndGenerateDialoguesFromPDF(filePath, titre) {
    try {
      const texte = await extractTextFromPDF(filePath);
      const dialogues = await generateDialoguesFromText(texte);
      const id = await DialoguePg.addDialogues(titre, dialogues);
      return id;
    } catch (error) {
      console.error("Erreur lors du traitement du PDF et de la génération des dialogues:", error);
      throw error;
    }
  },
};

module.exports = DialoguePg;
