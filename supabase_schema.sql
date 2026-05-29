-- ============================================================
-- CBT ANTI-NYONTEK - SUPABASE DATABASE SCHEMA
-- ============================================================
-- Jalankan script ini di Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABEL USERS (dikelola oleh Supabase Auth + profil tambahan)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nama_lengkap TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'guru', 'siswa')),
  nomor_induk TEXT, -- NIP untuk guru, NIS untuk siswa
  kelas TEXT, -- hanya untuk siswa
  foto_url TEXT,
  aktif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABEL MATA PELAJARAN
-- ============================================================
CREATE TABLE public.mata_pelajaran (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nama TEXT NOT NULL,
  kode TEXT UNIQUE NOT NULL,
  deskripsi TEXT,
  guru_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABEL BANK SOAL
-- ============================================================
CREATE TABLE public.bank_soal (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  mata_pelajaran_id UUID REFERENCES public.mata_pelajaran(id) ON DELETE CASCADE,
  guru_id UUID REFERENCES public.profiles(id),
  tipe_soal TEXT NOT NULL CHECK (tipe_soal IN (
    'pilihan_ganda',   -- 1 jawaban benar dari 4-5 pilihan
    'mcma',            -- Multiple Choice Multiple Answer (>1 jawaban benar)
    'benar_salah',     -- 5 pernyataan dinilai benar/salah
    'essay'            -- Jawaban uraian
  )),
  pertanyaan TEXT NOT NULL,
  gambar_url TEXT, -- opsional gambar soal
  bobot INTEGER DEFAULT 1, -- bobot nilai soal
  tingkat_kesulitan TEXT CHECK (tingkat_kesulitan IN ('mudah', 'sedang', 'sulit')),
  tags TEXT[], -- untuk kategorisasi
  aktif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABEL PILIHAN JAWABAN (untuk PG, MCMA, Benar/Salah)
-- ============================================================
CREATE TABLE public.pilihan_jawaban (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  soal_id UUID REFERENCES public.bank_soal(id) ON DELETE CASCADE,
  -- Untuk PG & MCMA: label A/B/C/D/E, untuk B/S: pernyataan ke-1 s/d 5
  label TEXT NOT NULL, -- 'A','B','C','D','E' atau 'P1','P2','P3','P4','P5'
  teks TEXT NOT NULL,
  gambar_url TEXT,
  adalah_benar BOOLEAN NOT NULL DEFAULT FALSE,
  urutan INTEGER NOT NULL DEFAULT 1
);

-- ============================================================
-- TABEL UJIAN
-- ============================================================
CREATE TABLE public.ujian (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  judul TEXT NOT NULL,
  deskripsi TEXT,
  mata_pelajaran_id UUID REFERENCES public.mata_pelajaran(id),
  guru_id UUID REFERENCES public.profiles(id),
  kelas_target TEXT[], -- kelas yang boleh ikut
  waktu_mulai TIMESTAMPTZ NOT NULL,
  waktu_selesai TIMESTAMPTZ NOT NULL,
  durasi_menit INTEGER NOT NULL DEFAULT 60,
  jumlah_soal INTEGER NOT NULL DEFAULT 10,
  acak_soal BOOLEAN DEFAULT TRUE, -- soal diacak per siswa
  acak_pilihan BOOLEAN DEFAULT TRUE, -- pilihan jawaban diacak
  tampilkan_nilai BOOLEAN DEFAULT FALSE, -- tampilkan nilai setelah ujian
  passing_grade INTEGER DEFAULT 75,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','aktif','selesai','dibatalkan')),
  -- Pengaturan Anti-Nyontek
  wajib_fullscreen BOOLEAN DEFAULT TRUE,
  deteksi_pindah_tab BOOLEAN DEFAULT TRUE,
  blokir_copy_paste BOOLEAN DEFAULT TRUE,
  deteksi_wajah BOOLEAN DEFAULT FALSE,
  deteksi_ganda_akses BOOLEAN DEFAULT TRUE, -- cegah login ganda
  acak_ip_check BOOLEAN DEFAULT FALSE,
  batas_pelanggaran INTEGER DEFAULT 3, -- maks pelanggaran sebelum dikunci
  kunci_browser BOOLEAN DEFAULT TRUE, -- blokir klik kanan, dev tools, dll
  watermark_nama BOOLEAN DEFAULT TRUE, -- tampilkan nama siswa sebagai watermark
  rekam_aktivitas BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABEL SOAL UJIAN (soal yang digunakan di ujian tertentu)
-- ============================================================
CREATE TABLE public.soal_ujian (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ujian_id UUID REFERENCES public.ujian(id) ON DELETE CASCADE,
  soal_id UUID REFERENCES public.bank_soal(id),
  urutan INTEGER NOT NULL,
  bobot_override INTEGER -- override bobot dari bank soal
);

-- ============================================================
-- TABEL SESI UJIAN SISWA
-- ============================================================
CREATE TABLE public.sesi_ujian (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ujian_id UUID REFERENCES public.ujian(id),
  siswa_id UUID REFERENCES public.profiles(id),
  token_sesi TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  waktu_mulai TIMESTAMPTZ,
  waktu_selesai TIMESTAMPTZ,
  status TEXT DEFAULT 'belum_mulai' CHECK (status IN (
    'belum_mulai','berlangsung','selesai','dikunci','timeout'
  )),
  ip_address TEXT,
  user_agent TEXT,
  jumlah_pelanggaran INTEGER DEFAULT 0,
  dikunci_pada TIMESTAMPTZ,
  alasan_kunci TEXT,
  nilai_akhir DECIMAL(5,2),
  nilai_benar INTEGER DEFAULT 0,
  nilai_salah INTEGER DEFAULT 0,
  nilai_kosong INTEGER DEFAULT 0,
  submit_manual BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint: satu siswa hanya boleh punya 1 sesi aktif per ujian
CREATE UNIQUE INDEX idx_sesi_aktif ON public.sesi_ujian(ujian_id, siswa_id)
  WHERE status IN ('belum_mulai','berlangsung');

-- ============================================================
-- TABEL JAWABAN SISWA
-- ============================================================
CREATE TABLE public.jawaban_siswa (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sesi_id UUID REFERENCES public.sesi_ujian(id) ON DELETE CASCADE,
  soal_id UUID REFERENCES public.bank_soal(id),
  -- Untuk PG: id pilihan yang dipilih
  pilihan_id UUID REFERENCES public.pilihan_jawaban(id),
  -- Untuk MCMA: array id pilihan
  pilihan_ids UUID[],
  -- Untuk B/S: array boolean (P1-P5)
  jawaban_bs BOOLEAN[],
  -- Untuk Essay
  jawaban_essay TEXT,
  -- Penilaian
  adalah_benar BOOLEAN,
  nilai_diperoleh DECIMAL(5,2) DEFAULT 0,
  -- Essay perlu koreksi manual
  sudah_dikoreksi BOOLEAN DEFAULT FALSE,
  nilai_guru DECIMAL(5,2),
  catatan_guru TEXT,
  -- Metadata
  waktu_jawab TIMESTAMPTZ DEFAULT NOW(),
  durasi_jawab_detik INTEGER -- berapa lama menjawab soal ini
);

-- ============================================================
-- TABEL LOG PELANGGARAN (Anti-Nyontek)
-- ============================================================
CREATE TABLE public.log_pelanggaran (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sesi_id UUID REFERENCES public.sesi_ujian(id) ON DELETE CASCADE,
  siswa_id UUID REFERENCES public.profiles(id),
  ujian_id UUID REFERENCES public.ujian(id),
  tipe_pelanggaran TEXT NOT NULL CHECK (tipe_pelanggaran IN (
    'pindah_tab',         -- pindah ke tab/window lain
    'keluar_fullscreen',  -- keluar dari fullscreen
    'copy_paste',         -- mencoba copy/paste
    'klik_kanan',         -- klik kanan
    'dev_tools',          -- buka developer tools
    'keyboard_forbidden', -- shortcut terlarang (Ctrl+A, Ctrl+S, dll)
    'wajah_tidak_terdeteksi', -- wajah tidak terdeteksi kamera
    'wajah_berganda',     -- lebih dari 1 wajah terdeteksi
    'wajah_tidak_dikenal',-- wajah beda dari foto profil
    'koneksi_ganda',      -- login dari perangkat lain
    'screenshot',         -- mencoba screenshot (Print Screen)
    'resize_window',      -- mengecilkan window
    'blur_window',        -- window kehilangan fokus
    'lainnya'
  )),
  deskripsi TEXT,
  screenshot_url TEXT, -- screenshot saat pelanggaran (jika ada)
  severity TEXT DEFAULT 'sedang' CHECK (severity IN ('rendah','sedang','tinggi','kritis')),
  ditindaklanjuti BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABEL LOG AKTIVITAS (Rekam setiap aktivitas siswa)
-- ============================================================
CREATE TABLE public.log_aktivitas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sesi_id UUID REFERENCES public.sesi_ujian(id) ON DELETE CASCADE,
  tipe TEXT NOT NULL, -- 'mulai_ujian','jawab_soal','pindah_soal','submit', dll
  detail JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABEL PESERTA UJIAN (siswa yang diizinkan ikut ujian)
-- ============================================================
CREATE TABLE public.peserta_ujian (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ujian_id UUID REFERENCES public.ujian(id) ON DELETE CASCADE,
  siswa_id UUID REFERENCES public.profiles(id),
  diizinkan BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ujian_id, siswa_id)
);

-- ============================================================
-- TABEL FOTO REFERENSI SISWA (untuk face detection)
-- ============================================================
CREATE TABLE public.foto_siswa (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  siswa_id UUID REFERENCES public.profiles(id) UNIQUE,
  foto_url TEXT NOT NULL,
  face_descriptor JSONB, -- data deskriptor wajah dari face-api.js
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mata_pelajaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilihan_jawaban ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soal_ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesi_ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jawaban_siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_pelanggaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_aktivitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peserta_ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foto_siswa ENABLE ROW LEVEL SECURITY;

-- Helper function untuk cek role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles: semua bisa lihat, hanya admin yang bisa edit semua
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_admin" ON public.profiles FOR INSERT WITH CHECK (
  public.get_user_role() = 'admin'
);
CREATE POLICY "profiles_delete_admin" ON public.profiles FOR DELETE USING (
  public.get_user_role() = 'admin'
);

-- Bank Soal: guru hanya lihat miliknya, admin lihat semua
CREATE POLICY "soal_select" ON public.bank_soal FOR SELECT USING (
  public.get_user_role() IN ('admin', 'guru') OR
  (public.get_user_role() = 'siswa' AND aktif = true)
);
CREATE POLICY "soal_insert" ON public.bank_soal FOR INSERT WITH CHECK (
  public.get_user_role() IN ('admin', 'guru')
);
CREATE POLICY "soal_update" ON public.bank_soal FOR UPDATE USING (
  public.get_user_role() = 'admin' OR guru_id = auth.uid()
);
CREATE POLICY "soal_delete" ON public.bank_soal FOR DELETE USING (
  public.get_user_role() = 'admin' OR guru_id = auth.uid()
);

-- Ujian: guru hanya kelola ujiannya
CREATE POLICY "ujian_select" ON public.ujian FOR SELECT USING (
  public.get_user_role() IN ('admin', 'guru') OR
  (public.get_user_role() = 'siswa' AND status = 'aktif')
);
CREATE POLICY "ujian_insert" ON public.ujian FOR INSERT WITH CHECK (
  public.get_user_role() IN ('admin', 'guru')
);
CREATE POLICY "ujian_update" ON public.ujian FOR UPDATE USING (
  public.get_user_role() = 'admin' OR guru_id = auth.uid()
);

-- Sesi ujian: siswa hanya lihat sesinya sendiri
CREATE POLICY "sesi_select" ON public.sesi_ujian FOR SELECT USING (
  public.get_user_role() IN ('admin', 'guru') OR siswa_id = auth.uid()
);
CREATE POLICY "sesi_insert" ON public.sesi_ujian FOR INSERT WITH CHECK (
  siswa_id = auth.uid() OR public.get_user_role() IN ('admin','guru')
);
CREATE POLICY "sesi_update" ON public.sesi_ujian FOR UPDATE USING (
  siswa_id = auth.uid() OR public.get_user_role() IN ('admin','guru')
);

-- Jawaban: siswa hanya lihat jawabannya
CREATE POLICY "jawaban_select" ON public.jawaban_siswa FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.sesi_ujian s
    WHERE s.id = sesi_id AND (s.siswa_id = auth.uid() OR public.get_user_role() IN ('admin','guru'))
  )
);
CREATE POLICY "jawaban_insert" ON public.jawaban_siswa FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.sesi_ujian s WHERE s.id = sesi_id AND s.siswa_id = auth.uid())
);
CREATE POLICY "jawaban_update" ON public.jawaban_siswa FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.sesi_ujian s WHERE s.id = sesi_id AND s.siswa_id = auth.uid())
  OR public.get_user_role() IN ('admin','guru')
);

-- Log pelanggaran: siswa bisa insert, guru/admin bisa lihat semua
CREATE POLICY "pelanggaran_select" ON public.log_pelanggaran FOR SELECT USING (
  siswa_id = auth.uid() OR public.get_user_role() IN ('admin','guru')
);
CREATE POLICY "pelanggaran_insert" ON public.log_pelanggaran FOR INSERT WITH CHECK (
  siswa_id = auth.uid()
);

-- ============================================================
-- FUNGSI OTOMATIS
-- ============================================================

-- Auto update timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER ujian_updated_at BEFORE UPDATE ON public.ujian
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER soal_updated_at BEFORE UPDATE ON public.bank_soal
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Fungsi: Hitung nilai akhir sesi ujian
CREATE OR REPLACE FUNCTION hitung_nilai_sesi(p_sesi_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  total_bobot INTEGER;
  nilai_benar DECIMAL;
  hasil DECIMAL;
BEGIN
  SELECT COALESCE(SUM(bs.nilai_diperoleh), 0)
  INTO nilai_benar
  FROM public.jawaban_siswa bs
  WHERE bs.sesi_id = p_sesi_id;

  SELECT COALESCE(SUM(bk.bobot), 0)
  INTO total_bobot
  FROM public.soal_ujian su
  JOIN public.sesi_ujian s ON s.ujian_id = su.ujian_id
  JOIN public.bank_soal bk ON bk.id = su.soal_id
  WHERE s.id = p_sesi_id;

  IF total_bobot = 0 THEN RETURN 0; END IF;
  hasil := (nilai_benar / total_bobot) * 100;
  RETURN ROUND(hasil, 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
-- Jalankan di Supabase Storage:
-- 1. Buat bucket: 'foto-siswa' (public: false)
-- 2. Buat bucket: 'gambar-soal' (public: true)
-- 3. Buat bucket: 'screenshot-pelanggaran' (public: false)

-- ============================================================
-- DATA AWAL (SEED)
-- ============================================================
-- Admin default akan dibuat melalui Supabase Auth + trigger berikut:

-- Trigger: otomatis buat profil saat user baru daftar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nama_lengkap, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nama_lengkap', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'siswa')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- INDEX UNTUK PERFORMA
-- ============================================================
CREATE INDEX idx_sesi_ujian_id ON public.sesi_ujian(ujian_id);
CREATE INDEX idx_sesi_siswa_id ON public.sesi_ujian(siswa_id);
CREATE INDEX idx_jawaban_sesi ON public.jawaban_siswa(sesi_id);
CREATE INDEX idx_pelanggaran_sesi ON public.log_pelanggaran(sesi_id);
CREATE INDEX idx_pelanggaran_siswa ON public.log_pelanggaran(siswa_id);
CREATE INDEX idx_soal_mapel ON public.bank_soal(mata_pelajaran_id);
CREATE INDEX idx_ujian_guru ON public.ujian(guru_id);
CREATE INDEX idx_ujian_status ON public.ujian(status);

-- ═══════════════════════════════════════════════════════
-- TAMBAHAN SCHEMA UNTUK FITUR BARU
-- ═══════════════════════════════════════════════════════

-- Tabel rekaman layar siswa
CREATE TABLE IF NOT EXISTS public.rekaman_ujian (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesi_id       UUID REFERENCES sesi_ujian(id) ON DELETE CASCADE,
  siswa_id      UUID REFERENCES profiles(id),
  ujian_id      UUID REFERENCES ujian(id),
  file_path     TEXT NOT NULL,
  durasi_detik  INT DEFAULT 0,
  ukuran_byte   BIGINT DEFAULT 0,
  dibuat_pada   TIMESTAMPTZ DEFAULT NOW()
);

-- Kolom tambahan di tabel profiles untuk nomor HP orang tua
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nomor_hp_ortu TEXT,
  ADD COLUMN IF NOT EXISTS notif_wa_aktif BOOLEAN DEFAULT FALSE;

-- Kolom tambahan di tabel ujian untuk fitur baru
ALTER TABLE public.ujian
  ADD COLUMN IF NOT EXISTS rekam_layar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notif_ortu  BOOLEAN DEFAULT FALSE;

-- Bucket Storage untuk rekaman (jalankan di Supabase Dashboard > Storage)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('rekaman-ujian', 'rekaman-ujian', false);

-- RLS Policy untuk rekaman_ujian
ALTER TABLE public.rekaman_ujian ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Siswa lihat rekaman sendiri" ON public.rekaman_ujian
  FOR SELECT USING (auth.uid() = siswa_id);

CREATE POLICY "Guru/Admin lihat semua rekaman" ON public.rekaman_ujian
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('guru','admin'))
  );

CREATE POLICY "Sistem insert rekaman" ON public.rekaman_ujian
  FOR INSERT WITH CHECK (auth.uid() = siswa_id);
