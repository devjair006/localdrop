const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("localdrop", {
  getMeta: () => ipcRenderer.invoke("localdrop:get-meta"),
  getServerMeta: () => ipcRenderer.invoke("localdrop:get-meta"),
  createOutboundTransfer: (targetSessionId) =>
    ipcRenderer.invoke("localdrop:create-outbound-transfer", targetSessionId),
  openFolder: () => ipcRenderer.invoke("localdrop:open-folder"),
  quit: () => ipcRenderer.invoke("localdrop:quit"),
  toggleDevTools: () => ipcRenderer.invoke("localdrop:toggle-devtools"),
  toggleFullscreen: () => ipcRenderer.invoke("localdrop:toggle-fullscreen")
});
