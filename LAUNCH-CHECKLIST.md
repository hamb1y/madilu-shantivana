# Launch checklist

Questions for the owner and steps left before the site goes live.

## Decisions

- [ ] **How visitors get in touch.** The site has no contact details for now,
      by choice. Revisit later: an email address, a form, or nothing.

## Content to confirm

- [ ] **Exact map pin.** The About page links to a Google Maps search for
      Tenginamaradoddi, Kanakapura. Paste a pin for the farm gate into Site ›
      Settings › Map pin.
- [ ] **Corrected planting map.** The map on the site is the one from 7 June
      2026. On 14 June Mahesh said it missed a cross line of coconut after the
      wood apple, and that he would redo it. When the new map comes, update
      Planting map in the CMS. The counts on the home and What grows pages
      follow it.
- [ ] **"Bendi" on the map** is shown as okra. The map has it as a 6 × 7 block at
      the front among the trees, so it may be the bende (Portia) tree instead.
- [ ] **"Elakki"** is listed as a fruit tree. If it's yelakki banana, move it to
      the Banana group in Site › Plants.
- [ ] **English names** for hebbevu, shivane, honne, beete, agase, bath ele and
      patte bath ele, which the English pages show by their Kannada names.
- [ ] **The school** that got the papaya harvest in June 2025: name it on the
      Farming page, or leave it as "a school".
- [ ] **The cows' names**, if they should appear on the Farming page.

## Before launch

- [ ] **Register `madilusantivana.farm`** and add it (and `www`) to the Cloudflare
      Pages project `madilu-shantivana` as a custom domain. The site, sitemap,
      CMS and auth worker are already set up for it; until then it runs at
      https://madilu-shantivana.pages.dev.
- [ ] **Create the GitHub OAuth app** at github.com/settings/applications/new:
      name "Madilu Shantivana CMS", homepage `https://madilusantivana.farm`,
      callback `https://madilu-cms-auth.rishi-s-malnad.workers.dev/callback`.
      Then, from `/home/dipshit/sites/madilu-cms-auth`, run
      `wrangler secret put GITHUB_CLIENT_ID` and
      `wrangler secret put GITHUB_CLIENT_SECRET`. Until both are set, nobody
      can sign in to the CMS.
- [ ] Add editors as collaborators on `hamb1y/madilu-shantivana`.
- [ ] Once the domain is live, request every route on it and take a screenshot
      of the home page.

## Housekeeping

- [ ] TypeScript is pinned to 6 because `astro check` doesn't support 7 yet.
      Lift the pin when it does.
