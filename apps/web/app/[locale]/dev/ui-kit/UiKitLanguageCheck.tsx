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
import { RoomCard } from '../../../components/guest/RoomCard';
import { AreaCard } from '../../../components/guest/AreaCard';
import { CardSkeleton, EmptyState, ErrorState } from '../../../components/guest/GuestStates';
import { ListingTabs } from '../../../components/guest/ListingTabs';
import { PropertyTypeTiles } from '../../../components/guest/PropertyTypeTiles';
import { SearchPanel } from '../../../components/guest/SearchPanel';

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

      <section data-testid="uiKit.s3" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#211E1E' }}>S3 pieces (sample rooms: one without a headline, one with a photo)</h2>
        <div style={{ background: '#211E1E', padding: 16, borderRadius: 16 }}>
          <SearchPanel />
        </div>
        <PropertyTypeTiles copy={copy} locale={locale} variant="tiles" />
        <ListingTabs
          label={copy.home.featuredTitle}
          testId="uiKit.tabs"
          tabs={[
            {
              id: 'cards',
              label: copy.home.tabRecommended,
              panel: (
                <div className="nk-room-grid">
                  {[
                    { ...SAMPLE_PUBLIC_ROOMS[0], isNew: true, coverImageUrl: '/icon.png' },
                    { ...SAMPLE_PUBLIC_ROOMS[1], title: null },
                    { ...SAMPLE_PUBLIC_ROOMS[2], title: null, projectName: null },
                  ].map((room) => (
                    <RoomCard key={room.id} card={room} copy={copy} locale={locale} today={TODAY} />
                  ))}
                  <CardSkeleton />
                </div>
              ),
            },
            { id: 'empty', label: copy.home.tabNew, panel: <EmptyState title={copy.home.listingsEmpty} /> },
          ]}
        />
        <div className="nk-area-grid">
          <AreaCard
            area={{ slug: 'sukhumvit-asok', name: 'สุขุมวิท อโศก', transitLines: ['bts_sukhumvit', 'mrt_blue'], roomCount: 12, priceFrom: 9000, coverImageUrl: null }}
            copy={copy}
            locale={locale}
          />
          <AreaCard
            area={{ slug: 'unknown-area', name: 'ชื่อสำรองจาก API', transitLines: [], roomCount: 1, priceFrom: null, coverImageUrl: null }}
            copy={copy}
            locale={locale}
          />
        </div>
        <ErrorState title={copy.states.errorTitle} body={copy.states.errorBody} retry={{ label: copy.states.retry, href: '#' }} />
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
