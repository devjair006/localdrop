const { app, BrowserWindow, shell, ipcMain, Menu } = require("electron");
const path = require("path");
const { startServer } = require("../server/server");

const isDev = !app.isPackaged;
let mainWindow;
let serverContext;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 700,
    backgroundColor: "#101418",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    await mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(async () => {
  serverContext = await startServer();

  const menuTemplate = [
    {
      label: "Archivo",
      submenu: [
        { label: "Salir", role: "quit" }
      ]
    },
    {
      label: "Editar",
      submenu: [
        { label: "Deshacer", role: "undo" },
        { label: "Rehacer", role: "redo" },
        { type: "separator" },
        { label: "Cortar", role: "cut" },
        { label: "Copiar", role: "copy" },
        { label: "Pegar", role: "paste" },
        { label: "Seleccionar todo", role: "selectAll" }
      ]
    },
    {
      label: "Ver",
      submenu: [
        { label: "Recargar", role: "reload" },
        { label: "Forzar recarga", role: "forceReload" },
        ...(isDev ? [{ label: "Herramientas de desarrollo", role: "toggleDevTools" }] : []),
        { type: "separator" },
        { label: "Restablecer zoom", role: "resetZoom" },
        { label: "Acercar", role: "zoomIn" },
        { label: "Alejar", role: "zoomOut" },
        { type: "separator" },
        { label: "Pantalla completa", role: "togglefullscreen" }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  ipcMain.handle("localdrop:get-meta", () => ({
    downloadsDir: serverContext.uploadDir,
    serverUrl: `http://127.0.0.1:${serverContext.port}`
  }));

  ipcMain.handle("localdrop:open-folder", async () => {
    await shell.openPath(serverContext.uploadDir);
    return serverContext.uploadDir;
  });

  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  if (serverContext?.stop) {
    await serverContext.stop();
  }
});
