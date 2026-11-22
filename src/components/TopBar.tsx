import type { LocalizedStrings } from '../lib/i18n';

interface TopBarProps {
  t: LocalizedStrings;
  onLoadSample: () => void;
}

export function TopBar({ t, onLoadSample }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        <a
          href="#top"
          className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 sm:text-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
        >
          {t.brandTitle}
        </a>

        <nav
          aria-label="Primary sections"
          className="hidden items-center gap-6 text-sm font-medium text-slate-600 lg:flex"
        >
          <a
            href="#telemetry"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
          >
            {t.navTelemetry}
          </a>
          <a
            href="#profile"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
          >
            {t.navProfile}
          </a>
          <a
            href="#advisory"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
          >
            {t.navAdvisory}
          </a>
          <a
            href="#impact"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
          >
            {t.navImpact}
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onLoadSample}
            className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 whitespace-nowrap shrink-0 transition-colors hover:bg-slate-50 hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            {t.navActionSample}
          </button>
        </div>
      </div>
    </header>
  );
}
