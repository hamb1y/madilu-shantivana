import type { UIKey } from "../i18n/ui";

/**
 * Every page the site has. Settings choose which appear in the header and in
 * what order; code only keeps the page → path and label map.
 */
export const PAGES = {
  home: { path: "/", key: "nav.home" },
  story: { path: "/story/", key: "nav.story" },
  grows: { path: "/grows/", key: "nav.grows" },
  farming: { path: "/farming/", key: "nav.farming" },
  photos: { path: "/photos/", key: "nav.photos" },
  about: { path: "/about/", key: "nav.about" },
} as const satisfies Record<string, { path: string; key: UIKey }>;

export type PageId = keyof typeof PAGES;

export function isPageId(id: string): id is PageId {
  return id in PAGES;
}

/** Strip a locale prefix to get the locale-independent path. */
export function barePath(pathname: string): string {
  const stripped = pathname.replace(/^\/kn(?=\/|$)/, "");
  if (stripped === "" || stripped === "/") return "/";
  return stripped.endsWith("/") ? stripped : `${stripped}/`;
}

/** The page a path belongs to, if any. */
export function pageOf(pathname: string): PageId | undefined {
  const bare = barePath(pathname);
  return (Object.keys(PAGES) as PageId[]).find((id) => PAGES[id].path === bare);
}
