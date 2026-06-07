const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("localdrop", {
  getMeta: () => ipcRenderer.invoke("localdrop:get-meta"),
  openFolder: () => ipcRenderer.invoke("localdrop:open-folder"),
  quit: () => ipcRenderer.invoke("localdrop:quit"),
  toggleDevTools: () => ipcRenderer.invoke("localdrop:toggle-devtools"),
  toggleFullscreen: () => ipcRenderer.invoke("localdrop:toggle-fullscreen")
});
