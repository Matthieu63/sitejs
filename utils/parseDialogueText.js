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

module.exports = extractDialoguesFromText;
