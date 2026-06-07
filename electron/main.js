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
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0c1117",
      symbolColor: "#f4f7fb",
      height: 40
    },
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

  Menu.setApplicationMenu(null);

  ipcMain.handle("localdrop:get-meta", () => ({
    downloadsDir: serverContext.uploadDir,
    serverUrl: `http://127.0.0.1:${serverContext.port}`,
    socketUrl: `http://127.0.0.1:${serverContext.port}`
  }));

  ipcMain.handle("localdrop:open-folder", async () => {
    await shell.openPath(serverContext.uploadDir);
    return serverContext.uploadDir;
  });

  ipcMain.handle("localdrop:quit", () => {
    app.quit();
  });

  ipcMain.handle("localdrop:toggle-devtools", () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  ipcMain.handle("localdrop:toggle-fullscreen", () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
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
