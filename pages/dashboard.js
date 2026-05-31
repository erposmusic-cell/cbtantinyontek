import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AppLayout from '../components/layout/AppLayout';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

function StatCard({ icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
      <div className="text-3xl mb-2">{icon}</div>
      <div className={`text-3xl font-extrabold ${color || 'text-gray-900'}`}>{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    loadStats();
  }, [user]);

  async function loadStats() {
    if (user.role === 'admin' || user.role === 'guru') {
      const [{ count: totalSiswa }, { count: totalUjian }, { count: totalSoal }, { count: ujianAktif }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'siswa'),
        supabase.from('ujian').select('*', { count: 'exact', head: true }),
        supabase.from('bank_soal').select('*', { count: 'exact', head: true }),
        supabase.from('ujian').select('*', { count: 'exact', head: true }).eq('status', 'aktif'),
      ]);
      setStats({ totalSiswa, totalUjian, totalSoal, ujianAktif });
    } else {
      const [{ count: ujianTersedia }, { count: hasilUjian }, { count: diskualifikasi }] = await Promise.all([
        supabase.from('ujian').select('*', { count: 'exact', head: true }).eq('status', 'aktif'),
        supabase.from('sesi_ujian').select('*', { count: 'exact', head: true })
          .eq('siswa_id', user.id).eq('status', 'selesai'),
        supabase.from('sesi_ujian').select('*', { count: 'exact', head: true })
          .eq('siswa_id', user.id).eq('status', 'diskualifikasi'),
      ]);
      setStats({ ujianTersedia, hasilUjian, diskualifikasi });
    }
  }

  if (loading || !user) return null;

  return (
    <AppLayout title="Dashboard">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">
          👋 Selamat datang, {user.nama_lengkap}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString('id-ID', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {user.role !== 'siswa' ? (
          <>
            <StatCard icon="👥" label="Total Siswa"  value={stats?.totalSiswa  ?? '—'} color="text-blue-600" />
            <StatCard icon="📋" label="Total Ujian"  value={stats?.totalUjian  ?? '—'} color="text-purple-600" />
            <StatCard icon="📝" label="Bank Soal"    value={stats?.totalSoal   ?? '—'} color="text-green-600" />
            <StatCard icon="🟢" label="Ujian Aktif"  value={stats?.ujianAktif ?? '—'} color="text-amber-600" />
          </>
        ) : (
          <>
            <StatCard icon="📝" label="Ujian Tersedia"   value={stats?.ujianTersedia  ?? '—'} color="text-blue-600" />
            <StatCard icon="✅" label="Ujian Selesai"    value={stats?.hasilUjian     ?? '—'} color="text-green-600" />
            {(stats?.diskualifikasi ?? 0) > 0 && (
              <StatCard icon="🔒" label="Dikunci"         value={stats?.diskualifikasi ?? 0}   color="text-red-600" />
            )}
          </>
        )}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-base font-bold text-gray-900 mb-4">Akses Cepat</h2>
        <div className="flex flex-wrap gap-3">
          {user.role === 'siswa' && (
            <button
              onClick={() => router.push('/siswa/ujian')}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              📝 Ikuti Ujian
            </button>
          )}
          {(user.role === 'guru' || user.role === 'admin') && (
            <>
              <button
                onClick={() => router.push(`/${user.role}/ujian`)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors"
              >
                📋 Kelola Ujian
              </button>
              <button
                onClick={() => router.push(`/${user.role}/soal`)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
              >
                📝 Bank Soal
              </button>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
