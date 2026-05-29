/**
 * notifikasiOrangTua — kirim notifikasi via WhatsApp (Fonnte) atau SMS (Twilio)
 *
 * PROVIDER YANG DIDUKUNG:
 *  - fonnte    : WhatsApp via fonnte.com (populer di Indonesia, murah)
 *  - twilio    : SMS/WhatsApp via twilio.com
 *  - wablas    : WhatsApp via wablas.com
 *  - wa_manual : Buat link wa.me untuk dibuka manual (tanpa API key)
 *
 * Setup di .env.local:
 *   NEXT_PUBLIC_WA_PROVIDER=fonnte       (atau twilio / wablas / wa_manual)
 *   FONNTE_TOKEN=xxxxxx
 *   TWILIO_SID=ACxxxx
 *   TWILIO_AUTH=xxxx
 *   TWILIO_FROM=+1415xxxxxxx
 *   WABLAS_TOKEN=xxxx
 *   WABLAS_DOMAIN=https://xxx.wablas.com
 */

// ── Template pesan ──────────────────────────────────────────

export function buildPesanHasilUjian({ namaSekolah, namaSiswa, namaUjian, nilai, passingGrade, jumlahPelanggaran, namaGuru }) {
  const lulus = nilai >= passingGrade;
  const status = lulus ? '✅ LULUS' : '❌ TIDAK LULUS';
  const emoji  = lulus ? '🎉' : '📢';

  return `${emoji} *HASIL UJIAN - ${namaSekolah}*

Yth. Orang Tua/Wali dari *${namaSiswa}*,

Berikut hasil ujian putra/putri Anda:

📝 *Mata Ujian:* ${namaUjian}
🎯 *Nilai:* ${nilai} / 100
📊 *Status:* ${status}
🔢 *Nilai Minimum Lulus:* ${passingGrade}
${jumlahPelanggaran > 0 ? `⚠️ *Pelanggaran:* ${jumlahPelanggaran} kali\n` : ''}
👨‍🏫 *Guru:* ${namaGuru}
📅 *Tanggal:* ${new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}

${lulus
  ? 'Selamat! Putra/putri Anda telah berhasil melewati ujian ini. 👏'
  : 'Putra/putri Anda perlu belajar lebih giat untuk mencapai nilai minimum lulus.'}

_Pesan ini dikirim otomatis oleh sistem CBT._`;
}

export function buildPesanPelanggaran({ namaSekolah, namaSiswa, namaUjian, tipePelanggaran, jumlahPelanggaran, batasPelanggaran }) {
  return `⚠️ *PERINGATAN UJIAN - ${namaSekolah}*

Yth. Orang Tua/Wali dari *${namaSiswa}*,

Saat ini putra/putri Anda sedang mengerjakan ujian *${namaUjian}* dan terdeteksi pelanggaran:

🚨 *Jenis:* ${tipePelanggaran}
🔢 *Jumlah:* ${jumlahPelanggaran} dari batas ${batasPelanggaran}

Mohon untuk tidak menghubungi peserta ujian selama ujian berlangsung.

_Pesan ini dikirim otomatis oleh sistem CBT._`;
}

// ── Fonnte (WhatsApp Indonesia) ─────────────────────────────

async function kirimFonnte({ token, nomorHP, pesan }) {
  // Normalkan nomor: hilangkan +, 0 di depan → 62
  const nomor = nomorHP.replace(/\D/g, '').replace(/^0/, '62');

  const res = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ target: nomor, message: pesan, countryCode: '62' }),
  });
  const data = await res.json();
  if (!data.status) throw new Error(data.reason || 'Fonnte gagal mengirim');
  return { provider: 'fonnte', messageId: data.id };
}

// ── Wablas ──────────────────────────────────────────────────

async function kirimWablas({ token, domain, nomorHP, pesan }) {
  const nomor = nomorHP.replace(/\D/g, '').replace(/^0/, '62');

  const res = await fetch(`${domain}/api/send-message`, {
    method: 'POST',
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phone: nomor, message: pesan }),
  });
  const data = await res.json();
  if (data.status !== true) throw new Error(data.message || 'Wablas gagal');
  return { provider: 'wablas', messageId: data.data?.id };
}

// ── WhatsApp Manual Link (tanpa API key) ────────────────────

function buatLinkWA(nomorHP, pesan) {
  const nomor = nomorHP.replace(/\D/g, '').replace(/^0/, '62');
  const text  = encodeURIComponent(pesan);
  return `https://wa.me/${nomor}?text=${text}`;
}

// ── Main Kirim ───────────────────────────────────────────────

/**
 * @param {Object} opts
 * @param {string} opts.nomorHP       — nomor HP orang tua (format bebas)
 * @param {string} opts.pesan         — isi pesan
 * @param {string} [opts.provider]    — 'fonnte'|'wablas'|'wa_manual' (default: env var)
 * @returns {{ success, provider, messageId?, link?, error? }}
 */
export async function kirimNotifikasi({ nomorHP, pesan, provider }) {
  const prov = provider
    || (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_WA_PROVIDER)
    || 'wa_manual';

  try {
    if (prov === 'fonnte') {
      const token = process.env.FONNTE_TOKEN;
      if (!token) throw new Error('FONNTE_TOKEN tidak diset di .env.local');
      const result = await kirimFonnte({ token, nomorHP, pesan });
      return { success: true, ...result };
    }

    if (prov === 'wablas') {
      const token  = process.env.WABLAS_TOKEN;
      const domain = process.env.WABLAS_DOMAIN || 'https://solo.wablas.com';
      if (!token) throw new Error('WABLAS_TOKEN tidak diset di .env.local');
      const result = await kirimWablas({ token, domain, nomorHP, pesan });
      return { success: true, ...result };
    }

    // Default: link manual (selalu berhasil, dibuka user secara manual)
    const link = buatLinkWA(nomorHP, pesan);
    return { success: true, provider: 'wa_manual', link };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Kirim notifikasi massal ke daftar siswa.
 * @param {Array} siswaList — [{ nama, nomorHPOrtu, nilai, ... }]
 * @param {Object} ujianInfo
 * @returns {Array} hasil per siswa
 */
export async function kirimNotifikasiBulk(siswaList, ujianInfo) {
  const results = [];
  for (const siswa of siswaList) {
    if (!siswa.nomorHPOrtu) {
      results.push({ nama: siswa.nama, success: false, error: 'Nomor tidak tersedia' });
      continue;
    }
    const pesan = buildPesanHasilUjian({
      namaSekolah:       ujianInfo.namaSekolah,
      namaSiswa:         siswa.nama,
      namaUjian:         ujianInfo.namaUjian,
      nilai:             siswa.nilai,
      passingGrade:      ujianInfo.passingGrade,
      jumlahPelanggaran: siswa.jumlahPelanggaran || 0,
      namaGuru:          ujianInfo.namaGuru,
    });
    const result = await kirimNotifikasi({ nomorHP: siswa.nomorHPOrtu, pesan });
    results.push({ nama: siswa.nama, nomorHP: siswa.nomorHPOrtu, ...result });

    // Rate limit: tunggu 500ms antar pesan agar tidak kena blokir
    await new Promise(r => setTimeout(r, 500));
  }
  return results;
}
