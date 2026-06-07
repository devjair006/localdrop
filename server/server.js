const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const {
  buildUniqueFilePath,
  ensureUploadDirectory,
  listReceivedFiles
} = require("./storage");
const { findAvailablePort, getLocalIpAddress } = require("./network");
const { generatePin, isValidPin } = require("./security");

async function startServer() {
  const app = express();
  const uploadDir = ensureUploadDirectory();
  const localIp = getLocalIpAddress();
  const port = await findAvailablePort(3030);
  const pin = generatePin();

  app.use(cors());
  app.use(express.json());
  app.use("/mobile", express.static(path.join(__dirname, "../public/mobile")));

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const { fileName } = buildUniqueFilePath(uploadDir, file.originalname);
      cb(null, fileName);
    }
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: 1024 * 1024 * 1024
    }
  });

  app.get("/", (_req, res) => {
    res.redirect("/mobile/");
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "active" });
  });

  app.get("/api/info", (_req, res) => {
    res.json({
      appName: "LocalDrop",
      status: "active",
      localIp,
      port,
      url: `http://${localIp}:${port}`,
      mobileUrl: `http://${localIp}:${port}/mobile/`,
      pin,
      uploadDir,
      files: listReceivedFiles(uploadDir)
    });
  });

  app.post("/api/upload", (req, res, next) => {
    const submittedPin = req.headers["x-localdrop-pin"];

    if (!isValidPin(submittedPin, pin)) {
      res.status(401).json({
        ok: false,
        error: "PIN invalido. Verifica el codigo temporal en la app."
      });
      return;
    }

    next();
  });

  app.post("/api/upload", upload.array("files"), (req, res) => {
    if (!req.files?.length) {
      res.status(400).json({
        ok: false,
        error: "No se recibieron archivos."
      });
      return;
    }

    res.json({
      ok: true,
      uploaded: (req.files || []).map((file) => ({
        name: file.filename,
        size: file.size
      }))
    });
  });

  const httpServer = await new Promise((resolve, reject) => {
    const instance = app.listen(port, "0.0.0.0", () => resolve(instance));
    instance.on("error", reject);
  });

  return {
    port,
    pin,
    localIp,
    uploadDir,
    stop: () =>
      new Promise((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      })
  };
}

module.exports = {
  startServer
};
