import {
  AlertCircle,
  Bike,
  CheckCircle2,
  Clock,
  Home,
  Leaf,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
  Sun,
  Sunrise,
  Sunset,
  XCircle,
} from 'lucide-react';
import {
  formatAccuracyReadable,
  formatPlaceDisplay,
  getRiskCategoryFromAqi,
} from '../lib/aqi';
import type { LocalizedStrings } from '../lib/i18n';
import type {
  AirQualityReading,
  CityLocation,
  GeminiAdviceResponse,
  LanguageMode,
} from '../types/airQuality';

export interface PlanSnapshot {
  location: CityLocation;
  reading: AirQualityReading;
  hasChildren: boolean;
}

interface AdvisoryReportProps {
  t: LocalizedStrings;
  language: LanguageMode;
  advice: GeminiAdviceResponse | null;
  snapshot: PlanSnapshot | null;
  isGenerating: boolean;
  error: string | null;
  wasCached: boolean;
  generatedAt: string | null;
  todayReadable: string;
  onRetry: () => void;
  onForceRefresh: () => void;
}

export function AdvisoryReport({
  t,
  language,
  advice,
  snapshot,
  isGenerating,
  error,
  wasCached,
  generatedAt,
  todayReadable,
  onRetry,
  onForceRefresh,
}: AdvisoryReportProps) {
  if (isGenerating) {
    return (
      <section
        id="advisory"
        role="status"
        aria-live="polite"
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-6"
      >
        <div className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-slate-900">
            {t.loadingTitle}
          </h2>
          <p className="text-sm text-slate-600">{t.loadingBody}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="h-44 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-44 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-44 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        id="advisory"
        role="alert"
        className="rounded-xl border border-red-200 bg-white p-6"
      >
        <div className="flex items-start gap-3">
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-red-700"
            aria-hidden="true"
          />
          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              {t.geminiErrorTitle}
            </h2>
            <p className="text-sm leading-relaxed text-slate-700">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>{t.retryGenerateBtn}</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!advice || !snapshot) {
    return (
      <section
        id="advisory"
        aria-labelledby="empty-advisory-heading"
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 sm:p-8"
      >
        <div>
          <h2
            id="empty-advisory-heading"
            className="font-display text-xl font-semibold text-slate-900"
          >
            {t.emptyTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            {t.emptyBody}
          </p>
        </div>

        <ul className="space-y-3 border-t border-slate-200 pt-5 text-sm text-slate-700">
          {t.emptyChecklist.map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-teal-700"
                aria-hidden="true"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
          <Stethoscope
            className="mt-0.5 h-4 w-4 shrink-0 text-slate-600"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold text-slate-900">
              {t.doctorDisclaimerTitle}
            </p>
            <p className="mt-1 leading-relaxed">{t.doctorDisclaimerBody}</p>
          </div>
        </div>
      </section>
    );
  }

  const { level: fixedRiskLabel, info: categoryInfo } = getRiskCategoryFromAqi(
    snapshot.reading.usAqi
  );
  const placeName = formatPlaceDisplay(snapshot.location, language);
  const readableAccuracy = formatAccuracyReadable(snapshot.location.accuracyMeters);

  return (
    <div id="advisory" className="space-y-6" aria-live="polite">
      {/* Unboxed generation metadata & cache indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-slate-700">
            {wasCached ? t.cachedLabel : t.freshLabel}
          </span>
          <span aria-hidden="true">·</span>
          <span>{todayReadable}</span>
          {generatedAt && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{generatedAt}</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onForceRefresh}
          className="inline-flex min-h-[36px] items-center gap-1.5 font-semibold text-teal-800 hover:text-teal-950 hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t.regenerateBtn}</span>
        </button>
      </div>

      {/* Compact Telemetry Snapshot Card at top of generated plan */}
      <section
        aria-label={t.snapshotTitle}
        className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`h-3 w-3 shrink-0 rounded-full ${categoryInfo.swatchClass}`}
            />
            <h2 className="font-display text-sm font-semibold text-slate-900">
              {placeName}
            </h2>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-semibold ${categoryInfo.bgClass} ${categoryInfo.borderClass} ${categoryInfo.textClass}`}
          >
            <span aria-hidden="true">{categoryInfo.glyph}</span>
            <span>{fixedRiskLabel}</span>
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3 border-y border-slate-100 py-2.5">
          <div>
            <p className="text-xs text-slate-500">US AQI</p>
            <p className="font-mono text-lg font-semibold tabular-nums text-slate-900">
              {snapshot.reading.usAqi ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">PM2.5</p>
            <p className="font-mono text-lg font-semibold tabular-nums text-slate-900">
              {snapshot.reading.pm25 ?? '—'}
              <span className="ml-1 text-xs font-normal text-slate-500">
                µg/m³
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">PM10</p>
            <p className="font-mono text-lg font-semibold tabular-nums text-slate-900">
              {snapshot.reading.pm10 ?? '—'}
              <span className="ml-1 text-xs font-normal text-slate-500">
                µg/m³
              </span>
            </p>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span>
            {t.sourceLabel}: {snapshot.reading.source}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            {t.updatedLabel}: {snapshot.reading.timestamp}
          </span>
          {readableAccuracy && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {t.accuracyLabel}: ±{readableAccuracy}
              </span>
            </>
          )}
        </div>
      </section>

      {/* Top Decision Pair: Fixed Risk Level + Conditional Children/Adult Outdoor Card */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <article
          className={`rounded-xl border p-5 ${categoryInfo.borderClass} ${categoryInfo.bgClass}`}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
              {t.riskCardTitle}
            </h2>
            <ShieldAlert
              className={`h-4 w-4 ${categoryInfo.textClass}`}
              aria-hidden="true"
            />
          </div>
          <p
            className={`mt-2 font-display text-2xl font-bold ${categoryInfo.textClass}`}
          >
            <span aria-hidden="true" className="mr-2">
              {categoryInfo.glyph}
            </span>
            {fixedRiskLabel}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-800">
            {advice.riskReason}
          </p>
        </article>

        <article
          className={`rounded-xl border p-5 ${
            advice.childrenPlayOutside.allowed
              ? 'border-emerald-200 bg-emerald-50/70'
              : 'border-rose-200 bg-rose-50/70'
          }`}
        >
          <h2 className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
            {snapshot.hasChildren ? t.childrenPlayTitle : t.adultOutdoorTitle}
          </h2>
          <div className="mt-2 flex items-center gap-2">
            {advice.childrenPlayOutside.allowed ? (
              <CheckCircle2
                className="h-6 w-6 shrink-0 text-emerald-700"
                aria-hidden="true"
              />
            ) : (
              <XCircle
                className="h-6 w-6 shrink-0 text-rose-700"
                aria-hidden="true"
              />
            )}
            <p
              className={`font-display text-xl font-bold ${
                advice.childrenPlayOutside.allowed
                  ? 'text-emerald-900'
                  : 'text-rose-950'
              }`}
            >
              {advice.childrenPlayOutside.decisionLabel}
            </p>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-800">
            {advice.childrenPlayOutside.reason}
          </p>
        </article>
      </div>

      {/* Morning, Afternoon & Evening Plan */}
      <section
        aria-labelledby="daily-plan-heading"
        className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
      >
        <h2
          id="daily-plan-heading"
          className="font-display text-lg font-semibold text-slate-900"
        >
          {t.dailyPlanTitle}
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            {
              key: 'morning',
              label: t.morningLabel,
              icon: Sunrise,
              slot: advice.dailyPlan.morning,
            },
            {
              key: 'afternoon',
              label: t.afternoonLabel,
              icon: Sun,
              slot: advice.dailyPlan.afternoon,
            },
            {
              key: 'evening',
              label: t.eveningLabel,
              icon: Sunset,
              slot: advice.dailyPlan.evening,
            },
          ].map(({ key, label, icon: Icon, slot }) => (
            <div
              key={key}
              className="border-t border-slate-200 pt-4 md:border-t-0 md:border-r md:pr-4 md:pt-0 last:md:border-r-0 last:md:pr-0"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-teal-700" aria-hidden="true" />
                <h3 className="font-display text-base font-semibold text-slate-900">
                  {label}
                </h3>
              </div>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-xs tabular-nums text-slate-500">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{slot.timeWindow}</span>
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
                {slot.actions.map((action, idx) => (
                  <li key={`${key}-${idx}`} className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400"
                    />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Low-Emission Commute & Indoor Air Actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section
          aria-labelledby="commute-alt-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
        >
          <div className="flex items-center gap-2">
            <Bike className="h-4 w-4 text-teal-700" aria-hidden="true" />
            <h2
              id="commute-alt-heading"
              className="font-display text-lg font-semibold text-slate-900"
            >
              {t.commuteAlternativesTitle}
            </h2>
          </div>
          <ul className="mt-3.5 space-y-2.5 text-sm leading-relaxed text-slate-700">
            {advice.lowEmissionCommute.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="font-mono text-xs font-semibold tabular-nums text-teal-800">
                  0{idx + 1}.
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="indoor-actions-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
        >
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4 text-teal-700" aria-hidden="true" />
            <h2
              id="indoor-actions-heading"
              className="font-display text-lg font-semibold text-slate-900"
            >
              {t.indoorActionsTitle}
            </h2>
          </div>
          <ul className="mt-3.5 space-y-2.5 text-sm leading-relaxed text-slate-700">
            {advice.indoorAirQualityActions.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="font-mono text-xs font-semibold tabular-nums text-teal-800">
                  0{idx + 1}.
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Sustainable City Alternatives */}
      <section
        aria-labelledby="city-sustainable-heading"
        className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
      >
        <div className="flex items-center gap-2">
          <Leaf className="h-4 w-4 text-teal-700" aria-hidden="true" />
          <h2
            id="city-sustainable-heading"
            className="font-display text-lg font-semibold text-slate-900"
          >
            {t.cityAlternativesTitle}
          </h2>
        </div>
        <ul className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm leading-relaxed text-slate-700">
          {advice.citySustainableAlternatives.map((item, idx) => (
            <li
              key={idx}
              className="border-t border-slate-100 pt-2.5 sm:border-t-0 sm:pt-0"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* Impact of Your Choices (Marked Approximate) */}
      <section
        id="impact"
        aria-labelledby="impact-heading"
        className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="impact-heading"
            className="font-display text-lg font-semibold text-slate-900"
          >
            {t.impactTitle}
          </h2>
          <span className="text-xs font-semibold text-amber-800">
            {t.approximateBadge}
          </span>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          {advice.impactOfChoices.approximateNotice}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 sm:grid-cols-3">
          {advice.impactOfChoices.estimates.map((est, idx) => (
            <div key={idx} className="space-y-1">
              <p className="text-xs font-medium text-slate-500">{est.title}</p>
              <p className="font-mono text-lg font-semibold tabular-nums text-teal-800">
                {est.approximateValue}
              </p>
              <p className="text-xs leading-relaxed text-slate-600">
                {est.explanation}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Medical & Health Disclaimer */}
      <aside
        aria-label={t.doctorDisclaimerTitle}
        className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700"
      >
        <Stethoscope
          className="mt-0.5 h-4 w-4 shrink-0 text-slate-700"
          aria-hidden="true"
        />
        <div>
          <p className="font-semibold text-slate-900">
            {t.doctorDisclaimerTitle}
          </p>
          <p className="mt-1 leading-relaxed">
            {advice.doctorNote || t.doctorDisclaimerBody}
          </p>
        </div>
      </aside>
    </div>
  );
}
