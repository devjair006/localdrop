import { useEffect, useState } from "react";
import QRCard from "./components/QRCard";
import ServerStatus from "./components/ServerStatus";
import FileList from "./components/FileList";
import SettingsPanel from "./components/SettingsPanel";

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

  useEffect(() => {
    let active = true;

    async function syncServerInfo() {
      try {
        const meta = await window.localdrop.getMeta();
        const response = await fetch(`${meta.serverUrl}/api/info`).then((res) => res.json());

        if (!active) {
          return;
        }

        setServerInfo({
          ...response,
          uploadDir: meta.downloadsDir,
          files: (response.files || []).map((file) => ({
            ...file,
            prettySize: formatBytes(file.size)
          }))
        });
        setError("");
      } catch (fetchError) {
        if (active) {
          setError("No se pudo conectar con el servidor local.");
        }
      }
    }

    syncServerInfo();
    const interval = setInterval(syncServerInfo, 2500);

    return () => {
      active = false;
      clearInterval(interval);
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
    <main className="shell">
      <section className="hero">
        <div>
          <span className="eyebrow">Transferencia de archivos por WiFi en red local</span>
          <h1>LocalDrop</h1>
          <p>
            <strong className="share-text">
              Comparte archivos por WiFi local desde cualquier celular, sin nube,
            sin login y sin cables.
            </strong>
          </p>
        </div>
        <ServerStatus
          status={serverInfo?.status}
          url={serverInfo?.mobileUrl}
          pin={serverInfo?.pin}
          error={error}
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
    </main>
  );
}
