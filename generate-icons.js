/**
 * generate-icons.js
 * Jalankan sekali: node generate-icons.js
 * Butuh: npm install sharp
 *
 * Letakkan file logo/ikon sumber di: public/icon-source.png (min 512x512)
 * Output: public/icons/icon-[size]x[size].png
 */

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const SOURCE = path.join(__dirname, 'public', 'icon-source.png');
const OUTDIR = path.join(__dirname, 'public', 'icons');
const SIZES  = [72, 96, 128, 144, 152, 192, 384, 512];

if (!fs.existsSync(SOURCE)) {
  console.error('❌  File sumber tidak ditemukan:', SOURCE);
  console.error('    Letakkan logo 512x512 px di public/icon-source.png');
  process.exit(1);
}

fs.mkdirSync(OUTDIR, { recursive: true });

(async () => {
  for (const size of SIZES) {
    const out = path.join(OUTDIR, `icon-${size}x${size}.png`);
    await sharp(SOURCE).resize(size, size).toFile(out);
    console.log(`✅  ${out}`);
  }
  console.log('\n🎉  Semua icon berhasil dibuat!');
})();
