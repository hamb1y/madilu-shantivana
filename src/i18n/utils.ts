import { dictionaries, type UIKey } from "./ui";
import type { Locale, Localized } from "../data/load";

export const defaultLocale: Locale = "en";
export const locales: Locale[] = ["en", "kn"];

/**
 * Interface text for a key, with `{placeholders}` filled from `vars`. A key
 * missing in Kannada falls back to English.
 */
export function t(lang: Locale, key: UIKey, vars: Record<string, string | number> = {}): string {
  const text = dictionaries[lang][key] ?? dictionaries[defaultLocale][key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** A content field that may be localised; a missing translation falls back to English. */
export function lx(value: Localized | undefined, lang: Locale): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  return value[lang] ?? value[defaultLocale] ?? "";
}

/** Build a path for the given locale. English is unprefixed. */
export function localePath(path: string, lang: Locale): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (lang === defaultLocale) return clean;
  return clean === "/" ? `/${lang}/` : `/${lang}${clean}`;
}

const MONTHS: Record<Locale, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  kn: ["ಜನವರಿ", "ಫೆಬ್ರವರಿ", "ಮಾರ್ಚ್", "ಏಪ್ರಿಲ್", "ಮೇ", "ಜೂನ್", "ಜುಲೈ", "ಆಗಸ್ಟ್", "ಸೆಪ್ಟೆಂಬರ್", "ಅಕ್ಟೋಬರ್", "ನವೆಂಬರ್", "ಡಿಸೆಂಬರ್"],
};

/** "16 June 2024" from "2024-06-16"; "June 2024" from "2024-06". */
export function formatDate(value: string, lang: Locale): string {
  const [year, month, day] = value.split("-");
  const name = month ? MONTHS[lang][Number(month) - 1] : undefined;
  if (!name) return year;
  return day ? `${Number(day)} ${name} ${year}` : `${name} ${year}`;
}

/** "June 2024" from any date in that month. */
export function formatMonth(value: string, lang: Locale): string {
  return formatDate(value.slice(0, 7), lang);
}

/** "16 June" without the year, for entries listed under a year heading. */
export function formatDay(value: string, lang: Locale): string {
  const [, month, day] = value.split("-");
  return `${Number(day)} ${MONTHS[lang][Number(month) - 1]}`;
}
