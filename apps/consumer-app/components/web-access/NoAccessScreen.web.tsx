import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import { MobileNestykLogo } from '@nestyk/ui/native';
import { useAuth } from '../../lib/auth/AuthContext';
import { supportMailto } from '../../lib/legal-footer';
import { loginHref, otherSiteRoles, postLoginHref, roleSiteHref } from '../../lib/web-routes';
import './no-access.css';

/**
 * /no-access (route-access design, 5 Nov 2026). Shown when a signed-in account has none of this portal's roles, e.g. a
 * tenant-only account on agent.nestyk.com. Signed out → sign-in page; the account gains a role → its page.
 */
export function NoAccessScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const { ready, session, isAuthenticated, signOut } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const copy = t.webSession;

  const target = !ready || leaving ? null : !isAuthenticated ? loginHref('/') : postLoginHref(null, session?.roles);
  const move = target && target !== '/no-access' ? target : null;

  useEffect(() => {
    if (move) router.replace(move as never);
  }, [move, router]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const before = document.title;
    document.title = `${copy.noAccessTitle} · NESTYK`;
    return () => {
      document.title = before; // the sign-in page does not set its own title
    };
  }, [copy.noAccessTitle]);

  if (!ready || move) return null;

  // Roles this account has on another NESTYK site (EXPO_PUBLIC_WEB_PORTAL_URLS): offered first.
  const elsewhere = otherSiteRoles(session?.roles).flatMap((role) => {
    const href = roleSiteHref(role);
    return href ? [{ role, href }] : [];
  });

  const switchAccount = async () => {
    setLeaving(true);
    await signOut();
    router.replace(loginHref('/') as never);
  };

  return (
    <main className="na-root" data-testid="noAccess">
      <section className="na-card" aria-labelledby="na-title">
        <MobileNestykLogo variant="wordmark" height={28} />
        <h1 id="na-title">{copy.noAccessTitle}</h1>
        <p className="na-body">{fillTemplate(copy.noAccessBody, { email: session?.email ?? '' })}</p>
        <p className="na-hint">{copy.noAccessHint}</p>
        <div className="na-actions">
          {elsewhere.map(({ role, href }) => (
            <a key={role} className="na-primary" href={href} data-testid={`noAccess.open.${role}`}>
              {fillTemplate(copy.noAccessOpenRole, { role: t.roles[role] })}
            </a>
          ))}
          <button
            type="button"
            className={elsewhere.length ? 'na-secondary' : 'na-primary'}
            onClick={switchAccount}
            disabled={leaving}
            data-testid="noAccess.switchAccount"
          >
            {copy.noAccessSignOut}
          </button>
          <a className="na-secondary" href="/" data-testid="noAccess.home">
            {copy.noAccessHome}
          </a>
        </div>
        <a className="na-support" href={supportMailto(copy.noAccessTitle)} data-testid="noAccess.support">
          {copy.noAccessSupport}
        </a>
      </section>
    </main>
  );
}
