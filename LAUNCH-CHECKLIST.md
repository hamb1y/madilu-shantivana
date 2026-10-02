# Launch checklist

Questions for the owner and steps left before the site goes live.

## Decisions

- [ ] **How visitors get in touch.** The site has no contact details for now,
      by choice. Revisit later: an email address, a form, or nothing.

## Content to confirm

- [ ] **Exact map pin.** The About page links to a Google Maps search for
      Tenginamaradoddi, Kanakapura. Paste a pin for the farm gate into Site ›
      Settings › Map pin.
- [ ] **Planting map cells to check.** The map on the site is read from the
      two hand-drawn sheets of 17 June 2026, fruit block and forest block. A
      few places were hard to read; check them against the sheets and fix them
      in Planting map in the CMS:
      - fruit block, places 4 to 6 in rows 25 to 42;
      - forest block, the blank places in place 1;
      - forest block, the bottom row with the bamboo;
      - forest block, row 46, place 7.
- [ ] **Counts that don't match the chat.** The fruit block sheet has 21 empty
      pits; the chat says 22 died there. The sheets show 55 coconut and 3 empty
      coconut pits, 58 in all; the chat says 57.
- [ ] **"Paneer fruit"** is shown as rose apple (ಪನ್ನೇರಳೆ). Correct it in Site ›
      Plants if it's something else.
- [ ] **Bananas.** The 17 June sheets don't show the banana rows or the yelakki
      banana by the gate (23 August), so the map leaves them out. Say where they
      are, and they can go on as a third block.
- [ ] **The 66 coconut saplings** planned on 29 September aren't on the map yet.
      Add them when they're in the ground.
- [ ] **Where the gate is**, relative to the two blocks, so the map can mark it.
- [ ] **English names** for hebbevu, shivane, honne, beete, agase, vange, bath
      ele, patte bath ele and elachi fruit, which the English pages show by
      their Kannada names.
- [ ] **The school** that got the papaya harvest in June 2025: name it on the
      Farming page, or leave it as "a school".
- [ ] **The cows' names**, if they should appear on the Farming page.

## Before launch

- [x] **GitHub OAuth app** created and its values saved in the
      `madilu-cms-auth` worker, which now sends sign-in on to GitHub.
- [ ] **Add editors** as collaborators on `hamb1y/madilu-shantivana` (GitHub →
      the repo → Settings → Collaborators → Add people). Nothing else changes.

## Housekeeping

- [ ] TypeScript is pinned to 6 because `astro check` doesn't support 7 yet.
      Lift the pin when it does.
