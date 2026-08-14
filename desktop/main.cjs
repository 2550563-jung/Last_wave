const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");

const GAME_URL = "https://2550563-jung.github.io/Last_wave/";
function openSafeExternal(url) {
  try {
    const target = new URL(url);
    if (target.protocol === "https:" || target.protocol === "http:") shell.openExternal(target.toString());
  } catch {}
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#071017",
    autoHideMenuBar: true,
    title: "Last Wave",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(GAME_URL)) return { action: "allow" };
    openSafeExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(GAME_URL) && !url.startsWith("https://nkeeayhodmauifevmaga.supabase.co")) {
      event.preventDefault();
      openSafeExternal(url);
    }
  });
  win.loadURL(GAME_URL).catch(() => win.loadFile(path.join(__dirname, "offline.html")));
  win.webContents.on("before-input-event", (_event, input) => {
    if (input.key === "F11") win.setFullScreen(!win.isFullScreen());
    if (input.key === "F5" || (input.control && input.key.toLowerCase() === "r")) win.reload();
  });
}

Menu.setApplicationMenu(null);
app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
