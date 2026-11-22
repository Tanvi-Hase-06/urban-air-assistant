import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  buildAdviceCacheKey,
  getRiskCategoryFromAqi,
  validateAirQualityInputs,
} from './src/lib/aqi.ts';
import {
  buildAdvicePrompt,
  buildAdviceSystemInstruction,
} from './src/lib/prompt.ts';
import type {
  AdviceRequestPayload,
  GeminiAdviceResponse,
} from './src/types/airQuality.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const adviceResponseSchema = {
  type: Type.OBJECT,
  properties: {
    riskLevel: {
      type: Type.STRING,
      description:
        'Exact fixed US AQI category label provided in the prompt: one of Good, Moderate, Unhealthy for Sensitive Groups, Unhealthy, Very Unhealthy, or Hazardous.',
    },
    riskReason: {
      type: Type.STRING,
      description:
        'A concise 1-2 sentence explanation of why this risk level applies today given the AQI, PM2.5/PM10, and household.',
    },
    childrenPlayOutside: {
      type: Type.OBJECT,
      properties: {
        allowed: {
          type: Type.BOOLEAN,
          description:
            'Whether children should play outside today (true for Yes, false for No).',
        },
        decisionLabel: {
          type: Type.STRING,
          description:
            'Clear Yes or No label written in the requested language (e.g., "No — Keep Play Indoors" in English mode, or "Nahi — Bacchon ko ghar ke andar rakhein" / "Haan — Thodi der bahar khel sakte hain" in Hinglish mode).',
        },
        reason: {
          type: Type.STRING,
          description:
            'Practical reason explaining the Yes/No decision for children today.',
        },
      },
      required: ['allowed', 'decisionLabel', 'reason'],
    },
    dailyPlan: {
      type: Type.OBJECT,
      properties: {
        morning: {
          type: Type.OBJECT,
          properties: {
            timeWindow: { type: Type.STRING },
            actions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['timeWindow', 'actions'],
        },
        afternoon: {
          type: Type.OBJECT,
          properties: {
            timeWindow: { type: Type.STRING },
            actions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['timeWindow', 'actions'],
        },
        evening: {
          type: Type.OBJECT,
          properties: {
            timeWindow: { type: Type.STRING },
            actions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['timeWindow', 'actions'],
        },
      },
      required: ['morning', 'afternoon', 'evening'],
    },
    lowEmissionCommute: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        '3 to 4 practical low-emission commute alternatives or protective steps tailored to the user commute mode and city.',
    },
    indoorAirQualityActions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        '4 to 5 actionable indoor air quality steps tailored to whether the family has an air purifier, mask, children, seniors, or pets.',
    },
    citySustainableAlternatives: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        '3 to 4 realistic, city-appropriate sustainable habits and civic alternatives for Indian urban life.',
    },
    impactOfChoices: {
      type: Type.OBJECT,
      properties: {
        approximateNotice: {
          type: Type.STRING,
          description:
            'Explicit reminder that all numbers below are rough approximate educational estimates, not clinical or laboratory measurements.',
        },
        estimates: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              approximateValue: { type: Type.STRING },
              explanation: { type: Type.STRING },
            },
            required: ['title', 'approximateValue', 'explanation'],
          },
        },
      },
      required: ['approximateNotice', 'estimates'],
    },
    doctorNote: {
      type: Type.STRING,
      description:
        'Short reminder to consult a doctor for health concerns, breathing trouble, or pre-existing conditions.',
    },
  },
  required: [
    'riskLevel',
    'riskReason',
    'childrenPlayOutside',
    'dailyPlan',
    'lowEmissionCommute',
    'indoorAirQualityActions',
    'citySustainableAlternatives',
    'impactOfChoices',
    'doctorNote',
  ],
};

async function startServer() {
  const app = express();
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'geolocation=(self)');
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  const serverAdviceCache = new Map<string, GeminiAdviceResponse>();
  let hydrogenQuotaCooldownUntil = 0;

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/advice', async (req, res) => {
    const body = req.body as
      | (Partial<AdviceRequestPayload> & { forceRefresh?: boolean })
      | undefined;
    if (!body || !body.location || !body.airQuality || !body.profile) {
      res.status(400).json({
        error: 'Incomplete request payload. Please provide location, air quality, and profile details.',
      });
      return;
    }

    const language = body.language === 'hinglish' ? 'hinglish' : 'en';
    const validation = validateAirQualityInputs(
      {
        cityName: body.location.cityName ?? '',
        usAqi: body.airQuality.usAqi ?? null,
        pm25: body.airQuality.pm25 ?? null,
        pm10: body.airQuality.pm10 ?? null,
        userType: body.profile.userType ?? '',
        commuteType: body.profile.commuteType ?? '',
        household: Array.isArray(body.profile.household)
          ? body.profile.household
          : [],
      },
      language
    );

    if (!validation.valid) {
      res.status(400).json({
        error:
          Object.values(validation.errors)[0] ||
          'Please check your air quality and profile inputs.',
        fieldErrors: validation.errors,
      });
      return;
    }

    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          language === 'hinglish'
            ? 'Gemini API key abhi server par configure nahi hai. Kripya Settings > Secrets mein GEMINI_API_KEY check karein.'
            : 'Gemini API key is not configured on the server. Please check GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    const serverDateIso = new Date().toISOString().split('T')[0];
    const normalizedPayload: AdviceRequestPayload = {
      todayDate: body.todayDate || serverDateIso,
      todayReadable: body.todayReadable || new Date().toDateString(),
      language,
      location: body.location,
      airQuality: body.airQuality,
      profile: body.profile,
    };

    const cacheKey = buildAdviceCacheKey(normalizedPayload);
    if (!body.forceRefresh) {
      const cachedAdvice = serverAdviceCache.get(cacheKey);
      if (cachedAdvice) {
        res.type('application/json').json({ advice: cachedAdvice, cached: true });
        return;
      }
    }

    try {
      const promptText = buildAdvicePrompt(normalizedPayload, serverDateIso);
      const systemInstruction = buildAdviceSystemInstruction(language);

      const callModel = async (
        model: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite',
        thinkingLevel: ThinkingLevel,
        timeoutMs: number
      ) => {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([
            ai.models.generateContent({
              model,
              contents: promptText,
              config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: adviceResponseSchema,
                thinkingConfig: { thinkingLevel },
                abortSignal: controller.signal,
              },
            }),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => {
                controller.abort();
                reject(new Error('GEMINI_TIMEOUT'));
              }, timeoutMs);
            }),
          ]);
        } finally {
          if (timer !== undefined) clearTimeout(timer);
        }
      };

      const callFallbackWithRetry = async () => {
        try {
          return await callModel('gemini-3.1-flash-lite', ThinkingLevel.MINIMAL, 20000);
        } catch (fallbackErr: unknown) {
          const msg =
            fallbackErr instanceof Error
              ? fallbackErr.message.toLowerCase()
              : String(fallbackErr).toLowerCase();
          if (
            msg.includes('gemini_timeout') ||
            msg.includes('503') ||
            msg.includes('unavailable')
          ) {
            await new Promise((resolve) => setTimeout(resolve, 600));
            return await callModel(
              'gemini-3.1-flash-lite',
              ThinkingLevel.MINIMAL,
              20000
            );
          }
          throw fallbackErr;
        }
      };

      let response;
      const skipPrimaryForCooldown = Date.now() < hydrogenQuotaCooldownUntil;

      if (skipPrimaryForCooldown) {
        response = await callFallbackWithRetry();
      } else {
        try {
          response = await callModel('gemini-4-hydrogen', ThinkingLevel.LOW, 8000);
        } catch (primaryErr: unknown) {
          const primaryMsg =
            primaryErr instanceof Error
              ? primaryErr.message.toLowerCase()
              : String(primaryErr).toLowerCase();
          const isQuotaError =
            primaryMsg.includes('429') ||
            primaryMsg.includes('resource_exhausted') ||
            primaryMsg.includes('quota');
          const isTimeoutOrOverload =
            primaryMsg.includes('gemini_timeout') ||
            primaryMsg.includes('503') ||
            primaryMsg.includes('unavailable') ||
            primaryMsg.includes('high demand');

          if (isQuotaError) {
            hydrogenQuotaCooldownUntil = Date.now() + 10 * 60 * 1000;
          } else if (isTimeoutOrOverload) {
            hydrogenQuotaCooldownUntil = Date.now() + 5 * 60 * 1000;
          }

          if (isQuotaError || isTimeoutOrOverload) {
            console.warn(
              '[POST /api/advice] Primary model unavailable/timed out, falling back to gemini-3.1-flash-lite'
            );
            response = await callFallbackWithRetry();
          } else {
            throw primaryErr;
          }
        }
      }

      const rawText = response.text?.trim();
      if (!rawText) {
        res.status(502).type('application/json').json({
          error:
            language === 'hinglish'
              ? 'AI se khaali jawab aaya. Kripya ek baar phir try karein.'
              : 'Received an empty response while generating your plan. Please try again.',
        });
        return;
      }

      const parsed = JSON.parse(rawText) as GeminiAdviceResponse;
      const { level: fixedRiskLevel } = getRiskCategoryFromAqi(
        normalizedPayload.airQuality.usAqi
      );
      parsed.riskLevel = fixedRiskLevel;

      if (serverAdviceCache.size >= 250) {
        const oldestKey = serverAdviceCache.keys().next().value;
        if (oldestKey !== undefined) {
          serverAdviceCache.delete(oldestKey);
        }
      }
      serverAdviceCache.set(cacheKey, parsed);
      res.type('application/json').json({ advice: parsed });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const lower = message.toLowerCase();
      console.error('[POST /api/advice] Error:', message);

      if (lower.includes('gemini_timeout')) {
        res.status(504).type('application/json').json({
          error:
            language === 'hinglish'
              ? 'AI response mein thoda zyada samay lag raha hai. Kripya ek baar phir try karein.'
              : 'The AI service took too long to respond. Please try again in a moment.',
        });
        return;
      }

      if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
        res.status(429).type('application/json').json({
          error:
            language === 'hinglish'
              ? 'Abhi free-tier API quota limit poori ho gayi hai. Thodi der baad dobara try karein ya Settings > Secrets mein billing-enabled API key check karein.'
              : 'API quota limit reached right now. Please wait a moment and try again, or check your billing-enabled API key in Settings > Secrets.',
        });
        return;
      }

      if (lower.includes('503') || lower.includes('unavailable') || lower.includes('high demand')) {
        res.status(503).type('application/json').json({
          error:
            language === 'hinglish'
              ? 'AI service par abhi zyada traffic hai. Kripya kuch seconds baad dobara try karein.'
              : 'The AI service is temporarily experiencing high demand. Please wait a few seconds and try again.',
        });
        return;
      }

      if (
        lower.includes('403') ||
        lower.includes('api_key_invalid') ||
        lower.includes('permission_denied') ||
        lower.includes('insufficient')
      ) {
        res.status(502).type('application/json').json({
          error:
            language === 'hinglish'
              ? 'Gemini API key valid nahi lag rahi. Kripya Settings > Secrets mein API key check karein.'
              : 'Gemini API authentication failed. Please verify GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }

      if (lower.includes('404') || lower.includes('not_found')) {
        res.status(502).type('application/json').json({
          error:
            language === 'hinglish'
              ? 'Selected AI model abhi uplabdh nahi hai. Kripya thodi der mein dobara try karein.'
              : 'The configured Gemini model could not be reached right now. Please try again shortly.',
        });
        return;
      }

      res.status(500).type('application/json').json({
        error:
          language === 'hinglish'
            ? 'Plan banate samay temporary error aaya. Kripya thodi der mein dobara try karein.'
            : 'Something went wrong while generating your air quality plan. Please try again.',
      });
    }
  });

  // Guarantee all unmatched /api/* routes return JSON instead of falling through to SPA HTML
  app.use('/api', (_req, res) => {
    res.status(404).type('application/json').json({
      error: 'API endpoint not found.',
    });
  });

  // Guarantee Express body-parser or route errors on /api/* always return JSON
  app.use(
    (
      err: unknown,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (req.path.startsWith('/api')) {
        const status =
          typeof (err as { status?: number })?.status === 'number'
            ? (err as { status: number }).status
            : 500;
        const message =
          err instanceof Error && status < 500
            ? err.message
            : 'Invalid request or server error while processing API call.';
        res.status(status).type('application/json').json({ error: message });
        return;
      }
      next(err);
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Urban Air Quality Assistant running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
