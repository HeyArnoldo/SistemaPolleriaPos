import { defineConfig } from 'tsup';

// Build dual CJS+ESM: apps/api (CommonJS) y apps/web / Vite (ESM) consumen este paquete.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  // axios es una dependencia runtime — no lo bundleamos.
  external: ['axios', 'zod'],
});
