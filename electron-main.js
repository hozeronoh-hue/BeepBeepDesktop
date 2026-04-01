const path = require("path");
const { app, BrowserWindow, ipcMain, Menu, nativeTheme, screen } = require("electron");

const isDev = process.argv.includes("--dev");
const SIZE_PRESETS = {
  small: { width: 340, height: 560 },
  medium: { width: 380, height: 620 },
  large: { width: 440, height: 720 },
};

const widgetPreferences = {
  transparentBackground: false,
  skipTaskbar: false,
  sizePreset: "medium",
  opacityLevel: 1,
};

function getPresetBounds(presetName) {
  return SIZE_PRESETS[presetName] ?? SIZE_PRESETS.medium;
}

function applyWindowPreset(widgetWindow, presetName) {
  const primaryDisplay = screen.getDisplayMatching(widgetWindow.getBounds());
  const workArea = primaryDisplay.workArea;
  const nextPreset = SIZE_PRESETS[presetName] ? presetName : "medium";
  const { width, height } = getPresetBounds(nextPreset);
  const bounds = widgetWindow.getBounds();

  const nextX = Math.min(
    Math.max(workArea.x, bounds.x + bounds.width - width),
    workArea.x + workArea.width - width
  );
  const nextY = Math.min(
    Math.max(workArea.y, bounds.y),
    workArea.y + workArea.height - height
  );

  widgetPreferences.sizePreset = nextPreset;
  widgetWindow.setBounds({
    x: nextX,
    y: nextY,
    width,
    height,
  });
}

function applyWindowOpacity(widgetWindow, opacityLevel) {
  const safeOpacity = Math.max(0.35, Math.min(1, opacityLevel));
  widgetPreferences.opacityLevel = safeOpacity;
  widgetPreferences.transparentBackground = safeOpacity < 1;

  let actualOpacity = 1;
  if (safeOpacity <= 0.55) {
    actualOpacity = 0.7;
  } else if (safeOpacity <= 0.7) {
    actualOpacity = 0.85;
  } else if (safeOpacity <= 0.85) {
    actualOpacity = 1;
  }

  widgetWindow.setOpacity(actualOpacity);
}

function buildContextMenu(widgetWindow, sendSettings) {
  return Menu.buildFromTemplate([
    {
      label: "항상 위에",
      type: "checkbox",
      checked: widgetWindow.isAlwaysOnTop(),
      click: (menuItem) => {
        widgetWindow.setAlwaysOnTop(menuItem.checked);
      },
    },
    {
      label: "작업표시줄에서 숨기기",
      type: "checkbox",
      checked: widgetPreferences.skipTaskbar,
      click: (menuItem) => {
        widgetPreferences.skipTaskbar = menuItem.checked;
        widgetWindow.setSkipTaskbar(menuItem.checked);
        sendSettings();
      },
    },
    {
      label: "투명도",
      submenu: [
        {
          label: "100%",
          type: "radio",
          checked: widgetPreferences.opacityLevel === 1,
          click: () => {
            applyWindowOpacity(widgetWindow, 1);
            sendSettings();
          },
        },
        {
          label: "85%",
          type: "radio",
          checked: widgetPreferences.opacityLevel === 0.85,
          click: () => {
            applyWindowOpacity(widgetWindow, 0.85);
            sendSettings();
          },
        },
        {
          label: "70%",
          type: "radio",
          checked: widgetPreferences.opacityLevel === 0.7,
          click: () => {
            applyWindowOpacity(widgetWindow, 0.7);
            sendSettings();
          },
        },
        {
          label: "55%",
          type: "radio",
          checked: widgetPreferences.opacityLevel === 0.55,
          click: () => {
            applyWindowOpacity(widgetWindow, 0.55);
            sendSettings();
          },
        },
      ],
    },
    {
      label: "크기",
      submenu: [
        {
          label: "작게",
          type: "radio",
          checked: widgetPreferences.sizePreset === "small",
          click: () => applyWindowPreset(widgetWindow, "small"),
        },
        {
          label: "중간",
          type: "radio",
          checked: widgetPreferences.sizePreset === "medium",
          click: () => applyWindowPreset(widgetWindow, "medium"),
        },
        {
          label: "크게",
          type: "radio",
          checked: widgetPreferences.sizePreset === "large",
          click: () => applyWindowPreset(widgetWindow, "large"),
        },
      ],
    },
    { type: "separator" },
    {
      label: "새로고침",
      click: () => widgetWindow.reload(),
    },
    {
      label: "종료",
      click: () => widgetWindow.close(),
    },
  ]);
}

function createWidgetWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;
  const { width: windowWidth, height: windowHeight } = getPresetBounds(widgetPreferences.sizePreset);

  const widgetWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: SIZE_PRESETS.small.width,
    minHeight: SIZE_PRESETS.small.height,
    x: workArea.x + workArea.width - windowWidth - 28,
    y: workArea.y + 28,
    autoHideMenuBar: true,
    backgroundColor: "#00000000",
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "BeepBeepBeep Widget",
    alwaysOnTop: false,
    skipTaskbar: widgetPreferences.skipTaskbar,
    webPreferences: {
      preload: path.join(__dirname, "electron-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const widgetUrl = new URL(`file://${path.join(__dirname, "index.html")}`);
  widgetUrl.searchParams.set("mode", "widget");
  if (isDev) {
    widgetUrl.searchParams.set("devtools", "1");
  }

  widgetWindow.loadURL(widgetUrl.toString());
  applyWindowOpacity(widgetWindow, widgetPreferences.opacityLevel);

  const sendSettings = () => {
    if (!widgetWindow.isDestroyed()) {
      widgetWindow.webContents.send("widget-settings", widgetPreferences);
    }
  };

  widgetWindow.webContents.on("did-finish-load", sendSettings);
  widgetWindow.webContents.on("context-menu", () => {
    const menu = buildContextMenu(widgetWindow, sendSettings);
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
