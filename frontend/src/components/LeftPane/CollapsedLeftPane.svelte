<script lang="ts">
  import { Button } from 'carbon-components-svelte';
  import ChevronRight from 'carbon-icons-svelte/lib/ChevronRight.svelte';

  export let expandSidebar: () => void;
</script>

<div class="root">
  <Button
    tooltipPosition="right"
    iconDescription="Expand sidebar"
    size="small"
    kind="tertiary"
    icon={ChevronRight}
    on:click={expandSidebar}
  />
</div>

<style lang="css">
  .root {
    position: absolute;
    top: 0;
    padding-top: 80px;
  }
</style>
