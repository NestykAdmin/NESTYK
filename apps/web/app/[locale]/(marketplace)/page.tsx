import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, type SupportedLocale } from '@nestyk/i18n';
import type { PublicFeaturedRail } from '@nestyk/types';
import logoOnBlack from '@nestyk/ui/assets/nestyk/svg/logo-nestyk-onBlack.svg';
import { AreaCard } from '../../components/guest/AreaCard';
import { ZoneCard } from '../../components/guest/ZoneCard';
import { EmptyState, ErrorState } from '../../components/guest/GuestStates';
import { CalendarIcon, ShieldCheckIcon, SignIcon, SparkIcon, TrainIcon } from '../../components/guest/GuestIcons';
import { ListingTabs } from '../../components/guest/ListingTabs';
import { PropertyTypeTiles } from '../../components/guest/PropertyTypeTiles';
import { RoomCard } from '../../components/guest/RoomCard';
import { HomeAreasSkeleton, HomeListingsSkeleton } from '../../components/guest/PageSkeletons';
import { SearchPanel } from '../../components/guest/SearchPanel';
import { bangkokToday, findHref, HOME_RAILS } from '../../../lib/guest-home';
import { homeAreaGroups } from '../../../lib/guest-areas';
import { loadHomeData, type HomeData } from '../../../lib/guest-rooms';
import { guestPageMetadata } from '../../../lib/guest-seo';
import { localePath, NEAR_TRANSIT_READY } from '../../../lib/guest-site';
import '../guest-areas.css';

type Props = { params: Promise<{ locale: string }> };

/**
 * Rooms on this page are kept for 5 minutes (Mos 11 Nov 2026, H8). Next needs a literal here; it must equal
 * PUBLIC_DATA_REVALIDATE_SECONDS in lib/guest-rooms.ts (lib/guest-home.test.cjs checks).
 */
export const revalidate = 300;

/** Title and description come from the layout ([locale]/layout.tsx). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return guestPageMetadata({ locale, path: '/' });
}

const LOGO_HEIGHT = 28;
const LOGO_WIDTH = Math.round((LOGO_HEIGHT * 618) / 219);

/** "Your Happiness Next Home" with the middle word in brand yellow, as in the design. */
function Tagline({ text }: { text: string }) {
  const [before, after] = text.split('Happiness');
  if (after === undefined) return <>{text}</>;
  return (
    <>
      {before}
      <span className="nk-hero__accent">Happiness</span>
      {after}
    </>
  );
}

/** A link while /search is ready; until then the same label, muted, with a "เร็ว ๆ นี้" pill (R4). */
function SearchLink({ href, className, soon, children }: { href: string | null; className: string; soon: string; children: React.ReactNode }) {
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <span className={`${className} is-soon`}>
      {children}
      <span className="nk-soon">{soon}</span>
    </span>
  );
}

type GuestCopy = ReturnType<typeof getTranslations>['guest'];
type Retry = { label: string; href: string };

/** "ประกาศแนะนำสำหรับคุณ": waits for the API in its own part (HomeListingsSkeleton meanwhile). */
async function HomeListings({ data, copy, locale, today, retry }: { data: Promise<HomeData>; copy: GuestCopy; locale: string; today: string; retry: Retry }) {
  const { rails } = await data;
  const railLabel: Record<PublicFeaturedRail, string> = {
    recommended: copy.home.tabRecommended,
    near_transit: copy.home.tabNearTransit,
    new: copy.home.tabNew,
  };
  return rails ? (
    <ListingTabs
      label={copy.home.featuredTitle}
      testId="guestHome.rails"
      tabs={HOME_RAILS.filter((rail) => NEAR_TRANSIT_READY || rail !== 'near_transit').map((rail) => ({
        id: rail,
        label: railLabel[rail],
        panel: rails[rail].length ? (
          <div className="nk-room-grid">
            {rails[rail].map((card) => (
              <RoomCard key={card.id} card={card} copy={copy} locale={locale} today={today} />
            ))}
          </div>
        ) : (
          <EmptyState title={copy.home.listingsEmpty} />
        ),
      }))}
    />
  ) : (
    <ErrorState title={copy.states.errorTitle} body={copy.states.errorBody} retry={retry} />
  );
}

/** Bangkok areas and province zones: wait for the API in their own part (HomeAreasSkeleton meanwhile). */
async function HomeAreas({
  data,
  copy,
  locale,
  areasHref,
  searchHref,
  soon,
  retry,
}: {
  data: Promise<HomeData>;
  copy: GuestCopy;
  locale: string;
  areasHref: string;
  searchHref: string;
  soon: string;
  retry: Retry;
}) {
  const { areas } = await data;
  const { bangkok, province } = homeAreaGroups(areas ?? []);
  return (
    <>
      {/* Mos 20 Nov 2026 (canvas HomeZonesWeb): Bangkok areas with "ดูทุกทำเล", then the province zones. */}
      <div className="nk-areas" data-testid="guestHome.areas">
        <div className="nk-home-areas__head">
          <div className="nk-section__head nk-section__head--stack">
            <h2 className="nk-section__title">{copy.home.areasTitle}</h2>
            <p className="nk-section__subtitle">{copy.areaPage.groupBangkok}</p>
          </div>
          {areas !== null && areas.length ? (
            <Link href={areasHref} className="nk-link-more">
              {copy.areaPage.seeAllAreas}
            </Link>
          ) : null}
        </div>
        {areas === null ? (
          <ErrorState title={copy.states.errorTitle} body={copy.states.errorBody} retry={retry} />
        ) : bangkok.length ? (
          <div className="nk-area-grid nk-home-areas__grid">
            {bangkok.map((area) => (
              <AreaCard key={area.slug} area={area} copy={copy} locale={locale} />
            ))}
          </div>
        ) : province.length ? null : (
          <EmptyState title={copy.home.listingsEmpty} />
        )}
        <SearchLink href={searchHref} className="nk-link-more nk-areas__station" soon={soon}>
          <TrainIcon size={18} />
          {copy.home.searchByStation}
        </SearchLink>
      </div>
      {province.length ? (
        <div className="nk-areas" data-testid="guestHome.zones">
          <div className="nk-home-areas__head">
            <div className="nk-section__head nk-section__head--stack">
              <h2 className="nk-section__title nk-home-zones__title">{copy.areaPage.groupProvince}</h2>
              <p className="nk-section__subtitle">{copy.areaPage.provinceSubtitle}</p>
            </div>
            <Link href={areasHref} className="nk-link-more">
              {copy.areaPage.seeAllZones}
            </Link>
          </div>
          <div className="nk-zone-grid nk-home-zones">
            {province.map((area) => (
              <ZoneCard key={area.slug} area={area} copy={copy} locale={locale} />
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * Guest home (S4.1, design v2.3 HomeWebV23 + MobileHomeV23). One page for every width: guest.css switches the
 * mobile layout at 960px (compact hero, type chips, sideways room rail, no footer). Rooms and areas come from the
 * public API on the server. Left out on purpose: the roles section (Mos, H2), reviews and articles (no real content).
 */
export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  const copy = getTranslations(locale as SupportedLocale).guest;
  // Asked once, not waited for here: the top of the page goes out at once and the rooms and areas follow in their own
  // parts (Mos 27 Nov 2026). A cached page (ISR) is still built whole, and a failed API still keeps the last good page
  // (R3: loadHomeData throws in production and the parts below rethrow it).
  const data = loadHomeData();
  const areasHref = localePath(locale, '/areas');
  const today = bangkokToday();
  // A search needs a place (Mos 27 Nov 2026): links that know none open /find, where the guest picks one.
  const searchHref = localePath(locale, findHref());
  const soon = copy.nav.comingSoon;
  const retry = { label: copy.states.retry, href: localePath(locale, '/') };

  return (
    <div className="nk-home">
      <section className="nk-hero" data-testid="guestHome.hero">
        <div className="nk-hero__inner">
          <div className="nk-hero__copy">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoOnBlack.src} alt="" width={LOGO_WIDTH} height={LOGO_HEIGHT} className="nk-hero__logo" />
            <p className="nk-hero__brand">
              <Tagline text={copy.footer.tagline} />
            </p>
            <h1 className="nk-hero__title">{copy.hero.title}</h1>
            <p className="nk-hero__subtitle">{copy.hero.subtitle}</p>
          </div>
          <SearchPanel />
          <ul className="nk-benefits" data-testid="guestHome.benefits">
            <li className="nk-benefit">
              <span className="nk-benefit__icon">
                <CalendarIcon />
              </span>
              <span className="nk-benefit__text">
                <span className="nk-benefit__title">{copy.benefits.priceTitle}</span>
                <span className="nk-benefit__body">{copy.benefits.priceBody}</span>
              </span>
            </li>
            <li className="nk-benefit nk-benefit--soon">
              <span className="nk-benefit__icon">
                <TrainIcon />
              </span>
              <span className="nk-benefit__text">
                <span className="nk-benefit__title">{copy.benefits.commuteTitle}</span>
                <span className="nk-benefit__body">{copy.benefits.commuteBody}</span>
                <span className="nk-soon nk-soon--on-dark">{copy.nav.comingSoon}</span>
              </span>
            </li>
            <li className="nk-benefit">
              <span className="nk-benefit__icon">
                <SignIcon />
              </span>
              <span className="nk-benefit__text">
                <span className="nk-benefit__title">{copy.benefits.onlineTitle}</span>
                <span className="nk-benefit__body">{copy.benefits.onlineBody}</span>
              </span>
            </li>
          </ul>
        </div>
      </section>

      <div className="nk-home__mobile-types">
        <PropertyTypeTiles copy={copy} locale={locale} variant="rail" />
      </div>

      <section id="listings" className="nk-section nk-section--surface" data-testid="guestHome.listings" aria-labelledby="home-listings-title">
        <div className="nk-section__inner">
          <div className="nk-section__head">
            <h2 id="home-listings-title" className="nk-section__title">
              {copy.home.featuredTitle}
            </h2>
            <SearchLink href={searchHref} className="nk-link-more" soon={soon}>
              {copy.home.viewAllListings}
            </SearchLink>
          </div>
          <Suspense fallback={<HomeListingsSkeleton />}>
            <HomeListings data={data} copy={copy} locale={locale} today={today} retry={retry} />
          </Suspense>
        </div>
      </section>

      <section id="areas" className="nk-section" data-testid="guestHome.browse">
        <div className="nk-section__inner nk-section__inner--stack">
          <div className="nk-home__desktop-types">
            <h2 className="nk-section__title">{copy.home.typesTitle}</h2>
            <PropertyTypeTiles copy={copy} locale={locale} variant="tiles" />
          </div>
          <Suspense fallback={<HomeAreasSkeleton />}>
            <HomeAreas data={data} copy={copy} locale={locale} areasHref={areasHref} searchHref={searchHref} soon={soon} retry={retry} />
          </Suspense>
        </div>
      </section>

      <section id="about" className="nk-section nk-section--surface" data-testid="guestHome.about" aria-labelledby="home-about-title">
        <div className="nk-section__inner nk-section__inner--stack">
          <div className="nk-section__head nk-section__head--stack">
            <h2 id="home-about-title" className="nk-section__title">
              {copy.home.aboutTitle}
            </h2>
            <p className="nk-section__subtitle">{copy.home.aboutBody}</p>
          </div>
          <ul className="nk-about">
            <li className="nk-about__item">
              <span className="nk-about__icon">
                <ShieldCheckIcon />
              </span>
              <h3 className="nk-about__title">{copy.home.aboutUpdatedTitle}</h3>
              <p className="nk-about__body">{copy.home.aboutUpdatedBody}</p>
            </li>
            <li className="nk-about__item">
              <span className="nk-about__icon">
                <SparkIcon />
              </span>
              <h3 className="nk-about__title">{copy.home.aboutMatchTitle}</h3>
              <p className="nk-about__body">{copy.home.aboutMatchBody}</p>
            </li>
            <li className="nk-about__item">
              <span className="nk-about__icon">
                <SignIcon />
              </span>
              <h3 className="nk-about__title">{copy.home.aboutOnlineTitle}</h3>
              <p className="nk-about__body">{copy.home.aboutOnlineBody}</p>
            </li>
          </ul>
        </div>
      </section>

      <section className="nk-closing" data-testid="guestHome.closing">
        <div className="nk-closing__inner">
          <h2 className="nk-closing__title">{copy.home.ctaTitle}</h2>
          <SearchLink href={searchHref} className="nk-btn nk-btn--primary" soon={soon}>
            {copy.home.ctaButton}
          </SearchLink>
        </div>
      </section>
    </div>
  );
}
