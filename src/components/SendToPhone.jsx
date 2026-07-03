import { useRef, useState } from "react";

function formatBytes(bytes) {
  if (!bytes) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export default function SendToPhone({ serverUrl, pin }) {
  const fileInputRef = useRef(null);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [isSending, setIsSending] = useState(false);

  function handleSelectFiles() {
    fileInputRef.current?.click();
  }

  async function handleFilesChange(event) {
    const files = event.target.files;
    if (!files?.length || !serverUrl || !pin) {
      return;
    }

    setIsSending(true);
    setProgress(0);
    setStatus(`Preparando ${files.length} archivo(s)...`);

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${serverUrl}/api/shared-files`);
    xhr.setRequestHeader("x-localdrop-pin", pin);

    xhr.upload.addEventListener("progress", (progressEvent) => {
      if (!progressEvent.lengthComputable) {
        return;
      }
      const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
      setProgress(percent);
      setStatus(`Enviando al celular... ${percent}%`);
    });

    xhr.addEventListener("load", () => {
      setIsSending(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        setStatus("Archivos enviados al celular.");
        setProgress(100);
      } else {
        try {
          const response = JSON.parse(xhr.responseText);
          setStatus(response.error || "No se pudo enviar los archivos.");
        } catch {
          setStatus("No se pudo enviar los archivos.");
        }
        setProgress(0);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    });

    xhr.addEventListener("error", () => {
      setIsSending(false);
      setStatus("Error de red. Verifica que el celular este en la misma WiFi.");
      setProgress(0);
    });

    xhr.send(formData);
  }

  return (
    <section className="card send-to-phone">
      <div className="card-header">
        <div>
          <h2>Enviar al celular</h2>
          <span>Selecciona archivos para enviarlos al telefono vinculado</span>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleFilesChange}
      />

      <div className="empty-state">
        <button
          className="primary-button"
          onClick={handleSelectFiles}
          disabled={isSending || !pin}
          type="button"
        >
          {isSending ? "Enviando..." : "Seleccionar archivos"}
        </button>
      </div>

      {status && (
        <div className="send-status">
          <div className="progress-wrap">
            <div
              className="progress-bar"
              style={{ width: `${progress}%`, transition: "width 0.2s ease" }}
            />
          </div>
          <p className="status">{status}</p>
        </div>
      )}
    </section>
  );
}
