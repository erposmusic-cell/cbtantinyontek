# 🎓 CBT Anti-Nyontek

Sistem Ujian Digital berbasis web dengan fitur keamanan anti-nyontek yang komprehensif.

## Tech Stack

- **Frontend**: Next.js 14 + React 18
- **Styling**: Tailwind CSS
- **Backend/Database**: Supabase (PostgreSQL + Auth + Storage)
- **Deploy**: Vercel

## Fitur Utama

### 🔒 Anti-Nyontek
- Wajib fullscreen mode
- Deteksi pindah tab / window blur
- Blokir copy-paste & keyboard shortcut terlarang
- Deteksi Developer Tools
- Watermark nama siswa
- Deteksi kamera wajah (opsional)
- Log pelanggaran real-time

### 📝 Jenis Soal
- Pilihan Ganda (PG)
- Multiple Choice Multiple Answer (MCMA)
- Benar/Salah (5 pernyataan)
- Essay (koreksi manual)

### 👥 Role
- **Admin**: Kelola semua pengguna, ujian, dan laporan
- **Guru**: Buat soal, ujian, monitoring, dan koreksi
- **Siswa**: Ikuti ujian dan lihat hasil

## Setup

### 1. Clone repository
```bash
git clone https://github.com/USERNAME/cbt-anti-nyontek.git
cd cbt-anti-nyontek
npm install
```

### 2. Setup Supabase
1. Buat project baru di [supabase.com](https://supabase.com)
2. Jalankan `supabase_schema.sql` di SQL Editor Supabase
3. Buat storage buckets: `foto-siswa`, `gambar-soal`, `screenshot-pelanggaran`

### 3. Environment Variables
```bash
cp .env.local.example .env.local
```
Isi `.env.local` dengan URL dan Anon Key dari Supabase dashboard.

### 4. Jalankan lokal
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000)

## Deploy ke Vercel

1. Push ke GitHub
2. Import repo di [vercel.com](https://vercel.com)
3. Tambahkan Environment Variables di Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy otomatis ✅

## Struktur Proyek

```
cbt-anti-nyontek/
├── pages/
│   ├── index.js              ← Halaman login
│   ├── dashboard.js          ← Dashboard (semua role)
│   ├── siswa/
│   │   ├── ujian.js          ← Daftar & ikuti ujian
│   │   └── hasil.js          ← Riwayat hasil ujian
│   ├── guru/
│   │   ├── ujian.js          ← Kelola ujian
│   │   ├── soal.js           ← Bank soal
│   │   ├── monitoring.js     ← Monitoring ujian live
│   │   └── nilai.js          ← Koreksi essay
│   └── admin/
│       ├── pengguna.js       ← Kelola pengguna
│       ├── ujian.js          ← Kelola semua ujian
│       ├── soal.js           ← Bank soal
│       ├── monitoring.js     ← Monitoring global
│       └── laporan.js        ← Laporan & analitik
├── components/
│   ├── layout/
│   │   └── AppLayout.js      ← Navbar + Sidebar
│   └── exam/
│       └── ExamScreen.js     ← UI ujian fullscreen
├── hooks/
│   ├── useAuth.js            ← Context autentikasi
│   └── useAntiCheat.js       ← Logic anti-nyontek
├── lib/
│   └── supabase.js           ← Supabase client
├── styles/
│   └── globals.css
└── supabase_schema.sql       ← Schema database
```

## Lisensi
MIT
