const Anthropic = require("@anthropic-ai/sdk");
const extractDialoguesFromText = require("./parseDialogueText");

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

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

    if (response && response.content?.length > 0) {
      const dialogues = extractDialoguesFromText(response.content[0].text, numDialogues);
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

module.exports = generateDialoguesFromText;
