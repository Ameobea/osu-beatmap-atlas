<script lang="ts">
  import { ComboBox } from 'carbon-components-svelte';
  import CheckmarkFilled from 'carbon-icons-svelte/lib/CheckmarkFilled.svelte';

  import type { Corpus, ScoreMetadata } from '../corpus';
  import { buildSearchIndex, search } from './beatmapSearch';

  // Ranks maps the active user has played, and maps near their usual star range, a bit higher
  const USER_BOOST_ENABLED = true;

  const {
    corpus,
    onSelect,
    visibleScoreIDs,
    highlightedScoreIDs,
  }: {
    corpus: Corpus;
    onSelect: (globalScoreIx: number) => void;
    visibleScoreIDs: Set<string>;
    highlightedScoreIDs: Set<string> | null;
  } = $props();

  const prettyName = (d: ScoreMetadata) =>
    `${d.beatmapName} [${d.difficultyName}]${d.modString ? ` +${d.modString}` : ''}`;

  const index = $derived(buildSearchIndex(corpus));
  $effect(() => {
    const warmup = setTimeout(() => void index, 1000);
    return () => clearTimeout(warmup);
  });

  const boost = $derived.by(() => {
    const played = highlightedScoreIDs;
    if (!USER_BOOST_ENABLED || !played?.size) {
      return undefined;
    }
    const stars = corpus
      .filter((d) => played.has(d.scoreID))
      .map((d) => d.starRating)
      .sort((a, b) => a - b);
    if (!stars.length) {
      return undefined;
    }
    const lo = stars[Math.floor(stars.length * 0.25)];
    const hi = stars[Math.floor(stars.length * 0.75)];
    return (d: ScoreMetadata) => {
      const starsOutside = d.starRating < lo ? lo - d.starRating : d.starRating > hi ? d.starRating - hi : 0;
      return (played.has(d.scoreID) ? 1.2 : 1) * (1 + 0.1 * Math.max(0, 1 - starsOutside));
    };
  });

  let searchText = $state('');
  let selectedId = $state<number | undefined>(undefined);
  let open = $state(false);

  const items = $derived(
    searchText
      ? search(index, searchText, { limit: 20, boost }).map((ix) => ({ id: ix, text: prettyName(corpus[ix]) }))
      : []
  );

  // The combobox only emits `select` when the selection changes, so pressing enter on the
  // already-selected map re-applies it (flying the atlas back to it) unless the combobox's own
  // handler picked a different item.
  const handleKeydown = (evt: KeyboardEvent) => {
    if (evt.key !== 'Enter' || selectedId === undefined || searchText !== prettyName(corpus[selectedId])) {
      return;
    }
    const prevSelectedId = selectedId;
    const wasOpen = open;
    setTimeout(() => {
      if (selectedId === prevSelectedId) {
        onSelect(prevSelectedId);
        if (!wasOpen) {
          open = false;
        }
      }
    });
  };
</script>

<div class="root">
  <ComboBox
    bind:value={searchText}
    bind:selectedId
    bind:open
    {items}
    on:select={(e) => onSelect(e.detail.selectedItem.id)}
    on:keydown={handleKeydown}
    placeholder="Search for a beatmap"
    size="xl"
    let:item
  >
    {@const datum = corpus[item.id]}
    {@const isFiltered = !visibleScoreIDs.has(datum.scoreID)}
    {@const isHighlighted = highlightedScoreIDs?.has(datum.scoreID)}
    {@const textColor = isFiltered ? '#898989' : 'unset'}
    <div style="display: flex; flex-direction: row; margin-top: -5px; font-size: 15px; color: {textColor};">
      {item.text}
      {#if isFiltered}
        <span style="font-size: 12px; color: #898989;"> (filtered)</span>
      {/if}
      {#if isHighlighted}
        <div style="margin-left: 12px; padding-right: 4px;">
          <CheckmarkFilled color="#34d41c" size={16} title="In Hiscores" />
        </div>
      {/if}
    </div>
    <div style="font-size: 12px; color: {textColor};">
      {corpus[item.id].starRating.toFixed(2)}★ | Mapped by {datum.mapperName}
    </div>
  </ComboBox>
</div>

<style lang="css">
  .root {
    display: flex;
    flex-direction: column;
    margin-top: 30px;
    margin-bottom: 30px;
  }

  :global(.bx--list-box__menu) {
    min-width: calc(min(90vw, 600px));
  }
</style>
