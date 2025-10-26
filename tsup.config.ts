import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/utils/**/*.ts', 'src/axios/index.ts'],
  format: ['cjs', 'esm'],
  clean: true,
  splitting: false,
  legacyOutput: true,
});
