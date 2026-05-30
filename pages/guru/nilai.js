import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

// ── Modal Koreksi Essay ───────────────────────────────────────
function ModalKoreksi({ jawaban, onClose, onSave }) {
  const [nilaiGuru, setNilaiGuru] = useState(jawaban.nilai_guru ?? '');
  const [catatan,   setCatatan]   = useState(jawaban.catatan_guru || '');
  const [saving,    setSaving]    = useState(false);
  const maxBobot = jawaban.bank_soal?.bobot || 1;

  async function handleSave() {
    const nilai = parseFloat(nilaiGuru);
    if (isNaN(nilai) || nilai < 0 || nilai > maxBobot) {
      alert(`Nilai harus antara 0 dan ${maxBobot}`);
      return;
    }
    setSaving(true);
    await supabase.from('jawaban_siswa').update({
      nilai_guru:       nilai,
      catatan_guru:     catatan.trim() || null,
      sudah_dikoreksi:  true,
      nilai_diperoleh:  nilai,
    }).eq('id', jawaban.id);
    onSave();
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">✍️ Koreksi Essay</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Pertanyaan</p>
            <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3">{jawaban.bank_soal?.pertanyaan}</p>
          </div>
          {jawaban.bank_soal?.kunci_jawaban && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Kunci Jawaban</p>
              <p className="text-sm text-green-800 bg-green-50 rounded-lg p-3">{jawaban.bank_soal.kunci_jawaban}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Jawaban Siswa</p>
            <p className="text-sm text-gray-800 bg-blue-50 rounded-lg p-3 min-h-[60px]">
              {jawaban.jawaban_essay || <span className="italic text-gray-400">Tidak dijawab</span>}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Nilai <span className="text-gray-400 font-normal">(maks {maxBobot})</span>
              </label>
              <input
                type="number" min={0} max={maxBobot} step={0.5}
                value={nilaiGuru}
                onChange={e => setNilaiGuru(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Catatan (opsional)</label>
            <textarea
              value={catatan} onChange={e => setCatatan(e.target.value)} rows={2}
              placeholder="Feedback untuk siswa..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl">Batal</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl">
            {saving ? 'Menyimpan...' : 'Simpan Nilai'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function NilaiPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [ujianList,     setUjianList]     = useState([]);
  const [selectedUjian, setSelectedUjian] = useState(null);
  const [sesiList,      setSesiList]      = useState([]);
  const [essayList,     setEssayList]     = useState([]);
  const [loadingUjian,  setLoadingUjian]  = useState(true);
  const [loadingData,   setLoadingData]   = useState(false);
  const [tab,           setTab]           = useState('nilai');   // 'nilai' | 'essay'
  const [koreksiTarget, setKoreksiTarget] = useState(null);

  useEffect(() => { if (!loading && !user) router.push('/'); }, [user, loading]);
  useEffect(() => { if (user) loadUjian(); }, [user]);

  async function loadUjian() {
    setLoadingUjian(true);
    const query = supabase
      .from('ujian')
      .select('id, judul, passing_grade, jumlah_soal, mata_pelajaran(nama), waktu_mulai')
      .in('status', ['aktif', 'selesai'])
      .order('waktu_mulai', { ascending: false });
    if (user.role === 'guru') query.eq('guru_id', user.id);
    const { data } = await query;
    setUjianList(data || []);
    setLoadingUjian(false);
  }

  async function loadData(ujian) {
    setLoadingData(true);
    setSelectedUjian(ujian);

    // 1. Nilai per siswa
    const { data: sesi } = await supabase
      .from('sesi_ujian')
      .select('id, nilai_akhir, jumlah_pelanggaran, waktu_selesai, profiles(nama_lengkap, kelas, nomor_induk)')
      .eq('ujian_id', ujian.id)
      .eq('status', 'selesai')
      .order('nilai_akhir', { ascending: false });
    setSesiList(sesi || []);

    // 2. Jawaban essay yang belum dikoreksi
    const { data: essay } = await supabase
      .from('jawaban_siswa')
      .select('id, jawaban_essay, nilai_guru, catatan_guru, sudah_dikoreksi, sesi_id, bank_soal(pertanyaan, bobot, kunci_jawaban), sesi_ujian(profiles(nama_lengkap))')
      .eq('sesi_ujian.ujian_id', ujian.id)
      .eq('bank_soal.tipe_soal', 'essay')
      .not('jawaban_essay', 'is', null)
      .order('sudah_dikoreksi', { ascending: true });
    setEssayList(essay || []);

    setLoadingData(false);
  }

  if (loading || !user) return null;

  // ── Statistik ──
  const nilaiArr    = sesiList.map(s => parseFloat(s.nilai_akhir)).filter(n => !isNaN(n));
  const rataRata    = nilaiArr.length ? Math.round(nilaiArr.reduce((a, b) => a + b, 0) / nilaiArr.length) : 0;
  const lulus       = sesiList.filter(s => parseFloat(s.nilai_akhir) >= (selectedUjian?.passing_grade || 75)).length;
  const belumKoreksi = essayList.filter(e => !e.sudah_dikoreksi).length;

  return (
    <AppLayout title="Nilai">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">📊 Nilai & Koreksi</h1>
        <p className="text-gray-500 text-sm mt-1">Lihat nilai siswa dan koreksi jawaban essay</p>
      </div>

      {/* Pilih Ujian */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5">
        <label className="block text-sm font-bold text-gray-700 mb-3">Pilih Ujian</label>
        {loadingUjian ? (
          <p className="text-gray-400 text-sm">Memuat daftar ujian...</p>
        ) : ujianList.length === 0 ? (
          <p className="text-gray-400 text-sm">Belum ada ujian selesai.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ujianList.map(u => (
              <button
                key={u.id}
                onClick={() => loadData(u)}
                className={`text-left rounded-xl border-2 p-4 transition-all ${
                  selectedUjian?.id === u.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <p className="font-bold text-sm text-gray-900 leading-snug">{u.judul}</p>
                <p className="text-xs text-gray-400 mt-1">{u.mata_pelajaran?.nama || '—'} · {u.jumlah_soal} soal</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedUjian && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { icon: '👥', label: 'Peserta Selesai', value: sesiList.length,  color: 'text-gray-900' },
              { icon: '✅', label: 'Lulus',           value: lulus,             color: 'text-green-600' },
              { icon: '📉', label: 'Tidak Lulus',     value: sesiList.length - lulus, color: 'text-red-600' },
              { icon: '📊', label: 'Rata-rata',       value: rataRata,          color: 'text-blue-600' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-2xl mb-1">{s.icon}</div>
                <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
            {[
              { id: 'nilai', label: `Nilai (${sesiList.length})` },
              { id: 'essay', label: `Essay${belumKoreksi > 0 ? ` (${belumKoreksi} belum)` : ''}` },
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

          {/* Tab Nilai */}
          {tab === 'nilai' && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {loadingData ? (
                <div className="p-12 text-center text-gray-400">
                  <div className="w-7 h-7 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
                  Memuat data...
                </div>
              ) : sesiList.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <div className="text-4xl mb-2">📭</div>
                  <p className="font-semibold">Belum ada siswa yang menyelesaikan ujian ini</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-200">
                        <th className="px-5 py-3">Siswa</th>
                        <th className="px-3 py-3">Nilai</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-3 py-3">Pelanggaran</th>
                        <th className="px-3 py-3">Selesai</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sesiList.map((s, i) => {
                        const nilai = parseFloat(s.nilai_akhir);
                        const lulus = nilai >= (selectedUjian.passing_grade || 75);
                        return (
                          <tr key={s.id} className="hover:bg-gray-50">
                            <td className="px-5 py-3">
                              <p className="font-semibold text-gray-900">{s.profiles?.nama_lengkap}</p>
                              <p className="text-xs text-gray-400">{s.profiles?.kelas} · {s.profiles?.nomor_induk}</p>
                            </td>
                            <td className="px-3 py-3">
                              <span className={`text-lg font-extrabold ${lulus ? 'text-green-600' : 'text-red-600'}`}>
                                {isNaN(nilai) ? '—' : nilai.toFixed(0)}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                                lulus ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {lulus ? '✅ Lulus' : '❌ Tidak Lulus'}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-gray-500">{s.jumlah_pelanggaran ?? 0}x</td>
                            <td className="px-3 py-3 text-xs text-gray-400">
                              {s.waktu_selesai ? new Date(s.waktu_selesai).toLocaleString('id-ID') : '—'}
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

          {/* Tab Essay */}
          {tab === 'essay' && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {loadingData ? (
                <div className="p-12 text-center text-gray-400">
                  <div className="w-7 h-7 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
                  Memuat data...
                </div>
              ) : essayList.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <div className="text-4xl mb-2">✅</div>
                  <p className="font-semibold">Tidak ada jawaban essay di ujian ini</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {essayList.map(e => (
                    <div key={e.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-semibold text-sm text-gray-900">{e.sesi_ujian?.profiles?.nama_lengkap || 'Siswa'}</p>
                          {e.sudah_dikoreksi ? (
                            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">✅ Sudah dikoreksi · {e.nilai_guru}</span>
                          ) : (
                            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">⏳ Belum dikoreksi</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mb-1">{e.bank_soal?.pertanyaan}</p>
                        <p className="text-sm text-gray-700 line-clamp-2">{e.jawaban_essay || <span className="italic text-gray-400">Tidak dijawab</span>}</p>
                      </div>
                      <button
                        onClick={() => setKoreksiTarget(e)}
                        className="shrink-0 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition-colors"
                      >
                        Koreksi
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {koreksiTarget && (
        <ModalKoreksi
          jawaban={koreksiTarget}
          onClose={() => setKoreksiTarget(null)}
          onSave={() => loadData(selectedUjian)}
        />
      )}
    </AppLayout>
  );
}
