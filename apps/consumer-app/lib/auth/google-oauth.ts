export type GoogleSession = { access_token: string; user: { id: string } };
export type OAuthProvider = 'google' | 'facebook';

type GoogleAuthClient = {
  auth: {
    signInWithOAuth(args: {
      provider: OAuthProvider;
      options: { redirectTo: string; skipBrowserRedirect: boolean };
    }): Promise<{ data: { url: string | null } | null; error: { message: string } | null }>;
    exchangeCodeForSession(code: string): Promise<{ data: { session: GoogleSession | null }; error: { message: string } | null }>;
    setSession(tokens: { access_token: string; refresh_token: string }): Promise<{ data: { session: GoogleSession | null }; error: { message: string } | null }>;
  };
};

/** True when the browser just came back from Supabase with an auth result. */
export function providerRedirectPending(href: string | null): boolean {
  if (!href) return false;
  const params = redirectParams(href);
  return Boolean(params.code || params.access_token || params.error || params.error_description);
}

export function redirectParams(url: string): Record<string, string> {
  const parsed = new URL(url);
  const out: Record<string, string> = {};
  parsed.searchParams.forEach((value, key) => {
    out[key] = value;
  });
  new URLSearchParams(parsed.hash.replace(/^#/, '')).forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/**
 * Starts Google or Facebook sign-in. Web leaves the page and returns null. Native returns the session,
 * or null when the person closes the browser. No password is created.
 */
export async function startGoogleOAuth(
  supabase: GoogleAuthClient,
  options: {
    platform: 'web' | 'native';
    redirectTo: string;
    provider?: OAuthProvider;
    openAuthSession: (url: string, redirectTo: string) => Promise<{ type: string; url?: string }>;
  },
): Promise<GoogleSession | null> {
  const provider = options.provider ?? 'google';
  const label = provider === 'facebook' ? 'Facebook' : 'Google';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: options.redirectTo, skipBrowserRedirect: options.platform !== 'web' },
  });
  if (error) throw new Error(error.message);
  if (options.platform === 'web') return null;
  if (!data?.url) throw new Error(`${label} sign-in did not start`);
  const result = await options.openAuthSession(data.url, options.redirectTo);
  if (result.type === 'cancel' || result.type === 'dismiss') return null;
  if (result.type !== 'success' || !result.url) throw new Error(`${label} sign-in did not finish`);
  return sessionFromCallback(supabase, result.url, label);
}

async function sessionFromCallback(supabase: GoogleAuthClient, url: string, label: string): Promise<GoogleSession> {
  const params = redirectParams(url);
  if (params.error || params.error_description) throw new Error(params.error_description || params.error);
  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error || !data.session) throw new Error(error?.message ?? `${label} sign-in did not finish`);
    return data.session;
  }
  if (params.access_token && params.refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error || !data.session) throw new Error(error?.message ?? `${label} sign-in did not finish`);
    return data.session;
  }
  throw new Error(`${label} sign-in did not finish`);
}
