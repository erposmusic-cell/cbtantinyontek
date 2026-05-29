import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

export default function HasilUjianPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [hasilList, setHasilList] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading]);

  useEffect(() => {
    if (user) loadHasil();
  }, [user]);

  async function loadHasil() {
    const { data } = await supabase
      .from('sesi_ujian')
      .select('*, ujian(judul, passing_grade, mata_pelajaran(nama))')
      .eq('siswa_id', user?.id)
      .eq('status', 'selesai')
      .order('waktu_selesai', { ascending: false });
    setHasilList(data || []);
    setLoadingData(false);
  }

  if (loading || !user) return null;

  return (
    <AppLayout title="Hasil Ujian">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">📊 Hasil Ujian</h1>
        <p className="text-gray-500 text-sm mt-1">Riwayat ujian yang telah Anda selesaikan</p>
      </div>

      {loadingData ? (
        <div className="flex items-center justify-center h-40 text-gray-400">
          <div className="w-7 h-7 border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin mr-3" />
          Memuat data...
        </div>
      ) : hasilList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <div className="text-5xl mb-3">📭</div>
          <p className="font-semibold">Belum ada riwayat ujian</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Ujian','Mata Pelajaran','Nilai','Status','Pelanggaran','Waktu'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {hasilList.map(h => {
                  const lulus = h.nilai_akhir >= h.ujian?.passing_grade;
                  return (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{h.ujian?.judul}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{h.ujian?.mata_pelajaran?.nama || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-lg font-extrabold ${lulus ? 'text-green-600' : 'text-red-600'}`}>
                          {h.nilai_akhir ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full
                          ${lulus ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {lulus ? '✅ Lulus' : '❌ Tidak Lulus'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{h.jumlah_pelanggaran ?? 0}x</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {h.waktu_selesai ? new Date(h.waktu_selesai).toLocaleString('id-ID') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
