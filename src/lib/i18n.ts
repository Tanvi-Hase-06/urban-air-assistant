import type {
  CommuteType,
  HouseholdMember,
  LanguageMode,
  UserType,
} from '../types/airQuality.ts';

export const POPULAR_INDIAN_CITIES = [
  'New Delhi',
  'Gurugram',
  'Lucknow',
  'Mumbai',
  'Bengaluru',
  'Patna',
  'Kolkata',
  'Pune',
] as const;

export interface LocalizedStrings {
  brandTitle: string;
  navTelemetry: string;
  navProfile: string;
  navAdvisory: string;
  navImpact: string;
  navActionSample: string;
  heroTitle: string;
  heroSubtitle: string;
  todayPrefix: string;
  sampleDataBtn: string;
  sampleActiveNotice: string;
  languageLabel: string;
  locationSectionTitle: string;
  cityInputLabel: string;
  cityInputPlaceholder: string;
  searchCityBtn: string;
  useMyLocationBtn: string;
  fetchingTelemetry: string;
  manualFallbackPrompt: string;
  switchToManualBtn: string;
  retryLiveBtn: string;
  manualAqiLabel: string;
  manualPm25Label: string;
  manualPm10Label: string;
  applyManualBtn: string;
  sourceLabel: string;
  updatedLabel: string;
  coordinatesLabel: string;
  accuracyLabel: string;
  gridEstimateNote: string;
  lowAccuracyWarning: (readableKm: string) => string;
  pickTownPrompt: string;
  pickTownPlaceholder: string;
  pickTownBtn: string;
  searchingPlaces: string;
  noPlaceFound: string;
  recentPlacesLabel: string;
  popularCitiesLabel: string;
  nearbyLandmarksHeading: string;
  villageHelpHint: string;
  matchingPlacesLabel: string;
  noMatchingPlaces: string;
  enterCoordsBtn: string;
  hideCoordsBtn: string;
  pasteCoordsLabel: string;
  pasteCoordsPlaceholder: string;
  latitudeLabel: string;
  longitudeLabel: string;
  applyCoordsBtn: string;
  otherWaysTitle: string;
  getMyPlanBtn: string;
  diagLabel: string;
  diagSecureYes: string;
  diagSecureNo: string;
  diagPermissionPrefix: string;
  diagLastErrorPrefix: string;
  diagNone: string;
  insecureContextWarning: string;
  iframeBlockedTitle: string;
  iframeBlockedBody: string;
  openInNewTabBtn: string;
  chromeAndroidTitle: string;
  chromeAndroidSteps: string;
  inAppBrowserWarning: string;
  retryingLowAccuracyNotice: string;
  profileSectionTitle: string;
  householdLabel: string;
  householdHint: string;
  householdOptions: Record<HouseholdMember, string>;
  userTypeLabel: string;
  userTypeOptions: Record<UserType, string>;
  commuteLabel: string;
  commuteOptions: Record<CommuteType, string>;
  gearLabel: string;
  hasMaskLabel: string;
  hasPurifierLabel: string;
  yesLabel: string;
  noLabel: string;
  generateBtn: string;
  generatingBtn: string;
  emptyTitle: string;
  emptyBody: string;
  emptyChecklist: string[];
  loadingTitle: string;
  loadingBody: string;
  cachedLabel: string;
  freshLabel: string;
  regenerateBtn: string;
  snapshotTitle: string;
  riskCardTitle: string;
  childrenPlayTitle: string;
  adultOutdoorTitle: string;
  dailyPlanTitle: string;
  morningLabel: string;
  afternoonLabel: string;
  eveningLabel: string;
  commuteAlternativesTitle: string;
  indoorActionsTitle: string;
  cityAlternativesTitle: string;
  impactTitle: string;
  approximateBadge: string;
  doctorDisclaimerTitle: string;
  doctorDisclaimerBody: string;
  geoDeniedError: string;
  geoUnsupportedError: string;
  cityNotFoundError: string;
  apiFailedError: string;
  geminiErrorTitle: string;
  retryGenerateBtn: string;
}

export const STRINGS: Record<LanguageMode, LocalizedStrings> = {
  en: {
    brandTitle: 'Urban Air Quality Assistant',
    navTelemetry: 'Air Readings',
    navProfile: 'Household Profile',
    navAdvisory: 'Daily Plan',
    navImpact: 'Impact Estimates',
    navActionSample: 'Try Sample Data',
    heroTitle: 'Daily winter smog protection plan for Indian families',
    heroSubtitle:
      'Check live US AQI, PM2.5, and PM10 for your location and build a practical morning-to-evening safety schedule tailored to your household.',
    todayPrefix: 'India Winter Smog Advisory',
    sampleDataBtn: 'Sample data',
    sampleActiveNotice:
      'Sample winter smog scenario loaded (New Delhi). You can edit any field or search your own city.',
    languageLabel: 'Language',
    locationSectionTitle: '1. Location & Live Air Quality',
    cityInputLabel: 'Search your area, village or city',
    cityInputPlaceholder: 'Search your area, village or city',
    searchCityBtn: 'Check Air',
    useMyLocationBtn: 'Use my location',
    fetchingTelemetry: 'Fetching coordinates and air quality readings...',
    manualFallbackPrompt: 'Enter AQI manually',
    switchToManualBtn: 'Enter AQI manually',
    retryLiveBtn: 'Fetch live Open-Meteo data',
    manualAqiLabel: 'Current US AQI (0–1000)',
    manualPm25Label: 'PM2.5 (µg/m³, optional)',
    manualPm10Label: 'PM10 (µg/m³, optional)',
    applyManualBtn: 'Use Manual Readings',
    sourceLabel: 'Data source',
    updatedLabel: 'Reading time',
    coordinatesLabel: 'Coordinates',
    accuracyLabel: 'Accuracy',
    gridEstimateNote:
      'Air quality is a model estimate for a roughly 11 km grid around this point, not a street-level reading.',
    lowAccuracyWarning: (readableKm: string) =>
      `Your device gave only an approximate location (about ${readableKm}). Search your town or village below, or open this app on your phone for GPS.`,
    pickTownPrompt: 'Search your exact town or village (up to 8 matches)',
    pickTownPlaceholder: 'e.g., Pimpalgaon Nipani, Rampur, Kharagpur',
    pickTownBtn: 'Find Places',
    searchingPlaces: 'Searching...',
    noPlaceFound: 'No place found, try a nearby town',
    recentPlacesLabel: 'Recent',
    popularCitiesLabel: 'Popular cities',
    nearbyLandmarksHeading: 'Nearby landmarks',
    villageHelpHint:
      "Can't find your village? Choose a nearby town or use 'Enter lat & lon' in Having trouble?",
    matchingPlacesLabel: 'Matching places (tap to select)',
    noMatchingPlaces:
      "We could not find this village. Open Google Maps, long-press your village, copy the coordinates and use 'Enter lat & lon', or pick a nearby town.",
    enterCoordsBtn: 'Enter lat & lon',
    hideCoordsBtn: 'Hide lat & lon',
    pasteCoordsLabel: 'Paste coordinates (one box)',
    pasteCoordsPlaceholder: 'e.g. 19.55, 74.10',
    latitudeLabel: 'Latitude (-90 to 90)',
    longitudeLabel: 'Longitude (-180 to 180)',
    applyCoordsBtn: 'Use These Coordinates',
    otherWaysTitle: 'Having trouble? Other ways',
    getMyPlanBtn: 'Get my plan',
    diagLabel: 'Location diagnostics',
    diagSecureYes: 'Secure context: yes',
    diagSecureNo: 'Secure context: no (HTTPS required)',
    diagPermissionPrefix: 'Permission',
    diagLastErrorPrefix: 'Last error',
    diagNone: 'none',
    insecureContextWarning:
      'Geolocation requires HTTPS. Please open this app using an https:// link.',
    iframeBlockedTitle: 'Location is blocked inside this embedded frame',
    iframeBlockedBody:
      'Your browser or host frame is blocking geolocation here. Open this page directly in a new tab to use GPS.',
    openInNewTabBtn: 'Open in new tab',
    chromeAndroidTitle: 'How to enable Location on Chrome (Android)',
    chromeAndroidSteps:
      'Tap the lock icon in the address bar → open Permissions → set Location to Allow → then refresh this page.',
    inAppBrowserWarning:
      'Open this link directly in Chrome, not inside WhatsApp or another in-app browser.',
    retryingLowAccuracyNotice:
      'High-accuracy GPS timed out. Retrying once in standard location mode...',
    profileSectionTitle: '2. Household & Commute Profile',
    householdLabel: 'Who are you planning for?',
    householdHint:
      'Select household members, or choose Just me / General advice.',
    householdOptions: {
      children: 'Children',
      seniors: 'Seniors (60+)',
      breathing_issues: 'People with breathing issues',
      pets: 'Pets',
      just_me: 'Just me (adult)',
      general_skip: 'Skip, give me general advice',
    },
    userTypeLabel: 'You are planning as a',
    userTypeOptions: {
      working_professional: 'Working professional',
      student: 'Student',
      parent: 'Parent / Caregiver',
    },
    commuteLabel: 'Primary daily commute',
    commuteOptions: {
      metro_public_transit: 'Metro / Public Transit',
      two_wheeler: 'Two-Wheeler / Scooter',
      car_cab: 'Car / Cab',
      walking_cycling: 'Walking / Cycling',
      work_from_home: 'Work / Study from Home',
    },
    gearLabel: 'Protection available at home',
    hasMaskLabel: 'N95 / N99 Mask available',
    hasPurifierLabel: 'HEPA Air Purifier at home',
    yesLabel: 'Yes',
    noLabel: 'No',
    generateBtn: "Get Today's Personalized Plan",
    generatingBtn: 'Building your air quality plan...',
    emptyTitle: 'Ready to create today’s air safety plan',
    emptyBody:
      'Confirm your location’s air quality on the left, select your household profile and commute type, and generate one tailored advisory for today.',
    emptyChecklist: [
      'US AQI category and tailored explanation based on today’s readings',
      'Outdoor activity guidance matched to your selected household group',
      'Morning, afternoon, and evening schedule adjusted for winter smog inversion',
      'Low-emission commute alternatives, indoor air actions, and approximate impact estimates',
    ],
    loadingTitle: 'Preparing your personalized advisory',
    loadingBody:
      'Evaluating current PM2.5, PM10, winter smog timing, and your profile with Gemini...',
    cachedLabel: 'Loaded from today’s cache',
    freshLabel: 'Freshly generated for today',
    regenerateBtn: 'Refresh plan',
    snapshotTitle: 'Reading Snapshot',
    riskCardTitle: 'Current Air Risk Level',
    childrenPlayTitle: 'Should children play outside today?',
    adultOutdoorTitle: 'General Outdoor Activity Advice (Adults)',
    dailyPlanTitle: 'Morning, Afternoon & Evening Schedule',
    morningLabel: 'Morning',
    afternoonLabel: 'Afternoon',
    eveningLabel: 'Evening',
    commuteAlternativesTitle: 'Low-Emission Commute Alternatives',
    indoorActionsTitle: 'Indoor Air Quality Actions',
    cityAlternativesTitle: 'Sustainable Alternatives for Your City',
    impactTitle: 'Impact of Your Choices',
    approximateBadge: 'Approximate Estimates Only',
    doctorDisclaimerTitle: 'Medical & Health Note',
    doctorDisclaimerBody:
      'Please consult a doctor for health concerns, persistent coughing, wheezing, chest discomfort, or respiratory symptoms.',
    geoDeniedError:
      'Location permission was declined. Please search your Indian city above or enter your local AQI manually.',
    geoUnsupportedError:
      'Browser location is unavailable on this device. Search any Indian city or enter AQI manually.',
    cityNotFoundError:
      "We could not find this village. Open Google Maps, long-press your village, copy the coordinates and use 'Enter lat & lon', or pick a nearby town.",
    apiFailedError:
      'Live Open-Meteo air quality data could not be reached right now. No worries—you can type the current AQI manually below to continue.',
    geminiErrorTitle: 'Could not generate today’s plan',
    retryGenerateBtn: 'Try again',
  },
  hinglish: {
    brandTitle: 'Urban Air Quality Assistant',
    navTelemetry: 'Hawa Ka Haal',
    navProfile: 'Ghar Profile',
    navAdvisory: 'Aaj Ka Plan',
    navImpact: 'Fayde Ka Andaza',
    navActionSample: 'Sample Data Dekhein',
    heroTitle: 'Sardi ke smog mein Indian families ke liye daily safety plan',
    heroSubtitle:
      'Apni jagah ka live US AQI, PM2.5 aur PM10 check karein aur apne ghar ke hisaab se subah se shaam tak ka practical plan paayein.',
    todayPrefix: 'India Winter Smog Salah',
    sampleDataBtn: 'Sample data',
    sampleActiveNotice:
      'Sample winter smog data load ho gaya hai (New Delhi). Aap koi bhi detail badal sakte hain ya apna shehar search kar sakte hain.',
    languageLabel: 'Bhasha',
    locationSectionTitle: '1. Jagah aur Live Hawa Ki Quality',
    cityInputLabel: 'Apna area, village ya city search karein',
    cityInputPlaceholder: 'Search your area, village or city',
    searchCityBtn: 'Air Check Karein',
    useMyLocationBtn: 'Meri location use karein',
    fetchingTelemetry: 'Coordinates aur live AQI readings laa rahe hain...',
    manualFallbackPrompt: 'AQI khud daalein',
    switchToManualBtn: 'AQI khud type karein',
    retryLiveBtn: 'Live Open-Meteo data dobara laayein',
    manualAqiLabel: 'Abhi ka US AQI (0–1000)',
    manualPm25Label: 'PM2.5 (µg/m³, optional)',
    manualPm10Label: 'PM10 (µg/m³, optional)',
    applyManualBtn: 'Manual Reading Set Karein',
    sourceLabel: 'Data source',
    updatedLabel: 'Reading ka samay',
    coordinatesLabel: 'Coordinates',
    accuracyLabel: 'Accuracy',
    gridEstimateNote:
      'Yeh air quality reading is point ke lagbhag 11 km grid ka model estimate hai, street-level sensor reading nahi.',
    lowAccuracyWarning: (readableKm: string) =>
      `Aapke device ne sirf andazan location di hai (about ${readableKm}). Neeche apna town ya village search karein, ya GPS ke liye yeh app phone par kholein.`,
    pickTownPrompt: 'Apna sahi town ya village search karein (up to 8 results)',
    pickTownPlaceholder: 'Jaise: Pimpalgaon Nipani, Rampur, Kharagpur',
    pickTownBtn: 'Jagah Khojein',
    searchingPlaces: 'Searching...',
    noPlaceFound: 'Koi jagah nahi mili, koi nazdeeki town try karein',
    recentPlacesLabel: 'Haal ki jagah',
    popularCitiesLabel: 'Popular cities',
    nearbyLandmarksHeading: 'Nearby landmarks',
    villageHelpHint:
      "Can't find your village? Choose a nearby town or use 'Enter lat & lon' in Having trouble?",
    matchingPlacesLabel: 'Milti-julti jagah (select karne ke liye tap karein)',
    noMatchingPlaces:
      "Yeh village nahi mila. Google Maps kholein, apne village par long-press karke coordinates copy karein aur 'Enter lat & lon' use karein, ya nazdeeki town chunein.",
    enterCoordsBtn: 'Enter lat & lon',
    hideCoordsBtn: 'Lat & lon chhupayein',
    pasteCoordsLabel: 'Coordinates paste karein (ek box mein)',
    pasteCoordsPlaceholder: 'Jaise: 19.55, 74.10',
    latitudeLabel: 'Latitude (-90 se 90)',
    longitudeLabel: 'Longitude (-180 se 180)',
    applyCoordsBtn: 'In Coordinates Se AQI Dekhein',
    otherWaysTitle: 'Having trouble? Other ways',
    getMyPlanBtn: 'Get my plan',
    diagLabel: 'Location diagnostics',
    diagSecureYes: 'Secure context: yes',
    diagSecureNo: 'Secure context: no (HTTPS zaroori hai)',
    diagPermissionPrefix: 'Permission',
    diagLastErrorPrefix: 'Last error',
    diagNone: 'none',
    insecureContextWarning:
      'Geolocation ke liye HTTPS zaroori hai. Kripya is app ko https:// link par kholein.',
    iframeBlockedTitle: 'Is embedded frame mein location blocked hai',
    iframeBlockedBody:
      'Aapka browser ya iframe host yahan GPS block kar raha hai. Location use karne ke liye is page ko seedha naye tab mein kholein.',
    openInNewTabBtn: 'Open in new tab',
    chromeAndroidTitle: 'Chrome (Android) par Location allow karne ka tarika',
    chromeAndroidSteps:
      'Address bar mein lock icon tap karein → Permissions kholein → Location ko Allow karein → phir page refresh karein.',
    inAppBrowserWarning:
      'Is link ko WhatsApp ya kisi in-app browser ke bajaye seedha Chrome mein kholein.',
    retryingLowAccuracyNotice:
      'High-accuracy GPS timeout ho gaya. Standard location mode mein ek baar phir try kar rahe hain...',
    profileSectionTitle: '2. Ghar aur Commute Profile',
    householdLabel: 'Aap kiske liye plan bana rahe hain?',
    householdHint:
      'Ghar ke sadasya chunein, ya Sirf main / General advice chunein.',
    householdOptions: {
      children: 'Bacche (Children)',
      seniors: 'Buzurg (Seniors 60+)',
      breathing_issues: 'Saans ki takleef wale log',
      pets: 'Pets (Paaltu jaanwar)',
      just_me: 'Just me (adult)',
      general_skip: 'Skip, give me general advice',
    },
    userTypeLabel: 'Aapka role kya hai?',
    userTypeOptions: {
      working_professional: 'Working professional',
      student: 'Student',
      parent: 'Parent / Caregiver',
    },
    commuteLabel: 'Rozana aane-jaane ka zariya',
    commuteOptions: {
      metro_public_transit: 'Metro / Public Transit',
      two_wheeler: 'Two-Wheeler / Scooter',
      car_cab: 'Car / Cab',
      walking_cycling: 'Walking / Cycling',
      work_from_home: 'Ghar se Kaam / Padhai',
    },
    gearLabel: 'Ghar par uplabdh suraksha',
    hasMaskLabel: 'N95 / N99 Mask hai?',
    hasPurifierLabel: 'Ghar mein Air Purifier hai?',
    yesLabel: 'Haan',
    noLabel: 'Nahi',
    generateBtn: 'Aaj Ka Personalized Plan Dekhein',
    generatingBtn: 'Aapka air quality plan ban raha hai...',
    emptyTitle: 'Aaj ka safety plan banane ke liye taiyaar',
    emptyBody:
      'Baayein taraf apni jagah ka AQI confirm karein, profile aur commute chunein, aur ek click mein aaj ka plan paayein.',
    emptyChecklist: [
      'Aaj ke US AQI ke hisaab se fixed risk category aur uska kaaran',
      'Chune gaye profile ke mutabik bahar jaane ya khelne ki saaf salah',
      'Sardi ke smog ko dekhte hue Subah, Dopahar aur Shaam ka timetable',
      'Kam pollution wale commute options, ghar ke andar hawa saaf rakhne ke upay aur andazan fayda',
    ],
    loadingTitle: 'Aapke liye plan taiyaar ho raha hai',
    loadingBody:
      'Aaj ka PM2.5, PM10, sardi ka smog samay aur aapka profile check kiya ja raha hai...',
    cachedLabel: 'Aaj ke cache se turant dikhaya gaya',
    freshLabel: 'Aaj ke liye naya plan taiyaar hua',
    regenerateBtn: 'Naya plan laayein',
    snapshotTitle: 'Reading Snapshot',
    riskCardTitle: 'Abhi Hawa Ka Risk Level',
    childrenPlayTitle: 'Kya aaj bacche bahar khel sakte hain?',
    adultOutdoorTitle: 'Bahar Activity Ki Salah (Adults)',
    dailyPlanTitle: 'Subah, Dopahar aur Shaam Ka Plan',
    morningLabel: 'Subah (Morning)',
    afternoonLabel: 'Dopahar (Afternoon)',
    eveningLabel: 'Shaam (Evening)',
    commuteAlternativesTitle: 'Kam Dhuaan Wale Commute Options',
    indoorActionsTitle: 'Ghar Ke Andar AQI Kam Karne Ke Upay',
    cityAlternativesTitle: 'Shehar Ke Liye Sustainable Alternatives',
    impactTitle: 'Aapke Faislon Ka Asar (Impact)',
    approximateBadge: 'Sirf Andazan Anumaan (Approximate)',
    doctorDisclaimerTitle: 'Doctor Ki Salah Zaroori Hai',
    doctorDisclaimerBody:
      'Agar aapko ya kisi ko lagatar khansi, saans phoolna ya seene mein jalan ho, toh health concerns ke liye doctor se zaroor milein.',
    geoDeniedError:
      'Location permission nahi mili. Upar apna Indian city search karein ya AQI khud type karein.',
    geoUnsupportedError:
      'Is device par browser location uplabdh nahi hai. Shehar search karein ya AQI khud daalein.',
    cityNotFoundError:
      "Yeh village nahi mila. Google Maps kholein, apne village par long-press karke coordinates copy karein aur 'Enter lat & lon' use karein, ya nazdeeki town chunein.",
    apiFailedError:
      'Live Open-Meteo data abhi connect nahi ho paaya. Chinta mat karein—neeche apna AQI khud type karke aage badh sakte hain.',
    geminiErrorTitle: 'Aaj ka plan load nahi ho paaya',
    retryGenerateBtn: 'Dobara try karein',
  },
};
