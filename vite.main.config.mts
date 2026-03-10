import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': '/src/shared',
    },
  },
  build: {
    rollupOptions: {
      external: [
        '@anthropic-ai/sdk',
        '@anthropic-ai/claude-agent-sdk',
        'better-sqlite3',
        'node-pty',
      ],
    },
  },
});
