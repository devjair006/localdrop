import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import QRCard from "./components/QRCard";
import ServerStatus from "./components/ServerStatus";
import FileList from "./components/FileList";
import SendToPhone from "./components/SendToPhone";
import SettingsPanel from "./components/SettingsPanel";
import TitleBar from "./components/TitleBar";

const TRANSFER_STATUS_LABELS = {
  offered: "Oferta lista",
  started: "Descarga iniciada",
  completed: "Descarga completada",
  failed: "Descarga fallida",
  expired: "Oferta expirada",
  replaced: "Oferta reemplazada",
  cleared: "Oferta cerrada",
  cancelled: "Oferta cancelada",
  idle: "Sin transferencia"
};

function formatBytes(bytes) {
  if (!bytes) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatDateTime(value) {
  if (!value) {
    return "Sin actividad reciente";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sin actividad reciente";
  }

  return date.toLocaleString();
}

function formatRelativeTime(value) {
  if (!value) {
    return "sin fecha";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "sin fecha";
  }

  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absMs < minute) {
    return diffMs >= 0 ? "en menos de 1 min" : "hace menos de 1 min";
  }

  if (absMs < hour) {
    const minutes = Math.round(absMs / minute);
    return diffMs >= 0 ? `en ${minutes} min` : `hace ${minutes} min`;
  }

  if (absMs < day) {
    const hours = Math.round(absMs / hour);
    return diffMs >= 0 ? `en ${hours} h` : `hace ${hours} h`;
  }

  const days = Math.round(absMs / day);
  return diffMs >= 0 ? `en ${days} dia(s)` : `hace ${days} dia(s)`;
}

function toMobileUrl(rawUrl) {
  if (!rawUrl) {
    return "";
  }

  try {
    const parsed = new URL(rawUrl);

    if (!parsed.pathname || parsed.pathname === "/") {
      parsed.pathname = "/mobile/";
    } else if (parsed.pathname === "/mobile") {
      parsed.pathname = "/mobile/";
    }

    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function normalizeFiles(files) {
  return (files || []).map((file) => ({
    ...file,
    prettySize: formatBytes(file.size)
  }));
}

function normalizeTransferStatus(status) {
  const rawValue = `${status || ""}`.trim().toLowerCase();

  switch (rawValue) {
    case "pending":
    case "ready":
    case "offered":
      return "offered";
    case "started":
    case "downloading":
    case "download:started":
      return "started";
    case "completed":
    case "downloaded":
    case "download:completed":
      return "completed";
    case "error":
    case "failed":
    case "download:failed":
      return "failed";
    case "expired":
      return "expired";
    case "replaced":
      return "replaced";
    case "session-disconnected":
    case "session_lost":
    case "disconnected":
      return "cleared";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "cleared":
      return "cleared";
    default:
      return rawValue || "idle";
  }
}

function normalizeSessions(input) {
  const rawSessions = Array.isArray(input) ? input : Array.isArray(input?.sessions) ? input.sessions : [];

  return rawSessions
    .map((session, index) => {
      const sessionId = session.sessionId || session.id || session.socketId || `session-${index}`;

      if (!sessionId) {
        return null;
      }

      return {
        sessionId,
        deviceName: session.deviceName || session.name || "Celular",
        shortSessionId: session.shortSessionId || sessionId.slice(0, 6),
        downloadState: normalizeTransferStatus(session.downloadState || session.state || "idle"),
        lastSeen: session.lastSeen || session.updatedAt || session.connectedAt || null
      };
    })
    .filter(Boolean);
}

function normalizeTransfer(payload, fallbackStatus) {
  if (!payload) {
    return null;
  }

  const source = payload.transfer && typeof payload.transfer === "object" ? payload.transfer : payload;
  const rawFiles = Array.isArray(source.files) ? source.files : Array.isArray(payload.files) ? payload.files : [];
  const fileNames = rawFiles
    .map((file) => (typeof file === "string" ? file : file?.name || file?.fileName || file?.filename))
    .filter(Boolean);
  const derivedSize = rawFiles.reduce((total, file) => total + (Number(file?.size) || 0), 0);
  const explicitFileCount =
    source.totalFiles ?? source.fileCount ?? payload.totalFiles ?? payload.fileCount;
  const fallbackFileCount = fileNames.length || (source.fileName || payload.fileName ? 1 : 0);
  const transferId = source.transferId || source.id || payload.transferId || "";

  if (!transferId) {
    return null;
  }

  return {
    transferId,
    sessionId: source.targetSessionId || source.sessionId || payload.targetSessionId || payload.sessionId || "",
    deviceName: source.deviceName || payload.deviceName || "",
    fileName: source.fileName || source.name || payload.fileName || "",
    fileNames,
    archiveName: source.archiveName || payload.archiveName || "",
    totalFiles: Number(explicitFileCount ?? fallbackFileCount) || 0,
    totalSize: Number(source.totalSize ?? payload.totalSize ?? source.size ?? payload.size ?? derivedSize) || 0,
    createdAt: source.createdAt || payload.createdAt || null,
    expiresAt: source.expiresAt || payload.expiresAt || null,
    reason: source.reason || payload.reason || "",
    status: normalizeTransferStatus(
      source.status || payload.status || source.downloadState || payload.downloadState || fallbackStatus
    )
  };
}

function mergeTransferState(current, next, fallbackStatus) {
  if (!current && !next) {
    return null;
  }

  const incoming = next || {};
  return {
    ...current,
    ...incoming,
    fileNames: incoming.fileNames?.length ? incoming.fileNames : current?.fileNames || [],
    totalFiles: incoming.totalFiles ?? current?.totalFiles ?? 0,
    totalSize: incoming.totalSize ?? current?.totalSize ?? 0,
    status: normalizeTransferStatus(incoming.status || fallbackStatus || current?.status)
  };
}

function normalizeServerInfo(info, meta = {}) {
  const sessions = normalizeSessions(info.sessions || info.activeSessions);
  const mobileUrl = toMobileUrl(info.mobileUrl || info.url || meta.mobileUrl || meta.serverUrl);
  const hostnameUrl = toMobileUrl(info.hostnameUrl || meta.hostnameUrl);

  return {
    ...info,
    uploadDir: info.uploadDir || meta.downloadsDir || "",
    mobileUrl,
    hostnameUrl,
    serviceName: info.serviceName || meta.serviceName || "LocalDrop",
    discoveryStatus: info.discoveryStatus || meta.discoveryStatus || (hostnameUrl ? "published" : "pending"),
    localIp: info.localIp || meta.localIp || "",
    port: info.port || meta.port || "",
    sessions,
    connectedDevices: sessions.length || Number(info.connectedDevices) || 0,
    files: normalizeFiles(info.files)
  };
}

function mergeServerInfo(current, partial, meta) {
  const nextPartial = partial || {};
  const merged = {
    ...(current || {}),
    ...nextPartial
  };

  if (nextPartial.files === undefined && current?.files) {
    merged.files = current.files;
  }

  if (nextPartial.sessions === undefined && current?.sessions) {
    merged.sessions = current.sessions;
  }

  return normalizeServerInfo(merged, meta);
}

function updateSessionsDownloadState(sessions, sessionId, nextState) {
  if (!Array.isArray(sessions) || !sessionId) {
    return sessions || [];
  }

  return sessions.map((session) =>
    session.sessionId === sessionId
      ? {
          ...session,
          downloadState: normalizeTransferStatus(nextState),
          lastSeen: new Date().toISOString()
        }
      : session
  );
}

function getSessionStateLabel(state) {
  switch (normalizeTransferStatus(state)) {
    case "offered":
      return "Oferta lista";
    case "started":
      return "Descargando";
    case "completed":
      return "Completada";
    case "failed":
      return "Error";
    case "expired":
      return "Expirada";
    case "replaced":
      return "Reemplazada";
    default:
      return "En espera";
  }
}

function getTransferTone(status) {
  switch (normalizeTransferStatus(status)) {
    case "completed":
      return "success";
    case "failed":
    case "expired":
      return "danger";
    case "started":
      return "accent";
    default:
      return "neutral";
  }
}

function getTransferHeadline(transfer) {
  if (!transfer) {
    return "Sin transferencia pendiente";
  }

  if (transfer.totalFiles > 1) {
    return transfer.archiveName || `${transfer.totalFiles} archivos listos para descargar`;
  }

  return transfer.fileName || transfer.fileNames?.[0] || "Archivo preparado para descargar";
}

function getTransferStatusText(status) {
  return TRANSFER_STATUS_LABELS[normalizeTransferStatus(status)] || "Transferencia en curso";
}

function getClearReasonText(reason) {
  const value = `${reason || ""}`.trim().toLowerCase();

  switch (value) {
    case "expired":
      return "La oferta ya expiro en el servidor.";
    case "replaced":
      return "La oferta fue reemplazada por una nueva seleccion de archivos.";
    case "session_lost":
    case "disconnected":
    case "session-disconnected":
      return "La sesion movil se desconecto antes de completar la descarga.";
    default:
      return reason || "";
  }
}

function buildSessionMessage(sessions) {
  if (!sessions.length) {
    return "Esperando que un celular abra el enlace";
  }

  if (sessions.length === 1) {
    return `${sessions[0].deviceName} conectado y listo para transferir.`;
  }

  return `${sessions.length} sesiones moviles activas.`;
}

function buildFeatureTiles(serverInfo, sessions, activeQrMode, transfer) {
  const entryUrl = activeQrMode === "hostname" ? serverInfo?.hostnameUrl : serverInfo?.mobileUrl;

  return [
    {
      id: "route",
      tone: "gold",
      eyebrow: activeQrMode === "hostname" ? "Ruta .local" : "Ruta principal",
      title: activeQrMode === "hostname" ? "Abre por alias LAN" : "Escanea y conecta",
      body: entryUrl || "Esperando URL local...",
      meta: sessions.length ? `${sessions.length} sesion(es) activas` : "Sin sesiones conectadas"
    },
    {
      id: "pin",
      tone: "orange",
      eyebrow: "Acceso temporal",
      title: serverInfo?.pin || "-- ----",
      body: "Comparte este PIN solo mientras dure la sesion. Se valida antes de cualquier subida.",
      meta: serverInfo?.discoveryStatus === "published" ? "Alias .local publicado" : "Fallback por IP"
    },
    {
      id: "transfer",
      tone: "cyan",
      eyebrow: "Transferencia activa",
      title: transfer ? getTransferHeadline(transfer) : "Listo para compartir",
      body: transfer
        ? `${transfer.totalFiles || 0} archivo(s) · ${formatBytes(transfer.totalSize)}`
        : "Elige una sesion movil y prepara una descarga desde la computadora.",
      meta: transfer ? getTransferStatusText(transfer.status) : "Sin oferta pendiente"
    }
  ];
}

function OutboundTransferSection({
  sessions,
  selectedSessionId,
  onSessionChange,
  onCreateTransfer,
  transfer,
  isCreatingTransfer,
  outboundError,
  supportsOutboundPicker
}) {
  const selectedSession = sessions.find((session) => session.sessionId === selectedSessionId) || null;
  const transferSession = sessions.find((session) => session.sessionId === transfer?.sessionId) || selectedSession;
  const hasSessions = sessions.length > 0;
  const requiresExplicitSelection = sessions.length > 1;
  const canSubmit = hasSessions && Boolean(selectedSessionId) && supportsOutboundPicker && !isCreatingTransfer;
  const tone = getTransferTone(transfer?.status);
  const helperMessage = outboundError
    ? outboundError
    : !hasSessions
      ? "Abre LocalDrop en tu celular para habilitar descargas desde la PC."
      : requiresExplicitSelection && !selectedSessionId
        ? "Selecciona una sesion movil antes de abrir el selector de archivos."
        : !supportsOutboundPicker
          ? "El puente Electron todavia no expone createOutboundTransfer(targetSessionId)."
          : "La seleccion de archivos se hace con el dialogo nativo del sistema.";

  return (
    <section className="p-5 md:p-6 rounded-[26px] bg-[#1a1214] border border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-[#ffcf76] text-[0.74rem] tracking-[0.12em] uppercase">Envio · Relay por sesion</span>
        <h2 className="text-2xl font-bold">Enviar al celular</h2>
        <p className="text-[#bdaea0] leading-relaxed">Prepara una descarga para una sesion movil activa con un flujo claro y manual.</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <span className="text-[#a19286] font-semibold text-sm">Sesion de destino</span>
        </div>
        <button
          className="px-4 py-3 rounded-xl bg-gradient-to-br from-[#ffe06b] to-[#58efce] text-[#170d07] font-bold disabled:opacity-60 disabled:cursor-not-allowed transition-transform hover:-translate-y-px"
          disabled={!canSubmit}
          onClick={onCreateTransfer}
          type="button"
        >
          {isCreatingTransfer ? "Preparando..." : "Seleccionar archivos"}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        <div className="flex flex-col gap-4 flex-1 min-w-0">
          <label className="text-[#f2e1d0] text-sm font-bold tracking-wider uppercase" htmlFor="session-selector">
            Celular destino
          </label>

          {sessions.length > 1 ? (
            <select
              className="w-full p-3.5 rounded-2xl border border-white/5 bg-white/5 text-text-main focus:outline-none focus:ring-2 focus:ring-[#ffe06b]/50"
              id="session-selector"
              onChange={(event) => onSessionChange(event.target.value)}
              value={selectedSessionId}
            >
              <option value="">Selecciona una sesion activa</option>
              {sessions.map((session) => (
                <option key={session.sessionId} value={session.sessionId} className="bg-brand-dark">
                  {session.deviceName} - {session.shortSessionId}
                </option>
              ))}
            </select>
          ) : hasSessions ? (
            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 gap-4">
              <div className="flex flex-col gap-1 min-w-0">
                <strong className="truncate">{selectedSession?.deviceName || sessions[0].deviceName}</strong>
                <span className="text-[#a19286] text-sm">{selectedSession?.shortSessionId || sessions[0].shortSessionId}</span>
              </div>
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs tracking-wide bg-white/10 text-[#f3e5d8] shrink-0">
                {getSessionStateLabel(selectedSession?.downloadState || sessions[0].downloadState)}
              </span>
            </div>
          ) : (
            <div className="flex items-center p-4 rounded-2xl bg-white/5 text-[#a19286]">No hay sesiones moviles conectadas.</div>
          )}

          {selectedSession ? (
            <p className="text-[#a19286] text-sm">
              Estado: {getSessionStateLabel(selectedSession.downloadState)} - Ultima actividad:{" "}
              {formatDateTime(selectedSession.lastSeen)}
            </p>
          ) : hasSessions && !selectedSessionId ? (
            <p className="text-[#a19286] text-sm">Seleccion manual requerida porque hay varias sesiones conectadas.</p>
          ) : null}

          <p className={`text-sm ${outboundError ? "text-[#ffb5b5]" : "text-[#a19286]"}`}>{helperMessage}</p>
        </div>

        <div className={`flex-1 p-5 rounded-[22px] border bg-white/5 flex flex-col gap-4 min-w-0 ${
          tone === 'success' ? 'border-[#4ae4d3]/20 bg-[#4ae4d3]/10' :
          tone === 'danger' ? 'border-[#ff7474]/20 bg-[#ff7474]/10' :
          tone === 'accent' ? 'border-[#ffd56d]/20 bg-[#ffd56d]/10' :
          'border-white/10'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="min-w-0">
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs tracking-wide ${
                tone === 'success' ? 'bg-[#4ae4d3]/15 text-[#8ef2ea]' :
                tone === 'danger' ? 'bg-[#ff7474]/20 text-[#ffb5b5]' :
                tone === 'accent' ? 'bg-[#ffd56d]/20 text-[#ffe28a]' :
                'bg-white/10 text-[#f3e5d8]'
              }`}>
                {getTransferStatusText(transfer?.status || "idle")}
              </span>
              <h3 className="mt-3 text-lg leading-tight font-bold truncate">{getTransferHeadline(transfer)}</h3>
            </div>

            {transferSession ? (
              <div className="flex flex-col text-left sm:text-right shrink-0 min-w-0">
                <span className="text-[#a19286] text-sm">Destino</span>
                <strong className="text-text-main truncate max-w-[200px] min-w-0">
                  {transferSession.deviceName} - {transferSession.shortSessionId}
                </strong>
              </div>
            ) : null}
          </div>

          {transfer ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5 p-3.5 rounded-2xl bg-black/15">
                  <span className="text-[#a19286] text-sm">Archivos</span>
                  <strong className="text-text-main truncate">{transfer.totalFiles || 0}</strong>
                </div>
                <div className="flex flex-col gap-1.5 p-3.5 rounded-2xl bg-black/15">
                  <span className="text-[#a19286] text-sm">Tamano total</span>
                  <strong className="text-text-main truncate">{formatBytes(transfer.totalSize)}</strong>
                </div>
                <div className="flex flex-col gap-1.5 p-3.5 rounded-2xl bg-black/15">
                  <span className="text-[#a19286] text-sm">Vigencia</span>
                  <strong className="text-text-main truncate">{transfer.expiresAt ? formatRelativeTime(transfer.expiresAt) : "Sin limite"}</strong>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                <span className="text-[#a19286]">
                  {transfer.createdAt
                    ? `Creada ${formatRelativeTime(transfer.createdAt)}`
                    : "Esperando accion explicita en el celular"}
                </span>
                {transfer.reason ? <strong className="text-text-main max-w-full sm:max-w-[50%] truncate">{getClearReasonText(transfer.reason)}</strong> : null}
              </div>
            </>
          ) : (
            <div className="p-6 rounded-2xl bg-white/5 text-[#a19286] text-center text-sm">
              Selecciona un celular conectado y pulsa "Seleccionar archivos" para ofrecer una descarga.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [serverInfo, setServerInfo] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState("");
  const [liveMessage, setLiveMessage] = useState("");
  const [selectedQrMode, setSelectedQrMode] = useState("ip");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [outboundTransfer, setOutboundTransfer] = useState(null);
  const [outboundError, setOutboundError] = useState("");
  const [isCreatingTransfer, setIsCreatingTransfer] = useState(false);

  const sessions = serverInfo?.sessions || [];
  const supportsOutboundPicker =
    typeof window !== "undefined" && typeof window.localdrop?.createOutboundTransfer === "function";
  const hostnamePublished = ["published", "ready", "active"].includes(
    `${serverInfo?.discoveryStatus || ""}`.trim().toLowerCase()
  );
  const activeQrMode =
    selectedQrMode === "hostname" && serverInfo?.hostnameUrl && hostnamePublished ? "hostname" : "ip";
  const qrTargetUrl = activeQrMode === "hostname" ? serverInfo?.hostnameUrl : serverInfo?.mobileUrl;
  const selectedSession = sessions.find((session) => session.sessionId === selectedSessionId) || null;
  const featureTiles = buildFeatureTiles(serverInfo, sessions, activeQrMode, outboundTransfer);

  useEffect(() => {
    setSelectedSessionId((current) => {
      if (!sessions.length) {
        return "";
      }

      if (current && sessions.some((session) => session.sessionId === current)) {
        return current;
      }

      if (sessions.length === 1) {
        return sessions[0].sessionId;
      }

      return "";
    });
  }, [sessions]);

  useEffect(() => {
    let active = true;
    let socket;

    async function bootstrapRealtime() {
      try {
        const getMeta = window.localdrop?.getServerMeta || window.localdrop?.getMeta;
        if (typeof getMeta !== "function") {
          throw new Error("No existe el puente local de LocalDrop.");
        }

        const meta = await getMeta();
        const response = await fetch(`${meta.serverUrl}/api/info`);

        if (!response.ok) {
          throw new Error(`No se pudo consultar /api/info (${response.status}).`);
        }

        const snapshot = await response.json();
        if (!active) {
          return;
        }

        const normalizedSnapshot = normalizeServerInfo(snapshot, meta);
        setServerInfo(normalizedSnapshot);
        setError("");
        setLiveMessage(buildSessionMessage(normalizedSnapshot.sessions));

        socket = io(meta.socketUrl || meta.serverUrl, {
          transports: ["websocket", "polling"],
          query: {
            clientType: "desktop"
          }
        });

        socket.on("connect", () => {
          if (active) {
            setError("");
          }
        });

        socket.on("disconnect", () => {
          if (active) {
            setLiveMessage("La sesion en tiempo real se desconecto. Reintentando...");
          }
        });

        socket.on("server:snapshot", (nextSnapshot) => {
          if (!active) {
            return;
          }

          setServerInfo((current) => mergeServerInfo(current, nextSnapshot, meta));
        });

        socket.on("session:list", (payload) => {
          if (!active) {
            return;
          }

          const nextSessions = normalizeSessions(payload);
          setServerInfo((current) =>
            mergeServerInfo(
              current,
              {
                sessions: nextSessions,
                connectedDevices: nextSessions.length
              },
              meta
            )
          );
          setLiveMessage(buildSessionMessage(nextSessions));
        });

        socket.on("presence:update", (presence) => {
          if (!active) {
            return;
          }

          setServerInfo((current) =>
            current
              ? {
                  ...current,
                  connectedDevices: Number(presence?.connectedDevices) || current.connectedDevices
                }
              : current
          );

          if (presence?.message) {
            setLiveMessage(presence.message);
          }
        });

        socket.on("upload:started", ({ deviceName, totalFiles }) => {
          if (active) {
            setLiveMessage(`${deviceName || "Un celular"} esta subiendo ${totalFiles || 0} archivo(s).`);
          }
        });

        socket.on("upload:complete", ({ files, deviceName }) => {
          if (!active) {
            return;
          }

          setServerInfo((current) =>
            current
              ? {
                  ...current,
                  files: normalizeFiles(files || current.files)
                }
              : current
          );
          setLiveMessage(`Transferencia completada desde ${deviceName || "un celular"}.`);
        });

        socket.on("outbound:offered", (payload) => {
          if (!active) {
            return;
          }

          const transfer = normalizeTransfer(payload, "offered");
          setOutboundTransfer((current) => mergeTransferState(current, transfer, "offered"));
          setOutboundError("");
          setLiveMessage("Oferta creada. Esperando que el celular confirme la descarga.");

          if (transfer?.sessionId) {
            setServerInfo((current) =>
              current
                ? {
                    ...current,
                    sessions: updateSessionsDownloadState(current.sessions, transfer.sessionId, "offered")
                  }
                : current
            );
          }
        });

        socket.on("outbound:cleared", (payload) => {
          if (!active) {
            return;
          }

          const reason = payload?.reason || payload?.status || "cleared";
          const transfer = normalizeTransfer(payload, reason);
          setOutboundTransfer((current) => mergeTransferState(current, transfer, reason));

          if (transfer?.sessionId) {
            setServerInfo((current) =>
              current
                ? {
                    ...current,
                    sessions: updateSessionsDownloadState(current.sessions, transfer.sessionId, reason)
                  }
                : current
            );
          }

          if (reason === "expired") {
            setLiveMessage("La oferta de descarga expiro antes de ser aceptada.");
          }
        });

        socket.on("download:started", (payload) => {
          if (!active) {
            return;
          }

          const transfer = normalizeTransfer(payload, "started");
          setOutboundTransfer((current) => mergeTransferState(current, transfer, "started"));
          setLiveMessage("El celular ya comenzo la descarga.");

          if (transfer?.sessionId) {
            setServerInfo((current) =>
              current
                ? {
                    ...current,
                    sessions: updateSessionsDownloadState(current.sessions, transfer.sessionId, "started")
                  }
                : current
            );
          }
        });

        socket.on("download:completed", (payload) => {
          if (!active) {
            return;
          }

          const transfer = normalizeTransfer(payload, "completed");
          setOutboundTransfer((current) => mergeTransferState(current, transfer, "completed"));
          setLiveMessage("La descarga en el celular se completo correctamente.");

          if (transfer?.sessionId) {
            setServerInfo((current) =>
              current
                ? {
                    ...current,
                    sessions: updateSessionsDownloadState(current.sessions, transfer.sessionId, "completed")
                  }
                : current
            );
          }
        });

        socket.on("download:failed", (payload) => {
          if (!active) {
            return;
          }

          const transfer = normalizeTransfer(payload, "failed");
          setOutboundTransfer((current) => mergeTransferState(current, transfer, "failed"));
          setOutboundError(payload?.reason || "La descarga fallo en el celular o fue cancelada.");
          setLiveMessage("La descarga en el celular no se pudo completar.");

          if (transfer?.sessionId) {
            setServerInfo((current) =>
              current
                ? {
                    ...current,
                    sessions: updateSessionsDownloadState(current.sessions, transfer.sessionId, "failed")
                  }
                : current
            );
          }
        });

        socket.on("discovery:update", (payload) => {
          if (!active) {
            return;
          }

          setServerInfo((current) => mergeServerInfo(current, payload, meta));
        });
      } catch (fetchError) {
        if (active) {
          setError(fetchError?.message || "No se pudo conectar con el servidor local.");
        }
      }
    }

    bootstrapRealtime();

    return () => {
      active = false;
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function renderQr() {
      if (!qrTargetUrl) {
        setQrDataUrl("");
        return;
      }

      try {
        const QRCode = (await import("qrcode")).default;
        const dataUrl = await QRCode.toDataURL(qrTargetUrl, {
          margin: 1,
          width: 220
        });

        if (active) {
          setQrDataUrl(dataUrl);
        }
      } catch {
        if (active) {
          setQrDataUrl("");
        }
      }
    }

    renderQr();

    return () => {
      active = false;
    };
  }, [qrTargetUrl]);

  async function handleCreateOutboundTransfer() {
    if (!selectedSessionId) {
      setOutboundError("Selecciona una sesion movil activa antes de enviar archivos.");
      return;
    }

    const createTransfer = window.localdrop?.createOutboundTransfer;
    if (typeof createTransfer !== "function") {
      setOutboundError("La version actual del puente Electron todavia no expone createOutboundTransfer.");
      return;
    }

    setIsCreatingTransfer(true);
    setOutboundError("");

    try {
      const result = await createTransfer(selectedSessionId);
      if (result?.canceled) {
        return;
      }

      const optimisticTransfer = {
        sessionId: selectedSessionId,
        deviceName: selectedSession?.deviceName || "",
        createdAt: new Date().toISOString(),
        status: "offered"
      };
      const normalizedTransfer = normalizeTransfer(result, "offered");

      if (!normalizedTransfer) {
        throw new Error("No se recibio metadata valida de la transferencia creada.");
      }

      setOutboundTransfer((current) =>
        mergeTransferState(current, { ...optimisticTransfer, ...normalizedTransfer }, "offered")
      );
      setServerInfo((current) =>
        current
          ? {
              ...current,
              sessions: updateSessionsDownloadState(current.sessions, selectedSessionId, "offered")
            }
          : current
      );
      setLiveMessage("Oferta creada. Esperando que el celular confirme la descarga.");
    } catch (transferError) {
      const message = transferError?.message || "No se pudo preparar la transferencia.";

      if (/cancel/i.test(message)) {
        setIsCreatingTransfer(false);
        return;
      }

      setOutboundError(message);
      setOutboundTransfer((current) =>
        mergeTransferState(current, { sessionId: selectedSessionId, reason: message, status: "failed" }, "failed")
      );
    } finally {
      setIsCreatingTransfer(false);
    }
  }

  return (
    <div className="h-screen w-full flex overflow-hidden bg-brand-accent p-3 md:p-5 md:gap-4 text-text-main">
      <aside className="hidden md:flex flex-col justify-between shrink-0 w-[212px] p-7 rounded-[30px] bg-brand-rail text-text-soft shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div>
          <div className="rail-brand">
            <span className="rail-dot" />
            <strong>LocalDrop</strong>
          </div>

          <nav className="rail-nav">
            <button className="rail-item active" type="button">Overview</button>
            <button className="rail-item" type="button">Connections</button>
            <button className="rail-item" type="button">Transfers</button>
            <button className="rail-item" type="button">Received</button>
            <button className="rail-item" type="button">Network</button>
          </nav>
        </div>

        <div className="rail-footer">
          <span>Estado de sesion</span>
          <strong>{sessions.length ? `${sessions.length} movil(es) en linea` : "Esperando sesion"}</strong>
          <p>{liveMessage || "Abre LocalDrop desde el celular para empezar."}</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 rounded-[24px] md:rounded-[34px] bg-brand-dark shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_64px_rgba(27,14,8,0.24)] overflow-hidden relative">
        <TitleBar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 pb-6 flex flex-col gap-5 min-w-0">
          <section className="flex flex-col xl:flex-row xl:items-center items-stretch gap-6">
            <div className="flex-1 p-5 md:pt-4 md:px-2 md:pb-2">
              <span className="inline-flex px-3 py-2 rounded-full bg-white/10 text-primary-gold text-[0.78rem] tracking-widest uppercase">Transferencia local sin cuentas</span>
              <h1 className="mt-5 text-[clamp(2.8rem,4vw,5rem)] leading-[0.92] text-[#fff6ea] font-display max-w-[9ch]">Un relay visual para compartir por WiFi.</h1>
              <p className="max-w-[54ch] mt-5 text-text-muted text-[1.02rem] leading-relaxed tracking-wide">
                LocalDrop convierte tu laptop en un panel de intercambio con QR, PIN temporal,
                sesiones vivas y descargas directas al celular con una estetica editorial.
              </p>
            </div>

            <div className="flex-[1.25] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 tiles-group">
              {featureTiles.map((tile, index) => (
                <article
                  className={`mode-tile tone-${tile.tone} flex flex-col justify-between min-h-[200px] gap-4 p-6 rounded-[28px] text-[#150b08] min-w-0`}
                  key={tile.id}
                >
                  <div className="mode-tile__header flex items-start justify-between gap-3 w-full">
                    <span className="mode-tile__index shrink-0">{String(index + 1).padStart(2, "0")}</span>
                    <span className="mode-tile__eyebrow shrink min-w-0 text-center">{tile.eyebrow}</span>
                  </div>

                  <div className="mode-tile__details">
                    <div className="flex flex-col gap-2 min-w-0 text-center items-center justify-center flex-1 my-2">
                      <h2 className="mode-tile__title break-words">{tile.title}</h2>
                      <p className="mode-tile__body break-words">{tile.body}</p>
                    </div>
                  </div>

                  <div className="mode-tile__meta">
                    <div className="flex items-center justify-center gap-2 w-full">
                      <span className="mode-tile__dot" />
                      <strong className="break-words">{tile.meta}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="flex flex-col xl:flex-row gap-5 items-start">
            <div className="flex flex-col gap-5 flex-1 w-full xl:w-auto">
              <ServerStatus
                connectedDevices={sessions.length || serverInfo?.connectedDevices || 0}
                discoveryStatus={serverInfo?.discoveryStatus}
                error={error}
                hostnameUrl={serverInfo?.hostnameUrl}
                ipUrl={serverInfo?.mobileUrl}
                liveMessage={liveMessage}
                pin={serverInfo?.pin}
                serviceName={serverInfo?.serviceName}
                status={serverInfo?.status}
              />

              <OutboundTransferSection
                isCreatingTransfer={isCreatingTransfer}
                onCreateTransfer={handleCreateOutboundTransfer}
                onSessionChange={setSelectedSessionId}
                outboundError={outboundError}
                selectedSessionId={selectedSessionId}
                sessions={sessions}
                supportsOutboundPicker={supportsOutboundPicker}
                transfer={outboundTransfer}
              />

              <FileList
                files={serverInfo?.files || []}
                onOpenFolder={() => window.localdrop.openFolder()}
              />

              <SendToPhone
                serverUrl={serverInfo?.url || serverInfo?.mobileUrl?.replace(/\/mobile\/?$/, "")}
                pin={serverInfo?.pin}
              />
            </div>

            <aside className="flex flex-col gap-5 w-full xl:w-[360px] shrink-0">
              <QRCard
                activeMode={activeQrMode}
                hostnameReady={hostnamePublished}
                hostnameUrl={serverInfo?.hostnameUrl}
                onModeChange={setSelectedQrMode}
                qrDataUrl={qrDataUrl}
                url={serverInfo?.mobileUrl}
              />
              <SettingsPanel
                discoveryStatus={serverInfo?.discoveryStatus}
                hostnameUrl={serverInfo?.hostnameUrl}
                localIp={serverInfo?.localIp}
                port={serverInfo?.port}
                serviceName={serverInfo?.serviceName}
                uploadDir={serverInfo?.uploadDir}
              />
            </aside>
          </section>
        </main>
      </div>
    </div>
  );
}
