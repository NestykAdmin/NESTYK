import type { FacilityOption, NearbyPlace } from '@nestyk/types';
import { RoomFacilitiesEditor } from './RoomFacilitiesEditor';
import { RoomNearbyEditor, type NearbySearch } from './RoomNearbyEditor';
import { RoomEditSectionList } from './RoomEditSectionList';
import { RoomPhotoCompareModal } from './RoomPhotoCompareModal';
import { WizardSheetChrome } from './WizardSheetChrome';
import { WizardSheetFooter } from './WizardSheetFooter';
import { ContactListRow } from './ContactListRow';
import { SelectedContactCard } from './SelectedContactCard';
import { relocateNearby, isCustomPlace } from '../nearby';
import {
  detectPromoOutputLocale,
  normalizePromoLocale,
  PROMO_OUTPUT_LOCALE_OPTIONS,
  type PromoOutputLocale,
} from '../promo-locale';
import Animated, { FadeIn } from 'react-native-reanimated';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Pressable,
  Keyboard,
  ActivityIndicator,
  ScrollView,
  Modal,
  BackHandler,
  Image,
  TextInput,
  Platform,
  type LayoutChangeEvent,
} from 'react-native';
import { localizedError, useLocale } from '@nestyk/i18n';
import {
  MobileButton,
  MobileInput,
  MobileIcon,
  MobileBottomSheet,
  MobileActionSheetBody,
  MobilePhotoViewer,
  MobileAiQuotaAction,
  MobileNestykHatchLoader,
  SelectionChip,
  SelectionCheck,
  tokens,
  getCardElevation,
} from '@nestyk/ui/native';
import { ListingEngineConfig } from '../config';
import {
  LISTING_SOURCE_OPTIONS,
  SOURCE_IDLE_BORDER,
  SOURCE_SELECT_BG,
  SOURCE_SELECT_BORDER,
  type ListingSourceCode,
} from '../listing-source';
import { formatBedroomSpec } from '../bedroom-label';
import { PlaceDetails, PlaceSuggestion } from '../places';
import { PropertyPlaceMap } from './PropertyPlaceMap';
import { MoveInDateField, todayIsoDate, clampMoveInDate } from './MoveInDateField';

export type { ListingSourceCode };

const CREATE_STEPS = [1, 2, 5, 8, 6];
const EDIT_STEPS = [1, 2, 5, 8, 6, 3, 4, 7];
/** Required before save on create hub (photos optional). Promo copy is edit-only. */
const CREATE_REQUIRED_STEPS = [1, 2, 5, 8];
const OWNER_NOTE_MAX = 200;
const DEFAULT_MAP = { latitude: 13.7563, longitude: 100.5018 };
const ADVANCE_MONTH_OPTIONS = [0, 1, 2] as const;
const DEPOSIT_MONTH_OPTIONS = [1, 2, 3] as const;
const PHOTO_GRID_GAP = 10;
/** Suggested only when opening Add lease the first time — not pre-committed on create. */
const SUGGESTED_ADVANCE_MONTHS = 1;
const SUGGESTED_DEPOSIT_MONTHS = 2;
const MAX_ROOM_CONTACTS = 2;
const PROMO_TITLE_MAX = 100;
const PROMO_DESC_MAX = 1200;

/** Fit text to max length without cutting mid-word when possible. */
function softFitText(value: string, max: number): { text: string; truncated: boolean } {
  const raw = value.trim();
  if (raw.length <= max) return { text: raw, truncated: false };
  const sliced = raw.slice(0, max);
  const breakAt = Math.max(
    sliced.lastIndexOf('\n'),
    sliced.lastIndexOf('. '),
    sliced.lastIndexOf('。'),
    sliced.lastIndexOf(' '),
  );
  const text = (breakAt > max * 0.55 ? sliced.slice(0, breakAt) : sliced).trim();
  return { text: text || sliced.trim(), truncated: true };
}

type RoomContactSelection = {
  key: string;
  id?: number;
  name: string;
  phone: string;
  lineId?: string;
  facebook?: string;
  roomCount?: number;
};

function roomContactKey(id?: number, phone?: string) {
  if (id != null) return `id:${id}`;
  return `new:${String(phone ?? '').replace(/\D/g, '')}`;
}

export type ContactOption = {
  id: number;
  name: string;
  phone: string;
  lineId?: string | null;
  facebook?: string | null;
  note?: string | null;
  roomCount?: number;
};

/** @deprecated use ContactOption */
export type PropertyOwnerOption = ContactOption;

export type PropertyTypeOption = {
  id: number;
  code: string;
};

export type ContractTypeOption = {
  id: number;
  code: string;
  termMonths: number;
};

export type RoomTypeOption = {
  id: number;
  code: string;
  bedroomCount: number | null;
};

export type CreateRoomWizardSubmitData = {
  visibility: 'private' | 'published';
  listingDescription?: string;
  availableFromDate?: string;
  property: {
    name: string;
    address: string;
    district: string;
    province: string;
    propertyTypeId: number;
    subdistrict?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
  };
  contactId?: number;
  /** Up to 2 existing contact ids (first = primary). */
  contactIds?: number[];
  contact?: {
    name: string;
    phone: string;
    lineId?: string;
    facebook?: string;
    note?: string;
  };
  /** New contacts without id (created on save). Combined with contactIds ≤ 2. */
  contacts?: Array<{
    name: string;
    phone: string;
    lineId?: string;
    facebook?: string;
    note?: string;
  }>;
  /** Prefill for edit UI (id optional for unsaved drafts). */
  selectedContacts?: Array<{
    id?: number;
    name: string;
    phone: string;
    lineId?: string;
    facebook?: string;
    roomCount?: number;
  }>;
  /** Agent-only internal name. */
  listingTitle: string;
  /** Public share headline (edit / promo). */
  promoTitle?: string;
  listingSourceCode: ListingSourceCode;
  roomTypeId?: number;
  roomId?: string;
  waterRatePerUnit?: number;
  electricRatePerUnit?: number;
  prices: Array<{ contractTypeId: number; price: number; advanceRentMonths?: number; depositMonths?: number }>;
  advanceRentMonths: number;
  depositMonths: number;
  layout: Array<{ code: string; value: string }>;
  facilities: FacilityOption[];
  customFacilities?: string[];
  nearbyPlaces?: NearbyPlace[];
  /** @deprecated Free-text notes UI removed — omit on submit to preserve existing DB value. */
  nearbyOther?: string;
  medias: Array<{
    mediaUrl: string;
    category: 'room';
    isCover?: boolean;
    sortOrder: number;
  }>;
  /** @deprecated Documents UI removed — always submit []. */
  documents: Array<{ kind: 'id_passport' | 'bookbank' | 'ownership' | 'other'; mediaUrl: string; sortOrder: number }>;
  promoCopyStale?: boolean;
  isScoutRoom: true;
  latitude?: number;
  longitude?: number;
};

export type RoomPhoto = {
  uri: string;
  name: string;
  mimeType: string;
  file?: Blob;
  mediaUrl?: string;
  /** Local or remote URI before AI enhance (for before/after). */
  originalUri?: string;
};

export interface MobileCreateListingWizardBodyProps {
  initialData?: CreateRoomWizardSubmitData;
  title?: string;
  submitLabel?: string;
  onSubmittingChange?: (busy: boolean) => void;
  /**
   * Parent (shell back / Android back) should call this first.
   * Returns true when the wizard consumed the back (section → hub → source).
   */
  backHandlerRef?: React.MutableRefObject<(() => boolean) | null>;
  /** Edit mode: called after user confirms discarding unsaved changes. */
  onAbandonUnsaved?: () => void;
  /**
   * Sync shell header title: section names on drill-in, "Add room" on hub/source.
   */
  onHeaderTitleChange?: (title: string) => void;
  pickPhotos?: (limit: number) => Promise<RoomPhoto[]>;
  uploadPhoto?: (photo: RoomPhoto) => Promise<string>;
  enhancePhoto?: (photo: RoomPhoto) => Promise<RoomPhoto>;
  config: ListingEngineConfig;
  onSubmitListing?: (data: CreateRoomWizardSubmitData) => void | Promise<void>;
  searchPlaces?: (query: string) => Promise<PlaceSuggestion[]>;
  getPlaceDetails?: (placeId: string) => Promise<PlaceDetails>;
  reverseGeocode?: (latitude: number, longitude: number) => Promise<PlaceDetails>;
  listContacts?: () => Promise<ContactOption[]>;
  listPropertyTypes?: () => Promise<PropertyTypeOption[]>;
  listContractTypes?: () => Promise<ContractTypeOption[]>;
  listRoomTypes?: () => Promise<RoomTypeOption[]>;
  listFacilities?: () => Promise<FacilityOption[]>;
  searchNearby?: NearbySearch;
  mapsApiKey?: string;
  generateListingPromo?: (input: {
    locale: string;
    outputLocale?: string;
    listing: Record<string, unknown>;
    signal?: AbortSignal;
  }) => Promise<{ listingTitle: string; listingDescription: string }>;
}

function nativeElevation(level: 1 | 2 | 3) {
  const { boxShadow: _webOnly, ...rest } = getCardElevation(level);
  return rest;
}

function interpolate(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replace(`{${key}}`, String(value)),
    template,
  );
}

function formatBaht(value: number) {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function monthChipLabel(months: number, noneLabel: string, monthsTemplate: string) {
  if (months === 0) return noneLabel;
  if (months === 1 && monthsTemplate === '{months} months') return '1 month';
  return interpolate(monthsTemplate, { months });
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function isFilledCount(value: string) {
  return /^\d+$/.test(value.trim());
}

/** Dev mock — replace with API quota when backend is ready. */
const MOCK_AI_ENHANCE_LIMIT = 10;
const MOCK_AI_PROMO_LIMIT = 10;

type PromoAiPhase = 'closed' | 'generating' | 'ready' | 'failed';
type PromoFailKind = 'overload' | 'generic';

function isPromoOverloadError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /AI_OVERLOAD|high demand|resource.?exhausted|\b503\b|\b429\b|busy|unavailable|timed out/i.test(
    message,
  );
}

export const MobileCreateListingWizardBody: React.FC<
  MobileCreateListingWizardBodyProps
> = ({
  config,
  initialData,
  title,
  submitLabel,
  onSubmittingChange,
  backHandlerRef,
  onAbandonUnsaved,
  onHeaderTitleChange,
  pickPhotos,
  uploadPhoto,
  enhancePhoto,
  onSubmitListing,
  searchPlaces,
  getPlaceDetails,
  reverseGeocode,
  listContacts,
  listPropertyTypes,
  listContractTypes,
  listRoomTypes,
  listFacilities,
  searchNearby,
  mapsApiKey,
  generateListingPromo,
}) => {
  const { t, locale } = useLocale();
  const cr = t.agent.createRoom;
  const accent = tokens.colors.brand[500];
  const accentInk = tokens.colors.primary;

  const [step, setStep] = useState(1);
  const [description, setDescription] = useState('');
  const [promoTitle, setPromoTitle] = useState('');
  const [availableFrom, setAvailableFrom] = useState(todayIsoDate);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [customFacilities, setCustomFacilities] = useState('');
  const [facilities, setFacilities] = useState<CreateRoomWizardSubmitData['facilities']>([]);
  const [facilityOptions, setFacilityOptions] = useState<FacilityOption[]>([]);
  const [facilityError, setFacilityError] = useState('');
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [promoStale, setPromoStale] = useState(false);
  const [promoFingerprint, setPromoFingerprint] = useState<string | null>(null);
  const [generatingPromo, setGeneratingPromo] = useState(false);
  const [promoPreviewOpen, setPromoPreviewOpen] = useState(false);
  const [promoAiPhase, setPromoAiPhase] = useState<PromoAiPhase>('closed');
  const [promoFailKind, setPromoFailKind] = useState<PromoFailKind>('generic');
  const [promoDraft, setPromoDraft] = useState<{
    listingTitle: string;
    listingDescription: string;
  } | null>(null);
  const [promoOutputLocale, setPromoOutputLocale] = useState<PromoOutputLocale>(() =>
    normalizePromoLocale(locale),
  );
  const [promoLocaleTouched, setPromoLocaleTouched] = useState(false);
  const promoAbortRef = useRef<AbortController | null>(null);
  const loadFacilities = async () => {
    if (!listFacilities) return;
    setFacilitiesLoading(true); setFacilityError('');
    try { setFacilityOptions(await listFacilities()); }
    catch { setFacilityError(cr.detailsLoadError); }
    finally { setFacilitiesLoading(false); }
  };
  useEffect(() => { if (initialData) void loadFacilities(); }, [listFacilities, !!initialData]);

  useEffect(() => {
    if (step !== 7 || promoLocaleTouched) return;
    const facilityLabels = facilities.map((f) => t.masters.facilities[f.code] ?? f.code);
    setPromoOutputLocale(
      detectPromoOutputLocale(
        [
          propertyName,
          address,
          district,
          promoTitle,
          description,
          customFacilities,
          ...facilityLabels,
          ...nearbyPlaces.map((p) => p.name),
        ],
        locale,
      ),
    );
  }, [
    step,
    promoLocaleTouched,
    propertyName,
    address,
    district,
    promoTitle,
    description,
    customFacilities,
    facilities,
    nearbyPlaces,
    locale,
    t.masters.facilities,
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [propertyName, setPropertyName] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [province, setProvince] = useState('');
  const [subdistrict, setSubdistrict] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [propertyTypeId, setPropertyTypeId] = useState<number | null>(null);
  const [propertyTypes, setPropertyTypes] = useState<PropertyTypeOption[]>([]);
  const [propertyTypesLoading, setPropertyTypesLoading] = useState(false);
  const [propertyTypesError, setPropertyTypesError] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState('');
  const [hasSearchedPlaces, setHasSearchedPlaces] = useState(false);
  const [pinResolving, setPinResolving] = useState(false);
  const [placeEntryMode, setPlaceEntryMode] = useState<'search' | 'manual'>('search');
  const [addressFromPlace, setAddressFromPlace] = useState(false);
  const skipPlacesSearch = useRef(false);
  const placesSeq = useRef(0);
  const searchPlacesRef = useRef(searchPlaces);
  const getPlaceDetailsRef = useRef(getPlaceDetails);
  const reverseGeocodeRef = useRef(reverseGeocode);
  const pinResolveSeq = useRef(0);
  const listContactsRef = useRef(listContacts);
  const listPropertyTypesRef = useRef(listPropertyTypes);
  const listContractTypesRef = useRef(listContractTypes);
  const listRoomTypesRef = useRef(listRoomTypes);
  const formScrollRef = useRef<ScrollView>(null);
  searchPlacesRef.current = searchPlaces;
  getPlaceDetailsRef.current = getPlaceDetails;
  reverseGeocodeRef.current = reverseGeocode;
  listContactsRef.current = listContacts;
  listPropertyTypesRef.current = listPropertyTypes;
  listContractTypesRef.current = listContractTypes;
  listRoomTypesRef.current = listRoomTypes;
  const [listingTitle, setListingTitle] = useState('');
  const [listingSourceCode, setListingSourceCode] = useState<ListingSourceCode | null>(
    initialData?.listingSourceCode ?? null,
  );
  const [sourceDraft, setSourceDraft] = useState<ListingSourceCode | null>(
    initialData?.listingSourceCode ?? null,
  );
  const [roomId, setRoomId] = useState('');
  const [floor, setFloor] = useState('');
  const [building, setBuilding] = useState('');
  const [roomTypeId, setRoomTypeId] = useState<number | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [roomTypesLoading, setRoomTypesLoading] = useState(false);
  const [roomTypesError, setRoomTypesError] = useState('');
  const [layoutSheet, setLayoutSheet] = useState<'roomType' | 'bedroom' | 'bathroom' | null>(
    null,
  );

  const [bedroom, setBedroom] = useState('');
  const [bathroom, setBathroom] = useState('1');
  const [sizeSqm, setSizeSqm] = useState('');

  const [rentsByTypeId, setRentsByTypeId] = useState<Record<string, string>>({});
  const [selectedContractTypeIds, setSelectedContractTypeIds] = useState<number[]>([]);
  const [contractTypes, setContractTypes] = useState<ContractTypeOption[]>([]);
  const [contractTypesLoading, setContractTypesLoading] = useState(false);
  const [contractTypesError, setContractTypesError] = useState('');
  const [advanceRentMonths, setAdvanceRentMonths] = useState<number | null>(null);
  const [depositMonths, setDepositMonths] = useState<number | null>(null);
  const [termsByTypeId, setTermsByTypeId] = useState<Record<string, { advanceRentMonths: number; depositMonths: number }>>({});
  const leaseTerms = (id: number) => termsByTypeId[String(id)] ?? {
    advanceRentMonths: advanceRentMonths ?? SUGGESTED_ADVANCE_MONTHS,
    depositMonths: depositMonths ?? SUGGESTED_DEPOSIT_MONTHS,
  };
  const [leaseSheet, setLeaseSheet] = useState<
    null | { mode: 'add' } | { mode: 'edit'; contractTypeId: number }
  >(null);
  const [draftTermId, setDraftTermId] = useState<number | null>(null);
  const [draftRent, setDraftRent] = useState('');
  const [draftAdvance, setDraftAdvance] = useState(SUGGESTED_ADVANCE_MONTHS);
  const [draftDeposit, setDraftDeposit] = useState(SUGGESTED_DEPOSIT_MONTHS);
  const [leaseSheetError, setLeaseSheetError] = useState('');
  /** Room contact: pick list or create form as bottom sheets. */
  const [contactSheet, setContactSheet] = useState<null | 'pick' | 'create'>(null);
  const [draftContactId, setDraftContactId] = useState<number | null>(null);
  const [contactSheetError, setContactSheetError] = useState('');
  /** Draft fields for New contact sheet only — committed on Use this contact. */
  const [draftOwnerName, setDraftOwnerName] = useState('');
  const [draftOwnerLine, setDraftOwnerLine] = useState('');
  const [draftOwnerFacebook, setDraftOwnerFacebook] = useState('');
  const [draftOwnerPhone, setDraftOwnerPhone] = useState('');
  const [waterRate, setWaterRate] = useState('');
  const [electricRate, setElectricRate] = useState('');

  const [photos, setPhotos] = useState<RoomPhoto[]>([]);
  const photoCount = photos.length;
  const [photoCellSize, setPhotoCellSize] = useState(0);
  const [pickingPhotos, setPickingPhotos] = useState(false);
  const [enhancingUri, setEnhancingUri] = useState<string | null>(null);
  const [enhanceRemaining, setEnhanceRemaining] = useState(MOCK_AI_ENHANCE_LIMIT);
  const [promoRemaining, setPromoRemaining] = useState(MOCK_AI_PROMO_LIMIT);
  const [galleryPreviewIndex, setGalleryPreviewIndex] = useState<number | null>(null);
  const [comparePreviewSide, setComparePreviewSide] = useState<'before' | 'after' | null>(null);
  const [compare, setCompare] = useState<{ sourceUri: string; beforeUri: string; after: RoomPhoto } | null>(null);
  const [photoMenuUri, setPhotoMenuUri] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  /** Hub preview card — only updated when user taps Done on a section (not live drafts / auto defaults). */
  const [hubSnapshot, setHubSnapshot] = useState<{
    listingTitle: string;
    propertyName: string;
    bedroom: string;
    sizeSqm: string;
    roomId: string;
    coverUri: string | null;
  }>({
    listingTitle: '',
    propertyName: '',
    bedroom: '',
    sizeSqm: '',
    roomId: '',
    coverUri: null,
  });
  const submitLock = useRef(false);
  const hubDirtyRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerLine, setOwnerLine] = useState('');
  const [ownerFacebook, setOwnerFacebook] = useState('');
  const [ownerOther, setOwnerOther] = useState('');
  const [ownerMode, setOwnerMode] = useState<'pick' | 'create'>(
    listContacts ? 'pick' : 'create',
  );
  const [ownerQuery, setOwnerQuery] = useState('');
  const [owners, setOwners] = useState<PropertyOwnerOption[]>([]);
  const [ownersLoading, setOwnersLoading] = useState(false);
  const [ownersError, setOwnersError] = useState('');
  const [roomContacts, setRoomContacts] = useState<RoomContactSelection[]>([]);
  const [requiredPrompt, setRequiredPrompt] = useState<string | null>(null);
  /** Required section steps highlighted on hub after a failed Save room. */
  const [hubSaveHighlight, setHubSaveHighlight] = useState<number[]>([]);

  useEffect(() => {
    if (!initialData) return;
    setDescription(initialData.listingDescription ?? '');
    setPromoTitle(initialData.promoTitle ?? '');
    setAvailableFrom(clampMoveInDate(initialData.availableFromDate ?? todayIsoDate()));
    setPromoStale(Boolean(initialData.promoCopyStale));
    setNearbyPlaces(initialData.nearbyPlaces ?? []);
    setCustomFacilities((initialData.customFacilities ?? []).join('\n'));
    setFacilities(initialData.facilities);
    const p = initialData.property;
    setPropertyName(p.name); setAddress(p.address); setDistrict(p.district); setProvince(p.province);
    setSubdistrict(p.subdistrict ?? ''); setPostalCode(p.postalCode ?? ''); setPropertyTypeId(p.propertyTypeId);
    setLatitude(initialData.latitude ?? p.latitude ?? null); setLongitude(initialData.longitude ?? p.longitude ?? null);
    setListingTitle(initialData.listingTitle); setListingSourceCode(initialData.listingSourceCode);

    setRoomId(initialData.roomId ?? ''); setRoomTypeId(initialData.roomTypeId ?? null);
    const values = Object.fromEntries(initialData.layout.map((item) => [item.code, item.value]));
    setBedroom(values.bedroom ?? ''); setBathroom(values.bathroom ?? ''); setSizeSqm(values.room_size ?? '');
    setFloor(values.floor ?? ''); setBuilding(values.building ?? '');
    setRentsByTypeId(Object.fromEntries(initialData.prices.map((price) => [String(price.contractTypeId), String(price.price)])));
    setSelectedContractTypeIds(initialData.prices.map((price) => price.contractTypeId));
    setAdvanceRentMonths(initialData.advanceRentMonths); setDepositMonths(initialData.depositMonths);
    setTermsByTypeId(Object.fromEntries(initialData.prices.map((price) => [String(price.contractTypeId), {
      advanceRentMonths: price.advanceRentMonths ?? initialData.advanceRentMonths ?? SUGGESTED_ADVANCE_MONTHS,
      depositMonths: price.depositMonths ?? initialData.depositMonths ?? SUGGESTED_DEPOSIT_MONTHS,
    }])));
    setWaterRate(initialData.waterRatePerUnit == null ? '' : String(initialData.waterRatePerUnit));
    setElectricRate(initialData.electricRatePerUnit == null ? '' : String(initialData.electricRatePerUnit));
    setPhotos(initialData.medias.map((media) => ({ uri: media.mediaUrl, mediaUrl: media.mediaUrl, name: 'room.jpg', mimeType: 'image/jpeg' })));
    setHubSnapshot({
      listingTitle: (initialData.listingTitle ?? '').trim(),
      propertyName: (p.name ?? '').trim(),
      bedroom: (values.bedroom ?? '').trim(),
      sizeSqm: (values.room_size ?? '').trim(),
      roomId: (initialData.roomId ?? '').trim(),
      coverUri: initialData.medias[0]?.mediaUrl ?? null,
    });
    const seeded: {
      id?: number;
      name: string;
      phone: string;
      lineId?: string;
      facebook?: string;
      roomCount?: number;
    }[] =
      initialData.selectedContacts?.length
        ? initialData.selectedContacts
        : initialData.contactId || initialData.contact
          ? [
              {
                id: initialData.contactId,
                name:
                  initialData.contact?.name ??
                  initialData.selectedContacts?.[0]?.name ??
                  '',
                phone:
                  initialData.contact?.phone ??
                  initialData.selectedContacts?.[0]?.phone ??
                  '',
                lineId: initialData.contact?.lineId,
                facebook: initialData.contact?.facebook,
              },
            ].filter((c) => c.name || c.phone || c.id)
          : [];
    setRoomContacts(
      seeded.slice(0, MAX_ROOM_CONTACTS).map((c) => ({
        key: roomContactKey(c.id, c.phone),
        id: c.id,
        name: c.name,
        phone: c.phone,
        lineId: c.lineId,
        facebook: c.facebook,
        roomCount: c.roomCount,
      })),
    );
    setOwnerMode(seeded.length ? 'pick' : listContacts ? 'pick' : 'create');
    setOwnerName(initialData.contact?.name ?? '');
    setOwnerPhone(initialData.contact?.phone ?? '');
    setOwnerLine(initialData.contact?.lineId ?? '');
    setOwnerFacebook(initialData.contact?.facebook ?? '');
    setOwnerOther(initialData.contact?.note ?? '');
    skipPlacesSearch.current = true;
  }, [initialData, listContacts]);

  const promoInitRef = useRef(false);
  useEffect(() => {
    if (!initialData || promoInitRef.current) return;
    if (!(initialData.promoTitle?.trim() || initialData.listingDescription?.trim())) return;
    promoInitRef.current = true;
    setPromoFingerprint(
      JSON.stringify({
        propertyName: (initialData.property?.name ?? '').trim(),
        address: (initialData.property?.address ?? '').trim(),
        district: (initialData.property?.district ?? '').trim(),
        province: (initialData.property?.province ?? '').trim(),
        bedroom: (initialData.layout?.find((l) => l.code === 'bedroom')?.value ?? '').trim(),
        bathroom: (initialData.layout?.find((l) => l.code === 'bathroom')?.value ?? '').trim(),
        sizeSqm: (initialData.layout?.find((l) => l.code === 'room_size')?.value ?? '').trim(),
        roomTypeId: initialData.roomTypeId ?? null,
        floor: (initialData.layout?.find((l) => l.code === 'floor')?.value ?? '').trim(),
        building: (initialData.layout?.find((l) => l.code === 'building')?.value ?? '').trim(),
        facilities: (initialData.facilities ?? []).map((f) => f.code).sort(),
        customFacilities: (initialData.customFacilities ?? []).join('\n'),
        nearby: (initialData.nearbyPlaces ?? []).map((p) => ({ id: p.placeId ?? p.name, name: p.name })),
        prices: (initialData.prices ?? []).map((p) => ({
          id: p.contractTypeId,
          rent: String(p.price ?? ''),
          advance: p.advanceRentMonths,
          deposit: p.depositMonths,
        })),
        availableFrom: initialData.availableFromDate ?? '',
      }),
    );
  }, [initialData]);

  useEffect(() => {
    if (latitude == null || longitude == null) return;
    setNearbyPlaces((current) => relocateNearby(current, latitude, longitude));
  }, [latitude, longitude]);

  const stepTitle = useMemo(() => {
    const keys = [
      cr.steps.property,
      cr.steps.layout,
      cr.steps.facilities,
      cr.steps.nearby,
      cr.steps.pricing,
      cr.steps.photos,
      cr.detailsTitle,
      cr.steps.ownerVisibility,
    ] as const;
    return keys[step - 1] ?? '';
  }, [cr.steps, step]);

  const sectionHint = useMemo(() => {
    if (step === 1) return cr.propertySectionHint;
    if (step === 2) return cr.layoutSectionHint;
    if (step === 5) return cr.pricingSectionHint;
    if (step === 7) return cr.detailsHint;
    if (step === 8) return cr.roomContactSectionHint;
    return null;
  }, [
    step,
    cr.propertySectionHint,
    cr.layoutSectionHint,
    cr.pricingSectionHint,
    cr.detailsHint,
    cr.roomContactSectionHint,
  ]);

  const roomsLinkedLabel = useCallback(
    (count: number | null | undefined) => {
      const n = count ?? 0;
      if (n <= 0) return cr.ownerRoomsNone;
      if (n === 1) return cr.ownerRoomsOne;
      return interpolate(cr.ownerRoomsCount, { count: n });
    },
    [cr.ownerRoomsNone, cr.ownerRoomsOne, cr.ownerRoomsCount],
  );

  const selectedPropertyTypeCode = useMemo(
    () => propertyTypes.find((opt) => opt.id === propertyTypeId)?.code ?? null,
    [propertyTypes, propertyTypeId],
  );
  const isHouseType = selectedPropertyTypeCode === 'house';
  const nameFieldLabel = isHouseType
    ? cr.propertyNameOrLocationLabel
    : cr.projectOrBuildingLabel;
  const nameFieldPlaceholder = isHouseType
    ? cr.propertyNameOrLocationPlaceholder
    : cr.projectOrBuildingPlaceholder;
  const hasMapPin = latitude != null && longitude != null;
  const areaFieldsEditable =
    placeEntryMode === 'manual' ||
    !searchPlaces ||
    !district.trim() ||
    !province.trim();

  const selectedRoomType = useMemo(
    () => roomTypes.find((item) => item.id === roomTypeId) ?? null,
    [roomTypes, roomTypeId],
  );
  const selectedRoomTypeLabel = useMemo(() => {
    if (!selectedRoomType) return null;
    const labels = t.masters.roomTypes as Record<string, string>;
    return labels[selectedRoomType.code] ?? selectedRoomType.code;
  }, [selectedRoomType, t.masters.roomTypes]);
  /** Fixed by room type (studio / N-bed). Duplex & penthouse stay editable. */
  const bedroomLocked = selectedRoomType?.bedroomCount != null;

  const BEDROOM_OPTIONS = [1, 2, 3, 4, 5] as const;
  const BATHROOM_OPTIONS = [1, 2, 3, 4, 5] as const;

  const fieldLabel = (key: string) => {
    const labels: Record<string, string> = {
      propertyName: nameFieldLabel,
      address: cr.address,
      district: cr.district,
      province: cr.province,
      propertyType: cr.propertyType,
      listingTitle: cr.listingTitle,
      roomType: cr.roomType,
      bedroom: cr.bedroom,
      bathroom: cr.bathroom,
      monthlyRent: cr.monthlyRent,
      contractTerm: cr.contractTerm,
      sizeSqm: cr.sizeSqm,
      ownerName: cr.ownerName,
      ownerPhone: cr.ownerPhone,
      photos: cr.steps.photos,
      ownerPick: cr.ownerPickRequired,
    };
    if (key.startsWith('rent_')) {
      const id = Number(key.slice(5));
      const opt = contractTypes.find((item) => item.id === id);
      if (opt) return interpolate(cr.monthlyRentForTerm, { months: opt.termMonths });
    }
    return labels[key] ?? key;
  };

  const requiredMessage = (key: string) => {
    if (key === 'nearbyPlaces') return cr.invalidNearby;
    if (key === 'availableFrom') return cr.invalidDate;
    if (key === 'documents') return cr.invalidDocumentUrl;
    if (key === 'customFacilities') return cr.customFacilitiesHint;
    if (key === 'photos') return cr.photosMinError;
    if (key === 'ownerPick') return cr.ownerPickRequired;
    if (key === 'contractTerm') return cr.contractTermRequired;
    if (key === 'propertyType') return cr.propertyTypeRequired;
    if (key === 'roomType') return cr.roomTypeRequired;
    return interpolate(cr.requiredFillField, { field: fieldLabel(key) });
  };

  const scrollToTop = () => {
    formScrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  useEffect(() => {
    if (!requiredPrompt) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setRequiredPrompt(null);
      return true;
    });
    return () => sub.remove();
  }, [requiredPrompt]);

  useEffect(() => {
    scrollToTop();
  }, [step, listingSourceCode]);

  const clearFieldError = (key: string) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const closeLeaseSheet = () => {
    setLeaseSheet(null);
    setLeaseSheetError('');
  };

  const closeContactSheet = () => {
    setContactSheet(null);
    setContactSheetError('');
    setDraftOwnerName('');
    setDraftOwnerPhone('');
  };

  /** Create → pick; pick → close. Avoids stacking two Modals. */
  const dismissContactSheetStep = () => {
    if (contactSheet === 'create') {
      setDraftOwnerName('');
      setDraftOwnerPhone('');
      setContactSheetError('');
      setContactSheet('pick');
      return;
    }
    closeContactSheet();
  };

  const openPickContactSheet = () => {
    setDraftContactId(null);
    setOwnerQuery('');
    setContactSheetError('');
    setContactSheet('pick');
  };

  const openCreateContactSheet = () => {
    if (roomContacts.length >= MAX_ROOM_CONTACTS) {
      setContactSheetError(cr.roomContactsFull);
      setContactSheet('pick');
      return;
    }
    // Same sheet — swap content only (no second Modal).
    setDraftOwnerName('');
    setDraftOwnerPhone('');
    setContactSheetError('');
    setContactSheet('create');
  };

  const openAddLease = () => {
    const isFirstLease = selectedContractTypeIds.length === 0;
    setDraftTermId(null);
    setDraftRent('');
    setDraftAdvance(
      isFirstLease || advanceRentMonths == null
        ? SUGGESTED_ADVANCE_MONTHS
        : advanceRentMonths,
    );
    setDraftDeposit(
      isFirstLease || depositMonths == null
        ? SUGGESTED_DEPOSIT_MONTHS
        : depositMonths,
    );
    setLeaseSheetError('');
    setLeaseSheet({ mode: 'add' });
  };

  const openEditLease = (contractTypeId: number) => {
    setDraftTermId(contractTypeId);
    setDraftRent(rentsByTypeId[String(contractTypeId)] ?? '');
    setDraftAdvance(leaseTerms(contractTypeId).advanceRentMonths);
    setDraftDeposit(leaseTerms(contractTypeId).depositMonths);
    setLeaseSheetError('');
    setLeaseSheet({ mode: 'edit', contractTypeId });
  };

  const commitLeaseSheet = () => {
    if (draftTermId == null) {
      setLeaseSheetError(cr.leaseLengthRequired);
      return;
    }
    const rent = draftRent.trim();
    if (!rent || !(Number(rent) > 0)) {
      setLeaseSheetError(cr.rentAmountRequired);
      return;
    }
    if (leaseSheet?.mode === 'add' && !selectedContractTypeIds.includes(draftTermId)) {
      setSelectedContractTypeIds((prev) =>
        contractTypes.map((opt) => opt.id).filter((id) => prev.includes(id) || id === draftTermId),
      );
    }
    setRentsByTypeId((prev) => ({ ...prev, [String(draftTermId)]: rent }));
    setTermsByTypeId((prev) => ({ ...prev, [String(draftTermId)]: {
      advanceRentMonths: draftAdvance, depositMonths: draftDeposit,
    } }));
    clearFieldError('contractTerm');
    clearFieldError(`rent_${draftTermId}`);
    closeLeaseSheet();
  };

  const removeLeaseFromSheet = () => {
    if (leaseSheet?.mode !== 'edit') return;
    const id = leaseSheet.contractTypeId;
    const remaining = selectedContractTypeIds.filter((item) => item !== id);
    setSelectedContractTypeIds(remaining);
    setTermsByTypeId((prev) => {
      const next = { ...prev };
      delete next[String(id)];
      return next;
    });
    setRentsByTypeId((prev) => {
      const next = { ...prev };
      delete next[String(id)];
      return next;
    });
    if (remaining.length === 0) {
      setAdvanceRentMonths(null);
      setDepositMonths(null);
    }
    clearFieldError('contractTerm');
    clearFieldError(`rent_${id}`);
    closeLeaseSheet();
  };

  const renderMonthChips = (
    options: readonly number[],
    value: number,
    onChange: (months: number) => void,
    monthlyRent?: number,
  ) => (
    <View style={styles.termRow}>
      {options.map((months) => {
        const selected = value === months;
        const amount =
          monthlyRent && monthlyRent > 0 && months > 0 ? monthlyRent * months : null;
        return (
          <SelectionChip
            key={months}
            label={monthChipLabel(months, cr.monthsNone, cr.contractMonths)}
            subtitle={
              amount != null
                ? interpolate(cr.thbAmount, { amount: formatBaht(amount) })
                : undefined
            }
            selected={selected}
            onPress={() => onChange(months)}
            accentColor={accent}
            inkColor={tokens.colors.primary}
            style={styles.termChipGrow}
          />
        );
      })}
    </View>
  );

  useEffect(() => {
    if (!searchPlacesRef.current) return;
    if (placeEntryMode === 'manual') {
      setSuggestions([]);
      setPlacesLoading(false);
      setPlacesError('');
      setHasSearchedPlaces(false);
      return;
    }
    if (skipPlacesSearch.current) {
      skipPlacesSearch.current = false;
      return;
    }

    const query = propertyName.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setPlacesLoading(false);
      setPlacesError('');
      setHasSearchedPlaces(false);
      return;
    }

    let cancelled = false;
    const seq = ++placesSeq.current;
    setPlacesLoading(true);
    const timer = setTimeout(() => {
      const search = searchPlacesRef.current;
      if (!search) return;
      search(query)
        .then((rows) => {
          if (cancelled || seq !== placesSeq.current) return;
          setSuggestions(rows);
          setPlacesError('');
          setHasSearchedPlaces(true);
        })
        .catch((err) => {
          if (cancelled || seq !== placesSeq.current) return;
          setSuggestions([]);
          setPlacesError(localizedError(err, cr.placesError, locale));
          setHasSearchedPlaces(true);
        })
        .finally(() => {
          if (!cancelled && seq === placesSeq.current) setPlacesLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [propertyName, cr.placesError, placeEntryMode]);

  useEffect(() => {
    if (step !== 8) return;
    const loadOwners = listContactsRef.current;
    if (!loadOwners) return;
    let cancelled = false;
    setOwnersLoading(true);
    loadOwners()
      .then((rows) => {
        if (cancelled) return;
        setOwners(rows);
        setOwnersError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setOwners([]);
        setOwnersError(localizedError(err, cr.ownerLoadError, locale));
      })
      .finally(() => {
        if (!cancelled) setOwnersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, cr.ownerLoadError]);

  useEffect(() => {
    const loadTypes = listPropertyTypesRef.current;
    if (!loadTypes) return;
    let cancelled = false;
    setPropertyTypesLoading(true);
    loadTypes()
      .then((rows) => {
        if (cancelled) return;
        setPropertyTypes(rows);
        setPropertyTypesError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setPropertyTypes([]);
        setPropertyTypesError(
          localizedError(err, cr.propertyTypeLoadError, locale),
        );
      })
      .finally(() => {
        if (!cancelled) setPropertyTypesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cr.propertyTypeLoadError]);

  useEffect(() => {
    const loadTypes = listContractTypesRef.current;
    if (!loadTypes) return;
    let cancelled = false;
    setContractTypesLoading(true);
    loadTypes()
      .then((rows) => {
        if (cancelled) return;
        setContractTypes(rows);
        setContractTypesError('');
        setSelectedContractTypeIds((prev) =>
          prev.filter((id) => rows.some((item) => item.id === id)),
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setContractTypes([]);
        setContractTypesError(
          localizedError(err, cr.contractTermRequired, locale),
        );
      })
      .finally(() => {
        if (!cancelled) setContractTypesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cr.contractTermRequired]);

  useEffect(() => {
    const loadTypes = listRoomTypesRef.current;
    if (!loadTypes) return;
    let cancelled = false;
    setRoomTypesLoading(true);
    loadTypes()
      .then((rows) => {
        if (cancelled) return;
        setRoomTypes(rows);
        setRoomTypesError('');
        // Do not auto-select room type / bedroom — wait until user picks and taps Done.
      })
      .catch((err) => {
        if (cancelled) return;
        setRoomTypes([]);
        setRoomTypesError(
          localizedError(err, cr.roomTypeLoadError, locale),
        );
      })
      .finally(() => {
        if (!cancelled) setRoomTypesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cr.roomTypeLoadError, initialData]);

  const selectedOwnerIds = useMemo(
    () =>
      new Set(
        roomContacts
          .map((c) => c.id)
          .filter((id): id is number => id != null),
      ),
    [roomContacts],
  );

  const filteredOwners = useMemo(() => {
    const q = ownerQuery.trim().toLowerCase();
    const qDigits = digitsOnly(ownerQuery);
    return owners.filter((item) => {
      if (selectedOwnerIds.has(item.id)) return false;
      if (!q) return true;
      const nameHit = item.name.toLowerCase().includes(q);
      const phoneHit =
        item.phone.includes(ownerQuery.trim()) ||
        (qDigits.length > 0 && digitsOnly(item.phone).includes(qDigits));
      return nameHit || phoneHit;
    });
  }, [owners, ownerQuery, selectedOwnerIds]);

  const matchedOwnerByPhone = useMemo(() => {
    const phone = digitsOnly(
      contactSheet === 'create' ? draftOwnerPhone : ownerPhone,
    );
    if (contactSheet !== 'create' && ownerMode !== 'create') return null;
    if (phone.length < 8) return null;
    return owners.find((item) => digitsOnly(item.phone) === phone) ?? null;
  }, [
    owners,
    ownerPhone,
    draftOwnerPhone,
    ownerMode,
    contactSheet,
  ]);

  const addRoomContact = (entry: RoomContactSelection) => {
    setRoomContacts((current) => {
      if (current.some((c) => c.key === entry.key)) return current;
      if (current.length >= MAX_ROOM_CONTACTS) return current;
      return [...current, entry].slice(0, MAX_ROOM_CONTACTS);
    });
    clearFieldError('ownerPick');
    clearFieldError('ownerName');
    clearFieldError('ownerPhone');
  };

  const removeRoomContact = (key: string) => {
    setRoomContacts((current) => current.filter((c) => c.key !== key));
  };

  const handleSelectOwner = (item: PropertyOwnerOption) => {
    Keyboard.dismiss();
    if (roomContacts.length >= MAX_ROOM_CONTACTS) {
      setContactSheetError(cr.roomContactsFull);
      return;
    }
    addRoomContact({
      key: roomContactKey(item.id, item.phone),
      id: item.id,
      name: item.name,
      phone: item.phone,
      lineId: item.lineId ?? undefined,
      facebook: item.facebook ?? undefined,
      roomCount: item.roomCount,
    });
    setOwnerMode('pick');
    setOwnerQuery('');
    setDraftOwnerName('');
    setDraftOwnerPhone('');
    setDraftOwnerLine('');
    setDraftOwnerFacebook('');
    setContactSheet(null);
    setContactSheetError('');
  };

  const commitPickContact = () => {
    if (draftContactId == null) {
      setContactSheetError(cr.ownerPickRequired);
      return;
    }
    const item = owners.find((row) => row.id === draftContactId);
    if (!item) {
      setContactSheetError(cr.ownerPickRequired);
      return;
    }
    handleSelectOwner(item);
  };

  const commitCreateContact = () => {
    const name = draftOwnerName.trim();
    const phone = draftOwnerPhone.trim();
    if (!name || !phone) {
      setContactSheetError(cr.required);
      return;
    }
    if (roomContacts.length >= MAX_ROOM_CONTACTS) {
      setContactSheetError(cr.roomContactsFull);
      return;
    }
    if (matchedOwnerByPhone) {
      handleSelectOwner(matchedOwnerByPhone);
      return;
    }
    const key = roomContactKey(undefined, phone);
    if (roomContacts.some((c) => c.key === key || digitsOnly(c.phone) === digitsOnly(phone))) {
      setContactSheetError(cr.ownerFoundExisting);
      return;
    }
    addRoomContact({
      key,
      name,
      phone,
      lineId: draftOwnerLine.trim() || undefined,
      facebook: draftOwnerFacebook.trim() || undefined,
      roomCount: 0,
    });
    setOwnerMode('pick');
    setDraftOwnerName('');
    setDraftOwnerPhone('');
    setDraftOwnerLine('');
    setDraftOwnerFacebook('');
    setContactSheet(null);
    setContactSheetError('');
  };

  const applyPlaceDetails = (details: PlaceDetails, fallbackName?: string) => {
    setPropertyName(details.name || fallbackName || propertyName);
    setAddress(details.address);
    setDistrict(details.district);
    setProvince(details.province);
    setSubdistrict(details.subdistrict || '');
    setPostalCode(details.postalCode || '');
    setLatitude(details.latitude);
    setLongitude(details.longitude);
    setAddressFromPlace(true);
    clearFieldError('propertyName');
    clearFieldError('address');
    if (details.district) clearFieldError('district');
    if (details.province) clearFieldError('province');
    setPlacesError('');
  };

  const handlePinCoordinateChange = async (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    const loadReverse = reverseGeocodeRef.current;
    if (!loadReverse) return;
    const seq = ++pinResolveSeq.current;
    setPinResolving(true);
    try {
      const details = await loadReverse(lat, lng);
      if (seq !== pinResolveSeq.current) return;
      setPropertyName((current) => current.trim() || details.name || current);
      setAddress(details.address);
      setDistrict(details.district);
      setProvince(details.province);
      setSubdistrict(details.subdistrict || '');
      setPostalCode(details.postalCode || '');
      setLatitude(details.latitude);
      setLongitude(details.longitude);
      setAddressFromPlace(true);
      clearFieldError('propertyName');
      clearFieldError('address');
      if (details.district) clearFieldError('district');
      if (details.province) clearFieldError('province');
      setPlacesError('');
    } catch (err) {
      if (seq === pinResolveSeq.current) {
        setPlacesError(localizedError(err, cr.placesError, locale));
      }
    } finally {
      if (seq === pinResolveSeq.current) setPinResolving(false);
    }
  };

  const handleSelectPlace = async (item: PlaceSuggestion) => {
    const loadDetails = getPlaceDetailsRef.current;
    if (!loadDetails) return;
    Keyboard.dismiss();
    skipPlacesSearch.current = true;
    placesSeq.current += 1;
    setSuggestions([]);
    setHasSearchedPlaces(false);
    setPlacesLoading(true);
    try {
      const details = await loadDetails(item.placeId);
      skipPlacesSearch.current = true;
      applyPlaceDetails(details, item.name);
      setPlaceEntryMode('search');
    } catch (err) {
      setPlacesError(localizedError(err, cr.placesError, locale));
    } finally {
      setPlacesLoading(false);
    }
  };

  const collectStepErrors = (current: number): Record<string, string> => {
    const nextErrors: Record<string, string> = {};

    if (current === 1) {
      if (listPropertyTypesRef.current && !propertyTypeId) {
        nextErrors.propertyType = cr.propertyTypeRequired;
      }
      if (!propertyName.trim()) nextErrors.propertyName = cr.required;
      if (!address.trim()) nextErrors.address = cr.required;
      if (!district.trim()) nextErrors.district = cr.required;
      if (!province.trim()) nextErrors.province = cr.required;
    }

    if (current === 2) {
      if (!listingTitle.trim()) nextErrors.listingTitle = cr.required;
      if (listRoomTypesRef.current && !roomTypeId) {
        nextErrors.roomType = cr.roomTypeRequired;
      }
      if (!isFilledCount(bedroom)) nextErrors.bedroom = cr.required;
      if (!isFilledCount(bathroom)) nextErrors.bathroom = cr.required;
      if (sizeSqm.trim() && (!Number.isFinite(Number(sizeSqm)) || Number(sizeSqm) <= 0)) nextErrors.sizeSqm = cr.required;
      if (
        !availableFrom ||
        !/^\d{4}-\d{2}-\d{2}$/.test(availableFrom) ||
        availableFrom < todayIsoDate()
      ) {
        nextErrors.availableFrom = availableFrom && availableFrom < todayIsoDate()
          ? cr.moveInDatePastError
          : cr.invalidDate;
      }
    }

    if (current === 5) {
      if (selectedContractTypeIds.length === 0) nextErrors.contractTerm = cr.contractTermRequired;
      for (const opt of contractTypes) {
        if (!selectedContractTypeIds.includes(opt.id)) continue;
        const value = rentsByTypeId[String(opt.id)] ?? '';
        if (!value.trim() || Number(value) <= 0) {
          nextErrors[`rent_${opt.id}`] = cr.required;
        }
      }
    }

    if (current === 6 && initialData?.visibility === 'published' && photoCount < 5) {
      nextErrors.photos = cr.photosMinError;
    }

    if (current === 8) {
      if (roomContacts.length > 0) {
        // at least one selected contact
      } else if (listContactsRef.current) {
        nextErrors.ownerPick = cr.ownerPickRequired;
      } else {
        if (!ownerName.trim()) nextErrors.ownerName = cr.required;
        if (!ownerPhone.trim()) nextErrors.ownerPhone = cr.required;
      }
    }

    if (current === 7) {
      if (!promoTitle.trim()) nextErrors.promoTitle = cr.required;
    }
    if (current === 3) {
      const custom = customFacilities.split('\n').map((v) => v.trim()).filter(Boolean);
      if (custom.length > 50 || custom.some((v) => v.length > 100)) nextErrors.customFacilities = cr.customFacilitiesHint;
    }
    if (current === 4) {
      const customCount = nearbyPlaces.filter(isCustomPlace).length;
      if (customCount > 5) nextErrors.nearbyPlaces = cr.invalidNearby;
      if (nearbyPlaces.filter((p) => !isCustomPlace(p)).length > 24) nextErrors.nearbyPlaces = cr.invalidNearby;
      if (nearbyPlaces.some((p) => !p.name.trim())) nextErrors.nearbyPlaces = cr.invalidNearby;
      if (nearbyPlaces.length && (latitude == null || longitude == null)) nextErrors.nearbyPlaces = cr.nearbyMissingCoords;
    }
    return nextErrors;
  };

  const validateStep = (current: number): string | null => {
    const nextErrors = collectStepErrors(current);
    setErrors(nextErrors);
    return Object.keys(nextErrors)[0] ?? null;
  };

  // Hub overview (create + edit) or a single section form.
  const [editView, setEditView] = useState<'overview' | 'section'>('overview');
  const pickingSource = !listingSourceCode;
  const showOverview = !!listingSourceCode && editView === 'overview';
  const showSection = !!listingSourceCode && editView === 'section';

  const openSection = (target: number) => {
    setErrors({});
    setStep(target);
    setEditView('section');
  };
  const backToOverview = () => {
    setErrors({});
    setEditView('overview');
  };

  /** Stepwise back only — never exits the create tab (parent handles exit). */
  const handleWizardBack = useCallback(() => {
    if (submitLock.current) return true;
    if (requiredPrompt) {
      setRequiredPrompt(null);
      return true;
    }
    if (contactSheet != null) {
      dismissContactSheetStep();
      return true;
    }
    if (leaseSheet != null) {
      closeLeaseSheet();
      return true;
    }
    if (layoutSheet != null) {
      setLayoutSheet(null);
      return true;
    }
    if (listingSourceCode && editView === 'section') {
      setErrors({});
      setEditView('overview');
      return true;
    }
    if (listingSourceCode && editView === 'overview' && !initialData) {
      setSourceDraft(listingSourceCode);
      setListingSourceCode(null);
      setEditView('overview');
      return true;
    }
    if (listingSourceCode && editView === 'overview' && initialData && hubDirtyRef.current) {
      Alert.alert(cr.setupUnsavedLeaveTitle, cr.setupUnsavedLeaveBody, [
        { text: cr.setupUnsavedLeaveStay, style: 'cancel' },
        {
          text: cr.setupUnsavedLeaveDiscard,
          style: 'destructive',
          onPress: () => onAbandonUnsaved?.(),
        },
      ]);
      return true;
    }
    return false;
  }, [
    requiredPrompt,
    listingSourceCode,
    editView,
    initialData,
    contactSheet,
    leaseSheet,
    layoutSheet,
    cr.setupUnsavedLeaveTitle,
    cr.setupUnsavedLeaveBody,
    cr.setupUnsavedLeaveStay,
    cr.setupUnsavedLeaveDiscard,
    onAbandonUnsaved,
  ]);

  useEffect(() => {
    if (!backHandlerRef) return;
    backHandlerRef.current = handleWizardBack;
    return () => {
      backHandlerRef.current = null;
    };
  }, [backHandlerRef, handleWizardBack]);

  useEffect(() => {
    if (!onHeaderTitleChange) return;
    // Sub-pages: section name in shell header. Hub/source: parent shows Add room.
    onHeaderTitleChange(showSection ? stepTitle : '');
  }, [onHeaderTitleChange, showSection, stepTitle]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => handleWizardBack());
    return () => sub.remove();
  }, [handleWizardBack]);

  const buildPromoFingerprint = () =>
    JSON.stringify({
      propertyName: propertyName.trim(),
      address: address.trim(),
      district: district.trim(),
      province: province.trim(),
      bedroom: bedroom.trim(),
      bathroom: bathroom.trim(),
      sizeSqm: sizeSqm.trim(),
      roomTypeId,
      floor: floor.trim(),
      building: building.trim(),
      facilities: facilities.map((f) => f.code).sort(),
      customFacilities: customFacilities.trim(),
      nearby: nearbyPlaces.map((p) => ({ id: p.placeId ?? p.name, name: p.name })),
      prices: selectedContractTypeIds.map((id) => ({
        id,
        rent: rentsByTypeId[String(id)] ?? '',
        advance: leaseTerms(id).advanceRentMonths,
        deposit: leaseTerms(id).depositMonths,
      })),
      availableFrom,
    });

  const closePromoAiSheet = useCallback(() => {
    promoAbortRef.current?.abort();
    promoAbortRef.current = null;
    setGeneratingPromo(false);
    setPromoAiPhase('closed');
    setPromoDraft(null);
    setPromoFailKind('generic');
  }, []);

  const runPromoGenerate = useCallback(async () => {
    if (!generateListingPromo || generatingPromo) return;
    const abort = new AbortController();
    promoAbortRef.current = abort;
    setPromoDraft(null);
    setPromoFailKind('generic');
    setPromoAiPhase('generating');
    setGeneratingPromo(true);
    try {
      const facilityLabels = facilities.map((f) => t.masters.facilities[f.code] ?? f.code);
      const result = await generateListingPromo({
        locale,
        outputLocale: promoOutputLocale,
        signal: abort.signal,
        listing: {
          propertyName: propertyName.trim(),
          address: address.trim(),
          district: district.trim(),
          province: province.trim(),
          subdistrict: subdistrict.trim(),
          roomId: roomId.trim() || undefined,
          floor: floor.trim() || undefined,
          building: building.trim() || undefined,
          bedroom: bedroom.trim() || undefined,
          bathroom: bathroom.trim() || undefined,
          sizeSqm: sizeSqm.trim() || undefined,
          roomTypeCode: selectedRoomType?.code,
          facilityLabels,
          customFacilities: customFacilities
            .split('\n')
            .map((v) => v.trim())
            .filter(Boolean),
          nearbyPlaces: nearbyPlaces.map((p) => ({
            name: p.name,
            distanceMeters: p.distanceMeters,
            type: p.type,
          })),
          prices: selectedContractTypeIds.map((id) => {
            const opt = contractTypes.find((c) => c.id === id);
            return {
              contractTypeCode: opt?.code,
              termMonths: opt?.termMonths,
              price: Number(rentsByTypeId[String(id)]) || undefined,
              advanceRentMonths: leaseTerms(id).advanceRentMonths,
              depositMonths: leaseTerms(id).depositMonths,
            };
          }),
          availableFromDate: availableFrom || undefined,
        },
      });
      if (abort.signal.aborted || promoAbortRef.current !== abort) return;
      setPromoDraft({
        listingTitle: result.listingTitle.trim(),
        listingDescription: result.listingDescription.trim(),
      });
      setPromoAiPhase('ready');
      // Demo quota only — never decrement on failure/overload.
      setPromoRemaining((n) => Math.max(0, n - 1));
    } catch (err) {
      if (abort.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        return;
      }
      if (promoAbortRef.current !== abort) return;
      setPromoFailKind(isPromoOverloadError(err) ? 'overload' : 'generic');
      setPromoAiPhase('failed');
      setPromoDraft(null);
    } finally {
      if (promoAbortRef.current === abort) {
        promoAbortRef.current = null;
        setGeneratingPromo(false);
      }
    }
  }, [
    address,
    availableFrom,
    bathroom,
    bedroom,
    building,
    contractTypes,
    customFacilities,
    district,
    facilities,
    floor,
    generateListingPromo,
    generatingPromo,
    leaseTerms,
    locale,
    nearbyPlaces,
    promoOutputLocale,
    propertyName,
    province,
    rentsByTypeId,
    roomId,
    selectedContractTypeIds,
    selectedRoomType?.code,
    sizeSqm,
    subdistrict,
    t.masters.facilities,
  ]);

  const finishSection = () => {
    const invalid = validateStep(step);
    if (invalid) {
      setRequiredPrompt(requiredMessage(invalid));
      return;
    }
    const applyDone = () => {
      if (step === 7) {
        const titleFit = softFitText(promoTitle, PROMO_TITLE_MAX);
        const descFit = softFitText(description, PROMO_DESC_MAX);
        if (titleFit.truncated || descFit.truncated) {
          setPromoTitle(titleFit.text);
          setDescription(descFit.text);
        }
        setPromoFingerprint(buildPromoFingerprint());
        setPromoStale(false);
      }
      setHubSnapshot((prev) => {
        const next = { ...prev };
        if (step === 1) {
          next.propertyName = propertyName.trim();
        }
        if (step === 2) {
          next.listingTitle = listingTitle.trim();
          next.bedroom = bedroom.trim();
          next.sizeSqm = sizeSqm.trim();
          next.roomId = roomId.trim();
        }
        if (step === 6) {
          next.coverUri = photos[0]?.uri ?? null;
        }
        if (step === 7) {
          // Hub preview keeps agent listingTitle; promo is edit-only.
        }
        return next;
      });
      setHubSaveHighlight((prev) => prev.filter((id) => id !== step));
      backToOverview();
    };

    const hasPromo = promoTitle.trim().length > 0 || description.trim().length > 0;
    const fingerprint = buildPromoFingerprint();
    const sourceChanged =
      step !== 7 &&
      hasPromo &&
      promoFingerprint != null &&
      fingerprint !== promoFingerprint;

    if (sourceChanged) {
      setPromoStale(true);
    }
    applyDone();
  };

  const sectionHasData = (current: number): boolean => {
    if (current === 1) return propertyName.trim().length > 0;
    if (current === 2) return listingTitle.trim().length > 0 || isFilledCount(bedroom);
    if (current === 3) return facilities.length > 0 || customFacilities.trim().length > 0;
    if (current === 4) return nearbyPlaces.length > 0;
    if (current === 5) return selectedContractTypeIds.length > 0;
    if (current === 6) return photoCount > 0;
    if (current === 7) return promoTitle.trim().length > 0 || description.trim().length > 0;
    if (current === 8) {
      if (roomContacts.length > 0) return true;
      return ownerName.trim().length > 0 && ownerPhone.trim().length > 0;
    }
    return true;
  };

  const sectionSummary = (current: number): string => {
    const ov = cr.editOverview;
    if (current === 1) {
      const bits = [propertyName.trim(), district.trim() || province.trim()].filter(Boolean);
      return bits.length ? bits.join(' · ') : ov.sectionHints.property;
    }
    if (current === 2) {
      const bits = [
        formatBedroomSpec(
          bedroom.trim(),
          {
            studio: t.masters.roomTypes.studio,
            one: t.agent.listings.specBed,
            many: t.agent.listings.specBeds,
          },
          selectedRoomType?.code,
        ) ?? '',
        sizeSqm.trim() ? `${sizeSqm.trim()} sqm` : '',
      ].filter(Boolean);
      return bits.length ? bits.join(' · ') : ov.sectionHints.layout;
    }
    if (current === 3) {
      const count = facilities.length + (customFacilities.trim() ? customFacilities.split(/[\n,]/).filter((s) => s.trim()).length : 0);
      return count > 0 ? interpolate(cr.setupFacilitiesCount, { count }) : ov.sectionHints.facilities;
    }
    if (current === 4) {
      return nearbyPlaces.length > 0
        ? interpolate(cr.setupNearbyCount, { count: nearbyPlaces.length })
        : ov.sectionHints.nearby;
    }
    if (current === 5) {
      if (!selectedContractTypeIds.length) return ov.sectionHints.pricing;
      const prices = selectedContractTypeIds.map((id) => Number(rentsByTypeId[String(id)])).filter((price) => price > 0);
      return prices.length ? interpolate(cr.leaseSummary, {
        count: selectedContractTypeIds.length,
        amount: formatBaht(Math.min(...prices)),
      }) : ov.sectionHints.pricing;
    }
    if (current === 6) {
      return interpolate(cr.photosOptionalStatus, { count: photoCount });
    }
    if (current === 7) {
      if (promoStale) return cr.promoStaleBadge;
      if (promoTitle.trim()) return promoTitle.trim();
      if (description.trim()) return description.trim().slice(0, 48);
      return ov.sectionHints.details;
    }
    if (current === 8) {
      const role =
        listingSourceCode === 'owner'
          ? cr.sourceOwnerShort
          : listingSourceCode === 'co_agent'
            ? cr.sourceCoAgentShort
            : '';
      if (roomContacts.length) {
        const names = roomContacts.map((c) => c.name).join(' · ');
        return role ? `${names} · ${role}` : names;
      }
      if (ownerName.trim()) {
        const base = `${ownerName.trim()}${ownerPhone.trim() ? ` · ${ownerPhone.trim()}` : ''}`;
        return role ? `${base} · ${role}` : base;
      }
      return ov.sectionHints.contact;
    }
    return '';
  };

  // Error keys that describe an invalid value rather than a missing field.
  const NON_FIELD_KEYS = ['nearbyPlaces', 'availableFrom', 'documents', 'customFacilities', 'ownerPick'];

  const hubSteps = initialData ? EDIT_STEPS : CREATE_STEPS;
  const requiredHubSteps = initialData ? EDIT_STEPS.filter((s) => ![3, 4, 6, 7].includes(s)) : CREATE_REQUIRED_STEPS;

  const editSections = (() => {
    if (!listingSourceCode && !initialData) return [];
    const ov = cr.editOverview;
    const defs: Array<{
      step: number;
      icon: 'buildings' | 'bed' | 'camera' | 'coins' | 'sparkle' | 'map-pin' | 'note' | 'user';
      label: string;
      optional?: boolean;
      group: 'room' | 'listing';
    }> = [
      { step: 1, icon: 'buildings', label: cr.steps.property, group: 'room' },
      { step: 2, icon: 'bed', label: cr.steps.layout, group: 'room' },
      { step: 5, icon: 'coins', label: cr.steps.pricing, group: 'room' },
      { step: 8, icon: 'user', label: cr.sourceSection, group: 'room' },
      { step: 6, icon: 'camera', label: cr.steps.photos, optional: true, group: 'listing' },
      { step: 3, icon: 'sparkle', label: cr.steps.facilities, group: 'listing' },
      { step: 4, icon: 'map-pin', label: cr.steps.nearby, group: 'listing' },
      { step: 7, icon: 'note', label: cr.detailsTitle, optional: true, group: 'listing' },
    ];
    return hubSteps.map((stepId) => {
      const def = defs.find((d) => d.step === stepId)!;
      const hint = sectionSummary(def.step) || ov.sectionHints[
        def.step === 1 ? 'property'
          : def.step === 2 ? 'layout'
          : def.step === 5 ? 'pricing'
          : def.step === 6 ? 'photos'
          : def.step === 8 ? 'contact'
          : def.step === 3 ? 'facilities'
          : def.step === 4 ? 'nearby'
          : 'details'
      ];
      const missing = Object.keys(collectStepErrors(def.step));
      const isSaveHighlight = hubSaveHighlight.includes(def.step) && !def.optional;
      const forceHighlight = isSaveHighlight && missing.length > 0;
      if (forceHighlight || (missing.length > 0 && sectionHasData(def.step))) {
        const fieldKeys = missing.filter((key) => !NON_FIELD_KEYS.includes(key));
        const allFields = fieldKeys.length === missing.length;
        // Hub stays short after Save; field lists appear inside the section form.
        const statusLabel = isSaveHighlight
          ? cr.setupSaveIncomplete
          : allFields
            ? interpolate(ov.missingList, { fields: fieldKeys.map(fieldLabel).join(', ') })
            : requiredMessage(missing[0]);
        return {
          ...def,
          hint,
          status: 'incomplete' as const,
          statusLabel,
          detail: statusLabel,
          highlightError: isSaveHighlight,
        };
      }
      if (!sectionHasData(def.step)) {
        let emptyLabel = ov.notAdded;
        if (def.optional) {
          if (def.step === 6) {
            emptyLabel = interpolate(cr.photosOptionalStatus, { count: 0 });
          } else if (def.step === 7) {
            emptyLabel = ov.sectionHints.details;
          }
        }
        return {
          ...def,
          hint,
          status: 'empty' as const,
          statusLabel: isSaveHighlight ? cr.setupSaveIncomplete : emptyLabel,
          detail: ov.notAdded,
          highlightError: isSaveHighlight,
        };
      }
      if (def.step === 7 && promoStale) {
        return {
          ...def,
          hint,
          status: 'stale' as const,
          statusLabel: cr.promoStaleBadge,
          detail: cr.promoStaleBadge,
          highlightError: false,
        };
      }
      return {
        ...def,
        hint,
        status: 'complete' as const,
        statusLabel: ov.complete,
        detail: ov.complete,
        highlightError: false,
      };
    });
  })();
  const emptyOrIncomplete = editSections.filter((s) => s.status !== 'complete');
  const overallCompleteCount = editSections.filter((s) => s.status === 'complete').length;
  const overallTotal = editSections.length;
  const overallProgress = overallTotal > 0 ? overallCompleteCount / overallTotal : 0;
  const requiredCompleteCount = requiredHubSteps.filter((stepId) => {
    const section = editSections.find((s) => s.step === stepId);
    return section?.status === 'complete';
  }).length;
  const saveReady = requiredCompleteCount >= requiredHubSteps.length;
  /** After required: prefer listing description, then facilities/nearby, then photos (Create: photos only). */
  const optionalNextOrder = initialData ? [7, 3, 4, 6] : [6];
  const nextHubSection = (() => {
    const byStep = (stepId: number) => editSections.find((s) => s.step === stepId);
    const pick = (stepId: number) => {
      const section = byStep(stepId);
      if (!section || section.status === 'complete') return null;
      const actionLabel =
        section.status === 'empty'
          ? interpolate(cr.setupNextAdd, { section: section.label })
          : interpolate(cr.setupNextComplete, { section: section.label });
      return {
        step: section.step,
        label: actionLabel,
        reason: section.statusLabel || section.hint,
      };
    };
    for (const stepId of hubSaveHighlight) {
      const next = pick(stepId);
      if (next) return next;
    }
    for (const stepId of requiredHubSteps) {
      const next = pick(stepId);
      if (next) return next;
    }
    if (saveReady) {
      for (const stepId of optionalNextOrder) {
        const next = pick(stepId);
        if (next) return next;
      }
      for (const section of emptyOrIncomplete) {
        const next = pick(section.step);
        if (next) return next;
      }
    }
    return null;
  })();
  const hubEncouragement =
    hubSaveHighlight.length > 0
      ? cr.setupSaveMissingBanner
      : nextHubSection
        ? interpolate(cr.setupEncourageNext, {
            section: editSections.find((s) => s.step === nextHubSection.step)?.label ?? nextHubSection.label,
          })
        : overallCompleteCount >= overallTotal && overallTotal > 0
          ? cr.setupAllComplete
          : saveReady
            ? cr.setupReadyToSave
            : overallProgress >= 0.5
              ? cr.setupAlmostThere
              : cr.setupKeepGoing;
  const hubDirty = (() => {
    if (!initialData) return false;
    const p = initialData.property;
    const layoutMap = Object.fromEntries(
      (initialData.layout ?? []).map((item) => [item.code, String(item.value ?? '').trim()]),
    );
    const initPhotos = (initialData.medias ?? [])
      .map((m) => m.mediaUrl)
      .join('|');
    const curPhotos = photos.map((ph) => ph.mediaUrl ?? ph.uri).join('|');
    const initFacilities = (initialData.facilities ?? [])
      .map((f) => f.code)
      .sort()
      .join('|');
    const curFacilities = facilities
      .map((f) => f.code)
      .sort()
      .join('|');
    const initNearby = (initialData.nearbyPlaces ?? [])
      .map((n) => `${n.placeId ?? ''}:${n.name}`)
      .sort()
      .join('|');
    const curNearby = nearbyPlaces
      .map((n) => `${n.placeId ?? ''}:${n.name}`)
      .sort()
      .join('|');
    const initPrices = (initialData.prices ?? [])
      .map(
        (price) =>
          `${price.contractTypeId}:${price.price}:${price.advanceRentMonths ?? ''}:${price.depositMonths ?? ''}`,
      )
      .sort()
      .join('|');
    const curPrices = selectedContractTypeIds
      .map((id) => {
        const terms = termsByTypeId[String(id)];
        return `${id}:${rentsByTypeId[String(id)] ?? ''}:${terms?.advanceRentMonths ?? ''}:${terms?.depositMonths ?? ''}`;
      })
      .sort()
      .join('|');
    const initContactKey = (
      initialData.selectedContacts?.length
        ? initialData.selectedContacts
        : initialData.contactId
          ? [{ id: initialData.contactId }]
          : []
    )
      .map((c) => String(c.id ?? ''))
      .sort()
      .join('|');
    const curContactKey = roomContacts
      .map((c) => (c.id != null ? String(c.id) : `new:${c.phone}`))
      .sort()
      .join('|');
    const customJoined = (initialData.customFacilities ?? []).join('\n');
    const numOrEmpty = (v: number | null | undefined) =>
      v == null || Number.isNaN(Number(v)) ? '' : String(Number(v));

    return (
      propertyName.trim() !== (p?.name ?? '').trim() ||
      address.trim() !== (p?.address ?? '').trim() ||
      district.trim() !== (p?.district ?? '').trim() ||
      province.trim() !== (p?.province ?? '').trim() ||
      subdistrict.trim() !== (p?.subdistrict ?? '').trim() ||
      postalCode.trim() !== (p?.postalCode ?? '').trim() ||
      propertyTypeId !== (p?.propertyTypeId ?? null) ||
      numOrEmpty(latitude) !== numOrEmpty(initialData.latitude ?? p?.latitude) ||
      numOrEmpty(longitude) !== numOrEmpty(initialData.longitude ?? p?.longitude) ||
      listingTitle.trim() !== (initialData.listingTitle ?? '').trim() ||
      roomId.trim() !== (initialData.roomId ?? '').trim() ||
      roomTypeId !== (initialData.roomTypeId ?? null) ||
      bedroom.trim() !== (layoutMap.bedroom ?? '') ||
      bathroom.trim() !== (layoutMap.bathroom ?? '') ||
      sizeSqm.trim() !== (layoutMap.room_size ?? '') ||
      floor.trim() !== (layoutMap.floor ?? '') ||
      building.trim() !== (layoutMap.building ?? '') ||
      availableFrom !== clampMoveInDate(initialData.availableFromDate ?? todayIsoDate()) ||
      promoTitle.trim() !== (initialData.promoTitle ?? '').trim() ||
      description.trim() !== (initialData.listingDescription ?? '').trim() ||
      curPhotos !== initPhotos ||
      curFacilities !== initFacilities ||
      curNearby !== initNearby ||
      customFacilities.trim() !== customJoined.trim() ||
      curPrices !== initPrices ||
      advanceRentMonths !== (initialData.advanceRentMonths ?? null) ||
      depositMonths !== (initialData.depositMonths ?? null) ||
      waterRate.trim() !==
        (initialData.waterRatePerUnit == null ? '' : String(initialData.waterRatePerUnit)) ||
      electricRate.trim() !==
        (initialData.electricRatePerUnit == null
          ? ''
          : String(initialData.electricRatePerUnit)) ||
      listingSourceCode !== (initialData.listingSourceCode ?? null) ||
      curContactKey !== initContactKey ||
      Boolean(promoStale) !== Boolean(initialData.promoCopyStale)
    );
  })();
  hubDirtyRef.current = hubDirty;
  const currentSection = editSections.find((s) => s.step === step);

  const confirmSource = () => {
    if (!sourceDraft) return;
    setListingSourceCode(sourceDraft);
    setEditView('overview');
  };

  const buildPayload = (uploadedPhotos: RoomPhoto[]): CreateRoomWizardSubmitData => {
    const medias = uploadedPhotos.map((photo, i) => ({
      mediaUrl: photo.mediaUrl!,
      category: 'room' as const,
      isCover: i === 0,
      sortOrder: i,
    }));

    const layout = [
      { code: 'bedroom', value: bedroom.trim() },
      { code: 'bathroom', value: bathroom.trim() },
    ];
    if (sizeSqm.trim()) layout.push({ code: 'room_size', value: sizeSqm.trim() });
    if (floor.trim()) layout.push({ code: 'floor', value: floor.trim() });
    if (building.trim()) layout.push({ code: 'building', value: building.trim() });

    const existingIds = roomContacts
      .map((c) => c.id)
      .filter((id): id is number => id != null);
    const newContacts = roomContacts
      .filter((c) => c.id == null)
      .map((c) => ({
        name: c.name.trim(),
        phone: c.phone.trim(),
        lineId: c.lineId?.trim() || undefined,
        facebook: c.facebook?.trim() || undefined,
      }));
    const contactPayload =
      roomContacts.length > 0
        ? {
            contactIds: existingIds.length ? existingIds : undefined,
            contacts: newContacts.length ? newContacts : undefined,
            contactId: existingIds[0],
            contact: newContacts[0],
            selectedContacts: roomContacts.map((c) => ({
              id: c.id,
              name: c.name,
              phone: c.phone,
              lineId: c.lineId,
              facebook: c.facebook,
              roomCount: c.roomCount,
            })),
          }
        : {
            contactId: undefined,
            contactIds: undefined,
            contacts: undefined,
            contact: {
              name: ownerName.trim(),
              phone: ownerPhone.trim(),
              lineId: ownerLine.trim() || undefined,
              facebook: ownerFacebook.trim() || undefined,
              note: ownerOther.trim() || undefined,
            },
            selectedContacts: undefined,
          };

    return {
      ...initialData,
      visibility: initialData?.visibility ?? 'private' as const,
      property: {
        name: propertyName.trim(),
        address: address.trim(),
        district: district.trim(),
        province: province.trim(),
        propertyTypeId: propertyTypeId as number,
        subdistrict: subdistrict.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
      },
      ...contactPayload,
      listingTitle: listingTitle.trim(),
      promoTitle: promoTitle.trim() || undefined,
      listingSourceCode: listingSourceCode as ListingSourceCode,
      roomTypeId: roomTypeId ?? undefined,
      roomId: roomId.trim() || undefined,
      waterRatePerUnit: waterRate.trim() && Number(waterRate) > 0 ? Number(waterRate) : undefined,
      electricRatePerUnit:
        electricRate.trim() && Number(electricRate) > 0 ? Number(electricRate) : undefined,
      prices: selectedContractTypeIds.map((id) => ({
        contractTypeId: id,
        price: Number(rentsByTypeId[String(id)]),
        ...leaseTerms(id),
      })),
      advanceRentMonths: advanceRentMonths ?? SUGGESTED_ADVANCE_MONTHS,
      depositMonths: depositMonths ?? SUGGESTED_DEPOSIT_MONTHS,
      layout,
      listingDescription: description.trim(),
      availableFromDate: clampMoveInDate(availableFrom || todayIsoDate()),
      nearbyPlaces: latitude != null && longitude != null
        ? relocateNearby(nearbyPlaces, latitude, longitude)
        : nearbyPlaces,
      customFacilities: [...new Set(customFacilities.split('\n').map((v) => v.trim()).filter(Boolean))],
      facilities,
      medias,
      documents: [],
      promoCopyStale: promoStale,
      isScoutRoom: true,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
    };
  };

  const handleSubmit = async () => {
    if (!listingSourceCode) return;
    const stepsToValidate = initialData ? requiredHubSteps : CREATE_REQUIRED_STEPS;
    const failedSteps: number[] = [];
    const mergedErrors: Record<string, string> = {};
    for (const current of stepsToValidate) {
      const stepErrors = collectStepErrors(current);
      const keys = Object.keys(stepErrors);
      if (keys.length > 0) {
        failedSteps.push(current);
        Object.assign(mergedErrors, stepErrors);
      }
    }
    if (failedSteps.length > 0) {
      setErrors(mergedErrors);
      setHubSaveHighlight(failedSteps);
      setEditView('overview');
      setRequiredPrompt(null);
      requestAnimationFrame(() => scrollToTop());
      return;
    }

    const hasPromo = promoTitle.trim().length > 0 || description.trim().length > 0;
    if (promoStale && hasPromo) {
      Alert.alert(cr.promoStaleAlertTitle, cr.promoStaleAlertBody, [
        {
          text: cr.promoStaleKeep,
          style: 'cancel',
          onPress: () => {
            void runSubmitListing();
          },
        },
        {
          text: cr.promoStaleEdit,
          onPress: () => {
            openSection(7);
          },
        },
      ]);
      return;
    }

    await runSubmitListing();
  };

  const runSubmitListing = async () => {
    if (submitLock.current) return;
    setHubSaveHighlight([]);
    if (onSubmitListing && (uploadPhoto || photos.every((photo) => photo.mediaUrl))) {
      submitLock.current = true;
      setSubmitting(true);
      onSubmittingChange?.(true);
      setUploadProgress(0);
      try {
        const uploadedPhotos: RoomPhoto[] = [];
        for (const photo of photos) {
          const mediaUrl = photo.mediaUrl ?? await uploadPhoto!(photo);
          uploadedPhotos.push({ ...photo, mediaUrl });
          setPhotos((current) => current.map((item) => item.uri === photo.uri ? { ...item, mediaUrl } : item));
          setUploadProgress(uploadedPhotos.length);
        }
        await onSubmitListing(buildPayload(uploadedPhotos));
      } catch (err) {
        Alert.alert(cr.saveError, localizedError(err, t.common.errorGeneric, locale));
      } finally {
        submitLock.current = false;
        setSubmitting(false);
        onSubmittingChange?.(false);
      }
      return;
    }
    Alert.alert(cr.saveError, cr.photoUnavailable);
  };

  const dismissCompare = useCallback(() => {
    Alert.alert(
      cr.enhanceDiscardConfirmTitle,
      interpolate(cr.enhanceDiscardConfirmBody, {
        remaining: enhanceRemaining,
        limit: MOCK_AI_ENHANCE_LIMIT,
      }),
      [
        { text: cr.enhanceDiscardConfirmStay, style: 'cancel' },
        {
          text: cr.enhanceDiscardConfirmDiscard,
          style: 'destructive',
          onPress: () => setCompare(null),
        },
      ],
    );
  }, [
    cr.enhanceDiscardConfirmBody,
    cr.enhanceDiscardConfirmDiscard,
    cr.enhanceDiscardConfirmStay,
    cr.enhanceDiscardConfirmTitle,
    enhanceRemaining,
  ]);

  const enhanceQuotaShort = interpolate(cr.enhanceQuotaShort, {
    remaining: enhanceRemaining,
    limit: MOCK_AI_ENHANCE_LIMIT,
  });

  const renderNav = () => (
    <View style={styles.footerSolo}>
      <View style={styles.footerNote}>
        <MobileIcon name="warning" size={16} color={tokens.colors.textSecondary} />
        <Text style={styles.footerNoteText}>{cr.sessionSaveNote}</Text>
      </View>
      <MobileButton
        onPress={finishSection}
        disabled={submitting || pickingPhotos || !!enhancingUri}
        style={styles.footerCta}
        textStyle={styles.footerCtaText}
      >
        {cr.sectionDone}
      </MobileButton>
    </View>
  );

  const sourceLabels: Record<ListingSourceCode, string> = {
    co_agent: cr.sourceCoAgent,
    owner: cr.sourceOwner,
  };
  const sourceHints: Record<ListingSourceCode, string> = {
    co_agent: cr.sourceCoAgentHint,
    owner: cr.sourceOwnerHint,
  };

  return (
    <View style={styles.container}>
      <View style={styles.chrome}>
        {pickingSource ? (
          <>
            <Text style={styles.sourcePrompt}>{cr.sourcePrompt}</Text>
            <Text style={styles.sourceLead}>{cr.sourcePromptHint}</Text>
          </>
        ) : showOverview ? (
          <>
            {/* Shell header owns Add/Edit room title — body only shows a short lead. */}
            <Text style={styles.sourceLead}>
              {initialData ? cr.editSections : cr.setupHubHint}
            </Text>
          </>
        ) : showSection ? (
          <>
            {sectionHint ? <Text style={styles.sourceLead}>{sectionHint}</Text> : null}
          </>
        ) : null}
      </View>

      {showOverview ? (
        <Animated.View key="overview" entering={FadeIn.duration(150)} style={styles.formPane}>
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {(hubSnapshot.listingTitle || hubSnapshot.propertyName || hubSnapshot.coverUri) ? (
              <View style={styles.hubPreview}>
                <View style={styles.hubPreviewThumb}>
                  {hubSnapshot.coverUri ? (
                    <Image
                      source={{ uri: hubSnapshot.coverUri, cache: 'reload' }}
                      style={styles.hubPreviewThumbImg}
                    />
                  ) : (
                    <MobileIcon name="buildings" size={26} color={tokens.colors.textSecondary} />
                  )}
                </View>
                <View style={styles.hubPreviewCopy}>
                  <Text style={styles.hubPreviewTitle} numberOfLines={1}>
                    {hubSnapshot.propertyName ||
                      hubSnapshot.listingTitle ||
                      cr.steps.property}
                  </Text>
                  <Text style={styles.hubPreviewMeta} numberOfLines={1}>
                    {[
                      hubSnapshot.roomId
                        ? interpolate(cr.setupRoomMeta, { id: hubSnapshot.roomId })
                        : null,
                      formatBedroomSpec(
                        hubSnapshot.bedroom,
                        {
                          studio: t.masters.roomTypes.studio,
                          one: t.agent.listings.specBed,
                          many: t.agent.listings.specBeds,
                        },
                        selectedRoomType?.code,
                      ),
                      hubSnapshot.sizeSqm ? `${hubSnapshot.sizeSqm} sqm` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || cr.setupHubHint}
                  </Text>
                </View>
              </View>
            ) : null}
            <RoomEditSectionList
              sections={editSections}
              disabled={submitting}
              progress={overallProgress}
              encouragement={hubEncouragement}
              nextSection={nextHubSection}
              nextTitle={cr.setupNextPrefix}
              groupLabels={{
                room: cr.setupGroupRoom,
                listing: cr.setupGroupListing,
              }}
              summaryTone={
                hubSaveHighlight.length > 0
                  ? 'error'
                  : overallCompleteCount >= overallTotal && overallTotal > 0
                    ? 'success'
                    : 'warning'
              }
              summaryLabel={interpolate(cr.setupProgress, {
                done: overallCompleteCount,
                total: overallTotal,
              })}
              onSelect={openSection}
            />
            {hubSaveHighlight.length > 0 ? (
            <View
              style={[
                styles.hubFootnoteRow,
                styles.hubSaveBanner,
              ]}
            >
              <Text
                style={[
                  styles.hubFootnoteIcon,
                  styles.hubSaveBannerIcon,
                ]}
              >
                !
              </Text>
              <Text
                style={[
                  styles.hubFootnote,
                  styles.hubSaveBannerText,
                ]}
              >
                {cr.setupSaveMissingBanner}
              </Text>
            </View>
            ) : null}
          </ScrollView>
          <View style={styles.footer}>
            {initialData ? (
              hubDirty ? (
                <Text style={styles.footerNoteText}>{cr.setupUnsavedChanges}</Text>
              ) : null
            ) : (
              <Text style={styles.footerNoteText}>{cr.visibilityPrivateHint}</Text>
            )}
            <MobileButton
              onPress={handleSubmit}
              isLoading={submitting}
              disabled={submitting || !!enhancingUri}
              style={styles.footerCta}
              textStyle={styles.footerCtaText}
            >
              {submitLabel ?? cr.saveRoom}
            </MobileButton>
          </View>
        </Animated.View>
      ) : pickingSource ? (
        <View style={styles.sourceScreen}>
          <ScrollView contentContainerStyle={{ gap: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={styles.sourceList}>
            {LISTING_SOURCE_OPTIONS.map((opt) => {
              const selected = sourceDraft === opt.code;
              return (
                <Pressable
                  key={opt.code}
                  onPress={() => setSourceDraft(opt.code)}
                  android_ripple={{ color: '#00000014' }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.sourceCard,
                    {
                      borderColor: selected ? SOURCE_SELECT_BORDER : SOURCE_IDLE_BORDER,
                      backgroundColor: selected ? SOURCE_SELECT_BG : tokens.colors.white,
                    },
                    pressed ? { opacity: 0.92 } : null,
                  ]}
                >
                  <View style={[styles.sourceIconWrap, { backgroundColor: opt.iconBg }]}>
                    <MobileIcon
                      name={opt.pickerIcon}
                      size={24}
                      weight="regular"
                      color={opt.iconColor}
                    />
                  </View>
                  <View style={styles.sourceCopy}>
                    <Text style={styles.sourceTitle}>{sourceLabels[opt.code]}</Text>
                    <Text style={styles.sourceHint}>{sourceHints[opt.code]}</Text>
                  </View>
                  <SelectionCheck selected={selected} variant="row" size="md" />
                </Pressable>
              );
            })}
          </View>
          <View style={styles.sourceNoteRow}>
            <Text style={styles.sourceNote}>ⓘ  {cr.sourceNote}</Text>
          </View>
          </ScrollView>
          <View style={styles.sourceFooter}>
            <MobileButton
              onPress={confirmSource}
              disabled={!sourceDraft}
              style={[
                styles.footerCta,
                { backgroundColor: sourceDraft ? accent : '#E9EDF2', opacity: 1 },
              ]}
              textStyle={{
                fontSize: 16,
                lineHeight: 24,
                color: sourceDraft ? accentInk : '#64748B',
              }}
            >
              {cr.next}
            </MobileButton>
          </View>
        </View>
      ) : showSection ? (
        <Animated.View
          key={`section-${step}`}
          entering={FadeIn.duration(150)}
          style={styles.formPane}
        >
      <ScrollView
        ref={formScrollRef}
        style={styles.formScroll}
        contentContainerStyle={styles.formScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formBody}>
          <View style={styles.cardBody}>
          {step === 1 && (
            <>
              <View>
                <Text style={styles.fieldLabel}>
                  {cr.propertyType}
                  <Text style={styles.requiredMark}> *</Text>
                </Text>
              </View>
              {propertyTypesLoading ? (
                <View style={styles.suggestStatus}>
                  <ActivityIndicator size="small" color={accent} />
                  <Text style={styles.suggestStatusText}>{t.common.loading}</Text>
                </View>
              ) : null}
              {propertyTypesError ? (
                <Text style={styles.errorText}>{propertyTypesError}</Text>
              ) : null}
              <View style={styles.propertyTypeRow}>
                {propertyTypes.map((opt) => {
                  const selected = propertyTypeId === opt.id;
                  const labels = t.masters.propertyTypes as Record<string, string>;
                  return (
                    <SelectionChip
                      key={opt.id}
                      label={labels[opt.code] ?? opt.code}
                      selected={selected}
                      onPress={() => {
                        setPropertyTypeId(opt.id);
                        clearFieldError('propertyType');
                      }}
                      accentColor={tokens.colors.brand[500]}
                      inkColor={tokens.colors.primary}
                      style={[
                        styles.propertyTypeChip,
                        !selected && errors.propertyType
                          ? { borderColor: tokens.colors.error }
                          : null,
                      ]}
                      labelStyle={styles.propertyTypeChipText}
                    />
                  );
                })}
              </View>
              {errors.propertyType ? (
                <Text style={styles.errorText}>{errors.propertyType}</Text>
              ) : null}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>
                  {nameFieldLabel}
                  <Text style={styles.requiredMark}> *</Text>
                </Text>
                {placeEntryMode === 'manual' || !searchPlaces ? (
                  <MobileInput
                    placeholder={nameFieldPlaceholder}
                    value={propertyName}
                    autoCorrect={false}
                    autoCapitalize="words"
                    onChangeText={(v) => {
                      setPropertyName(v);
                      clearFieldError('propertyName');
                    }}
                    error={errors.propertyName}
                  />
                ) : (
                  <View
                    style={[
                      styles.searchInputWrap,
                      errors.propertyName ? { borderColor: tokens.colors.error } : null,
                    ]}
                  >
                    <MobileIcon name="search" size={18} color={tokens.colors.textSecondary} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder={nameFieldPlaceholder}
                      placeholderTextColor={tokens.colors.placeholder}
                      value={propertyName}
                      autoCorrect={false}
                      autoCapitalize="words"
                      onChangeText={(v) => {
                        setPropertyName(v);
                        clearFieldError('propertyName');
                      }}
                    />
                    {propertyName.trim().length > 0 ? (
                      <Pressable
                        onPress={() => {
                          setPropertyName('');
                          clearFieldError('propertyName');
                        }}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Clear"
                        style={styles.searchClearBtn}
                      >
                        <MobileIcon name="close" size={16} color={tokens.colors.textSecondary} />
                      </Pressable>
                    ) : null}
                  </View>
                )}
                {placeEntryMode === 'search' && searchPlaces && errors.propertyName ? (
                  <Text style={styles.errorText}>{errors.propertyName}</Text>
                ) : null}
              </View>
              {searchPlaces && placeEntryMode === 'search' ? (
                <>
                  {(placesLoading ||
                    placesError ||
                    suggestions.length > 0 ||
                    hasSearchedPlaces) ? (
                    <View style={styles.suggestBox}>
                      {placesLoading ? (
                        <View style={styles.suggestStatus}>
                          <ActivityIndicator size="small" color={accent} />
                          <Text style={styles.suggestStatusText}>{cr.placesSearching}</Text>
                        </View>
                      ) : null}
                      {placesError ? (
                        <Text style={[styles.errorText, styles.suggestPad]}>{placesError}</Text>
                      ) : null}
                      {!placesLoading &&
                      hasSearchedPlaces &&
                      suggestions.length === 0 &&
                      !placesError ? (
                        <Text style={[styles.suggestStatusText, styles.suggestPad]}>
                          {cr.placesEmpty}
                        </Text>
                      ) : null}
                      {suggestions.map((item, index) => (
                        <Pressable
                          key={item.placeId}
                          onPress={() => handleSelectPlace(item)}
                          android_ripple={{ color: '#00000014' }}
                          style={[
                            styles.suggestRow,
                            index === 0 && !placesLoading && !placesError
                              ? { borderTopWidth: 0 }
                              : null,
                          ]}
                        >
                          <Text style={styles.suggestName}>{item.name}</Text>
                          {item.address ? (
                            <Text style={styles.suggestAddress}>{item.address}</Text>
                          ) : null}
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => {
                      placesSeq.current += 1;
                      setPlaceEntryMode('manual');
                      setSuggestions([]);
                      setHasSearchedPlaces(false);
                      setPlacesError('');
                      setPlacesLoading(false);
                    }}
                    accessibilityRole="button"
                    hitSlop={6}
                    style={styles.manualEntryRow}
                  >
                    <Text style={styles.manualEntryLink}>{cr.enterManually}</Text>
                    <MobileIcon name="chevron-right" size={16} color={tokens.colors.accent} />
                  </Pressable>
                </>
              ) : searchPlaces ? (
                <Pressable
                  onPress={() => setPlaceEntryMode('search')}
                  accessibilityRole="button"
                  hitSlop={6}
                  style={styles.manualEntryRow}
                >
                  <Text style={styles.manualEntryLink}>{cr.searchOnMap}</Text>
                  <MobileIcon name="chevron-right" size={16} color={tokens.colors.accent} />
                </Pressable>
              ) : null}
              <PropertyPlaceMap
                latitude={latitude ?? DEFAULT_MAP.latitude}
                longitude={longitude ?? DEFAULT_MAP.longitude}
                hasPin={hasMapPin}
                onCoordinateChange={handlePinCoordinateChange}
                adjustPinLabel={cr.adjustPin}
                adjustPinActiveLabel={cr.adjustPinActive}
                placePinHint={cr.mapPlacePinHint}
                resolving={pinResolving}
                mapsApiKey={mapsApiKey}
              />
              <MobileInput
                label={cr.address}
                placeholder={cr.addressPlaceholder}
                value={address}
                required
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                onChangeText={(v) => {
                  setAddress(v);
                  setAddressFromPlace(false);
                  clearFieldError('address');
                }}
                error={errors.address}
                helperText={addressFromPlace ? cr.addressFilledHint : undefined}
                style={styles.addressMultiline}
              />
              <View style={styles.twoColumnRow}>
                <MobileInput
                  label={cr.district}
                  value={district}
                  required
                  editable={areaFieldsEditable}
                  onChangeText={(v) => {
                    setDistrict(v);
                    setAddressFromPlace(false);
                    clearFieldError('district');
                  }}
                  error={errors.district}
                  containerStyle={styles.halfField}
                />
                <MobileInput
                  label={cr.province}
                  value={province}
                  required
                  editable={areaFieldsEditable}
                  onChangeText={(v) => {
                    setProvince(v);
                    setAddressFromPlace(false);
                    clearFieldError('province');
                  }}
                  error={errors.province}
                  containerStyle={styles.halfField}
                />
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <View style={styles.layoutSection}>
              <MobileInput
                label={cr.listingTitle}
                placeholder={cr.listingTitlePlaceholder}
                value={listingTitle}
                required
                onChangeText={(v) => {
                  setListingTitle(v);
                  clearFieldError('listingTitle');
                }}
                error={errors.listingTitle}
                helperText={cr.listingTitleHint}
              />
              {listRoomTypes ? (
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>
                    {cr.roomType}
                    <Text style={styles.requiredMark}> *</Text>
                  </Text>
                  {roomTypesLoading ? (
                    <View style={styles.suggestStatus}>
                      <ActivityIndicator size="small" color={accent} />
                      <Text style={styles.suggestStatusText}>{t.common.loading}</Text>
                    </View>
                  ) : null}
                  {roomTypesError ? (
                    <Text style={styles.errorText}>{roomTypesError}</Text>
                  ) : null}
                  <Pressable
                    onPress={() => !roomTypesLoading && setLayoutSheet('roomType')}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.selectRow,
                      errors.roomType ? { borderColor: tokens.colors.error } : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.selectValue,
                        !selectedRoomTypeLabel ? styles.selectPlaceholder : null,
                      ]}
                    >
                      {selectedRoomTypeLabel ?? cr.selectRoomType}
                    </Text>
                    <MobileIcon name="chevron-down" size={18} color={tokens.colors.textSecondary} />
                  </Pressable>
                  {errors.roomType ? (
                    <Text style={styles.errorText}>{errors.roomType}</Text>
                  ) : null}
                </View>
              ) : null}
              <View style={styles.fieldGrid}>
                <View style={styles.fieldGridItem}>
                  <Text style={styles.fieldLabel}>
                    {cr.bedroom}
                    <Text style={styles.requiredMark}> *</Text>
                  </Text>
                  <Pressable
                    onPress={() => {
                      if (bedroomLocked) return;
                      setLayoutSheet('bedroom');
                    }}
                    disabled={bedroomLocked}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: bedroomLocked }}
                    style={({ pressed }) => [
                      styles.selectRow,
                      bedroomLocked ? styles.selectRowLocked : null,
                      errors.bedroom ? { borderColor: tokens.colors.error } : null,
                      !bedroomLocked && pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <MobileIcon name="bed" size={18} color={tokens.colors.textSecondary} />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.selectValue,
                        !bedroom.trim() ? styles.selectPlaceholder : null,
                      ]}
                    >
                      {bedroom.trim() || cr.selectCount}
                    </Text>
                    {bedroomLocked ? null : (
                      <MobileIcon name="chevron-down" size={18} color={tokens.colors.textSecondary} />
                    )}
                  </Pressable>
                  {errors.bedroom ? (
                    <Text style={styles.errorText}>{errors.bedroom}</Text>
                  ) : null}
                </View>
                <View style={styles.fieldGridItem}>
                  <Text style={styles.fieldLabel}>
                    {cr.bathroom}
                    <Text style={styles.requiredMark}> *</Text>
                  </Text>
                  <Pressable
                    onPress={() => setLayoutSheet('bathroom')}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.selectRow,
                      errors.bathroom ? { borderColor: tokens.colors.error } : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <MobileIcon name="bath" size={18} color={tokens.colors.textSecondary} />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.selectValue,
                        !bathroom.trim() ? styles.selectPlaceholder : null,
                      ]}
                    >
                      {bathroom.trim() || cr.selectCount}
                    </Text>
                    <MobileIcon name="chevron-down" size={18} color={tokens.colors.textSecondary} />
                  </Pressable>
                  {errors.bathroom ? (
                    <Text style={styles.errorText}>{errors.bathroom}</Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.fieldGrid}>
                <View style={styles.fieldGridItem}>
                  <MobileInput
                    label={cr.floor}
                    placeholder={cr.floorPlaceholder}
                    keyboardType="numeric"
                    value={floor}
                    leadingIcon="stairs"
                    onChangeText={setFloor}
                  />
                </View>
                <View style={styles.fieldGridItem}>
                  <MobileInput
                    label={cr.sizeSqm}
                    keyboardType="numeric"
                    placeholder="35"
                    value={sizeSqm}
                    leadingIcon="room-size"
                    trailingText="sqm"
                    onChangeText={(v) => {
                      setSizeSqm(v);
                      clearFieldError('sizeSqm');
                    }}
                    error={errors.sizeSqm}
                  />
                </View>
              </View>
              <MobileInput
                label={cr.building}
                placeholder={cr.buildingPlaceholder}
                autoCapitalize="characters"
                value={building}
                leadingIcon="buildings"
                onChangeText={setBuilding}
              />
              {initialData ? (
                <>
                  <View style={styles.fieldGrid}>
                    <View style={styles.fieldGridItem}>
                      <MobileInput
                        label={cr.waterRate}
                        keyboardType="numeric"
                        value={waterRate}
                        onChangeText={setWaterRate}
                      />
                    </View>
                    <View style={styles.fieldGridItem}>
                      <MobileInput
                        label={cr.electricRate}
                        keyboardType="numeric"
                        value={electricRate}
                        onChangeText={setElectricRate}
                      />
                    </View>
                  </View>
                  <MobileInput
                    label={cr.roomId}
                    placeholder={cr.roomIdPlaceholder}
                    value={roomId}
                    onChangeText={setRoomId}
                  />
                </>
              ) : null}
              <MoveInDateField
                label={cr.moveInDate}
                value={availableFrom}
                onChange={(iso) => {
                  setAvailableFrom(clampMoveInDate(iso));
                  clearFieldError('availableFrom');
                }}
                accentColor={accent}
                locale={locale}
                error={errors.availableFrom}
                placeholder={cr.moveInDatePlaceholder}
                closeLabel={t.common.cancel}
              />
              </View>
            </>
          )}

          {step === 5 && (
            <>
              <Pressable
                onPress={openAddLease}
                disabled={
                  contractTypesLoading ||
                  contractTypes.length === 0 ||
                  selectedContractTypeIds.length >= contractTypes.length
                }
                android_ripple={{ color: '#00000014' }}
                accessibilityRole="button"
                accessibilityLabel={cr.addLease}
                style={({ pressed }) => [
                  styles.addLeaseBtn,
                  { borderColor: accent },
                  selectedContractTypeIds.length >= contractTypes.length && contractTypes.length > 0
                    ? styles.addLeaseBtnDisabled
                    : null,
                  pressed ? { opacity: 0.88 } : null,
                ]}
              >
                <MobileIcon name="plus" size={18} color={tokens.colors.primary} weight="bold" />
                <Text style={styles.addLeaseBtnText}>{cr.addLease}</Text>
              </Pressable>

              {contractTypesLoading ? (
                <View style={styles.suggestStatus}>
                  <ActivityIndicator size="small" color={accent} />
                  <Text style={styles.suggestStatusText}>{t.common.loading}</Text>
                </View>
              ) : null}
              {contractTypesError ? (
                <Text style={styles.errorText}>{contractTypesError}</Text>
              ) : null}

              <View style={styles.leaseList}>
                {contractTypes
                  .filter((opt) => selectedContractTypeIds.includes(opt.id))
                  .map((opt) => {
                    const rent = rentsByTypeId[String(opt.id)] ?? '';
                    const rentNum = Number(rent);
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => openEditLease(opt.id)}
                        android_ripple={{ color: '#00000014' }}
                        accessibilityRole="button"
                        accessibilityLabel={interpolate(cr.leaseCardTitle, {
                          months: opt.termMonths,
                        })}
                        style={({ pressed }) => [
                          styles.leaseCard,
                          pressed ? { opacity: 0.92 } : null,
                        ]}
                      >
                        <View style={styles.leaseCardText}>
                          <Text style={styles.leaseCardTitle}>
                            {interpolate(cr.leaseCardTitle, { months: opt.termMonths })}
                          </Text>
                          {rentNum > 0 ? (
                            <Text style={styles.leaseCardPrice}>
                              {interpolate(cr.leaseCardRent, {
                                amount: formatBaht(rentNum),
                              })}
                            </Text>
                          ) : (
                            <Text style={styles.leaseCardSub}>{cr.rentAmountRequired}</Text>
                          )}
                          {(
                            <Text style={styles.leaseCardSub}>
                              {interpolate(cr.leaseCardAdvanceDeposit, {
                                advance: monthChipLabel(
                                  leaseTerms(opt.id).advanceRentMonths,
                                  cr.monthsNone,
                                  cr.contractMonths,
                                ),
                                deposit: monthChipLabel(
                                  leaseTerms(opt.id).depositMonths,
                                  cr.monthsNone,
                                  cr.contractMonths,
                                ),
                              })}
                            </Text>
                          )}
                        </View>
                        <MobileIcon
                          name="chevron-right"
                          size={20}
                          color={tokens.colors.textSecondary}
                        />
                      </Pressable>
                    );
                  })}
              </View>

              {errors.contractTerm ? (
                <Text style={styles.errorText}>{errors.contractTerm}</Text>
              ) : null}
              {Object.keys(errors)
                .filter((key) => key.startsWith('rent_'))
                .map((key) => (
                  <Text key={key} style={styles.errorText}>
                    {errors[key]}
                  </Text>
                ))}
            </>
          )}

          {step === 6 && (
            <>
              <View style={styles.photosMetaRow}>
                <Text style={[styles.sourceLead, styles.photosMetaLead]} numberOfLines={2}>
                  {initialData?.visibility === 'published'
                    ? cr.photosHint
                    : cr.photosOptionalLead}
                </Text>
                <Text style={styles.photosMetaCount}>
                  {interpolate(cr.photosOfMax, { count: photoCount })}
                </Text>
              </View>
              {errors.photos ? (
                <Text style={styles.errorText}>{errors.photos}</Text>
              ) : null}
              <View
                style={styles.photoGrid}
                onLayout={(e: LayoutChangeEvent) => {
                  const w = e.nativeEvent.layout.width;
                  if (w <= 0) return;
                  const next = Math.floor((w - PHOTO_GRID_GAP) / 2);
                  setPhotoCellSize((prev) => (prev === next ? prev : next));
                }}
              >
                {photos.map((photo, i) => {
                  const enhancing = enhancingUri === photo.uri;
                  return (
                    <View
                      key={photo.uri}
                      style={[
                        styles.photoTile,
                        photoCellSize > 0
                          ? { width: photoCellSize, height: photoCellSize }
                          : null,
                      ]}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={cr.viewPhoto}
                        disabled={submitting || enhancing}
                        onPress={() => setGalleryPreviewIndex(i)}
                        style={styles.photoTileHit}
                      >
                        <Image source={{ uri: photo.uri, cache: 'reload' }} style={styles.photoTileImg} />
                        {i === 0 ? (
                          <View style={[styles.coverBadge, { backgroundColor: accent }]}>
                            <Text style={[styles.coverBadgeText, { color: accentInk }]}>
                              {cr.coverBadge}
                            </Text>
                          </View>
                        ) : null}
                        {photo.originalUri ? (
                          <View style={[styles.aiBadge, { backgroundColor: accent }]}>
                            <Text style={[styles.aiBadgeText, { color: accentInk }]}>AI</Text>
                          </View>
                        ) : null}
                      </Pressable>
                      {enhancing ? (
                        <Animated.View
                          entering={FadeIn.duration(150)}
                          style={styles.photoEnhanceOverlay}
                          accessibilityRole="progressbar"
                          accessibilityLabel={cr.enhancePhotoLoading}
                        >
                          <ActivityIndicator color={accent} size="small" />
                          <Text style={styles.photoEnhanceLabel}>{cr.enhancePhotoLoading}</Text>
                        </Animated.View>
                      ) : (
                        <Pressable
                          style={styles.photoMenuBtn}
                          hitSlop={8}
                          accessibilityRole="button"
                          onPress={() => setPhotoMenuUri(photo.uri)}
                        >
                          <MobileIcon name="dots-vertical" size={18} color={tokens.colors.white} />
                        </Pressable>
                      )}
                    </View>
                  );
                })}
                {photoCount < 12 && pickPhotos ? (
                  <Pressable
                    style={[
                      styles.photoAddTile,
                      photoCellSize > 0
                        ? { width: photoCellSize, height: photoCellSize }
                        : null,
                    ]}
                    disabled={submitting || pickingPhotos || !!enhancingUri}
                    onPress={async () => {
                      if (!pickPhotos || pickingPhotos) return;
                      setPickingPhotos(true);
                      try {
                        const selected = await pickPhotos(12 - photoCount);
                        setPhotos((current) =>
                          [
                            ...current,
                            ...selected.filter(
                              (photo, index) =>
                                !current.some((item) => item.uri === photo.uri) &&
                                selected.findIndex((item) => item.uri === photo.uri) === index,
                            ),
                          ].slice(0, 12),
                        );
                        clearFieldError('photos');
                      } catch (err) {
                        Alert.alert(cr.saveError, localizedError(err, t.common.errorGeneric, locale));
                      } finally {
                        setPickingPhotos(false);
                      }
                    }}
                  >
                    {pickingPhotos ? (
                      <ActivityIndicator color={accent} />
                    ) : (
                      <>
                        <MobileIcon name="plus" size={22} color={tokens.colors.textSecondary} />
                        <Text style={styles.photoAddLabel}>{cr.addPhoto}</Text>
                      </>
                    )}
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.hubFootnoteRow}>
                <Text style={styles.hubFootnoteIcon}>ⓘ</Text>
                <Text style={styles.hubFootnote}>
                  {photoCount < 5 ? cr.photosPublishMinHint : cr.sessionSaveNote}
                </Text>
              </View>
              <RoomPhotoCompareModal
                // Hide while photo viewer is open — RN cannot reliably stack two Modals.
                visible={compare != null && comparePreviewSide == null && galleryPreviewIndex == null}
                beforeUri={compare?.beforeUri ?? ''}
                afterUri={compare?.after.uri ?? ''}
                labels={{
                  title: cr.comparePhotoTitle,
                  before: cr.photoBefore,
                  after: cr.photoAfter,
                  useEnhanced: cr.useEnhancedPhoto,
                  keepOriginal: cr.keepOriginalPhoto,
                  viewPhoto: cr.viewPhoto,
                }}
                quotaNote={interpolate(cr.enhanceQuotaUsedNote, {
                  remaining: enhanceRemaining,
                  limit: MOCK_AI_ENHANCE_LIMIT,
                })}
                onDismiss={dismissCompare}
                onPreview={(params) =>
                  setComparePreviewSide(params.uri === compare?.beforeUri ? 'before' : 'after')
                }
                onUseEnhanced={() => {
                  if (!compare) return;
                  const { sourceUri, after } = compare;
                  setPhotos((current) => current.map((item) => (item.uri === sourceUri ? after : item)));
                  setCompare(null);
                }}
              />
              <MobilePhotoViewer
                visible={galleryPreviewIndex != null}
                mode="gallery"
                items={photos.map((photo) => ({
                  uri: photo.uri,
                  beforeUri: photo.originalUri,
                  enhanced: !!photo.originalUri,
                }))}
                index={galleryPreviewIndex ?? 0}
                onIndexChange={setGalleryPreviewIndex}
                labels={{
                  titlePreview: cr.photoViewerTitle,
                  titleCompare: cr.photoViewerCompareTitle,
                  before: cr.photoBefore,
                  after: cr.photoAfter,
                  enhancedBadge: cr.photoViewerEnhancedBadge,
                  enhancedCaption: cr.photoViewerEnhancedCaption,
                  hintZoom: cr.photoViewerHintZoom,
                  hintCompareSwitch: cr.photoViewerHintCompareSwitch,
                  hintCompareClose: cr.photoViewerHintCompareClose,
                  closeA11y: cr.closePhotoPreview,
                }}
                onClose={() => setGalleryPreviewIndex(null)}
              />
              <MobilePhotoViewer
                visible={comparePreviewSide != null && compare != null}
                mode="compare"
                beforeUri={compare?.beforeUri}
                afterUri={compare?.after.uri}
                initialSide={comparePreviewSide ?? 'after'}
                labels={{
                  titlePreview: cr.photoViewerTitle,
                  titleCompare: cr.photoViewerCompareTitle,
                  before: cr.photoBefore,
                  after: cr.photoAfter,
                  enhancedBadge: cr.photoViewerEnhancedBadge,
                  enhancedCaption: cr.photoViewerEnhancedCaption,
                  hintZoom: cr.photoViewerHintZoom,
                  hintCompareSwitch: cr.photoViewerHintCompareSwitch,
                  hintCompareClose: cr.photoViewerHintCompareClose,
                  closeA11y: cr.closePhotoPreview,
                }}
                onClose={() => setComparePreviewSide(null)}
              />
              <MobileBottomSheet visible={photoMenuUri != null} onClose={() => setPhotoMenuUri(null)}>
                <MobileActionSheetBody
                  title={cr.steps.photos}
                  actions={[
                    ...(photoMenuUri && photos[0]?.uri !== photoMenuUri
                      ? [
                          {
                            key: 'cover',
                            label: cr.setCover,
                            onPress: () => {
                              const uri = photoMenuUri;
                              if (!uri) return;
                              setPhotos((current) => {
                                const target = current.find((p) => p.uri === uri);
                                if (!target) return current;
                                return [target, ...current.filter((p) => p.uri !== uri)];
                              });
                              setPhotoMenuUri(null);
                            },
                          },
                        ]
                      : []),
                    ...(enhancePhoto
                      ? [
                          {
                            key: 'enhance',
                            label:
                              enhanceRemaining > 0
                                ? `${cr.enhancePhoto} · ${enhanceQuotaShort}`
                                : cr.enhanceQuotaExhausted,
                            disabled: !photoMenuUri || !!enhancingUri || enhanceRemaining <= 0,
                            loading: !!photoMenuUri && enhancingUri === photoMenuUri,
                            onPress: () => {
                              const uri = photoMenuUri;
                              if (!uri || !enhancePhoto || enhancingUri) return;
                              if (enhanceRemaining <= 0) {
                                Alert.alert(cr.enhanceQuotaExhausted, enhanceQuotaShort);
                                return;
                              }
                              const photo = photos.find((p) => p.uri === uri);
                              if (!photo) return;
                              setEnhancingUri(uri);
                              setPhotoMenuUri(null);
                              void (async () => {
                                try {
                                  const enhanced = await enhancePhoto(photo);
                                  setEnhanceRemaining((current) => Math.max(0, current - 1));
                                  setCompare({
                                    sourceUri: photo.uri,
                                    beforeUri: photo.originalUri ?? photo.uri,
                                    after: {
                                      ...enhanced,
                                      originalUri: photo.originalUri ?? photo.uri,
                                    },
                                  });
                                } catch (err) {
                                  Alert.alert(
                                    cr.enhancePhotoError,
                                    localizedError(err, t.common.errorGeneric, locale),
                                  );
                                } finally {
                                  setEnhancingUri(null);
                                }
                              })();
                            },
                          },
                        ]
                      : []),
                    {
                      key: 'remove',
                      label: cr.removePhoto,
                      danger: true,
                      disabled: !photoMenuUri,
                      onPress: () => {
                        const uri = photoMenuUri;
                        if (!uri) return;
                        setPhotos((current) => current.filter((item) => item.uri !== uri));
                        setPhotoMenuUri(null);
                      },
                    },
                  ]}
                />
              </MobileBottomSheet>
            </>
          )}

          {submitting && <Text accessibilityLiveRegion="polite" style={styles.hint}>{interpolate(cr.uploadProgress, { count: uploadProgress, total: photoCount })}</Text>}

          {step === 3 && <>
            <RoomFacilitiesEditor options={facilityOptions} selected={facilities} onChange={setFacilities} custom={customFacilities} onCustomChange={setCustomFacilities} loading={facilitiesLoading} error={facilityError} onRetry={loadFacilities} color={accent} />
            {!!errors.customFacilities && <Text style={styles.errorText}>{errors.customFacilities}</Text>}
          </>}
          {step === 4 && <>
            <RoomNearbyEditor latitude={latitude} longitude={longitude} value={nearbyPlaces} onChange={(value) => { setNearbyPlaces(value); clearFieldError('nearbyPlaces'); }} search={searchNearby} apiKey={mapsApiKey} color={accent} error={errors.nearbyPlaces} propertyName={propertyName} address={address} />
          </>}
          {step === 7 && <>
            {promoStale ? (
              <View style={styles.promoStaleBanner}>
                <MobileIcon name="warning" size={18} color={tokens.colors.warning} />
                <Text style={styles.promoStaleText}>{cr.promoStaleBadge}</Text>
              </View>
            ) : null}
            {generateListingPromo ? (
              <View style={styles.promoAssistCard}>
                <View style={styles.promoAssistTop}>
                  <View style={styles.promoAssistCopy}>
                    <View style={styles.promoAssistHeading}>
                      <MobileIcon name="sparkle" size={20} color={tokens.colors.brand[600]} />
                      <Text style={styles.promoAssistTitle}>{cr.promoAssistTitle}</Text>
                    </View>
                    <Text style={styles.promoAssistHint}>{cr.promoAssistHint}</Text>
                  </View>
                  <MobileAiQuotaAction
                    label={cr.promoDraftAction}
                    remaining={promoRemaining}
                    limit={MOCK_AI_PROMO_LIMIT}
                    showQuota={false}
                    loading={generatingPromo}
                    disabled={generatingPromo || promoAiPhase !== 'closed'}
                    style={styles.promoAssistBtn}
                    onPress={() => {
                      if (generatingPromo || promoAiPhase !== 'closed' || !generateListingPromo) return;
                      if (promoRemaining <= 0) {
                        Alert.alert(cr.promoQuotaExhausted);
                        return;
                      }
                      void runPromoGenerate();
                    }}
                  />
                </View>
                <View style={styles.promoLocaleBlock}>
                  <Text style={styles.promoLocaleLabel}>{cr.promoOutputLanguage}</Text>
                  <View style={styles.promoLocaleRow}>
                    {PROMO_OUTPUT_LOCALE_OPTIONS.map((code) => {
                      const selected = promoOutputLocale === code;
                      const label =
                        code === 'th'
                          ? cr.promoLocaleTh
                          : code === 'en'
                            ? cr.promoLocaleEn
                            : code === 'zh'
                              ? cr.promoLocaleZh
                              : cr.promoLocaleJa;
                      return (
                        <Pressable
                          key={code}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          disabled={generatingPromo || promoAiPhase !== 'closed'}
                          onPress={() => {
                            setPromoLocaleTouched(true);
                            setPromoOutputLocale(code);
                          }}
                          android_ripple={{ color: `${accent}22` }}
                          style={({ pressed }) => [
                            styles.promoLocaleChip,
                            selected ? styles.promoLocaleChipOn : null,
                            pressed && Platform.OS === 'ios' ? { opacity: 0.85 } : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.promoLocaleChipText,
                              selected ? styles.promoLocaleChipTextOn : null,
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            ) : null}
            <View style={styles.promoFields}>
              <View style={styles.promoFieldBlock}>
                <View style={styles.promoLabelRow}>
                  <Text style={styles.promoFieldLabel}>
                    {cr.promoListingTitle}
                    <Text style={styles.promoRequired}> *</Text>
                  </Text>
                  <Text
                    style={[
                      styles.promoCounter,
                      promoTitle.length > PROMO_TITLE_MAX ? styles.promoCounterOver : null,
                    ]}
                  >
                    {promoTitle.length}/{PROMO_TITLE_MAX}
                  </Text>
                </View>
                <MobileInput
                  placeholder={cr.promoTitlePlaceholder}
                  value={promoTitle}
                  editable={!generatingPromo}
                  onChangeText={(v) => {
                    setPromoTitle(v);
                    clearFieldError('promoTitle');
                  }}
                  error={errors.promoTitle}
                  helperText={cr.promoListingTitleHint}
                />
              </View>
              <View style={styles.promoFieldBlock}>
                <View style={styles.promoLabelRow}>
                  <Text style={styles.promoFieldLabel}>{cr.listingDescription}</Text>
                  <Text
                    style={[
                      styles.promoCounter,
                      description.length > PROMO_DESC_MAX ? styles.promoCounterOver : null,
                    ]}
                  >
                    {description.length}/{PROMO_DESC_MAX}
                  </Text>
                </View>
                <MobileInput
                  value={description}
                  placeholder={cr.promoDescriptionPlaceholder}
                  editable={!generatingPromo}
                  onChangeText={setDescription}
                  multiline
                  scrollEnabled
                  style={{ minHeight: 140, maxHeight: 280, textAlignVertical: 'top' }}
                />
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() => setPromoPreviewOpen(true)}
                hitSlop={8}
                style={styles.promoPreviewLink}
              >
                <MobileIcon name="note" size={16} color={tokens.colors.accent} />
                <Text style={styles.promoPreviewLinkText}>{cr.promoPreviewListing}</Text>
                <MobileIcon name="chevron-right" size={16} color={tokens.colors.accent} />
              </Pressable>
            </View>
          </>}
          {step === 8 && (
            <>
              <Text style={styles.hint}>{cr.roomContactsMaxHint}</Text>
              {roomContacts.length > 0 ? (
                <View style={{ gap: 12 }}>
                  <Text style={styles.fieldLabel}>{cr.selectedContactLabel}</Text>
                  {roomContacts.map((c) => (
                    <SelectedContactCard
                      key={c.key}
                      name={c.name}
                      phone={c.phone}
                      roomsLabel={roomsLinkedLabel(c.roomCount)}
                      accentColor={accent}
                      removeLabel={cr.roomContactRemove}
                      onRemove={
                        listContacts
                          ? () => removeRoomContact(c.key)
                          : undefined
                      }
                    />
                  ))}
                </View>
              ) : null}

              {listContacts ? (
                roomContacts.length < MAX_ROOM_CONTACTS ? (
                  <Pressable
                    onPress={openPickContactSheet}
                    android_ripple={{ color: '#00000014' }}
                    accessibilityRole="button"
                    accessibilityLabel={cr.chooseContactTitle}
                    style={({ pressed }) => [
                      styles.changeContactBtn,
                      { borderColor: tokens.colors.border },
                      pressed ? { opacity: 0.88 } : null,
                    ]}
                  >
                    <Text style={styles.changeContactBtnText}>
                      {cr.chooseContactTitle}
                    </Text>
                    <MobileIcon
                      name="chevron-right"
                      size={20}
                      color={tokens.colors.textSecondary}
                    />
                  </Pressable>
                ) : (
                  <Text style={styles.hint}>{cr.roomContactsFull}</Text>
                )
              ) : (
                <>
                  {!roomContacts.length ? (
                    <Text style={styles.hint}>{cr.ownerPickRequired}</Text>
                  ) : null}
                  <MobileInput
                    label={cr.ownerName}
                    placeholder="e.g. Alex Morgan"
                    value={ownerName}
                    required
                    onChangeText={(v) => {
                      setOwnerName(v);
                      clearFieldError('ownerName');
                    }}
                    error={errors.ownerName}
                  />
                  <MobileInput
                    label={cr.ownerPhone}
                    placeholder="e.g. 0812345678"
                    keyboardType="phone-pad"
                    value={ownerPhone}
                    required
                    onChangeText={(v) => {
                      setOwnerPhone(v);
                      clearFieldError('ownerPhone');
                    }}
                    error={errors.ownerPhone}
                  />
                  <MobileInput
                    label={cr.contactLine}
                    placeholder={cr.contactLinePlaceholder}
                    value={ownerLine}
                    onChangeText={setOwnerLine}
                    autoCapitalize="none"
                  />
                  <MobileInput
                    label={cr.contactFacebook}
                    placeholder={cr.contactFacebookPlaceholder}
                    value={ownerFacebook}
                    onChangeText={setOwnerFacebook}
                    autoCapitalize="none"
                  />
                </>
              )}

              {errors.ownerPick ? (
                <Text style={styles.errorText}>{errors.ownerPick}</Text>
              ) : null}
              {errors.ownerName ? (
                <Text style={styles.errorText}>{errors.ownerName}</Text>
              ) : null}
              {errors.ownerPhone ? (
                <Text style={styles.errorText}>{errors.ownerPhone}</Text>
              ) : null}
            </>
          )}
          </View>
        </View>
      </ScrollView>
      <View style={styles.footer}>{renderNav()}</View>
        </Animated.View>
      ) : null}

      <MobileBottomSheet visible={layoutSheet != null} onClose={() => setLayoutSheet(null)}>
        <WizardSheetChrome
          title={
            layoutSheet === 'roomType'
              ? cr.roomType
              : layoutSheet === 'bedroom'
                ? cr.bedroom
                : cr.bathroom
          }
          closeLabel={cr.closePhotoPreview}
          onClose={() => setLayoutSheet(null)}
        />
        <ScrollView
          style={styles.layoutSheetScroll}
          contentContainerStyle={styles.layoutSheetBody}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          {layoutSheet === 'roomType'
            ? roomTypes.map((opt) => {
                const selected = roomTypeId === opt.id;
                const labels = t.masters.roomTypes as Record<string, string>;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => {
                      setRoomTypeId(opt.id);
                      clearFieldError('roomType');
                      if (opt.code === 'studio') {
                        setBedroom('0');
                        clearFieldError('bedroom');
                      } else if (opt.bedroomCount != null) {
                        setBedroom(String(opt.bedroomCount));
                        clearFieldError('bedroom');
                      }
                      setLayoutSheet(null);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.layoutSheetRow,
                      selected ? styles.layoutSheetRowSelected : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.layoutSheetRowText,
                        selected ? styles.layoutSheetRowTextSelected : null,
                      ]}
                    >
                      {labels[opt.code] ?? opt.code}
                    </Text>
                    {selected ? <SelectionCheck selected variant="chip" size="md" /> : null}
                  </Pressable>
                );
              })
            : (layoutSheet === 'bedroom' ? BEDROOM_OPTIONS : BATHROOM_OPTIONS).map((count) => {
                const selected =
                  layoutSheet === 'bedroom'
                    ? bedroom.trim() === String(count)
                    : bathroom.trim() === String(count);
                return (
                  <Pressable
                    key={`${layoutSheet}-${count}`}
                    onPress={() => {
                      if (layoutSheet === 'bedroom') {
                        setBedroom(String(count));
                        clearFieldError('bedroom');
                      } else {
                        setBathroom(String(count));
                        clearFieldError('bathroom');
                      }
                      setLayoutSheet(null);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.layoutSheetRow,
                      selected ? styles.layoutSheetRowSelected : null,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.layoutSheetRowText,
                        selected ? styles.layoutSheetRowTextSelected : null,
                      ]}
                    >
                      {String(count)}
                    </Text>
                    {selected ? <SelectionCheck selected variant="chip" size="md" /> : null}
                  </Pressable>
                );
              })}
        </ScrollView>
      </MobileBottomSheet>

      <MobileBottomSheet visible={leaseSheet != null} onClose={closeLeaseSheet} avoidKeyboard>
        {(() => {
          const editing = leaseSheet?.mode === 'edit';
          const editOpt =
            editing && leaseSheet
              ? contractTypes.find((opt) => opt.id === leaseSheet.contractTypeId)
              : null;
          return (
            <>
              <WizardSheetChrome
                title={
                  editing && editOpt
                    ? interpolate(cr.leaseCardTitle, { months: editOpt.termMonths })
                    : cr.addLease
                }
                subtitle={editing ? cr.editLeaseSubtitle : undefined}
                closeLabel={cr.closePhotoPreview}
                onClose={closeLeaseSheet}
              />

              <ScrollView
                style={styles.layoutSheetScroll}
                contentContainerStyle={styles.leaseSheetBody}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                {!editing && <View style={styles.leaseSheetSection}>
                  <Text style={styles.fieldLabel}>
                    {cr.leaseLength}
                    <Text style={styles.requiredMark}> *</Text>
                  </Text>
                  <View style={styles.termRow}>
                    {contractTypes.map((opt) => {
                      const selected = draftTermId === opt.id;
                      const alreadyAdded =
                        !editing &&
                        selectedContractTypeIds.includes(opt.id) &&
                        draftTermId !== opt.id;
                      const disabled = alreadyAdded;
                      return (
                        <SelectionChip
                          key={opt.id}
                          label={interpolate(cr.contractMonths, { months: opt.termMonths })}
                          subtitle={alreadyAdded ? cr.leaseAdded : undefined}
                          selected={selected}
                          disabled={disabled}
                          onPress={() => {
                            if (disabled) return;
                            setDraftTermId(opt.id);
                            setLeaseSheetError('');
                          }}
                          accentColor={accent}
                          inkColor={tokens.colors.primary}
                          style={styles.termChipGrow}
                        />
                      );
                    })}
                  </View>
                  {leaseSheetError === cr.leaseLengthRequired && <Text style={styles.errorText}>{leaseSheetError}</Text>}
                </View>}

                <MobileInput
                  label={cr.monthlyRent}
                  required
                  placeholder="16000"
                  keyboardType="numeric"
                  value={draftRent}
                  error={leaseSheetError === cr.rentAmountRequired ? leaseSheetError : undefined}
                  trailingText={cr.monthlyRentSuffix}
                  onChangeText={(v) => {
                    setDraftRent(digitsOnly(v));
                    setLeaseSheetError('');
                  }}
                />

                <View style={styles.leaseSheetSection}>
                  <Text style={styles.fieldLabel}>
                    {cr.advanceRent}
                    <Text style={styles.requiredMark}> *</Text>
                  </Text>
                  <Text style={styles.hint}>{cr.advanceRentHint}</Text>
                  {renderMonthChips(
                    ADVANCE_MONTH_OPTIONS,
                    draftAdvance,
                    setDraftAdvance,
                  )}
                  {Number(draftRent) > 0 && <Text style={styles.hint}>{interpolate(cr.thbAmount, { amount: formatBaht(Number(draftRent) * draftAdvance) })}</Text>}
                </View>

                <View style={styles.leaseSheetSection}>
                  <Text style={styles.fieldLabel}>
                    {cr.deposit}
                    <Text style={styles.requiredMark}> *</Text>
                  </Text>
                  <Text style={styles.hint}>{cr.depositHint}</Text>
                  {renderMonthChips(
                    DEPOSIT_MONTH_OPTIONS,
                    draftDeposit,
                    setDraftDeposit,
                  )}
                  {Number(draftRent) > 0 && <Text style={styles.hint}>{interpolate(cr.thbAmount, { amount: formatBaht(Number(draftRent) * draftDeposit) })}</Text>}
                </View>

              </ScrollView>
              <WizardSheetFooter
                primaryLabel={editing ? cr.applyLeaseChanges : cr.addTerms}
                onPrimary={commitLeaseSheet}
                secondaryLabel={editing ? cr.removeLease : undefined}
                onSecondary={editing ? removeLeaseFromSheet : undefined}
              />
            </>
          );
        })()}
      </MobileBottomSheet>

      <MobileBottomSheet
        visible={contactSheet != null}
        onClose={dismissContactSheetStep}
        avoidKeyboard
      >
        {contactSheet === 'create' ? (
          <>
            <WizardSheetChrome
              title={cr.newContactTitle}
              closeLabel={cr.closePhotoPreview}
              onClose={dismissContactSheetStep}
            />
            <ScrollView
              style={styles.layoutSheetScroll}
              contentContainerStyle={styles.leaseSheetBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <Text style={styles.hint}>{cr.newContactHint}</Text>
              <MobileInput
                label={cr.ownerName}
                required
                placeholder="e.g. Alex Morgan"
                value={draftOwnerName}
                onChangeText={(v) => {
                  setDraftOwnerName(v);
                  setContactSheetError('');
                }}
                error={
                  contactSheetError === cr.required && !draftOwnerName.trim()
                    ? cr.required
                    : undefined
                }
              />
              <MobileInput
                label={cr.ownerPhone}
                required
                placeholder="e.g. 0812345678"
                keyboardType="phone-pad"
                value={draftOwnerPhone}
                onChangeText={(v) => {
                  setDraftOwnerPhone(v);
                  setContactSheetError('');
                }}
                error={
                  contactSheetError === cr.required && !draftOwnerPhone.trim()
                    ? cr.required
                    : undefined
                }
                helperText={cr.ownerPhoneMatchHint}
              />
              <MobileInput
                label={cr.contactLine}
                placeholder={cr.contactLinePlaceholder}
                value={draftOwnerLine}
                onChangeText={setDraftOwnerLine}
                autoCapitalize="none"
              />
              <MobileInput
                label={cr.contactFacebook}
                placeholder={cr.contactFacebookPlaceholder}
                value={draftOwnerFacebook}
                onChangeText={setDraftOwnerFacebook}
                autoCapitalize="none"
              />
              {matchedOwnerByPhone ? (
                <View style={styles.ownerMatchBox}>
                  <Text style={styles.ownerCardName}>{cr.ownerFoundExisting}</Text>
                  <Text style={styles.ownerCardPhone}>
                    {matchedOwnerByPhone.name} · {matchedOwnerByPhone.phone}
                  </Text>
                  <MobileButton
                    variant="outline"
                    onPress={() => handleSelectOwner(matchedOwnerByPhone)}
                  >
                    {cr.ownerUseThis}
                  </MobileButton>
                </View>
              ) : null}
              <View style={styles.footerNote}>
                <MobileIcon name="warning" size={16} color={tokens.colors.textSecondary} />
                <Text style={styles.footerNoteText}>{cr.sessionSaveNote}</Text>
              </View>
            </ScrollView>
            <WizardSheetFooter
              primaryLabel={cr.ownerUseThis}
              onPrimary={commitCreateContact}
            />
          </>
        ) : (
          <>
            <WizardSheetChrome
              title={cr.chooseContactTitle}
              closeLabel={cr.closePhotoPreview}
              onClose={closeContactSheet}
            />
            <ScrollView
              style={styles.layoutSheetScroll}
              contentContainerStyle={styles.leaseSheetBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <MobileInput
                placeholder={cr.ownerSearchPlaceholder}
                value={ownerQuery}
                onChangeText={(v) => {
                  setOwnerQuery(v);
                  setContactSheetError('');
                }}
              />
              <Pressable
                onPress={() => {
                  setContactSheetError('');
                  openCreateContactSheet();
                }}
                accessibilityRole="button"
                accessibilityLabel={cr.ownerAddNew}
                style={({ pressed }) => [
                  styles.addContactLink,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <MobileIcon
                  name="user-plus"
                  size={18}
                  color={tokens.colors.accent}
                />
                <Text
                  style={[styles.addContactLinkText, { color: tokens.colors.accent }]}
                >
                  {cr.ownerAddNew}
                </Text>
              </Pressable>
              {ownersLoading ? (
                <View style={styles.suggestStatus}>
                  <ActivityIndicator size="small" color={accent} />
                  <Text style={styles.suggestStatusText}>{t.common.loading}</Text>
                </View>
              ) : null}
              {ownersError ? <Text style={styles.errorText}>{ownersError}</Text> : null}
              {!ownersLoading && !ownersError && filteredOwners.length === 0 ? (
                <Text style={styles.hint}>{cr.ownerEmpty}</Text>
              ) : null}
              <View style={styles.contactList}>
                {filteredOwners.map((item) => (
                  <ContactListRow
                    key={item.id}
                    name={item.name}
                    phone={item.phone}
                    roomsLabel={roomsLinkedLabel(item.roomCount)}
                    selected={draftContactId === item.id}
                    accentColor={accent}
                    onPress={() => {
                      setDraftContactId(item.id);
                      setContactSheetError('');
                    }}
                  />
                ))}
              </View>
              {contactSheetError ? (
                <Text style={styles.errorText}>{contactSheetError}</Text>
              ) : null}
            </ScrollView>
            <WizardSheetFooter
              primaryLabel={cr.useSelectedContact}
              onPrimary={commitPickContact}
              primaryDisabled={draftContactId == null}
            />
          </>
        )}
      </MobileBottomSheet>

      <Modal
        visible={promoPreviewOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setPromoPreviewOpen(false)}
      >
        <View style={styles.promoModalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPromoPreviewOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={cr.promoPreviewBack}
          />
          <View style={styles.promoModalCard}>
            <View style={styles.promoModalHeader}>
              <Text style={styles.promoModalTitle}>{cr.promoListingPreview}</Text>
              <Pressable onPress={() => setPromoPreviewOpen(false)} hitSlop={10}>
                <MobileIcon name="close" size={20} color={tokens.colors.textHeading} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.promoModalScroll}
              contentContainerStyle={styles.promoModalScrollContent}
              showsVerticalScrollIndicator
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {photos[0]?.uri ? (
                <Image
                  source={{ uri: photos[0].uri, cache: 'reload' }}
                  style={styles.promoModalCover}
                />
              ) : null}
              <Text selectable style={styles.promoModalListingTitle}>
                {promoTitle.trim() || cr.promoPreviewEmpty}
              </Text>
              <Text selectable style={styles.promoModalListingDesc}>
                {description.trim() || cr.promoPreviewEmptyDesc}
              </Text>
            </ScrollView>
            <MobileButton onPress={() => setPromoPreviewOpen(false)}>
              {cr.promoPreviewBack}
            </MobileButton>
          </View>
        </View>
      </Modal>

      <MobileBottomSheet
        visible={promoAiPhase !== 'closed'}
        onClose={closePromoAiSheet}
        closeOnBackdropPress={promoAiPhase !== 'generating'}
        sheetStyle={styles.promoDraftSheetPanel}
      >
        <View style={styles.promoDraftSheet}>
          <Text style={styles.promoDraftSheetChrome}>{cr.promoDraftReviewTitle}</Text>
          <View style={styles.promoHatchWrap}>
            <MobileNestykHatchLoader
              mode={promoAiPhase === 'ready' ? 'success' : 'idle'}
              size={88}
              accessibilityLabel={
                promoAiPhase === 'ready'
                  ? cr.promoDraftReadyTitle
                  : promoAiPhase === 'failed'
                    ? promoFailKind === 'overload'
                      ? cr.promoDraftBusyTitle
                      : cr.promoDraftFailedTitle
                    : cr.promoDraftHatchingTitle
              }
            />
          </View>
          <Text style={styles.promoDraftSheetTitle}>
            {promoAiPhase === 'ready'
              ? cr.promoDraftReadyTitle
              : promoAiPhase === 'failed'
                ? promoFailKind === 'overload'
                  ? cr.promoDraftBusyTitle
                  : cr.promoDraftFailedTitle
                : cr.promoDraftHatchingTitle}
          </Text>
          <Text style={styles.promoDraftSheetHint}>
            {promoAiPhase === 'ready'
              ? cr.promoDraftReadyHint
              : promoAiPhase === 'failed'
                ? promoFailKind === 'overload'
                  ? cr.promoDraftBusyHint
                  : cr.promoDraftFailedHint
                : cr.promoDraftHatchingHint}
          </Text>

          {promoAiPhase === 'generating' ? (
            <>
              <View style={styles.promoSkeletonBlock}>
                <View style={styles.promoSkeletonLabel} />
                <View style={[styles.promoSkeletonLine, { width: '88%' }]} />
              </View>
              <View style={styles.promoSkeletonBlock}>
                <View style={styles.promoSkeletonLabel} />
                <View style={[styles.promoSkeletonLine, { width: '100%' }]} />
                <View style={[styles.promoSkeletonLine, { width: '94%' }]} />
                <View style={[styles.promoSkeletonLine, { width: '72%' }]} />
              </View>
              <MobileButton variant="outline" onPress={closePromoAiSheet}>
                {cr.promoDraftCancel}
              </MobileButton>
            </>
          ) : promoAiPhase === 'failed' ? (
            <>
              <MobileButton onPress={() => void runPromoGenerate()}>{cr.promoDraftRetry}</MobileButton>
              <MobileButton variant="outline" onPress={closePromoAiSheet}>
                {cr.promoDraftWriteYourself}
              </MobileButton>
            </>
          ) : (
            <>
              {promoDraft &&
              (promoDraft.listingTitle.length > PROMO_TITLE_MAX ||
                promoDraft.listingDescription.length > PROMO_DESC_MAX) ? (
                <Text style={styles.promoDraftWarn}>{cr.promoDraftOverLimit}</Text>
              ) : null}
              <ScrollView
                style={styles.promoDraftScroll}
                contentContainerStyle={styles.promoDraftScrollContent}
                showsVerticalScrollIndicator
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.promoDraftLabel}>{cr.promoListingTitle}</Text>
                <Text selectable style={styles.promoDraftBody}>
                  {promoDraft?.listingTitle || '—'}
                </Text>
                <Text style={styles.promoDraftLabel}>{cr.listingDescription}</Text>
                <Text selectable style={styles.promoDraftBody}>
                  {promoDraft?.listingDescription || '—'}
                </Text>
              </ScrollView>
              <MobileButton
                onPress={() => {
                  if (!promoDraft) return;
                  const titleFit = softFitText(promoDraft.listingTitle, PROMO_TITLE_MAX);
                  const descFit = softFitText(promoDraft.listingDescription, PROMO_DESC_MAX);
                  setPromoTitle(titleFit.text);
                  setDescription(descFit.text);
                  setPromoFingerprint(buildPromoFingerprint());
                  setPromoStale(false);
                  clearFieldError('promoTitle');
                  setPromoAiPhase('closed');
                  setPromoDraft(null);
                }}
              >
                {cr.promoDraftUse}
              </MobileButton>
              <MobileButton variant="outline" onPress={closePromoAiSheet}>
                {cr.promoDraftKeep}
              </MobileButton>
            </>
          )}
        </View>
      </MobileBottomSheet>

      <Modal
        visible={!!requiredPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setRequiredPrompt(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setRequiredPrompt(null)}
          />
          <View style={[styles.modalCard, nativeElevation(2)]}>
            <Text style={styles.modalTitle}>{cr.required}</Text>
            <Text style={styles.modalBody}>{requiredPrompt}</Text>
            <MobileButton onPress={() => setRequiredPrompt(null)}>
              {cr.requiredOk}
            </MobileButton>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    gap: 12,
  },
  chrome: {
    gap: 12,
  },
  formPane: {
    flex: 1,
    minHeight: 0,
    gap: 12,
  },
  hubPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 4,
  },
  hubPreviewThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  hubPreviewThumbImg: {
    width: '100%',
    height: '100%',
  },
  hubPreviewCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  hubPreviewTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: tokens.colors.textHeading,
  },
  hubPreviewMeta: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  hubFootnoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  hubFootnoteIcon: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  hubFootnote: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  hubSaveBanner: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.error,
    backgroundColor: '#FEF2F2',
  },
  hubSaveBannerIcon: {
    color: tokens.colors.error,
    fontWeight: '700',
  },
  hubSaveBannerText: {
    color: tokens.colors.error,
    fontWeight: '600',
  },
  formScroll: {
    flex: 1,
    minHeight: 0,
  },
  formScrollContent: {
    paddingBottom: 8,
    gap: 12,
  },
  sectionStatusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  sectionStatusText: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  footer: {
    paddingTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '500',
    color: tokens.colors.textHeading,
  },
  modalBody: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.textSecondary,
  },
  pageTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 22,
    lineHeight: 33,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  subtitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
    fontWeight: '400',
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: tokens.colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  stepLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 18,
  },
  cardBody: {
    gap: 14,
  },
  sourceScreen: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 4,
    paddingBottom: 8,
    gap: 16,
  },
  sourcePrompt: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 22,
    lineHeight: 33,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  sourceList: {
    gap: 12,
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 76,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  sourceIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sourceTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '500',
    color: tokens.colors.textHeading,
  },
  sourceHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: '#52647A',
  },
  sourceNoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
  },
  sourceNote: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  sourceFooter: {
    paddingTop: 8,
  },
  fieldGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldGridItem: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  layoutSection: {
    gap: 16,
  },
  selectRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  selectRowLocked: {
    backgroundColor: tokens.colors.background,
  },
  selectValue: {
    flex: 1,
    minWidth: 0,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.primary,
  },
  selectPlaceholder: {
    color: tokens.colors.placeholder,
  },
  layoutSheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  layoutSheetScroll: {
    flexShrink: 1,
  },
  layoutSheetHeader: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 10,
    paddingBottom: 8,
    gap: 8,
  },
  layoutSheetClose: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layoutSheetTitle: {
    flexShrink: 0,
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '500',
    color: tokens.colors.textHeading,
    marginBottom: 4,
  },
  layoutSheetRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.border,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  layoutSheetRowSelected: {
    backgroundColor: tokens.colors.brand[100],
    borderBottomColor: 'transparent',
  },
  layoutSheetRowText: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    color: tokens.colors.textHeading,
  },
  layoutSheetRowTextSelected: {
    fontWeight: '700',
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  typeChip: {
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  typeChipText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  typeChipTextSelected: {
    color: tokens.colors.primary,
    fontWeight: '700',
  },
  roomTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roomTypeChip: {
    flexGrow: 1,
    flexBasis: '46%',
    flexShrink: 0,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  roomTypeChipText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  propertyTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  propertyTypeChip: {
    flex: 1,
    minHeight: 52,
    paddingVertical: 12,
  },
  propertyTypeChipText: {
    fontSize: 15,
    lineHeight: 23,
  },
  fieldBlock: {
    gap: 6,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.primary,
    paddingVertical: 10,
  },
  searchClearBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    paddingVertical: 4,
  },
  manualEntryLink: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: tokens.colors.accent,
    textDecorationLine: 'underline',
  },
  addressMultiline: {
    minHeight: 72,
    height: 72,
    paddingVertical: 10,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  halfField: {
    flex: 1,
    minWidth: 0,
  },
  termRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  termChipGrow: {
    flexGrow: 1,
    flexBasis: '28%',
  },
  addLeaseBtn: {
    alignSelf: 'flex-end',
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  addLeaseBtnText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  addLeaseBtnDisabled: {
    opacity: 0.45,
  },
  leaseList: {
    gap: 10,
  },
  leaseCard: {
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  leaseCardText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  leaseCardTitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '700',
    color: tokens.colors.textHeading,
  },
  leaseCardSub: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    color: tokens.colors.textSecondary,
  },
  leaseCardPrice: {
    fontFamily: tokens.typography.native.body,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  leaseSheetFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.border,
  },
  changeContactBtn: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: tokens.colors.white,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  changeContactBtnText: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  addContactLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  addContactLinkText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600',
  },
  leaseSheetTitleBlock: {
    flexShrink: 0,
    flex: 1,
    minWidth: 0,
    paddingTop: 4,
  },
  leaseSheetSubtitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    color: tokens.colors.textSecondary,
    marginTop: 4,
    marginBottom: 4,
  },
  leaseSheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  leaseSheetSection: {
    gap: 8,
  },
  leaseSheetPrimary: {
    marginTop: 4,
  },
  leaseSheetSecondary: {
    marginTop: 0,
  },
  moveInBox: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
    backgroundColor: tokens.colors.background,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  moveInLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  moveInValue: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  promoAssistCard: {
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  promoAssistTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  promoAssistCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  promoAssistHeading: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  promoAssistTitle: {
    flexShrink: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: tokens.colors.textHeading,
    marginLeft: 4,
  },
  promoAssistHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  promoAssistBtn: {
    flexShrink: 0,
    minWidth: 112,
  },
  promoLocaleBlock: {
    gap: 8,
  },
  promoLocaleLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: tokens.colors.textSecondary,
  },
  promoLocaleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promoLocaleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoLocaleChipOn: {
    borderColor: tokens.colors.brand[500],
    backgroundColor: '#FEF3C7',
  },
  promoLocaleChipText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: tokens.colors.textSecondary,
  },
  promoLocaleChipTextOn: {
    color: '#211E1E',
  },
  promoFields: {
    gap: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  promoFieldBlock: { gap: 6 },
  promoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  promoFieldLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  promoRequired: {
    color: tokens.colors.error,
    fontWeight: '700',
  },
  promoCounter: {
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  promoCounterOver: {
    color: tokens.colors.error,
    fontWeight: '700',
  },
  promoPreviewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  promoPreviewLinkText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: tokens.colors.accent,
  },
  promoModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  promoModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    maxHeight: '85%',
    zIndex: 1,
  },
  promoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  promoModalTitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: tokens.colors.textHeading,
  },
  promoModalScroll: {
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: 420,
  },
  promoModalScrollContent: {
    gap: 12,
    paddingBottom: 4,
  },
  promoModalCover: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  promoModalListingTitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  promoModalListingDesc: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
    color: tokens.colors.primary,
  },
  promoDraftSheetPanel: {
    backgroundColor: '#FFFFFF',
  },
  promoDraftSheet: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  promoDraftSheetChrome: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: tokens.colors.primary,
    textAlign: 'center',
  },
  promoHatchWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 4,
    overflow: 'hidden',
  },
  promoDraftSheetTitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '700',
    color: tokens.colors.primary,
    textAlign: 'center',
  },
  promoDraftSheetHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  promoSkeletonBlock: {
    gap: 8,
    marginBottom: 4,
  },
  promoSkeletonLabel: {
    width: 72,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  promoSkeletonLine: {
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EEF2F7',
  },
  promoDraftWarn: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.warning,
  },
  promoDraftScroll: {
    minHeight: 120,
    maxHeight: 280,
    flexGrow: 0,
    flexShrink: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  promoDraftScrollContent: {
    gap: 12,
    paddingBottom: 8,
  },
  promoDraftLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: tokens.colors.textSecondary,
  },
  promoDraftBody: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 23,
    color: tokens.colors.primary,
  },
  promoStaleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  promoStaleText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textHeading,
  },
  hint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  fieldLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    color: tokens.colors.textHeading,
  },
  requiredMark: {
    color: tokens.colors.error,
    fontWeight: '700',
  },
  suggestBox: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  suggestStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestStatusText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  suggestPad: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.border,
  },
  suggestName: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  suggestAddress: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
    marginTop: 2,
  },
  photoCount: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PHOTO_GRID_GAP,
  },
  photosMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  photosMetaLead: {
    flex: 1,
    minWidth: 0,
  },
  photosMetaCount: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  photoTile: {
    width: 140,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  photoTileHit: {
    width: '100%',
    height: '100%',
  },
  photoTileImg: {
    width: '100%',
    height: '100%',
  },
  photoMenuBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  photoEnhanceOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.52)',
  },
  photoEnhanceLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: tokens.colors.white,
  },
  coverBadge: {
    position: 'absolute',
    left: 8,
    top: 8,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  coverBadgeText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  photoAddTile: {
    width: 140,
    height: 140,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
  },
  photoAddLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
    fontWeight: '600',
  },
  photoCard: {
    width: 108,
    gap: 4,
  },
  photoThumb: {
    width: 108,
    height: 108,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  aiBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  aiBadgeText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  contactList: {
    gap: 10,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 72,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  contactCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  contactName: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  contactMeta: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  formBody: {
    gap: 4,
  },
  footerSolo: {
    width: '100%',
    gap: 10,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 2,
  },
  footerNoteText: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  footerCta: {
    minHeight: 48,
    borderRadius: 12,
  },
  footerCtaText: {
    fontSize: 16,
    lineHeight: 24,
  },
  sourceLead: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
    color: tokens.colors.textSecondary,
  },
  photoSlot: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.background,
  },
  photoSlotLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    color: tokens.colors.textSecondary,
  },
  ownerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 14,
    gap: 8,
  },
  ownerCardName: {
    fontFamily: tokens.typography.native.body,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: tokens.colors.textHeading,
  },
  ownerCardPhone: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.primary,
  },
  ownerCardMeta: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  ownerCardNote: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  ownerMatchBox: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    padding: 12,
    gap: 8,
    backgroundColor: tokens.colors.background,
  },
  errorText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.error,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
