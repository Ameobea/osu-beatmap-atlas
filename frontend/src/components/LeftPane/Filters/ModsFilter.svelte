<script lang="ts">
  // Matches the osu! profile page in functionality
  //
  // If all are deselected, all mod combinations are included.
  //
  // If just "nomod" is selected, then only nomod scores are included
  //
  // If nomod is not selected but other mods are selected, then scores with any mod combination that includes all of the selected mods are included
  //
  // If nomod is selected along with other mods, then only scores with mod combinations that exactly match the selected mods are included

  import type { FilterState } from '../../../viz/AtlasVizRegl';
  import ModFilterIcon from './ModFilterIcon.svelte';

  export let state: FilterState['mods'];
</script>

<div class="root">
  <ModFilterIcon bind:selected={state.nomod}>∅</ModFilterIcon>
  <ModFilterIcon bind:selected={state.DT}>DT</ModFilterIcon>
  <ModFilterIcon bind:selected={state.HR}>HR</ModFilterIcon>
  <ModFilterIcon bind:selected={state.EZ}>EZ</ModFilterIcon>
  <ModFilterIcon bind:selected={state.FL}>FL</ModFilterIcon>
</div>

<style lang="css">
  .root {
    display: flex;
    flex-direction: row;
    gap: 10px;
    justify-content: center;
    flex: 1;
    padding: 4px 8px;
    margin-top: 6px;
  }
</style>
