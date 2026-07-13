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
    <article className={`p-5 md:p-6 rounded-[26px] bg-[#1a1214] border flex flex-col gap-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${active ? "border-[#4ae4d3]/30" : "border-[#ffcf76]/30"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className={`px-3 py-1.5 rounded-full text-[0.74rem] tracking-wider uppercase font-bold ${active ? "bg-[#4ae4d3]/15 text-[#8ef2ea]" : "bg-[#ffcf76]/15 text-[#ffcf76]"}`}>
          {active ? "Servidor activo" : "Servidor inactivo"}
        </div>
        <div className={`px-3 py-1.5 rounded-full text-[0.74rem] tracking-wider uppercase font-bold ${hostnameUrl ? "bg-white/10 text-text-main" : "bg-white/5 text-text-muted"}`}>
          {getDiscoveryLabel(discoveryStatus, Boolean(hostnameUrl))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-xl md:text-2xl font-bold">{active ? "Centro de control de la red local" : "Esperando servidor local"}</h2>
        <p className="text-text-muted leading-relaxed">{error || "Comparte por IP o por alias .local segun lo que soporte tu red."}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2 p-4 md:p-5 rounded-2xl bg-black/20 border border-white/5 min-w-0">
          <span className="text-[#a19286] text-sm uppercase tracking-wider">URL por IP</span>
          <strong className="text-text-main truncate text-lg">{ipUrl || "Iniciando..."}</strong>
        </div>
        <div className={`flex flex-col gap-2 p-4 md:p-5 rounded-2xl bg-black/20 border border-white/5 min-w-0 ${hostnameUrl ? "" : "opacity-60"}`}>
          <span className="text-[#a19286] text-sm uppercase tracking-wider">Alias .local</span>
          <strong className="text-text-main truncate text-lg">{hostnameUrl || "Pendiente de publicar"}</strong>
          <small className="text-[#a19286] text-sm truncate">{serviceName || "LocalDrop"}</small>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 md:p-5 rounded-2xl bg-[#ff7248]/10 border border-[#ff7248]/20 text-[#ffb6a1]">
        <span className="text-sm">
          {connectedDevices
            ? `${connectedDevices} sesion(es) movil(es) conectada(s)`
            : "Sin sesiones moviles conectadas"}
        </span>
        <strong className="text-sm truncate max-w-full sm:max-w-[50%] text-right">{liveMessage || "Esperando que un celular abra el enlace"}</strong>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-5 rounded-2xl bg-white/5">
        <span className="text-[#a19286]">PIN temporal</span>
        <div className="px-4 py-2 rounded-xl bg-black/40 border border-white/5">
          <strong className="font-display tracking-[0.2em] text-xl md:text-2xl text-primary-gold">{pin || "-- ----"}</strong>
        </div>
      </div>
    </article>
  );
}
