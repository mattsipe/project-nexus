// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://project-nexus.netlify.app',
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
  // Games in public/games/** are copied verbatim and never touched by the bundler.
  build: { inlineStylesheets: 'auto' },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
});
