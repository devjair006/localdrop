import { useState, useEffect, useRef } from "react";

export default function TitleBar() {
  const [activeMenu, setActiveMenu] = useState(null);
  const titlebarRef = useRef(null);

  const toggleMenu = (menu) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (titlebarRef.current && !titlebarRef.current.contains(event.target)) {
        setActiveMenu(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleAction = (action) => {
    setActiveMenu(null);
    if (!window.localdrop) {
      return;
    }

    switch (action) {
      case "open-folder":
        window.localdrop.openFolder();
        break;
      case "quit":
        window.localdrop.quit();
        break;
      case "reload":
        window.location.reload();
        break;
      case "devtools":
        window.localdrop.toggleDevTools();
        break;
      case "fullscreen":
        window.localdrop.toggleFullscreen();
        break;
      default:
        break;
    }
  };

  return (
    <header 
      className="flex items-center justify-between h-10 px-4 bg-[#12090a]/92 backdrop-blur-[18px] border-b border-white/5 shrink-0 z-50 select-none"
      style={{ WebkitAppRegion: 'drag' }}
      ref={titlebarRef}
    >
      <div className="flex items-center gap-6" style={{ WebkitAppRegion: 'no-drag' }}>
        <div className="font-display text-sm font-bold tracking-wider text-text-main">Control room</div>

        <nav className="flex gap-1">
          <div className="relative">
            <button
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${activeMenu === "archivo" ? "bg-white/10 text-white" : "text-[#bdaea0] hover:bg-white/5 hover:text-white"}`}
              onClick={() => toggleMenu("archivo")}
            >
              Archivo
            </button>
            {activeMenu === "archivo" && (
              <div className="absolute top-full left-0 mt-1 min-w-[180px] bg-[#2a1b18] border border-white/10 rounded-lg shadow-xl py-1 z-50 flex flex-col">
                <button className="w-full text-left px-4 py-2 text-sm text-[#e6d5c3] hover:bg-white/10 hover:text-white transition-colors" onClick={() => handleAction("open-folder")}>
                  <span>Abrir descargas</span>
                </button>
                <div className="h-px bg-white/10 my-1 w-full" />
                <button className="w-full text-left px-4 py-2 text-sm text-[#e6d5c3] hover:bg-white/10 hover:text-white transition-colors" onClick={() => handleAction("quit")}>
                  <span>Salir</span>
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${activeMenu === "ver" ? "bg-white/10 text-white" : "text-[#bdaea0] hover:bg-white/5 hover:text-white"}`}
              onClick={() => toggleMenu("ver")}
            >
              Ver
            </button>
            {activeMenu === "ver" && (
              <div className="absolute top-full left-0 mt-1 min-w-[180px] bg-[#2a1b18] border border-white/10 rounded-lg shadow-xl py-1 z-50 flex flex-col">
                <button className="w-full text-left px-4 py-2 text-sm text-[#e6d5c3] hover:bg-white/10 hover:text-white transition-colors" onClick={() => handleAction("reload")}>
                  <span>Recargar</span>
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-[#e6d5c3] hover:bg-white/10 hover:text-white transition-colors" onClick={() => handleAction("fullscreen")}>
                  <span>Pantalla completa</span>
                </button>
                <div className="h-px bg-white/10 my-1 w-full" />
                <button className="w-full text-left px-4 py-2 text-sm text-[#e6d5c3] hover:bg-white/10 hover:text-white transition-colors" onClick={() => handleAction("devtools")}>
                  <span>Herramientas de desarrollo</span>
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>

      <div className="flex flex-col gap-0.5 items-end text-[#bdaea0]" style={{ WebkitAppRegion: 'no-drag' }}>
        <span className="text-[0.6rem] uppercase tracking-wider font-bold">WiFi local</span>
        <strong className="text-xs text-text-main font-bold">Desktop relay</strong>
      </div>
    </header>
  );
}
