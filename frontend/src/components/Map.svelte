<script lang="ts">
  import { browser } from '$app/environment';
  import { ColorMode } from '$lib';
  import { LocalStorage } from 'carbon-components-svelte';
  import { onDestroy } from 'svelte';
  import { writable, type Writable } from 'svelte/store';
  import { GlobalCorpus, type ScoreMetadata } from '../corpus';
  import { AtlasVizRegl, type DataExtents, type FilterState } from '../viz/AtlasVizRegl';
  import ConfigureColors from './ConfigureColors.svelte';
  import Info from './Info.svelte';
  import CollapsedLeftPane from './LeftPane/CollapsedLeftPane.svelte';
  import LeftPane from './LeftPane/LeftPane.svelte';
  import SelectedBeatmapInfo from './SelectedBeatmapInfo/SelectedBeatmapInfo.svelte';
  import TopControls from './TopControls.svelte';

  let windowWidth = 0;
  let windowHeight = 0;
  const dpr = browser ? window.devicePixelRatio || 1 : 1;
  const selectedScoreIx = writable<number | null>(null);
  const activeUserID = writable<number | null>(null);
  const configureColorsOpen = writable(false);

  const computeDataExtents = (data: ScoreMetadata[]): DataExtents => {
    const pp = data.map((d) => d.averagePp);
    const stars = data.map((d) => d.starRating);
    const aimSpeedRatio = data.map((d) => d.aimSpeedRatio);
    const bpm = data.map((d) => d.bpm);
    const releaseYear = data.map((d) => d.releaseYear);
    const lengthSeconds = data.map((d) => d.realLengthSeconds);

    return {
      pp: [Math.min(...pp), Math.max(...pp)],
      stars: [Math.min(...stars), Math.max(...stars)],
      aimSpeedRatio: [Math.min(...aimSpeedRatio), Math.max(...aimSpeedRatio)],
      bpm: [Math.min(...bpm), Math.max(...bpm)],
      releaseYear: [Math.min(...releaseYear), Math.max(...releaseYear)],
      lengthSeconds: [Math.min(...lengthSeconds), Math.max(...lengthSeconds)],
    };
  };

  const buildDefaultFilterState = (): FilterState => ({
    pp: [70, 1400],
    stars: [3, 10],
    aimSpeedRatio: [0.85, 1.6],
    bpm: [20, 300],
    lengthSeconds: [10, 6000],
    releaseYear: [2008, 2024],
    mods: {
      nomod: false,
      DT: false,
      EZ: false,
      FL: false,
      HR: false,
    },
  });

  const usedSavedFilterState: string | null = (browser && localStorage.getItem('filter-state')) || null;
  let curColorMode = writable(ColorMode.StarRating);
  const visibleScoreIDs = writable<Set<string>>(new Set());
  const highlightedScoreIDs = writable<Set<string>>(new Set());
  const filterState: Writable<FilterState> = writable(
    usedSavedFilterState
      ? (() => {
          try {
            const parsed = JSON.parse(usedSavedFilterState) as FilterState;
            if (!parsed.mods) {
              parsed.mods = buildDefaultFilterState().mods;
            }
            return parsed;
          } catch (e) {
            return buildDefaultFilterState();
          }
        })()
      : buildDefaultFilterState()
  );
  let dataExtents: DataExtents | null = null;
  let viz: AtlasVizRegl | null = null;
  let leftPaneCollapsed = false;

  let didInitializeFilterState = false;
  $: if ($GlobalCorpus.status === 'loaded' && !didInitializeFilterState) {
    dataExtents = computeDataExtents($GlobalCorpus.data);
    if (!usedSavedFilterState) {
      $filterState = { ...$filterState, ...JSON.parse(JSON.stringify(dataExtents)) };
      didInitializeFilterState = true;
    }
  }

  $: viz?.setColorMode($curColorMode);
  $: viz?.setFilterState($filterState);

  const persistFilterState = () => void localStorage.setItem('filter-state', JSON.stringify($filterState));
  if (browser) {
    window.onbeforeunload = persistFilterState;
  }

  // save filter state to local storage, but debounced to avoid excessive writes
  let saveFilterStateTimeout: number | null = null;
  $: if (browser) {
    if (saveFilterStateTimeout) {
      clearTimeout(saveFilterStateTimeout);
    }
    saveFilterStateTimeout = setTimeout(persistFilterState, 500);
  }

  $: selectedScoreGlobalIx = $selectedScoreIx !== null ? viz?.getGlobalScoreIx($selectedScoreIx) ?? null : null;

  const handleCanvasClick = () => {
    $configureColorsOpen = false;
  };

  const renderViz = (canvas: HTMLCanvasElement) => {
    if (viz) {
      viz.destroy();
    }
    viz = new AtlasVizRegl(
      canvas,
      $curColorMode,
      selectedScoreIx,
      activeUserID,
      visibleScoreIDs,
      highlightedScoreIDs,
      $filterState,
      handleCanvasClick,
      (window as any).lastTransformationMatrix
    );
  };

  onDestroy(() => {
    if (viz) {
      (window as any).lastTransformationMatrix = viz.transformMatrix;
      viz.destroy();
    }
  });
</script>

<svelte:window bind:innerWidth={windowWidth} bind:innerHeight={windowHeight} />

<LocalStorage bind:value={$curColorMode} key="color-mode" />

{#if windowWidth > 0 && windowHeight > 0}
  <canvas
    width={windowWidth * dpr}
    height={windowHeight * dpr}
    style="width: {windowWidth}px; height: {windowHeight}px; touch-action: none; user-select: none;"
    use:renderViz
  ></canvas>
  {#if windowWidth >= 600 && dataExtents && $GlobalCorpus.status === 'loaded'}
    {#if leftPaneCollapsed}
      <CollapsedLeftPane
        expandSidebar={() => {
          leftPaneCollapsed = false;
        }}
      />
    {:else}
      <LeftPane
        collapseSidebar={() => {
          leftPaneCollapsed = true;
        }}
        {filterState}
        {dataExtents}
        corpus={$GlobalCorpus.data}
        onBeatmapSelect={(globalScoreIx) => viz?.selectAndFlyToScore(globalScoreIx)}
        visibleScoreIDs={$visibleScoreIDs}
        highlightedScoreIDs={$highlightedScoreIDs}
        {curColorMode}
      />
    {/if}
  {/if}
  <TopControls onSubmit={(username) => viz?.setActiveUsername(username)} />
  {#if windowWidth < 600}
    <ConfigureColors {curColorMode} configuratorOpen={configureColorsOpen} />
  {/if}
  {#if selectedScoreGlobalIx !== null && $GlobalCorpus.status === 'loaded'}
    <SelectedBeatmapInfo
      corpus={$GlobalCorpus.data}
      selectedScoreIx={selectedScoreGlobalIx}
      activeUserID={$activeUserID}
    />
  {/if}
{/if}

{#if !browser || $GlobalCorpus.status === 'loading' || $GlobalCorpus.status === 'notFetched'}
  <p>Loading visualization...</p>
  <Info />
{:else if $GlobalCorpus.status === 'error'}
  <p>Error: {$GlobalCorpus.error}</p>
{/if}

<style lang="css">
  @media (max-width: 839px) {
    :global(.color-legend, .configure-colors) {
      top: 33px !important;
    }
  }
</style>
