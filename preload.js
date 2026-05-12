/**
 * Canon EOS 3000D Viewer - Preload Script
 * =========================================
 * Bridge antara main process dan renderer process.
 * Mengekspos API yang aman melalui contextBridge.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  // ============================================================
  // Photo Operations
  // ============================================================

  /**
   * Ambil semua foto dari folder yang dimonitor
   * @param {Object} options - { path: string }
   * @returns {Promise<{success: boolean, photos: Array, total: number}>}
   */
  getAllPhotos: (options) => ipcRenderer.invoke('photos:getAll', options),

  /**
   * Baca foto sebagai base64 data URL
   * @param {string} filePath - Path file foto
   * @returns {Promise<{success: boolean, data: string}>}
   */
  readPhotoAsBase64: (filePath) => ipcRenderer.invoke('photos:readAsBase64', filePath),

  /**
   * Export/copy foto ke folder lain
   * @param {Object} options - { sourcePaths: string[], destDir: string }
   * @returns {Promise<{success: boolean, results: Array}>}
   */
  exportPhotos: (options) => ipcRenderer.invoke('photos:export', options),

  /**
   * Hapus foto
   * @param {string} filePath - Path file foto
   * @returns {Promise<{success: boolean}>}
   */
  deletePhoto: (filePath) => ipcRenderer.invoke('photos:delete', filePath),

  /**
   * Dapatkan statistik foto
   * @param {Array} photos - Array objek foto
   * @returns {Promise<{success: boolean, stats: Object}>}
   */
  getPhotoStats: (photos) => ipcRenderer.invoke('photos:getStats', photos),

  // ============================================================
  // Watcher Operations
  // ============================================================

  /**
   * Ganti folder yang dimonitor
   * @param {string} newPath - Path folder baru
   * @returns {Promise<{success: boolean, path: string}>}
   */
  changeWatchPath: (newPath) => ipcRenderer.invoke('watcher:changePath', newPath),

  /**
   * Dapatkan info watcher saat ini
   * @returns {Promise<{success: boolean, path: string, exists: boolean}>}
   */
  getWatcherInfo: () => ipcRenderer.invoke('watcher:getInfo'),

  // ============================================================
  // Dialog Operations
  // ============================================================

  /**
   * Buka dialog pilih folder
   * @returns {Promise<{success: boolean, path?: string}>}
   */
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),

  // ============================================================
  // Window Controls
  // ============================================================

  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // ============================================================
  // Event Listeners (dari main process ke renderer)
  // ============================================================

  /**
   * Listener saat foto baru ditambahkan
   * @param {Function} callback - (event, data) => void
   */
  onPhotoAdded: (callback) => {
    ipcRenderer.on('photo:added', (event, data) => callback(data));
  },

  /**
   * Listener saat foto dihapus
   * @param {Function} callback - (event, data) => void
   */
  onPhotoRemoved: (callback) => {
    ipcRenderer.on('photo:removed', (event, data) => callback(data));
  },

  /**
   * Listener saat watcher siap
   * @param {Function} callback - (event, data) => void
   */
  onWatcherReady: (callback) => {
    ipcRenderer.on('watcher:ready', (event, data) => callback(data));
  },

  /**
   * Listener saat watcher error
   * @param {Function} callback - (event, data) => void
   */
  onWatcherError: (callback) => {
    ipcRenderer.on('watcher:error', (event, data) => callback(data));
  },

  /**
   * Remove semua listener
   */
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
