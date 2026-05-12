/**
 * Canon EOS 3000D Viewer - Main Process
 * ======================================
 * Electron main process yang menangani:
 * - Window management
 * - Folder monitoring dengan chokidar
 * - File system operations
 * - IPC communication dengan renderer
 */

const { app, BrowserWindow, ipcMain, dialog, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');

// ============================================================
// Konfigurasi
// ============================================================
const CONFIG = {
  DEFAULT_WATCH_PATH: 'C:/CanonPhotos',
  SUPPORTED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.raw', '.cr2'],
  WINDOW_WIDTH: 1400,
  WINDOW_HEIGHT: 900,
  MIN_WIDTH: 1000,
  MIN_HEIGHT: 700
};

let mainWindow = null;
let watcher = null;
let currentWatchPath = CONFIG.DEFAULT_WATCH_PATH;

// ============================================================
// Window Creation
// ============================================================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: CONFIG.WINDOW_WIDTH,
    height: CONFIG.WINDOW_HEIGHT,
    minWidth: CONFIG.MIN_WIDTH,
    minHeight: CONFIG.MIN_HEIGHT,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0f',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false
  });

  mainWindow.loadFile('index.html');

  // Smooth window show
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open DevTools in dev mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

// ============================================================
// App Lifecycle
// ============================================================
app.whenReady().then(() => {
  createWindow();
  startFolderWatcher(currentWatchPath);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (watcher) watcher.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
});

// ============================================================
// Folder Watcher (Chokidar)
// ============================================================
function startFolderWatcher(watchPath) {
  // Hentikan watcher lama jika ada
  if (watcher) {
    watcher.close();
    watcher = null;
  }

  currentWatchPath = watchPath;

  // Buat folder jika belum ada
  if (!fs.existsSync(watchPath)) {
    try {
      fs.mkdirSync(watchPath, { recursive: true });
    } catch (err) {
      console.error('Gagal membuat folder:', err);
    }
  }

  // Pattern untuk file gambar yang didukung
  const globPatterns = CONFIG.SUPPORTED_EXTENSIONS.map(ext => `**/*${ext}`);

  watcher = chokidar.watch(watchPath, {
    ignored: /(^|[\/\\])\../, // Abaikan hidden files
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 200
    },
    depth: 5,
    usePolling: true,
    interval: 1000
  });

  watcher
    .on('ready', () => {
      console.log(`Watcher siap, memantau: ${watchPath}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('watcher:ready', { path: watchPath });
      }
    })
    .on('add', (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (CONFIG.SUPPORTED_EXTENSIONS.includes(ext)) {
        console.log('Foto baru terdeteksi:', filePath);
        handleNewPhoto(filePath);
      }
    })
    .on('unlink', (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (CONFIG.SUPPORTED_EXTENSIONS.includes(ext)) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('photo:removed', { path: filePath });
        }
      }
    })
    .on('error', (error) => {
      console.error('Watcher error:', error);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('watcher:error', { message: error.message });
      }
    });
}

// ============================================================
// Handle Foto Baru
// ============================================================
function handleNewPhoto(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const photoData = {
      path: filePath,
      name: path.basename(filePath),
      dir: path.dirname(filePath),
      ext: path.extname(filePath).toLowerCase(),
      size: stats.size,
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString()
    };

    // Kirim ke renderer process
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('photo:added', photoData);
    }

    // Kirim native notification
    showNativeNotification(photoData.name);

  } catch (err) {
    console.error('Error processing new photo:', err);
  }
}

// ============================================================
// Native Notification
// ============================================================
function showNativeNotification(filename) {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: 'Foto Baru Terdeteksi!',
      body: `${filename} telah ditambahkan ke gallery.`,
      silent: false
    });
    notification.show();
  }
}

// ============================================================
// IPC Handlers
// ============================================================

// Ambil daftar semua foto
ipcMain.handle('photos:getAll', async (event, options = {}) => {
  const watchPath = options.path || currentWatchPath;
  const photos = [];

  try {
    if (!fs.existsSync(watchPath)) {
      return { success: false, error: 'Folder tidak ditemukan', photos: [] };
    }

    function scanDir(dir) {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          scanDir(fullPath);
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();
          if (CONFIG.SUPPORTED_EXTENSIONS.includes(ext)) {
            try {
              const stats = fs.statSync(fullPath);
              photos.push({
                path: fullPath,
                name: item.name,
                dir: path.dirname(fullPath),
                ext: ext,
                size: stats.size,
                created: stats.birthtime.toISOString(),
                modified: stats.mtime.toISOString()
              });
            } catch (statErr) {
              // Skip file yang tidak bisa diakses
            }
          }
        }
      }
    }

    scanDir(watchPath);

    // Sort berdasarkan tanggal pembuatan (terbaru duluan)
    photos.sort((a, b) => new Date(b.created) - new Date(a.created));

    return { success: true, photos, total: photos.length };
  } catch (err) {
    return { success: false, error: err.message, photos: [] };
  }
});

// Baca file foto sebagai base64 untuk preview
ipcMain.handle('photos:readAsBase64', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File tidak ditemukan' };
    }

    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();

    let mimeType = 'image/jpeg';
    switch (ext) {
      case '.png': mimeType = 'image/png'; break;
      case '.bmp': mimeType = 'image/bmp'; break;
      case '.tiff':
      case '.tif': mimeType = 'image/tiff'; break;
      default: mimeType = 'image/jpeg';
    }

    const base64 = buffer.toString('base64');
    return {
      success: true,
      data: `data:${mimeType};base64,${base64}`,
      size: buffer.length
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Ganti folder yang dimonitor
ipcMain.handle('watcher:changePath', async (event, newPath) => {
  try {
    if (!fs.existsSync(newPath)) {
      fs.mkdirSync(newPath, { recursive: true });
    }
    startFolderWatcher(newPath);
    return { success: true, path: newPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Pilih folder dengan dialog
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Pilih Folder Foto Canon EOS 3000D'
  });

  if (result.canceled) {
    return { success: false, canceled: true };
  }

  const selectedPath = result.filePaths[0];
  startFolderWatcher(selectedPath);
  return { success: true, path: selectedPath };
});

// Export/Copy foto ke folder lain
ipcMain.handle('photos:export', async (event, options) => {
  const { sourcePaths, destDir } = options;

  try {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const results = [];
    for (const srcPath of sourcePaths) {
      try {
        const filename = path.basename(srcPath);
        const destPath = path.join(destDir, filename);

        // Handle duplicate names
        let finalDestPath = destPath;
        let counter = 1;
        while (fs.existsSync(finalDestPath)) {
          const name = path.basename(srcPath, path.extname(srcPath));
          const ext = path.extname(srcPath);
          finalDestPath = path.join(destDir, `${name}_${counter}${ext}`);
          counter++;
        }

        fs.copyFileSync(srcPath, finalDestPath);
        results.push({ original: srcPath, copied: finalDestPath, success: true });
      } catch (copyErr) {
        results.push({ original: srcPath, success: false, error: copyErr.message });
      }
    }

    return { success: true, results };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Hapus foto
ipcMain.handle('photos:delete', async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true };
    }
    return { success: false, error: 'File tidak ditemukan' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Dapatkan info folder yang dimonitor
ipcMain.handle('watcher:getInfo', async () => {
  return {
    success: true,
    path: currentWatchPath,
    exists: fs.existsSync(currentWatchPath),
    extensions: CONFIG.SUPPORTED_EXTENSIONS
  };
});

// Window controls
ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// Dapatkan statistik
ipcMain.handle('photos:getStats', async (event, photos) => {
  try {
    const totalSize = photos.reduce((sum, p) => sum + (p.size || 0), 0);
    const totalPhotos = photos.length;

    const extensions = {};
    photos.forEach(p => {
      const ext = p.ext || 'unknown';
      extensions[ext] = (extensions[ext] || 0) + 1;
    });

    const today = new Date().toDateString();
    const todayPhotos = photos.filter(p =>
      new Date(p.created).toDateString() === today
    ).length;

    return {
      success: true,
      stats: {
        totalPhotos,
        totalSize,
        totalSizeFormatted: formatBytes(totalSize),
        extensions,
        todayPhotos
      }
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ============================================================
// Utility
// ============================================================
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
