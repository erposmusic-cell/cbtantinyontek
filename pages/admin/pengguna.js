import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

const ROLE_STYLE = {
  admin: 'bg-purple-100 text-purple-700 border border-purple-200',
  guru:  'bg-blue-100 text-blue-700 border border-blue-200',
  siswa: 'bg-green-100 text-green-700 border border-green-200',
};

const ROLE_LABEL = { admin: 'Admin', guru: 'Guru', siswa: 'Siswa' };

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

export default function PenggunaPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [profiles, setProfiles] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('semua');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ nama_lengkap: '', username: '', role: 'siswa', nomor_induk: '', kelas: '', aktif: true });
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading]);

  const fetchProfiles = useCallback(async () => {
    setLoadingData(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setProfiles(data || []);
    setLoadingData(false);
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const filtered = profiles.filter(p => {
    const matchRole = filterRole === 'semua' || p.role === filterRole;
    const matchSearch = !search ||
      p.nama_lengkap?.toLowerCase().includes(search.toLowerCase()) ||
      p.username?.toLowerCase().includes(search.toLowerCase()) ||
      p.nomor_induk?.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  const counts = {
    semua: profiles.length,
    admin: profiles.filter(p => p.role === 'admin').length,
    guru:  profiles.filter(p => p.role === 'guru').length,
    siswa: profiles.filter(p => p.role === 'siswa').length,
  };

  function openAdd() {
    setEditTarget(null);
    setForm({ nama_lengkap: '', username: '', role: 'siswa', nomor_induk: '', kelas: '', aktif: true });
    setFormEmail('');
    setFormPassword('');
    setError('');
    setShowModal(true);
  }

  function openEdit(p) {
    setEditTarget(p);
    setForm({ nama_lengkap: p.nama_lengkap, username: p.username, role: p.role, nomor_induk: p.nomor_induk || '', kelas: p.kelas || '', aktif: p.aktif });
    setError('');
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      if (editTarget) {
        // Update profile
        const { error: err } = await supabase
          .from('profiles')
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq('id', editTarget.id);
        if (err) throw err;
      } else {
        // Buat user baru via Supabase Auth Admin (pakai service role) — fallback: insert manual
        if (!formEmail || !formPassword) throw new Error('Email dan password wajib diisi');
        if (formPassword.length < 6) throw new Error('Password minimal 6 karakter');

        // Sign up user baru (akan trigger handle_new_user)
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: formEmail,
          password: formPassword,
          options: {
            data: {
              nama_lengkap: form.nama_lengkap,
              username: form.username,
              role: form.role,
            }
          }
        });
        if (authErr) throw authErr;

        // Upsert profile (jika trigger sudah jalan, update; jika belum, insert)
        if (authData?.user) {
          const { error: profErr } = await supabase
            .from('profiles')
            .upsert({
              id: authData.user.id,
              nama_lengkap: form.nama_lengkap,
              username: form.username,
              role: form.role,
              nomor_induk: form.nomor_induk || null,
              kelas: form.kelas || null,
              aktif: form.aktif,
            });
          if (profErr) throw profErr;
        }
      }
      setShowModal(false);
      fetchProfiles();
    } catch (e) {
      setError(e.message || 'Terjadi kesalahan');
    }
    setSaving(false);
  }

  async function toggleAktif(p) {
    await supabase.from('profiles').update({ aktif: !p.aktif }).eq('id', p.id);
    fetchProfiles();
  }

  async function handleDelete(p) {
    await supabase.from('profiles').delete().eq('id', p.id);
    setConfirmDelete(null);
    fetchProfiles();
  }

  if (loading || !user) return null;

  return (
    <AppLayout title="Kelola Pengguna">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Kelola Pengguna</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manajemen akun admin, guru, dan siswa</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
        >
          <span className="text-lg leading-none">+</span> Tambah Pengguna
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { key: 'semua', label: 'Total', icon: '👥', color: 'bg-gray-50 border-gray-200' },
          { key: 'admin', label: 'Admin', icon: '🛡️', color: 'bg-purple-50 border-purple-200' },
          { key: 'guru',  label: 'Guru',  icon: '👨‍🏫', color: 'bg-blue-50 border-blue-200' },
          { key: 'siswa', label: 'Siswa', icon: '🎓', color: 'bg-green-50 border-green-200' },
        ].map(s => (
          <div key={s.key} className={`rounded-xl border p-4 ${s.color}`}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-2xl font-extrabold text-gray-900">{counts[s.key]}</div>
            <div className="text-xs text-gray-500 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter & Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Cari nama, username, NIS/NIP..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="flex gap-2 flex-wrap">
          {['semua', 'admin', 'guru', 'siswa'].map(r => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${
                filterRole === r ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {r === 'semua' ? 'Semua' : ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loadingData ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-3 animate-pulse">⏳</div>
            <p>Memuat data...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-3">🔍</div>
            <p className="font-semibold">Tidak ada pengguna ditemukan</p>
            <p className="text-sm mt-1">Coba ubah filter atau kata kunci pencarian</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Nama</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Username</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Role</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">NIS/NIP</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Kelas</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                          {p.nama_lengkap?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="font-semibold text-gray-900">{p.nama_lengkap}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 font-mono text-xs">{p.username}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${ROLE_STYLE[p.role]}`}>
                        {ROLE_LABEL[p.role]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{p.nomor_induk || '—'}</td>
                    <td className="px-5 py-3.5 text-gray-600">{p.kelas || '—'}</td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => toggleAktif(p)}
                        className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                          p.aktif
                            ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200'
                            : 'bg-red-100 text-red-600 border border-red-200 hover:bg-red-200'
                        }`}
                      >
                        {p.aktif ? '✓ Aktif' : '✗ Nonaktif'}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        {p.id !== user.id && (
                          <button
                            onClick={() => setConfirmDelete(p)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition-colors"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loadingData && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 text-right">
            Menampilkan {filtered.length} dari {profiles.length} pengguna
          </div>
        )}
      </div>

      {/* Modal Tambah/Edit */}
      {showModal && (
        <Modal title={editTarget ? 'Edit Pengguna' : 'Tambah Pengguna Baru'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            {!editTarget && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    placeholder="email@sekolah.com"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Password <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={e => setFormPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nama Lengkap <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.nama_lengkap}
                onChange={e => setForm(f => ({ ...f, nama_lengkap: e.target.value }))}
                placeholder="Nama lengkap"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Username <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="username_unik"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Role <span className="text-red-500">*</span></label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="siswa">Siswa</option>
                  <option value="guru">Guru</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">NIS / NIP</label>
                <input
                  type="text"
                  value={form.nomor_induk}
                  onChange={e => setForm(f => ({ ...f, nomor_induk: e.target.value }))}
                  placeholder="Opsional"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {form.role === 'siswa' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Kelas</label>
                <input
                  type="text"
                  value={form.kelas}
                  onChange={e => setForm(f => ({ ...f, kelas: e.target.value }))}
                  placeholder="Contoh: X IPA 1"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="aktif"
                checked={form.aktif}
                onChange={e => setForm(f => ({ ...f, aktif: e.target.checked }))}
                className="w-4 h-4 accent-blue-600"
              />
              <label htmlFor="aktif" className="text-sm text-gray-700 font-medium">Akun aktif</label>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                ⚠️ {error}
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {saving ? 'Menyimpan...' : (editTarget ? 'Simpan Perubahan' : 'Tambah Pengguna')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Konfirmasi Hapus */}
      {confirmDelete && (
        <Modal title="Hapus Pengguna" onClose={() => setConfirmDelete(null)}>
          <div className="text-center py-2">
            <div className="text-5xl mb-4">🗑️</div>
            <p className="text-gray-700 font-medium mb-1">Hapus pengguna ini?</p>
            <p className="text-gray-900 font-bold text-lg mb-1">{confirmDelete.nama_lengkap}</p>
            <p className="text-gray-500 text-sm mb-6">Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
