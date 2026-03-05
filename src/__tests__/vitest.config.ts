import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setupTests.ts'],
    globals: true,
    coverage: {
      enabled: true,
      provider: 'v8',
      exclude: ['node_modules/', 'src/__tests__/setupTests.ts'],
    },
  },
});