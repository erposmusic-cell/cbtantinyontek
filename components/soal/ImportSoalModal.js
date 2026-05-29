/**
 * ImportSoalModal — modal untuk upload & preview soal dari Word/Excel
 * Props:
 *   open        : boolean
 *   onClose     : () => void
 *   onImport    : (soalList) => void   // dipanggil saat user klik "Simpan ke Bank Soal"
 *   mataPelajaranId : string
 */
import { useRef, useState } from 'react';
import { useImportSoal } from '../../hooks/useImportSoal';

const TIPE_LABEL = {
  pilihan_ganda: 'PG',
  mcma: 'MCMA',
  benar_salah: 'B/S',
  essay: 'Essay',
};

const TIPE_COLOR = {
  pilihan_ganda: 'bg-blue-100 text-blue-700',
  mcma: 'bg-purple-100 text-purple-700',
  benar_salah: 'bg-amber-100 text-amber-700',
  essay: 'bg-green-100 text-green-700',
};

export default function ImportSoalModal({ open, onClose, onImport }) {
  const inputRef = useRef();
  const { importFile, importing, preview, error, fileName, clearPreview } = useImportSoal();
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(preview.map(s => s._tempId)));
  const clearAll  = () => setSelected(new Set());

  const handleSave = async () => {
    const toSave = preview.filter(s => selected.has(s._tempId));
    if (!toSave.length) return;
    setSaving(true);
    await onImport?.(toSave);
    setSaving(false);
    clearPreview();
    setSelected(new Set());
    onClose?.();
  };

  const handleClose = () => {
    clearPreview();
    setSelected(new Set());
    onClose?.();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">📥 Import Soal</h2>
            <p className="text-xs text-gray-500 mt-0.5">Upload file Word (.docx) atau Excel (.xlsx/.csv)</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Upload Zone */}
          {preview.length === 0 && (
            <div>
              {/* Template download */}
              <div className="flex gap-3 mb-5">
                <a
                  href="#"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  onClick={(e) => {
                    e.preventDefault();
                    // Buat template Excel sederhana menggunakan CSV
                    const csv = `tipe_soal,pertanyaan,pilihan_a,pilihan_b,pilihan_c,pilihan_d,kunci_jawaban,bobot,tingkat_kesulitan\npilihan_ganda,Contoh soal pilihan ganda?,Jawaban A,Jawaban B,Jawaban C,Jawaban D,A,1,mudah\nmcma,Pilih semua yang benar?,Opsi 1,Opsi 2,Opsi 3,Opsi 4,"A,C",2,sedang\nbenar_salah,Pernyataan 1-5?,Pernyataan 1,Pernyataan 2,Pernyataan 3,Pernyataan 4,"BENAR,SALAH,BENAR,BENAR,SALAH",1,mudah\nessay,Jelaskan pengertian...,,,,,,3,sulit`;
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = 'template-soal.csv'; a.click();
                  }}
                >
                  📄 Download Template CSV
                </a>
                <a
                  href="#"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  onClick={async (e) => {
                    e.preventDefault();
                    // Load docx library dari CDN
                    if (!window.docx) {
                      await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/docx/8.5.0/docx.umd.min.js';
                        script.onload = resolve;
                        script.onerror = () => reject(new Error('Gagal memuat docx library'));
                        document.head.appendChild(script);
                      });
                    }
                    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = window.docx;

                    const bold = (text) => new TextRun({ text, bold: true });
                    const normal = (text) => new TextRun({ text });
                    const mono = (text) => new TextRun({ text, font: 'Courier New' });

                    const doc = new Document({
                      sections: [{
                        children: [
                          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [bold('Template Soal - Format Word')] }),
                          new Paragraph({ children: [normal('Gunakan format di bawah ini untuk mengimpor soal. Setiap soal diawali dengan nomor urut.')] }),
                          new Paragraph({}),

                          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [bold('Format Pilihan Ganda')] }),
                          new Paragraph({ children: [mono('1. Contoh soal pilihan ganda di sini?')] }),
                          new Paragraph({ children: [mono('A. Jawaban A')] }),
                          new Paragraph({ children: [mono('B. Jawaban B')] }),
                          new Paragraph({ children: [mono('C. Jawaban C')] }),
                          new Paragraph({ children: [mono('D. Jawaban D')] }),
                          new Paragraph({ children: [mono('Jawaban: A')] }),
                          new Paragraph({}),

                          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [bold('Format MCMA (Pilih Semua yang Benar)')] }),
                          new Paragraph({ children: [mono('2. Contoh soal MCMA, pilih semua yang benar?')] }),
                          new Paragraph({ children: [mono('A. Opsi pertama')] }),
                          new Paragraph({ children: [mono('B. Opsi kedua')] }),
                          new Paragraph({ children: [mono('C. Opsi ketiga')] }),
                          new Paragraph({ children: [mono('D. Opsi keempat')] }),
                          new Paragraph({ children: [mono('Kunci: A,C')] }),
                          new Paragraph({}),

                          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [bold('Format Essay')] }),
                          new Paragraph({ children: [mono('3. Jelaskan pengertian dari konsep berikut ini!')] }),
                          new Paragraph({ children: [normal('(Essay tidak perlu kunci jawaban)')] }),
                          new Paragraph({}),

                          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [bold('Format Benar/Salah')] }),
                          new Paragraph({ children: [mono('4. Tentukan Benar atau Salah pernyataan berikut!')] }),
                          new Paragraph({ children: [mono('A. Pernyataan pertama')] }),
                          new Paragraph({ children: [mono('B. Pernyataan kedua')] }),
                          new Paragraph({ children: [mono('C. Pernyataan ketiga')] }),
                          new Paragraph({ children: [mono('D. Pernyataan keempat')] }),
                          new Paragraph({ children: [mono('Jawaban: BENAR,SALAH,BENAR,SALAH')] }),
                          new Paragraph({}),

                          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [bold('Catatan Penting')] }),
                          new Paragraph({ children: [normal('- Nomor soal diawali angka diikuti titik: "1."')] }),
                          new Paragraph({ children: [normal('- Pilihan diawali huruf + titik atau kurung: "A." atau "A)"')] }),
                          new Paragraph({ children: [normal('- Kunci jawaban: "Jawaban: A" atau "Kunci: A,C" (untuk MCMA)')] }),
                        ],
                      }],
                    });

                    const buffer = await Packer.toBlob(doc);
                    const url = URL.createObjectURL(buffer);
                    const a = document.createElement('a'); a.href = url; a.download = 'template-soal.docx'; a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  📝 Download Template Word
                </a>
              </div>

              {/* Drop zone */}
              <div
                className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                onClick={() => inputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); importFile(e.dataTransfer.files[0]); }}
              >
                {importing ? (
                  <div className="flex flex-col items-center gap-3 text-blue-600">
                    <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                    <p className="font-semibold">Memproses {fileName}...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <div className="text-6xl">📂</div>
                    <p className="font-semibold text-gray-600">Klik atau drag & drop file di sini</p>
                    <p className="text-sm">Mendukung: <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.csv</strong>, <strong>.docx</strong>, <strong>.txt</strong></p>
                  </div>
                )}
              </div>
              <input ref={inputRef} type="file" className="hidden"
                accept=".xlsx,.xls,.csv,.docx,.doc,.txt"
                onChange={e => importFile(e.target.files[0])} />

              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
                  ❌ {error}
                </div>
              )}

              {/* Panduan format */}
              <div className="mt-6 bg-gray-50 rounded-xl p-4 text-xs text-gray-600 space-y-2">
                <p className="font-bold text-gray-700">📋 Panduan Format Excel</p>
                <p>Kolom: <code className="bg-gray-200 px-1 rounded">tipe_soal | pertanyaan | pilihan_a | pilihan_b | pilihan_c | pilihan_d | kunci_jawaban | bobot | tingkat_kesulitan</code></p>
                <p>Tipe soal: <code className="bg-gray-200 px-1 rounded">pilihan_ganda</code>, <code className="bg-gray-200 px-1 rounded">mcma</code>, <code className="bg-gray-200 px-1 rounded">benar_salah</code>, <code className="bg-gray-200 px-1 rounded">essay</code></p>
                <p className="font-bold text-gray-700 mt-3">📝 Panduan Format Word</p>
                <p>Nomor soal: <code className="bg-gray-200 px-1 rounded">1.</code> atau <code className="bg-gray-200 px-1 rounded">No 1</code></p>
                <p>Pilihan: <code className="bg-gray-200 px-1 rounded">A. teks</code> atau <code className="bg-gray-200 px-1 rounded">A) teks</code></p>
                <p>Kunci: <code className="bg-gray-200 px-1 rounded">Jawaban: A</code> atau <code className="bg-gray-200 px-1 rounded">Kunci: A,C</code></p>
              </div>
            </div>
          )}

          {/* Preview hasil parse */}
          {preview.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-bold text-gray-900">{fileName}</p>
                  <p className="text-sm text-gray-500">{preview.length} soal berhasil diparse</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg font-semibold">Pilih Semua</button>
                  <button onClick={clearAll}  className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg font-semibold">Batal Semua</button>
                  <button onClick={() => { clearPreview(); setSelected(new Set()); }} className="text-xs px-3 py-1.5 bg-red-100 text-red-600 rounded-lg font-semibold">Upload Ulang</button>
                </div>
              </div>

              <div className="space-y-3">
                {preview.map((soal, i) => {
                  const isSel = selected.has(soal._tempId);
                  return (
                    <div
                      key={soal._tempId}
                      onClick={() => toggleSelect(soal._tempId)}
                      className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${isSel ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 ${isSel ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                          {isSel && <span className="text-white text-xs">✓</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TIPE_COLOR[soal.tipe_soal] || 'bg-gray-100 text-gray-600'}`}>
                              {TIPE_LABEL[soal.tipe_soal] || soal.tipe_soal}
                            </span>
                            <span className="text-xs text-gray-400">Bobot: {soal.bobot}</span>
                            <span className="text-xs text-gray-400">• {soal.tingkat_kesulitan}</span>
                          </div>
                          <p className="text-sm text-gray-800 font-medium leading-snug">{soal.pertanyaan}</p>
                          {soal.pilihan.length > 0 && (
                            <div className="mt-2 grid grid-cols-2 gap-1">
                              {soal.pilihan.map(p => (
                                <div key={p.label} className={`text-xs px-2 py-1 rounded-lg flex gap-1.5
                                  ${soal.kunci_jawaban?.includes(p.label) ? 'bg-green-100 text-green-700 font-semibold' : 'bg-gray-100 text-gray-600'}`}>
                                  <span className="font-bold">{p.label}.</span>
                                  <span className="truncate">{p.teks}</span>
                                  {soal.kunci_jawaban?.includes(p.label) && <span className="ml-auto">✓</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {preview.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
            <p className="text-sm text-gray-600">
              <strong>{selected.size}</strong> dari {preview.length} soal dipilih
            </p>
            <div className="flex gap-3">
              <button onClick={handleClose} className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={selected.size === 0 || saving}
                className="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? <><div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin"/></> : null}
                💾 Simpan {selected.size > 0 ? `${selected.size} Soal` : ''} ke Bank Soal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
