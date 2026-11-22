import {
  extractFirstWord,
  extractPrimaryPlaceName,
  mergeAndRankPlaceSuggestions,
  normalizeSearchQuery,
  parseLocationSearchQuery,
  parsePhotonReverseLocation,
  parsePhotonSuggestionsTyped,
  type PhotonFeatureCollection,
} from './aqi.ts';
import type {
  AirQualityReading,
  CityLocation,
  PlaceTypeLabel,
} from '../types/airQuality.ts';

interface OpenMeteoGeocodeResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country_code?: string;
  country?: string;
  admin1?: string;
  admin2?: string;
  feature_code?: string;
  population?: number;
}

interface OpenMeteoGeocodeResponse {
  results?: OpenMeteoGeocodeResult[];
}

interface OpenMeteoAirQualityResponse {
  current?: {
    time?: string;
    us_aqi?: number | null;
    pm2_5?: number | null;
    pm10?: number | null;
  };
  error?: boolean;
  reason?: string;
}

const suggestionSessionCache = new Map<string, CityLocation[]>();

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 8000,
  externalSignal?: AbortSignal
): Promise<Response> {
  if (externalSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

async function queryOpenMeteoGeocode(
  placeName: string,
  signal?: AbortSignal
): Promise<OpenMeteoGeocodeResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    placeName
  )}&count=16&language=en&format=json`;

  const response = await fetchWithTimeout(url, 8000, signal);
  if (!response.ok) {
    throw new Error(`GEOCODE_HTTP_${response.status}`);
  }

  const data = (await response.json()) as OpenMeteoGeocodeResponse;
  return data.results ?? [];
}

function inferOpenMeteoPlaceType(item: OpenMeteoGeocodeResult): PlaceTypeLabel {
  const code = item.feature_code?.toUpperCase() ?? '';
  const pop = item.population ?? 0;
  if (code === 'PPLC' || code === 'PPLA' || code === 'PPLA2' || pop >= 100000) {
    return 'City';
  }
  if (pop > 0 && pop < 10000) {
    return 'Village';
  }
  return 'Town';
}

export async function geocodeIndianCity(
  cityQuery: string,
  limit = 8,
  signal?: AbortSignal
): Promise<CityLocation[]> {
  const primaryName = extractPrimaryPlaceName(cityQuery);
  if (primaryName.length < 2) {
    throw new Error('CITY_TOO_SHORT');
  }

  let rawResults = await queryOpenMeteoGeocode(primaryName, signal);

  if (rawResults.length === 0) {
    const firstWord = extractFirstWord(primaryName);
    if (
      firstWord.length >= 2 &&
      firstWord.toLowerCase() !== primaryName.toLowerCase()
    ) {
      rawResults = await queryOpenMeteoGeocode(firstWord, signal);
    }
  }

  if (rawResults.length === 0) {
    throw new Error('CITY_NOT_FOUND');
  }

  const indianMatches = rawResults.filter(
    (item) => item.country_code?.toUpperCase() === 'IN'
  );
  const prioritized = indianMatches.length > 0 ? indianMatches : rawResults;

  return prioritized.slice(0, limit).map((item) => ({
    cityName: item.name,
    district: item.admin2,
    admin1: item.admin1,
    countryCode: item.country_code,
    latitude: item.latitude,
    longitude: item.longitude,
    placeType: inferOpenMeteoPlaceType(item),
    isLandmark: false,
  }));
}

async function fetchSinglePhotonQuery(
  url: string,
  signal?: AbortSignal
): Promise<CityLocation[]> {
  const response = await fetchWithTimeout(url, 6000, signal);
  if (!response.ok) {
    throw new Error(`PHOTON_HTTP_${response.status}`);
  }
  const geojson = (await response.json()) as PhotonFeatureCollection;
  return parsePhotonSuggestionsTyped(geojson, 12);
}

async function fetchPhotonDualResults(
  searchText: string,
  signal?: AbortSignal
): Promise<{ populatedAndTagged: CityLocation[]; hadNetworkSuccess: boolean }> {
  const encoded = encodeURIComponent(searchText);
  const placedUrl = `https://photon.komoot.io/api/?q=${encoded}&bbox=68.1,6.7,97.4,35.7&osm_tag=place&limit=10`;
  const unfilteredUrl = `https://photon.komoot.io/api/?q=${encoded}&bbox=68.1,6.7,97.4,35.7&limit=10`;

  const [placedOutcome, unfilteredOutcome] = await Promise.allSettled([
    fetchSinglePhotonQuery(placedUrl, signal),
    fetchSinglePhotonQuery(unfilteredUrl, signal),
  ]);

  if (
    (placedOutcome.status === 'rejected' && isAbortError(placedOutcome.reason)) ||
    (unfilteredOutcome.status === 'rejected' &&
      isAbortError(unfilteredOutcome.reason))
  ) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const combined: CityLocation[] = [];
  let hadNetworkSuccess = false;

  if (placedOutcome.status === 'fulfilled') {
    hadNetworkSuccess = true;
    combined.push(...placedOutcome.value);
  }
  if (unfilteredOutcome.status === 'fulfilled') {
    hadNetworkSuccess = true;
    combined.push(...unfilteredOutcome.value);
  }

  return { populatedAndTagged: combined, hadNetworkSuccess };
}

export async function searchIndianPlacesWithFallback(
  rawQuery: string,
  limit = 8,
  signal?: AbortSignal
): Promise<CityLocation[]> {
  const normalized = normalizeSearchQuery(rawQuery);
  const cacheKey = normalized.toLowerCase();
  const cached = suggestionSessionCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const parsedQuery = parseLocationSearchQuery(normalized);
  if (parsedQuery.primarySearchText.length < 2) {
    return [];
  }

  const effectiveRankingTerms = [...parsedQuery.rankingTerms];
  let allCandidates: CityLocation[] = [];
  let photonSucceeded = false;

  // 1. Call Photon twice: osm_tag=place and unfiltered (India bounding box + countrycode IN)
  const primaryPhoton = await fetchPhotonDualResults(
    parsedQuery.primarySearchText,
    signal
  );
  allCandidates.push(...primaryPhoton.populatedAndTagged);
  photonSucceeded = primaryPhoton.hadNetworkSuccess;

  // 2. If user typed "<place> <nearby bigger place>" without a comma (e.g. "Akole Ahilyanagar"),
  // and primary search returned fewer than 2 populated places, search first word & rank by remaining words
  const primaryPopulatedCount = allCandidates.filter(
    (item) => !item.isLandmark
  ).length;
  if (
    !parsedQuery.hasComma &&
    parsedQuery.words.length >= 2 &&
    parsedQuery.firstWord.length >= 3 &&
    primaryPopulatedCount < 2
  ) {
    const secondaryTerms = parsedQuery.words
      .slice(1)
      .map((w) => w.toLowerCase())
      .filter((w) => w.length >= 2);
    for (const term of secondaryTerms) {
      if (!effectiveRankingTerms.includes(term)) {
        effectiveRankingTerms.push(term);
      }
    }
    const firstWordPhoton = await fetchPhotonDualResults(
      parsedQuery.firstWord,
      signal
    );
    allCandidates.push(...firstWordPhoton.populatedAndTagged);
    photonSucceeded = photonSucceeded || firstWordPhoton.hadNetworkSuccess;
  }

  // 3. If Photon returned no populated place, also query Open-Meteo Geocoding API and add its results
  const hasPhotonPopulatedPlace = allCandidates.some((item) => !item.isLandmark);
  if (!hasPhotonPopulatedPlace) {
    try {
      const openMeteoResults = await geocodeIndianCity(
        parsedQuery.primarySearchText,
        limit,
        signal
      );
      allCandidates.push(
        ...openMeteoResults.filter(
          (item) => !item.countryCode || item.countryCode.toUpperCase() === 'IN'
        )
      );
    } catch (err: unknown) {
      if (isAbortError(err)) {
        throw err;
      }
      const code = err instanceof Error ? err.message : '';
      if (code !== 'CITY_NOT_FOUND' && code !== 'CITY_TOO_SHORT') {
        if (!photonSucceeded && allCandidates.length === 0) {
          throw err;
        }
      }
    }
  }

  const searchTextForScoring =
    !parsedQuery.hasComma &&
    parsedQuery.words.length >= 2 &&
    primaryPopulatedCount < 2 &&
    parsedQuery.firstWord.length >= 3
      ? parsedQuery.firstWord
      : parsedQuery.primarySearchText;

  const merged = mergeAndRankPlaceSuggestions({
    candidates: allCandidates,
    searchText: searchTextForScoring,
    rankingTerms: effectiveRankingTerms,
    maxPopulated: limit,
    maxLandmarks: 2,
  });

  if (suggestionSessionCache.size >= 150) {
    const oldest = suggestionSessionCache.keys().next().value;
    if (oldest !== undefined) suggestionSessionCache.delete(oldest);
  }
  suggestionSessionCache.set(cacheKey, merged);
  return merged;
}

export async function fetchOpenMeteoAirQuality(
  latitude: number,
  longitude: number
): Promise<AirQualityReading> {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${encodeURIComponent(
    latitude
  )}&longitude=${encodeURIComponent(
    longitude
  )}&current=us_aqi,pm2_5,pm10&timezone=auto`;

  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`AQ_HTTP_${response.status}`);
  }

  const data = (await response.json()) as OpenMeteoAirQualityResponse;
  if (data.error || !data.current) {
    throw new Error('AQ_MISSING_DATA');
  }

  const { us_aqi, pm2_5, pm10, time } = data.current;
  if (
    us_aqi === null ||
    us_aqi === undefined ||
    !Number.isFinite(us_aqi)
  ) {
    throw new Error('AQ_MISSING_US_AQI');
  }

  return {
    usAqi: Math.round(us_aqi),
    pm25:
      pm2_5 !== null && pm2_5 !== undefined && Number.isFinite(pm2_5)
        ? Number(pm2_5.toFixed(1))
        : null,
    pm10:
      pm10 !== null && pm10 !== undefined && Number.isFinite(pm10)
        ? Number(pm10.toFixed(1))
        : null,
    source: 'Open-Meteo Air Quality API',
    timestamp: time
      ? new Date(time).toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : new Date().toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
  };
}

export async function reverseGeocodeLabel(
  latitude: number,
  longitude: number,
  accuracyMeters?: number
): Promise<CityLocation> {
  try {
    const photonReverseUrl = `https://photon.komoot.io/reverse?lat=${encodeURIComponent(
      latitude
    )}&lon=${encodeURIComponent(longitude)}`;
    const response = await fetchWithTimeout(photonReverseUrl, 4500);
    if (response.ok) {
      const data = (await response.json()) as PhotonFeatureCollection;
      return parsePhotonReverseLocation(data, latitude, longitude, accuracyMeters);
    }
  } catch {
    // Fall back to exact coordinates below
  }

  return parsePhotonReverseLocation(null, latitude, longitude, accuracyMeters);
}
