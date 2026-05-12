# Canon EOS 3000D Viewer - Cyberpunk Edition

Realtime Photo Viewer untuk Canon EOS 3000D dengan desain futuristik cyberpunk. Memantau folder transfer otomatis dari kamera dan menampilkan foto secara real-time.

---

## Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
| Realtime Photo Detection | Deteksi foto baru secara otomatis saat kamera mengambil gambar |
| Auto Refresh Gallery | Gallery terupdate tanpa perlu refresh manual |
| Preview Foto Besar | Modal preview dengan navigasi antar foto |
| Daftar Semua Foto | Grid gallery dengan view mode grid & list |
| Status Koneksi Kamera | Indikator real-time status koneksi kamera |
| Notifikasi Toast | Notifikasi saat foto baru masuk |
| Auto Scroll | Otomatis scroll ke foto terbaru |
| Export/Download | Export foto ke folder lain |
| Drag & Drop | Drag and drop file ke gallery |
| Search | Pencarian foto berdasarkan nama file |
| Filter Ekstensi | Filter berdasarkan JPG, PNG, RAW |
| Context Menu | Klik kanan untuk aksi cepat |
| Keyboard Shortcuts | Ctrl+F, Ctrl+A, F5, Delete, Escape |
| Dark Theme | Tema gelap cyberpunk dengan neon accent |

---

## Teknologi

- **Electron.js** v28 - Framework desktop app
- **Node.js** - Runtime backend
- **Chokidar** - Folder monitoring yang efisien
- **HTML5/CSS3/JavaScript** - Frontend

---

## Struktur File

```
canon-eos-viewer/
├── main.js          # Electron main process (window, watcher, IPC)
├── preload.js       # Context bridge (secure API)
├── renderer.js      # UI logic (gallery, search, preview)
├── index.html       # Layout UI
├── style.css        # Cyberpunk dark theme
├── package.json     # Dependencies & scripts
└── README.md        # Dokumentasi
```

---

## Prasyarat

1. **Node.js** v18+ terinstall ([download](https://nodejs.org/))
2. **Canon EOS 3000D** dengan Wi-Fi aktif
3. **EOS Utility** terinstall dan berjalan

---

## Setup & Instalasi

### 1. Clone atau Download Project

```bash
# Salin folder project ke lokasi yang diinginkan
cd canon-eos-viewer
```

### 2. Install Dependencies

```bash
npm install
```

Ini akan menginstall:
- `electron` - Framework desktop app
- `chokidar` - Library monitoring folder

### 3. Buat Folder Monitor

Buat folder yang akan dipantau oleh aplikasi:

```bash
# Windows
mkdir C:\CanonPhotos

# Atau ganti path di main.js CONFIG.DEFAULT_WATCH_PATH
```

### 4. Jalankan Aplikasi

```bash
npm start
```

Untuk mode development (dengan DevTools):

```bash
npm run dev
```

---

## Konfigurasi Kamera Canon EOS 3000D

### Langkah 1: Aktifkan Wi-Fi di Kamera

1. Nyalakan kamera Canon EOS 3000D
2. Buka **Menu** → **Wi-Fi/NFC** → **Enable**
3. Pilih **Wi-Fi Function** → **Connect to smartphone/computer**

### Langkah 2: Hubungkan ke Komputer

1. Di komputer, cari jaringan Wi-Fi kamera (biasanya `EOS-XXXXXXX`)
2. Hubungkan ke jaringan tersebut
3. Buka **EOS Utility** di komputer
4. Pilih **Download images from camera**

### Langkah 3: Set Folder Transfer

1. Di EOS Utility, buka **Preferences**
2. Set **Destination Folder** ke `C:\CanonPhotos\`
3. Aktifkan **Auto download** saat kamera terhubung
4. Pastikan format nama file sesuai (default Canon: `IMG_XXXX.JPG`)

### Langkah 4: Mulai Shooting

1. Ambil foto dengan kamera
2. EOS Utility akan otomatis transfer ke folder
3. Aplikasi ini akan mendeteksi dan menampilkan foto secara real-time

---

## Cara Menggunakan Aplikasi

### Gallery

- **Klik foto** → Buka preview besar
- **Ctrl + Klik** → Pilih multiple foto
- **Klik kanan** → Context menu (Preview, Export, Hapus)

### Search

- Klik search bar atau tekan **Ctrl+F**
- Ketik nama file untuk mencari
- Klik X untuk menghapus pencarian

### Filter

- Di sidebar, klik tombol filter: **Semua**, **JPG**, **PNG**, **RAW**
- Gallery akan difilter secara otomatis

### Export

- Pilih foto (Ctrl+Klik) atau tanpa seleksi untuk export semua
- Klik tombol **Export** di topbar
- Pilih folder tujuan

### Keyboard Shortcuts

| Shortcut | Aksi |
|----------|------|
| `Ctrl+F` | Fokus search bar |
| `Ctrl+A` | Pilih semua foto |
| `F5` | Refresh gallery |
| `Delete` | Hapus foto terpilih |
| `Escape` | Tutup modal/preview |
| `←/→` | Navigasi foto di preview |

---

## Kustomisasi

### Ganti Folder Monitor

Anda bisa mengganti folder yang dimonitor dengan 2 cara:

1. **Dari UI**: Klik tombol "Ganti" di sidebar atau tombol folder di topbar
2. **Dari Kode**: Edit `CONFIG.DEFAULT_WATCH_PATH` di `main.js`

### Ganti Ekstensi yang Didukung

Edit array `CONFIG.SUPPORTED_EXTENSIONS` di `main.js`:

```javascript
SUPPORTED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.raw', '.cr2']
```

### Ganti Tema Warna

Edit CSS variables di `style.css`:

```css
:root {
  --neon-cyan: #00f0ff;      /* Warna accent utama */
  --neon-purple: #b14aed;    /* Warna secondary */
  --neon-pink: #ff2d78;      /* Warna danger */
  --neon-green: #00ff88;     /* Warna success */
  --bg-primary: #08080d;     /* Background utama */
}
```

---

## Build ke Executable

Untuk membuat file `.exe` yang bisa didistribusikan:

```bash
npm run build
```

File output akan ada di folder `dist/`.

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Folder tidak terdeteksi | Pastikan folder `C:\CanonPhotos\` ada dan bisa diakses |
| Foto tidak muncul otomatis | Cek EOS Utility sedang berjalan dan auto-download aktif |
| Aplikasi lambat | Kurangi jumlah foto di folder, atau naikkan `stabilityThreshold` di main.js |
| Notifikasi tidak muncul | Pastikan notifikasi Windows tidak dimatikan |
| Gambar blur saat pertama load | Normal, gambar akan tajam setelah selesai loading |

---

## Lisensi

MIT License - Bebas digunakan dan dimodifikasi.
