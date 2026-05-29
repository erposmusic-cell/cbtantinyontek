import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../hooks/useAuth';

const NAV_ITEMS = {
  admin: [
    { href: '/dashboard',              icon: '📊', label: 'Dashboard' },
    { href: '/admin/pengguna',         icon: '👥', label: 'Kelola Pengguna' },
    { href: '/admin/mata-pelajaran',   icon: '📖', label: 'Mata Pelajaran' },
    { href: '/admin/ujian',            icon: '📋', label: 'Kelola Ujian' },
    { href: '/admin/soal',             icon: '📝', label: 'Bank Soal' },
    { href: '/admin/monitoring',       icon: '👁',  label: 'Monitoring' },
    { href: '/admin/laporan',          icon: '📈', label: 'Laporan' },
  ],
  guru: [
    { href: '/dashboard',              icon: '📊', label: 'Dashboard' },
    { href: '/guru/ujian',             icon: '📋', label: 'Kelola Ujian' },
    { href: '/guru/soal',              icon: '📝', label: 'Bank Soal' },
    { href: '/guru/monitoring',        icon: '👁',  label: 'Monitoring' },
    { href: '/guru/nilai',             icon: '✏️', label: 'Koreksi & Nilai' },
  ],
  siswa: [
    { href: '/dashboard',              icon: '🏠', label: 'Beranda' },
    { href: '/siswa/ujian',            icon: '📝', label: 'Ujian Tersedia' },
    { href: '/siswa/hasil',            icon: '📊', label: 'Hasil Ujian' },
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

  if (!user) return null;

  const navItems = NAV_ITEMS[user.role] || NAV_ITEMS.siswa;

  return (
    <>
      <Head>
        <title>{title ? `${title} — CBT Anti-Nyontek` : 'CBT Anti-Nyontek'}</title>
      </Head>

      <div className="min-h-screen bg-blue-50/60 flex flex-col">
        {/* Navbar */}
        <nav className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 sticky top-0 z-50 shadow-sm">
          <div className="flex items-center gap-2.5 font-extrabold text-lg text-primary-600">
            <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center text-white text-lg">🎓</div>
            CBT Anti-Nyontek
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${ROLE_BADGE[user.role]}`}>
              {user.role}
            </span>
            <div className="w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-sm">
              {user.nama_lengkap?.charAt(0)}
            </div>
            <span className="text-sm font-semibold text-gray-800 hidden sm:block">{user.nama_lengkap}</span>
            <button
              onClick={() => { logout(); router.push('/'); }}
              className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
            >
              Keluar
            </button>
          </div>
        </nav>

        <div className="flex flex-1">
          {/* Sidebar */}
          <aside className="w-60 bg-white border-r border-gray-200 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto shrink-0">
            {navItems.map(item => {
              const isActive = router.pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div className={`flex items-center gap-2.5 px-5 py-2.5 text-sm font-medium cursor-pointer transition-all
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

          {/* Main content */}
          <main className="flex-1 p-6 overflow-y-auto animate-fade-in">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
