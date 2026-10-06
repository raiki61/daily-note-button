function isoDate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function noteFileName(date) {
  return `${isoDate(date)}.md`;
}

function initialContent(date) {
  return `# ${isoDate(date)}\n\n`;
}

module.exports = { isoDate, noteFileName, initialContent };
