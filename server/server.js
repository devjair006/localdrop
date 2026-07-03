const express = require("express");
const cors = require("cors");
const http = require("http");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");
const {
  buildUniqueFilePath,
  ensureUploadDirectory,
  listReceivedFiles,
  ensureSharedDirectory,
  listSharedFiles
} = require("./storage");
const { findAvailablePort, getLocalIpAddress } = require("./network");
const { generatePin, isValidPin, sanitizeFileName } = require("./security");

async function startServer() {
  const app = express();
  const uploadDir = ensureUploadDirectory();
  const sharedDir = ensureSharedDirectory();

  // Limpiar el almacenamiento temporal de archivos compartidos al iniciar el servidor
  if (fs.existsSync(sharedDir)) {
    fs.readdirSync(sharedDir).forEach((file) => {
      try {
        fs.unlinkSync(path.join(sharedDir, file));
      } catch (err) {
        console.error("Error al limpiar archivo compartido temporal:", err);
      }
    });
  }

  const localIp = getLocalIpAddress();
  const port = await findAvailablePort(3030);
  const pin = generatePin();
  const sessions = new Map();

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

  const sharedStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, sharedDir),
    filename: (_req, file, cb) => {
      const { fileName } = buildUniqueFilePath(sharedDir, file.originalname);
      cb(null, fileName);
    }
  });

  const uploadShared = multer({
    storage: sharedStorage,
    limits: {
      fileSize: 1024 * 1024 * 1024
    }
  });

  function buildSnapshot() {
    return {
      appName: "LocalDrop",
      status: "active",
      localIp,
      port,
      url: `http://${localIp}:${port}`,
      mobileUrl: `http://${localIp}:${port}/mobile/`,
      pin,
      uploadDir,
      connectedDevices: sessions.size,
      files: listReceivedFiles(uploadDir)
    };
  }

  function inferDeviceName(socket) {
    const userAgent = socket.handshake.headers["user-agent"] || "";
    if (/iphone/i.test(userAgent)) {
      return "iPhone";
    }
    if (/ipad/i.test(userAgent)) {
      return "iPad";
    }
    if (/android/i.test(userAgent)) {
      return "Android";
    }
    return "dispositivo movil";
  }

  function broadcastPresence(message) {
    io.emit("presence:update", {
      connectedDevices: sessions.size,
      message
    });
  }

  app.get("/", (_req, res) => {
    res.redirect("/mobile/");
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "active" });
  });

  app.get("/api/info", (_req, res) => {
    res.json(buildSnapshot());
  });

  app.get("/api/shared-files", (_req, res) => {
    res.json(listSharedFiles(sharedDir));
  });

  app.get("/api/shared-files/download/:filename", (req, res) => {
    const submittedPin = req.query.pin || req.headers["x-localdrop-pin"];

    if (!isValidPin(submittedPin, pin)) {
      res.status(401).json({
        ok: false,
        error: "PIN invalido. Verifica el codigo temporal en la app."
      });
      return;
    }

    const { filename } = req.params;
    const safeName = sanitizeFileName(filename);
    const filePath = path.join(sharedDir, safeName);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({
        ok: false,
        error: "Archivo no encontrado."
      });
      return;
    }

    res.download(filePath, safeName);
  });

  app.post("/api/shared-files", uploadShared.array("files"), (req, res) => {
    if (!req.files?.length) {
      res.status(400).json({
        ok: false,
        error: "No se recibieron archivos."
      });
      return;
    }

    res.json({
      ok: true,
      shared: (req.files || []).map((file) => ({
        name: file.filename,
        size: file.size
      }))
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

    const deviceName = req.headers["x-localdrop-device-name"] || "dispositivo movil";
    io.emit("upload:complete", {
      deviceName,
      files: listReceivedFiles(uploadDir)
    });
    broadcastPresence(`Ultima transferencia completada desde ${deviceName}.`);

    res.json({
      ok: true,
      uploaded: (req.files || []).map((file) => ({
        name: file.filename,
        size: file.size
      }))
    });
  });

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*"
    }
  });

  io.on("connection", (socket) => {
    const clientType = socket.handshake.query.clientType;

    socket.emit("server:snapshot", buildSnapshot());

    if (clientType === "mobile") {
      const deviceName = inferDeviceName(socket);
      sessions.set(socket.id, {
        deviceName
      });

      socket.emit("presence:ack", { deviceName });
      broadcastPresence(`${deviceName} conectado y listo para transferir.`);
    }

    socket.on("upload:started", ({ totalFiles }) => {
      const session = sessions.get(socket.id);
      const deviceName = session?.deviceName || "dispositivo movil";

      io.emit("upload:started", {
        deviceName,
        totalFiles
      });
      broadcastPresence(`${deviceName} esta enviando ${totalFiles} archivo(s).`);
    });

    socket.on("upload:progress", (data) => {
      const session = sessions.get(socket.id);
      const deviceName = session?.deviceName || "dispositivo movil";

      io.emit("upload:progress", {
        deviceName,
        progress: data.progress,
        speed: data.speed
      });
    });

    socket.on("disconnect", () => {
      if (sessions.has(socket.id)) {
        const { deviceName } = sessions.get(socket.id);
        sessions.delete(socket.id);
        broadcastPresence(`${deviceName} se desconecto.`);
      }
    });
  });

  await new Promise((resolve, reject) => {
    httpServer.listen(port, "0.0.0.0", () => resolve());
    httpServer.on("error", reject);
  });

  return {
    port,
    pin,
    localIp,
    uploadDir,
    stop: () =>
      new Promise((resolve, reject) => {
        io.close(() => {
          httpServer.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        });
      })
  };
}

module.exports = {
  startServer
};
