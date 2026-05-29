import { useState, useEffect, useRef, useCallback } from 'react';
import { useAntiCheat } from '../../hooks/useAntiCheat';
import { useFaceRecognition } from '../../hooks/useFaceRecognition';
import { useScreenRecorder } from '../../hooks/useScreenRecorder';
import { supabase } from '../../lib/supabase';

// ── Timer ────────────────────────────────────────────────────
function ExamTimer({ durasiMenit, onTimeout }) {
  const [timeLeft, setTimeLeft] = useState(durasiMenit * 60);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(interval); onTimeout(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const handleViolation = useCallback((v) => {
    setViolations(prev => [...prev, v]);
    setViolationAlert(v);
    setTimeout(() => setViolationAlert(null), 4000);
  }, []);

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
    enabled: !!ujian.rekam_layar,
  });

  useEffect(() => {
    if (ujian.rekam_layar && screenRecorder.status === 'idle') {
      const t = setTimeout(() => screenRecorder.startRecording(), 1500);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line
  }, [ujian.rekam_layar]);

  const soal = soalList[currentIdx];
  const totalSoal = soalList.length;
  const answered  = Object.keys(jawaban).length;
  const unanswered = totalSoal - answered;

  const setJawabanSoal = (val) => setJawaban(prev => ({ ...prev, [soal.id]: val }));
  const toggleFlag = () => {
    setFlagged(prev => {
      const next = new Set(prev);
      next.has(soal.id) ? next.delete(soal.id) : next.add(soal.id);
      return next;
    });
  };

  const handleSubmit = async () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    screenRecorder?.stopRecording?.();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {}
    onFinish({ jawaban, violations, totalSoal, answered, unanswered });
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
          {ujian.rekam_layar && screenRecorder.status === 'recording' && (
            <div className="flex items-center gap-1.5 bg-red-900/40 border border-red-700 text-red-300 text-xs px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              REC
            </div>
          )}
          <ExamTimer durasiMenit={ujian.durasi_menit} onTimeout={handleSubmit} />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar navigasi soal */}
        <div className="w-48 bg-slate-800 border-r border-slate-700 p-4 overflow-y-auto shrink-0">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Navigasi Soal</p>
          <div className="grid grid-cols-4 gap-1.5">
            {soalList.map((s, i) => {
              let cls = 'w-8 h-8 rounded-lg text-xs font-bold cursor-pointer transition-all border-2 flex items-center justify-center ';
              if (i === currentIdx) cls += 'bg-blue-600 text-white border-blue-700';
              else if (flagged.has(s.id)) cls += 'bg-amber-500 text-white border-amber-600';
              else if (jawaban[s.id] !== undefined) cls += 'bg-green-600 text-white border-green-700';
              else cls += 'bg-slate-600 text-slate-300 border-slate-500';
              return (
                <button key={s.id} className={cls} onClick={() => setCurrentIdx(i)}>
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-5 space-y-1.5 text-xs text-slate-500">
            {[['bg-green-600','Sudah dijawab'],['bg-amber-500','Ditandai'],['bg-slate-600','Belum']].map(([bg, label]) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-sm ${bg}`} />
                {label}
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowSubmitConfirm(true)}
            className="w-full mt-6 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors"
          >
            ✔ Submit Ujian
          </button>
        </div>

        {/* Area soal */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-3xl mx-auto bg-slate-800 rounded-2xl p-7 border border-slate-700 animate-fade-in" key={soal.id}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                Soal {currentIdx + 1} dari {totalSoal}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded font-semibold
                ${soal.tingkat_kesulitan === 'sulit'  ? 'bg-red-900/50 text-red-300'    :
                  soal.tingkat_kesulitan === 'sedang' ? 'bg-amber-900/50 text-amber-300' :
                                                        'bg-green-900/50 text-green-300'}`}>
                {soal.tingkat_kesulitan || 'sedang'}
              </span>
              <span className="text-xs text-blue-400">Bobot: {soal.bobot}</span>
            </div>
            <p className="text-slate-100 text-base leading-relaxed mb-6">{soal.pertanyaan}</p>

            {soal.tipe_soal === 'pilihan_ganda' && <SoalPG soal={soal} jawaban={jawaban[soal.id]} onJawab={setJawabanSoal} />}
            {soal.tipe_soal === 'mcma'          && <SoalMCMA soal={soal} jawaban={jawaban[soal.id]} onJawab={setJawabanSoal} />}
            {soal.tipe_soal === 'benar_salah'   && <SoalBS soal={soal} jawaban={jawaban[soal.id]} onJawab={setJawabanSoal} />}
            {soal.tipe_soal === 'essay'         && <SoalEssay jawaban={jawaban[soal.id]} onJawab={setJawabanSoal} />}

            {/* Navigasi */}
            <div className="flex items-center justify-between mt-8 pt-5 border-t border-slate-700">
              <button
                onClick={() => currentIdx > 0 && setCurrentIdx(i => i - 1)}
                disabled={currentIdx === 0}
                className="px-4 py-2 bg-slate-700 text-slate-300 text-sm font-semibold rounded-lg
                           hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Sebelumnya
              </button>
              <button
                onClick={toggleFlag}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors
                  ${flagged.has(soal.id) ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
              >
                {flagged.has(soal.id) ? '🚩 Ditandai' : '🏳 Tandai'}
              </button>
              {currentIdx < totalSoal - 1 ? (
                <button
                  onClick={() => setCurrentIdx(i => i + 1)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Selanjutnya →
                </button>
              ) : (
                <button
                  onClick={() => setShowSubmitConfirm(true)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  ✔ Selesai
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Kamera */}
      {ujian.deteksi_wajah && (
        <div className="fixed bottom-4 right-4 w-36 h-28 rounded-xl overflow-hidden border-2 border-slate-600 z-[9990] bg-black">
          <video ref={videoRef} autoPlay muted className="w-full h-full object-cover scale-x-[-1]" />
          <div className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-green-400" />
        </div>
      )}

      {/* Modal Submit */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center p-5">
          <div className="bg-slate-800 border border-slate-600 rounded-2xl w-full max-w-sm shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <span className="text-slate-100 font-bold">Konfirmasi Submit</span>
              <button onClick={() => setShowSubmitConfirm(false)} className="text-slate-400 hover:text-slate-200 text-xl">✕</button>
            </div>
            <div className="p-6 text-slate-300">
              <div className="text-center mb-5">
                <div className="text-5xl mb-3">📋</div>
                <p className="text-sm">Yakin ingin mengumpulkan jawaban?</p>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-4 space-y-2 mb-4 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Sudah dijawab</span><span className="text-green-400 font-bold">{answered} soal</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Belum dijawab</span><span className={`font-bold ${unanswered > 0 ? 'text-red-400' : 'text-green-400'}`}>{unanswered} soal</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Ditandai</span><span className="text-amber-400 font-bold">{flagged.size} soal</span></div>
              </div>
              {unanswered > 0 && (
                <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-xs mb-3">
                  ⚠️ Masih ada {unanswered} soal yang belum dijawab!
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-700">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="px-4 py-2 bg-slate-700 text-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-600 transition-colors"
              >
                Kembali
              </button>
              <button
                onClick={() => { setShowSubmitConfirm(false); handleSubmit(); }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                ✔ Ya, Kumpulkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
