const fs = require("fs/promises");
const path = require("path");
const pdfParse = require("pdf-parse");
const Anthropic = require("@anthropic-ai/sdk");
const db = require("../config/postgres");

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

async function extractTextFromPDF(filePath) {
  const dataBuffer = await fs.readFile(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

function extractDialoguesFromText(text, numDialogues = 3) {
  const dialogues = [];
  const parts = text.split("\n").filter(line => line.trim() !== "");
  for (let i = 0; i < parts.length - 1; i += 2) {
    dialogues.push({ personneA: parts[i], personneB: parts[i + 1] });
    if (dialogues.length >= numDialogues) break;
  }
  return dialogues;
}

async function generateDialoguesFromText(originalText, numDialogues = 3) {
  const prompt = `Tu es un assistant pédagogique spécialisé en espagnol. À partir du texte suivant, génère ${numDialogues} dialogues courts (1 réplique par personne), simples et naturels entre deux personnes. Retourne uniquement les dialogues, sans introduction ni conclusion :\n\n"""${originalText}"""`;

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1000,
    temperature: 0.7,
    messages: [{ role: "user", content: prompt }],
  });

  if (response && response.content && response.content.length > 0) {
    return extractDialoguesFromText(response.content[0].text, numDialogues);
  }
  throw new Error("Format de réponse Claude inattendu");
}

const DialoguePg = {
  async getAllDialogues(userId) {
    const result = await db.query(
      "SELECT * FROM dialogues WHERE user_id = $1 ORDER BY id DESC",
      [userId]
    );
    return result.rows;
  },

  async getDialogueById(id) {
    const result = await db.query("SELECT * FROM dialogues WHERE id = $1", [id]);
    return result.rows[0];
  },

  async addDialogues(titre, dialogues, userId) {
    const client = await db.getClient();
    try {
      await client.query("BEGIN");

      const insertDialogueQuery = `
        INSERT INTO dialogues (titre, user_id)
        VALUES ($1, $2)
        RETURNING id
      `;
      const result = await client.query(insertDialogueQuery, [titre, userId]);
      const dialogueId = result.rows[0].id;

      const insertLineQuery = `
        INSERT INTO lignes (dialogue_id, personne, texte, ordre)
        VALUES ($1, $2, $3, $4)
      `;

      let order = 0;
      for (const pair of dialogues) {
        await client.query(insertLineQuery, [dialogueId, "A", pair.personneA, order++]);
        await client.query(insertLineQuery, [dialogueId, "B", pair.personneB, order++]);
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

  async processAndGenerateDialoguesFromPDF(filePath, titre, userId) {
    const texte = await extractTextFromPDF(filePath);
    const dialogues = await generateDialoguesFromText(texte);
    return await DialoguePg.addDialogues(titre, dialogues, userId);
  },
};

module.exports = DialoguePg;
