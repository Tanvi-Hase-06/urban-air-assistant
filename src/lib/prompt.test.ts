import { describe, expect, it } from 'vitest';
import {
  buildAdvicePrompt,
  buildAdviceSystemInstruction,
} from './prompt';
import type { AdviceRequestPayload } from '../types/airQuality';

const samplePayload: AdviceRequestPayload = {
  todayDate: '2026-11-21',
  todayReadable: 'Saturday, 21 November 2026',
  language: 'hinglish',
  location: {
    cityName: 'New Delhi',
    admin1: 'Delhi NCR',
    latitude: 28.6139,
    longitude: 77.209,
  },
  airQuality: {
    usAqi: 342,
    pm25: 218.5,
    pm10: 315.0,
    source: 'Sample Data (Demo)',
    timestamp: '21 Nov 2026, 3:00 pm',
  },
  profile: {
    household: ['children', 'seniors'],
    userType: 'parent',
    commuteType: 'metro_public_transit',
    hasMask: true,
    hasPurifier: false,
  },
};

describe('buildAdvicePrompt and buildAdviceSystemInstruction', () => {
  it('sends strict Hinglish instructions covering all advice fields when language is hinglish', () => {
    const prompt = buildAdvicePrompt(samplePayload, '2026-11-21');
    const systemInstruction = buildAdviceSystemInstruction('hinglish');

    expect(prompt).toContain('STRICT HINGLISH LANGUAGE INSTRUCTION');
    expect(prompt).toContain('Hindi in Roman script');
    expect(prompt).toContain('NOT full English sentences');
    expect(prompt).toContain('riskReason');
    expect(prompt).toContain('childrenPlayOutside.reason');
    expect(prompt).toContain('dailyPlan.morning/afternoon/evening.actions');
    expect(prompt).toContain('lowEmissionCommute');
    expect(prompt).toContain('indoorAirQualityActions');
    expect(prompt).toContain('citySustainableAlternatives');
    expect(prompt).toContain('impactOfChoices.estimates[].explanation');
    expect(prompt).toContain('doctorNote');

    expect(systemInstruction).toContain('natural Hinglish');
    expect(systemInstruction).toContain('Do NOT write full English sentences');
  });

  it('sends strict English instructions when language is en', () => {
    const englishPayload: AdviceRequestPayload = {
      ...samplePayload,
      language: 'en',
    };
    const prompt = buildAdvicePrompt(englishPayload, '2026-11-21');
    const systemInstruction = buildAdviceSystemInstruction('en');

    expect(prompt).toContain('STRICT ENGLISH LANGUAGE INSTRUCTION');
    expect(prompt).not.toContain('STRICT HINGLISH LANGUAGE INSTRUCTION');
    expect(systemInstruction).toContain('clear, practical English');
    expect(systemInstruction).not.toContain('natural Hinglish');
  });

  it('includes today date, fixed US AQI risk category, and exact form telemetry values in the prompt', () => {
    const prompt = buildAdvicePrompt(samplePayload, '2026-11-21');

    expect(prompt).toContain('2026-11-21');
    expect(prompt).toContain('New Delhi');
    expect(prompt).toContain('Current US AQI: 342');
    expect(prompt).toContain('Fixed US AQI Risk Category (DO NOT CHANGE): Hazardous');
    expect(prompt).toContain('PM2.5: 218.5 µg/m³');
    expect(prompt).toContain('PM10: 315 µg/m³');
    expect(prompt).toContain('children, seniors');
    expect(prompt).toContain('metro_public_transit');
  });

  it('forbids mentioning children, seniors, or breathing issues and switches to adult outdoor advice for Just me household', () => {
    const justMePayload: AdviceRequestPayload = {
      ...samplePayload,
      language: 'en',
      airQuality: {
        ...samplePayload.airQuality,
        usAqi: 135,
      },
      profile: {
        household: ['just_me'],
        userType: 'working_professional',
        commuteType: 'two_wheeler',
        hasMask: true,
        hasPurifier: false,
      },
    };

    const prompt = buildAdvicePrompt(justMePayload, '2026-11-21');

    expect(prompt).toContain('Just me (one adult only');
    expect(prompt).toContain('Fixed US AQI Risk Category (DO NOT CHANGE): Unhealthy for Sensitive Groups');
    expect(prompt).toContain('STRICT EXCLUSION RULE');
    expect(prompt).toContain('children / kids / bacche');
    expect(prompt).toContain('seniors / elderly / buzurg');
    expect(prompt).toContain('people with breathing issues / asthma / COPD');
    expect(prompt).toContain('GENERAL OUTDOOR ACTIVITY ADVICE FOR ADULTS ONLY');
    expect(prompt).toContain('Do NOT mention children anywhere in childrenPlayOutside');
  });
});
