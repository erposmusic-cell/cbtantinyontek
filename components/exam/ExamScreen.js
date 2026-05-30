import { useState, useEffect, useRef, useCallback } from 'react';
import { useAntiCheat } from '../../hooks/useAntiCheat';
import { useFaceRecognition } from '../../hooks/useFaceRecognition';
import { useScreenRecorder } from '../../hooks/useScreenRecorder';
import { supabase } from '../../lib/supabase';

// ── Timer ────────────────────────────────────────────────────
function ExamTimer({ durasiMenit, onTimeout }) {
  const [timeLeft, setTimeLeft] = useState(durasiMenit * 60);

  // FIX BUG #2: Tambahkan onTimeout ke dependency array agar tidak stale closure.
  // Gunakan useRef untuk onTimeout supaya tidak restart interval setiap render.
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(interval); onTimeoutRef.current(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durasiMenit]); // restart hanya jika durasi berubah

  const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const secs = (timeLeft % 60).toString().padStart(2, '0');
  const isDanger  = timeLeft <= 60;
  const isWarning = timeLeft <= 300 && !isDanger;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono font-extrabold text-base text-white
      ${isDanger ? 'bg-red-600 animate-pulse' : isWarning ? 'bg-amber-500' : 'bg-blue-600'}`}>
      ⏱ {mins}:{secs}
    </div>
  );
}

// ── Watermark ────────────────────────────────────────────────
function Watermark({ nama }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-[9998] overflow-hidden">
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="watermark-text" style={{
          top:  `${(i * 13) % 100}%`,
          left: `${(i * 17) % 80}%`,
        }}>
          {nama} • RAHASIA •
        </div>
      ))}
    </div>
  );
}

// ── Soal PG ──────────────────────────────────────────────────
function SoalPG({ soal, jawaban, onJawab }) {
  return (
    <div className="space-y-2.5">
      {soal.pilihan.map(p => (
        <div
          key={p.id}
          onClick={() => onJawab(p.id)}
          className={`flex items-start gap-3 p-3.5 rounded-lg border-2 cursor-pointer transition-all
            ${jawaban === p.id
              ? 'border-blue-500 bg-blue-900/30 text-blue-200'
              : 'border-slate-600 bg-slate-900/60 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
            }`}
        >
          <span className={`min-w-[24px] h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0
            ${jawaban === p.id ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-300'}`}>
            {p.label}
          </span>
          <span className="flex-1 text-sm leading-relaxed">{p.teks}</span>
        </div>
      ))}
    </div>
  );
}

// ── Soal MCMA ────────────────────────────────────────────────
function SoalMCMA({ soal, jawaban = [], onJawab }) {
  const toggle = (id) => {
    const curr = jawaban || [];
    const next = curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id];
    onJawab(next);
  };
  return (
    <div>
      <div className="text-xs text-blue-300 bg-blue-900/30 border border-blue-700 rounded-lg px-3 py-2 mb-3">
        📌 Pilih SEMUA jawaban yang benar (bisa lebih dari satu)
      </div>
      <div className="space-y-2.5">
        {soal.pilihan.map(p => {
          const sel = (jawaban || []).includes(p.id);
          return (
            <div
              key={p.id}
              onClick={() => toggle(p.id)}
              className={`flex items-start gap-3 p-3.5 rounded-lg border-2 cursor-pointer transition-all
                ${sel
                  ? 'border-blue-500 bg-blue-900/30 text-blue-200'
                  : 'border-slate-600 bg-slate-900/60 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
                }`}
            >
              <span className={`min-w-[24px] h-6 rounded flex items-center justify-center text-xs font-bold shrink-0
                ${sel ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-300'}`}>
                {p.label}
              </span>
              <span className="flex-1 text-sm">{p.teks}</span>
              {sel && <span className="text-blue-400">☑</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Soal Benar/Salah ─────────────────────────────────────────
function SoalBS({ soal, jawaban = [], onJawab }) {
  const set = (idx, val) => {
    const curr = [...(jawaban || [null,null,null,null,null])];
    curr[idx] = val;
    onJawab(curr);
  };
  return (
    <div>
      <div className="text-xs text-blue-300 bg-blue-900/30 border border-blue-700 rounded-lg px-3 py-2 mb-3">
        📋 Tentukan BENAR atau SALAH untuk setiap pernyataan
      </div>
      <div className="space-y-2">
        {soal.pilihan.slice(0, 5).map((p, i) => {
          const val = jawaban?.[i];
          return (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-600 bg-slate-900/60 text-slate-300">
              <span className="text-xs font-bold text-blue-400 w-7 shrink-0">{p.label}</span>
              <span className="flex-1 text-sm">{p.teks}</span>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => set(i, true)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors
                    ${val === true ? 'bg-green-600 text-white' : 'border border-slate-500 text-slate-400 hover:border-green-500'}`}>
                  BENAR
                </button>
                <button
                  onClick={() => set(i, false)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors
                    ${val === false ? 'bg-red-600 text-white' : 'border border-slate-500 text-slate-400 hover:border-red-500'}`}>
                  SALAH
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Soal Essay ───────────────────────────────────────────────
function SoalEssay({ jawaban, onJawab }) {
  return (
    <div>
      <div className="text-xs text-blue-300 bg-blue-900/30 border border-blue-700 rounded-lg px-3 py-2 mb-3">
        ✍️ Tulis jawaban Anda dengan lengkap dan jelas
      </div>
      <textarea
        className="w-full bg-slate-900/60 border-2 border-slate-600 focus:border-blue-500 rounded-lg
                   text-slate-100 p-3.5 text-sm leading-relaxed resize-y min-h-[160px] outline-none transition-colors"
        value={jawaban || ''}
        onChange={e => onJawab(e.target.value)}
        placeholder="Tulis jawaban Anda di sini..."
        rows={8}
      />
      <div className="text-right text-xs text-slate-500 mt-1">{(jawaban || '').length} karakter</div>
    </div>
  );
}

// ── Main ExamScreen ───────────────────────────────────────────
export default function ExamScreen({ ujian, soalList, siswa, sesiId, onFinish }) {
  const [currentIdx, setCurrentIdx]         = useState(0);
  const [jawaban, setJawaban]               = useState({});
  const [flagged, setFlagged]               = useState(new Set());
  const [violations, setViolations]         = useState([]);
  const [violationAlert, setViolationAlert] = useState(null);
  const [locked, setLocked]                 = useState(false);
  const [lockReason, setLockReason]         = useState('');
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting]               = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // ── Screenshot inline ──
  const ssStreamRef = useRef(null);

  useEffect(() => {
    if (!ujian.rekam_aktivitas) return;
    navigator.mediaDevices?.getDisplayMedia?.({ video: true, audio: false })
      .then(stream => { ssStreamRef.current = stream; })
      .catch(() => {});
    return () => ssStreamRef.current?.getTracks().forEach(t => t.stop());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const captureScreen = useCallback(async (label = 'pelanggaran') => {
    const stream = ssStreamRef.current;
    if (!stream || !stream.active) return;
    try {
      const video = document.createElement('video');
      video.srcObject = stream;
      await new Promise(res => { video.onloadedmetadata = () => { video.play(); res(); }; });
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      canvas.getContext('2d').drawImage(video, 0, 0);
      video.pause();
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const path = `${ujian.id}/${siswa.id}/ss_${label}_${Date.now()}.jpg`;
        await supabase.storage.from('screenshot-ujian').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
        await supabase.from('rekaman_ujian').insert({
          sesi_id: sesiId, siswa_id: siswa.id, ujian_id: ujian.id,
          file_path: path, durasi_detik: 0, ukuran_byte: blob.size,
          dibuat_pada: new Date().toISOString(),
        });
      }, 'image/jpeg', 0.75);
    } catch (e) { console.warn('[SS Layar]', e); }
  }, [ujian.id, siswa.id, sesiId]);

  const captureWajah = useCallback(async (label = 'wajah') => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      canvas.getContext('2d').drawImage(video, 0, 0);
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const path = `${ujian.id}/${siswa.id}/wajah_${label}_${Date.now()}.jpg`;
        await supabase.storage.from('screenshot-ujian').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
        await supabase.from('rekaman_ujian').insert({
          sesi_id: sesiId, siswa_id: siswa.id, ujian_id: ujian.id,
          file_path: path, durasi_detik: 0, ukuran_byte: blob.size,
          dibuat_pada: new Date().toISOString(),
        });
      }, 'image/jpeg', 0.75);
    } catch (e) { console.warn('[SS Wajah]', e); }
  }, [ujian.id, siswa.id, sesiId]);

  const handleViolation = useCallback((v) => {
    setViolations(prev => [...prev, v]);
    setViolationAlert(v);
    setTimeout(() => setViolationAlert(null), 4000);
    if (ujian.rekam_aktivitas) captureScreen(v.tipe || 'pelanggaran');
    if (ujian.deteksi_wajah && v.tipe?.toLowerCase().includes('wajah')) captureWajah(v.tipe);
  }, [captureScreen, captureWajah, ujian.rekam_aktivitas, ujian.deteksi_wajah]);

  const handleLock = useCallback((reason) => {
    setLocked(true);
    setLockReason(reason);
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  useAntiCheat({
    enabled: !locked,
    config: ujian,
    sesiId,
    siswaId: siswa.id,
    ujianId: ujian.id,
    onViolation: handleViolation,
    onLock: handleLock,
  });

  // ── Kamera + Face Recognition ──
  useEffect(() => {
    if (!ujian.deteksi_wajah) return;
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      }).catch(() => {});
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, [ujian.deteksi_wajah]);

  useFaceRecognition({
    videoRef,
    enabled: !!ujian.deteksi_wajah && !locked,
    intervalMs: 4000,
    onViolation: (tipe, deskripsi, tingkat) => handleViolation({ tipe, deskripsi, tingkat }),
  });

  // ── Screen Recorder ──
  const screenRecorder = useScreenRecorder({
    sesiId,
    siswaId: siswa.id,
    ujianId: ujian.id,
    enabled: !!ujian.rekam_aktivitas,
  });

  // FIX BUG #3: getDisplayMedia() WAJIB dipanggil dari user gesture (klik tombol).
  // Memanggil startRecording() via setTimeout tidak akan berhasil di browser modern
  // karena dianggap bukan gesture langsung. Recorder hanya diaktifkan saat user klik
  // tombol "Mulai Ujian" yang sudah terhubung ke startRecording di bawah.
  // useEffect ini dihapus agar tidak otomatis jalan di background.
  // (startRecording dipanggil manual dari tombol di halaman ujian siswa)

  const soal = soalList[currentIdx];
  const totalSoal = soalList.length;
  const answered  = Object.keys(jawaban).length;
  const unanswered = totalSoal - answered;

  // Guard: soalList kosong — tidak ada soal untuk ditampilkan
  if (!soal) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-[9999] flex flex-col items-center justify-center text-white text-center p-10">
        <div className="text-7xl mb-5">📭</div>
        <h1 className="text-2xl font-extrabold mb-3">Tidak Ada Soal</h1>
        <p className="text-slate-400 text-sm max-w-sm">Ujian ini belum memiliki soal. Hubungi pengawas ujian.</p>
        <button
          onClick={() => onFinish({ jawaban: {}, violations, totalSoal: 0, answered: 0, unanswered: 0 })}
          className="mt-8 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-colors"
        >
          Kembali
        </button>
      </div>
    );
  }

  const setJawabanSoal = (val) => setJawaban(prev => ({ ...prev, [soal.id]: val }));
  const toggleFlag = () => {
    setFlagged(prev => {
      const next = new Set(prev);
      next.has(soal.id) ? next.delete(soal.id) : next.add(soal.id);
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    streamRef.current?.getTracks().forEach(t => t.stop());
    await captureScreen('akhir');
    ssStreamRef.current?.getTracks().forEach(t => t.stop());
    screenRecorder?.stopRecording?.();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {}
    // onFinish sekarang async — tunggu sampai DB selesai sebelum pindah halaman
    await onFinish({ jawaban, violations, totalSoal, answered, unanswered });
  };

  // ── Locked Screen ─────────────────────────────────────────
  if (locked) {
    return (
      <div className="fixed inset-0 bg-red-600/95 z-[99999] flex flex-col items-center justify-center text-white text-center p-10">
        <div className="text-7xl mb-5">🔒</div>
        <h1 className="text-3xl font-extrabold mb-3">Ujian Dikunci</h1>
        <p className="text-lg opacity-90 max-w-md leading-relaxed">{lockReason}</p>
        <div className="mt-6 bg-white/20 rounded-xl px-8 py-4 text-5xl font-extrabold">{violations.length}</div>
        <p className="mt-2 opacity-80 text-sm">Total Pelanggaran</p>
        <p className="mt-6 text-sm opacity-70">Hubungi pengawas ujian untuk bantuan.</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900 z-[9999] flex flex-col overflow-hidden">
      {ujian.watermark_nama && <Watermark nama={siswa.nama_lengkap} />}

      {/* Violation Alert */}
      {violationAlert && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[99999]
                        bg-red-600 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
                        flex items-center gap-2 animate-fade-in">
          ⚠️ {violationAlert.deskripsi}
          <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
            {violations.length}/{ujian.batas_pelanggaran}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-5 py-3 flex items-center justify-between shrink-0">
        <div>
          <div className="text-slate-100 font-bold text-sm">🎓 {ujian.judul}</div>
          <div className="text-slate-400 text-xs mt-0.5">{siswa.nama_lengkap} • {siswa.kelas || ''}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-lg">
            Dijawab: <strong className="text-green-400">{answered}</strong>/{totalSoal}
          </div>
          {violations.length > 0 && (
            <div className="bg-red-900/60 border border-red-700 text-red-300 text-xs px-3 py-1.5 rounded-lg">
              ⚠️ Pelanggaran: {violations.length}
            </div>
          )}
          {ujian.rekam_aktivitas && screenRecorder.status === 'recording' && (
            <div className="flex items-center gap-1.5 bg-red-900/40 border border-red-700 text-red-300 text-xs px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              REC
            </div>
          )}
  );
}
