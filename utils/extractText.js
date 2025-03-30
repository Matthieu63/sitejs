const fs = require("fs/promises");
const pdfParse = require("pdf-parse");

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

module.exports = extractTextFromPDF;
