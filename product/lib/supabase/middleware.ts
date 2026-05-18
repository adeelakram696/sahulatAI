import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieItem = { name: string; value: string; options?: CookieOptions };

const PROTECTED_PREFIXES = ['/chat', '/bookings', '/booking', '/profile', '/onboarding'];
const ONBOARDING_GATED = ['/chat', '/bookings'];
const PROVIDER_PROTECTED = ['/provider/dashboard', '/provider/settings', '/provider/onboarding'];
const AUTH_PAGES = ['/auth/signin', '/auth/signup', '/auth/forgot'];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(items: CookieItem[]) {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Protected routes
  if (!user && PROTECTED_PREFIXES.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/signin';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  // Authenticated user on auth pages → bounce to chat (or onboarding)
  if (user && AUTH_PAGES.includes(path)) {
    const url = request.nextUrl.clone();
    url.pathname = '/chat';
    return NextResponse.redirect(url);
  }

  // Location gate for /chat and /bookings
  if (user && ONBOARDING_GATED.some((p) => path.startsWith(p))) {
    const { count } = await supabase
      .from('user_locations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if ((count ?? 0) === 0) {
      const url = request.nextUrl.clone();
      url.pathname = '/onboarding/location';
      return NextResponse.redirect(url);
    }
  }

  return response;
}
