import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 text-xl">&times;</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export default function MataPelajaranPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [list, setList] = useState([]);
  const [guruList, setGuruList] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ nama: '', kode: '', deskripsi: '', guru_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => { if (!loading && !user) router.push('/'); }, [user, loading]);

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    const [{ data: mapel }, { data: guru }] = await Promise.all([
      supabase.from('mata_pelajaran').select('*, profiles(nama_lengkap)').order('nama'),
      supabase.from('profiles').select('id, nama_lengkap').eq('role', 'guru').order('nama_lengkap'),
    ]);
    setList(mapel || []);
    setGuruList(guru || []);
    setLoadingData(false);
  }, []);

  useEffect(() => { if (user) fetchData(); }, [user]);

  const filtered = list.filter(m =>
    !search || m.nama.toLowerCase().includes(search.toLowerCase()) || m.kode.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setEditTarget(null);
    setForm({ nama: '', kode: '', deskripsi: '', guru_id: '' });
    setError('');
    setShowModal(true);
  }

  function openEdit(m) {
    setEditTarget(m);
    setForm({ nama: m.nama, kode: m.kode, deskripsi: m.deskripsi || '', guru_id: m.guru_id || '' });
    setError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.nama.trim()) { setError('Nama mata pelajaran wajib diisi'); return; }
    if (!form.kode.trim()) { setError('Kode mata pelajaran wajib diisi'); return; }
    setSaving(true); setError('');
    try {
      const payload = { nama: form.nama.trim(), kode: form.kode.trim().toUpperCase(), deskripsi: form.deskripsi || null, guru_id: form.guru_id || null };
      if (editTarget) {
        const { error: err } = await supabase.from('mata_pelajaran').update(payload).eq('id', editTarget.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('mata_pelajaran').insert(payload);
        if (err) throw err;
      }
      setShowModal(false);
      fetchData();
    } catch(e) { setError(e.message?.includes('unique') ? 'Kode mata pelajaran sudah digunakan' : e.message); }
    setSaving(false);
  }

  async function handleDelete(m) {
    await supabase.from('mata_pelajaran').delete().eq('id', m.id);
    setConfirmDelete(null);
    fetchData();
  }

  if (loading || !user) return null;

  return (
    <AppLayout title="Mata Pelajaran">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">📚 Mata Pelajaran</h1>
          <p className="text-gray-500 text-sm mt-0.5">{list.length} mata pelajaran terdaftar</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors">
          + Tambah Mata Pelajaran
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <input type="text" placeholder="Cari nama atau kode mata pelajaran..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Grid kartu */}
      {loadingData ? (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mr-3" />Memuat...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <div className="text-5xl mb-3">📭</div>
          <p className="font-semibold">{search ? 'Tidak ditemukan' : 'Belum ada mata pelajaran'}</p>
          {!search && <button onClick={openAdd} className="mt-4 px-5 py-2 bg-blue-600 text-white font-bold rounded-xl text-sm hover:bg-blue-700 transition-colors">+ Tambah Sekarang</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(m => (
            <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-extrabold text-sm">{m.kode.slice(0,3)}</div>
                <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">{m.kode}</span>
              </div>
              <h3 className="font-bold text-gray-900 mb-1">{m.nama}</h3>
              {m.deskripsi && <p className="text-xs text-gray-500 mb-2 line-clamp-2">{m.deskripsi}</p>}
              <p className="text-xs text-gray-400 mb-4">👨‍🏫 {m.profiles?.nama_lengkap || 'Belum ada guru'}</p>
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button onClick={() => openEdit(m)} className="flex-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors">Edit</button>
                <button onClick={() => setConfirmDelete(m)} className="flex-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition-colors">Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Modal title={editTarget ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nama Mata Pelajaran <span className="text-red-500">*</span></label>
              <input type="text" value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
                placeholder="Contoh: Matematika" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Kode <span className="text-red-500">*</span></label>
              <input type="text" value={form.kode} onChange={e => setForm(f => ({ ...f, kode: e.target.value.toUpperCase() }))}
                placeholder="Contoh: MTK" maxLength={10} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Deskripsi</label>
              <textarea value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} rows={2}
                placeholder="Keterangan singkat (opsional)" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Guru Pengampu</label>
              <select value={form.guru_id} onChange={e => setForm(f => ({ ...f, guru_id: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">— Pilih Guru —</option>
                {guruList.map(g => <option key={g.id} value={g.id}>{g.nama_lengkap}</option>)}
              </select>
              {guruList.length === 0 && <p className="text-xs text-amber-600 mt-1">⚠️ Belum ada akun guru. Tambah guru di Kelola Pengguna terlebih dahulu.</p>}
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">⚠️ {error}</div>}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors">Batal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
                {saving ? 'Menyimpan...' : (editTarget ? 'Simpan' : 'Tambah')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Hapus Mata Pelajaran" onClose={() => setConfirmDelete(null)}>
          <div className="text-center py-2">
            <div className="text-5xl mb-4">🗑️</div>
            <p className="text-gray-700 font-medium mb-1">Hapus mata pelajaran ini?</p>
            <p className="text-gray-900 font-bold text-lg mb-1">{confirmDelete.nama}</p>
            <p className="text-gray-500 text-sm mb-6">Semua soal dan ujian terkait mungkin terpengaruh.</p>
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
