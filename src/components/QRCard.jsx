export default function QRCard({ qrDataUrl, url, hostnameUrl, activeMode, onModeChange, hostnameReady }) {
  const hasHostname = Boolean(hostnameUrl);
  const usingHostname = activeMode === "hostname" && hasHostname && hostnameReady;
  const activeUrl = usingHostname ? hostnameUrl : url;

  return (
    <article className="p-5 md:p-6 rounded-[26px] bg-[#1a1214] border border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] flex flex-col gap-5 h-full">
      <div className="flex flex-col gap-1.5">
        <span className="text-[#ffcf76] text-[0.74rem] tracking-[0.12em] uppercase">Mobile access</span>
        <h2 className="text-xl font-bold">Escaneo rapido</h2>
        <p className="text-[#bdaea0] text-sm leading-relaxed">Escanea y abre LocalDrop desde el navegador movil.</p>
      </div>

      <div className="flex justify-between items-center bg-black/20 p-1.5 rounded-full border border-white/5">
        <button
          className={`flex-1 px-4 py-2 rounded-full text-sm font-semibold transition-all ${!usingHostname ? "bg-white/10 text-white shadow-sm" : "text-[#bdaea0] hover:text-white"}`}
          onClick={() => onModeChange?.("ip")}
          type="button"
        >
          QR por IP
        </button>
        <button
          className={`flex-1 px-4 py-2 rounded-full text-sm font-semibold transition-all ${usingHostname ? "bg-white/10 text-white shadow-sm" : "text-[#bdaea0] hover:text-white"} disabled:opacity-50 disabled:cursor-not-allowed`}
          disabled={!hasHostname || !hostnameReady}
          onClick={() => onModeChange?.("hostname")}
          type="button"
        >
          QR .local
        </button>
      </div>

      <div className="flex justify-center items-center flex-1 bg-white p-4 rounded-[22px] min-h-[220px]">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="QR de conexion LocalDrop" className="w-full h-full object-contain max-w-[200px]" />
        ) : (
          <div className="text-black/50 font-medium">Generando QR...</div>
        )}
      </div>

      <div className="flex flex-col gap-2 mt-auto">
        <p className="text-[#ffcf76] text-xs font-bold uppercase tracking-wider">{usingHostname ? "Alias .local" : "URL por IP"}</p>
        <p className="font-mono text-sm break-all text-text-main p-3 bg-white/5 rounded-xl border border-white/5">{activeUrl || "Esperando URL local..."}</p>
        <p className="text-[#a19286] text-xs mt-1 leading-relaxed">
          {hasHostname && hostnameReady
            ? usingHostname
              ? "Usa este QR si tu red resuelve nombres .local. Si falla, cambia al QR por IP."
              : "El QR por IP es el mas compatible. Cambia a .local solo si tu red lo soporta."
            : "Cuando el alias .local este disponible podras alternar el QR desde aqui."}
        </p>
      </div>
    </article>
  );
}
