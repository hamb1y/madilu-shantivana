import { events, kindTotal, pages, photos, plantTotal, settings, type Locale } from "../data/load";
import { formatMonth, lx, t } from "../i18n/utils";
import type { PageId } from "./nav";

/** English titles read mid-sentence in lower case; Kannada has no case. */
function inSentence(text: string, lang: Locale): string {
  return lang === "en" && /^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text;
}

/** One line of real data per page, for the tiles that end each page. */
export function onwardLine(id: PageId, lang: Locale): string {
  switch (id) {
    case "story":
      return t(lang, "onward.story", {
        count: events.length,
        from: formatMonth(events[0]?.date ?? "", lang),
        to: formatMonth(events.at(-1)?.date ?? "", lang),
      });
    case "grows":
      return t(lang, "onward.grows", { plants: plantTotal, kinds: kindTotal });
    case "farming": {
      const list = pages.farming.practices;
      return t(lang, "onward.farming", {
        count: list.length,
        first: inSentence(lx(list[0]?.title, lang), lang),
        last: inSentence(lx(list.at(-1)?.title, lang), lang),
      });
    }
    case "photos": {
      const dates = photos.map((p) => p.date).sort();
      return t(lang, "onward.photos", {
        count: photos.length,
        from: formatMonth(dates[0] ?? "", lang),
        to: formatMonth(dates.at(-1) ?? "", lang),
      });
    }
    case "about":
      return t(lang, "onward.about", {
        village: lx(settings.location.village, lang),
        taluk: lx(settings.location.taluk, lang),
      });
    default:
      return "";
  }
}
