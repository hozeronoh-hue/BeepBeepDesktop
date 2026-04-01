const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("beepbeepDesktop", {
  isDesktopWidget: true,
  minimize: () => ipcRenderer.invoke("widget:minimize"),
  onSettingsChanged: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on("widget-settings", listener);
    return () => ipcRenderer.removeListener("widget-settings", listener);
  }
});
