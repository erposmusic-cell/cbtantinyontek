/**
 * useFaceRecognition — deteksi wajah real-time selama ujian
 *
 * Menggunakan face-api.js (CDN) yang berbasis TensorFlow.js.
 * Model ringan: TinyFaceDetector (~190KB).
 *
 * Apa yang dideteksi:
 *  - Tidak ada wajah → pelanggaran "tidak_ada_wajah"
 *  - Lebih dari 1 wajah → pelanggaran "wajah_ganda" (kemungkinan ada orang lain)
 *  - Wajah menoleh terlalu jauh ke samping (landmarks) → "menoleh"
 *
 * Props:
 *  videoRef       — ref ke <video> element
 *  enabled        — boolean, mulai deteksi hanya saat ujian aktif
 *  intervalMs     — seberapa sering cek (default 3000ms)
 *  onViolation    — callback(tipe, deskripsi, tingkat)
 */

import { useEffect, useRef, useCallback } from 'react';

const FACEAPI_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/face-api.js/0.22.2/face-api.min.js';
const MODELS_URL  = 'https://justadudewhohacks.github.io/face-api.js/models';

async function loadFaceAPI() {
  if (typeof window === 'undefined') return null;
  if (window.faceapi) return window.faceapi;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = FACEAPI_CDN;
    script.onload  = () => resolve(window.faceapi);
    script.onerror = () => reject(new Error('Gagal memuat face-api.js'));
    document.head.appendChild(script);
  });
}

let modelsLoaded = false;

async function ensureModels(faceapi) {
  if (modelsLoaded) return;
  // Load model ringan TinyFaceDetector + FaceLandmarks68
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL),
  ]);
  modelsLoaded = true;
}

export function useFaceRecognition({ videoRef, enabled, intervalMs = 3000, onViolation }) {
  const timerRef    = useRef(null);
  const faceapiRef  = useRef(null);
  const noFaceCount = useRef(0);   // berturut-turut tidak ada wajah
  const isReady     = useRef(false);

  const detect = useCallback(async () => {
    const faceapi = faceapiRef.current;
    const video   = videoRef?.current;
    if (!faceapi || !video || video.readyState < 2) return;

    try {
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4 }))
        .withFaceLandmarks(true);   // true = tiny model

      const count = detections.length;

      // ── Tidak ada wajah ──
      if (count === 0) {
        noFaceCount.current += 1;
        // Laporan hanya setelah 2x berturut-turut (6 detik) untuk menghindari false positive
        if (noFaceCount.current >= 2) {
          onViolation?.('tidak_ada_wajah', 'Wajah siswa tidak terdeteksi di kamera', 'tinggi');
          noFaceCount.current = 0;
        }
        return;
      }

      noFaceCount.current = 0;

      // ── Lebih dari 1 wajah ──
      if (count > 1) {
        onViolation?.('wajah_ganda', `Terdeteksi ${count} wajah dalam kamera`, 'kritis');
        return;
      }

      // ── Deteksi menoleh menggunakan landmarks ──
      const landmarks = detections[0].landmarks;
      const nose      = landmarks.getNose();
      const leftEye   = landmarks.getLeftEye();
      const rightEye  = landmarks.getRightEye();

      if (nose && leftEye && rightEye) {
        const noseTip    = nose[3];                  // titik ujung hidung
        const leftCenter = leftEye.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
        const rightCenter= rightEye.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });

        leftCenter.x  /= leftEye.length;
        rightCenter.x /= rightEye.length;

        const faceCenter = (leftCenter.x + rightCenter.x) / 2;
        const deviation  = Math.abs(noseTip.x - faceCenter) / video.videoWidth;

        // Jika hidung menyimpang > 15% dari lebar video → menoleh
        if (deviation > 0.15) {
          const arah = noseTip.x < faceCenter ? 'kiri' : 'kanan';
          onViolation?.('menoleh', `Siswa terdeteksi menoleh ke ${arah}`, 'sedang');
        }
      }
    } catch {
      // Ignore detection errors (frame busy, video not ready, etc.)
    }
  }, [videoRef, onViolation]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    (async () => {
      try {
        const faceapi = await loadFaceAPI();
        if (cancelled) return;
        await ensureModels(faceapi);
        if (cancelled) return;
        faceapiRef.current = faceapi;
        isReady.current    = true;
        timerRef.current   = setInterval(detect, intervalMs);
      } catch (err) {
        console.warn('[useFaceRecognition] Gagal inisialisasi:', err.message);
      }
    })();

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      isReady.current = false;
    };
  }, [enabled, intervalMs, detect]);

  return { isReady: isReady.current };
}
