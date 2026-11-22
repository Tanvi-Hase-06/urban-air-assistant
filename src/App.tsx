import { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, FlaskConical, Languages } from 'lucide-react';
import { AdvisoryReport, type PlanSnapshot } from './components/AdvisoryReport';
import { LocationTelemetryPanel } from './components/LocationTelemetryPanel';
import { ProfileForm } from './components/ProfileForm';
import { TopBar } from './components/TopBar';
import {
  buildAdviceCacheKey,
  formatTodayReadableDate,
  getRiskCategoryFromAqi,
  getTodayLocalDateISO,
  mapGeolocationError,
  validateAirQualityInputs,
  type GeolocationPermissionState,
} from './lib/aqi';
import { STRINGS } from './lib/i18n';
import {
  fetchOpenMeteoAirQuality,
  geocodeIndianCity,
  reverseGeocodeLabel,
  searchIndianPlacesWithFallback,
} from './lib/openMeteo';
import type {
  AdviceRequestPayload,
  AirQualityReading,
  CityLocation,
  FamilyProfile,
  GeminiAdviceResponse,
  LanguageMode,
} from './types/airQuality';

interface CachedAdviceEntry {
  advice: GeminiAdviceResponse;
  snapshot: PlanSnapshot;
  generatedAt: string;
}

const DEFAULT_LOCATION: CityLocation = {
  cityName: 'New Delhi',
  admin1: 'Delhi',
  countryCode: 'IN',
  latitude: 28.6139,
  longitude: 77.209,
};

const DEFAULT_PROFILE: FamilyProfile = {
  household: ['children'],
  userType: 'parent',
  commuteType: 'metro_public_transit',
  hasMask: true,
  hasPurifier: false,
};

const RECENT_PLACES_STORAGE_KEY = 'uqa_recent_places_v1';
const MAX_RECENT_PLACES = 3;

function readRecentPlaces(): CityLocation[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(RECENT_PLACES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is CityLocation =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as CityLocation).cityName === 'string' &&
          Number.isFinite((item as CityLocation).latitude) &&
          Number.isFinite((item as CityLocation).longitude)
      )
      .slice(0, MAX_RECENT_PLACES);
  } catch {
    return [];
  }
}

function writeRecentPlaces(places: CityLocation[]): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      RECENT_PLACES_STORAGE_KEY,
      JSON.stringify(places.slice(0, MAX_RECENT_PLACES))
    );
  } catch {
    // Ignore storage quota or private-mode errors cleanly
  }
}

function readAdviceCache(key: string): CachedAdviceEntry | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedAdviceEntry;
    if (!parsed || !parsed.advice || !parsed.advice.riskLevel) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeAdviceCache(key: string, entry: CachedAdviceEntry): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export default function App() {
  const [language, setLanguage] = useState<LanguageMode>('en');
  const [location, setLocation] = useState<CityLocation>(DEFAULT_LOCATION);
  const [reading, setReading] = useState<AirQualityReading>({
    usAqi: null,
    pm25: null,
    pm10: null,
    source: 'Open-Meteo Air Quality API',
    timestamp: 'Pending',
  });
  const [profile, setProfile] = useState<FamilyProfile>(DEFAULT_PROFILE);

  const [isFetchingAir, setIsFetchingAir] = useState(false);
  const [airApiError, setAirApiError] = useState<string | null>(null);
  const [recentPlaces, setRecentPlaces] = useState<CityLocation[]>(() =>
    readRecentPlaces()
  );
  const [manualMode, setManualMode] = useState(false);
  const [sampleModeActive, setSampleModeActive] = useState(false);

  const [geoPermissionState, setGeoPermissionState] =
    useState<GeolocationPermissionState>('checking');
  const [lastGeoError, setLastGeoError] = useState<{
    code: number;
    message: string;
  } | null>(null);
  const [geoRetryNotice, setGeoRetryNotice] = useState<string | null>(null);
  const [isGeoBlockedInIframe, setIsGeoBlockedInIframe] = useState(false);
  const [hasFreshGeoFix, setHasFreshGeoFix] = useState(false);

  const isSecureContext =
    typeof window !== 'undefined' ? window.isSecureContext : true;
  const isInIframe =
    typeof window !== 'undefined' ? window.self !== window.top : false;

  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  const [advice, setAdvice] = useState<GeminiAdviceResponse | null>(null);
  const [adviceSnapshot, setAdviceSnapshot] = useState<PlanSnapshot | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [wasCached, setWasCached] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const memoryCacheRef = useRef<Map<string, CachedAdviceEntry>>(new Map());
  const telemetryCacheRef = useRef<
    Map<string, { reading: AirQualityReading; fetchedAt: number }>
  >(new Map());

  const t = STRINGS[language];
  const todayIso = getTodayLocalDateISO();
  const todayReadable = formatTodayReadableDate(language);

  const refreshPermissionState = useCallback(() => {
    if (
      typeof navigator !== 'undefined' &&
      'permissions' in navigator &&
      typeof navigator.permissions.query === 'function'
    ) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          setGeoPermissionState(status.state);
        })
        .catch(() => {
          setGeoPermissionState('unsupported');
        });
    }
  }, []);

  const fetchAirForCoords = useCallback(
    async (loc: CityLocation, force = false) => {
      if (loc.latitude === undefined || loc.longitude === undefined) return;
      const coordKey = `${loc.latitude.toFixed(2)},${loc.longitude.toFixed(2)}`;
      const cached = telemetryCacheRef.current.get(coordKey);
      const fiveMinutesMs = 5 * 60 * 1000;

      if (!force && cached && Date.now() - cached.fetchedAt < fiveMinutesMs) {
        setReading(cached.reading);
        setAirApiError(null);
        setManualMode(false);
        return;
      }

      setIsFetchingAir(true);
      setAirApiError(null);
      try {
        const nextReading = await fetchOpenMeteoAirQuality(
          loc.latitude,
          loc.longitude
        );
        telemetryCacheRef.current.set(coordKey, {
          reading: nextReading,
          fetchedAt: Date.now(),
        });
        setReading(nextReading);
        setManualMode(false);
        setSampleModeActive(false);
        setValidationErrors({});
      } catch {
        setAirApiError(STRINGS[language].apiFailedError);
        setManualMode(true);
      } finally {
        setIsFetchingAir(false);
      }
    },
    [language]
  );

  // Initial live fetch for New Delhi + Geolocation permissions & iframe policy check
  useEffect(() => {
    void fetchAirForCoords(DEFAULT_LOCATION);

    let cancelled = false;
    const docWithPolicy = document as Document & {
      featurePolicy?: { allowsFeature?: (name: string) => boolean };
      permissionsPolicy?: { allowsFeature?: (name: string) => boolean };
    };
    const policyAllows =
      docWithPolicy.permissionsPolicy?.allowsFeature?.('geolocation') ??
      docWithPolicy.featurePolicy?.allowsFeature?.('geolocation');

    if (isInIframe && policyAllows === false) {
      setIsGeoBlockedInIframe(true);
    }

    if (
      typeof navigator !== 'undefined' &&
      'permissions' in navigator &&
      typeof navigator.permissions.query === 'function'
    ) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          if (cancelled) return;
          setGeoPermissionState(status.state);
          status.onchange = () => {
            if (!cancelled) {
              setGeoPermissionState(status.state);
            }
          };
        })
        .catch(() => {
          if (!cancelled) setGeoPermissionState('unsupported');
        });
    } else {
      setGeoPermissionState('unsupported');
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rememberRecentPlace = useCallback((place: CityLocation) => {
    if (place.latitude === undefined || place.longitude === undefined) return;
    const cleanPlace: CityLocation = {
      cityName: place.cityName,
      area: place.area,
      district: place.district,
      admin1: place.admin1,
      countryCode: place.countryCode,
      latitude: place.latitude,
      longitude: place.longitude,
    };
    const key = `${cleanPlace.cityName.trim().toLowerCase()}|${cleanPlace.latitude!.toFixed(
      2
    )},${cleanPlace.longitude!.toFixed(2)}`;

    setRecentPlaces((prev) => {
      const deduped = prev.filter((item) => {
        const itemKey = `${item.cityName.trim().toLowerCase()}|${(
          item.latitude ?? 0
        ).toFixed(2)},${(item.longitude ?? 0).toFixed(2)}`;
        return itemKey !== key;
      });
      const next = [cleanPlace, ...deduped].slice(0, MAX_RECENT_PLACES);
      writeRecentPlaces(next);
      return next;
    });
  }, []);

  const handleUseMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setLastGeoError({ code: 0, message: 'Geolocation API not supported' });
      setAirApiError(t.geoUnsupportedError);
      return;
    }

    setIsFetchingAir(true);
    setAirApiError(null);
    setGeoRetryNotice(null);
    setLastGeoError(null);
    setSampleModeActive(false);
    setValidationErrors({});
    setHasFreshGeoFix(false);

    const handleGeoSuccess = async (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const roundedAcc = Number.isFinite(accuracy)
        ? Math.round(accuracy)
        : undefined;

      setLastGeoError(null);
      setGeoRetryNotice(null);
      setIsGeoBlockedInIframe(false);
      setGeoPermissionState('granted');
      refreshPermissionState();

      try {
        const [nextReading, resolvedLoc] = await Promise.all([
          fetchOpenMeteoAirQuality(latitude, longitude),
          reverseGeocodeLabel(latitude, longitude, roundedAcc),
        ]);
        setLocation(resolvedLoc);
        setReading(nextReading);
        setManualMode(false);
        setHasFreshGeoFix(true);
      } catch {
        setLocation({
          cityName: `${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E`,
          latitude,
          longitude,
          accuracyMeters: roundedAcc,
          isGeolocation: true,
        });
        setAirApiError(t.apiFailedError);
        setManualMode(true);
      } finally {
        setIsFetchingAir(false);
      }
    };

    const handleGeoError = (
      err: GeolocationPositionError,
      isRetryAttempt: boolean
    ) => {
      const errMsg = err.message || `Error code ${err.code}`;
      setLastGeoError({ code: err.code, message: errMsg });
      refreshPermissionState();

      const mapped = mapGeolocationError(err.code, errMsg, language);

      if (mapped.shouldRetryLowAccuracy && !isRetryAttempt) {
        setGeoRetryNotice(STRINGS[language].retryingLowAccuracyNotice);
        navigator.geolocation.getCurrentPosition(
          handleGeoSuccess,
          (retryErr) => handleGeoError(retryErr, true),
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }
        );
        return;
      }

      setGeoRetryNotice(null);
      if (err.code === 1) {
        if (mapped.isBlockedByPolicy || isInIframe) {
          setIsGeoBlockedInIframe(true);
        }
        setGeoPermissionState('denied');
      }
      setAirApiError(mapped.userMessage);
      setIsFetchingAir(false);
    };

    // Call getCurrentPosition directly inside click handler (no await / no timer)
    navigator.geolocation.getCurrentPosition(
      handleGeoSuccess,
      (err) => handleGeoError(err, false),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleSelectPlace = async (
    place: CityLocation,
    options: { saveRecent?: boolean } = {}
  ) => {
    setIsFetchingAir(true);
    setAirApiError(null);
    setGeoRetryNotice(null);
    setHasFreshGeoFix(false);
    setSampleModeActive(false);
    setValidationErrors({});

    const nextLoc: CityLocation = {
      ...place,
      accuracyMeters: undefined,
      isGeolocation: false,
    };
    setLocation(nextLoc);
    if (options.saveRecent) {
      rememberRecentPlace(nextLoc);
    }

    if (nextLoc.latitude === undefined || nextLoc.longitude === undefined) {
      setIsFetchingAir(false);
      setManualMode(true);
      return;
    }

    try {
      const nextReading = await fetchOpenMeteoAirQuality(
        nextLoc.latitude,
        nextLoc.longitude
      );
      setReading(nextReading);
      setManualMode(false);
    } catch {
      setAirApiError(t.apiFailedError);
      setManualMode(true);
    } finally {
      setIsFetchingAir(false);
    }
  };

  const handleSelectPopularCity = async (cityName: string) => {
    setIsFetchingAir(true);
    setAirApiError(null);
    setGeoRetryNotice(null);
    setHasFreshGeoFix(false);
    setSampleModeActive(false);
    setValidationErrors({});

    try {
      let matches = await searchIndianPlacesWithFallback(cityName, 5);
      if (matches.length === 0) {
        matches = await geocodeIndianCity(cityName, 5);
      }
      const topMatch = matches[0];
      if (
        !topMatch ||
        topMatch.latitude === undefined ||
        topMatch.longitude === undefined
      ) {
        throw new Error('CITY_NOT_FOUND');
      }

      const nextLoc: CityLocation = {
        ...topMatch,
        accuracyMeters: undefined,
        isGeolocation: false,
      };
      setLocation(nextLoc);
      const nextReading = await fetchOpenMeteoAirQuality(
        nextLoc.latitude!,
        nextLoc.longitude!
      );
      setReading(nextReading);
      setManualMode(false);
    } catch {
      setAirApiError(t.apiFailedError);
      setLocation({ cityName });
      setManualMode(true);
    } finally {
      setIsFetchingAir(false);
    }
  };

  const handleApplyCoordinates = async (latitude: number, longitude: number) => {
    setIsFetchingAir(true);
    setAirApiError(null);
    setGeoRetryNotice(null);
    setHasFreshGeoFix(false);
    setSampleModeActive(false);
    setValidationErrors({});

    try {
      const [resolvedLoc, nextReading] = await Promise.all([
        reverseGeocodeLabel(latitude, longitude),
        fetchOpenMeteoAirQuality(latitude, longitude),
      ]);
      setLocation({
        ...resolvedLoc,
        accuracyMeters: undefined,
        isGeolocation: false,
      });
      setReading(nextReading);
      setManualMode(false);
    } catch {
      setLocation({
        cityName: `${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E`,
        latitude,
        longitude,
        isGeolocation: false,
      });
      setAirApiError(t.apiFailedError);
      setManualMode(true);
    } finally {
      setIsFetchingAir(false);
    }
  };

  const handleApplyManualReading = (
    cityName: string,
    usAqi: number | null,
    pm25: number | null,
    pm10: number | null
  ) => {
    const validation = validateAirQualityInputs(
      {
        cityName,
        usAqi,
        pm25,
        pm10,
        userType: profile.userType,
        commuteType: profile.commuteType,
        household: profile.household,
      },
      language
    );

    const manualErrors: Record<string, string> = {};
    if (validation.errors.cityName) manualErrors.cityName = validation.errors.cityName;
    if (validation.errors.usAqi) manualErrors.usAqi = validation.errors.usAqi;
    if (validation.errors.pm25) manualErrors.pm25 = validation.errors.pm25;
    if (validation.errors.pm10) manualErrors.pm10 = validation.errors.pm10;

    if (Object.keys(manualErrors).length > 0) {
      setValidationErrors(manualErrors);
      return;
    }

    setValidationErrors({});
    setAirApiError(null);
    setSampleModeActive(false);
    setLocation({ cityName });
    setReading({
      usAqi,
      pm25,
      pm10,
      source: 'Manual Entry',
      timestamp: new Date().toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    });
  };

  const handleLoadSample = () => {
    setValidationErrors({});
    setAirApiError(null);
    setGeoRetryNotice(null);
    setHasFreshGeoFix(false);
    setManualMode(false);
    setSampleModeActive(true);
    setLocation({
      cityName: 'New Delhi',
      admin1: 'Delhi NCR',
      countryCode: 'IN',
      latitude: 28.6139,
      longitude: 77.209,
    });
    setReading({
      usAqi: 342,
      pm25: 218.5,
      pm10: 315.0,
      source: 'Sample Data (Demo)',
      timestamp: new Date().toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    });
    setProfile({
      household: ['children', 'seniors', 'breathing_issues'],
      userType: 'parent',
      commuteType: 'metro_public_transit',
      hasMask: true,
      hasPurifier: false,
    });
    setAdvice(null);
    setAdviceSnapshot(null);
    setGeminiError(null);
  };

  const buildCurrentPayload = (
    targetLang: LanguageMode
  ): AdviceRequestPayload | null => {
    if (reading.usAqi === null) return null;
    const { level: categoryLabel } = getRiskCategoryFromAqi(reading.usAqi);
    return {
      todayDate: getTodayLocalDateISO(),
      todayReadable: formatTodayReadableDate(targetLang),
      language: targetLang,
      location,
      airQuality: {
        usAqi: reading.usAqi,
        pm25: reading.pm25,
        pm10: reading.pm10,
        categoryLabel,
        source: reading.source,
        timestamp: reading.timestamp,
      },
      profile,
    };
  };

  const handleLanguageChange = (nextLang: LanguageMode) => {
    if (nextLang === language) return;
    setLanguage(nextLang);
    setValidationErrors({});
    setGeminiError(null);

    const payload = buildCurrentPayload(nextLang);
    if (payload) {
      const cacheKey = buildAdviceCacheKey(payload);
      const cached =
        memoryCacheRef.current.get(cacheKey) || readAdviceCache(cacheKey);
      if (cached && cached.snapshot) {
        setAdvice(cached.advice);
        setAdviceSnapshot(cached.snapshot);
        setWasCached(true);
        setGeneratedAt(cached.generatedAt);
        return;
      }
    }
    // Clear previous language advisory so the user can generate in the selected language with one click
    setAdvice(null);
    setAdviceSnapshot(null);
    setGeneratedAt(null);
    setWasCached(false);
  };

  const handleGeneratePlan = async (forceRefresh = false) => {
    const validation = validateAirQualityInputs(
      {
        cityName: location.cityName,
        usAqi: reading.usAqi,
        pm25: reading.pm25,
        pm10: reading.pm10,
        userType: profile.userType,
        commuteType: profile.commuteType,
        household: profile.household,
      },
      language
    );

    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    setValidationErrors({});
    setGeminiError(null);

    const payload = buildCurrentPayload(language);
    if (!payload) return;

    const currentSnapshot: PlanSnapshot = {
      location,
      reading,
      hasChildren: profile.household.includes('children'),
    };

    const cacheKey = buildAdviceCacheKey(payload);
    if (!forceRefresh) {
      const cached =
        memoryCacheRef.current.get(cacheKey) || readAdviceCache(cacheKey);
      if (cached && cached.snapshot) {
        setAdvice(cached.advice);
        setAdviceSnapshot(cached.snapshot);
        setWasCached(true);
        setGeneratedAt(cached.generatedAt);
        return;
      }
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/advice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(
          forceRefresh ? { ...payload, forceRefresh: true } : payload
        ),
      });

      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.toLowerCase().includes('application/json')) {
        await res.text().catch(() => '');
        throw new Error(
          language === 'hinglish'
            ? 'Plan service se sahi JSON jawab nahi mila (unexpected HTML/text response). Kripya page refresh karke dobara try karein.'
            : 'The plan service returned an unexpected non-JSON response. Please refresh the page and try again.'
        );
      }

      let data: {
        advice?: GeminiAdviceResponse;
        error?: string;
      };
      try {
        data = (await res.json()) as {
          advice?: GeminiAdviceResponse;
          error?: string;
        };
      } catch {
        throw new Error(
          language === 'hinglish'
            ? 'Plan data padhne mein dikkat aayi. Kripya dobara try karein.'
            : 'Could not read the response from the plan service. Please try again.'
        );
      }

      if (!res.ok || !data.advice) {
        throw new Error(
          data.error ||
            (language === 'hinglish'
              ? 'Plan load nahi ho paaya. Kripya dobara try karein.'
              : 'Could not generate your plan right now. Please try again.')
        );
      }

      const timeLabel = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const entry: CachedAdviceEntry = {
        advice: data.advice,
        snapshot: currentSnapshot,
        generatedAt: timeLabel,
      };
      memoryCacheRef.current.set(cacheKey, entry);
      writeAdviceCache(cacheKey, entry);

      setAdvice(data.advice);
      setAdviceSnapshot(currentSnapshot);
      setWasCached(false);
      setGeneratedAt(timeLabel);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unexpected error while fetching your plan.';
      setGeminiError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div id="top" className="min-h-screen bg-slate-50 text-slate-900">
      <TopBar t={t} onLoadSample={handleLoadSample} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Hero & Workspace Controls */}
        <section aria-labelledby="hero-heading" className="border-b border-slate-200 pb-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-500">
                <Calendar className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                <span className="font-mono tabular-nums text-slate-700">
                  {todayReadable}
                </span>
                <span aria-hidden="true">·</span>
                <span>{t.todayPrefix}</span>
              </div>

              <h1
                id="hero-heading"
                className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl [text-wrap:balance]"
              >
                {t.heroTitle}
              </h1>
              <p className="mt-2 text-base leading-relaxed text-slate-600">
                {t.heroSubtitle}
              </p>
            </div>

            {/* Workspace Toolbar: Language Toggle & Sample Data */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div
                role="group"
                aria-label={t.languageLabel}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-200/75 p-1"
              >
                <span className="sr-only">{t.languageLabel}</span>
                <Languages
                  className="ml-2 mr-1 h-4 w-4 text-slate-600"
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => handleLanguageChange('en')}
                  aria-pressed={language === 'en'}
                  className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                    language === 'en'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange('hinglish')}
                  aria-pressed={language === 'hinglish'}
                  className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                    language === 'hinglish'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Hinglish
                </button>
              </div>

              <button
                type="button"
                onClick={handleLoadSample}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                  sampleModeActive
                    ? 'border-teal-700 bg-teal-50 text-teal-900'
                    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                }`}
              >
                <FlaskConical className="h-4 w-4 text-teal-700" aria-hidden="true" />
                <span>{t.sampleDataBtn}</span>
              </button>
            </div>
          </div>

          {sampleModeActive && (
            <p
              role="status"
              className="mt-4 rounded-lg border border-teal-200 bg-teal-50/70 px-4 py-2.5 text-xs font-medium text-teal-950"
            >
              {t.sampleActiveNotice}
            </p>
          )}
        </section>

        {/* Main Asymmetric 2-Column Workspace */}
        <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-5">
            <LocationTelemetryPanel
              t={t}
              language={language}
              location={location}
              reading={reading}
              recentPlaces={recentPlaces}
              isFetchingAir={isFetchingAir}
              isGenerating={isGenerating}
              apiError={airApiError}
              manualMode={manualMode}
              validationErrors={validationErrors}
              isSecureContext={isSecureContext}
              isInIframe={isInIframe}
              isGeoBlockedInIframe={isGeoBlockedInIframe}
              geoPermissionState={geoPermissionState}
              lastGeoError={lastGeoError}
              geoRetryNotice={geoRetryNotice}
              hasFreshGeoFix={hasFreshGeoFix}
              onUseMyLocation={handleUseMyLocation}
              onSelectPlace={(place, saveRecent) =>
                void handleSelectPlace(place, { saveRecent })
              }
              onSelectPopularCity={(city) => void handleSelectPopularCity(city)}
              onApplyCoordinates={(lat, lon) => void handleApplyCoordinates(lat, lon)}
              onToggleManualMode={(enabled) => {
                setManualMode(enabled);
                setAirApiError(null);
              }}
              onApplyManualReading={(c, a, p25, p10) => {
                setHasFreshGeoFix(false);
                handleApplyManualReading(c, a, p25, p10);
              }}
              onRefreshLive={() => void fetchAirForCoords(location, true)}
              onGetPlan={() => void handleGeneratePlan(false)}
            />

            <ProfileForm
              t={t}
              profile={profile}
              validationErrors={validationErrors}
              isGenerating={isGenerating}
              onChangeProfile={(next) => {
                setProfile(next);
                setValidationErrors({});
              }}
              onSubmitPlan={() => void handleGeneratePlan(false)}
            />
          </div>

          <div className="lg:col-span-7">
            <AdvisoryReport
              t={t}
              language={language}
              advice={advice}
              snapshot={adviceSnapshot}
              isGenerating={isGenerating}
              error={geminiError}
              wasCached={wasCached}
              generatedAt={generatedAt}
              todayReadable={todayReadable}
              onRetry={() => void handleGeneratePlan(true)}
              onForceRefresh={() => void handleGeneratePlan(true)}
            />
          </div>
        </div>
      </main>

      <footer className="mt-12 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>{t.brandTitle} · {todayIso}</p>
          <p>{t.doctorDisclaimerBody}</p>
        </div>
      </footer>
    </div>
  );
}
