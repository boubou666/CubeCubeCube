import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.PAGES_BASE_PATH || '/',
  build: { rolldownOptions: { input: { main: 'index.html', cube: 'cube.html', image: 'image.html', colony: 'colony.html' } } },
});
