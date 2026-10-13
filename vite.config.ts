import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/main.tsx',
        'src/photo/photo.worker.ts',
      ],
      thresholds: {
        statements: 43,
        branches: 46,
        functions: 33,
        lines: 43,
      },
    },
    benchmark: {
      include: ['src/**/*.{bench,benchmark}.{ts,tsx}'],
    },
  },
})
