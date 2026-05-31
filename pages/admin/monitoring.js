/**
 * pages/admin/monitoring.js  (juga bisa dipakai untuk guru/monitoring.js)
 *
 * Fitur:
 *  - Pilih ujian yang sedang aktif
 *  - Lihat daftar peserta beserta status real-time (belum mulai / berlangsung / selesai / dikunci)
 *  - Statistik ringkas: total peserta, sedang berlangsung, selesai, dikunci
 *  - Pelanggaran terbaru (live feed)
 *  - Kemajuan jawaban per siswa (soal dijawab / total)
 *  - Tombol kunci / buka kunci sesi siswa
 *  - Auto-refresh setiap 15 detik
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDurasi(mulai) {
  if (!mulai) return '-';
  const detik = Math.floor((Date.now() - new Date(mulai).getTime()) / 1000);
  const m = Math.floor(detik / 60);
  const s = detik % 60;
  return `${m}m ${s}s`;
}

// Hitung durasi antara dua timestamp (untuk sesi yang sudah selesai)
function formatSelisih(mulai, selesai) {
  if (!mulai || !selesai) return '-';
  const detik = Math.floor((new Date(selesai).getTime() - new Date(mulai).getTime()) / 1000);
  if (detik < 0) return '-';
  const m = Math.floor(detik / 60);
  const s = detik % 60;
  return `${m}m ${s}s`;
}

function formatWaktu(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const STATUS_CONFIG = {
  belum_mulai: { label: 'Belum Mulai', color: 'bg-gray-100 text-gray-600',   dot: 'bg-gray-400'   },
  berlangsung:  { label: 'Berlangsung', color: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500 animate-pulse' },
  selesai:      { label: 'Selesai',     color: 'bg-green-100 text-green-700', dot: 'bg-green-500'  },
  dikunci:        { label: 'Dikunci',        color: 'bg-red-100 text-red-700',    dot: 'bg-red-500'    },
  diskualifikasi: { label: 'Diskualifikasi', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  timeout:      { label: 'Timeout',     color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500'  },
};

const PELANGGARAN_LABEL = {
  pindah_tab:             'Pindah Tab',
  keluar_fullscreen:      'Keluar Fullscreen',
  copy_paste:             'Copy/Paste',
  klik_kanan:             'Klik Kanan',
  dev_tools:              'Dev Tools',
  keyboard_forbidden:     'Shortcut Terlarang',
  wajah_tidak_terdeteksi: 'Wajah Tdk Terdeteksi',
  wajah_berganda:         'Wajah Berganda',
  wajah_tidak_dikenal:    'Wajah Tdk Dikenal',
  koneksi_ganda:          'Koneksi Ganda',
  screenshot:             'Screenshot',
  resize_window:          'Resize Window',
  blur_window:            'Window Blur',
  lainnya:                'Lainnya',
};

const SEVERITY_COLOR = {
  rendah:  'bg-gray-100 text-gray-600',
  sedang:  'bg-amber-100 text-amber-700',
  tinggi:  'bg-orange-100 text-orange-700',
  kritis:  'bg-red-100 text-red-700',
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const { user, loading } = useAuth();
  const router            = useRouter();

  const [ujianList,      setUjianList]      = useState([]);
  const [selectedUjian,  setSelectedUjian]  = useState(null);
  const [sesiList,       setSesiList]       = useState([]);
  const [pelanggaran,    setPelanggaran]    = useState([]);
  const [jawabanCount,   setJawabanCount]   = useState({}); // { sesi_id: jumlah }
  const [loadingUjian,   setLoadingUjian]   = useState(true);
  const [loadingData,    setLoadingData]    = useState(false);
  const [lastRefresh,    setLastRefresh]    = useState(null);
  const [filterStatus,   setFilterStatus]   = useState('semua');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [locking,        setLocking]        = useState(null); // sesi_id yang sedang di-lock/unlock
  const [tab,            setTab]            = useState('peserta'); // 'peserta' | 'pelanggaran'
  const timerRef = useRef(null);

  // ── Auth guard ──
  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading]);

  // ── Load daftar ujian aktif + draft ──
  useEffect(() => {
    if (user) loadUjianList();
  }, [user]);

  async function loadUjianList() {
    setLoadingUjian(true);
    const query = supabase
      .from('ujian')
      .select('id, judul, waktu_mulai, waktu_selesai, status, jumlah_soal, mata_pelajaran(nama), passing_grade')
      .in('status', ['aktif', 'selesai'])
      .order('waktu_mulai', { ascending: false });

    // Guru hanya lihat ujiannya sendiri
    if (user.role === 'guru') query.eq('guru_id', user.id);

    const { data } = await query;
    setUjianList(data || []);
    setLoadingUjian(false);
  }

  // ── Load data monitoring untuk ujian terpilih ──
  const loadData = useCallback(async (ujianId) => {
    if (!ujianId) return;
    setLoadingData(true);

    // 1. Sesi ujian dengan profil siswa
    const { data: sesi } = await supabase
      .from('sesi_ujian')
      .select('id, siswa_id, status, waktu_mulai, waktu_selesai, jumlah_pelanggaran, nilai_akhir, ip_address, profiles(nama_lengkap, kelas, nomor_induk)')
      .eq('ujian_id', ujianId)
      .order('waktu_mulai', { ascending: true });

    setSesiList(sesi || []);

    // 2. Pelanggaran terbaru (50 terakhir)
    const { data: pel } = await supabase
      .from('log_pelanggaran')
      .select('id, sesi_id, siswa_id, tipe_pelanggaran, severity, deskripsi, created_at, profiles(nama_lengkap)')
      .eq('ujian_id', ujianId)
      .order('created_at', { ascending: false })
      .limit(50);

    setPelanggaran(pel || []);

    // 3. Hitung jawaban per sesi
    if (sesi && sesi.length > 0) {
      const sesiIds = sesi.map(s => s.id);
      const { data: jawaban } = await supabase
        .from('jawaban_siswa')
        .select('sesi_id')
        .in('sesi_id', sesiIds);

      const counts = {};
      (jawaban || []).forEach(j => {
        counts[j.sesi_id] = (counts[j.sesi_id] || 0) + 1;
      });
      setJawabanCount(counts);
    }

    setLastRefresh(new Date());
    setLoadingData(false);
  }, []);

  // ── Auto-refresh setiap 15 detik ──
  useEffect(() => {
    if (!selectedUjian) return;
    loadData(selectedUjian.id);

    timerRef.current = setInterval(() => {
      loadData(selectedUjian.id);
    }, 15000);

    return () => clearInterval(timerRef.current);
  }, [selectedUjian, loadData]);

  // ── Kunci / Buka kunci sesi ──
  async function toggleKunci(sesi) {
    const isLocked = sesi.status === 'dikunci';
    setLocking(sesi.id);
    await supabase
      .from('sesi_ujian')
      .update({
        status:        isLocked ? 'berlangsung' : 'dikunci',
        alasan_kunci:  isLocked ? null : 'Dikunci oleh pengawas',
        dikunci_pada:  isLocked ? null : new Date().toISOString(),
      })
      .eq('id', sesi.id);
    setLocking(null);
    loadData(selectedUjian.id);
  }

  // ── Pulihkan siswa diskualifikasi ──
  async function pulihkanSiswa(sesi) {
    setLocking(sesi.id);
    await supabase
      .from('sesi_ujian')
      .update({ status: 'belum_mulai', jumlah_pelanggaran: 0 })
      .eq('id', sesi.id);
    setLocking(null);
    loadData(selectedUjian.id);
  }

  // ── Reset sesi siswa agar bisa ujian ulang ──
  async function resetSesi(sesi) {
    setLocking(sesi.id);
    // Hapus jawaban lama
    await supabase.from('jawaban_siswa').delete().eq('sesi_id', sesi.id);
    // Reset sesi ke belum_mulai
    await supabase.from('sesi_ujian').update({
      status:             'belum_mulai',
      waktu_mulai:        null,
      waktu_selesai:      null,
      nilai_akhir:        null,
      jumlah_pelanggaran: 0,
      alasan_kunci:       null,
      dikunci_pada:       null,
    }).eq('id', sesi.id);
    setLocking(null);
    loadData(selectedUjian.id);
  }

  // ── Statistik ──
  const stats = {
    total:       sesiList.length,
    belumMulai:  sesiList.filter(s => s.status === 'belum_mulai').length,
    berlangsung: sesiList.filter(s => s.status === 'berlangsung').length,
    selesai:     sesiList.filter(s => s.status === 'selesai').length,
    dikunci:        sesiList.filter(s => s.status === 'dikunci').length,
    diskualifikasi: sesiList.filter(s => s.status === 'diskualifikasi').length,
    pelanggaran: pelanggaran.length,
  };

  // ── Filter peserta ──
  const filteredSesi = sesiList.filter(s => {
    const namaMatch = (s.profiles?.nama_lengkap || '').toLowerCase().includes(searchQuery.toLowerCase());
    const statusMatch = filterStatus === 'semua' || s.status === filterStatus;
    return namaMatch && statusMatch;
  });

  if (loading || !user) return null;

  return (
    <AppLayout title="Monitoring">
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">👁 Monitoring Ujian</h1>
          <p className="text-gray-500 text-sm mt-0.5">Pantau peserta ujian secara real-time</p>
        </div>
        {lastRefresh && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse inline-block" />
            Diperbarui: {formatWaktu(lastRefresh)} · auto-refresh 15s
          </div>
        )}
      </div>

      {/* ── Pilih Ujian ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5">
        <label className="block text-sm font-bold text-gray-700 mb-2">Pilih Ujian</label>
        {loadingUjian ? (
          <div className="text-gray-400 text-sm">Memuat daftar ujian...</div>
        ) : ujianList.length === 0 ? (
          <div className="text-gray-400 text-sm">Tidak ada ujian aktif atau selesai.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ujianList.map(ujian => {
              const isSelected = selectedUjian?.id === ujian.id;
              const isAktif    = ujian.status === 'aktif';
              return (
                <button
                  key={ujian.id}
                  onClick={() => { setSelectedUjian(ujian); setFilterStatus('semua'); setSearchQuery(''); }}
                  className={`text-left rounded-xl border-2 p-4 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-sm text-gray-900 leading-snug">{ujian.judul}</p>
                    <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                      isAktif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {isAktif ? '🟢 Aktif' : '⏹ Selesai'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{ujian.mata_pelajaran?.nama || '-'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(ujian.waktu_mulai).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}
                    {' · '}{ujian.jumlah_soal} soal
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Dashboard Monitoring ── */}
      {selectedUjian && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
            {[
              { label: 'Total Peserta',   value: stats.total,       color: 'bg-gray-50  border-gray-200',  icon: '👥' },
              { label: 'Belum Mulai',     value: stats.belumMulai,  color: 'bg-gray-50  border-gray-200',  icon: '⏳' },
              { label: 'Berlangsung',     value: stats.berlangsung, color: 'bg-blue-50  border-blue-200',  icon: '✍️' },
              { label: 'Selesai',         value: stats.selesai,     color: 'bg-green-50 border-green-200', icon: '✅' },
              { label: 'Dikunci',         value: stats.dikunci,        color: 'bg-red-50    border-red-200',    icon: '🔒' },
              { label: 'Diskualifikasi',  value: stats.diskualifikasi, color: 'bg-orange-50 border-orange-200', icon: '🚫' },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className={`rounded-xl border p-4 ${color}`}>
                <div className="text-2xl mb-1">{icon}</div>
                <p className="text-2xl font-extrabold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500 font-medium">{label}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
            {[
              { id: 'peserta',       label: `Peserta (${stats.total})` },
              { id: 'pelanggaran',   label: `Pelanggaran (${stats.pelanggaran})` },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  tab === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Tab Peserta ── */}
          {tab === 'peserta' && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-gray-100">
                <input
                  type="text"
                  placeholder="Cari nama siswa..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px] focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="semua">Semua Status</option>
                  <option value="belum_mulai">Belum Mulai</option>
                  <option value="berlangsung">Berlangsung</option>
                  <option value="selesai">Selesai</option>
                  <option value="dikunci">Dikunci</option>
                  <option value="diskualifikasi">Diskualifikasi</option>
                </select>
                <button
                  onClick={() => loadData(selectedUjian.id)}
                  disabled={loadingData}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loadingData ? (
                    <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : '🔄'}
                  Refresh
                </button>
              </div>

              {/* Tabel Peserta */}
              {loadingData && sesiList.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
                  Memuat data peserta...
                </div>
              ) : filteredSesi.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <div className="text-4xl mb-2">🔍</div>
                  <p className="font-semibold">Tidak ada peserta ditemukan</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                        <th className="px-5 py-3">Siswa</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-3 py-3">Mulai</th>
                        <th className="px-3 py-3">Durasi</th>
                        <th className="px-3 py-3">Progress</th>
                        <th className="px-3 py-3">Pelanggaran</th>
                        <th className="px-3 py-3">Nilai</th>
                        <th className="px-3 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredSesi.map(sesi => {
                        const cfg       = STATUS_CONFIG[sesi.status] || STATUS_CONFIG.belum_mulai;
                        const dijawab   = jawabanCount[sesi.id] || 0;
                        const total     = selectedUjian.jumlah_soal || 1;
                        const pct       = Math.min(100, Math.round((dijawab / total) * 100));
                        const isLocking = locking === sesi.id;

                        return (
                          <tr key={sesi.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3">
                              <p className="font-semibold text-gray-900">{sesi.profiles?.nama_lengkap || 'Siswa'}</p>
                              <p className="text-xs text-gray-400">{sesi.profiles?.kelas || '-'} · {sesi.profiles?.nomor_induk || '-'}</p>
                            </td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                              {formatWaktu(sesi.waktu_mulai)}
                            </td>
                            <td className="px-3 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">
                              {sesi.status === 'berlangsung'
                                ? formatDurasi(sesi.waktu_mulai)
                                : sesi.waktu_selesai
                                  ? formatSelisih(sesi.waktu_mulai, sesi.waktu_selesai)
                                  : '-'
                              }
                            </td>
                            <td className="px-3 py-3 min-w-[120px]">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className="bg-blue-500 h-1.5 rounded-full transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500 whitespace-nowrap">{dijawab}/{total}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              {sesi.jumlah_pelanggaran > 0 ? (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                  sesi.jumlah_pelanggaran >= 3
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}>
                                  ⚠️ {sesi.jumlah_pelanggaran}x
                                </span>
                              ) : (
                                <span className="text-gray-300 text-xs">–</span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              {sesi.nilai_akhir != null ? (
                                <span className={`font-bold ${
                                  sesi.nilai_akhir >= (selectedUjian.passing_grade || 75)
                                    ? 'text-green-600'
                                    : 'text-red-500'
                                }`}>
                                  {parseFloat(sesi.nilai_akhir).toFixed(0)}
                                </span>
                              ) : (
                                <span className="text-gray-300 text-xs">–</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <div className="flex gap-1.5 justify-end">
                                {(sesi.status === 'berlangsung' || sesi.status === 'dikunci') && (
                                  <button
                                    onClick={() => toggleKunci(sesi)}
                                    disabled={isLocking}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                      sesi.status === 'dikunci'
                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                                    } disabled:opacity-50`}
                                  >
                                    {isLocking ? '...' : sesi.status === 'dikunci' ? '🔓 Buka' : '🔒 Kunci'}
                                  </button>
                                )}
                                {sesi.status === 'diskualifikasi' && (
                                  <button
                                    onClick={() => pulihkanSiswa(sesi)}
                                    disabled={locking === sesi.id}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-50 transition-all"
                                  >
                                    {locking === sesi.id ? '...' : '♻️ Pulihkan'}
                                  </button>
                                )}
                                {(sesi.status === 'selesai' || sesi.status === 'diskualifikasi') && (
                                  <button
                                    onClick={() => {
                                      if (confirm(`Reset ujian ${sesi.profiles?.nama_lengkap || 'siswa ini'}? Jawaban lama akan dihapus.`)) {
                                        resetSesi(sesi);
                                      }
                                    }}
                                    disabled={locking === sesi.id}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-50 transition-all"
                                  >
                                    {locking === sesi.id ? '...' : '🔄 Reset'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Tab Pelanggaran ── */}
          {tab === 'pelanggaran' && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <p className="font-bold text-gray-900">Log Pelanggaran Real-time</p>
                <button
                  onClick={() => loadData(selectedUjian.id)}
                  disabled={loadingData}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loadingData ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : '🔄'}
                  Refresh
                </button>
              </div>

              {pelanggaran.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <div className="text-4xl mb-2">✅</div>
                  <p className="font-semibold">Tidak ada pelanggaran terdeteksi</p>
                  <p className="text-sm mt-1">Semua peserta berperilaku baik</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                  {pelanggaran.map(p => (
                    <div key={p.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-gray-50">
                      <div className="shrink-0 w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center text-lg">⚠️</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 text-sm">{p.profiles?.nama_lengkap || 'Siswa'}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${SEVERITY_COLOR[p.severity] || SEVERITY_COLOR.sedang}`}>
                            {p.severity}
                          </span>
                          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-medium">
                            {PELANGGARAN_LABEL[p.tipe_pelanggaran] || p.tipe_pelanggaran}
                          </span>
                        </div>
                        {p.deskripsi && (
                          <p className="text-xs text-gray-500 mt-0.5">{p.deskripsi}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-xs text-gray-400 whitespace-nowrap">
                        {formatWaktu(p.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Empty state — belum pilih ujian */}
      {!selectedUjian && !loadingUjian && ujianList.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center text-gray-400">
          <div className="text-5xl mb-3">👆</div>
          <p className="font-semibold text-gray-600">Pilih ujian di atas untuk mulai monitoring</p>
        </div>
      )}
    </AppLayout>
  );
}
