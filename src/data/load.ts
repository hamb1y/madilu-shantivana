/**
 * Typed access to everything in content/. Files saved by the CMS keep one block
 * per locale; mergeLocales() turns them into one value per field, so a field
 * reads as a plain string when both locales agree and as `{ en, kn }` when
 * they don't. Resolve those with lx().
 */
import path from "node:path";
import sharp from "sharp";
import { mergeLocales } from "./locales.mjs";
import settingsFile from "../../content/settings.json";
import pagesFile from "../../content/pages.json";
import plantsFile from "../../content/plants.json";
import photosFile from "../../content/photos.json";
import plotFile from "../../content/plot.json";
import topicsFile from "../../content/topics.json";

export type Locale = "en" | "kn";
export type Localized = string | Partial<Record<Locale, string>>;

export interface Settings {
  name: Localized;
  tagline: Localized;
  description: Localized;
  location: { village: Localized; taluk: Localized; district: Localized; state: Localized };
  map_url: string;
  map_pin: string;
  nav: string[];
  logo: string;
  share_image: string;
  credit: { name: Localized; url: string; repo: string };
}

export interface Fact {
  label: Localized;
  value: Localized;
  note: Localized;
}

export type Tone = "soil" | "paper" | "turmeric" | "forest";

export interface Chapter {
  title: Localized;
  tone: Tone;
  /** First and last day the chapter covers; story entries between them belong to it. */
  start: string;
  end: string;
  body: Localized;
}

export interface Practice {
  id: string;
  title: Localized;
  body: Localized;
  photo: string;
}

export interface Flow {
  source: Localized;
  made: Localized;
  use: Localized;
  /** The practice that explains this flow. */
  practice: string;
}

export interface Pages {
  home: {
    hero: string;
    /** The day the count of days in the hero starts from. */
    since: string;
    intro: Localized;
    facts: Fact[];
    then: string;
    now: string;
    chapters: Chapter[];
    latest_count: number;
  };
  grows: { intro: Localized; crops: { name: Localized; body: Localized; photo: string }[] };
  farming: { intro: Localized; practices: Practice[]; flow: Flow[] };
  about: { photo: string; name_body: Localized; people: { name: Localized; body: Localized }[] };
}

export interface Group {
  id: string;
  name: Localized;
  color: string;
}

export interface Species {
  id: string;
  name: Localized;
  group: string;
}

export interface Photo {
  id: string;
  src: string;
  alt: Localized;
  date: string;
  width: number;
  height: number;
  /** The 800px copy that grids and cards load. */
  small: string;
}

export interface Topic {
  id: string;
  name: Localized;
}

export interface FarmEvent {
  slug: string;
  date: string;
  topic: string;
  title: Localized;
  body: Localized;
  photo: string;
}

export interface Plot {
  date: string;
  /** One list of planting places per row; "." is no place, "empty" an empty pit, "house" the helper's house. */
  rows: string[][];
}

export const settings = mergeLocales(settingsFile) as Settings;
export const pages = mergeLocales(pagesFile) as Pages;

const plants = mergeLocales(plantsFile) as { groups: Group[]; species: Species[] };
export const groups = plants.groups;
export const topics = (mergeLocales(topicsFile) as { topics: Topic[] }).topics;
export const species = plants.species;

export const plot: Plot = {
  date: plotFile.date,
  rows: plotFile.rows.map((row) => row.cells.split(",").map((cell) => cell.trim())),
};

/** Width and height of a file in public/, read at build time. */
async function sizeOf(src: string): Promise<{ width: number; height: number }> {
  const { width = 0, height = 0 } = await sharp(path.join(process.cwd(), "public", src)).metadata();
  return { width, height };
}

const photoList = (mergeLocales(photosFile) as { photos: Omit<Photo, "width" | "height" | "small">[] }).photos;
export const photos: Photo[] = await Promise.all(
  photoList.map(async (photo) => ({
    ...photo,
    ...(await sizeOf(photo.src)),
    small: photo.src.replace(/\.webp$/, "-800.webp"),
  })),
);
const photoById = new Map(photos.map((photo) => [photo.id, photo]));

/** The photo with this id, or undefined for an empty field. */
export function photo(id: string | undefined): Photo | undefined {
  return id ? photoById.get(id) : undefined;
}

const eventFiles = import.meta.glob<Record<string, unknown>>("../../content/events/*.json", {
  eager: true,
  import: "default",
});
/** Every event, oldest first. */
export const events: FarmEvent[] = Object.entries(eventFiles)
  .map(([file, data]) => ({
    ...(mergeLocales(data) as Omit<FarmEvent, "slug">),
    slug: path.basename(file, ".json"),
  }))
  .sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug));

/** Places planted on the map, by species id. Empty pits and the house are left out. */
export const plantCounts: Map<string, number> = (() => {
  const counts = new Map<string, number>();
  for (const row of plot.rows) {
    for (const cell of row) {
      if (cell === "." || cell === "empty" || cell === "house") continue;
      counts.set(cell, (counts.get(cell) ?? 0) + 1);
    }
  }
  return counts;
})();

export const plantTotal = [...plantCounts.values()].reduce((sum, n) => sum + n, 0);
export const kindTotal = plantCounts.size;

export const logo = settings.logo ? { src: settings.logo, ...(await sizeOf(settings.logo)) } : null;
