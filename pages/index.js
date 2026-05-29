import Head from 'next/head';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { login, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!email || !password) { setError('Email dan password wajib diisi.'); return; }
    setIsLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (e) {
      setError(e.message || 'Login gagal. Periksa email dan password Anda.');
    }
    setIsLoading(false);
  };

  return (
    <>
      <Head><title>Login — CBT Anti-Nyontek</title></Head>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-primary-600 to-blue-400 p-5">
        <div className="bg-white rounded-2xl p-10 w-full max-w-md shadow-2xl animate-fade-in">

          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center text-2xl">
              🎓
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900">CBT Anti-Nyontek</h1>
              <p className="text-xs text-gray-500">Sistem Ujian Digital Terpercaya</p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 mb-4 text-sm">
              ⚠️ {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              className="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-lg text-sm
                         focus:border-primary-600 focus:outline-none transition-colors"
              placeholder="email@sekolah.ac.id"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
            <input
              type="password"
              className="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-lg text-sm
                         focus:border-primary-600 focus:outline-none transition-colors"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={isLoading || loading}
            className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white font-bold
                       rounded-lg text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '⏳ Memproses...' : '🔑 Masuk'}
          </button>

          <p className="text-center mt-5 text-xs text-gray-400">
            Sistem Ujian Berbasis Komputer dengan Keamanan Tinggi
          </p>
        </div>
      </div>
    </>
  );
}
