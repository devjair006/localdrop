export default function QRCard({ qrDataUrl, url }) {
  return (
    <article className="card qr-card">
      <div className="card-header">
        <h2>Conectar celular</h2>
        <span>Escanea y abre en el navegador</span>
      </div>

      <div className="qr-frame">
        {qrDataUrl ? <img src={qrDataUrl} alt="QR de conexion LocalDrop" /> : <div className="qr-placeholder">Generando QR...</div>}
      </div>

      <p className="url-text">{url || "Esperando URL local..."}</p>
    </article>
  );
}
