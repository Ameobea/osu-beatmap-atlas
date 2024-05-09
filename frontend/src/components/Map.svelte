<script lang="ts">
  import { browser } from '$app/environment';
  import { ColorMode } from '$lib';
  import { onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import { GlobalCorpus } from '../corpus';
  import { AtlasVizRegl } from '../viz/AtlasVizRegl';
  import ConfigureColors from './ConfigureColors.svelte';
  import SelectedBeatmapInfo from './SelectedBeatmapInfo.svelte';
  import TopControls from './TopControls.svelte';

  let windowWidth = 0;
  let windowHeight = 0;
  const dpr = browser ? window.devicePixelRatio || 1 : 1;
  const selectedScoreIx = writable<number | null>(null);
  const activeUserID = writable<number | null>(null);
  const configureColorsOpen = writable(false);

  let curColorMode = writable(ColorMode.AveragePP);
  let viz: AtlasVizRegl | null = null;

  $: viz?.setColorMode($curColorMode);

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

{#if windowWidth > 0 && windowHeight > 0}
  <canvas
    width={windowWidth * dpr}
    height={windowHeight * dpr}
    style="width: {windowWidth}px; height: {windowHeight}px; touch-action: none; user-select: none;"
    use:renderViz
  ></canvas>
  <!-- <LeftPane /> -->
  <TopControls onSubmit={(username) => viz?.setActiveUsername(username)} />
  <ConfigureColors {curColorMode} configuratorOpen={configureColorsOpen} />
  {#if $selectedScoreIx !== null && $GlobalCorpus.status === 'loaded'}
    <SelectedBeatmapInfo corpus={$GlobalCorpus.data} selectedScoreIx={$selectedScoreIx} activeUserID={$activeUserID} />
  {/if}
{/if}

{#if !browser || $GlobalCorpus.status === 'loading' || $GlobalCorpus.status === 'notFetched'}
  <p>Loading...</p>
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
