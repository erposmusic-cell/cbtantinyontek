# 🆕 Fitur Baru — CBT Anti-Nyontek

## 1. 📥 Import Soal dari Word/Excel

**File:** `hooks/useImportSoal.js` + `components/soal/ImportSoalModal.js`

### Cara pakai:
1. Buka halaman **Bank Soal** (guru)
2. Klik tombol **"📥 Import Word/Excel"**
3. Upload file `.xlsx`, `.csv`, `.docx`, atau `.txt`
4. Preview soal yang ter-parse, centang yang ingin disimpan
5. Klik **"Simpan ke Bank Soal"**

### Format Excel (CSV):
```
tipe_soal | pertanyaan | pilihan_a | pilihan_b | pilihan_c | pilihan_d | kunci_jawaban | bobot | tingkat_kesulitan
pilihan_ganda | Soal 1? | Jawaban A | Jawaban B | Jawaban C | Jawaban D | A | 1 | mudah
```

### Format Word:
```
1. Teks pertanyaan?
A. Pilihan A
B. Pilihan B
C. Pilihan C
D. Pilihan D
Jawaban: A
```

---

## 2. 📄 Laporan PDF Otomatis

**File:** `lib/generateLaporanPDF.js`

### Cara pakai:
1. Buka **Admin > Laporan**
2. Pilih ujian dari daftar kiri
3. Klik **"📄 Download PDF"**

### Isi laporan PDF:
- Header sekolah + info ujian
- Statistik: peserta, lulus, rata-rata, tertinggi, terendah
- Tabel nilai per siswa (nilai merah/hijau otomatis)
- Grafik distribusi nilai (bar chart)
- Daftar pelanggaran terbanyak
- Tanda tangan guru

---

## 3. 💬 Notifikasi WhatsApp Orang Tua

**File:** `lib/notifikasiOrangTua.js`

### Setup:
Edit `.env.local`:
```env
NEXT_PUBLIC_WA_PROVIDER=fonnte    # atau: wablas / wa_manual
FONNTE_TOKEN=xxxxxxxx             # dari fonnte.com
```

### Provider:
| Provider | Keterangan |
|---|---|
| `fonnte` | API WhatsApp, harga terjangkau (Indonesia) |
| `wablas` | API WhatsApp alternatif |
| `wa_manual` | Buka link wa.me manual (GRATIS, tanpa API key) |

### Cara pakai:
1. Pastikan kolom `nomor_hp_ortu` terisi di data siswa
2. Buka **Admin > Laporan**, pilih ujian
3. Klik **"💬 Kirim Notif WhatsApp"**
4. Jika pakai `wa_manual`, link WhatsApp akan terbuka satu per satu di browser

### Tombol per siswa:
Di tabel nilai ada tombol **📲 Kirim** per siswa untuk kirim manual.

---

## 4. 👁️ Face Recognition Penuh

**File:** `hooks/useFaceRecognition.js`

### Aktifkan di pengaturan ujian:
```sql
UPDATE ujian SET deteksi_wajah = true WHERE id = 'xxx';
```

### Yang dideteksi:
| Pelanggaran | Tingkat | Keterangan |
|---|---|---|
| `tidak_ada_wajah` | tinggi | Wajah tidak terdeteksi 2x berturut-turut (6 detik) |
| `wajah_ganda` | kritis | Lebih dari 1 wajah di kamera |
| `menoleh` | sedang | Wajah menoleh >15% dari center |

**Teknologi:** face-api.js (TinyFaceDetector, ~190KB, loaded via CDN)

---

## 5. 🎥 Rekam Layar Siswa

**File:** `hooks/useScreenRecorder.js`

### Aktifkan di pengaturan ujian:
```sql
UPDATE ujian SET rekam_layar = true WHERE id = 'xxx';
```

### Alur:
1. Saat ujian dimulai, browser minta izin screen share
2. Siswa pilih layar yang ingin di-share (wajib pilih "Entire Screen")
3. Rekaman berjalan di background, chunk disimpan tiap 10 detik
4. Saat ujian selesai, file `.webm` otomatis:
   - **Upload ke Supabase Storage** bucket `rekaman-ujian`
   - Atau **download lokal** jika upload gagal

### Catatan penting:
- Hanya berfungsi di **Chrome/Edge/Firefox desktop**
- Tidak bisa di mobile (gracefully skip)
- User bisa klik "Stop Sharing" di browser → rekaman berhenti
- Indikator **🔴 REC** muncul di header ujian selama perekaman

---

## Schema Database Baru

Jalankan di **Supabase SQL Editor**:
```sql
-- Sudah ada di file supabase_schema.sql (bagian bawah)
-- Tabel: rekaman_ujian
-- Kolom baru: profiles.nomor_hp_ortu, ujian.rekam_layar, ujian.notif_ortu
```

Juga buat bucket Storage di **Supabase Dashboard > Storage**:
- Nama: `rekaman-ujian`
- Public: ❌ (private)
