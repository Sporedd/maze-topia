import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Only the GitHub Pages build needs the repo sub-path; dev/preview serve at root.
  base: command === 'build' ? '/maze-topia/' : '/',
  server: {
    hmr: false,
  },
}));
