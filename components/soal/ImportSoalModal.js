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
                  href="/template-soal.xlsx"
                  download
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
                  href="/template-soal.docx"
                  download
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  onClick={(e) => {
                    e.preventDefault();

                    // Helper XML paragraf Word
                    const esc = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
                    const p = (text, opts = {}) => {
                      const bold = opts.bold ? '<w:b/>' : '';
                      const font = opts.mono ? '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>' : '';
                      return `<w:p><w:r><w:rPr>${bold}${font}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
                    };

                    const body = [
                      p('TEMPLATE SOAL - FORMAT WORD', { bold: true }),
                      p('Gunakan format di bawah ini untuk mengimpor soal.'),
                      p(''),
                      p('FORMAT PILIHAN GANDA', { bold: true }),
                      p('1. Contoh soal pilihan ganda di sini?', { mono: true }),
                      p('A. Jawaban A', { mono: true }),
                      p('B. Jawaban B', { mono: true }),
                      p('C. Jawaban C', { mono: true }),
                      p('D. Jawaban D', { mono: true }),
                      p('Jawaban: A', { mono: true }),
                      p(''),
                      p('FORMAT MCMA (Pilih Semua yang Benar)', { bold: true }),
                      p('2. Contoh soal MCMA, pilih semua yang benar?', { mono: true }),
                      p('A. Opsi pertama', { mono: true }),
                      p('B. Opsi kedua', { mono: true }),
                      p('C. Opsi ketiga', { mono: true }),
                      p('D. Opsi keempat', { mono: true }),
                      p('Kunci: A,C', { mono: true }),
                      p(''),
                      p('FORMAT ESSAY', { bold: true }),
                      p('3. Jelaskan pengertian dari konsep berikut ini!', { mono: true }),
                      p('(Essay tidak perlu kunci jawaban)'),
                      p(''),
                      p('FORMAT BENAR/SALAH', { bold: true }),
                      p('4. Tentukan Benar atau Salah pernyataan berikut!', { mono: true }),
                      p('A. Pernyataan pertama', { mono: true }),
                      p('B. Pernyataan kedua', { mono: true }),
                      p('C. Pernyataan ketiga', { mono: true }),
                      p('D. Pernyataan keempat', { mono: true }),
                      p('Jawaban: BENAR,SALAH,BENAR,SALAH', { mono: true }),
                      p(''),
                      p('CATATAN PENTING', { bold: true }),
                      p('- Nomor soal diawali angka + titik: "1."'),
                      p('- Pilihan diawali huruf + titik atau kurung: "A." atau "A)"'),
                      p('- Kunci jawaban: "Jawaban: A" atau "Kunci: A,C" untuk MCMA'),
                    ].join('');

                    const files = {
                      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
                      '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
                      'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`,
                      'word/_rels/document.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>',
                    };

                    // Buat ZIP murni (tanpa library) — DOCX adalah file ZIP
                    const enc = new TextEncoder();
                    const le2 = (n) => [n & 0xFF, (n >> 8) & 0xFF];
                    const le4 = (n) => [n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >> 24) & 0xFF];
                    const crc32 = (data) => {
                      const t = Array.from({ length: 256 }, (_, i) => {
                        let c = i;
                        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
                        return c;
                      });
                      let crc = 0xFFFFFFFF;
                      for (const b of data) crc = t[(crc ^ b) & 0xFF] ^ (crc >>> 8);
                      return (crc ^ 0xFFFFFFFF) >>> 0;
                    };

                    const locals = [], cds = [];
                    let offset = 0;
                    for (const [name, content] of Object.entries(files)) {
                      const nb = enc.encode(name);
                      const db = enc.encode(content);
                      const crc = crc32(db);
                      const sz = db.length;
                      const lh = new Uint8Array([
                        0x50,0x4B,0x03,0x04,0x14,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
                        ...le4(crc),...le4(sz),...le4(sz),...le2(nb.length),0x00,0x00,...nb,
                      ]);
                      cds.push({ nb, crc, sz, offset });
                      locals.push(lh, db);
                      offset += lh.length + db.length;
                    }
                    const cdStart = offset;
                    const cdParts = [];
                    for (const { nb, crc, sz, offset: fo } of cds) {
                      const cd = new Uint8Array([
                        0x50,0x4B,0x01,0x02,0x14,0x00,0x14,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
                        ...le4(crc),...le4(sz),...le4(sz),...le2(nb.length),
                        0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,...le4(fo),...nb,
                      ]);
                      cdParts.push(cd);
                      offset += cd.length;
                    }
                    const cdSize = offset - cdStart;
                    const eocd = new Uint8Array([
                      0x50,0x4B,0x05,0x06,0x00,0x00,0x00,0x00,
                      ...le2(cds.length),...le2(cds.length),...le4(cdSize),...le4(cdStart),0x00,0x00,
                    ]);
                    const all = [...locals, ...cdParts, eocd];
                    const total = all.reduce((s, a) => s + a.length, 0);
                    const zip = new Uint8Array(total);
                    let pos = 0;
                    for (const a of all) { zip.set(a, pos); pos += a.length; }

                    const blob = new Blob([zip], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
                    const url = URL.createObjectURL(blob);
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
