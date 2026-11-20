/**
 * Guest (not signed in) listing pages: home, search results and map search, web and app.
 * English is the base; th / ja / zh translate from it. Wording follows design v2.2
 * ("NESTYK Guest Listing" canvas). Contact details (phone, e-mail, address) are config, not copy.
 *
 * Placeholders: {count} number, {date} formatted date, {price} formatted price,
 * {min} / {max} formatted prices, {phone} a phone number, {shown} / {total} numbers, {label} a filter label, {name} an area name.
 */
export interface GuestCopy {
  nav: {
    mainMenu: string;
    home: string;
    search: string;
    areas: string;
    commute: string;
    articles: string;
    about: string;
    signIn: string;
    language: string;
    openMenu: string;
    closeMenu: string;
    saved: string;
    comingSoon: string;
    soonItem: string;
    languageButton: string;
    skipToContent: string;
  };
  hero: {
    title: string;
    subtitle: string;
  };
  benefits: {
    priceTitle: string;
    priceBody: string;
    commuteTitle: string;
    commuteBody: string;
    onlineTitle: string;
    onlineBody: string;
  };
  search: {
    modeLabel: string;
    modeRent: string;
    modeBuy: string;
    comingSoon: string;
    keywordLabel: string;
    keywordPlaceholder: string;
    typeLabel: string;
    typeAll: string;
    priceLabel: string;
    priceAny: string;
    priceUnder: string;
    priceBetween: string;
    priceOver: string;
    priceApply: string;
    priceClear: string;
    bedroomsLabel: string;
    bedroomsAny: string;
    submit: string;
    popularFilters: string;
    editSearch: string;
  };
  propertyType: {
    condo: string;
    apartment: string;
    house: string;
    townhome: string;
  };
  propertyTypeHint: {
    condo: string;
    apartment: string;
    house: string;
    townhome: string;
  };
  quick: {
    nearTransit: string;
    moveInReady: string;
    petFriendly: string;
    shortTerm: string;
  };
  spec: {
    bedroom: { studio: string; one: string; many: string; threePlus: string };
    bathroom: { one: string; many: string };
    area: string;
    floor: string;
  };
  availability: {
    now: string;
    on: string;
  };
  card: {
    rentBadge: string;
    newBadge: string;
    priceFrom: string;
    perMonth: string;
    perMonthLong: string;
    save: string;
    unsave: string;
    photoPlaceholder: string;
    details: string;
    titleFallback: string;
    roomFallback: string;
    /** Label of the heart button: "Save {name}". */
    saveNamed: string;
    /** Heart of a saved room (AUTH-3), with the room name. */
    unsaveNamed: string;
  };
  home: {
    featuredTitle: string;
    tabRecommended: string;
    tabNearTransit: string;
    tabNew: string;
    viewAllListings: string;
    typesTitle: string;
    areasTitle: string;
    areasSubtitle: string;
    areasNotFound: string;
    searchByStation: string;
    viewAllAreas: string;
    viewAll: string;
    ctaTitle: string;
    ctaButton: string;
    listingsEmpty: string;
    aboutTitle: string;
    aboutBody: string;
    aboutUpdatedTitle: string;
    aboutUpdatedBody: string;
    aboutMatchTitle: string;
    aboutMatchBody: string;
    aboutOnlineTitle: string;
    aboutOnlineBody: string;
  };
  area: {
    roomsReady: string;
    priceFrom: string;
    viewRooms: string;
    photoAlt: string;
  };
  results: {
    filtersTitle: string;
    clearAll: string;
    priceRangeLabel: string;
    priceMin: string;
    priceMax: string;
    availabilityLabel: string;
    availabilityAny: string;
    availabilityNow: string;
    availabilityWithin1Month: string;
    availabilityWithin3Months: string;
    more: string;
    allFilters: string;
    found: string;
    foundInMap: string;
    sortLabel: string;
    sort: {
      recommended: string;
      price_asc: string;
      price_desc: string;
      newest: string;
      distance: string;
    };
    viewLabel: string;
    viewGrid: string;
    viewList: string;
    viewCards: string;
    viewMap: string;
    showMap: string;
    activeFilters: string;
    removeFilter: string;
    loadMore: string;
    showingOf: string;
    priceFromChip: string;
    priceOpenMax: string;
    priceSliderMin: string;
    priceSliderMax: string;
    titleAll: string;
    titleAllNearTransit: string;
    titleType: string;
    titleTypeNearTransit: string;
    titleKeyword: string;
    showResults: string;
    filtersCount: string;
    bedroomsThreePlus: string;
    durationChip: string;
    loadMoreFailed: string;
    listLabel: string;
    buyComingSoon: string;
  };
  map: {
    label: string;
    searchAsMove: string;
    myLocation: string;
    zoomIn: string;
    zoomOut: string;
    close: string;
    viewDetails: string;
    pinRooms: string;
  };
  states: {
    emptyTitle: string;
    emptyBody: string;
    emptyAction: string;
    errorTitle: string;
    errorBody: string;
    retry: string;
    loading: string;
  };
  footer: {
    tagline: string;
    call: string;
    findTitle: string;
    findRentals: string;
    companyTitle: string;
    about: string;
    contact: string;
    privacy: string;
    terms: string;
    listersTitle: string;
    forOwners: string;
    forAgents: string;
    links: string;
    apps: string;
    cookieSettings: string;
    companyName: string;
    address: string;
    openMap: string;
    socialLabel: string;
    copyright: string;
  };
  tabs: {
    label: string;
    home: string;
    search: string;
    saved: string;
    profile: string;
  };
  saved: {
    title: string;
    subtitle: string;
    emptyTitle: string;
    emptyBody: string;
    browse: string;
    /** Shown while the guest is not signed in. */
    gateTitle: string;
    gateBody: string;
    /** /saved could not load the list (AUTH-3). */
    errorTitle: string;
    /** Toolbar of the saved page: how many rooms are saved. */
    count: string;
    /** Sort option: newest saved first (the price options reuse results.sort). */
    sortSaved: string;
    /** Short notes after a heart press (AUTH-3, Mos 13 Nov 2026: a toast every time). */
    toastSaved: string;
    toastRemoved: string;
    toastFailed: string;
    /** Unsaving did not go through (review R6). */
    toastRemoveFailed: string;
    /** {count}: the most rooms one account can save. */
    toastLimit: string;
    toastGone: string;
    toastSignIn: string;
    /** Link in the "saved" toast. */
    viewSaved: string;
  };
  /** Prompt for features that need an account (Mos 11 Nov 2026): explains it in place, never jumps to sign-in. */
  signInPrompt: {
    saveTitle: string;
    saveBody: string;
    signIn: string;
    register: string;
    later: string;
    close: string;
  };
  profile: {
    title: string;
    subtitle: string;
    accountTitle: string;
    accountBody: string;
    signIn: string;
    register: string;
    activityLabel: string;
    saved: string;
    viewingRequests: string;
    settingsLabel: string;
    language: string;
    theme: string;
    themeLight: string;
    helpLabel: string;
    help: string;
    about: string;
    privacy: string;
    terms: string;
    cookies: string;
    contactLabel: string;
    call: string;
    email: string;
  };
  /** Account menu of the guest web when signed in (AUTH-2, design B, Mos 13 Nov 2026). */
  account: {
    title: string;
    button: string;
    profile: string;
    saved: string;
    viewingRequests: string;
    workspace: string;
    goToRole: string;
    signOut: string;
    checking: string;
  };
  /** Room page /rooms/<id> (S7.3, project-docs/nestyk-guest-room-detail-s73-plan-20261119.md). */
  room: {
    backToResults: string;
    breadcrumbLabel: string;
    photosLabel: string;
    openPhoto: string;
    showAllPhotos: string;
    galleryTitle: string;
    previousPhoto: string;
    nextPhoto: string;
    closeGallery: string;
    photoCounter: string;
    noPhotos: string;
    share: string;
    shareLabel: string;
    linkCopied: string;
    copyFailed: string;
    factsLabel: string;
    bedrooms: string;
    bathrooms: string;
    size: string;
    sizeValue: string;
    floor: string;
    floorValue: string;
    studio: string;
    sectionsLabel: string;
    tabOverview: string;
    tabPrice: string;
    tabAmenities: string;
    tabLocation: string;
    tabNearby: string;
    readMore: string;
    readLess: string;
    tagMoveInNow: string;
    tagShortTerm: string;
    tagNearTransit: string;
    tagPetFriendly: string;
    priceTitle: string;
    contractMonths: string;
    monthsShort: string;
    deposit: string;
    lowestPrice: string;
    selectedNote: string;
    otherCosts: string;
    amenitiesTitle: string;
    seeAllAmenities: string;
    showFewerAmenities: string;
    noAmenities: string;
    locationTitle: string;
    nearestStation: string;
    district: string;
    approxNote: string;
    mapLabel: string;
    noLocation: string;
    nearbyTitle: string;
    nearbyAll: string;
    viewingCardLabel: string;
    termLabel: string;
    moveIn: string;
    viewingCta: string;
    viewingSoonNote: string;
    closingTitle: string;
    notFoundTitle: string;
    notFoundText: string;
    notFoundCta: string;
    metaDescription: string;
  };
  areaNames: {
    'ratchada-rama9': string;
    sukhumvit: string;
    'ladprao-chatuchak': string;
    'bangna-udomsuk': string;
    'rangsit-khlongluang': string;
    'ari-phayathai': string;
    'nonthaburi-chaengwattana': string;
    'bangkhae-thapra': string;
    'silom-sathorn': string;
    'ramkhamhaeng-bangkapi': string;
    chonburi: string;
    chiangmai: string;
    phuket: string;
    rayong: string;
    khonkaen: string;
    korat: string;
    ayutthaya: string;
    hatyai: string;
    huahin: string;
    udonthani: string;
  };
  /** Mos's notes per area (20 Nov 2026): neighbourhoods, what it is known for, who rents there. */
  areaInfo: {
    'ratchada-rama9': AreaInfoCopy;
    sukhumvit: AreaInfoCopy;
    'ladprao-chatuchak': AreaInfoCopy;
    'bangna-udomsuk': AreaInfoCopy;
    'rangsit-khlongluang': AreaInfoCopy;
    'ari-phayathai': AreaInfoCopy;
    'nonthaburi-chaengwattana': AreaInfoCopy;
    'bangkhae-thapra': AreaInfoCopy;
    'silom-sathorn': AreaInfoCopy;
    'ramkhamhaeng-bangkapi': AreaInfoCopy;
    chonburi: AreaInfoCopy;
    chiangmai: AreaInfoCopy;
    phuket: AreaInfoCopy;
    rayong: AreaInfoCopy;
    khonkaen: AreaInfoCopy;
    korat: AreaInfoCopy;
    ayutthaya: AreaInfoCopy;
    hatyai: AreaInfoCopy;
    huahin: AreaInfoCopy;
    udonthani: AreaInfoCopy;
  };
  /** Area pages /rent/<slug> and the area list /areas (SEO-1). */
  areaPage: {
    title: string;
    linesLabel: string;
    statRooms: string;
    statPrice: string;
    searchCta: string;
    fitTitle: string;
    roomsTitle: string;
    seeAllRooms: string;
    otherAreas: string;
    seeAllAreas: string;
    emptyTitle: string;
    emptyBody: string;
    metaDescription: string;
    listTitle: string;
    listSubtitle: string;
    listMeta: string;
    groupBangkok: string;
    groupProvince: string;
    provinceSubtitle: string;
    seeAllZones: string;
    filterChip: string;
  };
  /** Location search: suggestions in the keyword box and "near me" (Mos 20 Nov 2026). */
  location: {
    /** Accessible name of the suggestion list. */
    listLabel: string;
    nearMe: string;
    /** "{km}": the search radius. */
    nearMeHint: string;
    locating: string;
    denied: string;
    unavailable: string;
    areasHeading: string;
    /** "{text}": what was typed, searched as a free keyword. */
    searchFor: string;
    searchForHint: string;
    nearMeChip: string;
    /** Results heading of a "near me" search. */
    nearMeTitle: string;
    /** Group heading of Google place suggestions; the group ends with the "Google Maps" credit Google asks for. */
    placesHeading: string;
    placeFailed: string;
    /** "{place}": the picked place's name. */
    nearPlaceTitle: string;
    /** "{place}", "{km}": the search radius. */
    nearPlaceChip: string;
    stationsHeading: string;
    interchange: string;
    browseLines: string;
    browseLinesHint: string;
    clear: string;
    back: string;
  };
  /** Rail picker beside the keyword box: line, then station (Mos 20 Nov 2026). */
  transit: {
    button: string;
    title: string;
    linesLabel: string;
    stationsLabel: string;
    back: string;
    close: string;
    /** "{km}": the search radius around a station. */
    hint: string;
  };
  transitLines: {
    bts_sukhumvit: string;
    bts_silom: string;
    mrt_blue: string;
    mrt_purple: string;
    mrt_pink: string;
    mrt_yellow: string;
    mrt_orange: string;
    arl: string;
    /** Lines in the rail picker only (no area uses them). */
    bts_gold: string;
    srt_red_north: string;
    srt_red_west: string;
  };
}

export interface AreaInfoCopy {
  places: string;
  highlight: string;
  tenants: string;
}
