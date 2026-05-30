import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

const STATUS_COLOR = {
  draft:      'bg-gray-100 text-gray-600',
  aktif:      'bg-green-100 text-green-700',
  selesai:    'bg-blue-100 text-blue-700',
  dibatalkan: 'bg-red-100 text-red-600',
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

const FORM_DEFAULT = {
  judul: '', deskripsi: '', mata_pelajaran_id: '', kelas_target: '',
  waktu_mulai: '', waktu_selesai: '', durasi_menit: 60, jumlah_soal: 10,
  acak_soal: true, acak_pilihan: true, tampilkan_nilai: false, passing_grade: 75,
  status: 'draft', wajib_fullscreen: true, deteksi_pindah_tab: true,
  blokir_copy_paste: true, deteksi_wajah: false, batas_pelanggaran: 3,
  kunci_browser: true, watermark_nama: true, rekam_aktivitas: true,
};

export default function KelolaUjianPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [ujianList, setUjianList] = useState([]);
  const [mapel, setMapel] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(FORM_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [soalList, setSoalList]           = useState([]);
  const [selectedSoal, setSelectedSoal]   = useState([]);

  useEffect(() => { if (!loading && !user) router.push('/'); }, [user, loading]);
  useEffect(() => { if (user) { loadUjian(); loadMapel(); loadSoal(); } }, [user]);

  async function loadUjian() {
    const { data } = await supabase
      .from('ujian').select('*, mata_pelajaran(nama)')
      .order('created_at', { ascending: false });
    setUjianList(data || []);
    setLoadingData(false);
  }

  async function loadMapel() {
    const { data } = await supabase.from('mata_pelajaran').select('*').order('nama');
    setMapel(data || []);
  }

  async function loadSoal() {
    const { data } = await supabase
      .from('bank_soal')
      .select('id, pertanyaan, tipe_soal, bobot, mata_pelajaran_id, mata_pelajaran(nama)')
      .eq('aktif', true)
      .order('created_at', { ascending: false });
    setSoalList(data || []);
  }

  async function updateStatus(id, status) {
    await supabase.from('ujian').update({ status }).eq('id', id);
    setUjianList(prev => prev.map(u => u.id === id ? { ...u, status } : u));
  }

  function openAdd() {
    setEditTarget(null);
    setForm(FORM_DEFAULT);
    setSelectedSoal([]);
    setError('');
    setShowModal(true);
  }

  async function openEdit(u) {
    setEditTarget(u);
    setForm({
      judul: u.judul, deskripsi: u.deskripsi || '', mata_pelajaran_id: u.mata_pelajaran_id || '',
      kelas_target: (u.kelas_target || []).join(', '),
      waktu_mulai: u.waktu_mulai ? u.waktu_mulai.slice(0, 16) : '',
      waktu_selesai: u.waktu_selesai ? u.waktu_selesai.slice(0, 16) : '',
      durasi_menit: u.durasi_menit, jumlah_soal: u.jumlah_soal,
      acak_soal: u.acak_soal, acak_pilihan: u.acak_pilihan,
      tampilkan_nilai: u.tampilkan_nilai, passing_grade: u.passing_grade,
      status: u.status, wajib_fullscreen: u.wajib_fullscreen,
      deteksi_pindah_tab: u.deteksi_pindah_tab, blokir_copy_paste: u.blokir_copy_paste,
      deteksi_wajah: u.deteksi_wajah, batas_pelanggaran: u.batas_pelanggaran,
      kunci_browser: u.kunci_browser, watermark_nama: u.watermark_nama,
      rekam_aktivitas: u.rekam_aktivitas,
    });
    // Load soal yang sudah dipilih untuk ujian ini
    const { data: existing } = await supabase
      .from('soal_ujian').select('soal_id').eq('ujian_id', u.id).order('urutan');
    setSelectedSoal((existing || []).map(r => r.soal_id));
    setError('');
    setShowModal(true);
  }

  const setF = (key, val) => setForm(f => ({ ...f, [key]: val }));

  async function handleSave() {
    if (!form.judul.trim())      { setError('Judul ujian wajib diisi'); return; }
    if (!form.waktu_mulai)       { setError('Waktu mulai wajib diisi'); return; }
    if (!form.waktu_selesai)     { setError('Waktu selesai wajib diisi'); return; }
    if (selectedSoal.length === 0) { setError('Pilih minimal 1 soal untuk ujian ini'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        jumlah_soal: selectedSoal.length,
        kelas_target: form.kelas_target ? form.kelas_target.split(',').map(s => s.trim()).filter(Boolean) : [],
        mata_pelajaran_id: form.mata_pelajaran_id || null,
        guru_id: user.id,
      };

      let ujianId;
      if (editTarget) {
        const { error: err } = await supabase.from('ujian').update(payload).eq('id', editTarget.id);
        if (err) throw err;
        ujianId = editTarget.id;
        // Hapus soal lama, ganti dengan pilihan baru
        await supabase.from('soal_ujian').delete().eq('ujian_id', ujianId);
      } else {
        const { data, error: err } = await supabase.from('ujian').insert(payload).select('id').single();
        if (err) throw err;
        ujianId = data.id;
      }

      // Insert soal ke soal_ujian dengan urutan sesuai pilihan
      const soalRows = selectedSoal.map((soalId, idx) => ({
        ujian_id: ujianId,
        soal_id:  soalId,
        urutan:   idx + 1,
      }));
      const { error: soalErr } = await supabase.from('soal_ujian').insert(soalRows);
      if (soalErr) throw soalErr;

      setShowModal(false);
      loadUjian();
    } catch(e) { setError(e.message || 'Terjadi kesalahan'); }
    setSaving(false);
  }

  async function handleDelete(u) {
    await supabase.from('ujian').delete().eq('id', u.id);
    setConfirmDelete(null);
    loadUjian();
  }

  if (loading || !user) return null;

  return (
    <AppLayout title="Kelola Ujian">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">📋 Kelola Ujian</h1>
          <p className="text-gray-500 text-sm mt-1">Buat dan kelola ujian</p>
        </div>
        <button onClick={openAdd} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-colors">
          + Buat Ujian
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loadingData ? (
          <div className="flex items-center justify-center h-40 text-gray-400">
            <div className="w-7 h-7 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mr-3" />Memuat data...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Judul','Mata Pelajaran','Durasi','Soal','Status','Aksi'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ujianList.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900">{u.judul}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Passing: {u.passing_grade}%</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{u.mata_pelajaran?.nama || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{u.durasi_menit} menit</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{u.jumlah_soal}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLOR[u.status]}`}>{u.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        {u.status === 'draft' && (
                          <button onClick={() => updateStatus(u.id, 'aktif')} className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold rounded-lg transition-colors">Aktifkan</button>
                        )}
                        {u.status === 'aktif' && (
                          <button onClick={() => updateStatus(u.id, 'selesai')} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors">Selesaikan</button>
                        )}
                        <button onClick={() => openEdit(u)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors">Edit</button>
                        <button onClick={() => setConfirmDelete(u)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition-colors">Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {ujianList.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Belum ada ujian. Klik "+ Buat Ujian" untuk mulai!</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Buat/Edit Ujian */}
      {showModal && (
        <Modal title={editTarget ? 'Edit Ujian' : 'Buat Ujian Baru'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            {/* Info Dasar */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Judul Ujian <span className="text-red-500">*</span></label>
              <input type="text" value={form.judul} onChange={e => setF('judul', e.target.value)}
                placeholder="Contoh: UTS Matematika Kelas X"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Deskripsi</label>
              <textarea value={form.deskripsi} onChange={e => setF('deskripsi', e.target.value)} rows={2}
                placeholder="Keterangan ujian (opsional)"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Mata Pelajaran</label>
                <select value={form.mata_pelajaran_id} onChange={e => setF('mata_pelajaran_id', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">— Pilih —</option>
                  {mapel.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Kelas Target</label>
                <input type="text" value={form.kelas_target} onChange={e => setF('kelas_target', e.target.value)}
                  placeholder="X IPA 1, X IPA 2"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Waktu Mulai <span className="text-red-500">*</span></label>
                <input type="datetime-local" value={form.waktu_mulai} onChange={e => setF('waktu_mulai', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Waktu Selesai <span className="text-red-500">*</span></label>
                <input type="datetime-local" value={form.waktu_selesai} onChange={e => setF('waktu_selesai', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Durasi (menit)</label>
                <input type="number" min={1} value={form.durasi_menit} onChange={e => setF('durasi_menit', +e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Jumlah Soal</label>
                <input type="number" min={1} value={form.jumlah_soal} onChange={e => setF('jumlah_soal', +e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Passing Grade (%)</label>
                <input type="number" min={0} max={100} value={form.passing_grade} onChange={e => setF('passing_grade', +e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {/* Pengaturan Ujian */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Pengaturan Ujian</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'acak_soal', label: 'Acak urutan soal' },
                  { key: 'acak_pilihan', label: 'Acak pilihan jawaban' },
                  { key: 'tampilkan_nilai', label: 'Tampilkan nilai setelah ujian' },
                ].map(opt => (
                  <label key={opt.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={form[opt.key]} onChange={e => setF(opt.key, e.target.checked)} className="w-4 h-4 accent-blue-600" />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Pengaturan Anti-Nyontek */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">🔒 Anti-Nyontek</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'wajib_fullscreen', label: 'Wajib fullscreen' },
                  { key: 'deteksi_pindah_tab', label: 'Deteksi pindah tab' },
                  { key: 'blokir_copy_paste', label: 'Blokir copy-paste' },
                  { key: 'kunci_browser', label: 'Kunci browser' },
                  { key: 'watermark_nama', label: 'Watermark nama siswa' },
                  { key: 'rekam_aktivitas', label: 'Rekam aktivitas' },
                  { key: 'deteksi_wajah', label: 'Deteksi wajah (kamera)' },
                ].map(opt => (
                  <label key={opt.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={form[opt.key]} onChange={e => setF(opt.key, e.target.checked)} className="w-4 h-4 accent-blue-600" />
                    {opt.label}
                  </label>
                ))}
              </div>
              <div className="mt-3">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Maks. Pelanggaran sebelum dikunci</label>
                <input type="number" min={1} max={10} value={form.batas_pelanggaran} onChange={e => setF('batas_pelanggaran', +e.target.value)}
                  className="w-32 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {/* Pilih Soal */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                📝 Pilih Soal <span className="text-blue-600 font-bold">({selectedSoal.length} dipilih)</span>
              </p>
              {soalList.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Belum ada soal di bank soal. Tambahkan soal terlebih dahulu.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {soalList.map(s => {
                    const checked = selectedSoal.includes(s.id);
                    return (
                      <label key={s.id} className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors ${checked ? 'bg-blue-50' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setSelectedSoal(prev =>
                            checked ? prev.filter(id => id !== s.id) : [...prev, s.id]
                          )}
                          className="mt-0.5 w-4 h-4 accent-blue-600 shrink-0"
                        />
                        <span className="flex-1 min-w-0">
                          <span className="text-sm text-gray-800 line-clamp-1">{s.pertanyaan}</span>
                          <span className="text-xs text-gray-400 mt-0.5 block">
                            {s.tipe_soal} · bobot {s.bobot} · {s.mata_pelajaran?.nama || '—'}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">⚠️ {error}</div>}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors">Batal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
                {saving ? 'Menyimpan...' : (editTarget ? 'Simpan Perubahan' : 'Buat Ujian')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Konfirmasi Hapus */}
      {confirmDelete && (
        <Modal title="Hapus Ujian" onClose={() => setConfirmDelete(null)}>
          <div className="text-center py-2">
            <div className="text-5xl mb-4">🗑️</div>
            <p className="text-gray-700 font-medium mb-1">Hapus ujian ini?</p>
            <p className="text-gray-900 font-bold text-lg mb-1">{confirmDelete.judul}</p>
            <p className="text-gray-500 text-sm mb-6">Semua data sesi dan jawaban siswa akan ikut terhapus.</p>
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
