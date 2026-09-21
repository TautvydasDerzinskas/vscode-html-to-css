import esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/** Reports build failures with file/line info during watch mode. */
const problemMatcherPlugin = {
  name: 'problem-matcher',
  setup(build) {
    build.onStart(() => {
      console.log(`[${new Date().toLocaleTimeString()}] build started`);
    });
    build.onEnd(result => {
      for (const { text, location } of result.errors) {
        console.error(`✘ ${text}`);
        if (location) {
          console.error(`    ${location.file}:${location.line}:${location.column}`);
        }
      }
      console.log(`[${new Date().toLocaleTimeString()}] build finished`);
    });
  },
};

const context = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  // Matches the Node version shipped in the VS Code versions we support.
  target: 'node20',
  outfile: 'dist/extension.js',
  // Provided by the extension host, never bundled.
  external: ['vscode'],
  minify: production,
  sourcemap: !production,
  sourcesContent: false,
  logLevel: 'warning',
  plugins: [problemMatcherPlugin],
});

if (watch) {
  await context.watch();
} else {
  await context.rebuild();
  await context.dispose();
}
