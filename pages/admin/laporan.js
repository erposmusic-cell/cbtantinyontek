import { useState, useEffect } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { generateLaporanPDF } from '../../lib/generateLaporanPDF';
import { kirimNotifikasiBulk, buildPesanHasilUjian } from '../../lib/notifikasiOrangTua';

export default function LaporanPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [ujianList,   setUjianList]   = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [laporanData, setLaporanData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [generating,  setGenerating]  = useState(false);
  const [notifStatus, setNotifStatus] = useState(null);
  const [sending,     setSending]     = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading]);

  useEffect(() => {
    if (user) loadUjian();
  }, [user]);

  async function loadUjian() {
    const { data } = await supabase
      .from('ujian')
      .select('*, mata_pelajaran(nama)')
      .order('dibuat_pada', { ascending: false });
    setUjianList(data || []);
  }

  async function loadLaporan(ujian) {
    setSelected(ujian);
    setLaporanData(null);
    setLoadingData(true);
    setNotifStatus(null);

    // Ambil semua sesi ujian dengan data siswa
    const { data: sesiList } = await supabase
      .from('sesi_ujian')
      .select('*, profiles(nama_lengkap, kelas, nomor_hp_ortu)')
      .eq('ujian_id', ujian.id)
      .eq('status', 'selesai');

    // Ambil log pelanggaran
    const { data: logList } = await supabase
      .from('log_pelanggaran')
      .select('*')
      .eq('ujian_id', ujian.id)
      .order('timestamp', { ascending: false });

    const siswaList = (sesiList || []).map(s => ({
      id:                s.siswa_id,
      nama:              s.profiles?.nama_lengkap || 'Siswa',
      kelas:             s.profiles?.kelas || '-',
      nilai:             s.nilai_akhir ?? 0,
      nomorHPOrtu:       s.profiles?.nomor_hp_ortu || null,
      jumlahPelanggaran: s.jumlah_pelanggaran ?? 0,
      status:            (s.nilai_akhir ?? 0) >= ujian.passing_grade ? 'lulus' : 'tidak_lulus',
    }));

    // Agregasi pelanggaran per siswa
    const pelanggaranMap = {};
    (logList || []).forEach(l => {
      const key = `${l.siswa_id}_${l.tipe_pelanggaran}`;
      if (!pelanggaranMap[key]) {
        pelanggaranMap[key] = {
          nama:  siswaList.find(s => s.id === l.siswa_id)?.nama || 'Siswa',
          tipe:  l.tipe_pelanggaran,
          jumlah: 0,
        };
      }
      pelanggaranMap[key].jumlah += 1;
    });

    const pelanggaranList = Object.values(pelanggaranMap)
      .sort((a, b) => b.jumlah - a.jumlah)
      .slice(0, 20);

    setLaporanData({ ujian, siswaList, pelanggaranList, logList: logList || [] });
    setLoadingData(false);
  }

  async function handleGeneratePDF() {
    if (!laporanData) return;
    setGenerating(true);
    try {
      await generateLaporanPDF({
        namaSekolah:    'Nama Sekolah Anda',
        namaUjian:      laporanData.ujian.judul,
        mataPelajaran:  laporanData.ujian.mata_pelajaran?.nama || '-',
        tanggal:        new Date(laporanData.ujian.waktu_mulai).toLocaleDateString('id-ID'),
        durasi:         laporanData.ujian.durasi_menit,
        passingGrade:   laporanData.ujian.passing_grade,
        siswaList:      laporanData.siswaList,
        pelanggaranList: laporanData.pelanggaranList,
        namaGuru:       user?.nama_lengkap || 'Guru',
      });
    } catch (e) {
      alert('Gagal generate PDF: ' + e.message);
    }
    setGenerating(false);
  }

  async function handleKirimNotif() {
    if (!laporanData) return;
    setSending(true);
    setNotifStatus(null);

    const results = await kirimNotifikasiBulk(laporanData.siswaList, {
      namaSekolah:  'Nama Sekolah Anda',
      namaUjian:    laporanData.ujian.judul,
      passingGrade: laporanData.ujian.passing_grade,
      namaGuru:     user?.nama_lengkap || 'Guru',
    });

    const berhasil = results.filter(r => r.success).length;
    const gagal    = results.filter(r => !r.success).length;
    const manual   = results.filter(r => r.link);

    // Jika ada link manual, buka satu per satu
    if (manual.length > 0) {
      const konfirm = confirm(
        `${manual.length} pesan akan dibuka via link WhatsApp manual.\nKlik OK untuk membuka satu per satu.`
      );
      if (konfirm) {
        for (const r of manual) {
          window.open(r.link, '_blank');
          await new Promise(res => setTimeout(res, 800));
        }
      }
    }

    setNotifStatus({ berhasil, gagal, results });
    setSending(false);
  }

  if (loading || !user) return null;

  const stats = laporanData ? {
    total:    laporanData.siswaList.length,
    lulus:    laporanData.siswaList.filter(s => s.status === 'lulus').length,
    rata:     laporanData.siswaList.length
      ? Math.round(laporanData.siswaList.reduce((a, s) => a + s.nilai, 0) / laporanData.siswaList.length)
      : 0,
    pelanggaran: laporanData.logList.length,
  } : null;

  return (
    <AppLayout title="Laporan">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">📊 Laporan Ujian</h1>
        <p className="text-gray-500 text-sm mt-1">Lihat statistik, export PDF, dan kirim notifikasi orang tua</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Daftar Ujian */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b bg-gray-50">
            <h2 className="font-bold text-gray-800">Pilih Ujian</h2>
          </div>
          <div className="divide-y max-h-[70vh] overflow-y-auto">
            {ujianList.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">Belum ada ujian</div>
            ) : ujianList.map(u => (
              <button
                key={u.id}
                onClick={() => loadLaporan(u)}
                className={`w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors ${selected?.id === u.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
              >
                <p className="font-semibold text-sm text-gray-900 leading-tight">{u.judul}</p>
                <p className="text-xs text-gray-500 mt-1">{u.mata_pelajaran?.nama} • {new Date(u.waktu_mulai).toLocaleDateString('id-ID')}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold mt-1 inline-block
                  ${u.status === 'selesai' ? 'bg-green-100 text-green-700' :
                    u.status === 'aktif'   ? 'bg-blue-100 text-blue-700' :
                                             'bg-gray-100 text-gray-500'}`}>
                  {u.status}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Detail Laporan */}
        <div className="lg:col-span-2 space-y-5">
          {!selected && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              <div className="text-5xl mb-3">📋</div>
              <p className="font-semibold">Pilih ujian untuk melihat laporan</p>
            </div>
          )}

          {loadingData && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Memuat data...</p>
            </div>
          )}

          {laporanData && !loadingData && (
            <>
              {/* Tombol Aksi */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleGeneratePDF}
                  disabled={generating}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm disabled:opacity-60 transition-colors"
                >
                  {generating
                    ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Membuat PDF...</>
                    : <>📄 Download PDF</>}
                </button>

                <button
                  onClick={handleKirimNotif}
                  disabled={sending}
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm disabled:opacity-60 transition-colors"
                >
                  {sending
                    ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Mengirim...</>
                    : <>💬 Kirim Notif WhatsApp</>}
                </button>
              </div>

              {/* Status Notif */}
              {notifStatus && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
                  <p className="font-bold text-green-800">✅ Notifikasi selesai dikirim</p>
                  <p className="text-green-700 mt-1">Berhasil: {notifStatus.berhasil} • Gagal: {notifStatus.gagal}</p>
                  {notifStatus.results.filter(r => !r.success).map((r, i) => (
                    <p key={i} className="text-red-600 text-xs mt-1">❌ {r.nama}: {r.error}</p>
                  ))}
                </div>
              )}

              {/* Statistik */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Peserta', value: stats.total, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Lulus', value: stats.lulus, color: 'text-green-600', bg: 'bg-green-50' },
                  { label: 'Rata-rata', value: stats.rata, color: 'text-purple-600', bg: 'bg-purple-50' },
                  { label: 'Pelanggaran', value: stats.pelanggaran, color: 'text-red-600', bg: 'bg-red-50' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center`}>
                    <div className={`text-3xl font-extrabold ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-gray-500 mt-1 font-medium">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Tabel Nilai */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800">Daftar Nilai Siswa</h3>
                  <span className="text-xs text-gray-500">{laporanData.siswaList.length} peserta</span>
                </div>
                {laporanData.siswaList.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">Belum ada data peserta</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {['No', 'Nama', 'Kelas', 'Nilai', 'Pelanggaran', 'Status', 'Notif WA'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {laporanData.siswaList.map((s, i) => (
                          <tr key={s.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                            <td className="px-4 py-3 font-semibold text-gray-900">{s.nama}</td>
                            <td className="px-4 py-3 text-gray-500">{s.kelas}</td>
                            <td className={`px-4 py-3 font-bold ${s.nilai >= laporanData.ujian.passing_grade ? 'text-green-600' : 'text-red-600'}`}>
                              {s.nilai}
                            </td>
                            <td className="px-4 py-3">
                              {s.jumlahPelanggaran > 0
                                ? <span className="text-red-600 font-semibold">{s.jumlahPelanggaran}x</span>
                                : <span className="text-green-600">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-bold px-2 py-1 rounded-full
                                ${s.status === 'lulus' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {s.status === 'lulus' ? 'LULUS' : 'TIDAK LULUS'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {s.nomorHPOrtu ? (
                                <a
                                  href={`https://wa.me/${s.nomorHPOrtu.replace(/\D/g,'').replace(/^0/,'62')}?text=${encodeURIComponent(buildPesanHasilUjian({ namaSekolah:'Sekolah', namaSiswa:s.nama, namaUjian:laporanData.ujian.judul, nilai:s.nilai, passingGrade:laporanData.ujian.passing_grade, jumlahPelanggaran:s.jumlahPelanggaran, namaGuru:user?.nama_lengkap||'Guru' }))}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="text-green-600 hover:text-green-800 text-xs font-semibold"
                                >
                                  📲 Kirim
                                </a>
                              ) : (
                                <span className="text-gray-300 text-xs">Tidak ada nomor</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Log Pelanggaran */}
              {laporanData.pelanggaranList.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-3 border-b bg-red-50">
                    <h3 className="font-bold text-red-800">⚠️ Pelanggaran Terbanyak</h3>
                  </div>
                  <div className="divide-y">
                    {laporanData.pelanggaranList.slice(0, 10).map((p, i) => (
                      <div key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                        <div>
                          <span className="font-semibold text-gray-900">{p.nama}</span>
                          <span className="text-gray-500 ml-2">• {p.tipe}</span>
                        </div>
                        <span className="font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full text-xs">
                          {p.jumlah}x
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
