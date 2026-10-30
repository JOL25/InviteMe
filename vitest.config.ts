import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/**/*.test.ts'],
    // Each SQL suite boots its own WASM database and applies every migration.
    maxWorkers: 4,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
