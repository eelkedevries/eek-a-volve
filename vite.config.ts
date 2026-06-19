import { defineConfig } from 'vite';

// Served from GitHub Pages at https://<user>.github.io/eek-a-volve/, so assets
// must resolve under the project base path. See AGENTS.md Project conventions.
export default defineConfig({
  base: '/eek-a-volve/',
});
