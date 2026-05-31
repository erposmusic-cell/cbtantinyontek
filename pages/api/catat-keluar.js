// pages/api/catat-keluar.js
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { sesiId } = JSON.parse(req.body);
    if (!sesiId) return res.status(400).end();
    await supabaseAdmin.from('sesi_ujian').update({
      waktu_keluar: new Date().toISOString(),
    }).eq('id', sesiId).eq('status', 'berlangsung');
    res.status(200).end();
  } catch { res.status(500).end(); }
}
