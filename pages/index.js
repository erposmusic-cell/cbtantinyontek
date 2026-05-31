import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { login, loading } = useAuth();
  const router = useRouter();

  const [email,          setEmail]          = useState('');
  const [password,       setPassword]       = useState('');
  const [error,          setError]          = useState('');
  const [isLoading,      setIsLoading]      = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed,      setInstalled]      = useState(false);
  const [installing,     setInstalling]     = useState(false);

  useEffect(() => {
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      navigator.standalone === true
    ) { setInstalled(true); return; }

    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
    setInstalling(false);
  };

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
      <Head>
        <title>Login — CBT Anti-Nyontek</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 via-primary-600 to-blue-400 px-4 py-8">

        <div className="bg-white rounded-2xl p-6 sm:p-10 w-full max-w-md shadow-2xl animate-fade-in">

          {/* Logo + judul */}
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
            <div className="w-11 h-11 sm:w-12 sm:h-12 bg-primary-600 rounded-xl flex items-center justify-center text-xl sm:text-2xl shrink-0">
              🎓
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 leading-tight">CBT Anti-Nyontek</h1>
              <p className="text-xs text-gray-500">Sistem Ujian Digital Terpercaya</p>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 text-red-600 border border-red-200 rounded-lg p-3 mb-4 text-sm">
              ⚠️ {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              className="w-full px-3.5 py-3 border-2 border-gray-200 rounded-lg text-sm
                         focus:border-primary-600 focus:outline-none transition-colors"
              placeholder="email@sekolah.ac.id"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full px-3.5 py-3 border-2 border-gray-200 rounded-lg text-sm
                         focus:border-primary-600 focus:outline-none transition-colors"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          {/* Tombol Login */}
          <button
            onClick={handleLogin}
            disabled={isLoading || loading}
            className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800
                       text-white font-bold rounded-lg text-base transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '⏳ Memproses...' : '🔑 Masuk'}
          </button>

          {/* Tombol Install PWA */}
          {!installed && deferredPrompt && (
            <button
              onClick={handleInstall}
              disabled={installing}
              className="w-full mt-3 py-3 border-2 border-blue-200 hover:border-blue-400
                         active:bg-blue-50 text-blue-600 font-semibold rounded-lg text-sm
                         transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {installing
                ? <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                : '📲'}
              Install Aplikasi
            </button>
          )}

          <p className="text-center mt-5 text-xs text-gray-400">
            Sistem Ujian Berbasis Komputer dengan Keamanan Tinggi
          </p>
        </div>
      </div>
    </>
  );
}
