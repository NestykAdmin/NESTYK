'use client';

import React from 'react';
import { useLocale } from '@nestyk/i18n';
import {
  buildPublicRoomSpecs,
  formatPublicAvailability,
  formatPublicPrice,
  getPublicAvailability,
  SAMPLE_PUBLIC_ROOMS,
} from '@nestyk/feature-listing/public';
import { GuestLanguageMenu } from '../../../components/guest/GuestLanguageMenu';
import { GuestHeader } from '../../../components/guest/GuestHeader';
import { GuestFooter } from '../../../components/guest/GuestFooter';
import { GuestTabBar } from '../../../components/guest/GuestTabBar';

const TODAY = new Date().toISOString().slice(0, 10);

/** Developer check (S2.7): language menu, copy and formatters on sample rooms, and the guest frame pieces of v2.3. */
export function UiKitLanguageCheck() {
  const { locale, t } = useLocale();
  const copy = t.guest;
  const specLabels = { bedroom: copy.spec.bedroom, bathroom: copy.spec.bathroom, area: copy.spec.area };

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, marginRight: 'auto', fontSize: 24, color: '#211E1E' }}>/dev/ui-kit · {locale}</h1>
        <GuestLanguageMenu />
      </header>

      <section>
        <h2 style={{ fontSize: 20, color: '#211E1E' }}>{copy.hero.title}</h2>
        <p style={{ color: '#475569' }}>{copy.hero.subtitle}</p>
        <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.values(copy.quick).map((label) => (
            <span key={label} style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: '4px 12px' }}>{label}</span>
          ))}
        </p>
      </section>

      <section data-testid="uiKit.sampleRooms" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {SAMPLE_PUBLIC_ROOMS.slice(0, 6).map((room) => (
          <article key={room.id} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, padding: 16 }}>
            <p style={{ margin: 0 }}>
              <strong style={{ fontFamily: 'var(--font-baloo2)', fontSize: 24, color: '#211E1E' }}>{formatPublicPrice(room.priceFrom)}</strong>{' '}
              <span style={{ color: '#475569', fontSize: 13 }}>{copy.card.perMonth}</span>
            </p>
            <h3 style={{ margin: '4px 0', fontSize: 15 }}>{room.title}</h3>
            <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>{buildPublicRoomSpecs(room, specLabels).join(' · ')}</p>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#475569' }}>
              {formatPublicAvailability(getPublicAvailability(room.availableFrom, TODAY), copy.availability, locale)}
            </p>
          </article>
        ))}
      </section>

      <section data-testid="uiKit.guestFrame" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#211E1E' }}>Guest frame v2.3 (header, footer; tab bar at 960px and below)</h2>
        <div style={{ border: '1px dashed #CBD5E1', borderRadius: 16, overflow: 'hidden' }}>
          <GuestHeader />
        </div>
        <div style={{ borderRadius: 16, overflow: 'hidden' }}>
          <GuestFooter locale={locale} />
        </div>
        <GuestTabBar />
      </section>
    </main>
  );
}
