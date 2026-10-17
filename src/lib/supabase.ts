import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const supabaseConfigured = Boolean(url && key);

export const supabase = createClient(url || 'https://example.invalid', key || 'missing', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

export async function ensureGuestSession() {
  if (!supabaseConfigured) {
    return { ok: false as const, reason: 'missing_env' as const };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) return { ok: true as const, session: sessionData.session };

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.session) {
    return { ok: false as const, reason: 'anonymous_auth_unavailable' as const, error };
  }

  return { ok: true as const, session: data.session };
}
