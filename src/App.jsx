import { useEffect, useState } from "react";
import QRCard from "./components/QRCard";
import ServerStatus from "./components/ServerStatus";
import FileList from "./components/FileList";
import SendToPhone from "./components/SendToPhone";
import SettingsPanel from "./components/SettingsPanel";
import TitleBar from "./components/TitleBar";
import { io } from "socket.io-client";

function formatBytes(bytes) {
  if (!bytes) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export default function App() {
  const [serverInfo, setServerInfo] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState("");
  const [liveMessage, setLiveMessage] = useState("");

  useEffect(() => {
    let active = true;
    let socket;

    function enrichServerInfo(info, meta) {
      return {
        ...info,
        uploadDir: meta.downloadsDir,
        files: (info.files || []).map((file) => ({
          ...file,
          prettySize: formatBytes(file.size)
        }))
      };
    }

    async function bootstrapRealtime() {
      try {
        const meta = await window.localdrop.getMeta();
        const response = await fetch(`${meta.serverUrl}/api/info`).then((res) => res.json());

        if (!active) {
          return;
        }

        setServerInfo(enrichServerInfo(response, meta));
        setError("");
        setLiveMessage("Esperando que un celular abra el enlace");

        socket = io(meta.socketUrl, {
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

        socket.on("server:snapshot", (snapshot) => {
          if (active) {
            setServerInfo(enrichServerInfo(snapshot, meta));
          }
        });

        socket.on("presence:update", (presence) => {
          if (!active) {
            return;
          }

          setServerInfo((current) =>
            current
              ? {
                  ...current,
                  connectedDevices: presence.connectedDevices
                }
              : current
          );
          setLiveMessage(presence.message);
        });

        socket.on("upload:complete", ({ files, deviceName }) => {
          if (!active) {
            return;
          }

          setServerInfo((current) =>
            current
              ? {
                  ...current,
                  files: files.map((file) => ({
                    ...file,
                    prettySize: formatBytes(file.size)
                  }))
                }
              : current
          );
          setLiveMessage(`Transferencia completada desde ${deviceName}.`);
        });

        socket.on("upload:started", ({ deviceName, totalFiles }) => {
          if (active) {
            setLiveMessage(`${deviceName} esta subiendo ${totalFiles} archivo(s).`);
          }
        });

        socket.on("disconnect", () => {
          if (active) {
            setLiveMessage("La sesion en tiempo real se desconecto. Reintentando...");
          }
        });
      } catch (fetchError) {
        if (active) {
          setError("No se pudo conectar con el servidor local.");
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
      if (!serverInfo?.mobileUrl) {
        return;
      }

      const QRCode = (await import("qrcode")).default;
      const dataUrl = await QRCode.toDataURL(serverInfo.mobileUrl, {
        margin: 1,
        width: 220
      });

      if (active) {
        setQrDataUrl(dataUrl);
      }
    }

    renderQr();

    return () => {
      active = false;
    };
  }, [serverInfo?.mobileUrl]);

  return (
    <>
      <TitleBar />
      <main className="shell">
      <section className="hero">
        <div>
          <span className="eyebrow">Transferencia de archivos por WiFi en red local</span>
          <h1 className="title">LocalDrop</h1>
          <p>
            <div className="share-container">
              <strong className="share-text">
                Comparte archivos por WiFi local desde cualquier celular, sin nube,
              sin login y sin cables.
              </strong>
            </div>
          </p>
        </div>
        <ServerStatus
          status={serverInfo?.status}
          url={serverInfo?.mobileUrl}
          pin={serverInfo?.pin}
          error={error}
          connectedDevices={serverInfo?.connectedDevices || 0}
          liveMessage={liveMessage}
        />
      </section>

      <section className="grid">
        <QRCard qrDataUrl={qrDataUrl} url={serverInfo?.mobileUrl} />
        <SettingsPanel
          uploadDir={serverInfo?.uploadDir}
          localIp={serverInfo?.localIp}
          port={serverInfo?.port}
        />
      </section>

      <FileList files={serverInfo?.files || []} onOpenFolder={() => window.localdrop.openFolder()} />
      <SendToPhone serverUrl={serverInfo?.url} pin={serverInfo?.pin} />
    </main>
    </>
  );
}
