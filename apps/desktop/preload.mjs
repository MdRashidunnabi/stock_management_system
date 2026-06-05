import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("shopOSDesktop", {
  version: ipcRenderer.sendSync("shopos:get-version"),
  platform: process.platform,
  isDesktop: true,
});
