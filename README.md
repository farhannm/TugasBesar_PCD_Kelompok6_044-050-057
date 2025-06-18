# Flappy Bird Media Pipe Face Mesh

Implementasi berbasis web dari permainan Flappy Bird yang menggunakan deteksi MediaPipe Face Mesh untuk mengendalikan burung dengan gerakan hidung. Gerakkan kepala ke atas dan ke bawah untuk mengontrol burung dan hindari pipa!

##  Fitur

- 🎮 Gameplay yang dikendalikan wajah menggunakan MediaPipe
- 🌐 Antarmuka berbasis web dengan komunikasi WebSocket secara real-time
- 📱 Desain responsif dengan Tailwind CSS
- 🏆 Pelacakan skor tertinggi
- 📷 Visualisasi deteksi wajah secara real-time
- 🎨 Desain UI modern dengan gaya glassmorphism

##  Instalasi & Pengaturan

### Prasyarat
- Python 3.8 atau lebih tinggi
- Akses webcam/kamera
- Browser modern (Chrome, Firefox, Safari, Edge)

### 1. Installation & Setup
```bash
git clone <https://github.com/farhannm/TugasBesar_PCD_Kelompok6_044-050-057.git>
cd TugasBesar_PCD_Kelompok6_044-050-057
```

### 2. Activate Python Environment
Untuk **Windows**:
```bash
python -m venv venv
venv\Scripts\activate
```

Untuk **macOS/Linux**:
```bash
python -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt    
```

### 4. Run the Server
Jalankan server menggunakan salah satu dari opsi berikut:

**Menggunakan Python langsung**:
```bash
python main.py
```

**Menggunakan Uvicorn**:
```bash
uvicorn main:app --reload
```

### 5. Menjalankan Jupyter Notebook
```bash
jupyter notebook
```

Server akan berjalan di `http://localhost:8000` atau `http://127.0.0.1:8000`

*Note: The game will work with fallback graphics if assets are missing.*

## How to Play

1. **Buka browser** dan navigasikan ke `http://localhost:8000` atau `http://127.0.0.1:8000`
2. **Izinkan akses kamera** saat diminta
3. **Klik "Mulai Kamera"** untuk memulai deteksi wajah
4. **Gerakkan kepala ke atas dan ke bawah** untuk mengontrol burung
5. **Hindari pipa** dengan melewati celah-celah
6. **Skor poin** dengan berhasil melewati celah pipa
7. **Kalahkan skor tertinggi!**

## 📁 Struktur Proyek

```
flappy_bird_web/
│
├── main.py                     # Server FastAPI
├── app/
│   ├── __init__.py
│   ├── game_logic.py           # Mesin permainan utama
│   ├── face_detection.py       # Deteksi wajah MediaPipe
│   └── websocket_handler.py    # Komunikasi WebSocket
│
├── static/
│   ├── index.html              # Antarmuka permainan utama
│   ├── game.js                 # Logika permainan frontend
│   └── assets/                 # Sprite dan asset permainan
│
├── data/
│   └── highscore.txt           # Penyimpanan skor tertinggi
│
└── requirements.txt            # Dependensi Python
```

## Technical Details

### Backend (Python)
- **FastAPI**: Framework web untuk menjalankan aplikasi
- **WebSockets**: Komunikasi real-time antara klien dan server
- **MediaPipe**: Deteksi dan pelacakan wajah
- **OpenCV**: Pemrosesan gambar dan penanganan webcam

### Frontend (JavaScript)
- **HTML5 Canvas**: Rendering permainan
- **WebSocket API**: Komunikasi real-time
- **Tailwind CSS**: Gaya responsif modern

### Mekanisme Permainan
- **Sistem Grid**: Grid 20x10 untuk posisi permainan
- **Deteksi Tabrakan**: Pemeriksaan tabrakan secara real-time
- **Gerakan Halus**: Pergerakan pipa yang diinterpolasi
- **Sistem Skor**: Poin diberikan untuk melewati pipa

## Tim Pengembang

**Kelompok 6** - PCD2025 - Jurusan Teknik Komputer dan Informatika, Politeknik Negeri Bandung 
1. Farhan Maulana - *231511044*
2. Indah Ratu Pramudita - *231511050*
3. Nazla Kayla - *231511057*