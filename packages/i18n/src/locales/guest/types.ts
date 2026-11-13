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
    /** Shown while the guest is not signed in (the web cannot see the session until single sign-on). */
    gateTitle: string;
    gateBody: string;
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
  areaNames: {
    'sukhumvit-asok': string;
    'silom-sathorn': string;
    'onnut-udomsuk': string;
    'ari-phayathai': string;
    'ladprao-chatuchak': string;
    'nonthaburi-chaengwattana': string;
  };
  transitLines: {
    bts_sukhumvit: string;
    bts_silom: string;
    mrt_blue: string;
    mrt_purple: string;
    mrt_pink: string;
    arl: string;
  };
}
