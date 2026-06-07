export default function QRCard({ qrDataUrl, url, hostnameUrl, activeMode, onModeChange, hostnameReady }) {
  const hasHostname = Boolean(hostnameUrl);
  const usingHostname = activeMode === "hostname" && hasHostname && hostnameReady;
  const activeUrl = usingHostname ? hostnameUrl : url;

  return (
    <article className="card qr-card">
      <div className="section-headline compact">
        <span className="section-kicker">Mobile access</span>
        <h2>Escaneo rapido</h2>
        <p>Escanea y abre LocalDrop desde el navegador movil.</p>
      </div>

      <div className="card-header">
        <div />

        <div className="qr-mode-switch">
          <button
            className={`mode-chip ${!usingHostname ? "active" : ""}`}
            onClick={() => onModeChange?.("ip")}
            type="button"
          >
            QR por IP
          </button>
          <button
            className={`mode-chip ${usingHostname ? "active" : ""}`}
            disabled={!hasHostname || !hostnameReady}
            onClick={() => onModeChange?.("hostname")}
            type="button"
          >
            QR .local
          </button>
        </div>
      </div>

      <div className="qr-frame">
        {qrDataUrl ? <img src={qrDataUrl} alt="QR de conexion LocalDrop" /> : <div className="qr-placeholder">Generando QR...</div>}
      </div>

      <div className="qr-meta">
        <p className="url-label">{usingHostname ? "Alias .local" : "URL por IP"}</p>
        <p className="url-text">{activeUrl || "Esperando URL local..."}</p>
        <p className="helper-text">
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
