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

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 text-xl">&times;</button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

const PILIHAN_DEFAULT = [
  { label: 'A', teks: '', adalah_benar: false },
  { label: 'B', teks: '', adalah_benar: false },
  { label: 'C', teks: '', adalah_benar: false },
  { label: 'D', teks: '', adalah_benar: false },
];

export default function SoalPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [soalList, setSoalList] = useState([]);
  const [mapel, setMapel] = useState([]);
  const [selectedMapel, setSelectedMapel] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [savingImport, setSavingImport] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Form state
  const [form, setForm] = useState({
    pertanyaan: '', tipe_soal: 'pilihan_ganda', bobot: 1,
    tingkat_kesulitan: 'sedang', mata_pelajaran_id: '', aktif: true,
  });
  const [pilihan, setPilihan] = useState(PILIHAN_DEFAULT);
  const [essayKunci, setEssayKunci] = useState('');

  useEffect(() => { if (!loading && !user) router.push('/'); }, [user, loading]);
  useEffect(() => { if (user) { loadMapel(); loadSoal(); } }, [user]);
  useEffect(() => { if (user) loadSoal(selectedMapel, user.id); }, [selectedMapel]);

  async function loadMapel() {
    const { data } = await supabase.from('mata_pelajaran').select('*').order('nama');
    setMapel(data || []);
  }

  async function loadSoal(mapelId = selectedMapel, guruId = user?.id) {
    if (!guruId) return;
    setLoadingData(true);
    let q = supabase.from('bank_soal').select('*, mata_pelajaran(nama), pilihan_jawaban(*)').eq('guru_id', guruId).order('created_at', { ascending: false });
    if (mapelId) q = q.eq('mata_pelajaran_id', mapelId);
    const { data } = await q;
    setSoalList(data || []);
    setLoadingData(false);
  }

  function openAdd() {
    setEditTarget(null);
    setForm({ pertanyaan: '', tipe_soal: 'pilihan_ganda', bobot: 1, tingkat_kesulitan: 'sedang', mata_pelajaran_id: selectedMapel || '', aktif: true });
    setPilihan(PILIHAN_DEFAULT);
    setEssayKunci('');
    setError('');
    setShowModal(true);
  }

  function openEdit(soal) {
    setEditTarget(soal);
    setForm({
      pertanyaan: soal.pertanyaan, tipe_soal: soal.tipe_soal,
      bobot: soal.bobot, tingkat_kesulitan: soal.tingkat_kesulitan,
      mata_pelajaran_id: soal.mata_pelajaran_id || '', aktif: soal.aktif,
    });
    setEssayKunci(soal.tipe_soal === 'essay' ? (soal.kunci_jawaban || '') : '');
    if (soal.pilihan_jawaban?.length > 0) {
      setPilihan(soal.pilihan_jawaban.map(p => ({ label: p.label, teks: p.teks, adalah_benar: p.adalah_benar, id: p.id })));
    } else {
      setPilihan(PILIHAN_DEFAULT);
    }
    setError('');
    setShowModal(true);
  }

  function updatePilihan(idx, field, val) {
    setPilihan(prev => prev.map((p, i) => {
      if (i !== idx) {
        // Untuk PG, hanya 1 jawaban benar — uncheck yang lain
        if (field === 'adalah_benar' && val && form.tipe_soal === 'pilihan_ganda') return { ...p, adalah_benar: false };
        return p;
      }
      return { ...p, [field]: val };
    }));
  }

  async function handleSave() {
    if (!form.pertanyaan.trim()) { setError('Pertanyaan wajib diisi'); return; }
    if (!form.mata_pelajaran_id) { setError('Mata pelajaran wajib dipilih'); return; }
    if (['pilihan_ganda','mcma'].includes(form.tipe_soal)) {
      if (pilihan.some(p => !p.teks.trim())) { setError('Semua pilihan jawaban wajib diisi'); return; }
      if (!pilihan.some(p => p.adalah_benar)) { setError('Minimal 1 pilihan harus ditandai benar'); return; }
    }
    setSaving(true); setError('');
    try {
      const soalPayload = {
        pertanyaan: form.pertanyaan, tipe_soal: form.tipe_soal,
        bobot: form.bobot, tingkat_kesulitan: form.tingkat_kesulitan,
        mata_pelajaran_id: form.mata_pelajaran_id || null,
        guru_id: user.id, aktif: form.aktif,
        // Kunci jawaban hanya relevan untuk essay; untuk tipe lain dikosongkan
        kunci_jawaban: form.tipe_soal === 'essay' ? (essayKunci.trim() || null) : null,
      };

      let soalId = editTarget?.id;
      if (editTarget) {
        const { error: err } = await supabase.from('bank_soal').update(soalPayload).eq('id', editTarget.id);
        if (err) throw err;
        // Hapus pilihan lama lalu insert baru
        if (['pilihan_ganda','mcma','benar_salah'].includes(form.tipe_soal)) {
          await supabase.from('pilihan_jawaban').delete().eq('soal_id', editTarget.id);
        }
      } else {
        const { data, error: err } = await supabase.from('bank_soal').insert(soalPayload).select().single();
        if (err) throw err;
        soalId = data.id;
      }

      // Insert pilihan jawaban baru
      if (['pilihan_ganda','mcma','benar_salah'].includes(form.tipe_soal) && soalId) {
        const pilihanPayload = pilihan.map((p, i) => ({
          soal_id: soalId, label: p.label, teks: p.teks,
          adalah_benar: p.adalah_benar, urutan: i + 1,
        }));
        const { error: pErr } = await supabase.from('pilihan_jawaban').insert(pilihanPayload);
        if (pErr) throw pErr;
      }

      setShowModal(false);
      loadSoal();
    } catch(e) { setError(e.message || 'Terjadi kesalahan'); }
    setSaving(false);
  }

  async function handleDelete(soal) {
    await supabase.from('bank_soal').delete().eq('id', soal.id);
    setConfirmDelete(null);
    loadSoal();
  }

  async function handleImport(soalArr) {
    setSavingImport(true);
    let berhasil = 0, gagal = 0;
    for (const soal of soalArr) {
      try {
        const { data: bs, error: bsErr } = await supabase.from('bank_soal').insert({
          pertanyaan: soal.pertanyaan, tipe_soal: soal.tipe_soal,
          bobot: soal.bobot || 1, tingkat_kesulitan: soal.tingkat_kesulitan || 'sedang',
          mata_pelajaran_id: selectedMapel || null, guru_id: user.id,
        }).select().single();
        if (bsErr) throw bsErr;
        if (soal.pilihan?.length > 0) {
          await supabase.from('pilihan_jawaban').insert(
            soal.pilihan.map(p => ({ soal_id: bs.id, label: p.label, teks: p.teks, adalah_benar: soal.kunci_jawaban?.includes(p.label) || false }))
          );
        }
        berhasil++;
      } catch { gagal++; }
    }
    setImportResult({ berhasil, gagal });
    setSavingImport(false);
    loadSoal();
  }

  if (loading || !user) return null;

  return (
    <AppLayout title="Bank Soal">
      <ImportSoalModal open={showImport} onClose={() => setShowImport(false)} onImport={handleImport} />

      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">📚 Bank Soal</h1>
          <p className="text-gray-500 text-sm mt-1">{soalList.length} soal tersedia</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition-colors">
            📥 Import Word/Excel
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors">
            ✚ Tambah Soal
          </button>
        </div>
      </div>

      {importResult && (
        <div className="mb-5 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-green-800 font-semibold">✅ Import selesai: {importResult.berhasil} soal berhasil{importResult.gagal > 0 ? `, ${importResult.gagal} gagal` : ''}</p>
          <button onClick={() => setImportResult(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
      )}

      <div className="mb-5">
        <select value={selectedMapel} onChange={e => setSelectedMapel(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">Semua Mata Pelajaran</option>
          {mapel.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
        </select>
      </div>

      {loadingData ? (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mr-3" />Memuat soal...
        </div>
      ) : soalList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <div className="text-5xl mb-3">📭</div>
          <p className="font-semibold">Bank soal masih kosong</p>
          <p className="text-sm mt-1">Tambah soal manual atau import dari Word/Excel</p>
          <div className="flex gap-3 justify-center mt-4">
            <button onClick={openAdd} className="px-5 py-2 bg-blue-600 text-white font-bold rounded-xl text-sm hover:bg-blue-700 transition-colors">✚ Tambah Manual</button>
            <button onClick={() => setShowImport(true)} className="px-5 py-2 bg-amber-500 text-white font-bold rounded-xl text-sm hover:bg-amber-600 transition-colors">📥 Import</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {soalList.map((soal, i) => (
            <div key={soal.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start gap-3">
                <span className="text-sm font-bold text-gray-400 shrink-0 mt-0.5">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TIPE_COLOR[soal.tipe_soal] || 'bg-gray-100 text-gray-600'}`}>{TIPE_LABEL[soal.tipe_soal] || soal.tipe_soal}</span>
                    {soal.mata_pelajaran && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{soal.mata_pelajaran.nama}</span>}
                    <span className="text-xs text-gray-400">Bobot: {soal.bobot}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${soal.tingkat_kesulitan === 'sulit' ? 'bg-red-100 text-red-600' : soal.tingkat_kesulitan === 'sedang' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>{soal.tingkat_kesulitan}</span>
                  </div>
                  <p className="text-gray-800 text-sm leading-relaxed">{soal.pertanyaan}</p>
                  {soal.pilihan_jawaban?.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-1">
                      {soal.pilihan_jawaban.sort((a,b) => a.urutan - b.urutan).map(p => (
                        <div key={p.id} className={`text-xs px-2 py-1 rounded-lg flex gap-1.5 ${p.adalah_benar ? 'bg-green-100 text-green-700 font-semibold' : 'bg-gray-100 text-gray-600'}`}>
                          <span className="font-bold">{p.label}.</span>
                          <span className="truncate">{p.teks}</span>
                          {p.adalah_benar && <span className="ml-auto">✓</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(soal)} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors">Edit</button>
                  <button onClick={() => setConfirmDelete(soal)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition-colors">Hapus</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tambah/Edit Soal */}
      {showModal && (
        <Modal title={editTarget ? 'Edit Soal' : 'Tambah Soal Baru'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Pertanyaan <span className="text-red-500">*</span></label>
              <textarea value={form.pertanyaan} onChange={e => setForm(f => ({ ...f, pertanyaan: e.target.value }))} rows={3}
                placeholder="Tulis pertanyaan di sini..."
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Tipe Soal</label>
                <select value={form.tipe_soal} onChange={e => { setForm(f => ({ ...f, tipe_soal: e.target.value })); setPilihan(PILIHAN_DEFAULT); }}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="pilihan_ganda">Pilihan Ganda</option>
                  <option value="mcma">MCMA</option>
                  <option value="benar_salah">Benar/Salah</option>
                  <option value="essay">Essay</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Kesulitan</label>
                <select value={form.tingkat_kesulitan} onChange={e => setForm(f => ({ ...f, tingkat_kesulitan: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="mudah">Mudah</option>
                  <option value="sedang">Sedang</option>
                  <option value="sulit">Sulit</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Bobot</label>
                <input type="number" min={1} value={form.bobot} onChange={e => setForm(f => ({ ...f, bobot: +e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Mata Pelajaran</label>
              <select value={form.mata_pelajaran_id} onChange={e => setForm(f => ({ ...f, mata_pelajaran_id: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">— Pilih —</option>
                {mapel.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
              </select>
            </div>

            {/* Pilihan Jawaban untuk PG & MCMA */}
            {['pilihan_ganda', 'mcma'].includes(form.tipe_soal) && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Pilihan Jawaban {form.tipe_soal === 'pilihan_ganda' ? '(centang 1 jawaban benar)' : '(centang semua jawaban benar)'}
                </label>
                <div className="space-y-2">
                  {pilihan.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500 w-5">{p.label}.</span>
                      <input type="text" value={p.teks} onChange={e => updatePilihan(i, 'teks', e.target.value)}
                        placeholder={`Pilihan ${p.label}`}
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <input type={form.tipe_soal === 'pilihan_ganda' ? 'radio' : 'checkbox'}
                        name="jawaban_benar" checked={p.adalah_benar}
                        onChange={e => updatePilihan(i, 'adalah_benar', e.target.checked)}
                        className="w-4 h-4 accent-green-600" />
                      <span className="text-xs text-gray-400">Benar</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Essay */}
            {form.tipe_soal === 'essay' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Kunci Jawaban / Panduan Koreksi</label>
                <textarea value={essayKunci} onChange={e => setEssayKunci(e.target.value)} rows={3}
                  placeholder="Tulis panduan koreksi untuk guru..."
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            )}

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">⚠️ {error}</div>}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors">Batal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
                {saving ? 'Menyimpan...' : (editTarget ? 'Simpan Perubahan' : 'Tambah Soal')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Konfirmasi Hapus */}
      {confirmDelete && (
        <Modal title="Hapus Soal" onClose={() => setConfirmDelete(null)}>
          <div className="text-center py-2">
            <div className="text-5xl mb-4">🗑️</div>
            <p className="text-gray-700 font-medium mb-2">Hapus soal ini?</p>
            <p className="text-gray-600 text-sm italic mb-6">"{confirmDelete.pertanyaan.slice(0, 80)}..."</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors">Batal</button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors">Ya, Hapus</button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
