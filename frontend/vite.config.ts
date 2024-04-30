import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  plugins: [sveltekit(), glsl()],
  optimizeDeps: {
    exclude: ['carbon-components-svelte', 'carbon-icons-svelte', 'carbon-pictograms-svelte'],
  },
});
