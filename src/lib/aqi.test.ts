import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAdviceCacheKey,
  classifyPhotonPlace,
  createDebouncedCallback,
  extractFirstWord,
  extractPrimaryPlaceName,
  formatAccuracyReadable,
  formatPlaceDisplay,
  formatSuggestionSubline,
  getAqiCategory,
  getRiskCategoryFromAqi,
  isLowLocationAccuracy,
  LOW_ACCURACY_THRESHOLD_METERS,
  mapGeolocationError,
  mergeAndRankPlaceSuggestions,
  MIN_SEARCH_QUERY_LENGTH,
  parseLocationSearchQuery,
  parsePastedCoordinates,
  parsePhotonReverseLocation,
  parsePhotonSuggestions,
  parsePhotonSuggestionsTyped,
  SEARCH_DEBOUNCE_MS,
  shouldTriggerLocationSearch,
  validateAirQualityInputs,
  validateCoordinates,
  type PhotonFeatureCollection,
} from './aqi';
import { searchIndianPlacesWithFallback } from './openMeteo';
import type { AdviceRequestPayload } from '../types/airQuality';

describe('getAqiCategory', () => {
  it('classifies US AQI boundaries accurately', () => {
    expect(getAqiCategory(0).key).toBe('good');
    expect(getAqiCategory(50).key).toBe('good');
    expect(getAqiCategory(51).key).toBe('moderate');
    expect(getAqiCategory(100).key).toBe('moderate');
    expect(getAqiCategory(101).key).toBe('sensitive');
    expect(getAqiCategory(150).key).toBe('sensitive');
    expect(getAqiCategory(151).key).toBe('unhealthy');
    expect(getAqiCategory(200).key).toBe('unhealthy');
    expect(getAqiCategory(201).key).toBe('very_unhealthy');
    expect(getAqiCategory(300).key).toBe('very_unhealthy');
    expect(getAqiCategory(301).key).toBe('hazardous');
    expect(getAqiCategory(485).key).toBe('hazardous');
  });

  it('maps exact US AQI category labels for fixed risk levels', () => {
    expect(getRiskCategoryFromAqi(25).level).toBe('Good');
    expect(getRiskCategoryFromAqi(50).level).toBe('Good');
    expect(getRiskCategoryFromAqi(51).level).toBe('Moderate');
    expect(getRiskCategoryFromAqi(100).level).toBe('Moderate');
    expect(getRiskCategoryFromAqi(101).level).toBe('Unhealthy for Sensitive Groups');
    expect(getRiskCategoryFromAqi(150).level).toBe('Unhealthy for Sensitive Groups');
    expect(getRiskCategoryFromAqi(151).level).toBe('Unhealthy');
    expect(getRiskCategoryFromAqi(200).level).toBe('Unhealthy');
    expect(getRiskCategoryFromAqi(201).level).toBe('Very Unhealthy');
    expect(getRiskCategoryFromAqi(300).level).toBe('Very Unhealthy');
    expect(getRiskCategoryFromAqi(301).level).toBe('Hazardous');
    expect(getRiskCategoryFromAqi(420).level).toBe('Hazardous');
  });

  it('rounds decimal AQI values cleanly at thresholds', () => {
    expect(getAqiCategory(50.4).key).toBe('good');
    expect(getAqiCategory(50.6).key).toBe('moderate');
    expect(getAqiCategory(300.6).key).toBe('hazardous');
  });

  it('returns invalid category for negative, null, undefined, or NaN inputs', () => {
    expect(getAqiCategory(-5).key).toBe('invalid');
    expect(getAqiCategory(null).key).toBe('invalid');
    expect(getAqiCategory(undefined).key).toBe('invalid');
    expect(getAqiCategory(Number.NaN).key).toBe('invalid');
  });

  it('provides both English and Hinglish labels', () => {
    const category = getAqiCategory(260);
    expect(category.labelEn).toBe('Very Unhealthy');
    expect(category.labelHinglish).toContain('Very Unhealthy');
    expect(category.rangeLabel).toBe('201–300');
  });
});

describe('validateAirQualityInputs', () => {
  const validInputs = {
    cityName: 'New Delhi',
    usAqi: 245,
    pm25: 162.4,
    pm10: 270.1,
    userType: 'parent' as const,
    commuteType: 'metro_public_transit' as const,
    household: ['children' as const, 'seniors' as const],
  };

  it('accepts complete valid inputs including null optional PM readings and Just me / General skip options', () => {
    expect(validateAirQualityInputs(validInputs).valid).toBe(true);
    expect(
      validateAirQualityInputs({
        ...validInputs,
        pm25: null,
        pm10: null,
        household: ['just_me'],
      }).valid
    ).toBe(true);
    expect(
      validateAirQualityInputs({
        ...validInputs,
        pm25: null,
        pm10: null,
        household: ['general_skip'],
      }).valid
    ).toBe(true);
  });

  it('rejects empty or too-short city name', () => {
    const res = validateAirQualityInputs({ ...validInputs, cityName: 'A' });
    expect(res.valid).toBe(false);
    expect(res.errors.cityName).toBeDefined();
  });

  it('rejects missing, negative, or out-of-range AQI values', () => {
    expect(validateAirQualityInputs({ ...validInputs, usAqi: null }).errors.usAqi).toBeDefined();
    expect(validateAirQualityInputs({ ...validInputs, usAqi: -1 }).errors.usAqi).toBeDefined();
    expect(validateAirQualityInputs({ ...validInputs, usAqi: 1001 }).errors.usAqi).toBeDefined();
    expect(validateAirQualityInputs({ ...validInputs, usAqi: Number.NaN }).errors.usAqi).toBeDefined();
  });

  it('rejects out-of-range PM2.5 and PM10 values', () => {
    const res = validateAirQualityInputs({
      ...validInputs,
      pm25: -4,
      pm10: 5000,
    });
    expect(res.valid).toBe(false);
    expect(res.errors.pm25).toBeDefined();
    expect(res.errors.pm10).toBeDefined();
  });

  it('rejects missing userType or commuteType and localizes messages to Hinglish', () => {
    const res = validateAirQualityInputs(
      {
        ...validInputs,
        userType: '',
        commuteType: '',
      },
      'hinglish'
    );
    expect(res.valid).toBe(false);
    expect(res.errors.userType).toContain('Kripya');
    expect(res.errors.commuteType).toContain('Kripya');
  });
});

describe('buildAdviceCacheKey', () => {
  const basePayload: AdviceRequestPayload = {
    todayDate: '2026-11-21',
    todayReadable: 'Saturday, 21 November 2026',
    language: 'en',
    location: { cityName: 'New Delhi', latitude: 28.61, longitude: 77.21 },
    airQuality: {
      usAqi: 284,
      pm25: 192.3,
      pm10: 298.8,
      source: 'Open-Meteo Air Quality API',
      timestamp: '2026-11-21T08:00',
    },
    profile: {
      household: ['seniors', 'children'],
      userType: 'parent',
      commuteType: 'metro_public_transit',
      hasMask: true,
      hasPurifier: false,
    },
  };

  it('produces identical keys regardless of household array order or city whitespace/casing', () => {
    const reordered: AdviceRequestPayload = {
      ...basePayload,
      location: { ...basePayload.location, cityName: '  new delhi ' },
      profile: {
        ...basePayload.profile,
        household: ['children', 'seniors'],
      },
    };
    expect(buildAdviceCacheKey(basePayload)).toBe(buildAdviceCacheKey(reordered));
  });

  it('changes key when date, language, or mask availability changes', () => {
    const nextDay = buildAdviceCacheKey({ ...basePayload, todayDate: '2026-11-22' });
    const hinglish = buildAdviceCacheKey({ ...basePayload, language: 'hinglish' });
    const noMask = buildAdviceCacheKey({
      ...basePayload,
      profile: { ...basePayload.profile, hasMask: false },
    });

    const baseKey = buildAdviceCacheKey(basePayload);
    expect(nextDay).not.toBe(baseKey);
    expect(hinglish).not.toBe(baseKey);
    expect(noMask).not.toBe(baseKey);
  });
});

describe('location accuracy handling', () => {
  it('flags accuracy strictly worse than 5 km (5000 m) as low accuracy', () => {
    expect(LOW_ACCURACY_THRESHOLD_METERS).toBe(5000);
    expect(isLowLocationAccuracy(32)).toBe(false);
    expect(isLowLocationAccuracy(4999)).toBe(false);
    expect(isLowLocationAccuracy(5000)).toBe(false);
    expect(isLowLocationAccuracy(5001)).toBe(true);
    expect(isLowLocationAccuracy(18500)).toBe(true);
    expect(isLowLocationAccuracy(undefined)).toBe(false);
    expect(isLowLocationAccuracy(null)).toBe(false);
    expect(isLowLocationAccuracy(Number.NaN)).toBe(false);
  });

  it('formats accuracy in readable m or km units', () => {
    expect(formatAccuracyReadable(32)).toBe('32 m');
    expect(formatAccuracyReadable(999)).toBe('999 m');
    expect(formatAccuracyReadable(1000)).toBe('1 km');
    expect(formatAccuracyReadable(5400)).toBe('5.4 km');
    expect(formatAccuracyReadable(18400)).toBe('18 km');
    expect(formatAccuracyReadable(-10)).toBeNull();
    expect(formatAccuracyReadable(undefined)).toBeNull();
  });

  it('marks coarse geolocation place names as approximate so they are never presented as exact', () => {
    const coarseGeo = {
      cityName: 'Patparganj',
      district: 'East Delhi',
      admin1: 'Delhi',
      accuracyMeters: 12000,
      isGeolocation: true,
    };
    const exactGps = {
      ...coarseGeo,
      accuracyMeters: 35,
      isGeolocation: true,
    };

    expect(formatPlaceDisplay(coarseGeo, 'en')).toBe(
      'Approximate area (not exact): Patparganj, East Delhi, Delhi'
    );
    expect(formatPlaceDisplay(coarseGeo, 'hinglish')).toBe(
      'Andazan ilaka (exact nahi): Patparganj, East Delhi, Delhi'
    );
    expect(formatPlaceDisplay(exactGps, 'en')).toBe('Patparganj, East Delhi, Delhi');
  });

  it('validates manual latitude and longitude bounds', () => {
    expect(validateCoordinates('28.6139', '77.2090')).toEqual({
      valid: true,
      latitude: 28.6139,
      longitude: 77.209,
    });
    expect(validateCoordinates('95', '77.2', 'en').valid).toBe(false);
    expect(validateCoordinates('28.6', '185', 'hinglish').error).toContain('Kripya');
    expect(validateCoordinates('', '77.2').valid).toBe(false);
  });
});

describe('place-name parsing and pasted-coordinates parsing', () => {
  it('extracts only the place name before the first comma and normalizes whitespace', () => {
    expect(extractPrimaryPlaceName('Pimpalgaon Nipani, Nashik, Maharashtra')).toBe(
      'Pimpalgaon Nipani'
    );
    expect(extractPrimaryPlaceName('  Rampur , Uttar Pradesh  ')).toBe('Rampur');
    expect(extractPrimaryPlaceName('  Pimpalgaon   Nipani ')).toBe('Pimpalgaon Nipani');
    expect(extractPrimaryPlaceName(', Nashik')).toBe('');
  });

  it('extracts the first word for single-word fallback search', () => {
    expect(extractFirstWord('Pimpalgaon Nipani')).toBe('Pimpalgaon');
    expect(extractFirstWord('  New   Delhi ')).toBe('New');
    expect(extractFirstWord('Rampur')).toBe('Rampur');
    expect(extractFirstWord('   ')).toBe('');
  });

  it('parses pasted coordinates in single-box formats cleanly', () => {
    expect(parsePastedCoordinates('19.55, 74.10')).toEqual({
      valid: true,
      latitude: 19.55,
      longitude: 74.1,
    });
    expect(parsePastedCoordinates('19.55,74.10')).toEqual({
      valid: true,
      latitude: 19.55,
      longitude: 74.1,
    });
    expect(parsePastedCoordinates('19.55 74.10')).toEqual({
      valid: true,
      latitude: 19.55,
      longitude: 74.1,
    });
    expect(parsePastedCoordinates('(19.5500, 74.1000)')).toEqual({
      valid: true,
      latitude: 19.55,
      longitude: 74.1,
    });
    expect(parsePastedCoordinates('19.55° N, 74.10° E')).toEqual({
      valid: true,
      latitude: 19.55,
      longitude: 74.1,
    });
    expect(parsePastedCoordinates('19.55° S, 74.10° W')).toEqual({
      valid: true,
      latitude: -19.55,
      longitude: -74.1,
    });
  });

  it('rejects malformed or out-of-range pasted coordinates with localized error', () => {
    expect(parsePastedCoordinates('19.55', 'en').valid).toBe(false);
    expect(parsePastedCoordinates('abc, def', 'hinglish').error).toContain('Coordinates');
    expect(parsePastedCoordinates('95.5, 74.10', 'en').valid).toBe(false);
    expect(parsePastedCoordinates('19.55, 185.10', 'hinglish').error).toContain('Kripya');
  });
});

describe('geolocation error-code mapping (1, 2, 3)', () => {
  it('maps code 1 as permission denied without retrying', () => {
    const mapped = mapGeolocationError(1, 'User denied Geolocation', 'en');
    expect(mapped.code).toBe(1);
    expect(mapped.kind).toBe('permission_denied');
    expect(mapped.shouldRetryLowAccuracy).toBe(false);
    expect(mapped.isBlockedByPolicy).toBe(false);
    expect(mapped.userMessage.toLowerCase()).toContain('denied');

    const policyBlocked = mapGeolocationError(
      1,
      'Geolocation has been disabled in this document by permissions policy.',
      'en'
    );
    expect(policyBlocked.code).toBe(1);
    expect(policyBlocked.isBlockedByPolicy).toBe(true);
    expect(policyBlocked.userMessage).toContain('new tab');
  });

  it('maps code 2 as position unavailable with phone Location prompt and never mentions permission declined', () => {
    const mapped = mapGeolocationError(2, 'Location information is unavailable.', 'en');
    expect(mapped.code).toBe(2);
    expect(mapped.kind).toBe('position_unavailable');
    expect(mapped.shouldRetryLowAccuracy).toBe(false);
    expect(mapped.userMessage).toBe(
      'Your device could not find its position. Turn on phone Location and try again.'
    );
    expect(mapped.userMessage.toLowerCase()).not.toContain('permission');

    const hi = mapGeolocationError(2, 'Position unavailable', 'hinglish');
    expect(hi.userMessage).toContain('Location on karein');
    expect(hi.userMessage.toLowerCase()).not.toContain('permission');
  });

  it('maps code 3 as timeout with low-accuracy retry flag and never mentions permission declined', () => {
    const mapped = mapGeolocationError(3, 'Timeout expired', 'en');
    expect(mapped.code).toBe(3);
    expect(mapped.kind).toBe('timeout');
    expect(mapped.shouldRetryLowAccuracy).toBe(true);
    expect(mapped.userMessage.toLowerCase()).toContain('timed out');
    expect(mapped.userMessage.toLowerCase()).not.toContain('permission');

    const hi = mapGeolocationError(3, 'Timeout expired', 'hinglish');
    expect(hi.shouldRetryLowAccuracy).toBe(true);
    expect(hi.userMessage.toLowerCase()).toContain('timeout');
    expect(hi.userMessage.toLowerCase()).not.toContain('permission');
  });
});

describe('Blinkit-style Photon suggestion parsing', () => {
  it('filters results to India (countrycode IN), extracts coordinates, and caps at limit 8', () => {
    const mockCollection: PhotonFeatureCollection = {
      features: [
        {
          geometry: { coordinates: [73.92, 19.75] },
          properties: {
            name: 'Pimpalgaon Nipani',
            locality: 'Niphad',
            district: 'Nashik',
            state: 'Maharashtra',
            countrycode: 'IN',
          },
        },
        {
          geometry: { coordinates: [85.32, 27.71] },
          properties: {
            name: 'Kathmandu',
            state: 'Bagmati',
            countrycode: 'NP',
          },
        },
        {
          geometry: { coordinates: [77.21, 28.61] },
          properties: {
            name: 'Indirapuram',
            suburb: 'Ghaziabad',
            county: 'Ghaziabad District',
            state: 'Uttar Pradesh',
            countrycode: 'in',
          },
        },
        ...Array.from({ length: 10 }, (_, idx) => ({
          geometry: { coordinates: [77.0 + idx * 0.01, 28.0 + idx * 0.01] },
          properties: {
            name: `Sector ${idx + 1}`,
            city: 'Gurugram',
            state: 'Haryana',
            countrycode: 'IN',
          },
        })),
      ],
    };

    const parsed = parsePhotonSuggestions(mockCollection, 8);
    expect(parsed).toHaveLength(8);
    expect(parsed.every((item) => item.countryCode === 'IN')).toBe(true);

    expect(parsed[0]).toEqual({
      cityName: 'Pimpalgaon Nipani',
      area: 'Niphad',
      district: 'Nashik',
      admin1: 'Maharashtra',
      countryCode: 'IN',
      latitude: 19.75,
      longitude: 73.92,
    });
    expect(parsed[1].cityName).toBe('Indirapuram');
    expect(parsed[1].area).toBe('Ghaziabad');
    expect(parsed[1].district).toBe('Ghaziabad District');
    expect(parsed[1].admin1).toBe('Uttar Pradesh');
  });

  it('formats suggestion subline cleanly with area, district, and state without duplicating cityName', () => {
    expect(
      formatSuggestionSubline({
        cityName: 'Indirapuram',
        area: 'Shakti Khand',
        district: 'Ghaziabad',
        admin1: 'Uttar Pradesh',
      })
    ).toBe('Shakti Khand, Ghaziabad, Uttar Pradesh');

    expect(
      formatSuggestionSubline({
        cityName: 'Sangamner',
        area: 'Sangamner',
        district: 'Sangamner',
        admin1: 'Maharashtra',
      })
    ).toBe('Maharashtra');
  });

  it('parses Photon reverse geocoding safely and prefers town/locality over nearby POI names', () => {
    const poiReverse: PhotonFeatureCollection = {
      features: [
        {
          geometry: { coordinates: [74.1, 19.55] },
          properties: {
            osm_key: 'amenity',
            name: 'Ganesh Temple',
            city: 'Sangamner',
            county: 'Sangamner',
            state: 'Maharashtra',
            countrycode: 'IN',
          },
        },
      ],
    };
    const resolvedPoi = parsePhotonReverseLocation(poiReverse, 19.55, 74.1, 45);
    expect(resolvedPoi.cityName).toBe('Sangamner');
    expect(resolvedPoi.admin1).toBe('Maharashtra');
    expect(resolvedPoi.accuracyMeters).toBe(45);
    expect(resolvedPoi.isGeolocation).toBe(true);

    const placeReverse: PhotonFeatureCollection = {
      features: [
        {
          geometry: { coordinates: [77.22, 28.63] },
          properties: {
            osm_key: 'place',
            name: 'Mayur Vihar',
            district: 'East Delhi',
            state: 'Delhi',
            countrycode: 'IN',
          },
        },
      ],
    };
    const resolvedPlace = parsePhotonReverseLocation(placeReverse, 28.63, 77.22, 30);
    expect(resolvedPlace.cityName).toBe('Mayur Vihar');
    expect(resolvedPlace.district).toBe('East Delhi');
    expect(resolvedPlace.admin1).toBe('Delhi');

    const fallback = parsePhotonReverseLocation(null, 19.55, 74.1, 120);
    expect(fallback.cityName).toBe('19.5500°N, 74.1000°E');
    expect(fallback.accuracyMeters).toBe(120);
  });
});

describe('search minimum-length and 350ms debounce logic', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('requires at least 3 trimmed characters before triggering location search', () => {
    expect(MIN_SEARCH_QUERY_LENGTH).toBe(3);
    expect(shouldTriggerLocationSearch('')).toBeNull();
    expect(shouldTriggerLocationSearch('ab')).toBeNull();
    expect(shouldTriggerLocationSearch('  ab  ')).toBeNull();
    expect(shouldTriggerLocationSearch('del')).toBe('del');
    expect(shouldTriggerLocationSearch('  New   Delhi  ')).toBe('New Delhi');
  });

  it('debounces rapid inputs by 350ms and supports cancelling stale calls', () => {
    vi.useFakeTimers();
    expect(SEARCH_DEBOUNCE_MS).toBe(350);

    const spy = vi.fn();
    const debounced = createDebouncedCallback(spy, SEARCH_DEBOUNCE_MS);

    debounced.run('pim');
    vi.advanceTimersByTime(200);
    expect(spy).not.toHaveBeenCalled();

    debounced.run('pimp');
    vi.advanceTimersByTime(349);
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('pimp');

    debounced.run('pimpal');
    vi.advanceTimersByTime(100);
    debounced.cancel();
    vi.advanceTimersByTime(400);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('place-type ordering and comma-splitting search logic', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('classifies city, town, village, hamlet, suburb vs landmarks accurately even when Photon sets generic type=city', () => {
    expect(
      classifyPhotonPlace({
        osm_key: 'place',
        osm_value: 'city',
        type: 'city',
      })
    ).toMatchObject({ placeType: 'City', isPopulatedPlace: true });

    expect(
      classifyPhotonPlace({
        osm_key: 'place',
        osm_value: 'town',
        type: 'city',
      })
    ).toMatchObject({ placeType: 'Town', isPopulatedPlace: true });

    expect(
      classifyPhotonPlace({
        osm_key: 'place',
        osm_value: 'suburb',
        type: 'district',
      })
    ).toMatchObject({ placeType: 'Town', isPopulatedPlace: true });

    expect(
      classifyPhotonPlace({
        osm_key: 'place',
        osm_value: 'village',
        type: 'city',
      })
    ).toMatchObject({ placeType: 'Village', isPopulatedPlace: true });

    expect(
      classifyPhotonPlace({
        osm_key: 'place',
        osm_value: 'hamlet',
        type: 'city',
      })
    ).toMatchObject({ placeType: 'Village', isPopulatedPlace: true });

    expect(
      classifyPhotonPlace({
        osm_key: 'amenity',
        osm_value: 'college',
        type: 'house',
      })
    ).toMatchObject({ placeType: 'Landmark', isPopulatedPlace: false });

    expect(
      classifyPhotonPlace({
        osm_key: 'highway',
        osm_value: 'primary',
        type: 'street',
      })
    ).toMatchObject({ placeType: 'Landmark', isPopulatedPlace: false });
  });

  it('orders populated places before landmarks, deduplicates, and caps landmarks at 2', () => {
    const rawCollection: PhotonFeatureCollection = {
      features: [
        {
          geometry: { coordinates: [74.01, 19.54] },
          properties: {
            osm_key: 'amenity',
            osm_value: 'college',
            name: 'Akole Engineering College',
            county: 'Akola',
            state: 'Maharashtra',
            countrycode: 'IN',
          },
        },
        {
          geometry: { coordinates: [74.02, 19.55] },
          properties: {
            osm_key: 'shop',
            osm_value: 'supermarket',
            name: 'Akole Super Mart',
            county: 'Akola',
            state: 'Maharashtra',
            countrycode: 'IN',
          },
        },
        {
          geometry: { coordinates: [74.03, 19.56] },
          properties: {
            osm_key: 'highway',
            osm_value: 'primary',
            type: 'street',
            name: 'Akole Road',
            county: 'Sangamner',
            state: 'Maharashtra',
            countrycode: 'IN',
          },
        },
        {
          geometry: { coordinates: [75.78, 17.59] },
          properties: {
            osm_key: 'place',
            osm_value: 'village',
            type: 'city',
            name: 'Akole',
            county: 'Solapur South',
            state: 'Maharashtra',
            countrycode: 'IN',
          },
        },
        // Duplicate of village above (within ~0.02 deg)
        {
          geometry: { coordinates: [75.781, 17.594] },
          properties: {
            osm_key: 'place',
            osm_value: 'village',
            type: 'city',
            name: 'Akole',
            county: 'Solapur South',
            state: 'Maharashtra',
            countrycode: 'IN',
          },
        },
        {
          geometry: { coordinates: [74.009, 19.541] },
          properties: {
            osm_key: 'place',
            osm_value: 'town',
            type: 'city',
            name: 'Akole',
            county: 'Ahilyanagar',
            state: 'Maharashtra',
            countrycode: 'IN',
          },
        },
        {
          geometry: { coordinates: [77.0, 20.71] },
          properties: {
            osm_key: 'place',
            osm_value: 'city',
            type: 'city',
            name: 'Akola',
            county: 'Akola',
            state: 'Maharashtra',
            countrycode: 'IN',
          },
        },
      ],
    };

    const candidates = parsePhotonSuggestionsTyped(rawCollection, 16);
    const ranked = mergeAndRankPlaceSuggestions({
      candidates,
      searchText: 'Akole',
      rankingTerms: ['solapur'],
      maxPopulated: 8,
      maxLandmarks: 2,
    });

    // Solapur village should be boosted #1 by rankingTerms, followed by other populated places
    expect(ranked[0]).toMatchObject({
      cityName: 'Akole',
      district: 'Solapur South',
      placeType: 'Village',
      isLandmark: false,
    });
    expect(ranked[1]).toMatchObject({
      cityName: 'Akole',
      district: 'Ahilyanagar',
      placeType: 'Town',
      isLandmark: false,
    });
    expect(ranked[2]).toMatchObject({
      cityName: 'Akola',
      placeType: 'City',
      isLandmark: false,
    });

    // Landmarks strictly at the bottom and capped at 2 (not 3)
    const landmarks = ranked.filter((item) => item.isLandmark);
    expect(landmarks).toHaveLength(2);
    expect(ranked.slice(3)).toEqual(landmarks);
  });

  it('splits comma queries so text before comma is search query and text after comma becomes ranking terms', () => {
    expect(parseLocationSearchQuery('  Akole ,  Ahilyanagar,  Maharashtra ')).toEqual({
      primarySearchText: 'Akole',
      firstWord: 'Akole',
      words: ['Akole'],
      rankingTerms: ['ahilyanagar', 'maharashtra'],
      hasComma: true,
    });

    expect(parseLocationSearchQuery('Akole Ahilyanagar')).toEqual({
      primarySearchText: 'Akole Ahilyanagar',
      firstWord: 'Akole',
      words: ['Akole', 'Ahilyanagar'],
      rankingTerms: [],
      hasComma: false,
    });
  });

  it('calls Photon twice (osm_tag=place and unfiltered), ranks by comma context, and falls back to Open-Meteo when Photon has no populated places', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('photon.komoot.io/api/') && url.includes('osm_tag=place')) {
        // Test comma query: Photon must receive q=Akole (not Ahilyanagar)
        if (url.includes('q=Akole&')) {
          return new Response(
            JSON.stringify({
              features: [
                {
                  geometry: { coordinates: [75.78, 17.59] },
                  properties: {
                    osm_key: 'place',
                    osm_value: 'village',
                    name: 'Akole',
                    county: 'Solapur South',
                    state: 'Maharashtra',
                    countrycode: 'IN',
                  },
                },
                {
                  geometry: { coordinates: [74.01, 19.54] },
                  properties: {
                    osm_key: 'place',
                    osm_value: 'town',
                    name: 'Akole',
                    county: 'Ahilyanagar',
                    state: 'Maharashtra',
                    countrycode: 'IN',
                  },
                },
              ],
            }),
            { status: 200 }
          );
        }
        // No populated places for 'Ranjangaon' in Photon
        return new Response(JSON.stringify({ features: [] }), { status: 200 });
      }

      if (url.includes('photon.komoot.io/api/')) {
        if (url.includes('q=Akole&')) {
          return new Response(
            JSON.stringify({
              features: [
                {
                  geometry: { coordinates: [74.02, 19.55] },
                  properties: {
                    osm_key: 'amenity',
                    osm_value: 'college',
                    name: 'Akole Junior College',
                    county: 'Ahilyanagar',
                    state: 'Maharashtra',
                    countrycode: 'IN',
                  },
                },
              ],
            }),
            { status: 200 }
          );
        }
        // Landmark-only hit for 'Ranjangaon' in unfiltered Photon
        return new Response(
          JSON.stringify({
            features: [
              {
                geometry: { coordinates: [74.24, 18.75] },
                properties: {
                  osm_key: 'amenity',
                  osm_value: 'temple',
                  name: 'Ranjangaon Ganpati Temple',
                  county: 'Pune',
                  state: 'Maharashtra',
                  countrycode: 'IN',
                },
              },
            ],
          }),
          { status: 200 }
        );
      }

      if (url.includes('geocoding-api.open-meteo.com')) {
        return new Response(
          JSON.stringify({
            results: [
              {
                id: 101,
                name: 'Ranjangaon',
                latitude: 18.752,
                longitude: 74.241,
                country_code: 'IN',
                admin1: 'Maharashtra',
                admin2: 'Pune',
                feature_code: 'PPL',
                population: 8500,
              },
            ],
          }),
          { status: 200 }
        );
      }

      return new Response('{}', { status: 404 });
    });

    // 1. Comma query: calls Photon twice with q=Akole and ranks Ahilyanagar ahead of Solapur South
    const akoleResults = await searchIndianPlacesWithFallback('Akole, Ahilyanagar');
    expect(akoleResults[0]).toMatchObject({
      cityName: 'Akole',
      district: 'Ahilyanagar',
      placeType: 'Town',
      isLandmark: false,
    });
    expect(akoleResults[1]).toMatchObject({
      cityName: 'Akole',
      district: 'Solapur South',
      placeType: 'Village',
      isLandmark: false,
    });
    expect(akoleResults[2]).toMatchObject({
      cityName: 'Akole Junior College',
      placeType: 'Landmark',
      isLandmark: true,
    });

    const akolePhotonUrls = fetchMock.mock.calls
      .map(([arg]) => (typeof arg === 'string' ? arg : arg.toString()))
      .filter((u) => u.includes('photon.komoot.io/api/'));
    expect(akolePhotonUrls.some((u) => u.includes('osm_tag=place'))).toBe(true);
    expect(akolePhotonUrls.some((u) => !u.includes('osm_tag=place'))).toBe(true);
    expect(akolePhotonUrls.every((u) => u.includes('q=Akole&'))).toBe(true);

    // 2. When Photon returns 0 populated places (only landmark), Open-Meteo adds populated village before landmark
    const ranjangaonResults = await searchIndianPlacesWithFallback('Ranjangaon');
    expect(ranjangaonResults[0]).toMatchObject({
      cityName: 'Ranjangaon',
      district: 'Pune',
      admin1: 'Maharashtra',
      placeType: 'Village',
      isLandmark: false,
    });
    expect(ranjangaonResults[1]).toMatchObject({
      cityName: 'Ranjangaon Ganpati Temple',
      placeType: 'Landmark',
      isLandmark: true,
    });
  });
});





