const form = document.getElementById("upload-form");
const pinInput = document.getElementById("pin");
const filesInput = document.getElementById("files");
const progressBar = document.getElementById("progress-bar");
const uploadStatusNode = document.getElementById("upload-status");
const presenceNode = document.getElementById("presence");
const sessionIdNode = document.getElementById("session-id");
const downloadCardNode = document.getElementById("download-card");
const downloadNameNode = document.getElementById("download-name");
const downloadCountNode = document.getElementById("download-count");
const downloadSizeNode = document.getElementById("download-size");
const downloadRemainingNode = document.getElementById("download-remaining");
const downloadStatusNode = document.getElementById("download-status");
const downloadButton = document.getElementById("download-button");
const downloadPillNode = document.getElementById("download-pill");
const sharedListNode = document.getElementById("shared-list");

const state = {
  deviceName: "dispositivo movil",
  sessionId: null,
  activeTransfer: null,
  lastTransferId: null,
  countdownTimer: null,
  refreshTimer: null,
  acknowledgedTransfers: new Set()
};

let currentPin = "";
const socket = window.io({
  transports: ["websocket", "polling"],
  query: {
    clientType: "mobile"
  }
});

function setUploadStatus(message, tone = "muted") {
  uploadStatusNode.textContent = message;
  uploadStatusNode.dataset.tone = tone;
}

function setDownloadStatus(message, tone = "muted") {
  downloadStatusNode.textContent = message;
  downloadStatusNode.dataset.tone = tone;
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) {
    return "-";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const digits = size >= 10 || unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
}

function formatSessionId(sessionId) {
  if (!sessionId) {
    return "Pendiente";
  }

  if (sessionId.length <= 12) {
    return sessionId;
  }

  return `${sessionId.slice(0, 6)}...${sessionId.slice(-4)}`;
}

function formatRemaining(ms) {
  if (!Number.isFinite(ms)) {
    return "-";
  }

  if (ms <= 0) {
    return "Expirada";
  }

  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function parseExpiry(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 10_000_000_000 ? value : Date.now() + value * 1000;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return parseExpiry(numeric);
    }

    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

function parseDurationMs(value) {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  return Date.now() + duration;
}

function inferTotalSize(candidate, files) {
  const directSize = Number(
    candidate.totalSize ?? candidate.totalBytes ?? candidate.size ?? candidate.bytes ?? 0
  );

  if (Number.isFinite(directSize) && directSize > 0) {
    return directSize;
  }

  return files.reduce((sum, file) => sum + Number(file.size || file.bytes || 0), 0);
}

function inferFileCount(candidate, files) {
  const directCount = Number(candidate.fileCount ?? candidate.totalFiles ?? candidate.count ?? 0);
  if (Number.isFinite(directCount) && directCount > 0) {
    return directCount;
  }

  return files.length || 0;
}

function normalizeTransfer(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload.transfer || payload.outboundTransfer || payload.current || payload.data || payload;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const files = Array.isArray(candidate.files) ? candidate.files : [];
  const transferId = candidate.transferId || candidate.id || payload.transferId || null;
  if (!transferId) {
    return null;
  }

  const expiresAt =
    parseExpiry(candidate.expiresAt) ||
    parseExpiry(candidate.expiresAtMs) ||
    parseDurationMs(candidate.expiresInMs) ||
    parseExpiry(candidate.expiresIn) ||
    parseExpiry(candidate.expiresInSeconds);

  const fileCount = inferFileCount(candidate, files);
  const totalSize = inferTotalSize(candidate, files);
  const name =
    candidate.name ||
    candidate.fileName ||
    candidate.title ||
    candidate.displayName ||
    (fileCount > 1 ? `${fileCount} archivos` : files[0]?.name) ||
    "Transferencia lista";

  return {
    transferId,
    sessionId: candidate.sessionId || candidate.targetSessionId || payload.sessionId || null,
    name,
    fileCount,
    totalSize,
    expiresAt,
    downloadUrl:
      candidate.downloadUrl ||
      candidate.url ||
      candidate.path ||
      `/api/outbound/download/${encodeURIComponent(transferId)}`
  };
}

function reasonMessage(reason) {
  switch ((reason || "").toLowerCase()) {
    case "expired":
      return {
        state: "warning",
        label: "Expirada",
        message: "La transferencia expiro antes de descargarse.",
        tone: "warning"
      };
    case "replaced":
      return {
        state: "warning",
        label: "Reemplazada",
        message: "La transferencia anterior fue reemplazada por una nueva oferta.",
        tone: "warning"
      };
    case "completed":
      return {
        state: "success",
        label: "Completada",
        message: "Descarga completada.",
        tone: "success"
      };
    case "failed":
      return {
        state: "error",
        label: "Error",
        message: "La descarga no pudo completarse.",
        tone: "error"
      };
    default:
      return {
        state: "idle",
        label: "En espera",
        message: "Esperando una transferencia desde la PC.",
        tone: "muted"
      };
  }
}

function clearCountdown() {
  if (state.countdownTimer) {
    window.clearInterval(state.countdownTimer);
    state.countdownTimer = null;
  }
}

function restartRefreshTimer() {
  if (state.refreshTimer) {
    window.clearInterval(state.refreshTimer);
    state.refreshTimer = null;
  }

  if (!state.sessionId) {
    return;
  }

  state.refreshTimer = window.setInterval(() => {
    if (document.hidden) {
      return;
    }

    fetchCurrentTransfer();
  }, 5000);
}

function renderTransferCard(view = {}) {
  const transfer = view.transfer ?? state.activeTransfer;
  const cardState = view.cardState || (transfer ? "offer" : "idle");
  const pill = view.pill || (transfer ? "Lista" : "En espera");
  const statusMessage =
    view.statusMessage || (transfer ? "Archivos listos para descargar." : "Esperando una transferencia desde la PC.");
  const statusTone = view.statusTone || (transfer ? "info" : "muted");

  downloadCardNode.dataset.state = cardState;
  downloadPillNode.textContent = pill;
  setDownloadStatus(statusMessage, statusTone);

  if (!transfer) {
    downloadNameNode.textContent = "Sin transferencia pendiente";
    downloadCountNode.textContent = "-";
    downloadSizeNode.textContent = "-";
    downloadRemainingNode.textContent = "-";
    downloadButton.disabled = true;
    downloadButton.textContent = "Descargar";
    return;
  }

  downloadNameNode.textContent = transfer.name;
  downloadCountNode.textContent = transfer.fileCount ? String(transfer.fileCount) : "-";
  downloadSizeNode.textContent = formatBytes(transfer.totalSize);
  downloadRemainingNode.textContent = transfer.expiresAt
    ? formatRemaining(transfer.expiresAt - Date.now())
    : "Sin limite";
  downloadButton.disabled = false;
  downloadButton.textContent = "Descargar";
}

function setActiveTransfer(transfer, view = {}) {
  clearCountdown();
  state.activeTransfer = transfer;
  if (transfer?.transferId) {
    state.lastTransferId = transfer.transferId;
  }

  renderTransferCard({
    transfer,
    cardState: view.cardState || (transfer ? "offer" : "idle"),
    pill: view.pill || (transfer ? "Lista" : "En espera"),
    statusMessage: view.statusMessage,
    statusTone: view.statusTone
  });

  if (transfer?.expiresAt) {
    state.countdownTimer = window.setInterval(() => {
      if (!state.activeTransfer || state.activeTransfer.transferId !== transfer.transferId) {
        clearCountdown();
        return;
      }

      const remaining = transfer.expiresAt - Date.now();
      if (remaining <= 0) {
        clearTransfer("expired");
        return;
      }

      downloadRemainingNode.textContent = formatRemaining(remaining);
    }, 1000);
  }
}

function clearTransfer(reason = "", options = {}) {
  const { state: cardState, label, message, tone } = reasonMessage(reason);
  clearCountdown();
  state.activeTransfer = null;
  renderTransferCard({
    transfer: null,
    cardState: options.cardState || cardState,
    pill: options.pill || label,
    statusMessage: options.statusMessage || message,
    statusTone: options.statusTone || tone
  });
}

function updatePresence(message) {
  presenceNode.textContent = message;
}

function updateSessionLabel(sessionId) {
  sessionIdNode.textContent = formatSessionId(sessionId);
}

async function fetchCurrentTransfer() {
  if (!state.sessionId) {
    return;
  }

  try {
    const response = await fetch(`/api/outbound/current?sessionId=${encodeURIComponent(state.sessionId)}`, {
      headers: {
        Accept: "application/json"
      }
    });

    if (response.status === 404 || response.status === 204) {
      clearTransfer();
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const transfer = normalizeTransfer(payload);

    if (!transfer) {
      clearTransfer();
      return;
    }

    setActiveTransfer(transfer, {
      statusMessage: "Archivos listos para descargar.",
      statusTone: "info",
      pill: "Lista"
    });
  } catch (error) {
    if (!state.activeTransfer) {
      setDownloadStatus(
        "No se pudo consultar si hay descargas pendientes. Reintentaremos al reconectar.",
        "warning"
      );
      downloadCardNode.dataset.state = "warning";
      downloadPillNode.textContent = "Sin confirmar";
    }
  }
}

async function acknowledgeTransfer(transferId) {
  if (!transferId || state.acknowledgedTransfers.has(transferId)) {
    return;
  }

  try {
    const response = await fetch(`/api/outbound/ack/${encodeURIComponent(transferId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sessionId: state.sessionId
      }),
      keepalive: true
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    state.acknowledgedTransfers.add(transferId);
  } catch {
    setDownloadStatus(
      "La descarga se inicio, pero no pudimos confirmar la recepcion con el servidor.",
      "warning"
    );
    downloadCardNode.dataset.state = "warning";
    downloadPillNode.textContent = "Sin confirmar";
  }
}

function matchesCurrentTransfer(payload) {
  const transferId = payload?.transferId || payload?.id || null;
  if (!transferId) {
    return false;
  }

  return transferId === state.activeTransfer?.transferId || transferId === state.lastTransferId;
}

function isForThisSession(payload) {
  if (!payload || typeof payload !== "object") {
    return true;
  }

  const sessionId = payload.sessionId || payload.targetSessionId || payload.socketId || null;
  if (!sessionId) {
    return true;
  }

  return !state.sessionId || sessionId === state.sessionId;
}

downloadButton.addEventListener("click", async () => {
  const transfer = state.activeTransfer;
  if (!transfer) {
    return;
  }

  const link = document.createElement("a");
  link.href = transfer.downloadUrl || `/api/outbound/download/${encodeURIComponent(transfer.transferId)}`;
  link.rel = "noreferrer";
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();

  downloadButton.disabled = true;
  downloadButton.textContent = "Descarga iniciada";
  downloadCardNode.dataset.state = "offer";
  downloadPillNode.textContent = "Descargando";
  setDownloadStatus(
    "Descarga iniciada. Si el navegador pide confirmacion, acepta la descarga.",
    "info"
  );

  await acknowledgeTransfer(transfer.transferId);
});

socket.on("connect", () => {
  updatePresence("Celular conectado a la sesion LocalDrop.");
});

socket.on("server:snapshot", (snapshot = {}) => {
  const appName = snapshot.appName || "LocalDrop";
  updatePresence(`Conectado a ${appName}. PIN activo listo para validar.`);
  if (typeof renderSharedFiles === "function" && snapshot.sharedFiles) {
    renderSharedFiles(snapshot.sharedFiles);
  }
});

socket.on("presence:ack", async ({ deviceName, sessionId } = {}) => {
  state.deviceName = deviceName || "dispositivo movil";
  state.sessionId = sessionId || socket.id || state.sessionId;
  updatePresence(`${state.deviceName} vinculado con la app de escritorio.`);
  updateSessionLabel(state.sessionId);
  restartRefreshTimer();
  await fetchCurrentTransfer();
});

socket.on("outbound:offered", async (payload) => {
  if (!isForThisSession(payload)) {
    return;
  }

  const transfer = normalizeTransfer(payload);
  if (!transfer) {
    await fetchCurrentTransfer();
    return;
  }

  const replaced = state.activeTransfer && state.activeTransfer.transferId !== transfer.transferId;
  setActiveTransfer(transfer, {
    statusMessage: replaced
      ? "La PC reemplazo la transferencia anterior. Esta es la oferta mas reciente."
      : "Archivos listos para descargar.",
    statusTone: replaced ? "warning" : "info",
    pill: replaced ? "Nueva oferta" : "Lista"
  });
});

socket.on("outbound:cleared", (payload = {}) => {
  if (!isForThisSession(payload)) {
    return;
  }

  if (payload.transferId && !matchesCurrentTransfer(payload)) {
    return;
  }

  clearTransfer(payload.reason || "");
});

socket.on("download:started", (payload = {}) => {
  if (!matchesCurrentTransfer(payload) || !isForThisSession(payload)) {
    return;
  }

  if (!state.activeTransfer) {
    clearTransfer("", {
      cardState: "warning",
      pill: "En curso",
      statusMessage: "La descarga se inicio, pero la oferta ya no esta disponible en pantalla.",
      statusTone: "warning"
    });
    return;
  }

  downloadButton.disabled = true;
  downloadButton.textContent = "Descarga iniciada";
  downloadCardNode.dataset.state = "offer";
  downloadPillNode.textContent = "Descargando";
  setDownloadStatus(
    "La PC ya esta sirviendo la descarga. Revisa la bandeja del navegador si no aparece.",
    "info"
  );
});

socket.on("download:completed", (payload = {}) => {
  if (!matchesCurrentTransfer(payload) || !isForThisSession(payload)) {
    return;
  }

  if (!state.activeTransfer) {
    clearTransfer("completed");
    return;
  }

  downloadCardNode.dataset.state = "success";
  downloadPillNode.textContent = "Descargado";
  downloadButton.disabled = false;
  downloadButton.textContent = "Descargar de nuevo";
  setDownloadStatus("Descarga completada.", "success");
});

socket.on("download:failed", (payload = {}) => {
  if (!matchesCurrentTransfer(payload) || !isForThisSession(payload)) {
    return;
  }

  if (!state.activeTransfer) {
    clearTransfer("failed");
    return;
  }

  downloadCardNode.dataset.state = "error";
  downloadPillNode.textContent = "Error";
  downloadButton.disabled = false;
  downloadButton.textContent = "Reintentar descarga";
  setDownloadStatus(
    payload.error || "La descarga fallo. Intenta de nuevo o pide a la PC crear otra transferencia.",
    "error"
  );
});

pinInput.addEventListener("input", () => {
  currentPin = pinInput.value.trim();
});

function formatBytes(bytes) {
  if (!bytes) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function renderSharedFiles(files) {
  if (!files?.length) {
    sharedListNode.innerHTML = '<li class="shared-empty">No hay archivos compartidos aun.</li>';
    return;
  }

  sharedListNode.innerHTML = files.map((file) => `
    <li class="shared-item">
      <div class="shared-item-info">
        <span class="shared-item-name">${file.name}</span>
        <span class="shared-item-size">${formatBytes(file.size)}</span>
      </div>
      <button type="button" data-filename="${file.name}">Descargar</button>
    </li>
  `).join("");

  sharedListNode.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      downloadSharedFile(button.dataset.filename);
    });
  });
}

function downloadSharedFile(fileName) {
  if (!currentPin) {
    setUploadStatus("Ingresa el PIN para descargar archivos del PC.", "warning");
    return;
  }

  const encodedName = encodeURIComponent(fileName);
  const downloadUrl = `/api/shared-files/download/${encodedName}?pin=${encodeURIComponent(currentPin)}`;
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setUploadStatus(`Descargando ${fileName}...`, "info");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  currentPin = pinInput.value.trim();

  if (!filesInput.files.length) {
    setUploadStatus("Selecciona al menos un archivo.", "warning");
    return;
  }

  const formData = new FormData();
  Array.from(filesInput.files).forEach((file) => {
    formData.append("files", file);
  });

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/upload");
  xhr.setRequestHeader("x-localdrop-pin", pinInput.value.trim());
  xhr.setRequestHeader("x-localdrop-device-name", state.deviceName);
  setUploadStatus("Validando PIN y preparando transferencia...", "info");
  progressBar.style.width = "0%";
  socket.emit("upload:started", { totalFiles: filesInput.files.length });

  let startTime = Date.now();
  let lastProgressEmit = 0;

  xhr.upload.addEventListener("progress", (progressEvent) => {
    if (!progressEvent.lengthComputable) {
      return;
    }

    const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
    progressBar.style.width = `${percent}%`;
    const elapsedTime = (Date.now() - startTime) / 1000;
    let speedFormatted = "0 B/s";
    if (elapsedTime > 0) {
      const speed = progressEvent.loaded / elapsedTime;
      if (speed < 1024) {
        speedFormatted = `${speed.toFixed(0)} B/s`;
      } else if (speed < 1024 * 1024) {
        speedFormatted = `${(speed / 1024).toFixed(1)} KB/s`;
      } else {
        speedFormatted = `${(speed / (1024 * 1024)).toFixed(1)} MB/s`;
      }
    }

    setUploadStatus(`Subiendo... ${percent}% (${speedFormatted})`, "info");

    const now = Date.now();
    if (now - lastProgressEmit < 250) {
      return;
    }
    lastProgressEmit = now;

    socket.emit("upload:progress", {
      progress: percent,
      speed: speedFormatted
    });
  });

  xhr.addEventListener("load", () => {
    progressBar.style.width = "100%";

    if (xhr.status >= 200 && xhr.status < 300) {
      const response = JSON.parse(xhr.responseText);
      setUploadStatus(
        `Transferencia completada. ${response.uploaded.length} archivo(s) recibido(s).`,
        "success"
      );
      form.reset();
      return;
    }

    try {
      const response = JSON.parse(xhr.responseText);
      setUploadStatus(response.error || "No se pudo completar la transferencia.", "error");
    } catch {
      setUploadStatus("No se pudo completar la transferencia.", "error");
    }
  });

  xhr.addEventListener("error", () => {
    setUploadStatus("Error de red. Verifica que el celular este en la misma WiFi.", "error");
  });

  xhr.send(formData);
});

socket.on("disconnect", () => {
  updatePresence("Conexion en tiempo real perdida. Reintentando...");
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && state.sessionId) {
    fetchCurrentTransfer();
  }
});

window.addEventListener("focus", () => {
  if (state.sessionId) {
    fetchCurrentTransfer();
  }
});
