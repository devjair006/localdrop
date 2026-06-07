const path = require("path");

function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function sanitizeFileName(originalName) {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);
  const cleanBase = baseName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const cleanExt = ext.replace(/[^\w.]/g, "").slice(0, 16);

  return `${cleanBase || "file"}${cleanExt}`;
}

function isValidPin(candidate, expectedPin) {
  return typeof candidate === "string" && candidate.trim() === expectedPin;
}

module.exports = {
  generatePin,
  isValidPin,
  sanitizeFileName
};
