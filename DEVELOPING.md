# Developing

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Astro 7, static output; Svelte 5 islands for the planting map and the photo viewer |
| Styling | Plain CSS; tokens in `src/styles/tokens.css` |
| Icons | `lucide-astro`, `lucide-svelte` |
| Fonts | Fontsource, self-hosted: Young Serif, Source Sans 3, Noto Sans Kannada, Noto Serif Kannada |
| Content | JSON in `content/` |
| CMS | Sveltia CMS at `/admin/`, GitHub backend |
| Hosting | Cloudflare Pages |
| Runtime | Bun 1.4.2 |

TypeScript is pinned to 6 because `astro check` does not support TypeScript 7
yet. Lift the pin once it does.

## Commands

```bash
bun install
bun run dev          # http://localhost:4323
bun run check        # astro check; must report 0 errors, warnings and hints
bun run build        # static site in dist/
bun run verify       # serves dist/ on 4399 and checks every page in Chromium
bun run cms          # checks public/admin/config.yml against the content
bun run cms --schema # ...and against the official Sveltia schema (needs network)
bun run cms:copy     # regenerates the CMS fields for content/copy.json
bun run images       # resizes photos in public/images to WebP, plus 800px copies
```

Before calling a change done: `check`, `build`, `verify`. Stop the dev or
preview server first if it holds port 4399 (`ss -ltnp | grep 4399`). Set
`CHROME_PATH` if Chromium isn't at `/usr/bin/chromium`.

## Structure

```
content/
  settings.json   name, tagline, location, map links, nav, logo, credit
  copy.json       interface text, one block per language
  pages.json      page introductions, facts, crops, practices, people, page photos
  photos.json     every photo: id, file, description, date
  plants.json     plant groups (with map colours) and kinds
  plot.json       the planting map, one line of kinds per row (not translated)
  events/         one story entry per file, named <date>-<slug>.json
public/
  admin/          Sveltia CMS (index.html, config.yml)
  images/         photos as WebP, each with an -800 copy
src/
  data/load.ts    typed loader for everything in content/
  data/locales.mjs  turns { en: {…}, kn: {…} } files into per-field values
  i18n/           ui.ts (copy.json → typed keys), utils.ts (t, lx, localePath, dates)
  lib/            nav.ts (page → path), onward.ts (data lines for onward tiles)
  layouts/Base.astro
  components/     Header, Footer, Figure, Facts, Timeline, EventCard, Onward,
                  PlotMap.svelte, PhotoGrid.svelte
  views/          one view per page, shared by both languages
  pages/          thin routes; kn/ repeats them with lang="kn"
scripts/          verify-site, check-cms-config, copy-fields, optimize-images
```

## Languages

English is the default and unprefixed; Kannada lives under `/kn/`. Build every
internal link with `localePath()` and read every content field with
`lx(value, lang)`, which falls back to English. Interface text comes from
`t(lang, key, vars)`; placeholders like `{count}` are filled in from the
content. Dates are formatted from the month tables in `src/i18n/utils.ts`, not
`Intl`.

## Content and the CMS

Everything visible comes from `content/`. The CMS saves files in the shape
`{ "en": {…}, "kn": {…} }`; `mergeLocales()` reads them. Every key in every file
must be declared in `public/admin/config.yml`, or the CMS drops it on save:
`bun run cms` checks this, and `bun run verify` runs the same check.

After adding or removing a key in `copy.json`, run `bun run cms:copy` and then
`bun run cms --schema`.

Photos are listed once in `content/photos.json`; pages and story entries pick
them by id. To add one: put the file in `public/images`, run `bun run images`,
then add it to the list with its date and a description.

The planting map in `content/plot.json` has one line per row, with places
separated by commas from the road side. Each place is a kind id from
`plants.json`, `empty` (a pit with nothing in it), `house` (the helper's house)
or `.` (no pit). The counts on the What grows page and the home page come from
this file.

Editors are GitHub users with write access to the repository. To add one, add
them as a collaborator.

### Auth worker

The CMS needs a small Cloudflare Worker to sign editors in with GitHub.

1. Deploy [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) to a
   Cloudflare Worker.
2. Create a GitHub OAuth app at github.com/settings/applications/new with the
   callback `<worker URL>/callback`.
3. Set the worker secrets `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, and the
   variable `ALLOWED_DOMAINS` to every hostname that serves `/admin/`.
4. Check that an allowed `site_id` redirects to GitHub with a `client_id`, that
   another hostname is refused, and that `/callback` responds.
5. Set `backend.base_url` in `public/admin/config.yml` to the worker URL.
   Editors hard-reload `/admin/` afterwards.

Locally, open http://localhost:4323/admin/index.html and choose "Work with Local
Repository".

## Deploy

Cloudflare Pages, connected to the GitHub repository, building `main`:

- Build command: `bun run check && bun run build`
- Output directory: `dist`
- Environment variable: `BUN_VERSION` = `1.4.2` (the local `bun --version`)

Set `site` in `astro.config.mjs` to the final domain. After a deploy, request
every route and take a screenshot of the home page against the live domain.

Editors commit through the CMS, so run `git pull --rebase` before pushing and
keep their content when resolving conflicts.
