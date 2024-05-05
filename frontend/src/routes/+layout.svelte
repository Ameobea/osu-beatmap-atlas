<script lang="ts">
  import { browser } from '$app/environment';
  import 'carbon-components-svelte/css/g100.css';
  import { onMount } from 'svelte';
  import { loadCorpus } from '../corpus';
  import './reset.css';

  onMount(() => {
    if (browser) {
      loadCorpus();
    }
  });
</script>

<slot />
