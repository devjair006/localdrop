export default function FileList({ files, onOpenFolder }) {
  return (
    <section className="p-5 md:p-6 rounded-[26px] bg-[#1a1214] border border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-2">
        <div className="flex flex-col gap-2">
          <span className="text-[#ffcf76] text-[0.74rem] tracking-[0.12em] uppercase">Recent intake</span>
          <h2 className="text-2xl font-bold">Recibidos recientemente</h2>
          <p className="text-[#bdaea0] leading-relaxed">{files.length} archivo(s) registrados en esta sesion.</p>
        </div>
        
        <button className="px-4 py-3 rounded-xl bg-white/10 text-[#fff4e7] font-semibold hover:-translate-y-px transition-transform shrink-0" onClick={onOpenFolder} type="button">
          Abrir carpeta
        </button>
      </div>

      {files.length === 0 ? (
        <div className="py-7 text-center text-[#a19286]">Todavia no has recibido archivos.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {files.map((file) => (
            <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/5" key={`${file.name}-${file.receivedAt}`}>
              <div className="flex flex-col gap-1 min-w-0">
                <strong className="text-text-main truncate">{file.name}</strong>
                <span className="text-[#a19286] text-sm truncate">{new Date(file.receivedAt).toLocaleString()}</span>
              </div>
              <span className="text-[#a19286] shrink-0 font-medium">{file.prettySize}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
