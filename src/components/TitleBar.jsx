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
    <header className="titlebar" ref={titlebarRef}>
      <div className="titlebar-left">
        <div className="titlebar-brand">Control room</div>

        <nav className="titlebar-menu">
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

      <div className="titlebar-right">
        <span>WiFi local</span>
        <strong>Desktop relay</strong>
      </div>
    </header>
  );
}
