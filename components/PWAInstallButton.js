import { useState, useEffect } from 'react';

/**
 * Tombol Install PWA
 * - Muncul otomatis saat browser memicu event `beforeinstallprompt`
 * - Menghilang setelah app berhasil diinstall
 * - Support Android/Chrome; di iOS tampil petunjuk manual (Add to Home Screen)
 */
export default function PWAInstallButton() {
  const [prompt,    setPrompt]    = useState(null);  // BeforeInstallPromptEvent
  const [installed, setInstalled] = useState(false);
  const [showIOS,   setShowIOS]   = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Cek apakah sudah berjalan sebagai PWA (standalone)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (isStandalone) { setInstalled(true); return; }

    // Deteksi iOS — tidak support beforeinstallprompt, perlu petunjuk manual
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) { setShowIOS(true); return; }

    // Android/Chrome/Edge — tangkap prompt install
    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Deteksi setelah berhasil diinstall
    window.addEventListener('appinstalled', () => {
      setInstalled(true);
      setPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setPrompt(null);
  };

  // Sudah install / sudah dismiss / tidak ada prompt → tidak tampil
  if (installed || dismissed) return null;

  // iOS — tampil tooltip petunjuk
  if (showIOS) {
    return (
      <div className="relative group">
        <button
          onClick={() => setShowIOS(s => !s)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700
                     text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
        >
          📲 Install App
        </button>
        <div className="absolute right-0 top-10 w-64 bg-gray-900 text-white text-xs rounded-xl
                        p-4 shadow-2xl z-[9999] hidden group-focus-within:block">
          <p className="font-bold mb-1">Install di iPhone/iPad:</p>
          <p>1. Tap tombol <strong>Bagikan</strong> (kotak dengan panah atas) di Safari</p>
          <p className="mt-1">2. Pilih <strong>"Add to Home Screen"</strong></p>
          <button
            onClick={() => setDismissed(true)}
            className="mt-3 text-gray-400 hover:text-white underline"
          >
            Tutup
          </button>
        </div>
      </div>
    );
  }

  // Android/Chrome — tombol install langsung
  if (!prompt) return null;

  return (
    <button
      onClick={handleInstall}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700
                 text-white text-xs font-bold rounded-lg transition-colors shadow-sm
                 animate-pulse hover:animate-none"
    >
      📲 Install App
    </button>
  );
}
