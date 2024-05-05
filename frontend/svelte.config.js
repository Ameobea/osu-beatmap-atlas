import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { optimizeImports } from 'carbon-preprocess-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://kit.svelte.dev/docs/integrations#preprocessors
  // for more information about preprocessors
  preprocess: [
    vitePreprocess(),
    // \/ Won't work until this is fixed:
    // https://github.com/carbon-design-system/carbon-preprocess-svelte/issues/61
    optimizeImports(),
  ],

  kit: {
    adapter: adapter(),
  },
};

export default config;
