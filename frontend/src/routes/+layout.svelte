<script lang="ts">
  import { browser } from '$app/environment';
  import 'carbon-components-svelte/css/g100.css';
  import { onMount } from 'svelte';

  import { loadCorpus } from '../corpus';
  import { initSentry } from '../sentry';
  import { getCorpusVersion, getCorpusVersionStore } from '../util';
  import './reset.css';

  const corpusVersion = getCorpusVersion();
  const corpusVersionStore = getCorpusVersionStore();

  $: {
    if (browser && $corpusVersionStore !== corpusVersion) {
      window.location.reload();
    }
  }

  onMount(() => {
    initSentry();

    if (browser) {
      loadCorpus(corpusVersion);
    }
  });
</script>

<slot />
