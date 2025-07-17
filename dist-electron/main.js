import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { join } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
const __dirname = fileURLToPath(new URL("data:application/octet-stream;base64,", import.meta.url));
const isDev = process.env.NODE_ENV === "development";
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    titleBarStyle: "hiddenInset",
    // Makes it look more native on macOS
    trafficLightPosition: { x: 20, y: 20 }
  });
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }
  ipcMain.handle("open-file-dialog", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [{ name: "PDF Files", extensions: ["pdf"] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const fileBuffer = readFileSync(filePath);
      return {
        path: filePath,
        name: filePath.split("/").pop(),
        buffer: fileBuffer
      };
    }
    return null;
  });
}
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
