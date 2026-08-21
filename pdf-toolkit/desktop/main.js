"use strict";

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const {
  detectComposeCommand,
  ensureEnvFile,
  startStack,
  stopStack,
  waitForStackHealthy,
} = require("./orchestrator");

const BACKEND_HEALTH_URL = "http://localhost:8000/api/health";
const FRONTEND_URL = "http://localhost:3000";

let mainWindow = null;
let composeCommand = null;
let projectRoot = null;

function getProjectRoot() {
  // Packaged: resources/pdf-toolkit/{backend,frontend,docker-compose.yml,...}
  // Dev (running `npm start` from desktop/): the parent pdf-toolkit/ directory.
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "pdf-toolkit");
  }
  return path.join(__dirname, "..");
}

function createWindow(loadUrl) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0a1020", // Velyo Ink 900 -- avoids a white flash while loading
    title: "Velyo",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(loadUrl);
  return mainWindow;
}

function sendStatus(status, detail) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("startup-status", { status, detail });
  }
}

async function bootStack() {
  projectRoot = getProjectRoot();
  ensureEnvFile(projectRoot);

  sendStatus("detecting-docker");
  composeCommand = await detectComposeCommand(projectRoot);
  if (!composeCommand) {
    sendStatus("docker-not-found");
    return;
  }

  sendStatus("starting-containers");
  let recentLog = "";
  try {
    await startStack(projectRoot, {
      composeCommand,
      onLog: (line) => {
        recentLog += line;
        sendStatus("log", line);
      },
    });
  } catch (err) {
    // The single most common real-world failure: Docker is installed but
    // Docker Desktop hasn't been started yet. Detect it and give a
    // specific, actionable message instead of a generic error dump.
    const daemonDown = /docker daemon is not running|cannot connect to the docker daemon|docker\.sock/i.test(
      recentLog
    );
    sendStatus(daemonDown ? "docker-daemon-not-running" : "compose-failed", String(err.message || err));
    return;
  }

  sendStatus("waiting-for-health");
  try {
    await waitForStackHealthy([BACKEND_HEALTH_URL, FRONTEND_URL], { timeoutMs: 240000 });
  } catch (err) {
    sendStatus("health-timeout", String(err.message || err));
    return;
  }

  sendStatus("ready");
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadURL(FRONTEND_URL);
  }
}

ipcMain.handle("retry-startup", async () => {
  await bootStack();
});

ipcMain.handle("open-external", async (_event, url) => {
  if (typeof url === "string" && /^https?:\/\//.test(url)) {
    await shell.openExternal(url);
  }
});

app.whenReady().then(() => {
  createWindow(path.join(__dirname, "splash.html"));
  mainWindow.webContents.once("did-finish-load", () => {
    bootStack();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(path.join(__dirname, "splash.html"));
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async (event) => {
  if (composeCommand && projectRoot) {
    event.preventDefault();
    const commandToStop = composeCommand;
    composeCommand = null; // prevents re-entering this branch on the next quit() call below
    try {
      await stopStack(projectRoot, { composeCommand: commandToStop });
    } finally {
      app.quit();
    }
  }
});
