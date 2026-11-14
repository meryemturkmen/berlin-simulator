import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/** True when the public Supabase settings are present in this build. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Browser Supabase client (anon key only), or null when not configured. */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && anonKey ? createClient(url, anonKey) : null;
  return client;
}

let sessionPromise: Promise<{ userId: string; accessToken: string } | null> | null = null;

/**
 * Makes sure the player has a session, signing in anonymously on first use.
 * Resolves to null when Supabase is not configured or sign-in fails; callers
 * then fall back to local storage.
 */
export function ensureSession(
  supabase: SupabaseClient | null = getSupabase(),
): Promise<{ userId: string; accessToken: string } | null> {
  if (!supabase) return Promise.resolve(null);
  sessionPromise ??= (async () => {
    try {
      const existing = (await supabase.auth.getSession()).data.session;
      const session = existing ?? (await supabase.auth.signInAnonymously()).data.session;
      return session ? { userId: session.user.id, accessToken: session.access_token } : null;
    } catch {
      return null;
    }
  })();
  return sessionPromise;
}

/** Current access token for calls to our own API, refreshed by the client as needed. */
export async function accessToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase || !(await ensureSession(supabase))) return null;
  return (await supabase.auth.getSession()).data.session?.access_token ?? null;
}

/** Test hook: forget the cached client and session. */
export function resetSupabaseForTests() {
  client = undefined;
  sessionPromise = null;
}
