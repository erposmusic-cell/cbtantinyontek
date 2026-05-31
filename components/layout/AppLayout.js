import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import PWAInstallButton from '../PWAInstallButton';

const NAV_ITEMS = {
  admin: [
    { href: '/dashboard',            icon: '📊', label: 'Dashboard' },
    { href: '/admin/pengguna',       icon: '👥', label: 'Kelola Pengguna' },
    { href: '/admin/mata-pelajaran', icon: '📖', label: 'Mata Pelajaran' },
    { href: '/admin/ujian',          icon: '📋', label: 'Kelola Ujian' },
    { href: '/admin/soal',           icon: '📝', label: 'Bank Soal' },
    { href: '/admin/monitoring',     icon: '👁',  label: 'Monitoring' },
    { href: '/admin/laporan',        icon: '📈', label: 'Laporan' },
  ],
  guru: [
    { href: '/dashboard',        icon: '📊', label: 'Dashboard' },
    { href: '/guru/ujian',       icon: '📋', label: 'Kelola Ujian' },
    { href: '/guru/soal',        icon: '📝', label: 'Bank Soal' },
    { href: '/guru/monitoring',  icon: '👁',  label: 'Monitoring' },
    { href: '/guru/nilai',       icon: '✏️', label: 'Koreksi & Nilai' },
  ],
  siswa: [
    { href: '/dashboard',    icon: '🏠', label: 'Beranda' },
    { href: '/siswa/ujian',  icon: '📝', label: 'Ujian Tersedia' },
    { href: '/siswa/hasil',  icon: '📊', label: 'Hasil Ujian' },
  ],
};

const ROLE_BADGE = {
  admin: 'bg-purple-100 text-purple-700',
  guru:  'bg-blue-100 text-blue-700',
  siswa: 'bg-green-100 text-green-700',
};

export default function AppLayout({ children, title }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Tutup sidebar saat navigasi
  useEffect(() => {
    setSidebarOpen(false);
  }, [router.pathname]);

  // Tutup sidebar saat klik di luar (overlay)
  useEffect(() => {
    if (!sidebarOpen) return;
    const handler = (e) => {
      if (e.target.id === 'sidebar-overlay') setSidebarOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [sidebarOpen]);

  if (!user) return null;

  const navItems = NAV_ITEMS[user.role] || NAV_ITEMS.siswa;

  return (
    <>
      <Head>
        <title>{title ? `${title} — CBT Anti-Nyontek` : 'CBT Anti-Nyontek'}</title>
      </Head>

      <div className="min-h-screen bg-blue-50/60 flex flex-col">

        {/* ── Navbar ── */}
        <nav className="bg-white border-b border-gray-200 h-14 md:h-16 flex items-center justify-between px-4 md:px-6 sticky top-0 z-50 shadow-sm">

          {/* Kiri: hamburger + logo */}
          <div className="flex items-center gap-3">
            {/* Hamburger — hanya mobile */}
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-1.5
                         rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Menu"
            >
              <span className={`block w-5 h-0.5 bg-gray-700 transition-transform duration-200
                ${sidebarOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block w-5 h-0.5 bg-gray-700 transition-opacity duration-200
                ${sidebarOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-gray-700 transition-transform duration-200
                ${sidebarOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </button>

            <div className="flex items-center gap-2 font-extrabold text-base md:text-lg text-primary-600">
              <div className="w-8 h-8 md:w-9 md:h-9 bg-primary-600 rounded-lg flex items-center justify-center text-white text-base md:text-lg">🎓</div>
              <span className="hidden xs:block">CBT Anti-Nyontek</span>
            </div>
          </div>

          {/* Kanan: install + role + nama + logout */}
          <div className="flex items-center gap-2 md:gap-3">
            <PWAInstallButton />
            <span className={`hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${ROLE_BADGE[user.role]}`}>
              {user.role}
            </span>
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
              {user.nama_lengkap?.charAt(0)}
            </div>
            <span className="hidden md:block text-sm font-semibold text-gray-800 max-w-[120px] truncate">
              {user.nama_lengkap}
            </span>
            <button
              onClick={() => { logout(); router.push('/'); }}
              className="px-2.5 md:px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs md:text-sm font-semibold rounded-lg transition-colors"
            >
              Keluar
            </button>
          </div>
        </nav>

        <div className="flex flex-1 overflow-hidden">

          {/* ── Overlay mobile ── */}
          {sidebarOpen && (
            <div
              id="sidebar-overlay"
              className="fixed inset-0 bg-black/40 z-40 md:hidden"
            />
          )}

          {/* ── Sidebar ── */}
          <aside className={`
            fixed md:sticky top-14 md:top-16 z-50 md:z-auto
            h-[calc(100vh-56px)] md:h-[calc(100vh-64px)]
            w-64 md:w-60 bg-white border-r border-gray-200
            overflow-y-auto shrink-0 transition-transform duration-300
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}>
            {/* Nama user di sidebar mobile */}
            <div className="md:hidden px-5 py-4 border-b border-gray-100">
              <p className="font-bold text-gray-900 text-sm">{user.nama_lengkap}</p>
              <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase ${ROLE_BADGE[user.role]}`}>
                {user.role}
              </span>
            </div>

            {navItems.map(item => {
              const isActive = router.pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div className={`flex items-center gap-2.5 px-5 py-3 text-sm font-medium cursor-pointer transition-all
                    border-l-[3px] ${isActive
                      ? 'bg-blue-50 text-primary-600 border-primary-600 font-semibold'
                      : 'text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-900'
                    }`}>
                    <span className="text-lg w-5 text-center">{item.icon}</span>
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </aside>

          {/* ── Main content ── */}
          <main className="flex-1 p-4 md:p-6 overflow-y-auto animate-fade-in min-w-0">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
