<script lang="ts">
  /**
   * The planting map: one square per planting place, coloured by group. Rows
   * run left to right in bands of 25; place 1 of each row, on the road side,
   * is at the bottom. Hover or tap a square for what grows there; pick a group
   * in the key to show it alone. The table after the map lists the same data.
   */
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
    };
  }

  let { rows, kinds, groups, labels }: Props = $props();

  const BAND = 25;
  const CELL = 20;
  const MARK = 17;
  const places = $derived(Math.max(...rows.map((row) => row.length)));
  const bands = $derived(
    Array.from({ length: Math.ceil(rows.length / BAND) }, (_, b) => ({
      start: b * BAND,
      rows: rows.slice(b * BAND, (b + 1) * BAND),
    })),
  );
  const colour = $derived(Object.fromEntries(groups.map((g) => [g.id, g.color])));
  const groupName = $derived(Object.fromEntries(groups.map((g) => [g.id, g.name])));

  let only = $state<string | null>(null);
  let tip = $state<{ left: number; top: number; title: string; detail: string; place: string } | null>(null);
  let wrap: HTMLDivElement | undefined = $state();

  function groupOf(id: string): string | null {
    return kinds[id]?.group ?? null;
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
      detail: kind ? groupName[kind.group] ?? "" : "",
      place: labels.place.replace("{row}", row).replace("{place}", place),
    };
  }

  function hide(event: PointerEvent) {
    if (event.pointerType !== "touch") tip = null;
  }

  function toggle(id: string) {
    only = only === id ? null : id;
  }

  function fill(id: string): string {
    if (id === "house") return "var(--ink)";
    if (id === "empty") return "none";
    return colour[groupOf(id) ?? ""] ?? "var(--rule-strong)";
  }

  function dimmed(id: string): boolean {
    return only !== null && groupOf(id) !== only;
  }
</script>

<div class="plot">
  <div class="legend" role="group" aria-label={labels.key}>
    {#each groups as group (group.id)}
      <button type="button" aria-pressed={only === group.id} onclick={() => toggle(group.id)}>
        <span class="swatch" style:background={group.color}></span>
        <span class="name">{group.name}</span>
        <span class="count">{group.count}</span>
      </button>
    {/each}
    <span class="item"><span class="swatch empty"></span><span class="name">{labels.empty}</span></span>
    <span class="item"><span class="swatch house"></span><span class="name">{labels.house}</span></span>
    <button type="button" class="all" disabled={only === null} onclick={() => (only = null)}>{labels.showAll}</button>
  </div>

  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="bands"
    bind:this={wrap}
    role="img"
    aria-label={labels.mapLabel}
    onclick={(event) => {
      if (!(event.target as Element).matches("rect[data-id]")) tip = null;
    }}
  >
    {#each bands as band, b (band.start)}
      <div class="band">
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
                <rect
                  x={r * CELL + (CELL - MARK) / 2}
                  y={(places - 1 - p) * CELL + (CELL - MARK) / 2}
                  width={MARK}
                  height={MARK}
                  rx="2"
                  fill={fill(id)}
                  stroke={id === "empty" ? "var(--ink-2)" : "none"}
                  stroke-width={id === "empty" ? 1.5 : 0}
                  opacity={dimmed(id) ? 0.15 : 1}
                  data-id={id}
                  data-row={band.start + r + 1}
                  data-place={p + 1}
                />
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

  .legend button[aria-pressed="true"] .name {
    text-decoration-thickness: 3px;
  }

  .count {
    color: var(--ink-2);
  }

  .swatch {
    flex: none;
    inline-size: 0.9rem;
    block-size: 0.9rem;
  }

  .swatch.empty {
    border: 1.5px solid var(--ink-2);
  }

  .swatch.house {
    background: var(--ink);
  }

  .all {
    text-decoration: underline;
    text-underline-offset: 0.25em;
  }

  .all:disabled {
    visibility: hidden;
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

  @media (min-width: 64rem) {
    .bands {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
