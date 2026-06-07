function getDiscoveryCopy(discoveryStatus, hasHostname) {
  const status = `${discoveryStatus || ""}`.trim().toLowerCase();

  switch (status) {
    case "published":
    case "ready":
    case "active":
      return hasHostname ? "Publicado" : "Listo";
    case "error":
    case "failed":
    case "unavailable":
      return "Con errores";
    case "inactive":
      return "Pausado";
    default:
      return hasHostname ? "Disponible" : "Pendiente";
  }
}

export default function SettingsPanel({
  uploadDir,
  localIp,
  port,
  hostnameUrl,
  discoveryStatus,
  serviceName
}) {
  return (
    <article className="card details-card">
      <div className="section-headline compact">
        <span className="section-kicker">Node details</span>
        <h2>Nodo local</h2>
        <p>Direccionamiento, alias LAN y carpeta de salida.</p>
      </div>

      <dl className="details-list">
        <div>
          <dt>IP local</dt>
          <dd>{localIp || "Detectando..."}</dd>
        </div>
        <div>
          <dt>Puerto</dt>
          <dd>{port || "3030"}</dd>
        </div>
        <div>
          <dt>Alias LAN</dt>
          <dd className="details-dd-stack">
            <strong className="mono-text">{hostnameUrl || "Pendiente de publicar"}</strong>
            <span className={`discovery-chip ${hostnameUrl ? "available" : "pending"}`}>
              {getDiscoveryCopy(discoveryStatus, Boolean(hostnameUrl))}
            </span>
          </dd>
        </div>
        <div>
          <dt>Servicio LAN</dt>
          <dd>{serviceName || "LocalDrop"}</dd>
        </div>
        <div>
          <dt>Carpeta de destino</dt>
          <dd>{uploadDir || "Preparando carpeta..."}</dd>
        </div>
      </dl>
    </article>
  );
}
