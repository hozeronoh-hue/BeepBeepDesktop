const path = require("path");
const { app, BrowserWindow, ipcMain, Menu, nativeTheme, screen } = require("electron");

const isDev = process.argv.includes("--dev");
const widgetPreferences = {
  transparentBackground: false,
  skipTaskbar: false
};

function createWidgetWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;
  const windowWidth = 520;
  const windowHeight = 820;

  const widgetWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 440,
    minHeight: 700,
    x: workArea.x + workArea.width - windowWidth - 28,
    y: workArea.y + 28,
    autoHideMenuBar: true,
    backgroundColor: "#00000000",
    frame: false,
    thickFrame: true,
    transparent: true,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    title: "삑삑삑 위젯",
    alwaysOnTop: false,
    skipTaskbar: widgetPreferences.skipTaskbar,
    webPreferences: {
      preload: path.join(__dirname, "electron-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const widgetUrl = new URL(`file://${path.join(__dirname, "index.html")}`);
  widgetUrl.searchParams.set("mode", "widget");
  if (isDev) {
    widgetUrl.searchParams.set("devtools", "1");
  }

  widgetWindow.loadURL(widgetUrl.toString());

  const sendSettings = () => {
    if (!widgetWindow.isDestroyed()) {
      widgetWindow.webContents.send("widget-settings", widgetPreferences);
    }
  };

  widgetWindow.webContents.on("did-finish-load", sendSettings);
  widgetWindow.webContents.on("context-menu", () => {
    const menu = Menu.buildFromTemplate([
      {
        label: "항상 위",
        type: "checkbox",
        checked: widgetWindow.isAlwaysOnTop(),
        click: (menuItem) => {
          widgetWindow.setAlwaysOnTop(menuItem.checked);
        }
      },
      {
        label: "투명 배경",
        type: "checkbox",
        checked: widgetPreferences.transparentBackground,
        click: (menuItem) => {
          widgetPreferences.transparentBackground = menuItem.checked;
          sendSettings();
        }
      },
      {
        label: "작업표시줄 숨김",
        type: "checkbox",
        checked: widgetPreferences.skipTaskbar,
        click: (menuItem) => {
          widgetPreferences.skipTaskbar = menuItem.checked;
          widgetWindow.setSkipTaskbar(menuItem.checked);
          sendSettings();
        }
      },
      { type: "separator" },
      {
        label: "새로고침",
        click: () => widgetWindow.reload()
      },
      {
        label: "위젯 종료",
        click: () => widgetWindow.close()
      }
    ]);

    menu.popup({ window: widgetWindow });
  });

  if (isDev) {
    widgetWindow.webContents.openDevTools({ mode: "detach" });
  }

  return widgetWindow;
}

app.whenReady().then(() => {
  nativeTheme.themeSource = "light";
  const mainWindow = createWidgetWindow();

  ipcMain.handle("widget:minimize", () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWidgetWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
