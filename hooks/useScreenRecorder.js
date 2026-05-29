/**
 * useScreenRecorder — rekam layar siswa selama ujian menggunakan
 * MediaRecorder API + getDisplayMedia (screen capture).
 *
 * Rekaman disimpan ke:
 *  1. Supabase Storage bucket "rekaman-ujian" (jika sesiId tersedia)
 *  2. Atau di-download otomatis sebagai file .webm
 *
 * Catatan:
 *  - getDisplayMedia() WAJIB dipanggil dari user gesture (klik tombol).
 *    Oleh karena itu hook ini expose `startRecording()` yang harus
 *    dipanggil saat siswa klik tombol "Mulai Ujian".
 *  - Browser yang didukung: Chrome, Edge, Firefox (bukan Safari).
 *  - Di mobile tidak didukung (akan gracefully fail).
 */

import { useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const MIME_TYPES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4',
];

function getSupportedMime() {
  return MIME_TYPES.find(m => MediaRecorder.isTypeSupported?.(m)) || 'video/webm';
}

export function useScreenRecorder({ sesiId, siswaId, ujianId, enabled = true }) {
  const mediaRecorderRef = useRef(null);
  const streamRef        = useRef(null);
  const chunksRef        = useRef([]);

  const [status, setStatus]   = useState('idle');  // idle | requesting | recording | saving | done | error | unsupported
  const [error,  setError]    = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);    // URL preview rekaman

  const isSupported = typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getDisplayMedia
    && typeof MediaRecorder !== 'undefined';

  // ── Mulai Rekaman ──────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!enabled)      return;
    if (!isSupported) { setStatus('unsupported'); return; }

    setError(null);
    setStatus('requesting');

    try {
      // Minta izin screen share dari user (WAJIB dari gesture)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always', displaySurface: 'monitor' },
        audio: false,
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = getSupportedMime();
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        setStatus('saving');
        const blob  = new Blob(chunksRef.current, { type: mimeType });
        const ext   = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const fname = `rekaman_${sesiId || 'unknown'}_${Date.now()}.${ext}`;

        // Buat preview URL
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);

        // Upload ke Supabase jika sesiId ada
        if (sesiId && siswaId && ujianId) {
          try {
            const path = `${ujianId}/${siswaId}/${fname}`;
            await supabase.storage
              .from('rekaman-ujian')
              .upload(path, blob, { contentType: mimeType, upsert: true });

            // Simpan referensi ke database
            await supabase.from('rekaman_ujian').insert({
              sesi_id:   sesiId,
              siswa_id:  siswaId,
              ujian_id:  ujianId,
              file_path: path,
              durasi_detik: Math.floor(blob.size / 50000), // estimasi kasar
              ukuran_byte:  blob.size,
              dibuat_pada:  new Date().toISOString(),
            });

            setStatus('done');
          } catch (uploadErr) {
            // Jika upload gagal, download lokal sebagai fallback
            console.warn('[useScreenRecorder] Upload gagal, download lokal:', uploadErr);
            downloadBlob(blob, fname);
            setStatus('done');
          }
        } else {
          // Tidak ada sesiId → download langsung
          downloadBlob(blob, fname);
          setStatus('done');
        }

        // Stop semua track
        stream.getTracks().forEach(t => t.stop());
      };

      // Event: user menghentikan share dari browser (klik "Stop sharing")
      stream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(10_000); // simpan chunk tiap 10 detik
      setStatus('recording');

    } catch (err) {
      if (err.name === 'NotAllowedError') {
        // User menolak izin — ini opsional, tidak blokir ujian
        setStatus('idle');
      } else {
        setError(err.message);
        setStatus('error');
      }
    }
  }, [enabled, isSupported, sesiId, siswaId, ujianId]);

  // ── Stop Rekaman ───────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  return {
    isSupported,
    status,         // 'idle'|'requesting'|'recording'|'saving'|'done'|'error'|'unsupported'
    error,
    blobUrl,        // URL blob untuk preview
    startRecording,
    stopRecording,
  };
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href  = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
