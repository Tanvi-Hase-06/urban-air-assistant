import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Compass,
  ExternalLink,
  LocateFixed,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import {
  createDebouncedCallback,
  formatAccuracyReadable,
  formatPlaceDisplay,
  formatSuggestionSubline,
  getAqiCategory,
  isLowLocationAccuracy,
  MIN_SEARCH_QUERY_LENGTH,
  parsePastedCoordinates,
  SEARCH_DEBOUNCE_MS,
  shouldTriggerLocationSearch,
  validateCoordinates,
  type GeolocationPermissionState,
} from '../lib/aqi';
import { POPULAR_INDIAN_CITIES, type LocalizedStrings } from '../lib/i18n';
import { searchIndianPlacesWithFallback } from '../lib/openMeteo';
import type {
  AirQualityReading,
  CityLocation,
  LanguageMode,
} from '../types/airQuality';

interface LocationTelemetryPanelProps {
  t: LocalizedStrings;
  language: LanguageMode;
  location: CityLocation;
  reading: AirQualityReading;
  recentPlaces: CityLocation[];
  isFetchingAir: boolean;
  isGenerating: boolean;
  apiError: string | null;
  manualMode: boolean;
  validationErrors: Record<string, string>;
  isSecureContext: boolean;
  isInIframe: boolean;
  isGeoBlockedInIframe: boolean;
  geoPermissionState: GeolocationPermissionState;
  lastGeoError: { code: number; message: string } | null;
  geoRetryNotice: string | null;
  hasFreshGeoFix: boolean;
  onUseMyLocation: () => void;
  onSelectPlace: (place: CityLocation, saveRecent?: boolean) => void;
  onSelectPopularCity: (cityName: string) => void;
  onApplyCoordinates: (latitude: number, longitude: number) => void;
  onToggleManualMode: (enabled: boolean) => void;
  onApplyManualReading: (
    cityName: string,
    usAqi: number | null,
    pm25: number | null,
    pm10: number | null
  ) => void;
  onRefreshLive: () => void;
  onGetPlan: () => void;
}

export function LocationTelemetryPanel({
  t,
  language,
  location,
  reading,
  recentPlaces,
  isFetchingAir,
  isGenerating,
  apiError,
  manualMode,
  validationErrors,
  isSecureContext,
  isInIframe,
  isGeoBlockedInIframe,
  geoPermissionState,
  lastGeoError,
  geoRetryNotice,
  hasFreshGeoFix,
  onUseMyLocation,
  onSelectPlace,
  onSelectPopularCity,
  onApplyCoordinates,
  onToggleManualMode,
  onApplyManualReading,
  onRefreshLive,
  onGetPlan,
}: LocationTelemetryPanelProps) {
  const [otherWaysOpen, setOtherWaysOpen] = useState(false);

  // Blinkit-style autocomplete combobox state
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CityLocation[]>([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
  const [hasSearchedSuggestions, setHasSearchedSuggestions] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const comboboxContainerRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debouncedSearchRef = useRef<{
    run: (query: string) => void;
    cancel: () => void;
  } | null>(null);

  // Manual fallback & coordinates state
  const [manualCity, setManualCity] = useState(location.cityName);
  const [manualAqiStr, setManualAqiStr] = useState(
    reading.usAqi !== null ? String(reading.usAqi) : ''
  );
  const [manualPm25Str, setManualPm25Str] = useState(
    reading.pm25 !== null ? String(reading.pm25) : ''
  );
  const [manualPm10Str, setManualPm10Str] = useState(
    reading.pm10 !== null ? String(reading.pm10) : ''
  );

  const [showCoordsForm, setShowCoordsForm] = useState(false);
  const [pasteCoordsInput, setPasteCoordsInput] = useState('');
  const [latInput, setLatInput] = useState(
    location.latitude !== undefined ? location.latitude.toFixed(4) : ''
  );
  const [lonInput, setLonInput] = useState(
    location.longitude !== undefined ? location.longitude.toFixed(4) : ''
  );
  const [coordsError, setCoordsError] = useState<string | null>(null);

  // Initialize debounced search runner and clean up pending requests on unmount
  useEffect(() => {
    const debounced = createDebouncedCallback(async (validQuery: string) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsSearchingSuggestions(true);
      setIsDropdownOpen(true);
      try {
        const results = await searchIndianPlacesWithFallback(
          validQuery,
          8,
          controller.signal
        );
        if (controller.signal.aborted) return;
        setSuggestions(results);
        setHasSearchedSuggestions(true);
        setActiveIndex(results.length > 0 ? 0 : -1);
        setIsDropdownOpen(true);
      } catch (err: unknown) {
        if (
          (err instanceof DOMException && err.name === 'AbortError') ||
          (err instanceof Error && err.name === 'AbortError')
        ) {
          return;
        }
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setHasSearchedSuggestions(true);
        setActiveIndex(-1);
        setIsDropdownOpen(true);
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingSuggestions(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    debouncedSearchRef.current = debounced;
    return () => {
      debounced.cancel();
      abortControllerRef.current?.abort();
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        comboboxContainerRef.current &&
        !comboboxContainerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Auto-open "Having trouble? Other ways" if manual fallback mode was triggered externally
  const [lastManualMode, setLastManualMode] = useState(manualMode);
  if (manualMode !== lastManualMode) {
    setLastManualMode(manualMode);
    if (manualMode) {
      setOtherWaysOpen(true);
    }
  }

  // Keep manual fields synced when location changes externally
  const [lastSyncedCity, setLastSyncedCity] = useState(location.cityName);
  if (location.cityName !== lastSyncedCity) {
    setLastSyncedCity(location.cityName);
    setManualCity(location.cityName);
    if (location.latitude !== undefined && location.longitude !== undefined) {
      setLatInput(location.latitude.toFixed(4));
      setLonInput(location.longitude.toFixed(4));
      setPasteCoordsInput('');
    }
  }

  const [lastSyncedAqi, setLastSyncedAqi] = useState<number | null>(reading.usAqi);
  if (reading.usAqi !== lastSyncedAqi) {
    setLastSyncedAqi(reading.usAqi);
    setManualAqiStr(reading.usAqi !== null ? String(reading.usAqi) : '');
    setManualPm25Str(reading.pm25 !== null ? String(reading.pm25) : '');
    setManualPm10Str(reading.pm10 !== null ? String(reading.pm10) : '');
  }

  const category = getAqiCategory(reading.usAqi);
  const categoryLabel =
    language === 'hinglish' ? category.labelHinglish : category.labelEn;
  const categorySummary =
    language === 'hinglish' ? category.summaryHinglish : category.summaryEn;

  const lowAccuracy = Boolean(
    location.isGeolocation && isLowLocationAccuracy(location.accuracyMeters)
  );
  const readableAccuracy = formatAccuracyReadable(location.accuracyMeters);
  const placeHeading = formatPlaceDisplay(location, language);

  const showPermissionSteps =
    geoPermissionState === 'denied' || lastGeoError?.code === 1;

  const currentHref =
    typeof window !== 'undefined' ? window.location.href : '#';

  const handleSearchInputChange = (nextValue: string) => {
    setSearchQuery(nextValue);
    debouncedSearchRef.current?.cancel();
    abortControllerRef.current?.abort();

    const validQuery = shouldTriggerLocationSearch(
      nextValue,
      MIN_SEARCH_QUERY_LENGTH
    );
    if (!validQuery) {
      setIsSearchingSuggestions(false);
      setHasSearchedSuggestions(false);
      setSuggestions([]);
      setIsDropdownOpen(false);
      setActiveIndex(-1);
      return;
    }

    setIsSearchingSuggestions(true);
    setHasSearchedSuggestions(false);
    setIsDropdownOpen(true);
    debouncedSearchRef.current?.run(validQuery);
  };

  const handleClearSearch = () => {
    debouncedSearchRef.current?.cancel();
    abortControllerRef.current?.abort();
    setSearchQuery('');
    setSuggestions([]);
    setIsSearchingSuggestions(false);
    setHasSearchedSuggestions(false);
    setIsDropdownOpen(false);
    setActiveIndex(-1);
  };

  const handlePickSuggestion = (place: CityLocation) => {
    debouncedSearchRef.current?.cancel();
    abortControllerRef.current?.abort();
    setSearchQuery(place.cityName);
    setIsDropdownOpen(false);
    setActiveIndex(-1);
    onSelectPlace(place, true);
  };

  const handleComboboxKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (suggestions.length > 0) {
        e.preventDefault();
        setIsDropdownOpen(true);
        setActiveIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      if (suggestions.length > 0) {
        e.preventDefault();
        setIsDropdownOpen(true);
        setActiveIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
      }
      return;
    }

    if (e.key === 'Enter') {
      if (isDropdownOpen && suggestions.length > 0) {
        e.preventDefault();
        const chosen = suggestions[activeIndex >= 0 ? activeIndex : 0];
        if (chosen) {
          handlePickSuggestion(chosen);
        }
      }
      return;
    }

    if (e.key === 'Escape') {
      if (isDropdownOpen) {
        e.preventDefault();
        setIsDropdownOpen(false);
        setActiveIndex(-1);
      }
    }
  };

  const openOtherWaysCoords = () => {
    setOtherWaysOpen(true);
    setShowCoordsForm(true);
    setCoordsError(null);
  };

  const handlePasteCoordsChange = (value: string) => {
    setPasteCoordsInput(value);
    setCoordsError(null);
    const parsed = parsePastedCoordinates(value, language);
    if (
      parsed.valid &&
      parsed.latitude !== undefined &&
      parsed.longitude !== undefined
    ) {
      setLatInput(String(parsed.latitude));
      setLonInput(String(parsed.longitude));
    }
  };

  const handleCoordsSubmit = (e: FormEvent) => {
    e.preventDefault();
    const result =
      pasteCoordsInput.trim() !== ''
        ? parsePastedCoordinates(pasteCoordsInput, language)
        : validateCoordinates(latInput, lonInput, language);
    if (
      !result.valid ||
      result.latitude === undefined ||
      result.longitude === undefined
    ) {
      setCoordsError(result.error || 'Invalid coordinates.');
      return;
    }
    setCoordsError(null);
    setShowCoordsForm(false);
    setPasteCoordsInput('');
    onApplyCoordinates(result.latitude, result.longitude);
  };

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsedAqi = manualAqiStr.trim() === '' ? null : Number(manualAqiStr);
    const parsedPm25 = manualPm25Str.trim() === '' ? null : Number(manualPm25Str);
    const parsedPm10 = manualPm10Str.trim() === '' ? null : Number(manualPm10Str);
    onApplyManualReading(
      manualCity.trim() || searchQuery.trim() || 'Indian City',
      parsedAqi,
      parsedPm25,
      parsedPm10
    );
  };

  const showEmptyNotice =
    !isSearchingSuggestions && hasSearchedSuggestions && suggestions.length === 0;
  const showListbox =
    isDropdownOpen && (suggestions.length > 0 || showEmptyNotice || isSearchingSuggestions);
  const activeOptionId =
    showListbox && activeIndex >= 0 && suggestions[activeIndex]
      ? `location-suggestion-${activeIndex}`
      : undefined;

  return (
    <section
      id="telemetry"
      aria-labelledby="telemetry-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="telemetry-heading"
          className="font-display text-lg font-semibold text-slate-900"
        >
          {t.locationSectionTitle}
        </h2>
        {location.latitude !== undefined &&
          location.longitude !== undefined &&
          !manualMode && (
            <button
              type="button"
              onClick={onRefreshLive}
              disabled={isFetchingAir}
              className="inline-flex min-h-[36px] items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isFetchingAir ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Refresh</span>
            </button>
          )}
      </div>

      {/* Primary Geolocation Action */}
      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={onUseMyLocation}
          disabled={isFetchingAir}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <LocateFixed className="h-4 w-4 text-teal-300" aria-hidden="true" />
          <span>{t.useMyLocationBtn}</span>
        </button>

        {/* Always-visible Location diagnostics line in small grey text */}
        <p className="font-mono text-[11px] leading-relaxed text-slate-500">
          {t.diagLabel}: {isSecureContext ? t.diagSecureYes : t.diagSecureNo}
          {' · '}
          {t.diagPermissionPrefix}: {geoPermissionState}
          {' · '}
          {t.diagLastErrorPrefix}:{' '}
          {lastGeoError
            ? `code ${lastGeoError.code} (${lastGeoError.message})`
            : t.diagNone}
        </p>
      </div>

      {/* Blinkit-style Accessible Location Combobox Search */}
      <div ref={comboboxContainerRef} className="relative mt-4">
        <label
          htmlFor="location-combobox-input"
          className="mb-1.5 block text-xs font-medium text-slate-700"
        >
          {t.cityInputLabel}
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />
          <input
            id="location-combobox-input"
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showListbox}
            aria-controls={showListbox ? 'location-suggestions-listbox' : undefined}
            aria-activedescendant={activeOptionId}
            autoComplete="off"
            value={searchQuery}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0 || showEmptyNotice) {
                setIsDropdownOpen(true);
              }
            }}
            onKeyDown={handleComboboxKeyDown}
            placeholder={t.cityInputPlaceholder}
            className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white pr-10 pl-10 text-sm text-slate-900 placeholder:text-slate-500 focus:border-teal-700 focus:outline-2 focus:outline-teal-700/20"
          />
          {searchQuery.length > 0 && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-teal-700"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Autocomplete Suggestions Dropdown */}
        {showListbox && (
          <div className="relative z-20">
            <ul
              id="location-suggestions-listbox"
              role="listbox"
              aria-label={t.matchingPlacesLabel}
              className="mt-1.5 max-h-80 overflow-y-auto divide-y divide-slate-200 rounded-lg border border-slate-300 bg-white shadow-md"
            >
              {isSearchingSuggestions && (
                <li
                  role="status"
                  aria-live="polite"
                  className="px-3.5 py-3 text-xs font-medium text-slate-700"
                >
                  {t.searchingPlaces}
                </li>
              )}

              {!isSearchingSuggestions &&
                (() => {
                  const firstLandmarkIdx = suggestions.findIndex(
                    (item) => item.isLandmark || item.placeType === 'Landmark'
                  );
                  return suggestions.map((place, idx) => {
                    const subline = formatSuggestionSubline(place);
                    const isActive = idx === activeIndex;
                    const typeLabel =
                      place.placeType ??
                      (place.isLandmark ? 'Landmark' : 'Town');
                    const isFirstLandmark =
                      firstLandmarkIdx !== -1 && idx === firstLandmarkIdx;

                    return (
                      <Fragment
                        key={`${place.cityName}-${place.latitude}-${place.longitude}-${idx}`}
                      >
                        {isFirstLandmark && (
                          <li
                            role="presentation"
                            className="bg-slate-50 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600"
                          >
                            {t.nearbyLandmarksHeading}
                          </li>
                        )}
                        <li
                          id={`location-suggestion-${idx}`}
                          role="option"
                          aria-selected={isActive}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => handlePickSuggestion(place)}
                          className={`flex min-h-[44px] cursor-pointer items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors ${
                            isActive ? 'bg-teal-50' : 'bg-white hover:bg-slate-50'
                          }`}
                        >
                          <MapPin
                            className={`mt-0.5 h-4 w-4 shrink-0 ${
                              place.isLandmark ? 'text-slate-500' : 'text-teal-700'
                            }`}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-semibold text-slate-900">
                                {place.cityName}
                              </span>
                              <span
                                className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                  place.isLandmark
                                    ? 'border-slate-200 bg-slate-50 text-slate-600'
                                    : 'border-slate-200 bg-slate-100 text-slate-700'
                                }`}
                              >
                                {typeLabel}
                              </span>
                            </span>
                            {subline && (
                              <span className="mt-0.5 block text-xs text-slate-600">
                                {subline}
                              </span>
                            )}
                          </span>
                        </li>
                      </Fragment>
                    );
                  });
                })()}

              {showEmptyNotice && (
                <li className="space-y-1.5 px-3.5 py-3 text-xs text-slate-700">
                  <p className="font-medium text-slate-800">{t.noPlaceFound}</p>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={openOtherWaysCoords}
                    className="font-semibold text-teal-800 underline underline-offset-4 hover:text-teal-950"
                  >
                    {t.enterCoordsBtn}
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}

        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          {t.villageHelpHint}
        </p>
      </div>

      {/* Recent Searched Places (max 3) & Popular Cities Quick Chips */}
      <div className="mt-3.5 space-y-2.5">
        {recentPlaces.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {t.recentPlacesLabel}
            </p>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label={t.recentPlacesLabel}
            >
              {recentPlaces.map((place, idx) => {
                const isSelected =
                  !lowAccuracy &&
                  location.cityName.toLowerCase() === place.cityName.toLowerCase() &&
                  location.latitude !== undefined &&
                  place.latitude !== undefined &&
                  Math.abs(location.latitude - place.latitude) < 0.02;
                return (
                  <button
                    key={`recent-${place.cityName}-${place.latitude}-${idx}`}
                    type="button"
                    disabled={isFetchingAir}
                    onClick={() => {
                      setSearchQuery(place.cityName);
                      setIsDropdownOpen(false);
                      onSelectPlace(place, true);
                    }}
                    className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                      isSelected
                        ? 'border-teal-700 bg-teal-50 text-teal-950'
                        : 'border-slate-300 bg-slate-50 text-slate-800 hover:border-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <MapPin className="h-3 w-3 text-teal-700" aria-hidden="true" />
                    <span>{place.cityName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {t.popularCitiesLabel}
          </p>
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label={t.popularCitiesLabel}
          >
            {POPULAR_INDIAN_CITIES.map((city) => {
              const isSelected =
                !lowAccuracy &&
                location.cityName.toLowerCase() === city.toLowerCase();
              return (
                <button
                  key={city}
                  type="button"
                  disabled={isFetchingAir}
                  onClick={() => {
                    setSearchQuery(city);
                    setIsDropdownOpen(false);
                    onSelectPopularCity(city);
                  }}
                  className={`min-h-[36px] rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                    isSelected
                      ? 'border-teal-700 bg-teal-50 text-teal-950'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {city}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* HTTPS Required Warning */}
      {!isSecureContext && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
            aria-hidden="true"
          />
          <p className="leading-relaxed">{t.insecureContextWarning}</p>
        </div>
      )}

      {/* Iframe Blocked Notice with Open in New Tab Link */}
      {isGeoBlockedInIframe && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
            aria-hidden="true"
          />
          <div className="space-y-1.5">
            <p className="font-semibold">{t.iframeBlockedTitle}</p>
            <p className="leading-relaxed">{t.iframeBlockedBody}</p>
            <a
              href={currentHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-teal-900 underline underline-offset-4 hover:text-teal-950"
            >
              <span>{t.openInNewTabBtn}</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      )}

      {/* Code 3 Low-Accuracy Retry Notice */}
      {geoRetryNotice && (
        <div
          role="status"
          aria-live="polite"
          className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-700"
        >
          {geoRetryNotice}
        </div>
      )}

      {/* Loading banner */}
      {isFetchingAir && (
        <div
          role="status"
          aria-live="polite"
          className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs font-medium text-slate-700"
        >
          {t.fetchingTelemetry}
        </div>
      )}

      {/* Friendly API / Geolocation Error Banner */}
      {apiError && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
            aria-hidden="true"
          />
          <div className="space-y-1.5">
            <p className="leading-relaxed">{apiError}</p>
            {apiError === t.cityNotFoundError && (
              <button
                type="button"
                onClick={openOtherWaysCoords}
                className="font-semibold text-teal-900 underline underline-offset-4 hover:text-teal-950"
              >
                {t.enterCoordsBtn}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Chrome on Android + In-app Browser Steps when Permission is Denied */}
      {showPermissionSteps && (
        <div
          role="region"
          aria-label={t.chromeAndroidTitle}
          className="mt-3 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-800"
        >
          <p className="font-semibold text-slate-900">{t.chromeAndroidTitle}</p>
          <p className="leading-relaxed">{t.chromeAndroidSteps}</p>
          <p className="leading-relaxed text-slate-700">{t.inAppBrowserWarning}</p>
          {isInIframe && !isGeoBlockedInIframe && (
            <a
              href={currentHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 pt-1 font-semibold text-teal-800 underline underline-offset-4 hover:text-teal-950"
            >
              <span>{t.openInNewTabBtn}</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      )}

      {/* Low Accuracy Warning (> 5 km) */}
      {lowAccuracy && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
            aria-hidden="true"
          />
          <p className="font-medium leading-relaxed">
            {t.lowAccuracyWarning(readableAccuracy ?? '5+ km')}
          </p>
        </div>
      )}

      {/* Telemetry Readout Strip */}
      <div className="mt-5 border-t border-slate-200 pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              {placeHeading}
            </h3>
            {location.latitude !== undefined &&
              location.longitude !== undefined && (
                <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-500">
                  {t.coordinatesLabel}: {location.latitude.toFixed(4)}°N,{' '}
                  {location.longitude.toFixed(4)}°E
                  {readableAccuracy && (
                    <>
                      {' · '}
                      {t.accuracyLabel}: ±{readableAccuracy}
                    </>
                  )}
                </p>
              )}
          </div>

          <div
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${category.bgClass} ${category.borderClass} ${category.textClass}`}
          >
            <span aria-hidden="true">{category.glyph}</span>
            <span>{categoryLabel}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 border-y border-slate-200 py-4">
          <div>
            <p className="text-xs font-medium text-slate-500">US AQI</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900 sm:text-3xl">
              {reading.usAqi !== null ? reading.usAqi : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">PM2.5</p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900 sm:text-2xl">
              {reading.pm25 !== null ? reading.pm25 : '—'}
              <span className="ml-1 text-xs font-normal text-slate-500">
                µg/m³
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">PM10</p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900 sm:text-2xl">
              {reading.pm10 !== null ? reading.pm10 : '—'}
              <span className="ml-1 text-xs font-normal text-slate-500">
                µg/m³
              </span>
            </p>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-600">
          {categorySummary}
        </p>

        {/* Unboxed metadata line */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span>
            {t.sourceLabel}: {reading.source}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            {t.updatedLabel}: {reading.timestamp}
          </span>
        </div>

        {(location.isGeolocation ||
          reading.source === 'Open-Meteo Air Quality API') && (
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            {t.gridEstimateNote}
          </p>
        )}

        {/* Direct "Get my plan" button after successful geolocation position */}
        {hasFreshGeoFix && reading.usAqi !== null && (
          <button
            type="button"
            onClick={onGetPlan}
            disabled={isGenerating}
            className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>{isGenerating ? t.generatingBtn : t.getMyPlanBtn}</span>
          </button>
        )}

        {(validationErrors.cityName ||
          validationErrors.usAqi ||
          validationErrors.pm25 ||
          validationErrors.pm10) && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900"
          >
            {validationErrors.cityName ||
              validationErrors.usAqi ||
              validationErrors.pm25 ||
              validationErrors.pm10}
          </div>
        )}
      </div>

      {/* Collapsed Section: "Having trouble? Other ways" (Lat/Lon & Manual AQI only) */}
      <div className="mt-5 border-t border-slate-200 pt-4">
        <button
          type="button"
          aria-expanded={otherWaysOpen}
          aria-controls="other-ways-panel"
          onClick={() => setOtherWaysOpen((prev) => !prev)}
          className="flex min-h-[40px] w-full items-center justify-between text-left text-xs font-semibold text-slate-700 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <span>{t.otherWaysTitle}</span>
          {otherWaysOpen ? (
            <ChevronUp className="h-4 w-4 text-slate-500" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
          )}
        </button>

        {otherWaysOpen && (
          <div id="other-ways-panel" className="mt-4 space-y-5">
            {/* Action buttons for Lat/Lon & Manual AQI */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCoordsForm((prev) => !prev);
                  setCoordsError(null);
                }}
                disabled={isFetchingAir}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                  showCoordsForm
                    ? 'border-teal-700 bg-teal-50 text-teal-900'
                    : 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100'
                }`}
              >
                <Compass className="h-4 w-4 text-teal-700" aria-hidden="true" />
                <span>{showCoordsForm ? t.hideCoordsBtn : t.enterCoordsBtn}</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleManualMode(!manualMode)}
                className="inline-flex min-h-[36px] items-center gap-1.5 text-xs font-medium text-teal-800 hover:text-teal-950 hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{manualMode ? t.retryLiveBtn : t.switchToManualBtn}</span>
              </button>
            </div>

            {/* Manual Latitude & Longitude Entry */}
            {showCoordsForm && (
              <form
                onSubmit={handleCoordsSubmit}
                className="space-y-3 border-t border-slate-200 pt-4"
              >
                <div>
                  <label
                    htmlFor="paste-coords-input"
                    className="block text-xs font-semibold text-slate-800"
                  >
                    {t.pasteCoordsLabel}
                  </label>
                  <input
                    id="paste-coords-input"
                    type="text"
                    value={pasteCoordsInput}
                    onChange={(e) => handlePasteCoordsChange(e.target.value)}
                    placeholder={t.pasteCoordsPlaceholder}
                    className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-2 focus:outline-teal-700/20"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="manual-lat-input"
                      className="block text-xs font-medium text-slate-700"
                    >
                      {t.latitudeLabel}
                    </label>
                    <input
                      id="manual-lat-input"
                      type="text"
                      inputMode="decimal"
                      value={latInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        const maybePair = parsePastedCoordinates(val, language);
                        if (
                          val.includes(',') &&
                          maybePair.valid &&
                          maybePair.latitude !== undefined &&
                          maybePair.longitude !== undefined
                        ) {
                          setPasteCoordsInput(val);
                          setLatInput(String(maybePair.latitude));
                          setLonInput(String(maybePair.longitude));
                        } else {
                          setPasteCoordsInput('');
                          setLatInput(val);
                        }
                        setCoordsError(null);
                      }}
                      placeholder="e.g. 19.55"
                      className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-teal-700 focus:outline-2 focus:outline-teal-700/20"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="manual-lon-input"
                      className="block text-xs font-medium text-slate-700"
                    >
                      {t.longitudeLabel}
                    </label>
                    <input
                      id="manual-lon-input"
                      type="text"
                      inputMode="decimal"
                      value={lonInput}
                      onChange={(e) => {
                        setPasteCoordsInput('');
                        setLonInput(e.target.value);
                        setCoordsError(null);
                      }}
                      placeholder="e.g. 74.10"
                      className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-teal-700 focus:outline-2 focus:outline-teal-700/20"
                    />
                  </div>
                </div>

                {coordsError && (
                  <p role="alert" className="text-xs text-red-700">
                    {coordsError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isFetchingAir}
                  className="min-h-[44px] w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  {t.applyCoordsBtn}
                </button>
              </form>
            )}

            {/* Manual AQI Fallback Form */}
            {manualMode && (
              <form
                onSubmit={handleManualSubmit}
                className="space-y-3 border-t border-slate-200 pt-4"
              >
                <p className="text-xs font-semibold text-slate-800">
                  {t.manualFallbackPrompt}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="manual-city"
                      className="block text-xs font-medium text-slate-700"
                    >
                      {t.cityInputLabel}
                    </label>
                    <input
                      id="manual-city"
                      type="text"
                      value={manualCity}
                      onChange={(e) => setManualCity(e.target.value)}
                      className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-2 focus:outline-teal-700/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="manual-aqi"
                      className="block text-xs font-medium text-slate-700"
                    >
                      {t.manualAqiLabel}
                    </label>
                    <input
                      id="manual-aqi"
                      type="number"
                      min={0}
                      max={1000}
                      step={1}
                      value={manualAqiStr}
                      onChange={(e) => setManualAqiStr(e.target.value)}
                      placeholder="e.g. 285"
                      className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-teal-700 focus:outline-2 focus:outline-teal-700/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="manual-pm25"
                      className="block text-xs font-medium text-slate-700"
                    >
                      {t.manualPm25Label}
                    </label>
                    <input
                      id="manual-pm25"
                      type="number"
                      min={0}
                      max={2500}
                      step="0.1"
                      value={manualPm25Str}
                      onChange={(e) => setManualPm25Str(e.target.value)}
                      placeholder="e.g. 165"
                      className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-teal-700 focus:outline-2 focus:outline-teal-700/20"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="manual-pm10"
                      className="block text-xs font-medium text-slate-700"
                    >
                      {t.manualPm10Label}
                    </label>
                    <input
                      id="manual-pm10"
                      type="number"
                      min={0}
                      max={4000}
                      step="0.1"
                      value={manualPm10Str}
                      onChange={(e) => setManualPm10Str(e.target.value)}
                      placeholder="e.g. 240"
                      className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-teal-700 focus:outline-2 focus:outline-teal-700/20"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="min-h-[44px] w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  {t.applyManualBtn}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
