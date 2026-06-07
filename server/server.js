const crypto = require("crypto");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const http = require("http");
const multer = require("multer");
const path = require("path");
const { Server } = require("socket.io");
const archiver = require("archiver");
const {
  buildUniqueFilePath,
  ensureUploadDirectory,
  listReceivedFiles
} = require("./storage");
const { findAvailablePort, getLocalIpAddress } = require("./network");
const { generatePin, isValidPin, sanitizeFileName } = require("./security");
const { startDiscovery } = require("./discovery");

const OUTBOUND_TRANSFER_TTL_MS = 10 * 60 * 1000;

function formatTransferFile(filePath) {
  const stats = fs.statSync(filePath);

  if (!stats.isFile()) {
    throw new Error(`Unsupported path selected: ${filePath}`);
  }

  return {
    path: filePath,
    name: sanitizeFileName(path.basename(filePath)),
    size: stats.size
  };
}

function createBundleName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return sanitizeFileName(`localdrop-bundle-${stamp}.zip`);
}

async function startServer() {
  const app = express();
  const uploadDir = ensureUploadDirectory();
  const localIp = getLocalIpAddress();
  const port = await findAvailablePort(3030);
  const pin = generatePin();
  const sessions = new Map();
  const outboundTransfers = new Map();
  const transferIndex = new Map();
  const discoveryState = {
    hostnameUrl: "",
    discoveryStatus: "unavailable",
    serviceName: "LocalDrop"
  };
  let io = null;
  let stopPromise = null;

  app.use(cors());
  app.use(express.json());
  app.use(
    "/mobile",
    express.static(path.join(__dirname, "../public/mobile"), {
      etag: false,
      lastModified: false,
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
    })
  );

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

  function getActiveSessions() {
    return Array.from(sessions.values())
      .map((session) => ({
        sessionId: session.sessionId,
        shortSessionId: session.shortSessionId,
        deviceName: session.deviceName,
        lastSeen: session.lastSeen,
        downloadState: session.downloadState
      }))
      .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
  }

  function getSession(sessionId) {
    return sessions.get(sessionId) || null;
  }

  function buildTransferSummary(transfer) {
    return {
      transferId: transfer.transferId,
      sessionId: transfer.sessionId,
      shortSessionId: transfer.shortSessionId,
      deviceName: transfer.deviceName,
      name:
        transfer.fileCount === 1
          ? transfer.files[0]?.name || transfer.downloadName
          : `${transfer.fileCount} archivos`,
      fileCount: transfer.fileCount,
      totalSize: transfer.totalSize,
      createdAt: transfer.createdAt,
      expiresAt: transfer.expiresAt,
      downloadName: transfer.downloadName,
      downloadUrl: `/api/outbound/download/${transfer.transferId}`,
      transportKind: transfer.transportKind,
      status: transfer.status,
      files: transfer.files.map((file) => ({
        name: file.name,
        size: file.size
      }))
    };
  }

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
      files: listReceivedFiles(uploadDir),
      sessions: getActiveSessions(),
      hostnameUrl: discoveryState.hostnameUrl,
      discoveryStatus: discoveryState.discoveryStatus,
      serviceName: discoveryState.serviceName
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

  function emitSessionList() {
    io?.emit("session:list", getActiveSessions());
  }

  function broadcastPresence(message) {
    io?.emit("presence:update", {
      connectedDevices: sessions.size,
      message
    });
  }

  function updateSessionState(sessionId, downloadState) {
    const session = getSession(sessionId);

    if (!session) {
      return null;
    }

    session.downloadState = downloadState;
    session.lastSeen = new Date().toISOString();
    emitSessionList();
    return session;
  }

  function emitDiscoveryUpdate() {
    io?.emit("discovery:update", {
      hostnameUrl: discoveryState.hostnameUrl,
      discoveryStatus: discoveryState.discoveryStatus,
      serviceName: discoveryState.serviceName
    });
  }

  function clearTransferTimer(transfer) {
    if (transfer?.expirationTimer) {
      clearTimeout(transfer.expirationTimer);
    }
  }

  function getTransferById(transferId) {
    const sessionId = transferIndex.get(transferId);

    if (!sessionId) {
      return null;
    }

    return outboundTransfers.get(sessionId) || null;
  }

  function emitTransferCleared(transfer, reason, message) {
    const payload = {
      sessionId: transfer.sessionId,
      transferId: transfer.transferId,
      reason,
      message
    };

    const targetSession = getSession(transfer.sessionId);
    if (targetSession) {
      io?.to(targetSession.socketId).emit("outbound:cleared", payload);
    }

    io?.emit("outbound:cleared", payload);
  }

  function removeTransfer(sessionId, reason, message) {
    const transfer = outboundTransfers.get(sessionId);

    if (!transfer) {
      return null;
    }

    clearTransferTimer(transfer);
    outboundTransfers.delete(sessionId);
    transferIndex.delete(transfer.transferId);
    emitTransferCleared(transfer, reason, message);
    updateSessionState(sessionId, "idle");
    return transfer;
  }

  function expireTransfer(sessionId) {
    const transfer = outboundTransfers.get(sessionId);

    if (!transfer) {
      return;
    }

    transfer.status = "expired";
    removeTransfer(sessionId, "expired", `La oferta para ${transfer.deviceName} expiro.`);
  }

  function emitTransferOffered(transfer) {
    const payload = buildTransferSummary(transfer);
    const targetSession = getSession(transfer.sessionId);

    if (targetSession) {
      io?.to(targetSession.socketId).emit("outbound:offered", payload);
    }

    io?.emit("outbound:offered", payload);
  }

  function createOutboundTransfer({ targetSessionId, filePaths }) {
    const session = getSession(targetSessionId);

    if (!session) {
      throw new Error("La sesion movil ya no esta disponible.");
    }

    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      throw new Error("No se seleccionaron archivos para enviar.");
    }

    const files = filePaths.map(formatTransferFile);
    const fileCount = files.length;
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const transfer = {
      transferId: crypto.randomUUID(),
      sessionId: session.sessionId,
      shortSessionId: session.shortSessionId,
      deviceName: session.deviceName,
      files,
      fileCount,
      totalSize,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + OUTBOUND_TRANSFER_TTL_MS).toISOString(),
      downloadName: fileCount === 1 ? files[0].name : createBundleName(),
      transportKind: fileCount === 1 ? "single" : "zip",
      status: "offered",
      expirationTimer: null
    };

    if (outboundTransfers.has(targetSessionId)) {
      removeTransfer(
        targetSessionId,
        "replaced",
        `Se reemplazo la oferta anterior para ${session.deviceName}.`
      );
    }

    transfer.expirationTimer = setTimeout(
      () => expireTransfer(targetSessionId),
      OUTBOUND_TRANSFER_TTL_MS
    );
    transfer.expirationTimer.unref?.();

    outboundTransfers.set(targetSessionId, transfer);
    transferIndex.set(transfer.transferId, targetSessionId);
    updateSessionState(targetSessionId, "offered");
    emitTransferOffered(transfer);
    broadcastPresence(`Oferta lista para ${session.deviceName}.`);

    return buildTransferSummary(transfer);
  }

  function ensureTransferDownloadable(transfer) {
    if (!transfer) {
      return { errorCode: 404, message: "No se encontro la transferencia solicitada." };
    }

    if (new Date(transfer.expiresAt).getTime() <= Date.now()) {
      expireTransfer(transfer.sessionId);
      return { errorCode: 410, message: "La transferencia expiro." };
    }

    if (!getSession(transfer.sessionId)) {
      return { errorCode: 410, message: "La sesion movil ya no esta disponible." };
    }

    return null;
  }

  const discovery = await startDiscovery({
    port,
    onStatusChange: (state) => {
      discoveryState.hostnameUrl = state.hostnameUrl;
      discoveryState.discoveryStatus = state.discoveryStatus;
      discoveryState.serviceName = state.serviceName;
      emitDiscoveryUpdate();
    }
  });

  discoveryState.hostnameUrl = discovery.hostnameUrl;
  discoveryState.discoveryStatus = discovery.discoveryStatus;
  discoveryState.serviceName = discovery.serviceName;

  app.get("/", (_req, res) => {
    res.redirect("/mobile/");
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "active" });
  });

  app.get("/api/info", (_req, res) => {
    res.json(buildSnapshot());
  });

  app.get("/api/sessions", (_req, res) => {
    res.json({
      sessions: getActiveSessions()
    });
  });

  app.get("/api/outbound/current", (req, res) => {
    const sessionId = String(req.query.sessionId || "");

    if (!sessionId) {
      res.status(400).json({
        ok: false,
        error: "Debes indicar sessionId."
      });
      return;
    }

    const transfer = outboundTransfers.get(sessionId);

    if (!transfer) {
      res.json({
        ok: true,
        transfer: null
      });
      return;
    }

    const issue = ensureTransferDownloadable(transfer);

    if (issue) {
      res.json({
        ok: true,
        transfer: null
      });
      return;
    }

    res.json({
      ok: true,
      transfer: buildTransferSummary(transfer)
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
    io?.emit("upload:complete", {
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

  app.get("/api/outbound/download/:transferId", (req, res) => {
    const transfer = getTransferById(req.params.transferId);
    const issue = ensureTransferDownloadable(transfer);

    if (issue) {
      res.status(issue.errorCode).json({
        ok: false,
        error: issue.message
      });
      return;
    }

    updateSessionState(transfer.sessionId, "downloading");
    transfer.status = "downloading";

    io?.emit("download:started", {
      sessionId: transfer.sessionId,
      transferId: transfer.transferId,
      deviceName: transfer.deviceName,
      downloadName: transfer.downloadName
    });
    broadcastPresence(`${transfer.deviceName} inicio la descarga.`);

    let streamHandled = false;
    const failTransfer = (reason) => {
      if (streamHandled) {
        return;
      }

      streamHandled = true;
      transfer.status = "failed";
      updateSessionState(transfer.sessionId, "failed");
      io?.emit("download:failed", {
        sessionId: transfer.sessionId,
        transferId: transfer.transferId,
        deviceName: transfer.deviceName,
        reason
      });
      broadcastPresence(`La descarga para ${transfer.deviceName} fallo.`);
    };

    if (transfer.transportKind === "single") {
      const file = transfer.files[0];

      if (!fs.existsSync(file.path)) {
        failTransfer("missing-file");
        res.status(410).json({
          ok: false,
          error: "El archivo original ya no esta disponible en la computadora."
        });
        return;
      }

      res.download(file.path, file.name, (error) => {
        if (error && !res.headersSent) {
          failTransfer("download-error");
          res.status(500).json({
            ok: false,
            error: "No se pudo preparar la descarga."
          });
          return;
        }

        if (error) {
          failTransfer("download-error");
        }
      });

      return;
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${transfer.downloadName}"`);

    const archive = archiver("zip", {
      zlib: { level: 9 }
    });

    archive.on("warning", (error) => {
      if (error.code !== "ENOENT") {
        failTransfer("archive-warning");
        res.destroy(error);
      }
    });

    archive.on("error", (error) => {
      failTransfer("archive-error");
      res.destroy(error);
    });

    res.on("close", () => {
      if (!res.writableEnded) {
        failTransfer("connection-closed");
        archive.abort();
      }
    });

    archive.pipe(res);

    transfer.files.forEach((file) => {
      archive.file(file.path, { name: file.name });
    });

    archive.finalize();
  });

  app.post("/api/outbound/ack/:transferId", (req, res) => {
    const transfer = getTransferById(req.params.transferId);
    const issue = ensureTransferDownloadable(transfer);

    if (issue) {
      res.status(issue.errorCode).json({
        ok: false,
        error: issue.message
      });
      return;
    }

    transfer.status = "completed";
    updateSessionState(transfer.sessionId, "completed");

    io?.emit("download:completed", {
      sessionId: transfer.sessionId,
      transferId: transfer.transferId,
      deviceName: transfer.deviceName,
      downloadName: transfer.downloadName
    });
    broadcastPresence(`${transfer.deviceName} completo la descarga.`);

    res.json({
      ok: true,
      transfer: buildTransferSummary(transfer)
    });
  });

  const httpServer = http.createServer(app);
  io = new Server(httpServer, {
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
        sessionId: socket.id,
        shortSessionId: socket.id.slice(-6),
        socketId: socket.id,
        deviceName,
        lastSeen: new Date().toISOString(),
        downloadState: "idle"
      });

      socket.emit("presence:ack", {
        deviceName,
        sessionId: socket.id,
        shortSessionId: socket.id.slice(-6)
      });
      emitSessionList();
      broadcastPresence(`${deviceName} conectado y listo para transferir.`);
    }

    socket.on("upload:started", ({ totalFiles }) => {
      const session = sessions.get(socket.id);
      const deviceName = session?.deviceName || "dispositivo movil";

      if (session) {
        session.lastSeen = new Date().toISOString();
        emitSessionList();
      }

      io.emit("upload:started", {
        deviceName,
        totalFiles
      });
      broadcastPresence(`${deviceName} esta enviando ${totalFiles} archivo(s).`);
    });

    socket.on("disconnect", () => {
      if (sessions.has(socket.id)) {
        const { deviceName } = sessions.get(socket.id);
        removeTransfer(
          socket.id,
          "session-disconnected",
          `${deviceName} se desconecto y la oferta saliente se invalido.`
        );
        sessions.delete(socket.id);
        emitSessionList();
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
    hostnameUrl: discoveryState.hostnameUrl,
    discoveryStatus: discoveryState.discoveryStatus,
    serviceName: discoveryState.serviceName,
    getSnapshot: () => buildSnapshot(),
    createOutboundTransfer,
    stop: () => {
      if (stopPromise) {
        return stopPromise;
      }

      stopPromise = new Promise((resolve, reject) => {
        const finish = () => {
          discovery.stop().finally(() => resolve());
        };

        const closeHttpServer = () => {
          httpServer.close((error) => {
            if (error && error.code !== "ERR_SERVER_NOT_RUNNING") {
              reject(error);
              return;
            }

            finish();
          });
        };

        if (io) {
          io.close(() => closeHttpServer());
          return;
        }

        closeHttpServer();
      });

      return stopPromise;
    }
  };
}

module.exports = {
  startServer
};
