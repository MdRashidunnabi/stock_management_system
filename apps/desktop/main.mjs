import { app, BrowserWindow, ipcMain, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {BrowserWindow | null} */
let mainWindow = null;

function readPackagedConfig() {
  const candidates = [
    path.join(process.resourcesPath, "config.json"),
    path.join(__dirname, "config.default.json"),
  ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, "utf8"));
      }
    } catch {
      /* try next */
    }
  }
  return {};
}

function loadRuntimeConfig() {
  const fileConfig = readPackagedConfig();
  const appUrl = (process.env.SHOPOS_APP_URL ?? fileConfig.appUrl ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const startPath = process.env.SHOPOS_START_PATH ?? fileConfig.startPath ?? "/pos?kiosk=1";
  return { appUrl, startPath: startPath.startsWith("/") ? startPath : `/${startPath}` };
}

function isSameOrigin(targetUrl, appUrl) {
  try {
    const base = new URL(appUrl);
    const target = new URL(targetUrl);
    return target.origin === base.origin;
  } catch {
    return false;
  }
}

function createWindow() {
  const { appUrl, startPath } = loadRuntimeConfig();
  const startUrl = `${appUrl}${startPath}`;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: "ShopOS",
    autoHideMenuBar: true,
    backgroundColor: "#064e3b",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: "persist:shopos",
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSameOrigin(url, appUrl)) {
      return { action: "allow" };
    }
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isSameOrigin(url, appUrl)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  void mainWindow.loadURL(startUrl);

  if (process.env.SHOPOS_DEVTOOLS === "1") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    ipcMain.on("shopos:get-version", (event) => {
      event.returnValue = app.getVersion();
    });
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
