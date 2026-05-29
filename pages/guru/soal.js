import { useState, useEffect } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import ImportSoalModal from '../../components/soal/ImportSoalModal';

const TIPE_LABEL = { pilihan_ganda: 'PG', mcma: 'MCMA', benar_salah: 'B/S', essay: 'Essay' };
const TIPE_COLOR = {
  pilihan_ganda: 'bg-blue-100 text-blue-700',
  mcma: 'bg-purple-100 text-purple-700',
  benar_salah: 'bg-amber-100 text-amber-700',
  essay: 'bg-green-100 text-green-700',
};

export default function SoalPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [soalList, setSoalList]       = useState([]);
  const [mapel, setMapel]             = useState([]);
  const [selectedMapel, setSelectedMapel] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [showImport, setShowImport]   = useState(false);
  const [savingImport, setSavingImport] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading]);

  useEffect(() => {
    if (user) { loadMapel(); loadSoal(); }
  }, [user]);

  async function loadMapel() {
    const { data } = await supabase.from('mata_pelajaran').select('*').order('nama');
    setMapel(data || []);
  }

  async function loadSoal() {
    setLoadingData(true);
    let q = supabase.from('bank_soal').select('*, mata_pelajaran(nama), pilihan_jawaban(*)').order('dibuat_pada', { ascending: false });
    if (selectedMapel) q = q.eq('mapel_id', selectedMapel);
    const { data } = await q;
    setSoalList(data || []);
    setLoadingData(false);
  }

  useEffect(() => { if (user) loadSoal(); }, [selectedMapel]);

  // ── Simpan soal hasil import ke Supabase ──
  async function handleImport(soalArr) {
    setSavingImport(true);
    let berhasil = 0, gagal = 0;

    for (const soal of soalArr) {
      try {
        // Insert bank_soal
        const { data: bs, error: bsErr } = await supabase.from('bank_soal').insert({
          pertanyaan:        soal.pertanyaan,
          tipe_soal:         soal.tipe_soal,
          bobot:             soal.bobot || 1,
          tingkat_kesulitan: soal.tingkat_kesulitan || 'sedang',
          mapel_id:          selectedMapel || null,
          kunci_jawaban:     soal.kunci_jawaban || null,
          dibuat_oleh:       user.id,
        }).select().single();

        if (bsErr) throw bsErr;

        // Insert pilihan jawaban
        if (soal.pilihan?.length > 0) {
          const pilihan = soal.pilihan.map(p => ({
            soal_id: bs.id,
            label:   p.label,
            teks:    p.teks,
            benar:   soal.kunci_jawaban?.includes(p.label) || false,
          }));
          await supabase.from('pilihan_jawaban').insert(pilihan);
        }
        berhasil++;
      } catch {
        gagal++;
      }
    }

    setImportResult({ berhasil, gagal });
    setSavingImport(false);
    loadSoal();
  }

  if (loading || !user) return null;

  return (
    <AppLayout title="Bank Soal">
      <ImportSoalModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleImport}
      />

      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">📚 Bank Soal</h1>
          <p className="text-gray-500 text-sm mt-1">{soalList.length} soal tersedia</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition-colors"
          >
            📥 Import Word/Excel
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors">
            ✚ Tambah Soal
          </button>
        </div>
      </div>

      {importResult && (
        <div className="mb-5 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-green-800 font-semibold">
            ✅ Import selesai: {importResult.berhasil} soal berhasil{importResult.gagal > 0 ? `, ${importResult.gagal} gagal` : ''}
          </p>
          <button onClick={() => setImportResult(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
      )}

      {/* Filter Mapel */}
      <div className="mb-5 flex gap-3">
        <select
          value={selectedMapel}
          onChange={e => setSelectedMapel(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Semua Mata Pelajaran</option>
          {mapel.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
        </select>
      </div>

      {loadingData ? (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mr-3" />
          Memuat soal...
        </div>
      ) : soalList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <div className="text-5xl mb-3">📭</div>
          <p className="font-semibold">Bank soal masih kosong</p>
          <p className="text-sm mt-1">Tambah soal manual atau import dari Word/Excel</p>
          <button onClick={() => setShowImport(true)} className="mt-4 px-5 py-2 bg-amber-500 text-white font-bold rounded-xl text-sm hover:bg-amber-600 transition-colors">
            📥 Import Sekarang
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {soalList.map((soal, i) => (
            <div key={soal.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start gap-3">
                <span className="text-sm font-bold text-gray-400 shrink-0 mt-0.5">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TIPE_COLOR[soal.tipe_soal] || 'bg-gray-100 text-gray-600'}`}>
                      {TIPE_LABEL[soal.tipe_soal] || soal.tipe_soal}
                    </span>
                    {soal.mata_pelajaran && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{soal.mata_pelajaran.nama}</span>}
                    <span className="text-xs text-gray-400">Bobot: {soal.bobot}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${soal.tingkat_kesulitan === 'sulit' ? 'bg-red-100 text-red-600' : soal.tingkat_kesulitan === 'sedang' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                      {soal.tingkat_kesulitan}
                    </span>
                  </div>
                  <p className="text-gray-800 text-sm leading-relaxed">{soal.pertanyaan}</p>
                  {soal.pilihan_jawaban?.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-1">
                      {soal.pilihan_jawaban.map(p => (
                        <div key={p.id} className={`text-xs px-2 py-1 rounded-lg flex gap-1.5 ${p.benar ? 'bg-green-100 text-green-700 font-semibold' : 'bg-gray-100 text-gray-600'}`}>
                          <span className="font-bold">{p.label}.</span>
                          <span className="truncate">{p.teks}</span>
                          {p.benar && <span className="ml-auto">✓</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
