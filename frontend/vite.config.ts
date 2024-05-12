import { sveltekit } from '@sveltejs/kit/vite';
import { optimizeCss } from 'carbon-preprocess-svelte';
import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  plugins: [sveltekit(), glsl(), optimizeCss()],
  optimizeDeps: {
    exclude: ['carbon-components-svelte', 'carbon-icons-svelte', 'carbon-pictograms-svelte'],
  },
  build: {
    sourcemap: true,
  },
});
