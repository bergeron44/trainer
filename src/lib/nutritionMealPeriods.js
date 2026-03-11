import nutritionMealPeriods from '../../shared/nutritionMealPeriods.json';

export function normalizePeriodToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function clampMealCount(value, fallback = 5) {
  const parsed = Number.parseInt(value, 10);
  const normalized = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(6, Math.max(2, normalized));
}

export function getCanonicalMealPeriods(mealCount = 5) {
  const normalizedCount = clampMealCount(mealCount);
  return nutritionMealPeriods.canonicalByMealCount[String(normalizedCount)] || nutritionMealPeriods.canonicalByMealCount['5'];
}

function buildAliasLookup() {
  const lookup = new Map();

  Object.entries(nutritionMealPeriods.aliasesByCanonical || {}).forEach(([canonical, aliases]) => {
    [canonical, ...(Array.isArray(aliases) ? aliases : [])].forEach((variant) => {
      const key = normalizePeriodToken(variant);
      if (!key) return;
      const existing = lookup.get(key) || [];
      if (!existing.includes(canonical)) {
        lookup.set(key, [...existing, canonical]);
      }
    });
  });

  return lookup;
}

const aliasLookup = buildAliasLookup();

export function getCandidateMealPeriods(value, allowedPeriods = []) {
  const token = normalizePeriodToken(value);
  if (!token) return [];

  const allowed = Array.isArray(allowedPeriods) && allowedPeriods.length
    ? allowedPeriods
    : Array.from(new Set(Object.values(nutritionMealPeriods.canonicalByMealCount).flat()));
  const allowedSet = new Set(allowed);

  if (allowed.some((period) => normalizePeriodToken(period) === token)) {
    return allowed.filter((period) => normalizePeriodToken(period) === token);
  }

  const candidates = aliasLookup.get(token) || [];
  return candidates.filter((candidate) => allowedSet.has(candidate));
}

export function resolvePeriodFromValue(value, periods = []) {
  const token = normalizePeriodToken(value);
  if (!token || !Array.isArray(periods) || periods.length === 0) return null;

  const byId = periods.find((period) => normalizePeriodToken(period.id) === token);
  if (byId) return byId;

  const byLabel = periods.find((period) => normalizePeriodToken(period.label) === token);
  if (byLabel) return byLabel;

  const allowedLabels = periods.map((period) => period.label);
  const candidates = getCandidateMealPeriods(value, allowedLabels);
  if (!candidates.length) return null;

  return periods.find((period) => candidates.includes(period.label)) || null;
}

const PERIOD_SCHEDULES = {
  2: [13, 24],
  3: [11, 16, 24],
  4: [10, 14, 18, 24],
  5: [9, 12, 15, 19, 24],
  6: [9, 11, 14, 17, 21, 24],
};

export function getPeriodIndexForHour(hour, periodCount) {
  const normalizedHour = Math.min(23, Math.max(0, Number.parseInt(hour, 10) || 0));
  const schedule = PERIOD_SCHEDULES[clampMealCount(periodCount)];
  const index = schedule.findIndex((upperBound) => normalizedHour < upperBound);
  return index >= 0 ? index : schedule.length - 1;
}

export function resolvePeriodIdForDate(periods, date = new Date()) {
  if (!Array.isArray(periods) || periods.length === 0) return 'm1';
  const index = Math.min(
    periods.length - 1,
    getPeriodIndexForHour(new Date(date).getHours(), periods.length)
  );
  return periods[index]?.id || periods[0]?.id || 'm1';
}

export function resolvePeriodLabelForDate(periods, date = new Date()) {
  if (!Array.isArray(periods) || periods.length === 0) return '';
  const index = Math.min(
    periods.length - 1,
    getPeriodIndexForHour(new Date(date).getHours(), periods.length)
  );
  return periods[index]?.label || periods[0]?.label || '';
}

export function getImportMealPeriodOptions() {
  return Array.from(new Set([
    ...getCanonicalMealPeriods(4),
    ...getCanonicalMealPeriods(5),
    ...getCanonicalMealPeriods(6),
    ...getCanonicalMealPeriods(2),
    ...getCanonicalMealPeriods(3),
  ]));
}
