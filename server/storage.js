const fs = require("fs");
const os = require("os");
const path = require("path");
const { sanitizeFileName } = require("./security");

function ensureUploadDirectory() {
  const downloadDir = path.join(os.homedir(), "Downloads", "LocalDrop");
  fs.mkdirSync(downloadDir, { recursive: true });
  return downloadDir;
}

function buildUniqueFilePath(directory, fileName) {
  const sanitized = sanitizeFileName(fileName);
  const ext = path.extname(sanitized);
  const baseName = path.basename(sanitized, ext);
  let attempt = 0;
  let candidate = sanitized;

  while (fs.existsSync(path.join(directory, candidate))) {
    attempt += 1;
    candidate = `${baseName}-${attempt}${ext}`;
  }

  return {
    fileName: candidate,
    filePath: path.join(directory, candidate)
  };
}

function listReceivedFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const absolutePath = path.join(directory, entry.name);
      const stats = fs.statSync(absolutePath);

      return {
        name: entry.name,
        size: stats.size,
        receivedAt: stats.birthtime.toISOString()
      };
    })
    .sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
}

function ensureSharedDirectory() {
  const sharedDir = path.join(os.tmpdir(), "LocalDrop-Shared");
  fs.mkdirSync(sharedDir, { recursive: true });
  return sharedDir;
}

function listSharedFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const absolutePath = path.join(directory, entry.name);
      const stats = fs.statSync(absolutePath);

      return {
        name: entry.name,
        size: stats.size,
        sharedAt: stats.birthtime.toISOString()
      };
    })
    .sort((a, b) => new Date(b.sharedAt) - new Date(a.sharedAt));
}

module.exports = {
  buildUniqueFilePath,
  ensureUploadDirectory,
  listReceivedFiles,
  ensureSharedDirectory,
  listSharedFiles
};

