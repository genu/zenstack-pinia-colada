import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        vue: 'src/vue.ts',
    },
    outDir: 'dist',
    splitting: false,
    sourcemap: true,
    clean: true,
    dts: true,
    format: ['cjs', 'esm'],
});
