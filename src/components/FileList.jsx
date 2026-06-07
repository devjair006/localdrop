export default function FileList({ files, onOpenFolder }) {
  return (
    <section className="card file-list">
      <div className="section-headline compact">
        <span className="section-kicker">Recent intake</span>
        <h2>Recibidos recientemente</h2>
        <p>{files.length} archivo(s) registrados en esta sesion.</p>
      </div>

      <div className="card-header">
        <div />
        <button className="secondary-button" onClick={onOpenFolder} type="button">
          Abrir carpeta
        </button>
      </div>

      {files.length === 0 ? (
        <div className="empty-state">Todavia no has recibido archivos.</div>
      ) : (
        <div className="file-table">
          {files.map((file) => (
            <div className="file-row" key={`${file.name}-${file.receivedAt}`}>
              <div>
                <strong>{file.name}</strong>
                <span>{new Date(file.receivedAt).toLocaleString()}</span>
              </div>
              <span>{file.prettySize}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
