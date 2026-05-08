import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // setupFiles runs inside each worker before the test file's imports are
    // evaluated, so module-level code (e.g. multer init) sees these env vars.
    setupFiles: ['./src/test-setup.ts'],
  },
});
