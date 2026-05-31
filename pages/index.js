import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';

function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show,           setShow]           = useState(false);
  const [isIOS,          setIsIOS]          = useState(false);
  const [showIOSTip,     setShowIOSTip]     = useState(false);
  const [installing,     setInstalling]     = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      navigator.standalone === true;
    if (isStandalone) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    if (ios) { setIsIOS(true); setShow(true); return; }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => { setShow(false); setDeferredPrompt(null); });

    const fallback = setTimeout(() => {
      if (!window.matchMedia('(display-mode: standalone)').matches) setShow(true);
    }, 2000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(fallback);
    };
  }, []);

  const handleInstall = async () => {
    if (isIOS) { setShowIOSTip(true); return; }
    if (!deferredPrompt) {
      alert('Untuk install:\n1. Klik ikon ⋮ (menu) di browser\n2. Pilih "Install App" atau "Add to Home Screen"');
      return;
    }
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShow(false);
    setDeferredPrompt(null);
    setInstalling(false);
  };

  if (!show) return null;

  return (
    <>
      {/* Banner install di atas form */}
      <div className="w-full max-w-md mb-4 animate-fade-in">
        <button
          onClick={handleInstall}
          disabled={installing}
          className="w-full flex items-center justify-center gap-2 py-3 px-4
                     bg-white/20 hover:bg-white/30 backdrop-blur-sm
                     border border-white/40 text-white font-bold rounded-xl
                     transition-all shadow-lg disabled:opacity-60"
        >
          {installing
            ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <span className="text-xl">📲</span>}
          <span>Install Aplikasi CBT</span>
          <span className="ml-auto text-white/60 text-xs font-normal">Gratis • Offline</span>
        </button>
      </div>

      {/* Modal iOS */}
      {showIOSTip && (
        <div className="fixed inset-0 bg-black/60 z-[99999] flex items-end justify-center p-4"
             onClick={() => setShowIOSTip(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
               onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="text-5xl mb-2">📱</div>
              <h3 className="font-extrabold text-gray-900 text-lg">Install di iPhone/iPad</h3>
              <p className="text-xs text-gray-400 mt-1">Buka di Safari untuk install</p>
            </div>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <span>Tap tombol <strong>Bagikan</strong> <span className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">⬆</span> di bawah Safari</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <span>Pilih <strong>"Add to Home Screen"</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <span>Tap <strong>"Add"</strong> di pojok kanan atas</span>
              </li>
            </ol>
            <button
              onClick={() => setShowIOSTip(false)}
              className="mt-5 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function LoginPage() {
  const { login, loading } = useAuth();
  const router = useRouter();

  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [error,     setError]     = useState('');
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 via-primary-600 to-blue-400 p-5">

        {/* Tombol Install PWA — di atas form login */}
        <PWAInstallBanner />

        {/* Form Login */}
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
