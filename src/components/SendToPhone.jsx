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
    <section className="p-5 md:p-6 rounded-[26px] bg-[#1a1214] border border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="text-[#ffcf76] text-[0.74rem] tracking-[0.12em] uppercase">Envio · Carga HTTP directa</span>
        <h2 className="text-xl font-bold">Enviar al celular</h2>
        <span className="text-[#a19286] leading-relaxed">Selecciona archivos para enviarlos al telefono vinculado</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleFilesChange}
      />

      <div className="flex justify-center p-6 rounded-2xl border border-dashed border-white/10 bg-white/5">
        <button
          className="px-5 py-3 rounded-xl bg-gradient-to-br from-[#ffe06b] to-[#58efce] text-[#170d07] font-bold disabled:opacity-60 disabled:cursor-not-allowed transition-transform hover:-translate-y-px"
          onClick={handleSelectFiles}
          disabled={isSending || !pin}
          type="button"
        >
          {isSending ? "Enviando..." : "Seleccionar archivos"}
        </button>
      </div>

      {status && (
        <div className="flex flex-col gap-2 mt-2">
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-gold transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-[#a19286] text-center mt-1">{status}</p>
        </div>
      )}
    </section>
  );
}
