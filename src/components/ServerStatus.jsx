export default function ServerStatus({ status, url, pin, error, connectedDevices, liveMessage }) {
  const active = status === "active" && !error;

  return (
    <article className={`status-card ${active ? "active" : "inactive"}`}>
      <div className="status-pill"><strong>{active ? "Servidor activo" : "Servidor inactivo"}</strong></div>
      <h2>{active ? "Listo para recibir archivos" : "Esperando servidor local"}</h2>
      <p>{error || url || "Iniciando..."}</p>
      <div className="live-status">
        <span>{connectedDevices ? `${connectedDevices} dispositivo(s) conectado(s)` : "Sin dispositivos conectados"}</span>
        <strong>{liveMessage || "Esperando que un celular abra el enlace"}</strong>
      </div>
      <div className="pin-block">
        <span>PIN temporal</span>
        <div className="pin-number">
          <strong className="pin-code">{pin || "-- ----"}</strong>
        </div>
      </div>
    </article>
  );
}
