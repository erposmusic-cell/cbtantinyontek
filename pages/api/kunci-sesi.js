// pages/api/kunci-sesi.js
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { sesiId, alasan } = JSON.parse(req.body);
    if (!sesiId) return res.status(400).end();
    await supabaseAdmin.from('sesi_ujian').update({
      status: 'dikunci',
      alasan_kunci: alasan || 'Siswa keluar dari browser',
      dikunci_pada: new Date().toISOString(),
    }).eq('id', sesiId).eq('status', 'berlangsung');
    res.status(200).end();
  } catch { res.status(500).end(); }
}
