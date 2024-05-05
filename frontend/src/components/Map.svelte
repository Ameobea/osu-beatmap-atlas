<script lang="ts">
  import { browser } from '$app/environment';
  import { onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import { GlobalCorpus } from '../corpus';
  import { AtlasVizRegl } from '../viz/AtlasVizRegl';
  import SelectedBeatmapInfo from './SelectedBeatmapInfo.svelte';
  import TopControls from './TopControls.svelte';

  let windowWidth = 0;
  let windowHeight = 0;
  const dpr = browser ? window.devicePixelRatio || 1 : 1;
  const selectedScoreIx = writable<number | null>(null);

  let viz: AtlasVizRegl | null = null;
  const renderViz = (canvas: HTMLCanvasElement) => {
    if (viz) {
      viz.destroy();
    }
    viz = new AtlasVizRegl(canvas, selectedScoreIx, (window as any).lastTransformationMatrix);
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
  <TopControls onSubmit={(username) => viz?.setActiveUsername(username)} />
  {#if $selectedScoreIx !== null && $GlobalCorpus.status === 'loaded'}
    <SelectedBeatmapInfo corpus={$GlobalCorpus.data} selectedScoreIx={$selectedScoreIx} />
  {/if}
{/if}

{#if !browser || $GlobalCorpus.status === 'loading' || $GlobalCorpus.status === 'notFetched'}
  <p>Loading...</p>
{:else if $GlobalCorpus.status === 'error'}
  <p>Error: {$GlobalCorpus.error}</p>
{/if}
