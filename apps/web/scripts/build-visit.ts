import { build } from 'esbuild';

await build({
  entryPoints: ['src/analytics/visit-script.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2022',
  outfile: 'public/visit.js',
  logLevel: 'warning',
});
