/**
 * Sveltia CMS (i18n structure `single_file`) saves one block per locale:
 *
 *   { "en": { "title": "…", "date": "…" }, "fr": { "title": "…" } }
 *
 * The site reads one value per field instead: `title: { en, fr }`. This turns
 * the first shape into the second. A value that is the same in every locale, or
 * present only in the default locale, stays a plain value, so dates, numbers and
 * slugs come through unchanged and a missing translation falls back.
 *
 * Plain JavaScript so build scripts and checks can import it too.
 */

export const LOCALES = ["en", "kn"]; // default locale first
const DEFAULT = LOCALES[0];

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True for a file in the per-locale shape. */
export function isLocaleFile(value) {
  return isRecord(value) && isRecord(value[DEFAULT]) && Object.keys(value).every((key) => LOCALES.includes(key));
}

function merge(values) {
  const present = Object.entries(values).filter(([, v]) => v !== undefined && v !== null);
  if (present.length === 0) return values[DEFAULT];
  const base = values[DEFAULT];
  if (present.every(([, v]) => typeof v === "string")) {
    const distinct = new Set(present.map(([, v]) => v));
    return distinct.size === 1 && typeof base === "string" ? base : Object.fromEntries(present);
  }
  if (Array.isArray(base)) {
    return base.map((_, index) =>
      merge(Object.fromEntries(present.map(([l, v]) => [l, Array.isArray(v) ? v[index] : undefined]))),
    );
  }
  if (isRecord(base)) {
    const keys = new Set(present.flatMap(([, v]) => (isRecord(v) ? Object.keys(v) : [])));
    const out = {};
    for (const key of keys) {
      out[key] = merge(Object.fromEntries(present.map(([l, v]) => [l, isRecord(v) ? v[key] : undefined])));
    }
    return out;
  }
  return base;
}

/** A content file in the per-field shape, whichever shape it was saved in. */
export function mergeLocales(value) {
  return isLocaleFile(value) ? merge(Object.fromEntries(LOCALES.map((l) => [l, value[l]]))) : value;
}
