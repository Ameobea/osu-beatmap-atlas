<script lang="ts">
  import Filter from './Filter.svelte';

  let ppRange: [number, number] = [70, 1400];
</script>

<div class="root">
  <Filter min={70} max={1400} bind:value={ppRange} />
</div>

<style lang="css">
  .root {
    display: flex;
    flex-direction: column;
  }
</style>
