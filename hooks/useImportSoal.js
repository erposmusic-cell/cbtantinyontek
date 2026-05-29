/**
 * useImportSoal — parse file Word (.docx) atau Excel (.xlsx/.csv)
 * menjadi array soal siap pakai di bank soal.
 *
 * FORMAT EXCEL (kolom):
 *   A: tipe_soal  (pilihan_ganda | mcma | benar_salah | essay)
 *   B: pertanyaan
 *   C: pilihan_a
 *   D: pilihan_b
 *   E: pilihan_c
 *   F: pilihan_d
 *   G: kunci_jawaban  (a/b/c/d atau a,c untuk mcma, atau benar/salah per koma)
 *   H: bobot          (angka, default 1)
 *   I: tingkat_kesulitan (mudah | sedang | sulit)
 *
 * FORMAT WORD (.docx):
 *   Setiap soal diawali nomor "1." atau "No 1"
 *   Pilihan diawali A. B. C. D.
 *   Kunci: "Jawaban: A" atau "Kunci: A,C"
 */

import { useState, useCallback } from 'react';

// ── Excel parser (pakai SheetJS via CDN script tag, atau fallback manual CSV) ──
async function loadSheetJS() {
  if (typeof window === 'undefined') return null;
  if (window.XLSX) return window.XLSX;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload  = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error('Gagal memuat SheetJS'));
    document.head.appendChild(script);
  });
}

// ── Mammoth (Word parser) via CDN ──
async function loadMammoth() {
  if (typeof window === 'undefined') return null;
  if (window.mammoth) return window.mammoth;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
    script.onload  = () => resolve(window.mammoth);
    script.onerror = () => reject(new Error('Gagal memuat Mammoth'));
    document.head.appendChild(script);
  });
}

// ── Parse satu baris Excel jadi objek soal ──
function rowToSoal(row, idx) {
  const tipe = (row[0] || 'pilihan_ganda').toString().trim().toLowerCase();
  const pertanyaan = (row[1] || '').toString().trim();
  if (!pertanyaan) return null;

  const pilihanRaw = [row[2], row[3], row[4], row[5]];
  const labels = ['A', 'B', 'C', 'D'];
  const pilihan = pilihanRaw
    .map((t, i) => ({ label: labels[i], teks: (t || '').toString().trim() }))
    .filter(p => p.teks);

  const kunci = (row[6] || '').toString().trim().toUpperCase();
  const bobot  = parseFloat(row[7]) || 1;
  const kesulitan = (row[8] || 'sedang').toString().trim().toLowerCase();

  return {
    _tempId: `import_${Date.now()}_${idx}`,
    tipe_soal: tipe,
    pertanyaan,
    pilihan,
    kunci_jawaban: kunci,
    bobot,
    tingkat_kesulitan: kesulitan,
  };
}

// ── Parse teks Word jadi array soal ──
function parseWordText(text) {
  const soalList = [];
  // Split per nomor soal: "1." atau "No 1" atau "Soal 1"
  const blocks = text.split(/(?=\n?\s*(?:No\.?\s*\d+|Soal\s+\d+|\d+[\.\)])\s)/i).filter(Boolean);

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    // Pertanyaan = baris pertama (hapus nomor di depan)
    const pertanyaanLine = lines[0].replace(/^(?:No\.?\s*\d+|Soal\s+\d+|\d+[\.\)])\s*/i, '').trim();
    if (!pertanyaanLine) continue;

    const pilihan = [];
    let kunci = '';

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Pilihan: "A. teks" atau "A) teks"
      const pMatch = line.match(/^([A-Ea-e])[\.\)]\s+(.+)/);
      if (pMatch) {
        pilihan.push({ label: pMatch[1].toUpperCase(), teks: pMatch[2].trim() });
        continue;
      }
      // Kunci: "Jawaban: A" atau "Kunci: A,C"
      const kMatch = line.match(/^(?:jawaban|kunci|answer)\s*[:\-]\s*(.+)/i);
      if (kMatch) {
        kunci = kMatch[1].trim().toUpperCase();
      }
    }

    soalList.push({
      _tempId: `import_word_${Date.now()}_${soalList.length}`,
      tipe_soal: pilihan.length === 0 ? 'essay' : 'pilihan_ganda',
      pertanyaan: pertanyaanLine,
      pilihan,
      kunci_jawaban: kunci,
      bobot: 1,
      tingkat_kesulitan: 'sedang',
    });
  }
  return soalList;
}

// ── Main Hook ──
export function useImportSoal() {
  const [importing, setImporting]   = useState(false);
  const [preview,   setPreview]     = useState([]);   // soal hasil parse
  const [error,     setError]       = useState(null);
  const [fileName,  setFileName]    = useState('');

  const importFile = useCallback(async (file) => {
    if (!file) return;
    setImporting(true);
    setError(null);
    setPreview([]);
    setFileName(file.name);

    try {
      const ext = file.name.split('.').pop().toLowerCase();

      // ── EXCEL / CSV ──
      if (['xlsx', 'xls', 'csv'].includes(ext)) {
        const XLSX = await loadSheetJS();
        const ab   = await file.arrayBuffer();
        // FIX: gunakan Uint8Array agar SheetJS bisa membaca ArrayBuffer dengan benar
        const data  = new Uint8Array(ab);
        const wb   = XLSX.read(data, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Skip header row jika baris pertama berisi teks "tipe_soal" atau "pertanyaan"
        const startRow = rows[0]?.[0]?.toString().toLowerCase().includes('tipe') ? 1 : 0;
        const soalList = rows.slice(startRow)
          .map((r, i) => rowToSoal(r, i))
          .filter(Boolean);

        setPreview(soalList);
      }

      // ── WORD ──
      else if (['docx', 'doc'].includes(ext)) {
        const mammoth = await loadMammoth();
        const ab = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: ab });
        const soalList = parseWordText(result.value);
        setPreview(soalList);
      }

      // ── TXT ──
      else if (ext === 'txt') {
        const text = await file.text();
        const soalList = parseWordText(text);
        setPreview(soalList);
      }

      else {
        throw new Error('Format tidak didukung. Gunakan .xlsx, .xls, .csv, .docx, atau .txt');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }, []);

  const clearPreview = useCallback(() => {
    setPreview([]);
    setFileName('');
    setError(null);
  }, []);

  return { importFile, importing, preview, error, fileName, clearPreview };
}
