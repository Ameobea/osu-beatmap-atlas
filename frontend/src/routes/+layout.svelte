<script lang="ts">
  import { browser } from '$app/environment';
  import 'carbon-components-svelte/css/g100.css';
  import { onMount } from 'svelte';
  import './reset.css';

  onMount(() => {
    if (browser) {
      // loadCorpus('/corpus');
    }
  });
</script>

<slot />
