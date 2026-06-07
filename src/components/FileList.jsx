export default function FileList({ files, onOpenFolder }) {
  return (
    <section className="card file-list">
      <div className="card-header">
        <div>
          <h2>Archivos recibidos</h2>
          <span>{files.length} archivo(s) en esta sesion</span>
        </div>
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
