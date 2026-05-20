/**
 * Helpers for figuring out which "role" a user is operating as.
 *
 * A user is a *provider* if they own at least one row in `providers`. Users
 * can be both customer and provider — but we route them to the provider
 * dashboard by default after login (they can switch back via the user menu).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type UserRole = 'provider' | 'customer';

export async function getUserRole(supabase: SupabaseClient, userId: string): Promise<UserRole> {
  const { count } = await supabase
    .from('providers')
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', userId);
  return (count ?? 0) > 0 ? 'provider' : 'customer';
}

export async function getOwnedProvider(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('providers')
    .select('id, business_name, slug, photo_url, phone, categories, google_rating, google_rating_count, portal_rating, portal_rating_count, response_time_minutes, published, whatsapp_opt_in, sms_opt_in')
    .eq('owner_user_id', userId)
    .limit(1)
    .maybeSingle();
  return data;
}
