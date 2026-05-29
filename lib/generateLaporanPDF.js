/**
 * generateLaporanPDF — buat laporan ujian PDF menggunakan jsPDF
 * Dipanggil dari halaman laporan admin/guru.
 *
 * Laporan mencakup:
 *  - Header sekolah + judul ujian
 *  - Ringkasan statistik (rata-rata, lulus/tidak, pelanggaran)
 *  - Tabel nilai per siswa
 *  - Grafik distribusi nilai (ASCII bar chart di PDF)
 *  - Daftar pelanggaran terbanyak
 */

async function loadJsPDF() {
  if (typeof window === 'undefined') return null;
  if (window.jspdf) return window.jspdf.jsPDF;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => resolve(window.jspdf.jsPDF);
    script.onerror = () => reject(new Error('Gagal memuat jsPDF'));
    document.head.appendChild(script);
  });
}

async function loadAutoTable() {
  if (typeof window === 'undefined') return;
  if (window._jspdfAutoTableLoaded) return;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
    script.onload  = () => { window._jspdfAutoTableLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('Gagal memuat autoTable'));
    document.head.appendChild(script);
  });
}

/**
 * @param {Object} opts
 * @param {string} opts.namaSekolah
 * @param {string} opts.namaUjian
 * @param {string} opts.mataPelajaran
 * @param {string} opts.tanggal          — string tanggal ujian
 * @param {number} opts.durasi           — menit
 * @param {number} opts.passingGrade
 * @param {Array}  opts.siswaList        — [{nama, kelas, nilai, jumlahPelanggaran, status: 'lulus'|'tidak_lulus'}]
 * @param {Array}  opts.pelanggaranList  — [{nama, tipe, jumlah}]
 * @param {string} opts.namaGuru
 */
export async function generateLaporanPDF(opts) {
  const JsPDF = await loadJsPDF();
  await loadAutoTable();

  const {
    namaSekolah    = 'Nama Sekolah',
    namaUjian      = 'Ujian',
    mataPelajaran  = '-',
    tanggal        = new Date().toLocaleDateString('id-ID'),
    durasi         = 0,
    passingGrade   = 70,
    siswaList      = [],
    pelanggaranList = [],
    namaGuru       = '-',
  } = opts;

  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const MARGIN = 15;

  // ── Warna tema ──
  const BLUE   = [37, 99, 235];
  const DARK   = [17, 24, 39];
  const GRAY   = [107, 114, 128];
  const GREEN  = [22, 163, 74];
  const RED    = [220, 38, 38];
  const LIGHT  = [243, 244, 246];

  // ── Header ──
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, W, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('LAPORAN HASIL UJIAN', W / 2, 13, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(namaSekolah, W / 2, 20, { align: 'center' });

  doc.setFontSize(9);
  doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, W / 2, 27, { align: 'center' });

  let y = 42;

  // ── Info Ujian ──
  doc.setTextColor(...DARK);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(namaUjian, MARGIN, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(`${mataPelajaran}  •  ${tanggal}  •  ${durasi} menit  •  Guru: ${namaGuru}`, MARGIN, y);
  y += 8;

  // ── Garis ──
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, W - MARGIN, y);
  y += 8;

  // ── Statistik ──
  const total    = siswaList.length;
  const lulus    = siswaList.filter(s => s.status === 'lulus').length;
  const tidakLulus = total - lulus;
  const nilaiArr = siswaList.map(s => s.nilai).filter(n => typeof n === 'number');
  const rata     = nilaiArr.length ? Math.round(nilaiArr.reduce((a, b) => a + b, 0) / nilaiArr.length) : 0;
  const tertinggi = nilaiArr.length ? Math.max(...nilaiArr) : 0;
  const terendah  = nilaiArr.length ? Math.min(...nilaiArr) : 0;
  const totalPelanggaran = siswaList.reduce((s, x) => s + (x.jumlahPelanggaran || 0), 0);

  const stats = [
    { label: 'Peserta',    value: total,    color: BLUE },
    { label: 'Lulus',      value: lulus,    color: GREEN },
    { label: 'Tidak Lulus',value: tidakLulus,color: RED },
    { label: 'Rata-rata',  value: rata,     color: BLUE },
    { label: 'Tertinggi',  value: tertinggi,color: GREEN },
    { label: 'Terendah',   value: terendah, color: RED },
  ];

  const boxW = (W - MARGIN * 2 - 10) / 3;
  const boxH = 18;
  stats.forEach((s, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const bx  = MARGIN + col * (boxW + 5);
    const by  = y + row * (boxH + 4);

    doc.setFillColor(...LIGHT);
    doc.roundedRect(bx, by, boxW, boxH, 2, 2, 'F');

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...s.color);
    doc.text(String(s.value), bx + boxW / 2, by + 11, { align: 'center' });

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(s.label, bx + boxW / 2, by + 16, { align: 'center' });
  });

  y += boxH * 2 + 12;

  // ── Tabel Nilai ──
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('Daftar Nilai Siswa', MARGIN, y);
  y += 5;

  const tableRows = siswaList.map((s, i) => [
    i + 1,
    s.nama || '-',
    s.kelas || '-',
    s.nilai ?? '-',
    s.jumlahPelanggaran ?? 0,
    s.status === 'lulus' ? 'LULUS' : 'TIDAK LULUS',
  ]);

  doc.autoTable({
    startY: y,
    head: [['No', 'Nama Siswa', 'Kelas', 'Nilai', 'Pelanggaran', 'Status']],
    body: tableRows,
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.column.index === 5 && data.section === 'body') {
        const val = data.cell.raw;
        data.cell.styles.textColor = val === 'LULUS' ? GREEN : RED;
      }
      if (data.column.index === 3 && data.section === 'body') {
        const val = parseFloat(data.cell.raw);
        if (!isNaN(val)) {
          data.cell.styles.textColor = val >= passingGrade ? GREEN : RED;
        }
      }
    },
  });

  y = doc.lastAutoTable.finalY + 10;

  // ── Distribusi Nilai ──
  if (y > 240) { doc.addPage(); y = 20; }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('Distribusi Nilai', MARGIN, y);
  y += 5;

  const ranges = [
    { label: '0–59',  min: 0,  max: 59 },
    { label: '60–69', min: 60, max: 69 },
    { label: '70–79', min: 70, max: 79 },
    { label: '80–89', min: 80, max: 89 },
    { label: '90–100',min: 90, max: 100 },
  ];

  const maxCount = Math.max(...ranges.map(r => nilaiArr.filter(n => n >= r.min && n <= r.max).length), 1);
  const barMaxW  = W - MARGIN * 2 - 40;

  ranges.forEach(r => {
    const count = nilaiArr.filter(n => n >= r.min && n <= r.max).length;
    const barW  = count > 0 ? Math.max((count / maxCount) * barMaxW, 4) : 0;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(r.label, MARGIN, y + 4);

    if (barW > 0) {
      doc.setFillColor(...(r.min >= passingGrade ? GREEN : RED));
      doc.roundedRect(MARGIN + 22, y, barW, 6, 1, 1, 'F');
    }

    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'bold');
    doc.text(String(count), MARGIN + 22 + barW + 3, y + 4.5);

    y += 10;
  });

  y += 5;

  // ── Pelanggaran Terbanyak ──
  if (pelanggaranList.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text('Pelanggaran Terbanyak', MARGIN, y);
    y += 5;

    doc.autoTable({
      startY: y,
      head: [['Nama Siswa', 'Tipe Pelanggaran', 'Jumlah']],
      body: pelanggaranList.slice(0, 10).map(p => [p.nama, p.tipe, p.jumlah]),
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: RED, textColor: 255 },
      alternateRowStyles: { fillColor: LIGHT },
    });

    y = doc.lastAutoTable.finalY + 10;
  }

  // ── Total Pelanggaran ──
  if (totalPelanggaran > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(`Total pelanggaran seluruh peserta: ${totalPelanggaran}`, MARGIN, y);
    y += 10;
  }

  // ── Tanda Tangan ──
  if (y > 250) { doc.addPage(); y = 20; }

  const ttdY = Math.max(y + 10, 255);
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`${tanggal}`, W - MARGIN - 50, ttdY, { align: 'center' });
  doc.text('Guru Pengawas,', W - MARGIN - 50, ttdY + 6, { align: 'center' });
  doc.text('_____________________', W - MARGIN - 50, ttdY + 26, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text(namaGuru, W - MARGIN - 50, ttdY + 32, { align: 'center' });

  // ── Footer tiap halaman ──
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Halaman ${p} dari ${pageCount}  •  ${namaSekolah}  •  Dicetak oleh CBT Anti-Nyontek`,
      W / 2, doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  // ── Save ──
  const safeName = namaUjian.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  doc.save(`Laporan_${safeName}_${tanggal.replace(/\//g, '-')}.pdf`);
}
