import type {
  AdviceRequestPayload,
  CityLocation,
  CommuteType,
  HouseholdMember,
  LanguageMode,
  PlaceTypeLabel,
  UsAqiCategoryLabel,
  UserType,
} from '../types/airQuality.ts';

export const LOW_ACCURACY_THRESHOLD_METERS = 5000;

export type AqiCategoryKey =
  | 'good'
  | 'moderate'
  | 'sensitive'
  | 'unhealthy'
  | 'very_unhealthy'
  | 'hazardous'
  | 'invalid';

export interface AqiCategoryInfo {
  key: AqiCategoryKey;
  labelEn: UsAqiCategoryLabel | 'Unavailable';
  labelHinglish: string;
  rangeLabel: string;
  summaryEn: string;
  summaryHinglish: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  swatchClass: string;
  glyph: string;
}

export const VALID_HOUSEHOLD_MEMBERS: readonly HouseholdMember[] = [
  'children',
  'seniors',
  'breathing_issues',
  'pets',
  'just_me',
  'general_skip',
];

export const VALID_USER_TYPES: readonly UserType[] = [
  'working_professional',
  'student',
  'parent',
];

export const VALID_COMMUTE_TYPES: readonly CommuteType[] = [
  'metro_public_transit',
  'two_wheeler',
  'car_cab',
  'walking_cycling',
  'work_from_home',
];

export function getAqiCategory(aqi: number | null | undefined): AqiCategoryInfo {
  if (aqi === null || aqi === undefined || !Number.isFinite(aqi) || aqi < 0) {
    return {
      key: 'invalid',
      labelEn: 'Unavailable',
      labelHinglish: 'Uplabdh Nahi',
      rangeLabel: '—',
      summaryEn: 'Enter a valid US AQI value (0 or higher) to classify risk.',
      summaryHinglish: 'Risk samajhne ke liye sahi US AQI number (0 ya zyada) daalein.',
      textClass: 'text-slate-700',
      bgClass: 'bg-slate-100',
      borderClass: 'border-slate-300',
      swatchClass: 'bg-slate-400',
      glyph: '—',
    };
  }

  const rounded = Math.round(aqi);

  if (rounded <= 50) {
    return {
      key: 'good',
      labelEn: 'Good',
      labelHinglish: 'Acchi Hawa (Good)',
      rangeLabel: '0–50',
      summaryEn: 'Clean air with minimal winter smog impact for most people.',
      summaryHinglish: 'Hawa saaf hai, zyadaatar logon ke liye surakshit hai.',
      textClass: 'text-emerald-800',
      bgClass: 'bg-emerald-50',
      borderClass: 'border-emerald-200',
      swatchClass: 'bg-emerald-600',
      glyph: '●',
    };
  }

  if (rounded <= 100) {
    return {
      key: 'moderate',
      labelEn: 'Moderate',
      labelHinglish: 'Theek-Thak (Moderate)',
      rangeLabel: '51–100',
      summaryEn: 'Acceptable air quality; unusually sensitive individuals should monitor symptoms.',
      summaryHinglish: 'Hawa theek hai, par sensitive logon ko thoda dhyaan rakhna chahiye.',
      textClass: 'text-amber-800',
      bgClass: 'bg-amber-50',
      borderClass: 'border-amber-200',
      swatchClass: 'bg-amber-500',
      glyph: '◆',
    };
  }

  if (rounded <= 150) {
    return {
      key: 'sensitive',
      labelEn: 'Unhealthy for Sensitive Groups',
      labelHinglish: 'Sensitive Logon Ke Liye Kharab',
      rangeLabel: '101–150',
      summaryEn: 'Sensitive groups may experience irritation; reduce prolonged outdoor exertion.',
      summaryHinglish: 'Sensitive logon ko takleef ho sakti hai; lambi outdoor activity kam karein.',
      textClass: 'text-orange-800',
      bgClass: 'bg-orange-50',
      borderClass: 'border-orange-200',
      swatchClass: 'bg-orange-500',
      glyph: '▲',
    };
  }

  if (rounded <= 200) {
    return {
      key: 'unhealthy',
      labelEn: 'Unhealthy',
      labelHinglish: 'Kharab Hawa (Unhealthy)',
      rangeLabel: '151–200',
      summaryEn: 'Winter haze is high; limit outdoor exertion and wear an N95 mask in traffic.',
      summaryHinglish: 'Sardi ka smog zyada hai; bahar ki activity kam karein aur N95 mask pehnein.',
      textClass: 'text-red-800',
      bgClass: 'bg-red-50',
      borderClass: 'border-red-200',
      swatchClass: 'bg-red-600',
      glyph: '▲',
    };
  }

  if (rounded <= 300) {
    return {
      key: 'very_unhealthy',
      labelEn: 'Very Unhealthy',
      labelHinglish: 'Bahut Kharab (Very Unhealthy)',
      rangeLabel: '201–300',
      summaryEn: 'Heavy winter smog; keep activity indoors and seal morning drafts.',
      summaryHinglish: 'Ghani smog hai; zyadaatar samay ghar ke andar rahein aur khidkiyan band rakhein.',
      textClass: 'text-purple-900',
      bgClass: 'bg-purple-50',
      borderClass: 'border-purple-200',
      swatchClass: 'bg-purple-700',
      glyph: '■',
    };
  }

  return {
    key: 'hazardous',
    labelEn: 'Hazardous',
    labelHinglish: 'Khatarnak (Hazardous)',
    rangeLabel: '301+',
    summaryEn: 'Severe air emergency; avoid outdoor exertion, use N95 masks and indoor air purification.',
    summaryHinglish: 'Hawa behad khatarnak hai; bahar bilkul na niklein aur mask/purifier chalayein.',
    textClass: 'text-rose-950',
    bgClass: 'bg-rose-100',
    borderClass: 'border-rose-300',
    swatchClass: 'bg-rose-800',
    glyph: '✖',
  };
}

export function getRiskCategoryFromAqi(
  aqi: number | null | undefined
): { level: UsAqiCategoryLabel; info: AqiCategoryInfo } {
  const info = getAqiCategory(aqi);
  const level: UsAqiCategoryLabel =
    info.labelEn === 'Unavailable' ? 'Hazardous' : info.labelEn;
  return { level, info };
}

export interface ValidatableInputs {
  cityName: string;
  usAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  userType: UserType | '';
  commuteType: CommuteType | '';
  household: HouseholdMember[];
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateAirQualityInputs(
  inputs: ValidatableInputs,
  language: LanguageMode = 'en'
): ValidationResult {
  const errors: Record<string, string> = {};
  const isHi = language === 'hinglish';

  const trimmedCity = inputs.cityName.trim();
  if (trimmedCity.length < 2) {
    errors.cityName = isHi
      ? 'Kripya kam se kam 2 akshar ka shehar ya jagah ka naam daalein ya apni location chunein.'
      : 'Please search an Indian city/place (at least 2 characters) or use your location.';
  }

  if (
    inputs.usAqi === null ||
    inputs.usAqi === undefined ||
    !Number.isFinite(inputs.usAqi)
  ) {
    errors.usAqi = isHi
      ? 'US AQI reading zaroori hai. Location fetch karein ya manual AQI number daalein.'
      : 'A valid US AQI reading is required. Fetch air quality or enter AQI manually.';
  } else if (inputs.usAqi < 0 || inputs.usAqi > 1000) {
    errors.usAqi = isHi
      ? 'US AQI 0 se 1000 ke beech hona chahiye.'
      : 'US AQI must be between 0 and 1000.';
  }

  if (inputs.pm25 !== null && inputs.pm25 !== undefined) {
    if (!Number.isFinite(inputs.pm25) || inputs.pm25 < 0 || inputs.pm25 > 2500) {
      errors.pm25 = isHi
        ? 'PM2.5 value 0 se 2500 µg/m³ ke beech honi chahiye.'
        : 'PM2.5 must be between 0 and 2500 µg/m³.';
    }
  }

  if (inputs.pm10 !== null && inputs.pm10 !== undefined) {
    if (!Number.isFinite(inputs.pm10) || inputs.pm10 < 0 || inputs.pm10 > 4000) {
      errors.pm10 = isHi
        ? 'PM10 value 0 se 4000 µg/m³ ke beech honi chahiye.'
        : 'PM10 must be between 0 and 4000 µg/m³.';
    }
  }

  if (!inputs.userType || !VALID_USER_TYPES.includes(inputs.userType)) {
    errors.userType = isHi
      ? 'Kripya apna role (working professional, student, ya parent) chunein.'
      : 'Please select who you are (working professional, student, or parent).';
  }

  if (!inputs.commuteType || !VALID_COMMUTE_TYPES.includes(inputs.commuteType)) {
    errors.commuteType = isHi
      ? 'Kripya apna primary commute mode chunein.'
      : 'Please select your primary commute type.';
  }

  const invalidHousehold = inputs.household.some(
    (member) => !VALID_HOUSEHOLD_MEMBERS.includes(member)
  );
  if (invalidHousehold) {
    errors.household = isHi
      ? 'Ghar ke sadasyon mein kuch galat option chuna gaya hai.'
      : 'Household selection contains an unrecognized member type.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function getTodayLocalDateISO(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTodayReadableDate(
  language: LanguageMode,
  now: Date = new Date()
): string {
  return new Intl.DateTimeFormat(language === 'hinglish' ? 'en-IN' : 'en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(now);
}

export function buildAdviceCacheKey(payload: AdviceRequestPayload): string {
  const sortedHousehold = [...payload.profile.household].sort().join(',');
  const normalizedCity = payload.location.cityName.trim().toLowerCase();
  const pm25Key =
    payload.airQuality.pm25 === null ? 'na' : Math.round(payload.airQuality.pm25);
  const pm10Key =
    payload.airQuality.pm10 === null ? 'na' : Math.round(payload.airQuality.pm10);

  return [
    'uqa_v2',
    payload.todayDate,
    payload.language,
    normalizedCity,
    Math.round(payload.airQuality.usAqi),
    pm25Key,
    pm10Key,
    sortedHousehold || 'none',
    payload.profile.userType,
    payload.profile.commuteType,
    payload.profile.hasMask ? 'm1' : 'm0',
    payload.profile.hasPurifier ? 'p1' : 'p0',
  ].join('|');
}

export function isLowLocationAccuracy(accuracyMeters?: number | null): boolean {
  return (
    accuracyMeters !== null &&
    accuracyMeters !== undefined &&
    Number.isFinite(accuracyMeters) &&
    accuracyMeters > LOW_ACCURACY_THRESHOLD_METERS
  );
}

export function formatAccuracyReadable(
  accuracyMeters?: number | null
): string | null {
  if (
    accuracyMeters === null ||
    accuracyMeters === undefined ||
    !Number.isFinite(accuracyMeters) ||
    accuracyMeters < 0
  ) {
    return null;
  }
  const rounded = Math.round(accuracyMeters);
  if (rounded < 1000) {
    return `${rounded} m`;
  }
  const km = rounded / 1000;
  const kmStr = km >= 10 ? String(Math.round(km)) : String(Number(km.toFixed(1)));
  return `${kmStr} km`;
}

export function formatPlaceDisplay(
  location: CityLocation,
  language: LanguageMode = 'en'
): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const raw of [
    location.cityName,
    location.area,
    location.district,
    location.admin1,
  ]) {
    const val = raw?.trim();
    if (!val) continue;
    const key = val.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(val);
  }
  const base = parts.join(', ');
  if (location.isGeolocation && isLowLocationAccuracy(location.accuracyMeters)) {
    const prefix =
      language === 'hinglish'
        ? 'Andazan ilaka (exact nahi)'
        : 'Approximate area (not exact)';
    return `${prefix}: ${base}`;
  }
  return base;
}

export function extractPrimaryPlaceName(rawQuery: string): string {
  const beforeComma = rawQuery.split(',')[0] ?? '';
  return beforeComma.trim().replace(/\s+/g, ' ');
}

export function extractFirstWord(placeName: string): string {
  const normalized = placeName.trim().replace(/\s+/g, ' ');
  if (!normalized) return '';
  return normalized.split(' ')[0] ?? '';
}

export function validateCoordinates(
  latInput: string,
  lonInput: string,
  language: LanguageMode = 'en'
): { valid: boolean; latitude?: number; longitude?: number; error?: string } {
  const latTrimmed = latInput.trim();
  const lonTrimmed = lonInput.trim();
  const lat = Number(latTrimmed);
  const lon = Number(lonTrimmed);

  if (
    latTrimmed === '' ||
    lonTrimmed === '' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return {
      valid: false,
      error:
        language === 'hinglish'
          ? 'Kripya sahi latitude (-90 se 90) aur longitude (-180 se 180) daalein.'
          : 'Please enter a valid latitude (-90 to 90) and longitude (-180 to 180).',
    };
  }

  return { valid: true, latitude: lat, longitude: lon };
}

export function parsePastedCoordinates(
  rawInput: string,
  language: LanguageMode = 'en'
): { valid: boolean; latitude?: number; longitude?: number; error?: string } {
  const unwrapped = rawInput.trim().replace(/^\((.*)\)$/, '$1').trim();
  const match = unwrapped.match(
    /^([+-]?\d+(?:\.\d+)?)\s*°?\s*([nsNS])?(?:\s*,\s*|\s+)([+-]?\d+(?:\.\d+)?)\s*°?\s*([ewEW])?$/
  );

  if (!match) {
    return {
      valid: false,
      error:
        language === 'hinglish'
          ? 'Coordinates samajh nahi aaye. Is tarah paste karein: "19.55, 74.10".'
          : 'Could not read coordinates. Paste them like "19.55, 74.10".',
    };
  }

  let lat = Number(match[1]);
  let lon = Number(match[3]);
  const ns = match[2]?.toUpperCase();
  const ew = match[4]?.toUpperCase();

  if (ns === 'S') lat = -Math.abs(lat);
  if (ns === 'N') lat = Math.abs(lat);
  if (ew === 'W') lon = -Math.abs(lon);
  if (ew === 'E') lon = Math.abs(lon);

  return validateCoordinates(String(lat), String(lon), language);
}

export type GeolocationPermissionState =
  | 'granted'
  | 'prompt'
  | 'denied'
  | 'unsupported'
  | 'checking';

export interface MappedGeolocationError {
  code: number;
  kind: 'permission_denied' | 'position_unavailable' | 'timeout' | 'unknown';
  userMessage: string;
  shouldRetryLowAccuracy: boolean;
  isBlockedByPolicy: boolean;
}

export function mapGeolocationError(
  code: number,
  rawMessage = '',
  language: LanguageMode = 'en'
): MappedGeolocationError {
  const isHi = language === 'hinglish';
  const lower = rawMessage.toLowerCase();
  const isBlockedByPolicy =
    lower.includes('permissions policy') ||
    lower.includes('feature policy') ||
    lower.includes('has been disabled in this document');

  if (code === 1) {
    return {
      code: 1,
      kind: 'permission_denied',
      userMessage: isBlockedByPolicy
        ? isHi
          ? 'Is iframe mein location access block hai. Niche diye "Open in new tab" link se seedha kholein.'
          : 'Location access is blocked inside this embedded frame. Open the app in a new tab to use GPS.'
        : isHi
          ? 'Location permission deny hui hai. Niche diye Chrome steps follow karein ya "Having trouble? Other ways" se shehar chunein.'
          : 'Location permission was denied. Follow the Chrome steps below to allow location, or use "Having trouble? Other ways".',
      shouldRetryLowAccuracy: false,
      isBlockedByPolicy,
    };
  }

  if (code === 2) {
    return {
      code: 2,
      kind: 'position_unavailable',
      userMessage: isHi
        ? 'Aapka device abhi position nahi dhoondh paaya. Phone ki Location on karein aur dobara try karein.'
        : 'Your device could not find its position. Turn on phone Location and try again.',
      shouldRetryLowAccuracy: false,
      isBlockedByPolicy: false,
    };
  }

  if (code === 3) {
    return {
      code: 3,
      kind: 'timeout',
      userMessage: isHi
        ? 'Location fetch karne mein samay zyada lag gaya (timeout). Khule aasman ya window ke paas dobara try karein, ya niche shehar search karein.'
        : 'Location lookup timed out before receiving a fix. Please try again, or use "Having trouble? Other ways" below.',
      shouldRetryLowAccuracy: true,
      isBlockedByPolicy: false,
    };
  }

  return {
    code,
    kind: 'unknown',
    userMessage: isHi
      ? 'Location fetch karte samay error aaya. Dobara try karein ya "Having trouble? Other ways" use karein.'
      : 'Could not read your device location right now. Please try again or use "Having trouble? Other ways".',
    shouldRetryLowAccuracy: false,
    isBlockedByPolicy: false,
  };
}

export const MIN_SEARCH_QUERY_LENGTH = 3;
export const SEARCH_DEBOUNCE_MS = 350;

export interface PhotonFeature {
  geometry?: {
    coordinates?: number[];
  };
  properties?: {
    name?: string;
    osm_key?: string;
    osm_value?: string;
    type?: string;
    locality?: string;
    suburb?: string;
    street?: string;
    district?: string;
    county?: string;
    city?: string;
    state?: string;
    countrycode?: string;
  };
}

export interface PhotonFeatureCollection {
  features?: PhotonFeature[];
}

export function normalizeSearchQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export interface ParsedLocationSearchQuery {
  primarySearchText: string;
  firstWord: string;
  words: string[];
  rankingTerms: string[];
  hasComma: boolean;
}

export function parseLocationSearchQuery(
  rawQuery: string
): ParsedLocationSearchQuery {
  const normalizedFull = normalizeSearchQuery(rawQuery);
  const commaIdx = normalizedFull.indexOf(',');
  const hasComma = commaIdx !== -1;
  const beforeCommaRaw = hasComma
    ? normalizedFull.slice(0, commaIdx)
    : normalizedFull;
  const afterCommaRaw = hasComma ? normalizedFull.slice(commaIdx + 1) : '';

  const primarySearchText = normalizeSearchQuery(beforeCommaRaw);
  const words = primarySearchText ? primarySearchText.split(' ') : [];
  const firstWord = words[0] ?? '';

  const rankingTerms = normalizeSearchQuery(afterCommaRaw)
    .split(/[,\s]+/)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length >= 2);

  return {
    primarySearchText,
    firstWord,
    words,
    rankingTerms,
    hasComma,
  };
}

export function shouldTriggerLocationSearch(
  raw: string,
  minLength = MIN_SEARCH_QUERY_LENGTH
): string | null {
  const normalized = normalizeSearchQuery(raw);
  return normalized.length >= minLength ? normalized : null;
}

export function createDebouncedCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs = SEARCH_DEBOUNCE_MS
): { run: (...args: Args) => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    run: (...args: Args) => {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = undefined;
        fn(...args);
      }, delayMs);
    },
    cancel: () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
  };
}

export function formatSuggestionSubline(
  location: Pick<CityLocation, 'cityName' | 'area' | 'district' | 'admin1'>
): string {
  const seen = new Set<string>();
  const primary = location.cityName.trim().toLowerCase();
  if (primary) {
    seen.add(primary);
  }
  const parts: string[] = [];
  for (const raw of [location.area, location.district, location.admin1]) {
    const val = raw?.trim();
    if (!val) continue;
    const key = val.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(val);
  }
  return parts.join(', ');
}

const POPULATED_PLACE_VALUES = new Set([
  'city',
  'town',
  'village',
  'hamlet',
  'suburb',
]);

export interface ClassifiedPhotonPlace {
  placeType: PlaceTypeLabel;
  isPopulatedPlace: boolean;
  typePriority: number;
}

export function classifyPhotonPlace(
  props?: PhotonFeature['properties'] | null
): ClassifiedPhotonPlace {
  const osmKey = props?.osm_key?.trim().toLowerCase() ?? '';
  const osmValue = props?.osm_value?.trim().toLowerCase() ?? '';
  const photonType = props?.type?.trim().toLowerCase() ?? '';

  if (osmKey && osmKey !== 'place' && osmKey !== 'boundary') {
    return {
      placeType: 'Landmark',
      isPopulatedPlace: false,
      typePriority: 10,
    };
  }

  const candidate = POPULATED_PLACE_VALUES.has(osmValue)
    ? osmValue
    : POPULATED_PLACE_VALUES.has(photonType)
      ? photonType
      : osmValue || photonType;

  if (candidate === 'city') {
    return { placeType: 'City', isPopulatedPlace: true, typePriority: 1 };
  }
  if (candidate === 'town') {
    return { placeType: 'Town', isPopulatedPlace: true, typePriority: 2 };
  }
  if (candidate === 'suburb') {
    return { placeType: 'Town', isPopulatedPlace: true, typePriority: 3 };
  }
  if (candidate === 'village') {
    return { placeType: 'Village', isPopulatedPlace: true, typePriority: 4 };
  }
  if (candidate === 'hamlet') {
    return { placeType: 'Village', isPopulatedPlace: true, typePriority: 5 };
  }

  return {
    placeType: 'Landmark',
    isPopulatedPlace: false,
    typePriority: 10,
  };
}

export function parsePhotonSuggestionsTyped(
  data: PhotonFeatureCollection | null | undefined,
  limit = 16
): CityLocation[] {
  const features = data?.features ?? [];
  const results: CityLocation[] = [];

  for (const feature of features) {
    const props = feature.properties;
    const coords = feature.geometry?.coordinates;
    if (!props || !Array.isArray(coords) || coords.length < 2) continue;

    if (props.countrycode?.toUpperCase() !== 'IN') continue;

    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const primaryName =
      props.name?.trim() ||
      props.locality?.trim() ||
      props.city?.trim();
    if (!primaryName) continue;

    const classified = classifyPhotonPlace(props);
    const districtCandidate =
      props.district?.trim() || props.county?.trim() || undefined;
    const stateCandidate = props.state?.trim() || undefined;

    const rawArea =
      props.locality?.trim() ||
      props.suburb?.trim() ||
      props.street?.trim() ||
      (props.city?.trim() &&
      props.city.trim().toLowerCase() !== primaryName.toLowerCase()
        ? props.city.trim()
        : undefined);

    const areaCandidate =
      rawArea &&
      rawArea.toLowerCase() !== primaryName.toLowerCase() &&
      rawArea.toLowerCase() !== districtCandidate?.toLowerCase()
        ? rawArea
        : undefined;

    results.push({
      cityName: primaryName,
      area: areaCandidate,
      district:
        districtCandidate &&
        districtCandidate.toLowerCase() !== primaryName.toLowerCase()
          ? districtCandidate
          : undefined,
      admin1: stateCandidate,
      countryCode: 'IN',
      latitude: lat,
      longitude: lon,
      placeType: classified.placeType,
      isLandmark: !classified.isPopulatedPlace,
    });

    if (results.length >= limit) break;
  }

  return results;
}

export interface MergeRankPlacesOptions {
  candidates: CityLocation[];
  searchText: string;
  rankingTerms?: string[];
  maxPopulated?: number;
  maxLandmarks?: number;
}

function getPlaceTypeRank(placeType?: PlaceTypeLabel): number {
  if (placeType === 'City') return 3;
  if (placeType === 'Town') return 2;
  if (placeType === 'Village') return 1;
  return 0;
}

function scorePlaceRelevance(
  place: CityLocation,
  searchLower: string,
  rankingTerms: string[]
): { contextScore: number; nameScore: number; typeRank: number } {
  const haystack = [
    place.district,
    place.admin1,
    place.area,
    place.cityName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let contextScore = 0;
  for (const term of rankingTerms) {
    if (term && haystack.includes(term)) {
      contextScore += 1;
    }
  }

  const nameLower = place.cityName.trim().toLowerCase();
  let nameScore = 0;
  if (searchLower) {
    if (nameLower === searchLower) {
      nameScore = 3;
    } else if (nameLower.startsWith(searchLower)) {
      nameScore = 2;
    } else if (nameLower.includes(searchLower)) {
      nameScore = 1;
    }
  }

  return {
    contextScore,
    nameScore,
    typeRank: getPlaceTypeRank(place.placeType),
  };
}

export function mergeAndRankPlaceSuggestions({
  candidates,
  searchText,
  rankingTerms = [],
  maxPopulated = 8,
  maxLandmarks = 2,
}: MergeRankPlacesOptions): CityLocation[] {
  const normalizedTerms = rankingTerms
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length >= 2);
  const searchLower = searchText.trim().toLowerCase();

  // Deduplicate candidates while preferring populated places and richer metadata
  const deduped: CityLocation[] = [];
  for (const item of candidates) {
    if (item.countryCode && item.countryCode.toUpperCase() !== 'IN') {
      continue;
    }
    const itemName = item.cityName.trim().toLowerCase();
    if (!itemName) continue;

    const existingIdx = deduped.findIndex((existing) => {
      const sameName = existing.cityName.trim().toLowerCase() === itemName;
      if (!sameName) return false;

      if (
        existing.latitude !== undefined &&
        existing.longitude !== undefined &&
        item.latitude !== undefined &&
        item.longitude !== undefined
      ) {
        const latDiff = Math.abs(existing.latitude - item.latitude);
        const lonDiff = Math.abs(existing.longitude - item.longitude);
        if (latDiff < 0.02 && lonDiff < 0.02) {
          return true;
        }
      }

      const sameDistrict =
        (existing.district ?? '').trim().toLowerCase() ===
        (item.district ?? '').trim().toLowerCase();
      const sameState =
        (existing.admin1 ?? '').trim().toLowerCase() ===
        (item.admin1 ?? '').trim().toLowerCase();
      return sameDistrict && sameState;
    });

    if (existingIdx === -1) {
      deduped.push({
        ...item,
        placeType: item.placeType ?? (item.isLandmark ? 'Landmark' : 'Town'),
        isLandmark: Boolean(item.isLandmark || item.placeType === 'Landmark'),
      });
    } else {
      const current = deduped[existingIdx];
      const currentIsLandmark = Boolean(
        current.isLandmark || current.placeType === 'Landmark'
      );
      const nextIsLandmark = Boolean(
        item.isLandmark || item.placeType === 'Landmark'
      );
      // Upgrade landmark to populated place or enrich missing district/state
      if (currentIsLandmark && !nextIsLandmark) {
        deduped[existingIdx] = {
          ...item,
          district: item.district || current.district,
          admin1: item.admin1 || current.admin1,
          area: item.area || current.area,
          isLandmark: false,
        };
      } else {
        deduped[existingIdx] = {
          ...current,
          district: current.district || item.district,
          admin1: current.admin1 || item.admin1,
          area: current.area || item.area,
        };
      }
    }
  }

  const populated = deduped.filter((item) => !item.isLandmark);
  const landmarks = deduped.filter((item) => item.isLandmark);

  const compare = (a: CityLocation, b: CityLocation): number => {
    const sa = scorePlaceRelevance(a, searchLower, normalizedTerms);
    const sb = scorePlaceRelevance(b, searchLower, normalizedTerms);
    if (sb.contextScore !== sa.contextScore) {
      return sb.contextScore - sa.contextScore;
    }
    if (sb.nameScore !== sa.nameScore) {
      return sb.nameScore - sa.nameScore;
    }
    if (sb.typeRank !== sa.typeRank) {
      return sb.typeRank - sa.typeRank;
    }
    return 0;
  };

  const sortedPopulated = [...populated].sort(compare).slice(0, maxPopulated);
  const sortedLandmarks = [...landmarks].sort(compare).slice(0, maxLandmarks);

  return [...sortedPopulated, ...sortedLandmarks];
}

export function parsePhotonSuggestions(
  data: PhotonFeatureCollection | null | undefined,
  limit = 8
): CityLocation[] {
  const features = data?.features ?? [];
  const results: CityLocation[] = [];

  for (const feature of features) {
    const props = feature.properties;
    const coords = feature.geometry?.coordinates;
    if (!props || !Array.isArray(coords) || coords.length < 2) continue;

    if (props.countrycode?.toUpperCase() !== 'IN') continue;

    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const primaryName =
      props.name?.trim() ||
      props.locality?.trim() ||
      props.district?.trim() ||
      props.city?.trim() ||
      props.county?.trim() ||
      props.state?.trim();
    if (!primaryName) continue;

    const areaCandidate =
      props.locality?.trim() ||
      props.suburb?.trim() ||
      props.street?.trim() ||
      (props.city?.trim() &&
      props.city.trim().toLowerCase() !== primaryName.toLowerCase()
        ? props.city.trim()
        : undefined);

    const districtCandidate =
      props.district?.trim() || props.county?.trim() || undefined;
    const stateCandidate = props.state?.trim() || undefined;

    results.push({
      cityName: primaryName,
      area:
        areaCandidate &&
        areaCandidate.toLowerCase() !== primaryName.toLowerCase()
          ? areaCandidate
          : undefined,
      district:
        districtCandidate &&
        districtCandidate.toLowerCase() !== primaryName.toLowerCase() &&
        districtCandidate.toLowerCase() !== areaCandidate?.toLowerCase()
          ? districtCandidate
          : undefined,
      admin1: stateCandidate,
      countryCode: 'IN',
      latitude: lat,
      longitude: lon,
    });

    if (results.length >= limit) break;
  }

  return results;
}

export function parsePhotonReverseLocation(
  data: PhotonFeatureCollection | null | undefined,
  latitude: number,
  longitude: number,
  accuracyMeters?: number
): CityLocation {
  const coordFallback = `${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E`;
  const roundedAcc =
    accuracyMeters !== undefined && Number.isFinite(accuracyMeters)
      ? Math.round(accuracyMeters)
      : undefined;

  const props = data?.features?.[0]?.properties;
  if (!props) {
    return {
      cityName: coordFallback,
      latitude,
      longitude,
      accuracyMeters: roundedAcc,
      isGeolocation: true,
    };
  }

  const isPlaceEntity =
    props.osm_key === 'place' || props.osm_key === 'boundary';
  const primaryName = isPlaceEntity
    ? props.name?.trim() ||
      props.locality?.trim() ||
      props.district?.trim() ||
      props.city?.trim() ||
      props.county?.trim()
    : props.locality?.trim() ||
      props.suburb?.trim() ||
      props.district?.trim() ||
      props.city?.trim() ||
      props.county?.trim() ||
      props.name?.trim();

  if (!primaryName) {
    return {
      cityName: coordFallback,
      latitude,
      longitude,
      accuracyMeters: roundedAcc,
      isGeolocation: true,
    };
  }

  const district = props.district?.trim() || props.county?.trim();
  const state = props.state?.trim();

  return {
    cityName: primaryName,
    district:
      district && district.toLowerCase() !== primaryName.toLowerCase()
        ? district
        : undefined,
    admin1:
      state && state.toLowerCase() !== primaryName.toLowerCase()
        ? state
        : undefined,
    countryCode: props.countrycode?.toUpperCase(),
    latitude,
    longitude,
    accuracyMeters: roundedAcc,
    isGeolocation: true,
  };
}




