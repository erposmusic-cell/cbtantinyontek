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
    // Sudah jalan sebagai PWA → sembunyikan tombol
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      navigator.standalone === true
    ) {
      setInstalled(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
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
      <Head><title>Login — CBT Anti-Nyontek</title></Head>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 via-primary-600 to-blue-400 p-5">

        <div className="bg-white rounded-2xl p-10 w-full max-w-md shadow-2xl animate-fade-in">

          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center text-2xl">🎓</div>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900">CBT Anti-Nyontek</h1>
              <p className="text-xs text-gray-500">Sistem Ujian Digital Terpercaya</p>
            </div>

            {/* Tombol Install — pojok kanan logo */}
            {!installed && deferredPrompt && (
              <button
                onClick={handleInstall}
                disabled={installing}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-blue-600
                           hover:bg-blue-700 text-white text-xs font-bold rounded-lg
                           transition-colors disabled:opacity-60 shrink-0"
              >
                {installing
                  ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : '📲'}
                Install
              </button>
            )}
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

          {/* Tombol Install bawah — muncul sebagai alternatif */}
          {!installed && deferredPrompt && (
            <button
              onClick={handleInstall}
              disabled={installing}
              className="w-full mt-3 py-2.5 border-2 border-blue-200 hover:border-blue-400
                         text-blue-600 hover:bg-blue-50 font-semibold rounded-lg text-sm
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
