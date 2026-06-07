const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("localdrop", {
  getMeta: () => ipcRenderer.invoke("localdrop:get-meta"),
  openFolder: () => ipcRenderer.invoke("localdrop:open-folder")
});
