const { app, BrowserWindow, shell, ipcMain } = require("electron");
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
