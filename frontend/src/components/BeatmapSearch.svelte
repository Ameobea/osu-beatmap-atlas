<script lang="ts">
  import * as FuzzySearcher from '@m31coding/fuzzy-search';
  import { ComboBox } from 'carbon-components-svelte';
  import CheckmarkFilled from 'carbon-icons-svelte/lib/CheckmarkFilled.svelte';
  import SearchWorker from './beatmapSearchWorker.worker?worker';

  import { type Corpus } from '../corpus';
  import type { SearchDatum } from './beatmapSearchWorker.worker';

  export let corpus: Corpus;
  export let onSelect: (globalScoreIx: number) => void;
  export let visibleScoreIDs: Set<string>;
  export let highlightedScoreIDs: Set<string>;

  $: prettyNames = corpus.map((d) => `${d.beatmapName} [${d.difficultyName}]${d.modString ? ` +${d.modString}` : ''}`);
  $: indexingData = corpus.map(
    (d, i): SearchDatum => ({
      originalIx: d.originalIx,
      data: [d.beatmapName, d.difficultyName, d.mapperName, prettyNames[i]],
    })
  );

  let searcher: FuzzySearcher.DynamicSearcher<SearchDatum, number> | null = null;

  const searchWorker = new SearchWorker();
  searchWorker.onmessage = (evt) => {
    const memento = new FuzzySearcher.Memento(evt.data.mementoObjects);
    const searcherConfig = FuzzySearcher.Config.createDefaultConfig();
    searcher = FuzzySearcher.SearcherFactory.createSearcher<SearchDatum, number>(searcherConfig);
    searcher.load(memento);
  };
  $: searchWorker.postMessage(indexingData);

  let searchText = '';
  $: searchResults = (() => {
    if (!searchText || !searcher) {
      return [];
    }
    const query = new FuzzySearcher.Query(searchText, 20);
    return searcher.getMatches(query).matches;
  })();

  let open = false;
</script>

<div class="root">
  <ComboBox
    bind:value={searchText}
    bind:open
    items={searchResults.map((d) => ({ id: d.entity.originalIx, text: prettyNames[d.entity.originalIx] }))}
    on:select={(e) => onSelect(e.detail.selectedItem.id)}
    placeholder="Search for a beatmap"
    size="xl"
    let:item
  >
    {@const datum = corpus[item.id]}
    {@const isFiltered = !visibleScoreIDs.has(datum.scoreID)}
    {@const isHighlighted = highlightedScoreIDs.has(datum.scoreID)}
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
    margin-bottom: 30px;
  }

  :global(.bx--list-box__menu) {
    min-width: calc(min(90vw, 600px));
  }
</style>
