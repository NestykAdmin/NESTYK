'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { LocaleProvider, useLocale } from '@nestyk/i18n';
import { NestykLogo } from '@nestyk/ui';
import { WebContentContainer } from '@nestyk/ui/web-content';
import { PublicRoomDesktopBody, type PublicRoomShare } from '@nestyk/feature-listing/desktop';
import './room-share.css';

const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
  'http://localhost:4000/api/v1';

export default function PublicRoomSharePage() {
  const params = useParams<{ token: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  return (
    <LocaleProvider defaultLocale="th">
      <PublicRoomShareContent key={token} token={token} />
    </LocaleProvider>
  );
}

function PublicRoomShareContent({ token }: { token: string }) {
  const { t, locale } = useLocale();
  const c = t.agent.roomDetail.publicShare;
  const [expiryPrefix, expirySuffix] = c.expiresAt.split('{date}');
  const [room, setRoom] = useState<PublicRoomShare | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API}/public/room-shares/${encodeURIComponent(token)}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!controller.signal.aborted) {
            setError(res.status === 410 ? c.expired : res.status === 404 ? c.notFound : c.loadFailed);
          }
          return;
        }
        if (!controller.signal.aborted) setRoom(body as PublicRoomShare);
      } catch {
        if (!controller.signal.aborted) {
          setError(c.loadFailed);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [token, attempt, c]);

  return (
      <main className="room-share-page">
        <meta name="robots" content="noindex, nofollow" />
        <header className="room-share-header">
          <WebContentContainer>
            <div className="room-share-header-content">
              <NestykLogo height={28} />
              <span>{t.agent.listings.details}</span>
            </div>
          </WebContentContainer>
        </header>
        {loading ? (
          <WebContentContainer>
            <div className="room-share-state" role="status">{c.loading}</div>
          </WebContentContainer>
        ) : error || !room ? (
          <WebContentContainer>
            <div className="room-share-state" role="alert">
              <h1>{c.invalidLink}</h1>
              <p>{error || c.notFound}</p>
              <button onClick={() => setAttempt(value => value + 1)}>{c.retry}</button>
            </div>
          </WebContentContainer>
        ) : (
          <>
            <PublicRoomDesktopBody room={room} mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY} />
            <WebContentContainer>
              <footer className="room-share-footer">
                {expiryPrefix}
                <time dateTime={room.expiresAt}>
                  {new Date(room.expiresAt).toLocaleString(locale === 'th' ? 'th-TH' : locale, {
                    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok',
                  })}
                </time>
                {expirySuffix}
              </footer>
            </WebContentContainer>
          </>
        )}
      </main>
  );
}
