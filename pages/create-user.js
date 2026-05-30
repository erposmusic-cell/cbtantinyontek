// pages/api/create-user.js
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password, profile } = req.body;

  if (!email || !password || !profile) {
    return res.status(400).json({ error: 'Email, password, dan profile wajib diisi' });
  }

  try {
    // Buat user di Supabase Auth tanpa kirim email konfirmasi
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nama_lengkap: profile.nama_lengkap,
        username: profile.username,
        role: profile.role,
      },
    });

    if (authErr) throw authErr;

    // Simpan profile ke tabel profiles
    const { error: profErr } = await supabaseAdmin.from('profiles').upsert({
      id: authData.user.id,
      ...profile,
      nomor_induk: profile.nomor_induk || null,
      kelas: profile.kelas || null,
    });

    if (profErr) throw profErr;

    return res.status(200).json({ user: authData.user });
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Terjadi kesalahan' });
  }
}
