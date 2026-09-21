import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { DEMO_DESTINATIONS, getDemoDestination } from '@/lib/auth/demo-destinations';

/**
 * Demo login — signs in as a preset test user, sets the session cookie,
 * and redirects straight to the dashboard. No signup flow, no onboarding.
 *
 * The four named demo accounts are the controlled development/test identities.
 * They are real Supabase users with role-gated workspaces, not anonymous fixtures.
 */

const DEMO_USERS: Record<string, {
  email: string;
  password: string;
  redirect: string;
}> = {
  student: {
    email: 'student01@syncsenta.dev',
    password: 'Demo@Student01',
    redirect: DEMO_DESTINATIONS.student,
  },
  teacher: {
    email: 'teacher01@syncsenta.dev',
    password: 'Demo@Teacher01',
    redirect: DEMO_DESTINATIONS.teacher,
  },
  head: {
    email: 'head01@syncsenta.dev',
    password: 'Demo@Head01',
    redirect: DEMO_DESTINATIONS.head,
  },
  parent: {
    email: 'parent01@syncsenta.dev',
    password: 'Demo@Parent01',
    redirect: DEMO_DESTINATIONS.parent,
  },
};

function safeOrigin(request: NextRequest): string {
  const host = request.headers.get('host') ?? 'localhost:3000';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  // Support GET so a plain <a href> works too
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}

async function handler(request: NextRequest) {
  // Role comes from query string (?role=student) or POST body
  let role = request.nextUrl.searchParams.get('role') ?? '';
  if (!role && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    role = body.role ?? '';
  }
  role = role.toLowerCase();

  const destination = getDemoDestination(role);
  const demo = DEMO_USERS[role];
  if (!demo || !destination) {
    return NextResponse.redirect(new URL('/login?error=unsupported_demo_role', safeOrigin(request)));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL('/auth/signin?error=not_configured', safeOrigin(request)));
  }

  // Build a response we can write cookies onto
  const redirectUrl = new URL(destination, safeOrigin(request));

  // Demo mode intentionally clears the previous browser grade in the student
  // dashboard, forcing the same grade-first onboarding used by real students.
  redirectUrl.searchParams.set('demo', '1');

  const response = NextResponse.redirect(redirectUrl);

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.signInWithPassword({
    email: demo.email,
    password: demo.password,
  });

  if (error) {
    console.error('[demo-login] failed:', error.message);
    return NextResponse.redirect(
      new URL(`/auth/signin?error=demo_failed&role=${role}`, safeOrigin(request))
    );
  }

  return response;
}
