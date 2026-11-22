export type LanguageMode = 'en' | 'hinglish';

export type HouseholdMember =
  | 'children'
  | 'seniors'
  | 'breathing_issues'
  | 'pets'
  | 'just_me'
  | 'general_skip';

export type UserType = 'working_professional' | 'student' | 'parent';

export type CommuteType =
  | 'metro_public_transit'
  | 'two_wheeler'
  | 'car_cab'
  | 'walking_cycling'
  | 'work_from_home';

export type DataSourceType =
  | 'Open-Meteo Air Quality API'
  | 'Manual Entry'
  | 'Sample Data (Demo)';

export type UsAqiCategoryLabel =
  | 'Good'
  | 'Moderate'
  | 'Unhealthy for Sensitive Groups'
  | 'Unhealthy'
  | 'Very Unhealthy'
  | 'Hazardous';

export type PlaceTypeLabel = 'City' | 'Town' | 'Village' | 'Landmark';

export interface CityLocation {
  cityName: string;
  area?: string;
  admin1?: string;
  district?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  isGeolocation?: boolean;
  placeType?: PlaceTypeLabel;
  isLandmark?: boolean;
}

export interface AirQualityReading {
  usAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  source: DataSourceType;
  timestamp: string;
}

export interface FamilyProfile {
  household: HouseholdMember[];
  userType: UserType;
  commuteType: CommuteType;
  hasMask: boolean;
  hasPurifier: boolean;
}

export interface AdviceRequestPayload {
  todayDate: string;
  todayReadable: string;
  language: LanguageMode;
  location: CityLocation;
  airQuality: {
    usAqi: number;
    pm25: number | null;
    pm10: number | null;
    categoryLabel?: UsAqiCategoryLabel;
    source: DataSourceType;
    timestamp: string;
  };
  profile: FamilyProfile;
}

export interface TimeSlotPlan {
  timeWindow: string;
  actions: string[];
}

export interface ImpactEstimate {
  title: string;
  approximateValue: string;
  explanation: string;
}

export interface GeminiAdviceResponse {
  riskLevel: UsAqiCategoryLabel | string;
  riskReason: string;
  childrenPlayOutside: {
    allowed: boolean;
    decisionLabel: string;
    reason: string;
  };
  dailyPlan: {
    morning: TimeSlotPlan;
    afternoon: TimeSlotPlan;
    evening: TimeSlotPlan;
  };
  lowEmissionCommute: string[];
  indoorAirQualityActions: string[];
  citySustainableAlternatives: string[];
  impactOfChoices: {
    approximateNotice: string;
    estimates: ImpactEstimate[];
  };
  doctorNote: string;
}
