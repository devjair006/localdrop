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
          <div className="menu-item">
            <button
              className={`menu-trigger ${activeMenu === "archivo" ? "active" : ""}`}
              onClick={() => toggleMenu("archivo")}
            >
              Archivo
            </button>
            {activeMenu === "archivo" && (
              <div className="menu-dropdown">
                <button className="dropdown-btn" onClick={() => handleAction("open-folder")}>
                  <span>Abrir descargas</span>
                </button>
                <div className="dropdown-divider" />
                <button className="dropdown-btn" onClick={() => handleAction("quit")}>
                  <span>Salir</span>
                </button>
              </div>
            )}
          </div>

          <div className="menu-item">
            <button
              className={`menu-trigger ${activeMenu === "ver" ? "active" : ""}`}
              onClick={() => toggleMenu("ver")}
            >
              Ver
            </button>
            {activeMenu === "ver" && (
              <div className="menu-dropdown">
                <button className="dropdown-btn" onClick={() => handleAction("reload")}>
                  <span>Recargar</span>
                </button>
                <button className="dropdown-btn" onClick={() => handleAction("fullscreen")}>
                  <span>Pantalla completa</span>
                </button>
                <div className="dropdown-divider" />
                <button className="dropdown-btn" onClick={() => handleAction("devtools")}>
                  <span>Herramientas de desarrollo</span>
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>

      <div className="flex flex-col gap-0.5 items-end text-text-muted" style={{ WebkitAppRegion: 'no-drag' }}>
        <span className="text-[0.7rem] uppercase tracking-wider">WiFi local</span>
        <strong className="text-sm text-text-main">Desktop relay</strong>
      </div>
    </header>
  );
}
