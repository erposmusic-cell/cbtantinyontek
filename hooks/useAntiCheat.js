import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useAntiCheat({ enabled, config, sesiId, siswaId, ujianId, onViolation, onLock }) {
  const isActive = useRef(false);
  const violationCount = useRef(0);

  const reportViolation = useCallback(async (tipe, deskripsi, tingkat = 'sedang') => {
    if (!isActive.current) return;

    violationCount.current += 1;
    const v = { tipe, deskripsi, tingkat, timestamp: new Date().toISOString() };
    onViolation?.(v);

    // Simpan ke Supabase
    if (sesiId && siswaId && ujianId) {
      await supabase.from('log_pelanggaran').insert({
        sesi_id: sesiId,
        siswa_id: siswaId,
        ujian_id: ujianId,
        tipe_pelanggaran: tipe,
        deskripsi,
        tingkat_keparahan: tingkat,
        timestamp: v.timestamp,
      });

      // Update jumlah pelanggaran di sesi
      await supabase.rpc('increment_pelanggaran', { p_sesi_id: sesiId });
    }

    // Kunci jika melebihi batas
    if (config?.batas_pelanggaran && violationCount.current >= config.batas_pelanggaran) {
      onLock?.(`Terkunci: melebihi batas pelanggaran (${violationCount.current}x)`);
    }
  }, [sesiId, siswaId, ujianId, config, onViolation, onLock]);

  useEffect(() => {
    if (!enabled) return;
    isActive.current = true;
    const cleanup = [];

    // 1. Fullscreen
    if (config?.wajib_fullscreen) {
      const enterFS = () => document.documentElement.requestFullscreen?.().catch(() => {});
      enterFS();
      const onFSChange = () => {
        if (!document.fullscreenElement) {
          reportViolation('keluar_fullscreen', 'Siswa keluar dari mode fullscreen', 'tinggi');
          setTimeout(enterFS, 500);
        }
      };
      document.addEventListener('fullscreenchange', onFSChange);
      cleanup.push(() => document.removeEventListener('fullscreenchange', onFSChange));
    }

    // 2. Pindah tab / blur window
    if (config?.deteksi_pindah_tab) {
      const onVisChange = () => {
        if (document.hidden)
          reportViolation('pindah_tab', 'Siswa berpindah ke tab atau aplikasi lain', 'tinggi');
      };
      const onBlur = () =>
        reportViolation('blur_window', 'Jendela browser kehilangan fokus', 'sedang');

      document.addEventListener('visibilitychange', onVisChange);
      window.addEventListener('blur', onBlur);
      cleanup.push(() => {
        document.removeEventListener('visibilitychange', onVisChange);
        window.removeEventListener('blur', onBlur);
      });
    }

    // 3. Copy-paste & keyboard shortcuts
    if (config?.blokir_copy_paste || config?.kunci_browser) {
      const BLOCKED_KEYS = ['c','v','x','a','s','p','u'];
      const onKeyDown = (e) => {
        const key = e.key.toLowerCase();
        if (e.ctrlKey || e.metaKey) {
          if (BLOCKED_KEYS.includes(key)) {
            e.preventDefault();
            const isCopyPaste = ['c','v','x'].includes(key);
            reportViolation(
              isCopyPaste ? 'copy_paste' : 'keyboard_forbidden',
              `Shortcut terlarang: Ctrl+${e.key.toUpperCase()}`,
              isCopyPaste ? 'tinggi' : 'sedang'
            );
          }
        }
        if (e.key === 'PrintScreen') { e.preventDefault(); reportViolation('screenshot', 'Mencoba screenshot', 'kritis'); }
        if (e.key === 'F12') { e.preventDefault(); reportViolation('dev_tools', 'Membuka Developer Tools', 'kritis'); }
        if (e.key === 'F11' || e.key === 'Escape') e.preventDefault();
      };
      const onCtxMenu = (e) => { e.preventDefault(); reportViolation('klik_kanan', 'Mencoba klik kanan', 'rendah'); };
      const onCopy  = (e) => { e.preventDefault(); reportViolation('copy_paste', 'Mencoba menyalin teks', 'tinggi'); };
      const onPaste = (e) => { e.preventDefault(); reportViolation('copy_paste', 'Mencoba menempel teks', 'tinggi'); };
      const onCut   = (e) => { e.preventDefault(); reportViolation('copy_paste', 'Mencoba memotong teks', 'tinggi'); };

      document.addEventListener('keydown', onKeyDown, true);
      document.addEventListener('contextmenu', onCtxMenu);
      document.addEventListener('copy', onCopy);
      document.addEventListener('paste', onPaste);
      document.addEventListener('cut', onCut);
      cleanup.push(() => {
        document.removeEventListener('keydown', onKeyDown, true);
        document.removeEventListener('contextmenu', onCtxMenu);
        document.removeEventListener('copy', onCopy);
        document.removeEventListener('paste', onPaste);
        document.removeEventListener('cut', onCut);
      });
    }

    // 4. Resize window
    const onResize = () => {
      if (window.innerWidth < window.screen.width * 0.9 || window.innerHeight < window.screen.height * 0.9)
        reportViolation('resize_window', 'Window browser diperkecil', 'sedang');
    };
    window.addEventListener('resize', onResize);
    cleanup.push(() => window.removeEventListener('resize', onResize));

    // 5. DevTools detection
    const devToolsTimer = setInterval(() => {
      if (window.outerWidth - window.innerWidth > 200 || window.outerHeight - window.innerHeight > 200)
        reportViolation('dev_tools', 'Kemungkinan Developer Tools terbuka', 'kritis');
    }, 3000);
    cleanup.push(() => clearInterval(devToolsTimer));

    return () => {
      isActive.current = false;
      cleanup.forEach(fn => fn());
    };
  }, [enabled, config, reportViolation]);

  return { violationCount: violationCount.current };
}
