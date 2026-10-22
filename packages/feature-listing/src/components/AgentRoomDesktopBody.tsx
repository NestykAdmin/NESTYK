import React, { useEffect, useMemo, useRef, useState } from "react";
import { AMENITIES_CATALOG_GROUP_ORDER, useLocale } from "@nestyk/i18n";
import {
  MobileIcon,
  WebContentContainer,
  type AppIconName,
} from "@nestyk/ui/native";
import type { MobileRoomDetailBodyProps } from "./MobileRoomDetailBody";
import { DEFAULT_ROOM_SHARE_VISIBILITY } from "../share-completeness";
import { formatBedroomSpec } from "../bedroom-label";
import { amenityIcon, FACILITY_GROUP_ICONS } from "../facility-icons";
import {
  nearbyCategory,
  nearbyCategoryIcons,
  formatTransitPlaceName,
  type NearbyCategory,
} from "../nearby";
import { NearbyPlacesMap } from "./NearbyPlacesMap";
import "./agent-room-desktop.css";

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce(
    (s, [key, value]) => s.replaceAll(`{${key}}`, String(value)),
    template,
  );

function Photo({
  src,
  alt,
  onOpen,
}: {
  src: string;
  alt: string;
  onOpen?: () => void;
}) {
  const { t } = useLocale();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const content = failed ? (
    <span className="ard-photo-failed">
      <MobileIcon name="camera" size={26} color="currentColor" />
      <span>{t.agent.listings.photoLoadError}</span>
    </span>
  ) : (
    <img src={src} alt={alt} onError={() => setFailed(true)} />
  );
  return (
    <div className={onOpen ? "ard-photo-tile" : "ard-photo-view"}>
      {onOpen ? (
        <button className="ard-photo-open" onClick={onOpen} aria-label={alt}>
          {content}
        </button>
      ) : (
        content
      )}
      {failed && (
        <button className="ard-photo-retry" onClick={() => setFailed(false)}>
          {t.agent.listings.retry}
        </button>
      )}
    </div>
  );
}

export function AgentRoomDesktopBody({
  room,
  mode = "agent",
  mapsApiKey,
  shareComplete,
  shareVisibility = DEFAULT_ROOM_SHARE_VISIBILITY,
  shareContactId = null,
  onShare,
  onOpenShareCheck,
}: MobileRoomDetailBodyProps) {
  const { t, locale } = useLocale();
  const c = t.agent.listings,
    cr = t.agent.createRoom,
    rd = t.agent.roomDetail;
  const agent = mode === "agent";
  const visible = (section: keyof typeof shareVisibility) =>
    agent || shareVisibility[section];
  const [photoIndex, setPhotoIndex] = useState(0);
  const [priceIndex, setPriceIndex] = useState(0);
  const [nearbyFilter, setNearbyFilter] = useState<NearbyCategory | "all">(
    "all",
  );
  const lightbox = useRef<HTMLDialogElement>(null);
  const sectionIds = {
    overview: `ard-overview-${room.id}`,
    facilities: `ard-facilities-${room.id}`,
    location: `ard-location-${room.id}`,
    internal: `ard-internal-${room.id}`,
  };
  const photos = useMemo(() => {
    const images = room.medias.filter((m) => m.mediaType === "image");
    return [
      ...images.filter((m) => m.isCover),
      ...images.filter((m) => !m.isCover),
    ];
  }, [room.medias]);
  const prices = useMemo(
    () =>
      [...room.prices].sort(
        (a, b) =>
          a.price - b.price || (b.termMonths ?? 0) - (a.termMonths ?? 0),
      ),
    [room.prices],
  );
  const price = prices[priceIndex] ?? prices[0];
  const money = (amount: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  const value = (code: string) =>
    room.layout.find((item) => item.code === code)?.value?.trim();
  const title =
    room.promoTitle?.trim() ||
    room.property?.name ||
    (agent ? room.listingTitle : null) ||
    (agent ? `#${room.id}` : c.details);
  const address = room.property
    ? [
        room.property.address,
        room.property.subdistrict,
        room.property.district,
        room.property.province,
        room.property.postalCode,
      ]
        .filter((part) => part && part !== "-")
        .join(" ")
    : "";
  const status = c[room.roomStatusCode as keyof typeof c];
  const statusLabel =
    typeof status === "string" ? status : room.roomStatusCode || c.notSpecified;
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(
    room.availableFromDate || "",
  );
  const available = dateMatch
    ? new Intl.DateTimeFormat(locale === "th" ? "th-TH" : locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(+dateMatch[1], +dateMatch[2] - 1, +dateMatch[3]))
    : room.availableFromDate || c.notSpecified;
  const bedroom = formatBedroomSpec(
    value("bedroom"),
    { studio: t.masters.roomTypes.studio, one: c.specBed, many: c.specBeds },
    room.roomTypeCode,
  );
  const specs: Array<{ icon: AppIconName; label: string }> = [
    ...(bedroom ? [{ icon: "bed" as const, label: bedroom }] : []),
    ...(value("bathroom")
      ? [
          {
            icon: "bath" as const,
            label: fill(
              Number(value("bathroom")) === 1 ? c.specBath : c.specBaths,
              { count: value("bathroom")! },
            ),
          },
        ]
      : []),
    ...(value("room_size")
      ? [
          {
            icon: "room-size" as const,
            label: fill(c.specSqm, { size: value("room_size")! }),
          },
        ]
      : []),
    ...(value("floor")
      ? [
          {
            icon: "stairs" as const,
            label: value("building")
              ? fill(rd.floorBuilding, {
                  floor: value("floor")!,
                  building: value("building")!,
                })
              : fill(c.specFloor, { floor: value("floor")! }),
          },
        ]
      : []),
  ];
  const groups = useMemo(() => {
    const map = new Map<string, Array<{ code: string; custom?: boolean }>>();
    for (const item of room.facilityItems?.length
      ? room.facilityItems
      : room.facilities.map((code) => ({ code, groupCode: "other" }))) {
      const group = item.groupCode || "other";
      map.set(group, [...(map.get(group) ?? []), { code: item.code }]);
    }
    for (const text of room.customFacilities ?? [])
      if (text.trim())
        map.set("other", [
          ...(map.get("other") ?? []),
          { code: text.trim(), custom: true },
        ]);
    return [...map].sort(([a], [b]) => {
      const index = (key: string) => {
        const i = AMENITIES_CATALOG_GROUP_ORDER.indexOf(
          key as (typeof AMENITIES_CATALOG_GROUP_ORDER)[number],
        );
        return i < 0 ? AMENITIES_CATALOG_GROUP_ORDER.length : i;
      };
      return index(a) - index(b);
    });
  }, [room.facilityItems, room.facilities, room.customFacilities]);
  const nearby = room.nearbyPlaces ?? [];
  const categories = Array.from(
    new Set(nearby.map((place) => nearbyCategory(place.type || ""))),
  );
  const places =
    nearbyFilter === "all"
      ? nearby
      : nearby.filter(
          (place) => nearbyCategory(place.type || "") === nearbyFilter,
        );
  const latText = room.latitude ?? room.property?.latitude,
    lngText = room.longitude ?? room.property?.longitude;
  const lat = latText == null ? NaN : Number(latText),
    lng = lngText == null ? NaN : Number(lngText);
  const hasCoordinates =
    Number.isFinite(lat) &&
    Math.abs(lat) <= 90 &&
    Number.isFinite(lng) &&
    Math.abs(lng) <= 180;
  const advance = price?.advanceRentMonths ?? room.advanceRentMonths;
  const deposit = price?.depositMonths ?? room.depositMonths;
  const contacts = agent
    ? room.contacts
    : [
        room.contacts.find((contact) => contact.id === shareContactId) ??
          room.contacts.find((contact) => contact.isPrimary) ??
          room.contacts[0],
      ].filter(Boolean);
  const goTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  const openPhoto = (index: number) => {
    setPhotoIndex(index);
    lightbox.current?.showModal();
  };
  const nextPhoto = (delta: number) =>
    setPhotoIndex((index) => (index + delta + photos.length) % photos.length);

  return (
    <div className="ard-scroll" data-testid="agent-web-room-detail">
      <WebContentContainer>
        <div className="ard-content">
          <div className="ard-intro">
            <div>
              <div className="ard-eyebrow">
                {room.property?.name || c.details}
              </div>
              <h2>{title}</h2>
              {visible("location") && address && (
                <p>
                  <MobileIcon name="map-pin" size={16} color="currentColor" />
                  {address}
                </p>
              )}
            </div>
            <div className="ard-status-row">
              <span
                className={`ard-badge ${room.roomStatusCode === "available" ? "ard-available" : ""}`}
              >
                {statusLabel}
              </span>
              {agent && (
                <span className="ard-badge">
                  {room.visibility === "published"
                    ? cr.visibilityPublished
                    : cr.visibilityPrivate}
                </span>
              )}
            </div>
          </div>

          {visible("photos") && photos.length ? (
            <div
              className={`ard-gallery ${photos.length === 1 ? "ard-gallery-single" : ""}`}
            >
              <div className="ard-cover-photo">
                <Photo
                  src={photos[0].mediaUrl}
                  alt={title}
                  onOpen={() => openPhoto(0)}
                />
              </div>
              {photos.length > 1 && (
                <div className="ard-gallery-side">
                  {photos.slice(1, 5).map((photo, i) => (
                    <Photo
                      key={photo.id}
                      src={photo.mediaUrl}
                      alt={`${title} ${i + 2}`}
                      onOpen={() => openPhoto(i + 1)}
                    />
                  ))}
                </div>
              )}
              <button className="ard-all-photos" onClick={() => openPhoto(0)}>
                <MobileIcon name="grid" size={16} color="currentColor" />
                {rd.seeAllPhotos} · {photos.length}
              </button>
            </div>
          ) : (
            <div className="ard-gallery-empty">
              <MobileIcon name="camera" size={36} color="currentColor" />
              <span>
                {visible("photos") ? c.noPhotos : rd.shareHiddenPhotos}
              </span>
            </div>
          )}

          <nav className="ard-section-nav" aria-label={c.details}>
            <button onClick={() => goTo(sectionIds.overview)}>
              {c.details}
            </button>
            {visible("facilities") && (
              <button onClick={() => goTo(sectionIds.facilities)}>
                {rd.facilities}
              </button>
            )}
            {visible("location") && (
              <button onClick={() => goTo(sectionIds.location)}>
                {rd.location}
              </button>
            )}
            {agent && (
              <button onClick={() => goTo(sectionIds.internal)}>
                <MobileIcon name="lock" size={14} color="currentColor" />
                {rd.internalInfo}
              </button>
            )}
          </nav>

          <div
            className={`ard-detail-grid ${!visible("price") && !agent ? "ard-no-sidebar" : ""}`}
          >
            <div className="ard-main-column">
              <section className="ard-card" id={sectionIds.overview}>
                <h3>{rd.aboutThisRoom}</h3>
                {specs.length > 0 && (
                  <div className="ard-specs">
                    {specs.map((spec) => (
                      <div key={spec.icon}>
                        <MobileIcon
                          name={spec.icon}
                          size={23}
                          color="currentColor"
                        />
                        <span>{spec.label}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="ard-ready">
                  <MobileIcon name="calendar" size={18} color="currentColor" />
                  {fill(rd.readyMoveIn, { date: available })}
                </div>
                {room.description?.trim() && (
                  <p className="ard-description">{room.description.trim()}</p>
                )}
              </section>

              {visible("facilities") && (
                <section className="ard-card" id={sectionIds.facilities}>
                  <h3>{rd.facilities}</h3>
                  {groups.length ? (
                    groups.map(([group, items]) => (
                      <div key={group} className="ard-facility-group">
                        <h4>
                          <MobileIcon
                            name={FACILITY_GROUP_ICONS[group] || "grid"}
                            size={18}
                            color="currentColor"
                          />
                          {t.masters.facilityGroups[
                            group as keyof typeof t.masters.facilityGroups
                          ] || group}
                          <span>{items.length}</span>
                        </h4>
                        <div className="ard-facilities">
                          {items.map((item, index) => (
                            <span key={`${item.code}-${index}`}>
                              <MobileIcon
                                name={
                                  item.custom
                                    ? "note"
                                    : amenityIcon(item.code, group)
                                }
                                size={17}
                                color="currentColor"
                              />
                              {item.custom
                                ? item.code
                                : t.masters.facilities[
                                    item.code as keyof typeof t.masters.facilities
                                  ] || item.code}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="ard-muted">{c.notSpecified}</p>
                  )}
                  <div className="ard-rules">
                    <h4>{rd.houseRules}</h4>
                    <span>
                      <MobileIcon name="paw" size={17} color="currentColor" />
                      {rd.petsInquire}
                    </span>
                    <span>
                      <MobileIcon
                        name="warning"
                        size={17}
                        color="currentColor"
                      />
                      {rd.smokingUnspecified}
                    </span>
                  </div>
                </section>
              )}

              {visible("location") && (
                <section className="ard-card" id={sectionIds.location}>
                  <div className="ard-card-heading">
                    <h3>{rd.location}</h3>
                    {hasCoordinates && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {rd.openInMaps}
                        <MobileIcon
                          name="map-pin"
                          size={15}
                          color="currentColor"
                        />
                      </a>
                    )}
                  </div>
                  {address && <p className="ard-muted">{address}</p>}
                  {hasCoordinates ? (
                    <div className="ard-map">
                      <NearbyPlacesMap
                        latitude={lat}
                        longitude={lng}
                        markerTitle={title}
                        apiKey={mapsApiKey}
                        places={places.slice(0, 24)}
                        selectedIds={places
                          .slice(0, 24)
                          .map((place) => place.placeId || place.name)}
                        readOnly
                        compact
                        mapHeight={280}
                        showFullscreenControl={false}
                      />
                    </div>
                  ) : (
                    <p className="ard-muted">{c.notSpecified}</p>
                  )}
                  {categories.length > 1 && (
                    <div className="ard-nearby-filters">
                      <button
                        aria-pressed={nearbyFilter === "all"}
                        onClick={() => setNearbyFilter("all")}
                      >
                        {fill(rd.nearbyFilterAll, { count: nearby.length })}
                      </button>
                      {categories.map((category) => (
                        <button
                          key={category}
                          aria-pressed={nearbyFilter === category}
                          onClick={() => setNearbyFilter(category)}
                        >
                          {cr.nearbyCategories[category]}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="ard-nearby-list">
                    {places.map((place, index) => (
                      <div key={`${place.placeId}-${index}`}>
                        <MobileIcon
                          name={
                            nearbyCategoryIcons[
                              nearbyCategory(place.type || "")
                            ]
                          }
                          size={18}
                          color="currentColor"
                        />
                        <span>
                          {formatTransitPlaceName(
                            place.name,
                            place.type,
                            place.vicinity,
                          )}
                        </span>
                        {place.distanceMeters != null && (
                          <small>
                            {place.distanceMeters >= 1000
                              ? `${(place.distanceMeters / 1000).toFixed(1)} km`
                              : `${place.distanceMeters} m`}
                          </small>
                        )}
                      </div>
                    ))}
                  </div>
                  {agent && room.nearbyOther?.trim() && (
                    <p className="ard-description">{room.nearbyOther.trim()}</p>
                  )}
                </section>
              )}

              {visible("contact") && (
                <section className="ard-card">
                  <h3>{rd.listingProvider}</h3>
                  {contacts.length ? (
                    contacts.map((contact) => (
                      <div className="ard-contact" key={contact.id}>
                        <span className="ard-contact-avatar">
                          {contact.name.slice(0, 1)}
                        </span>
                        <div>
                          <strong>{contact.name}</strong>
                          {agent ? (
                            <>
                              <span>{contact.phone || c.notSpecified}</span>
                              {contact.email && <span>{contact.email}</span>}
                              {contact.lineId && (
                                <span>LINE · {contact.lineId}</span>
                              )}
                              {contact.facebook && (
                                <span>Facebook · {contact.facebook}</span>
                              )}
                            </>
                          ) : (
                            <span>{rd.providerAgent}</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="ard-muted">{c.notSpecified}</p>
                  )}
                </section>
              )}

              {agent && (
                <section
                  className="ard-card ard-internal"
                  id={sectionIds.internal}
                >
                  <div className="ard-card-heading">
                    <h3>
                      <MobileIcon name="lock" size={17} color="currentColor" />
                      {rd.internalInfo}
                    </h3>
                  </div>
                  <p className="ard-muted">{rd.internalOnlyHint}</p>
                  <dl className="ard-internal-fields">
                    {[
                      [cr.listingTitle, room.listingTitle],
                      [cr.roomId, room.roomId],
                      [
                        cr.sourceSection,
                        room.listingSourceCode === "owner"
                          ? cr.sourceOwner
                          : room.listingSourceCode === "co_agent"
                            ? cr.sourceCoAgent
                            : null,
                      ],
                      [
                        rd.internalProvider,
                        room.contacts.find((contact) => contact.isPrimary)
                          ?.name || room.contacts[0]?.name,
                      ],
                      [
                        rd.internalVisibility,
                        room.visibility === "published"
                          ? cr.visibilityPublished
                          : room.visibility === "private"
                            ? cr.visibilityPrivate
                            : null,
                      ],
                      [
                        rd.internalNotes,
                        room.contacts
                          .map((contact) => contact.note?.trim())
                          .filter(Boolean)
                          .join(" · "),
                      ],
                    ].map(([label, text]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{text || c.notSpecified}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
            </div>

            {(visible("price") || agent) && (
              <aside className="ard-sidebar">
                {visible("price") && (
                  <section className="ard-card ard-price-card">
                    <span className="ard-eyebrow">{c.rentAndTerms}</span>
                    <div className="ard-main-price">
                      {price ? money(price.price) : c.notSpecified}
                      <small>{price ? c.rentPeriod : ""}</small>
                    </div>
                    <div className="ard-contracts">
                      {prices.map((item, index) => (
                        <button
                          key={`${item.contractTypeId ?? item.contractTypeCode}-${index}`}
                          aria-pressed={priceIndex === index}
                          onClick={() => setPriceIndex(index)}
                        >
                          <span>
                            {item.termMonths != null
                              ? fill(rd.contractMonths, {
                                  months: item.termMonths,
                                })
                              : item.contractTypeCode}
                          </span>
                          <strong>{money(item.price)}</strong>
                          <span className="ard-contract-check">
                            {priceIndex === index && (
                              <MobileIcon
                                name="check"
                                size={13}
                                color="currentColor"
                              />
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                    {price && (
                      <div className="ard-costs">
                        <h4>{rd.initialCosts}</h4>
                        <dl>
                          <div>
                            <dt>
                              {fill(rd.advanceLabel, { months: advance })}
                            </dt>
                            <dd>{money(price.price * advance)}</dd>
                          </div>
                          <div>
                            <dt>
                              {fill(rd.depositLabel, { months: deposit })}
                            </dt>
                            <dd>{money(price.price * deposit)}</dd>
                          </div>
                          <div className="ard-cost-total">
                            <dt>{rd.totalDue}</dt>
                            <dd>{money(price.price * (advance + deposit))}</dd>
                          </div>
                        </dl>
                        <p>{rd.otherFeesNote}</p>
                      </div>
                    )}
                    {agent && (
                      <button
                        className="aw-button aw-button-primary ard-share"
                        onClick={onShare}
                      >
                        <MobileIcon
                          name="globe"
                          size={18}
                          color="currentColor"
                        />
                        {rd.shareRoom}
                      </button>
                    )}
                  </section>
                )}
                {agent && shareComplete && (
                  <section className="ard-card ard-share-readiness">
                    <span className="ard-eyebrow">{rd.shareRoom}</span>
                    <strong>
                      {fill(rd.shareCompleteBanner, {
                        ...shareComplete,
                        percent: Math.round(
                          (shareComplete.done /
                            Math.max(1, shareComplete.total)) *
                            100,
                        ),
                      })}
                    </strong>
                    <progress
                      aria-label={rd.shareRoom}
                      value={shareComplete.done}
                      max={shareComplete.total || 1}
                    />
                    <button
                      onClick={onOpenShareCheck}
                      disabled={!onOpenShareCheck}
                    >
                      {rd.checkShare}
                    </button>
                  </section>
                )}
              </aside>
            )}
          </div>
        </div>
      </WebContentContainer>
      <dialog
        ref={lightbox}
        className="ard-lightbox"
        aria-label={cr.photoViewerTitle}
        onCancel={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            nextPhoto(-1);
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            nextPhoto(1);
          }
        }}
      >
        {visible("photos") && photos.length > 0 && (
          <>
            <div className="ard-lightbox-heading">
              <span>{title}</span>
              <span>
                {photoIndex + 1} / {photos.length}
              </span>
              <button
                className="aw-icon-button"
                aria-label={cr.closePhotoPreview}
                onClick={() => lightbox.current?.close()}
              >
                <MobileIcon name="close" size={22} color="currentColor" />
              </button>
            </div>
            <div className="ard-lightbox-photo">
              <Photo
                src={photos[photoIndex]?.mediaUrl || photos[0].mediaUrl}
                alt={title}
              />
            </div>
            {photos.length > 1 && (
              <div className="ard-lightbox-nav">
                <button
                  className="aw-icon-button"
                  aria-label={t.agent.leads.previous}
                  onClick={() => nextPhoto(-1)}
                >
                  <MobileIcon
                    name="chevron-left"
                    size={22}
                    color="currentColor"
                  />
                </button>
                <button
                  className="aw-icon-button"
                  aria-label={t.agent.leads.next}
                  onClick={() => nextPhoto(1)}
                >
                  <MobileIcon
                    name="chevron-right"
                    size={22}
                    color="currentColor"
                  />
                </button>
              </div>
            )}
          </>
        )}
      </dialog>
    </div>
  );
}
