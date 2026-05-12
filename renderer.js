/**
 * Canon EOS 3000D Viewer - Renderer Process
 * ============================================
 * Mengelola seluruh UI logic:
 * - Gallery rendering & management
 * - Search & filter
 * - Photo preview modal
 * - Toast notifications
 * - Context menu
 * - Drag & drop
 * - Keyboard shortcuts
 */

// ============================================================
// STATE MANAGEMENT
// ============================================================
const AppState = {
  photos: [],              // Semua foto yang terdeteksi
  filteredPhotos: [],      // Foto setelah filter/search
  selectedPhotos: new Set(), // Foto yang dipilih
  currentFilter: 'all',   // Filter aktif
  searchQuery: '',         // Query pencarian
  viewMode: 'grid',       // grid | list
  previewIndex: -1,        // Index foto yang sedang dipreview
  isLoading: true,         // Loading state
  isConnected: false,      // Status koneksi
  watchPath: 'C:/CanonPhotos/', // Folder yang dimonitor
  lastUpdate: null,        // Terakhir kali gallery diupdate
  photoCache: new Map(),   // Cache base64 images
  newlyAdded: new Set(),   // Foto yang baru ditambahkan
};

// ============================================================
// DOM REFERENCES
// ============================================================
const DOM = {
  // Topbar
  searchInput: document.getElementById('searchInput'),
  searchClear: document.getElementById('searchClear'),
  btnRefresh: document.getElementById('btnRefresh'),
  btnFolder: document.getElementById('btnFolder'),
  btnExport: document.getElementById('btnExport'),
  btnMinimize: document.getElementById('btnMinimize'),
  btnMaximize: document.getElementById('btnMaximize'),
  btnClose: document.getElementById('btnClose'),

  // Sidebar
  statusDot: document.getElementById('statusDot'),
  statusLabel: document.getElementById('statusLabel'),
  statusDetail: document.getElementById('statusDetail'),
  watchPath: document.getElementById('watchPath'),
  btnChangeFolder: document.getElementById('btnChangeFolder'),
  statTotal: document.getElementById('statTotal'),
  statToday: document.getElementById('statToday'),
  statSize: document.getElementById('statSize'),
  statLastUpdate: document.getElementById('statLastUpdate'),

  // Main Content
  galleryTitle: document.getElementById('galleryTitle'),
  photoCount: document.getElementById('photoCount'),
  btnGridView: document.getElementById('btnGridView'),
  btnListView: document.getElementById('btnListView'),
  btnSelectAll: document.getElementById('btnSelectAll'),
  btnDeleteSelected: document.getElementById('btnDeleteSelected'),

  // States
  loadingState: document.getElementById('loadingState'),
  emptyState: document.getElementById('emptyState'),
  noResultsState: document.getElementById('noResultsState'),
  noResultsText: document.getElementById('noResultsText'),
  photoGallery: document.getElementById('photoGallery'),
  dropZone: document.getElementById('dropZone'),

  // Preview Modal
  previewModal: document.getElementById('previewModal'),
  previewFilename: document.getElementById('previewFilename'),
  previewMeta: document.getElementById('previewMeta'),
  previewImage: document.getElementById('previewImage'),
  previewLoader: document.getElementById('previewLoader'),
  btnPrevPhoto: document.getElementById('btnPrevPhoto'),
  btnNextPhoto: document.getElementById('btnNextPhoto'),
  btnDownloadPhoto: document.getElementById('btnDownloadPhoto'),
  btnClosePreview: document.getElementById('btnClosePreview'),

  // Context Menu
  contextMenu: document.getElementById('contextMenu'),

  // Toast
  toastContainer: document.getElementById('toastContainer'),

  // Filters
  filterBtns: document.querySelectorAll('.sidebar__filter-btn'),
};

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', init);

async function init() {
  setupEventListeners();
  setupIpcListeners();
  setupKeyboardShortcuts();
  setupDragAndDrop();

  await loadWatcherInfo();
  await loadAllPhotos();

  AppState.isLoading = false;
  updateUI();
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
  // Search
  DOM.searchInput.addEventListener('input', debounce(handleSearch, 200));
  DOM.searchClear.addEventListener('click', clearSearch);

  // Topbar buttons
  DOM.btnRefresh.addEventListener('click', handleRefresh);
  DOM.btnFolder.addEventListener('click', handleFolderChange);
  DOM.btnExport.addEventListener('click', handleExport);

  // Window controls
  DOM.btnMinimize.addEventListener('click', () => window.electronAPI.minimizeWindow());
  DOM.btnMaximize.addEventListener('click', () => window.electronAPI.maximizeWindow());
  DOM.btnClose.addEventListener('click', () => window.electronAPI.closeWindow());

  // Sidebar
  DOM.btnChangeFolder.addEventListener('click', handleFolderChange);

  // View toggle
  DOM.btnGridView.addEventListener('click', () => setViewMode('grid'));
  DOM.btnListView.addEventListener('click', () => setViewMode('list'));

  // Select/Deselect
  DOM.btnSelectAll.addEventListener('click', handleSelectAll);
  DOM.btnDeleteSelected.addEventListener('click', handleDeleteSelected);

  // Filter buttons
  DOM.filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.currentFilter = btn.dataset.filter;
      applyFilters();
      renderGallery();
    });
  });

  // Preview modal
  DOM.btnClosePreview.addEventListener('click', closePreview);
  DOM.btnPrevPhoto.addEventListener('click', () => navigatePreview(-1));
  DOM.btnNextPhoto.addEventListener('click', () => navigatePreview(1));
  DOM.btnDownloadPhoto.addEventListener('click', handleDownloadPreview);
  DOM.previewModal.querySelector('.preview-modal__backdrop').addEventListener('click', closePreview);

  // Context menu close
  document.addEventListener('click', () => DOM.contextMenu.classList.add('hidden'));
  document.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('.photo-card')) {
      DOM.contextMenu.classList.add('hidden');
    }
  });

  // Context menu actions
  DOM.contextMenu.querySelectorAll('.context-menu__item').forEach(item => {
    item.addEventListener('click', () => handleContextAction(item.dataset.action));
  });
}

// ============================================================
// IPC LISTENERS (Real-time events from main process)
// ============================================================
function setupIpcListeners() {
  window.electronAPI.onPhotoAdded((photoData) => {
    handleNewPhoto(photoData);
  });

  window.electronAPI.onPhotoRemoved((data) => {
    handlePhotoRemoved(data);
  });

  window.electronAPI.onWatcherReady((data) => {
    AppState.isConnected = true;
    AppState.watchPath = data.path;
    updateConnectionStatus(true);
    DOM.watchPath.textContent = data.path;
    DOM.watchPath.title = data.path;
  });

  window.electronAPI.onWatcherError((data) => {
    AppState.isConnected = false;
    updateConnectionStatus(false, data.message);
    showToast('error', 'Error Watcher', data.message);
  });
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Escape - tutup modal/context menu
    if (e.key === 'Escape') {
      closePreview();
      DOM.contextMenu.classList.add('hidden');
    }

    // Arrow keys di preview modal
    if (!DOM.previewModal.classList.contains('hidden')) {
      if (e.key === 'ArrowLeft') navigatePreview(-1);
      if (e.key === 'ArrowRight') navigatePreview(1);
    }

    // Ctrl+A - pilih semua
    if (e.ctrlKey && e.key === 'a' && !e.target.closest('input')) {
      e.preventDefault();
      handleSelectAll();
    }

    // Ctrl+F - fokus search
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      DOM.searchInput.focus();
    }

    // Delete - hapus yang dipilih
    if (e.key === 'Delete' && AppState.selectedPhotos.size > 0) {
      handleDeleteSelected();
    }

    // F5 - refresh
    if (e.key === 'F5') {
      e.preventDefault();
      handleRefresh();
    }
  });
}

// ============================================================
// DRAG AND DROP
// ============================================================
function setupDragAndDrop() {
  let dragCounter = 0;

  const mainContent = document.querySelector('.main-content');

  mainContent.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    DOM.dropZone.classList.remove('hidden');
  });

  mainContent.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      DOM.dropZone.classList.add('hidden');
    }
  });

  mainContent.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  mainContent.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    DOM.dropZone.classList.add('hidden');

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f =>
      /\.(jpg|jpeg|png|bmp|tiff|tif|raw|cr2)$/i.test(f.name)
    );

    if (imageFiles.length > 0) {
      showToast('info', 'Drag & Drop', `${imageFiles.length} file terdeteksi. Salin file ke folder monitor untuk menampilkannya.`);
    } else {
      showToast('warning', 'Format Tidak Didukung', 'Hanya file gambar yang didukung.');
    }
  });
}

// ============================================================
// LOAD DATA
// ============================================================
async function loadWatcherInfo() {
  try {
    const result = await window.electronAPI.getWatcherInfo();
    if (result.success) {
      AppState.watchPath = result.path;
      DOM.watchPath.textContent = result.path;
      DOM.watchPath.title = result.path;
      updateConnectionStatus(result.exists);
    }
  } catch (err) {
    console.error('Error loading watcher info:', err);
  }
}

async function loadAllPhotos() {
  AppState.isLoading = true;
  updateUI();

  try {
    const result = await window.electronAPI.getAllPhotos();
    if (result.success) {
      AppState.photos = result.photos;
      applyFilters();
      updateStats();
    } else {
      showToast('error', 'Error', result.error || 'Gagal memuat foto');
    }
  } catch (err) {
    console.error('Error loading photos:', err);
    showToast('error', 'Error', 'Gagal memuat foto dari folder');
  }

  AppState.isLoading = false;
  updateUI();
}

// ============================================================
// HANDLE NEW PHOTO (Real-time)
// ============================================================
function handleNewPhoto(photoData) {
  // Cek duplikat
  const exists = AppState.photos.find(p => p.path === photoData.path);
  if (exists) return;

  // Tambah ke awal array (terbaru duluan)
  AppState.photos.unshift(photoData);

  // Tandai sebagai baru
  AppState.newlyAdded.add(photoData.path);

  // Hapus tanda baru setelah 5 detik
  setTimeout(() => {
    AppState.newlyAdded.delete(photoData.path);
    const card = document.querySelector(`[data-path="${CSS.escape(photoData.path)}"]`);
    if (card) {
      const badge = card.querySelector('.photo-card__new-badge');
      if (badge) badge.remove();
    }
  }, 5000);

  // Apply filter & render
  applyFilters();
  renderGallery();
  updateStats();

  // Toast notification
  showToast('success', 'Foto Baru!', photoData.name);

  // Auto scroll ke foto terbaru
  scrollToNewPhoto(photoData.path);
}

function handlePhotoRemoved(data) {
  AppState.photos = AppState.photos.filter(p => p.path !== data.path);
  AppState.selectedPhotos.delete(data.path);
  AppState.photoCache.delete(data.path);

  applyFilters();
  renderGallery();
  updateStats();

  showToast('info', 'Foto Dihapus', 'Foto telah dihapus dari gallery');
}

function scrollToNewPhoto(photoPath) {
  requestAnimationFrame(() => {
    const card = document.querySelector(`[data-path="${CSS.escape(photoPath)}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('new-photo-highlight');
    }
  });
}

// ============================================================
// FILTERS & SEARCH
// ============================================================
function applyFilters() {
  let photos = [...AppState.photos];

  // Filter berdasarkan ekstensi
  if (AppState.currentFilter !== 'all') {
    photos = photos.filter(p => p.ext === AppState.currentFilter);
  }

  // Filter berdasarkan search
  if (AppState.searchQuery) {
    const query = AppState.searchQuery.toLowerCase();
    photos = photos.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.path.toLowerCase().includes(query)
    );
  }

  AppState.filteredPhotos = photos;
}

function handleSearch() {
  const query = DOM.searchInput.value.trim();
  AppState.searchQuery = query;

  DOM.searchClear.classList.toggle('hidden', !query);

  applyFilters();
  renderGallery();
}

function clearSearch() {
  DOM.searchInput.value = '';
  AppState.searchQuery = '';
  DOM.searchClear.classList.add('hidden');
  applyFilters();
  renderGallery();
  DOM.searchInput.focus();
}

// ============================================================
// RENDER GALLERY
// ============================================================
function renderGallery() {
  const gallery = DOM.photoGallery;

  // Jika tidak ada foto setelah filter
  if (AppState.filteredPhotos.length === 0) {
    gallery.classList.add('hidden');

    if (AppState.searchQuery && AppState.photos.length > 0) {
      DOM.noResultsState.classList.remove('hidden');
      DOM.emptyState.classList.add('hidden');
      DOM.noResultsText.textContent = `Tidak ada foto yang cocok dengan "${AppState.searchQuery}"`;
    } else if (AppState.photos.length === 0) {
      DOM.emptyState.classList.remove('hidden');
      DOM.noResultsState.classList.add('hidden');
    }
    return;
  }

  DOM.emptyState.classList.add('hidden');
  DOM.noResultsState.classList.add('hidden');
  gallery.classList.remove('hidden');

  // Build HTML
  const fragment = document.createDocumentFragment();

  AppState.filteredPhotos.forEach((photo, index) => {
    const card = createPhotoCard(photo, index);
    fragment.appendChild(card);
  });

  gallery.innerHTML = '';
  gallery.appendChild(fragment);

  // Load images asynchronously
  AppState.filteredPhotos.forEach((photo) => {
    loadThumbnail(photo);
  });

  // Update photo count
  DOM.photoCount.textContent = `${AppState.filteredPhotos.length} foto`;
}

function createPhotoCard(photo, index) {
  const card = document.createElement('div');
  card.className = 'photo-card';
  card.dataset.path = photo.path;
  card.dataset.index = index;

  if (AppState.selectedPhotos.has(photo.path)) {
    card.classList.add('selected');
  }

  const isNew = AppState.newlyAdded.has(photo.path);

  card.innerHTML = `
    <div class="photo-card__image-wrapper">
      <div class="shimmer" style="position:absolute;inset:0;"></div>
      <img class="photo-card__image photo-card__image--loading" alt="${escapeHtml(photo.name)}" />
      <div class="photo-card__checkbox">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <span class="photo-card__badge">${photo.ext.replace('.', '').toUpperCase()}</span>
      ${isNew ? '<span class="photo-card__new-badge">BARU</span>' : ''}
    </div>
    <div class="photo-card__info">
      <div class="photo-card__name" title="${escapeHtml(photo.name)}">${escapeHtml(photo.name)}</div>
      <div class="photo-card__meta">
        <span>${formatFileSize(photo.size)}</span>
        <span>${formatDate(photo.created)}</span>
      </div>
    </div>
  `;

  // Click handler - preview
  card.addEventListener('click', (e) => {
    if (e.ctrlKey || e.metaKey) {
      togglePhotoSelection(photo.path, card);
    } else {
      openPreview(index);
    }
  });

  // Right click - context menu
  card.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e, photo);
  });

  // Checkbox click
  const checkbox = card.querySelector('.photo-card__checkbox');
  checkbox.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePhotoSelection(photo.path, card);
  });

  return card;
}

async function loadThumbnail(photo) {
  // Cek cache dulu
  if (AppState.photoCache.has(photo.path)) {
    applyThumbnail(photo.path, AppState.photoCache.get(photo.path));
    return;
  }

  try {
    const result = await window.electronAPI.readPhotoAsBase64(photo.path);
    if (result.success) {
      AppState.photoCache.set(photo.path, result.data);
      applyThumbnail(photo.path, result.data);

      // Batasi cache (simpan max 200 foto)
      if (AppState.photoCache.size > 200) {
        const firstKey = AppState.photoCache.keys().next().value;
        AppState.photoCache.delete(firstKey);
      }
    }
  } catch (err) {
    console.error('Error loading thumbnail:', err);
  }
}

function applyThumbnail(photoPath, dataUrl) {
  const card = document.querySelector(`[data-path="${CSS.escape(photoPath)}"]`);
  if (!card) return;

  const img = card.querySelector('.photo-card__image');
  const shimmer = card.querySelector('.shimmer');

  if (img) {
    img.src = dataUrl;
    img.onload = () => {
      img.classList.remove('photo-card__image--loading');
      img.classList.add('photo-card__image--loaded');
      if (shimmer) shimmer.remove();
    };
  }
}

// ============================================================
// PHOTO SELECTION
// ============================================================
function togglePhotoSelection(photoPath, cardElement) {
  if (AppState.selectedPhotos.has(photoPath)) {
    AppState.selectedPhotos.delete(photoPath);
    cardElement.classList.remove('selected');
  } else {
    AppState.selectedPhotos.add(photoPath);
    cardElement.classList.add('selected');
  }

  updateSelectionUI();
}

function handleSelectAll() {
  const allSelected = AppState.selectedPhotos.size === AppState.filteredPhotos.length;

  if (allSelected) {
    // Deselect all
    AppState.selectedPhotos.clear();
    document.querySelectorAll('.photo-card.selected').forEach(c => c.classList.remove('selected'));
  } else {
    // Select all
    AppState.filteredPhotos.forEach(p => AppState.selectedPhotos.add(p.path));
    document.querySelectorAll('.photo-card').forEach(c => c.classList.add('selected'));
  }

  updateSelectionUI();
}

function updateSelectionUI() {
  const count = AppState.selectedPhotos.size;
  DOM.btnDeleteSelected.classList.toggle('hidden', count === 0);
  DOM.btnSelectAll.innerHTML = count > 0
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg> Batal (${count})`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> Pilih Semua`;
}

async function handleDeleteSelected() {
  const count = AppState.selectedPhotos.size;
  if (count === 0) return;

  const confirmed = confirm(`Hapus ${count} foto? Tindakan ini tidak dapat dibatalkan.`);
  if (!confirmed) return;

  const paths = Array.from(AppState.selectedPhotos);
  let deleted = 0;

  for (const p of paths) {
    try {
      const result = await window.electronAPI.deletePhoto(p);
      if (result.success) {
        AppState.photos = AppState.photos.filter(photo => photo.path !== p);
        AppState.photoCache.delete(p);
        deleted++;
      }
    } catch (err) {
      console.error('Error deleting photo:', err);
    }
  }

  AppState.selectedPhotos.clear();
  applyFilters();
  renderGallery();
  updateStats();

  showToast('success', 'Foto Dihapus', `${deleted} foto berhasil dihapus`);
}

// ============================================================
// PREVIEW MODAL
// ============================================================
async function openPreview(index) {
  AppState.previewIndex = index;
  const photo = AppState.filteredPhotos[index];
  if (!photo) return;

  DOM.previewFilename.textContent = photo.name;
  DOM.previewMeta.textContent = `${formatFileSize(photo.size)} • ${formatDate(photo.created)} • ${photo.ext.replace('.', '').toUpperCase()}`;

  DOM.previewImage.classList.remove('loaded');
  DOM.previewImage.src = '';
  DOM.previewLoader.classList.remove('hidden');
  DOM.previewModal.classList.remove('hidden');

  try {
    const result = await window.electronAPI.readPhotoAsBase64(photo.path);
    if (result.success) {
      DOM.previewImage.src = result.data;
      DOM.previewImage.onload = () => {
        DOM.previewImage.classList.add('loaded');
        DOM.previewLoader.classList.add('hidden');
      };
    }
  } catch (err) {
    console.error('Error loading preview:', err);
    DOM.previewLoader.classList.add('hidden');
  }
}

function closePreview() {
  DOM.previewModal.classList.add('hidden');
  DOM.previewImage.src = '';
  AppState.previewIndex = -1;
}

function navigatePreview(direction) {
  const newIndex = AppState.previewIndex + direction;
  if (newIndex >= 0 && newIndex < AppState.filteredPhotos.length) {
    openPreview(newIndex);
  }
}

async function handleDownloadPreview() {
  if (AppState.previewIndex < 0) return;
  const photo = AppState.filteredPhotos[AppState.previewIndex];

  const result = await window.electronAPI.openFolderDialog();
  if (!result.success || result.canceled) return;

  try {
    const exportResult = await window.electronAPI.exportPhotos({
      sourcePaths: [photo.path],
      destDir: result.path
    });

    if (exportResult.success) {
      showToast('success', 'Export Berhasil', `Foto disimpan ke ${result.path}`);
    }
  } catch (err) {
    showToast('error', 'Export Gagal', err.message);
  }
}

// ============================================================
// CONTEXT MENU
// ============================================================
let contextMenuPhoto = null;

function showContextMenu(e, photo) {
  contextMenuPhoto = photo;

  DOM.contextMenu.classList.remove('hidden');
  DOM.contextMenu.style.left = `${e.clientX}px`;
  DOM.contextMenu.style.top = `${e.clientY}px`;

  // Pastikan tidak keluar layar
  requestAnimationFrame(() => {
    const rect = DOM.contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      DOM.contextMenu.style.left = `${window.innerWidth - rect.width - 10}px`;
    }
    if (rect.bottom > window.innerHeight) {
      DOM.contextMenu.style.top = `${window.innerHeight - rect.height - 10}px`;
    }
  });
}

async function handleContextAction(action) {
  if (!contextMenuPhoto) return;

  DOM.contextMenu.classList.add('hidden');

  switch (action) {
    case 'preview': {
      const index = AppState.filteredPhotos.findIndex(p => p.path === contextMenuPhoto.path);
      if (index >= 0) openPreview(index);
      break;
    }
    case 'export': {
      const folderResult = await window.electronAPI.openFolderDialog();
      if (!folderResult.success || folderResult.canceled) return;

      try {
        const exportResult = await window.electronAPI.exportPhotos({
          sourcePaths: [contextMenuPhoto.path],
          destDir: folderResult.path
        });
        if (exportResult.success) {
          showToast('success', 'Export Berhasil', `Foto disimpan ke ${folderResult.path}`);
        }
      } catch (err) {
        showToast('error', 'Export Gagal', err.message);
      }
      break;
    }
    case 'delete': {
      const confirmed = confirm(`Hapus foto "${contextMenuPhoto.name}"?`);
      if (!confirmed) return;

      try {
        const result = await window.electronAPI.deletePhoto(contextMenuPhoto.path);
        if (result.success) {
          AppState.photos = AppState.photos.filter(p => p.path !== contextMenuPhoto.path);
          AppState.photoCache.delete(contextMenuPhoto.path);
          applyFilters();
          renderGallery();
          updateStats();
          showToast('success', 'Dihapus', 'Foto berhasil dihapus');
        }
      } catch (err) {
        showToast('error', 'Gagal Menghapus', err.message);
      }
      break;
    }
  }
}

// ============================================================
// TOPBAR ACTIONS
// ============================================================
async function handleRefresh() {
  // Animasi rotate pada tombol refresh
  DOM.btnRefresh.style.transition = 'transform 0.5s ease';
  DOM.btnRefresh.style.transform = 'rotate(360deg)';
  setTimeout(() => {
    DOM.btnRefresh.style.transform = '';
  }, 500);

  await loadAllPhotos();
  showToast('info', 'Gallery Diperbarui', `${AppState.photos.length} foto dimuat`);
}

async function handleFolderChange() {
  const result = await window.electronAPI.openFolderDialog();
  if (!result.success || result.canceled) return;

  AppState.watchPath = result.path;
  DOM.watchPath.textContent = result.path;
  DOM.watchPath.title = result.path;

  await loadAllPhotos();
  showToast('info', 'Folder Diubah', `Memantau: ${result.path}`);
}

async function handleExport() {
  const paths = AppState.selectedPhotos.size > 0
    ? Array.from(AppState.selectedPhotos)
    : AppState.filteredPhotos.map(p => p.path);

  if (paths.length === 0) {
    showToast('warning', 'Tidak Ada Foto', 'Tidak ada foto untuk di-export');
    return;
  }

  const folderResult = await window.electronAPI.openFolderDialog();
  if (!folderResult.success || folderResult.canceled) return;

  try {
    const exportResult = await window.electronAPI.exportPhotos({
      sourcePaths: paths,
      destDir: folderResult.path
    });

    if (exportResult.success) {
      const successCount = exportResult.results.filter(r => r.success).length;
      showToast('success', 'Export Berhasil', `${successCount} foto di-export ke ${folderResult.path}`);
    }
  } catch (err) {
    showToast('error', 'Export Gagal', err.message);
  }
}

// ============================================================
// VIEW MODE
// ============================================================
function setViewMode(mode) {
  AppState.viewMode = mode;

  DOM.btnGridView.classList.toggle('active', mode === 'grid');
  DOM.btnListView.classList.toggle('active', mode === 'list');
  DOM.photoGallery.classList.toggle('list-view', mode === 'list');
}

// ============================================================
// UI UPDATES
// ============================================================
function updateUI() {
  if (AppState.isLoading) {
    DOM.loadingState.classList.remove('hidden');
    DOM.emptyState.classList.add('hidden');
    DOM.noResultsState.classList.add('hidden');
    DOM.photoGallery.classList.add('hidden');
  } else {
    DOM.loadingState.classList.add('hidden');
    if (AppState.filteredPhotos.length === 0 && AppState.photos.length === 0) {
      DOM.emptyState.classList.remove('hidden');
      DOM.photoGallery.classList.add('hidden');
    } else {
      DOM.emptyState.classList.add('hidden');
      DOM.photoGallery.classList.remove('hidden');
    }
  }
}

function updateConnectionStatus(connected, message) {
  AppState.isConnected = connected;

  DOM.statusDot.className = 'status-indicator ' + (connected ? 'status-indicator--connected' : 'status-indicator--disconnected');
  DOM.statusLabel.textContent = connected ? 'Terhubung' : (message || 'Terputus');
  DOM.statusDetail.textContent = connected ? 'Canon EOS 3000D' : 'Kamera tidak terdeteksi';
}

async function updateStats() {
  DOM.statTotal.textContent = AppState.photos.length;

  const today = new Date().toDateString();
  const todayCount = AppState.photos.filter(p =>
    new Date(p.created).toDateString() === today
  ).length;
  DOM.statToday.textContent = todayCount;

  const totalSize = AppState.photos.reduce((sum, p) => sum + (p.size || 0), 0);
  DOM.statSize.textContent = formatFileSize(totalSize);

  AppState.lastUpdate = new Date();
  DOM.statLastUpdate.textContent = formatTime(AppState.lastUpdate);
}

// ============================================================
// TOAST NOTIFICATION SYSTEM
// ============================================================
let toastCounter = 0;

function showToast(type, title, message, duration = 4000) {
  const id = `toast-${++toastCounter}`;

  const iconSVG = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6"/><path d="M9 9l6 6"/></svg>'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.id = id;
  toast.innerHTML = `
    <div class="toast__icon">${iconSVG[type]}</div>
    <div class="toast__content">
      <div class="toast__title">${escapeHtml(title)}</div>
      <div class="toast__message">${escapeHtml(message)}</div>
    </div>
    <button class="toast__close" onclick="dismissToast('${id}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>
    <div class="toast__progress"></div>
  `;

  DOM.toastContainer.appendChild(toast);

  // Auto dismiss
  setTimeout(() => {
    dismissToast(id);
  }, duration);
}

function dismissToast(id) {
  const toast = document.getElementById(id);
  if (!toast) return;

  toast.classList.add('toast--exiting');
  setTimeout(() => {
    toast.remove();
  }, 300);
}

// Make dismissToast available globally for inline onclick
window.dismissToast = dismissToast;

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr) {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    // Kurang dari 1 menit
    if (diff < 60000) return 'Baru saja';
    // Kurang dari 1 jam
    if (diff < 3600000) return `${Math.floor(diff / 60000)} menit lalu`;
    // Hari ini
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    // Kemarin
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Kemarin';

    // Default
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '-';
  }
}

function formatTime(date) {
  try {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '-';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
