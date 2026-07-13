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
    <article className="p-5 md:p-6 rounded-[26px] bg-[#1a1214] border border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] flex flex-col gap-6 h-full">
      <div className="flex flex-col gap-1.5">
        <span className="text-[#ffcf76] text-[0.74rem] tracking-[0.12em] uppercase">Node details</span>
        <h2 className="text-xl font-bold">Nodo local</h2>
        <p className="text-[#bdaea0] text-sm leading-relaxed">Direccionamiento, alias LAN y carpeta de salida.</p>
      </div>

      <dl className="flex flex-col gap-4 mt-auto m-0 p-0">
        <div className="flex flex-col gap-1.5 p-4 rounded-[20px] bg-white/5 border border-white/5">
          <dt className="text-[#a19286] text-xs font-bold tracking-wider uppercase">IP local</dt>
          <dd className="text-text-main font-medium m-0">{localIp || "Detectando..."}</dd>
        </div>
        
        <div className="flex flex-col gap-1.5 p-4 rounded-[20px] bg-white/5 border border-white/5">
          <dt className="text-[#a19286] text-xs font-bold tracking-wider uppercase">Puerto</dt>
          <dd className="text-text-main font-medium m-0">{port || "3030"}</dd>
        </div>
        
        <div className="flex flex-col gap-2 p-4 rounded-[20px] bg-white/5 border border-white/5">
          <dt className="text-[#a19286] text-xs font-bold tracking-wider uppercase">Alias LAN</dt>
          <dd className="flex items-center justify-between gap-3 m-0">
            <strong className="font-mono text-sm break-all font-medium text-text-main">{hostnameUrl || "Pendiente de publicar"}</strong>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${hostnameUrl ? "bg-[#4ae4d3]/15 text-[#8ef2ea]" : "bg-white/10 text-[#f3e5d8]"}`}>
              {getDiscoveryCopy(discoveryStatus, Boolean(hostnameUrl))}
            </span>
          </dd>
        </div>
        
        <div className="flex flex-col gap-1.5 p-4 rounded-[20px] bg-white/5 border border-white/5">
          <dt className="text-[#a19286] text-xs font-bold tracking-wider uppercase">Servicio LAN</dt>
          <dd className="text-text-main font-medium m-0">{serviceName || "LocalDrop"}</dd>
        </div>
        
        <div className="flex flex-col gap-1.5 p-4 rounded-[20px] bg-white/5 border border-white/5">
          <dt className="text-[#a19286] text-xs font-bold tracking-wider uppercase">Carpeta de destino</dt>
          <dd className="text-text-main text-sm break-all m-0">{uploadDir || "Preparando carpeta..."}</dd>
        </div>
      </dl>
    </article>
  );
}
