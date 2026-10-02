# Design

The site tells the farm's story: bare red earth in 2024, rows of young trees
now. It's drawn in the colours of that land (red soil, leaf, forest, turmeric,
the hills behind), on paper with a fine grain. The farm's own photos carry the
pages, and the pages invite play: the hero drawing leans in the wind, the
then-and-now slider drags, and the map, diagram and story filters react to a
pointer.

## Tokens (`src/styles/tokens.css`)

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#f5eddc` | page background, with a fine SVG grain |
| `--paper-2` | `#ece1c8` | quiet panels, the paper story band |
| `--ink` | `#231a12` | text |
| `--ink-2` | `#5a4d40` | secondary text, captions |
| `--rule` | `#d6c7a8` | rules |
| `--rule-strong` | `#a08c6a` | borders on controls, diagram lines |

The land, used for the hero drawing, the story bands and the footer:

| Token | Value | Use |
| --- | --- | --- |
| `--soil` | `#9a3a1a` | red earth; soil story band, hero name |
| `--soil-pale` | `#f6d3b8` | dates and periods on the soil band |
| `--leaf` | `#2e5e2a` | leaf green; the "used for" boxes in the flow diagram |
| `--leaf-pale` | `#a9cf8f` | quiet text on forest |
| `--forest` | `#17321f` | the footer, the forest story band |
| `--turmeric` | `#e0a82e` | the sun, the turmeric band, "made into" boxes |
| `--turmeric-deep` | `#3b2a06` | dates on the turmeric band |
| `--hill-far`, `--hill-mid`, `--hill-near` | greens | the hills, far to near |

One accent per page. Each passes 4.5:1 on paper, and paper text passes 4.5:1
on it. `data-section` on `<body>` or any element sets `--accent`.

| Page | Token | Value |
| --- | --- | --- |
| Story | `--story` | `#a3401e` terracotta |
| What grows | `--grows` | `#2f6b2a` leaf green |
| Farming | `--farming` | `#7a5a12` turmeric brown |
| Photos | `--photos` | `#2f5d7a` monsoon blue |
| About | `--about` | `#6b2f5a` jamun |

The planting map colours live with the plant groups in `content/plants.json`.
They colour map marks, the group bar, table bars and swatches, never text.

Type: Fraunces (variable, with its soft and wonky axes) for headings and
display text, Source Sans 3 for everything else, and Noto Serif Kannada and
Noto Sans Kannada for Kannada. Numbers use the body face with `tabular-nums`.
Kannada text gets a taller line height (1.75) and drops italics.

Scale: `--step--1` to `--step-6`, fluid from step 2 up; step 6 is for the
farm's name and photo years. Spacing: `--s-1` to `--s-9`. Gutter 16px on
phones, up to 48px. Text measure 66ch. Two radii: `--radius` (4px) and
`--radius-round` for the slider grip.

## Motion

- CSS transitions, `IntersectionObserver`, `requestAnimationFrame` and
  `ResizeObserver` only. No CSS keyframe animations and no Svelte transitions;
  verify fails on any `animation-name`.
- `--ease` is a soft ease-out; no bounce. `--quick` (180ms) for hover and
  focus, `--slow` (700ms) for things coming into view.
- Blocks marked `data-rise` slide up as they enter the screen.
- Everything respects `prefers-reduced-motion`: the global CSS zeroes
  durations, and each script checks the media query before it moves anything.
  With reduced motion the hero trees are already grown and nothing counts up.

## Patterns

- **The hero drawing** (`HeroScene.astro`): the farm drawn at build time as
  SVG. Hills in three layers, the sun, red furrows running to a vanishing
  point and rows of trees in four kinds. The trees grow in on load, sway with
  the pointer's speed, and the layers move apart as the page scrolls. Under the
  name: the tagline and a live count of days since the first saplings.
- **Facts** as label / large value / note; larger figures count up once when
  they come into view.
- **Then and now**: the same ground two years apart, with a slider to drag
  between them. It's a range input, so it works with the keyboard too.
- **Chapter bands**: the story in a few chapters (`home.chapters` in
  `pages.json`), each a full-width band in a land colour, with a line of hills
  as its top edge. On a wide screen the moments go down the left and their
  photos cross-fade in a sticky frame on the right. On a phone they're cards
  to swipe.
- **The story page**: a timeline under large year headings, with a sticky bar
  of year links (the current year underlined as you scroll) and topic filters
  with a live count.
- **The planting map**: one mark per planting place, with shape and colour both
  showing the group, so it reads without colour too. Empty pits are outlines
  and the helper's house is an ink square. Hovering or tapping a mark shows
  the kind and its place. The key filters by group, a bar shows each group's
  share, and "Find a kind" lights up one kind and says where it grows. Rows
  scale up into place as they scroll in.
- **The table on What grows**: every kind with its count and a bar of that
  size in its group colour.
- **The flow diagram** on Farming: where each input comes from, what it's made
  into and what it's used for, as three columns joined by curves. Pointing at
  a box lights its paths. On a phone, and for screen readers, it's a list.
- **Practices** zigzag photo and text on wide screens.
- **Photos** as a mosaic (tall photos take two rows, wide ones two columns),
  filtered by year, with the date rising into the corner on hover. The viewer
  steps with the arrow keys, buttons or a swipe.
- **About** sets the farm's name in Kannada letters as tall as the page allows.
- A story card without a photo is a solid block in the story colour with the
  day large.
- Pages end with onward tiles, one per other page, each a solid block in that
  page's colour with a line of real data. They lift on hover.
- The footer is forest green under a line of hills and lists every page and the
  language switch. On a short page it stays at the bottom of the window.
- Navigation and switches are underlined text; the current page is underlined
  in its own colour.
- Hyphenated words in titles don't break (`.nowrap`).

## Banned

Inter, Geist or system-only fonts; monospace or novelty fonts; purple or blue
gradients; gradient text; glassmorphism; glows; nested cards; icon tiles above
headings; marquees; pulsing dots; bounce easing; hover image zoom; numbered
01/02/03 markers; all-caps text or eyebrows; a rule above every block; CSS
keyframe animations; more than four radii; pills, chips, badges or dots before
text; labels that repeat the heading they sit on; filler copy; decorative
watermarks.
