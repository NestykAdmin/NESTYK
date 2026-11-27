import React from 'react';
import type { Metadata } from 'next';
import { getTranslations, type SupportedLocale } from '@nestyk/i18n';
import type { PublicAreaSummary } from '@nestyk/types';
import { AreaCard } from '../../../components/guest/AreaCard';
import { ZoneCard } from '../../../components/guest/ZoneCard';
import { EmptyState } from '../../../components/guest/GuestStates';
import { loadAreas } from '../../../../lib/guest-area-data';
import { splitByRegion } from '../../../../lib/guest-areas';
import { guestPageMetadata } from '../../../../lib/guest-seo';
import { localePath } from '../../../../lib/guest-site';
import '../../guest-areas.css';

type Props = { params: Promise<{ locale: string }> };

/** Kept for 5 minutes like the home page (AREA_DATA_REVALIDATE_SECONDS in lib/guest-area-data.ts). */
export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const copy = getTranslations(locale as SupportedLocale).guest.areaPage;
  return guestPageMetadata({ locale, path: '/areas', title: `${copy.listTitle} · NESTYK`, description: copy.listMeta });
}

/**
 * Area list /areas (SEO-1, canvas AreasListWeb / AreasListPhone, Mos 20 Nov 2026): Bangkok and nearby areas first,
 * then the province zones ("โซนต่างจังหวัด"). GET /public/areas lists only areas with rooms; an empty group is hidden.
 */
export default async function AreasPage({ params }: Props) {
  const { locale } = await params;
  const t = getTranslations(locale as SupportedLocale).guest;
  const copy = t.areaPage;
  let areas: PublicAreaSummary[];
  try {
    areas = await loadAreas();
  } catch (error) {
    // As the room page (review R2): throw, so a failed regeneration keeps the last good page; error.tsx shows the state.
    console.error('[guest areas] load failed:', error);
    throw new Error('Public areas API unavailable');
  }
  const { bangkok, province } = splitByRegion(areas);

  return (
    <div className="nk-al" data-testid="areasPage">
      <header className="nk-al-head">
        <h1 className="nk-al-title">{copy.listTitle}</h1>
        <p className="nk-section__subtitle">{copy.listSubtitle}</p>
      </header>
      {bangkok.length ? (
        <section className="nk-al-group" aria-labelledby="al-bangkok">
          <h2 id="al-bangkok" className="nk-al-group__title">
            {copy.groupBangkok}
          </h2>
          <div className="nk-al-grid">
            {bangkok.map((area) => (
              <AreaCard key={area.slug} area={area} copy={t} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}
      {province.length ? (
        <section className="nk-al-group" aria-labelledby="al-province">
          <div className="nk-section__head nk-section__head--stack">
            <h2 id="al-province" className="nk-al-group__title">
              {copy.groupProvince}
            </h2>
            <p className="nk-section__subtitle">{copy.provinceSubtitle}</p>
          </div>
          <div className="nk-zone-grid">
            {province.map((area) => (
              <ZoneCard key={area.slug} area={area} copy={t} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}
      {!bangkok.length && !province.length ? (
        <EmptyState title={copy.emptyTitle} body={copy.emptyBody} action={{ label: t.nav.search, href: localePath(locale, '/') }} />
      ) : null}
    </div>
  );
}
