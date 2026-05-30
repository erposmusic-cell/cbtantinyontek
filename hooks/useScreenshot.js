/**
 * useScreenshot — ambil screenshot layar siswa di awal dan akhir ujian.
 * Jauh lebih ringan dari screen recording: hanya 2 file gambar per sesi.
 *
 * Cara kerja:
 *  1. takeScreenshot() → capture layar via getDisplayMedia → ambil 1 frame → stop stream
 *  2. Upload ke Supabase Storage bucket "screenshot-ujian"
 *  3. Simpan referensi ke tabel rekaman_ujian
 *
 * Catatan:
 *  - getDisplayMedia() WAJIB dari user gesture (klik tombol "Mulai Ujian")
 *  - Hanya 1 popup izin di awal, screenshot akhir pakai stream yang sama
 */

import { useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useScreenshot({ sesiId, siswaId, ujianId, enabled = true }) {
  const streamRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | requesting | ready | saving | done | error

  // Minta izin screen capture — dipanggil saat awal ujian (masih dalam user gesture)
  const requestPermission = useCallback(async () => {
    if (!enabled) return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setStatus('unsupported');
      return;
    }
    try {
      setStatus('requesting');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always', displaySurface: 'monitor' },
        audio: false,
      });
      streamRef.current = stream;
      setStatus('ready');

      // Ambil screenshot awal otomatis setelah izin diberikan
      await captureAndUpload(stream, 'awal', sesiId, siswaId, ujianId);
    } catch (err) {
      // User tolak izin — tidak blokir ujian
      setStatus('idle');
    }
  }, [enabled, sesiId, siswaId, ujianId]);

  // Ambil screenshot akhir — dipanggil saat submit
  const takeScreenshotAkhir = useCallback(async () => {
    if (!enabled) return;
    const stream = streamRef.current;
    if (!stream || !stream.active) return;
    try {
      setStatus('saving');
      await captureAndUpload(stream, 'akhir', sesiId, siswaId, ujianId);
      // Stop stream setelah screenshot akhir
      stream.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setStatus('done');
    } catch (err) {
      console.warn('[useScreenshot] Screenshot akhir gagal:', err);
      setStatus('done');
    }
  }, [enabled, sesiId, siswaId, ujianId]);

  // Screenshot saat pelanggaran — dipanggil dari handleViolation
  const takeScreenshotViolation = useCallback(async (tipe = 'pelanggaran') => {
    if (!enabled) return;
    const stream = streamRef.current;
    if (!stream || !stream.active) return;
    try {
      const fname = `ss_${tipe}_${sesiId || 'unknown'}_${Date.now()}.jpg`;
      const path  = `${ujianId}/${siswaId}/${fname}`;
      let blob;
      if (typeof ImageCapture !== 'undefined') {
        const track = stream.getVideoTracks()[0];
        if (!track) return;
        const imageCapture = new ImageCapture(track);
        blob = await imageCapture.takePhoto();
      } else {
        blob = await captureViaCanvas(stream);
      }
      if (!blob) return;
      await supabase.storage
        .from('screenshot-ujian')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      await supabase.from('rekaman_ujian').insert({
        sesi_id:     sesiId,
        siswa_id:    siswaId,
        ujian_id:    ujianId,
        file_path:   path,
        durasi_detik: 0,
        ukuran_byte: blob.size,
        dibuat_pada: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[useScreenshot] Screenshot pelanggaran gagal:', err);
    }
  }, [enabled, sesiId, siswaId, ujianId]);

  return { status, requestPermission, takeScreenshotAkhir, takeScreenshotViolation };
}

// ── Helper: capture 1 frame dari stream dan upload ──────────────────────────
async function captureAndUpload(stream, waktu, sesiId, siswaId, ujianId) {
  const track = stream.getVideoTracks()[0];
  if (!track) return;

  // Capture frame via ImageCapture API
  let blob;
  if (typeof ImageCapture !== 'undefined') {
    const imageCapture = new ImageCapture(track);
    blob = await imageCapture.takePhoto();
  } else {
    // Fallback: pakai video element + canvas
    blob = await captureViaCanvas(stream);
  }

  if (!blob) return;

  const fname = `ss_${waktu}_${sesiId || 'unknown'}_${Date.now()}.jpg`;
  const path  = `${ujianId}/${siswaId}/${fname}`;

  // Upload ke storage
  const { error: uploadErr } = await supabase.storage
    .from('screenshot-ujian')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

  if (uploadErr) {
    console.warn('[useScreenshot] Upload gagal:', uploadErr);
    return;
  }

  // Simpan referensi ke rekaman_ujian
  await supabase.from('rekaman_ujian').insert({
    sesi_id:      sesiId,
    siswa_id:     siswaId,
    ujian_id:     ujianId,
    file_path:    path,
    durasi_detik: 0,
    ukuran_byte:  blob.size,
    dibuat_pada:  new Date().toISOString(),
  });
}

async function captureViaCanvas(stream) {
  return new Promise(resolve => {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      video.play();
      const canvas = document.createElement('canvas');
      canvas.width  = video.videoWidth  || 1280;
      canvas.height = video.videoHeight || 720;
      canvas.getContext('2d').drawImage(video, 0, 0);
      canvas.toBlob(resolve, 'image/jpeg', 0.8);
      video.pause();
    };
  });
}
