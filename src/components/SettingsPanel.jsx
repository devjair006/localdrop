export default function SettingsPanel({ uploadDir, localIp, port }) {
  return (
    <article className="card details-card">
      <div className="card-header">
        <h2>Detalles del nodo</h2>
        <span>Configuracion local de esta maquina</span>
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
          <dt>Carpeta de destino</dt>
          <dd>{uploadDir || "Preparando carpeta..."}</dd>
        </div>
      </dl>
    </article>
  );
}
