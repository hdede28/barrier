"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("velyo", {
  onStartupStatus: (callback) => {
    ipcRenderer.on("startup-status", (_event, payload) => callback(payload));
  },
  retryStartup: () => ipcRenderer.invoke("retry-startup"),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
});
