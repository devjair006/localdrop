export default function ServerStatus({ status, url, pin, error }) {
  const active = status === "active" && !error;

  return (
    <article className={`status-card ${active ? "active" : "inactive"}`}>
      <div className="status-pill"><strong>{active ? "Servidor activo" : "Servidor inactivo"}</strong></div>
      <h2>{active ? "Listo para recibir archivos" : "Esperando servidor local"}</h2>
      <p>{error || url || "Iniciando..."}</p>
      <div className="pin-block">
        <span>PIN temporal</span>
        <strong>{pin || "-- ----"}</strong>
      </div>
    </article>
  );
}
