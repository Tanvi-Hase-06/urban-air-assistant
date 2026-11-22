import {
  formatAccuracyReadable,
  formatPlaceDisplay,
  getRiskCategoryFromAqi,
  isLowLocationAccuracy,
} from './aqi.ts';
import type { AdviceRequestPayload, LanguageMode } from '../types/airQuality.ts';

export function buildAdviceSystemInstruction(language: LanguageMode): string {
  if (language === 'hinglish') {
    return [
      'You are a careful, practical urban air-quality and public-health advisor for Indian families and adults during winter smog season.',
      'Return strict valid JSON matching the schema.',
      'LANGUAGE RULE (STRICT): Every single advice sentence across riskReason, childrenPlayOutside.decisionLabel, childrenPlayOutside.reason, dailyPlan.morning/afternoon/evening.actions, lowEmissionCommute, indoorAirQualityActions, citySustainableAlternatives, impactOfChoices.approximateNotice, impactOfChoices.estimates[].title, impactOfChoices.estimates[].explanation, and doctorNote MUST be written in natural Hinglish (Hindi in Roman/Latin script; numbers, units, and common terms like AQI, PM2.5, N95, HEPA, metro can stay as-is).',
      'Do NOT write full English sentences anywhere in those fields.',
      'RISK LEVEL RULE: You will be given the exact fixed US AQI category label in the prompt. Set riskLevel to that exact string and do NOT alter or override it; only explain the reason in riskReason.',
      'SENSITIVE GROUP RULE: Never mention children, seniors/elderly, breathing issues/asthma/COPD, or pets unless they are explicitly listed in the selected household members.',
      'Keep each bullet concise (1 short sentence).',
      'Never invent live measurements that contradict the provided telemetry, and always mark impact estimates as approximate.',
    ].join(' ');
  }

  return [
    'You are a careful, practical urban air-quality and public-health advisor for Indian families and adults during winter smog season.',
    'Return strict valid JSON matching the schema.',
    'LANGUAGE RULE (STRICT): Every single advice sentence across riskReason, childrenPlayOutside.decisionLabel, childrenPlayOutside.reason, dailyPlan.morning/afternoon/evening.actions, lowEmissionCommute, indoorAirQualityActions, citySustainableAlternatives, impactOfChoices.approximateNotice, impactOfChoices.estimates[].title, impactOfChoices.estimates[].explanation, and doctorNote MUST be written strictly in clear, practical English.',
    'RISK LEVEL RULE: You will be given the exact fixed US AQI category label in the prompt. Set riskLevel to that exact string and do NOT alter or override it; only explain the reason in riskReason.',
    'SENSITIVE GROUP RULE: Never mention children, seniors/elderly, breathing issues/asthma/COPD, or pets unless they are explicitly listed in the selected household members.',
    'Keep each bullet concise (1 short sentence).',
    'Never invent live measurements that contradict the provided telemetry, and always mark impact estimates as approximate.',
  ].join(' ');
}

export function buildAdvicePrompt(
  payload: AdviceRequestPayload,
  serverDateIso: string
): string {
  const isHinglish = payload.language === 'hinglish';
  const { level: fixedRiskCategory } = getRiskCategoryFromAqi(
    payload.airQuality.usAqi
  );

  const selected = payload.profile.household;
  const hasChildren = selected.includes('children');
  const hasSeniors = selected.includes('seniors');
  const hasBreathing = selected.includes('breathing_issues');
  const hasPets = selected.includes('pets');
  const isJustMe = selected.includes('just_me');
  const isGeneralSkip = selected.includes('general_skip') || selected.length === 0;

  const excludedGroups: string[] = [];
  if (!hasChildren) excludedGroups.push('children / kids / bacche');
  if (!hasSeniors) excludedGroups.push('seniors / elderly / buzurg');
  if (!hasBreathing)
    excludedGroups.push('people with breathing issues / asthma / COPD / saans ke mareez');
  if (!hasPets) excludedGroups.push('pets / animals');

  const householdDescription = isJustMe
    ? 'Just me (one adult only — no children, no seniors, no breathing issues, no pets)'
    : isGeneralSkip
      ? 'General urban adult household (skip specific vulnerable groups — do not assume children, seniors, or breathing issues)'
      : selected.join(', ');

  const exclusionRule =
    excludedGroups.length > 0
      ? `STRICT EXCLUSION RULE: The user did NOT select ${excludedGroups.join(', ')}. Do NOT mention, refer to, or give advice for ${excludedGroups.join(', ')} anywhere in any field of the JSON response.`
      : 'All listed household groups were selected by the user.';

  const outdoorFieldRule = hasChildren
    ? 'OUTDOOR FIELD RULE (children selected): Populate childrenPlayOutside as "Should children play outside today?" (allowed: boolean, decisionLabel: clear Yes/No for children, reason: why children should or should not play outside today).'
    : 'OUTDOOR FIELD RULE (no children selected): Populate childrenPlayOutside with GENERAL OUTDOOR ACTIVITY ADVICE FOR ADULTS ONLY (allowed: boolean indicating whether normal outdoor exercise/walks are advisable for adults, decisionLabel: clear adult outdoor activity verdict, reason: adult-focused reason). Do NOT mention children anywhere in childrenPlayOutside.';

  const languageDirective = isHinglish
    ? [
        'STRICT HINGLISH LANGUAGE INSTRUCTION: Write EVERY advice sentence in the JSON response (riskReason, childrenPlayOutside.decisionLabel, childrenPlayOutside.reason, dailyPlan.morning/afternoon/evening.actions, lowEmissionCommute, indoorAirQualityActions, citySustainableAlternatives, impactOfChoices.approximateNotice, impactOfChoices.estimates[].title, impactOfChoices.estimates[].explanation, and doctorNote) in natural Hinglish (Hindi in Roman script), NOT full English sentences.',
        'Numbers and units (such as 6:00 AM - 9:30 AM, ~30-40%, 250 µg/m³) can stay the same.',
        hasChildren
          ? 'Example Hinglish decisionLabel: "Nahi — Bacchon ko ghar ke andar hi rakhein" or "Haan — Dopahar mein thodi der bahar khel sakte hain".'
          : 'Example Hinglish decisionLabel: "Nahi — Aaj bahar heavy exercise avoid karein" or "Haan — Dopahar mein halka walk safe hai".',
        'Example Hinglish advice: "Subah 6:00 AM - 9:30 AM ke beech khidkiyan band rakhein kyunki sardi ka smog neeche jama rehta hai."',
      ].join(' ')
    : [
        'STRICT ENGLISH LANGUAGE INSTRUCTION: Write EVERY advice sentence in the JSON response (riskReason, childrenPlayOutside.decisionLabel, childrenPlayOutside.reason, dailyPlan.morning/afternoon/evening.actions, lowEmissionCommute, indoorAirQualityActions, citySustainableAlternatives, impactOfChoices.approximateNotice, impactOfChoices.estimates[].title, impactOfChoices.estimates[].explanation, and doctorNote) strictly in clear, warm, practical English.',
      ].join(' ');

  const placeDisplay = formatPlaceDisplay(payload.location, 'en');
  const readableAcc = formatAccuracyReadable(payload.location.accuracyMeters);
  const lowAccuracyNote =
    payload.location.isGeolocation &&
    isLowLocationAccuracy(payload.location.accuracyMeters) &&
    readableAcc
      ? ` (coarse device approximation, ±${readableAcc}; do not treat as an exact street/town)`
      : '';

  return [
    `Today's real date (user local): ${payload.todayDate} (${payload.todayReadable}).`,
    `Server UTC date reference: ${serverDateIso}.`,
    '',
    'Exact Location & Live Air Quality Telemetry:',
    `- Location: ${placeDisplay}${lowAccuracyNote}`,
    payload.location.latitude !== undefined && payload.location.longitude !== undefined
      ? `- Coordinates: ${payload.location.latitude.toFixed(4)}, ${payload.location.longitude.toFixed(4)}`
      : '- Coordinates: not provided',
    `- Current US AQI: ${payload.airQuality.usAqi}`,
    `- Fixed US AQI Risk Category (DO NOT CHANGE): ${fixedRiskCategory}`,
    `- PM2.5: ${payload.airQuality.pm25 !== null ? `${payload.airQuality.pm25} µg/m³` : 'Not available'}`,
    `- PM10: ${payload.airQuality.pm10 !== null ? `${payload.airQuality.pm10} µg/m³` : 'Not available'}`,
    `- Telemetry Source: ${payload.airQuality.source}`,
    `- Telemetry Timestamp: ${payload.airQuality.timestamp}`,
    '',
    'Exact Household & Lifestyle Form Values:',
    `- Household selection: ${householdDescription}`,
    `- User role: ${payload.profile.userType}`,
    `- Primary commute type: ${payload.profile.commuteType}`,
    `- Has N95/N99 mask: ${payload.profile.hasMask ? 'Yes' : 'No'}`,
    `- Has indoor air purifier: ${payload.profile.hasPurifier ? 'Yes' : 'No'}`,
    '',
    'Instructions:',
    `FIXED RISK LEVEL FACT: Set riskLevel strictly to "${fixedRiskCategory}". Do not change, rename, or downgrade/upgrade this category label; only explain why this US AQI level poses that risk in riskReason.`,
    exclusionRule,
    outdoorFieldRule,
    languageDirective,
    'Account for Indian winter meteorological patterns (early morning & late evening thermal inversion trapping smog near ground level, slightly better midday dispersion between roughly 12:30 PM and 4:00 PM when applicable, cooking tadka/incense/agarbatti/dhoop smoke indoors, and traffic corridor exposure).',
    'Tailor every section directly to the exact selected household members, user role, commute type, and mask/purifier availability.',
    'In impactOfChoices, provide 3 concrete approximate estimates (clearly prefixed with "~" or "Approx." and explicitly marked as approximate estimates in approximateNotice).',
    'Include a concise doctorNote reminding the user to consult a doctor for any health concerns.',
  ].join('\n');
}
