import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// FIX: Jangan throw di module level — ini menyebabkan seluruh module chain gagal
// dan semua komponen menjadi undefined (React error #130)
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Supabase] Environment variable tidak ditemukan.\n' +
    'Buat file .env.local di root project dengan isi:\n' +
    'NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co\n' +
    'NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key'
  );
}

export const supabase = createClient(
  supabaseUrl  || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Admin client — hanya dipakai di server/API route (service role key)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseAdmin = createClient(
  supabaseUrl  || 'https://placeholder.supabase.co',
  supabaseServiceKey || supabaseAnonKey || 'placeholder-key',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Helper: get current user profile
export async function getCurrentProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile;
}

// Helper: sign out
export async function signOut() {
  await supabase.auth.signOut();
}
