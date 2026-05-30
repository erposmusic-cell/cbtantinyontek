/**
 * pages/admin/pengguna.js
 *
 * Fitur baru: Import Pengguna massal dari CSV / Excel
 * - Tombol "Import CSV/Excel" di header
 * - Modal upload dengan drag & drop
 * - Download template CSV
 * - Preview tabel sebelum simpan
 * - Validasi kolom wajib, duplikat username, format email
 * - Simpan massal ke Supabase (signUp per baris + upsert profile)
 * - Progress bar saat proses import
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/router';
import { supabase, supabaseAdmin } from '../../lib/supabase';

// ── Constants ────────────────────────────────────────────────────────────────

const ROLE_STYLE = {
  admin: 'bg-purple-100 text-purple-700 border border-purple-200',
  guru:  'bg-blue-100 text-blue-700 border border-blue-200',
  siswa: 'bg-green-100 text-green-700 border border-green-200',
};
const ROLE_LABEL = { admin: 'Admin', guru: 'Guru', siswa: 'Siswa' };

// Kolom CSV yang didukung
// nama_lengkap, username, email, password, role, nomor_induk, kelas
const TEMPLATE_CSV = `nama_lengkap,username,email,password,role,nomor_induk,kelas
Budi Santoso,budi.santoso,budi@sekolah.com,budi123,siswa,2024001,X IPA 1
Siti Rahayu,siti.rahayu,siti@sekolah.com,siti123,siswa,2024002,X IPA 1
Ahmad Fauzi,ahmad.fauzi,ahmad@sekolah.com,ahmad123,guru,NIP001,
`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function Modal({ title, onClose, wide, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-4xl' : 'max-w-md'} mx-4 overflow-hidden max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 text-xl">&times;</button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// Parse CSV teks → array of objects
function parseCSV(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map((line, idx) => {
    // Handle quoted fields
    const cols = [];
    let inQuote = false, cur = '';
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    const obj = { _row: idx + 2 };
    headers.forEach((h, i) => { obj[h] = cols[i] || ''; });
    return obj;
  });
}

// Load SheetJS dari CDN
async function loadXLSX() {
  if (typeof window === 'undefined') return null;
  if (window.XLSX) return window.XLSX;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error('Gagal memuat SheetJS'));
    document.head.appendChild(s);
  });
}

// Validasi satu baris
function validateRow(row, existingUsernames) {
  const errors = [];
  if (!row.nama_lengkap) errors.push('Nama lengkap wajib diisi');
  if (!row.username)     errors.push('Username wajib diisi');
  if (!row.email)        errors.push('Email wajib diisi');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push('Format email tidak valid');
  if (!row.password || row.password.length < 6) errors.push('Password minimal 6 karakter');
  if (!['admin', 'guru', 'siswa'].includes(row.role)) errors.push('Role harus: admin, guru, atau siswa');
  if (existingUsernames.has(row.username)) errors.push(`Username "${row.username}" sudah digunakan`);
  return errors;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PenggunaPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [profiles,       setProfiles]       = useState([]);
  const [loadingData,    setLoadingData]    = useState(true);
  const [search,         setSearch]         = useState('');
  const [filterRole,     setFilterRole]     = useState('semua');
  const [showModal,      setShowModal]      = useState(false);
  const [editTarget,     setEditTarget]     = useState(null);
  const [form,           setForm]           = useState({ nama_lengkap: '', username: '', role: 'siswa', nomor_induk: '', kelas: '', aktif: true });
  const [formEmail,      setFormEmail]      = useState('');
  const [formPassword,   setFormPassword]   = useState('');
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState('');
  const [confirmDelete,  setConfirmDelete]  = useState(null);

  // ── Import state ──
  const [showImport,     setShowImport]     = useState(false);
  const [importRows,     setImportRows]     = useState([]);   // parsed rows
  const [importErrors,   setImportErrors]   = useState({});   // { rowIndex: [errors] }
  const [importProgress, setImportProgress] = useState(null); // { done, total, errors }
  const [importLoading,  setImportLoading]  = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const fileRef = useRef();

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
    const matchRole   = filterRole === 'semua' || p.role === filterRole;
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

  // ── Single user modal ──────────────────────────────────────────────────────

  function openAdd() {
    setEditTarget(null);
    setForm({ nama_lengkap: '', username: '', role: 'siswa', nomor_induk: '', kelas: '', aktif: true });
    setFormEmail(''); setFormPassword(''); setError('');
    setShowModal(true);
  }

  function openEdit(p) {
    setEditTarget(p);
    setForm({ nama_lengkap: p.nama_lengkap, username: p.username, role: p.role, nomor_induk: p.nomor_induk || '', kelas: p.kelas || '', aktif: p.aktif });
    setError('');
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true); setError('');
    try {
      if (editTarget) {
        const { error: err } = await supabase.from('profiles').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editTarget.id);
        if (err) throw err;
      } else {
        if (!formEmail || !formPassword) throw new Error('Email dan password wajib diisi');
        if (formPassword.length < 6) throw new Error('Password minimal 6 karakter');
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email: formEmail, password: formPassword,
          email_confirm: true,
          user_metadata: { nama_lengkap: form.nama_lengkap, username: form.username, role: form.role }
        });
        if (authErr) throw authErr;
        if (authData?.user) {
          const { error: profErr } = await supabase.from('profiles').upsert({
            id: authData.user.id, ...form, nomor_induk: form.nomor_induk || null, kelas: form.kelas || null,
          });
          if (profErr) throw profErr;
        }
      }
      setShowModal(false);
      fetchProfiles();
    } catch (e) { setError(e.message || 'Terjadi kesalahan'); }
    setSaving(false);
  }

  async function toggleAktif(p) {
    await supabase.from('profiles').update({ aktif: !p.aktif }).eq('id', p.id);
    fetchProfiles();
  }

  async function handleDelete(p) {
    await supabase.from('profiles').delete().eq('id', p.id);
    setConfirmDelete(null); fetchProfiles();
  }

  // ── Import handlers ────────────────────────────────────────────────────────

  function openImport() {
    setImportRows([]); setImportErrors({}); setImportProgress(null);
    setImportFileName(''); setShowImport(true);
  }

  async function handleImportFile(file) {
    if (!file) return;
    setImportLoading(true);
    setImportFileName(file.name);
    setImportRows([]); setImportErrors({}); setImportProgress(null);

    try {
      const ext = file.name.split('.').pop().toLowerCase();
      let rows = [];

      if (ext === 'csv' || ext === 'txt') {
        const text = await file.text();
        rows = parseCSV(text);
      } else if (['xlsx', 'xls'].includes(ext)) {
        const XLSX = await loadXLSX();
        const ab   = await file.arrayBuffer();
        const wb   = XLSX.read(new Uint8Array(ab), { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const raw  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (raw.length < 2) throw new Error('File kosong atau tidak ada data');
        const headers = raw[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, '_'));
        rows = raw.slice(1).map((cols, idx) => {
          const obj = { _row: idx + 2 };
          headers.forEach((h, i) => { obj[h] = String(cols[i] || '').trim(); });
          return obj;
        }).filter(r => Object.values(r).some(v => v && v !== String(r._row)));
      } else {
        throw new Error('Format tidak didukung. Gunakan .csv, .xlsx, atau .xls');
      }

      if (rows.length === 0) throw new Error('Tidak ada data ditemukan dalam file');

      // Validasi semua baris
      const existingUsernames = new Set(profiles.map(p => p.username));
      const usernamesInFile   = new Set();
      const errMap = {};
      rows.forEach((row, i) => {
        // Cek duplikat di dalam file itu sendiri
        if (usernamesInFile.has(row.username)) {
          errMap[i] = [`Username "${row.username}" duplikat dalam file`];
        } else {
          const errs = validateRow(row, existingUsernames);
          if (errs.length) errMap[i] = errs;
        }
        if (row.username) usernamesInFile.add(row.username);
      });

      setImportRows(rows);
      setImportErrors(errMap);
    } catch (e) {
      alert('❌ ' + e.message);
    }
    setImportLoading(false);
  }

  // Hapus baris dari preview
  function removeImportRow(idx) {
    setImportRows(prev => prev.filter((_, i) => i !== idx));
    setImportErrors(prev => {
      const next = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = parseInt(k);
        if (ki < idx) next[ki] = v;
        else if (ki > idx) next[ki - 1] = v;
      });
      return next;
    });
  }

  async function handleDoImport() {
    const validRows = importRows.filter((_, i) => !importErrors[i]);
    if (validRows.length === 0) { alert('Tidak ada data valid untuk diimpor.'); return; }

    setImportProgress({ done: 0, total: validRows.length, errors: [] });

    let done = 0;
    const errors = [];

    for (const row of validRows) {
      try {
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email: row.email,
          password: row.password,
          email_confirm: true,
          user_metadata: {
            nama_lengkap: row.nama_lengkap,
            username:     row.username,
            role:         row.role || 'siswa',
          }
        });
        if (authErr) throw authErr;

        if (authData?.user) {
          const { error: profErr } = await supabase.from('profiles').upsert({
            id:           authData.user.id,
            nama_lengkap: row.nama_lengkap,
            username:     row.username,
            role:         row.role || 'siswa',
            nomor_induk:  row.nomor_induk || null,
            kelas:        row.kelas       || null,
            aktif:        true,
          });
          if (profErr) throw profErr;
        }
      } catch (e) {
        errors.push({ nama: row.nama_lengkap, error: e.message });
      }
      done++;
      setImportProgress({ done, total: validRows.length, errors: [...errors] });
      // Kecilkan rate limit Supabase Auth
      await new Promise(r => setTimeout(r, 300));
    }

    fetchProfiles();
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'template-import-pengguna.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading || !user) return null;

  const validCount   = importRows.filter((_, i) => !importErrors[i]).length;
  const invalidCount = importRows.length - validCount;
  const importDone   = importProgress && importProgress.done === importProgress.total;

  return (
    <AppLayout title="Kelola Pengguna">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Kelola Pengguna</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manajemen akun admin, guru, dan siswa</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={openImport}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
          >
            📥 Import CSV/Excel
          </button>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
          >
            <span className="text-lg leading-none">+</span> Tambah Pengguna
          </button>
        </div>
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
                  {['Nama', 'Username', 'Role', 'NIS/NIP', 'Kelas', 'Status', 'Aksi'].map(h => (
                    <th key={h} className={`px-5 py-3 font-semibold text-gray-600 ${h === 'Aksi' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
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
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${ROLE_STYLE[p.role]}`}>{ROLE_LABEL[p.role]}</span>
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
                        <button onClick={() => openEdit(p)} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors">Edit</button>
                        {p.id !== user.id && (
                          <button onClick={() => setConfirmDelete(p)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition-colors">Hapus</button>
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

      {/* ══════════════════════════════════════════════════════════
          MODAL IMPORT
      ══════════════════════════════════════════════════════════ */}
      {showImport && (
        <Modal title="📥 Import Pengguna" wide onClose={() => setShowImport(false)}>
          {/* Panduan & template */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-800">
            <p className="font-bold mb-1">Format kolom CSV / Excel:</p>
            <p className="font-mono text-xs bg-white border border-blue-200 rounded-lg px-3 py-2 mt-1 break-all">
              nama_lengkap, username, email, password, role, nomor_induk, kelas
            </p>
            <p className="mt-2 text-xs text-blue-700">
              Role: <strong>siswa</strong> / <strong>guru</strong> / <strong>admin</strong> &nbsp;·&nbsp;
              Password minimal 6 karakter &nbsp;·&nbsp;
              nomor_induk & kelas opsional
            </p>
            <button
              onClick={downloadTemplate}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
            >
              📄 Download Template CSV
            </button>
          </div>

          {/* Upload zone */}
          {importRows.length === 0 && !importLoading && (
            <div
              className="border-2 border-dashed border-gray-300 rounded-2xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors mb-4"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleImportFile(e.dataTransfer.files[0]); }}
            >
              <div className="text-5xl mb-3">📂</div>
              <p className="font-semibold text-gray-700">Klik atau drag & drop file di sini</p>
              <p className="text-sm text-gray-400 mt-1">Mendukung: <strong>.csv</strong>, <strong>.xlsx</strong>, <strong>.xls</strong></p>
              <input
                ref={fileRef} type="file" className="hidden"
                accept=".csv,.xlsx,.xls"
                onChange={e => handleImportFile(e.target.files[0])}
              />
            </div>
          )}

          {importLoading && (
            <div className="flex flex-col items-center py-10 text-blue-600">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
              <p className="font-semibold">Membaca file...</p>
            </div>
          )}

          {/* Preview tabel */}
          {importRows.length > 0 && !importProgress && (
            <>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-bold text-gray-800">{importFileName}</span>
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">{validCount} valid</span>
                  {invalidCount > 0 && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold">{invalidCount} error</span>}
                </div>
                <button
                  onClick={() => { setImportRows([]); setImportErrors({}); setImportFileName(''); }}
                  className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-semibold"
                >
                  ↩ Upload Ulang
                </button>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-xl mb-4 max-h-[360px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold text-gray-600">#</th>
                      <th className="px-3 py-2 text-left font-bold text-gray-600">Nama</th>
                      <th className="px-3 py-2 text-left font-bold text-gray-600">Username</th>
                      <th className="px-3 py-2 text-left font-bold text-gray-600">Email</th>
                      <th className="px-3 py-2 text-left font-bold text-gray-600">Role</th>
                      <th className="px-3 py-2 text-left font-bold text-gray-600">NIS/NIP</th>
                      <th className="px-3 py-2 text-left font-bold text-gray-600">Kelas</th>
                      <th className="px-3 py-2 text-left font-bold text-gray-600">Status</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {importRows.map((row, i) => {
                      const errs   = importErrors[i];
                      const hasErr = errs && errs.length > 0;
                      return (
                        <tr key={i} className={hasErr ? 'bg-red-50' : 'hover:bg-gray-50'}>
                          <td className="px-3 py-2 text-gray-400">{row._row}</td>
                          <td className="px-3 py-2 font-medium text-gray-900">{row.nama_lengkap || <span className="text-red-400">—</span>}</td>
                          <td className="px-3 py-2 font-mono text-gray-700">{row.username || <span className="text-red-400">—</span>}</td>
                          <td className="px-3 py-2 text-gray-600">{row.email || <span className="text-red-400">—</span>}</td>
                          <td className="px-3 py-2">
                            {['admin','guru','siswa'].includes(row.role)
                              ? <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${ROLE_STYLE[row.role]}`}>{ROLE_LABEL[row.role]}</span>
                              : <span className="text-red-500 font-bold">{row.role || '—'}</span>
                            }
                          </td>
                          <td className="px-3 py-2 text-gray-500">{row.nomor_induk || '—'}</td>
                          <td className="px-3 py-2 text-gray-500">{row.kelas || '—'}</td>
                          <td className="px-3 py-2">
                            {hasErr ? (
                              <div className="text-red-600 text-xs">
                                {errs.map((e, ei) => <div key={ei}>⚠️ {e}</div>)}
                              </div>
                            ) : (
                              <span className="text-green-600 font-bold text-xs">✓ OK</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <button onClick={() => removeImportRow(i)} className="text-gray-300 hover:text-red-500 text-base leading-none font-bold" title="Hapus baris ini">×</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {invalidCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 mb-4">
                  ⚠️ <strong>{invalidCount} baris</strong> memiliki error dan akan dilewati. Perbaiki file dan upload ulang, atau hapus baris tersebut menggunakan tombol ×.
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowImport(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleDoImport}
                  disabled={validCount === 0}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors"
                >
                  📥 Import {validCount} Pengguna
                </button>
              </div>
            </>
          )}

          {/* Progress */}
          {importProgress && (
            <div className="py-4">
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="font-bold text-gray-800">
                  {importDone ? '✅ Import selesai!' : `Mengimpor... ${importProgress.done} / ${importProgress.total}`}
                </span>
                <span className="text-gray-500">{Math.round((importProgress.done / importProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <div
                  className="bg-emerald-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}
                />
              </div>

              {importProgress.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 max-h-40 overflow-y-auto">
                  <p className="text-xs font-bold text-red-700 mb-1">Gagal diimpor ({importProgress.errors.length}):</p>
                  {importProgress.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600">• {e.nama}: {e.error}</p>
                  ))}
                </div>
              )}

              {importDone && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-sm text-green-800">
                  <strong>{importProgress.total - importProgress.errors.length}</strong> pengguna berhasil diimpor.
                  {importProgress.errors.length > 0 && <> · <strong>{importProgress.errors.length}</strong> gagal.</>}
                </div>
              )}

              {importDone && (
                <button
                  onClick={() => setShowImport(false)}
                  className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors"
                >
                  Tutup
                </button>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* Modal Tambah/Edit */}
      {showModal && (
        <Modal title={editTarget ? 'Edit Pengguna' : 'Tambah Pengguna Baru'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            {!editTarget && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email <span className="text-red-500">*</span></label>
                  <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="email@sekolah.com"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Password <span className="text-red-500">*</span></label>
                  <input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="Minimal 6 karakter"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nama Lengkap <span className="text-red-500">*</span></label>
              <input type="text" value={form.nama_lengkap} onChange={e => setForm(f => ({ ...f, nama_lengkap: e.target.value }))} placeholder="Nama lengkap"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Username <span className="text-red-500">*</span></label>
              <input type="text" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="username_unik"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Role <span className="text-red-500">*</span></label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="siswa">Siswa</option>
                  <option value="guru">Guru</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">NIS / NIP</label>
                <input type="text" value={form.nomor_induk} onChange={e => setForm(f => ({ ...f, nomor_induk: e.target.value }))} placeholder="Opsional"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            {form.role === 'siswa' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Kelas</label>
                <input type="text" value={form.kelas} onChange={e => setForm(f => ({ ...f, kelas: e.target.value }))} placeholder="Contoh: X IPA 1"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="aktif" checked={form.aktif} onChange={e => setForm(f => ({ ...f, aktif: e.target.checked }))} className="w-4 h-4 accent-blue-600" />
              <label htmlFor="aktif" className="text-sm text-gray-700 font-medium">Akun aktif</label>
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">⚠️ {error}</div>}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors">Batal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
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
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors">Batal</button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors">Ya, Hapus</button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
