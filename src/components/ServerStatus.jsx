function getDiscoveryLabel(discoveryStatus, hasHostname) {
  const status = `${discoveryStatus || ""}`.trim().toLowerCase();

  if (!hasHostname && (!status || status === "pending")) {
    return "Alias .local pendiente";
  }

  switch (status) {
    case "published":
    case "ready":
    case "active":
      return "Alias .local publicado";
    case "error":
    case "failed":
    case "unavailable":
      return "Alias .local no disponible";
    case "inactive":
      return "Descubrimiento pausado";
    default:
      return hasHostname ? "Alias .local listo" : "Publicando alias .local";
  }
}

export default function ServerStatus({
  status,
  ipUrl,
  hostnameUrl,
  pin,
  error,
  connectedDevices,
  liveMessage,
  discoveryStatus,
  serviceName
}) {
  const active = status === "active" && !error;

  return (
    <article className={`status-card ${active ? "active" : "inactive"}`}>
      <div className="status-pill-row">
        <div className="status-pill">
          <strong>{active ? "Servidor activo" : "Servidor inactivo"}</strong>
        </div>
        <div className={`status-subpill ${hostnameUrl ? "available" : "pending"}`}>
          <strong>{getDiscoveryLabel(discoveryStatus, Boolean(hostnameUrl))}</strong>
        </div>
      </div>

      <div className="status-copy">
        <h2>{active ? "Centro de control de la red local" : "Esperando servidor local"}</h2>
        <p>{error || "Comparte por IP o por alias .local segun lo que soporte tu red."}</p>
      </div>

      <div className="endpoint-grid">
        <div className="endpoint-card">
          <span>URL por IP</span>
          <strong>{ipUrl || "Iniciando..."}</strong>
        </div>
        <div className={`endpoint-card ${hostnameUrl ? "" : "muted"}`}>
          <span>Alias .local</span>
          <strong>{hostnameUrl || "Pendiente de publicar"}</strong>
          <small>{serviceName || "LocalDrop"}</small>
        </div>
      </div>

      <div className="live-status">
        <span>
          {connectedDevices
            ? `${connectedDevices} sesion(es) movil(es) conectada(s)`
            : "Sin sesiones moviles conectadas"}
        </span>
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
