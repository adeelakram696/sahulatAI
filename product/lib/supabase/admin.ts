import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client. Bypasses RLS. Server-only.
 * Lazy — only instantiated on first use so build-time evaluation doesn't blow up.
 */
let _admin: SupabaseClient | null = null;

function getAdmin(): SupabaseClient {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }
    _admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}

// Proxy so callers can keep using `admin.from(...)` without changes.
export const admin = new Proxy({} as SupabaseClient, {
  get(_t, key: string) {
    return (getAdmin() as unknown as Record<string, unknown>)[key];
  },
});
