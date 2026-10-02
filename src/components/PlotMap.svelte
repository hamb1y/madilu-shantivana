<script lang="ts">
  /**
   * The planting map: one mark per planting place, its shape and colour by
   * group. Rows run left to right in bands of 25; place 1 of each row, on the
   * road side, is at the bottom. Hover or tap a mark for what grows there; pick
   * a group in the key, or a kind in the list, to show it alone. The table after
   * the map lists the same data.
   */
  import { onMount } from "svelte";

  interface Group {
    id: string;
    name: string;
    color: string;
    count: number;
  }

  interface Props {
    rows: string[][];
    kinds: Record<string, { name: string; group: string }>;
    groups: Group[];
    labels: {
      key: string;
      showAll: string;
      road: string;
      empty: string;
      house: string;
      mapLabel: string;
      /** "Row {row}, place {place}" */
      place: string;
      /** One label per band, e.g. "Rows 1 to 25". */
      bands: string[];
      find: string;
      everyKind: string;
      /** "{name}: {count} places, between rows {from} and {to}" */
      found: string;
      groupsTitle: string;
    };
  }

  let { rows, kinds, groups, labels }: Props = $props();

  const BAND = 25;
  const CELL = 20;
  const places = $derived(Math.max(...rows.map((row) => row.length)));
  const bands = $derived(
    Array.from({ length: Math.ceil(rows.length / BAND) }, (_, b) => ({
      start: b * BAND,
      rows: rows.slice(b * BAND, (b + 1) * BAND),
    })),
  );
  const colour = $derived(Object.fromEntries(groups.map((g) => [g.id, g.color])));
  const groupName = $derived(Object.fromEntries(groups.map((g) => [g.id, g.name])));
  const total = $derived(groups.reduce((sum, g) => sum + g.count, 0));

  /** Where each kind grows: how many places, and its first and last row. */
  const spread = $derived.by(() => {
    const out = new Map<string, { count: number; from: number; to: number }>();
    rows.forEach((row, r) => {
      for (const id of row) {
        if (!kinds[id]) continue;
        const seen = out.get(id) ?? { count: 0, from: r + 1, to: r + 1 };
        seen.count++;
        seen.to = r + 1;
        out.set(id, seen);
      }
    });
    return out;
  });
  const kindList = $derived(
    [...spread.keys()].map((id) => ({ id, name: kinds[id].name })).sort((a, b) => a.name.localeCompare(b.name)),
  );

  let only = $state<string | null>(null);
  let pick = $state("");
  let tip = $state<{ left: number; top: number; title: string; detail: string; place: string } | null>(null);
  let wrap: HTMLDivElement | undefined = $state();
  let waiting = $state<boolean[]>([]);

  const found = $derived.by(() => {
    const where = spread.get(pick);
    if (!pick || !where) return "";
    return labels.found
      .replace("{name}", kinds[pick].name)
      .replace("{count}", String(where.count))
      .replace("{from}", String(where.from))
      .replace("{to}", String(where.to));
  });

  // Marks by group. A group added later in the CMS gets a circle.
  const SHAPES: Record<string, string> = {
    kitchen: "square",
    fruit: "circle",
    palms: "star",
    timber: "triangle",
    banana: "diamond",
  };

  const r1 = (n: number) => Math.round(n * 10) / 10;
  const star = (() => {
    const points: string[] = [];
    for (let i = 0; i < 12; i++) {
      const radius = i % 2 === 0 ? 9.5 : 3.6;
      const angle = (Math.PI / 6) * i - Math.PI / 2;
      points.push(`${r1(Math.cos(angle) * radius)} ${r1(Math.sin(angle) * radius)}`);
    }
    return `M ${points.join(" L ")} Z`;
  })();

  /** A mark centred on 0 0, about 18 units across. */
  function glyph(shape: string): string {
    switch (shape) {
      case "square":
        return "M -7 -7 H 7 V 7 H -7 Z";
      case "triangle":
        return "M 0 -9 L 8.5 7.5 L -8.5 7.5 Z";
      case "diamond":
        return "M 0 -9.5 L 9.5 0 L 0 9.5 L -9.5 0 Z";
      case "star":
        return star;
      default:
        return "M -8 0 A 8 8 0 1 0 8 0 A 8 8 0 1 0 -8 0 Z";
    }
  }

  function groupOf(id: string): string | null {
    return kinds[id]?.group ?? null;
  }

  function shapeOf(id: string): string {
    if (id === "house") return "square";
    return SHAPES[groupOf(id) ?? ""] ?? "circle";
  }

  function show(event: PointerEvent) {
    const target = event.target as SVGElement;
    const { row, place, id } = target.dataset ?? {};
    if (!row || !place || !id || !wrap) return;
    const box = wrap.getBoundingClientRect();
    const cell = target.getBoundingClientRect();
    const half = Math.min(110, box.width / 2);
    const centre = cell.left + cell.width / 2 - box.left;
    const kind = kinds[id];
    tip = {
      left: Math.min(Math.max(centre, half), box.width - half),
      top: cell.top - box.top,
      title: kind?.name ?? (id === "house" ? labels.house : labels.empty),
      detail: kind ? (groupName[kind.group] ?? "") : "",
      place: labels.place.replace("{row}", row).replace("{place}", place),
    };
  }

  function hide(event: PointerEvent) {
    if (event.pointerType !== "touch") tip = null;
  }

  function toggle(id: string) {
    only = only === id ? null : id;
    pick = "";
  }

  function fill(id: string): string {
    if (id === "house") return "var(--ink)";
    if (id === "empty") return "none";
    return colour[groupOf(id) ?? ""] ?? "var(--rule-strong)";
  }

  function dimmed(id: string): boolean {
    if (pick) return id !== pick;
    return only !== null && groupOf(id) !== only;
  }

  // Bands below the fold are planted, row after row, as they come into view.
  onMount(() => {
    if (!wrap || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const nodes = [...wrap.querySelectorAll<HTMLElement>(".band")];
    waiting = nodes.map((node) => node.getBoundingClientRect().top > innerHeight);
    const watch = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = nodes.indexOf(entry.target as HTMLElement);
          waiting[index] = false;
          watch.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -20% 0px" },
    );
    nodes.forEach((node, i) => waiting[i] && watch.observe(node));
    return () => watch.disconnect();
  });
</script>

<div class="plot">
  <div class="split" aria-hidden="true">
    <p class="split-title">{labels.groupsTitle}</p>
    <div class="bar">
      {#each groups as group (group.id)}
        <span
          class="segment"
          class:faded={(only !== null && only !== group.id) || (pick !== "" && groupOf(pick) !== group.id)}
          style:flex-grow={group.count}
          style:background={group.color}
        ></span>
      {/each}
    </div>
  </div>

  <div class="controls">
    <div class="legend" role="group" aria-label={labels.key}>
      {#each groups as group (group.id)}
        <button type="button" aria-pressed={only === group.id} onclick={() => toggle(group.id)}>
          <svg class="swatch" viewBox="-10 -10 20 20" aria-hidden="true">
            <path d={glyph(SHAPES[group.id] ?? "circle")} fill={group.color} />
          </svg>
          <span class="name">{group.name}</span>
          <span class="count">{group.count}</span>
          <span class="share">{Math.round((group.count / total) * 100)}%</span>
        </button>
      {/each}
      <span class="item">
        <svg class="swatch" viewBox="-10 -10 20 20" aria-hidden="true">
          <path d={glyph("circle")} fill="none" stroke="var(--ink-2)" stroke-width="2" />
        </svg>
        <span class="name">{labels.empty}</span>
      </span>
      <span class="item">
        <svg class="swatch" viewBox="-10 -10 20 20" aria-hidden="true">
          <path d={glyph("square")} fill="var(--ink)" />
        </svg>
        <span class="name">{labels.house}</span>
      </span>
      <button
        type="button"
        class="all"
        disabled={only === null && pick === ""}
        onclick={() => {
          only = null;
          pick = "";
        }}>{labels.showAll}</button
      >
    </div>

    <div class="find">
      <label for="find-kind">{labels.find}</label>
      <select id="find-kind" bind:value={pick} onchange={() => (only = null)}>
        <option value="">{labels.everyKind}</option>
        {#each kindList as kind (kind.id)}
          <option value={kind.id}>{kind.name}</option>
        {/each}
      </select>
      <p class="found" aria-live="polite">{found}</p>
    </div>
  </div>

  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="bands"
    bind:this={wrap}
    role="img"
    aria-label={labels.mapLabel}
    onclick={(event) => {
      if (!(event.target as Element).matches("[data-id]")) tip = null;
    }}
  >
    {#each bands as band, b (band.start)}
      <div class="band" class:waiting={waiting[b]}>
        <p class="band-label">{labels.bands[b]}</p>
        <svg
          viewBox={`0 0 ${BAND * CELL} ${places * CELL + 12}`}
          aria-hidden="true"
          onpointerover={show}
          onpointerdown={show}
          onpointerleave={hide}
        >
          {#each band.rows as row, r (band.start + r)}
            {#each row as id, p (p)}
              {#if id !== "."}
                <g transform={`translate(${r * CELL + CELL / 2} ${(places - 1 - p) * CELL + CELL / 2})`}>
                  <path
                    class="mark"
                    class:dim={dimmed(id)}
                    class:picked={pick !== "" && id === pick}
                    d={glyph(id === "empty" ? "circle" : shapeOf(id))}
                    fill={fill(id)}
                    stroke={id === "empty" ? "var(--ink-2)" : "none"}
                    stroke-width={id === "empty" ? 1.5 : 0}
                    style:--r={r}
                    data-id={id}
                    data-row={band.start + r + 1}
                    data-place={p + 1}
                  />
                </g>
              {/if}
            {/each}
          {/each}
          <rect x="0" y={places * CELL + 5} width={band.rows.length * CELL} height="5" fill="var(--rule-strong)" />
        </svg>
        <p class="road">{labels.road}</p>
      </div>
    {/each}

    {#if tip}
      <div class="tip" style:left={`${tip.left}px`} style:top={`${tip.top}px`} aria-hidden="true">
        <span class="tip-title">{tip.title}</span>
        {#if tip.detail}<span class="tip-detail">{tip.detail}</span>{/if}
        <span class="tip-detail">{tip.place}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .plot {
    display: grid;
    gap: var(--s-5);
  }

  .split {
    display: grid;
    gap: var(--s-2);
  }

  .split-title {
    font-weight: 700;
  }

  /* Each group's share of the planted places, end to end. */
  .bar {
    display: flex;
    gap: 2px;
    block-size: 1.25rem;
  }

  .segment {
    flex-basis: 0;
    min-inline-size: 4px;
    transition: opacity var(--quick) var(--ease);
  }

  .segment.faded {
    opacity: 0.2;
  }

  .controls {
    display: grid;
    gap: var(--s-5);
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s-2) var(--s-5);
  }

  .legend button,
  .item {
    display: inline-flex;
    align-items: center;
    gap: var(--s-2);
    padding: var(--s-1) 0;
    border: 0;
    background: none;
  }

  .legend button {
    cursor: pointer;
  }

  .legend button .name {
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 0.25em;
  }

  .legend button:hover .name {
    text-decoration-thickness: 2px;
  }

  .legend button[aria-pressed="true"] .name {
    font-weight: 700;
    text-decoration-thickness: 3px;
  }

  .count {
    font-weight: 700;
  }

  .share {
    color: var(--ink-2);
  }

  .swatch {
    flex: none;
    inline-size: 1.1rem;
    block-size: 1.1rem;
  }

  .all {
    text-decoration: underline;
    text-underline-offset: 0.25em;
  }

  .all:disabled {
    visibility: hidden;
  }

  .find {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s-2) var(--s-4);
  }

  label {
    font-weight: 700;
  }

  select {
    min-inline-size: 14rem;
    max-inline-size: 100%;
    padding: var(--s-2) var(--s-3);
    border: 1px solid var(--rule-strong);
    border-radius: var(--radius);
    background: var(--paper);
    color: var(--ink);
    font: inherit;
  }

  .found {
    flex-basis: 100%;
    min-block-size: 1.6em;
    font-family: var(--font-display);
    font-size: var(--step-1);
    max-width: none;
  }

  .bands {
    position: relative;
    display: grid;
    gap: var(--s-6) var(--s-6);
  }

  .band {
    display: grid;
    gap: var(--s-2);
  }

  .band-label,
  .road {
    max-width: none;
    font-size: var(--step--1);
    color: var(--ink-2);
  }

  .road {
    text-align: end;
  }

  svg {
    display: block;
    inline-size: 100%;
    block-size: auto;
    touch-action: manipulation;
  }

  /* Changes sweep across a band from its first row to its last. */
  .mark {
    transform-box: fill-box;
    transform-origin: center;
    transition:
      opacity 300ms var(--ease),
      transform 500ms var(--ease);
    transition-delay: calc(var(--r) * 14ms);
  }

  .mark:hover {
    transform: scale(1.3);
    transition-delay: 0s;
  }

  .mark.dim {
    opacity: 0.12;
  }

  .mark.picked {
    stroke: var(--ink);
    stroke-width: 2.5px;
  }

  .waiting .mark {
    opacity: 0;
    transform: scale(0.2);
  }

  .tip {
    position: absolute;
    z-index: 5;
    display: grid;
    gap: 0.1rem;
    min-inline-size: 9rem;
    max-inline-size: 13.75rem;
    padding: var(--s-2) var(--s-3);
    background: var(--ink);
    color: var(--paper);
    translate: -50% calc(-100% - 6px);
    pointer-events: none;
  }

  .tip-title {
    font-weight: 700;
  }

  .tip-detail {
    font-size: var(--step--1);
  }

  @media (min-width: 48rem) {
    .controls {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
    }

    .find {
      justify-content: end;
    }

    .found {
      text-align: end;
    }
  }

  @media (min-width: 64rem) {
    .bands {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
