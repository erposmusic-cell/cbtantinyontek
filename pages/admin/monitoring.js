import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Page() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.push('/'); }, [user, loading]);
  if (loading || !user) return null;
  return (
    <AppLayout title="Monitoring">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Monitoring</h1>
        <p className="text-gray-500 text-sm mt-1">Halaman dalam pengembangan</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
        <div className="text-5xl mb-3">🚧</div>
        <p className="font-semibold">Segera hadir</p>
        <p className="text-sm mt-1">Fitur ini sedang dalam pengembangan</p>
      </div>
    </AppLayout>
  );
}
