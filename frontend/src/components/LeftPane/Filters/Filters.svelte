<script lang="ts">
  import type { Writable } from 'svelte/store';
  import type { FilterState } from '../../../viz/AtlasVizRegl';
  import Filter from './Filter.svelte';

  export let filterState: Writable<FilterState>;
  export let dataExtents: FilterState;

  const floorWithPrecision = (value: number, precision: number) => {
    const multiplier = 10 ** precision;
    return Math.floor(value * multiplier) / multiplier;
  };

  const ceilWithPrecision = (value: number, precision: number) => {
    const multiplier = 10 ** precision;
    return Math.ceil(value * multiplier) / multiplier;
  };
</script>

<div class="root">
  <h3>Filters</h3>
  <Filter
    label="Average PP"
    min={Math.floor(dataExtents.pp[0])}
    max={Math.ceil(dataExtents.pp[1])}
    bind:value={$filterState.pp}
    step={1}
  />
  <Filter
    label="Stars"
    min={floorWithPrecision(dataExtents.stars[0], 2)}
    max={floorWithPrecision(dataExtents.stars[1], 2)}
    bind:value={$filterState.stars}
    step={0.05}
  />
  <Filter
    label="Aim/Speed Ratio"
    min={floorWithPrecision(dataExtents.aimSpeedRatio[0], 2)}
    max={ceilWithPrecision(dataExtents.aimSpeedRatio[1], 2)}
    bind:value={$filterState.aimSpeedRatio}
    step={0.01}
  />
  <Filter
    label="Length (inc. mods)"
    min={Math.floor(dataExtents.lengthSeconds[0])}
    max={Math.ceil(dataExtents.lengthSeconds[1])}
    bind:value={$filterState.lengthSeconds}
    step={5}
    formatLabel={(v) => {
      const minutes = Math.floor(v / 60);
      const seconds = v % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }}
  />
  <Filter
    label="BPM"
    min={Math.floor(dataExtents.bpm[0])}
    max={Math.ceil(dataExtents.bpm[1])}
    bind:value={$filterState.bpm}
    step={1}
  />
  <Filter
    label="Release Year"
    min={Math.floor(dataExtents.releaseYear[0])}
    max={Math.ceil(dataExtents.releaseYear[1])}
    bind:value={$filterState.releaseYear}
    step={1}
  />
</div>

<style lang="css">
  .root {
    display: flex;
    flex-direction: column;
  }

  h3 {
    margin-bottom: 4px;
    font-size: 1.25rem;
  }
</style>
