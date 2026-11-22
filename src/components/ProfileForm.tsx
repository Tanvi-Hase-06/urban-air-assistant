import type { FormEvent } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import {
  VALID_COMMUTE_TYPES,
  VALID_HOUSEHOLD_MEMBERS,
  VALID_USER_TYPES,
} from '../lib/aqi';
import type { LocalizedStrings } from '../lib/i18n';
import type {
  CommuteType,
  FamilyProfile,
  HouseholdMember,
  UserType,
} from '../types/airQuality';

interface ProfileFormProps {
  t: LocalizedStrings;
  profile: FamilyProfile;
  validationErrors: Record<string, string>;
  isGenerating: boolean;
  onChangeProfile: (next: FamilyProfile) => void;
  onSubmitPlan: () => void;
}

export function ProfileForm({
  t,
  profile,
  validationErrors,
  isGenerating,
  onChangeProfile,
  onSubmitPlan,
}: ProfileFormProps) {
  const toggleHousehold = (member: HouseholdMember) => {
    const exists = profile.household.includes(member);

    if (member === 'just_me' || member === 'general_skip') {
      const nextHousehold: HouseholdMember[] = exists ? [] : [member];
      onChangeProfile({ ...profile, household: nextHousehold });
      return;
    }

    const withoutExclusive = profile.household.filter(
      (m) => m !== 'just_me' && m !== 'general_skip'
    );
    const nextHousehold = exists
      ? withoutExclusive.filter((m) => m !== member)
      : [...withoutExclusive, member];
    onChangeProfile({ ...profile, household: nextHousehold });
  };

  const setUserType = (userType: UserType) => {
    onChangeProfile({ ...profile, userType });
  };

  const setCommuteType = (commuteType: CommuteType) => {
    onChangeProfile({ ...profile, commuteType });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmitPlan();
  };

  return (
    <section
      id="profile"
      aria-labelledby="profile-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
    >
      <h2
        id="profile-heading"
        className="font-display text-lg font-semibold text-slate-900"
      >
        {t.profileSectionTitle}
      </h2>

      <form onSubmit={handleSubmit} className="mt-4 space-y-6">
        {/* Household members */}
        <fieldset>
          <legend className="text-sm font-medium text-slate-800">
            {t.householdLabel}
          </legend>
          <p className="mt-1 text-xs text-slate-500">{t.householdHint}</p>
          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {VALID_HOUSEHOLD_MEMBERS.map((member) => {
              const checked = profile.household.includes(member);
              return (
                <label
                  key={member}
                  className={`flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    checked
                      ? 'border-teal-700 bg-teal-50/70 font-medium text-teal-950'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleHousehold(member)}
                    className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                  />
                  <span>{t.householdOptions[member]}</span>
                </label>
              );
            })}
          </div>
          {validationErrors.household && (
            <p role="alert" className="mt-1.5 text-xs text-red-700">
              {validationErrors.household}
            </p>
          )}
        </fieldset>

        {/* User Type */}
        <fieldset>
          <legend className="text-sm font-medium text-slate-800">
            {t.userTypeLabel}
          </legend>
          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {VALID_USER_TYPES.map((role) => {
              const selected = profile.userType === role;
              return (
                <label
                  key={role}
                  className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-center text-xs font-medium transition-colors ${
                    selected
                      ? 'border-teal-700 bg-teal-50 text-teal-950 font-semibold'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="userType"
                    value={role}
                    checked={selected}
                    onChange={() => setUserType(role)}
                    className="sr-only"
                  />
                  <span>{t.userTypeOptions[role]}</span>
                </label>
              );
            })}
          </div>
          {validationErrors.userType && (
            <p role="alert" className="mt-1.5 text-xs text-red-700">
              {validationErrors.userType}
            </p>
          )}
        </fieldset>

        {/* Commute Type */}
        <fieldset>
          <legend className="text-sm font-medium text-slate-800">
            {t.commuteLabel}
          </legend>
          <div className="mt-2.5 grid grid-cols-1 gap-2">
            {VALID_COMMUTE_TYPES.map((commute) => {
              const selected = profile.commuteType === commute;
              return (
                <label
                  key={commute}
                  className={`flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-2 text-sm transition-colors ${
                    selected
                      ? 'border-teal-700 bg-teal-50/70 font-medium text-teal-950'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="commuteType"
                    value={commute}
                    checked={selected}
                    onChange={() => setCommuteType(commute)}
                    className="h-4 w-4 border-slate-300 text-teal-700 focus:ring-teal-700"
                  />
                  <span>{t.commuteOptions[commute]}</span>
                </label>
              );
            })}
          </div>
          {validationErrors.commuteType && (
            <p role="alert" className="mt-1.5 text-xs text-red-700">
              {validationErrors.commuteType}
            </p>
          )}
        </fieldset>

        {/* Protection gear */}
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <p className="text-sm font-medium text-slate-800">{t.gearLabel}</p>

          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-700">{t.hasMaskLabel}</span>
            <div
              role="group"
              aria-label={t.hasMaskLabel}
              className="inline-flex rounded-lg bg-slate-100 p-1"
            >
              <button
                type="button"
                onClick={() => onChangeProfile({ ...profile, hasMask: true })}
                className={`min-h-[36px] rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  profile.hasMask
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.yesLabel}
              </button>
              <button
                type="button"
                onClick={() => onChangeProfile({ ...profile, hasMask: false })}
                className={`min-h-[36px] rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  !profile.hasMask
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.noLabel}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-700">{t.hasPurifierLabel}</span>
            <div
              role="group"
              aria-label={t.hasPurifierLabel}
              className="inline-flex rounded-lg bg-slate-100 p-1"
            >
              <button
                type="button"
                onClick={() =>
                  onChangeProfile({ ...profile, hasPurifier: true })
                }
                className={`min-h-[36px] rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  profile.hasPurifier
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.yesLabel}
              </button>
              <button
                type="button"
                onClick={() =>
                  onChangeProfile({ ...profile, hasPurifier: false })
                }
                className={`min-h-[36px] rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  !profile.hasPurifier
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.noLabel}
              </button>
            </div>
          </div>
        </div>

        {/* Single primary CTA */}
        <button
          type="submit"
          disabled={isGenerating}
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>{t.generatingBtn}</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>{t.generateBtn}</span>
            </>
          )}
        </button>
      </form>
    </section>
  );
}
