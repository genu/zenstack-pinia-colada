import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: {
        index: 'src/index.ts',
    },
    outDir: 'dist',
    sourcemap: true,
    clean: true,
    dts: true,
    format: ['esm'],
});
