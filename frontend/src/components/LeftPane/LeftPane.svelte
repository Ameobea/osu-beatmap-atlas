<script lang="ts">
  import { Button } from 'carbon-components-svelte';
  import ChevronLeft from 'carbon-icons-svelte/lib/ChevronLeft.svelte';

  import type { Writable } from 'svelte/store';
  import type { FilterState } from '../../viz/AtlasVizRegl';
  import Filters from './Filters/Filters.svelte';

  export let collapseSidebar: () => void;
  export let filterState: Writable<FilterState>;
  export let dataExtents: FilterState;
</script>

<div class="root">
  <div style="flex: 0; margin-bottom: 16px; margin-left: auto; margin-right: -2px">
    <Button
      tooltipPosition="right"
      iconDescription="Collapse sidebar"
      size="small"
      kind="tertiary"
      icon={ChevronLeft}
      on:click={collapseSidebar}
    />
  </div>
  <Filters {filterState} {dataExtents} />
</div>

<style lang="css">
  .root {
    height: 100vh;
    position: absolute;
    left: 0;
    top: 0;
    display: flex;
    flex-direction: column;
    background: rgba(10, 10, 10, 0.86);
    margin-top: 70px;
    padding: 4px 6px 4px 4px;
    border-right: 1px solid #64646488;
    border-top: 1px solid #64646488;
  }
</style>