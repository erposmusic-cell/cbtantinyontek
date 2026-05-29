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

export default function KelolaUjianPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [ujianList, setUjianList] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

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
      .order('created_at', { ascending: false });
    setUjianList(data || []);
    setLoadingData(false);
  }

  async function updateStatus(id, status) {
    await supabase.from('ujian').update({ status }).eq('id', id);
    setUjianList(prev => prev.map(u => u.id === id ? { ...u, status } : u));
  }

  if (loading || !user) return null;

  return (
    <AppLayout title="Kelola Ujian">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">📋 Kelola Ujian</h1>
          <p className="text-gray-500 text-sm mt-1">Buat dan kelola ujian</p>
        </div>
        <button className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm rounded-lg transition-colors">
          + Buat Ujian
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loadingData ? (
          <div className="flex items-center justify-center h-40 text-gray-400">
            <div className="w-7 h-7 border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin mr-3" />
            Memuat data...
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
                      <p className="text-xs text-gray-400 mt-0.5">Passing: {u.passing_grade}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{u.mata_pelajaran?.nama || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{u.durasi_menit} menit</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{u.jumlah_soal}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLOR[u.status]}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {u.status === 'draft' && (
                          <button
                            onClick={() => updateStatus(u.id, 'aktif')}
                            className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold rounded-lg transition-colors"
                          >
                            Aktifkan
                          </button>
                        )}
                        {u.status === 'aktif' && (
                          <button
                            onClick={() => updateStatus(u.id, 'selesai')}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors"
                          >
                            Selesaikan
                          </button>
                        )}
                        <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors">
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {ujianList.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Belum ada ujian. Buat ujian pertama!</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
