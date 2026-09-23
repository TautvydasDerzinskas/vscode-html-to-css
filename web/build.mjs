/**
 * Builds the static website into web/dist.
 *
 * The options form is generated from the extension's `contributes.configuration`, and the
 * first example is converted at build time with the extension's own converter, so the page
 * carries real content and a working form before any JavaScript runs.
 */
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import { EXAMPLES } from './examples.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const webDir = `${root}web/`;
const outDir = `${webDir}dist/`;

const production = !process.argv.includes('--serve');
const siteUrl = (
  process.env.SITE_URL ?? 'https://tautvydasderzinskas.github.io/vscode-html-to-css/'
).replace(/\/?$/, '/');

const DEFAULT_FORMAT = 'scss';
const FORMATS = [
  { id: 'css', label: 'CSS' },
  { id: 'scss', label: 'SCSS / Sass' },
  { id: 'less', label: 'LESS' },
];

/** Words that read better upper-cased in option titles. */
const ACRONYMS = new Set(['bem', 'html', 'css']);

const escapeHtml = value =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** `preappendHtml` -> `Preappend HTML`. */
function toTitle(key) {
  const words = key.split(/(?<=[a-z])(?=[A-Z])/).map(word => word.toLowerCase());
  return words
    .map((word, index) => {
      if (ACRONYMS.has(word)) {
        return word.toUpperCase();
      }
      return index === 0 ? word[0].toUpperCase() + word.slice(1) : word;
    })
    .join(' ');
}

/** Plain or markdown description, with `code` spans kept as <code>. */
function toDescriptionHtml(property) {
  const text = property.description ?? property.markdownDescription ?? '';
  return escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>');
}

function readOptionDefinitions(packageJson) {
  const prefix = 'htmlToCss.';
  return Object.entries(packageJson.contributes.configuration.properties).map(
    ([name, property]) => ({
      key: name.slice(prefix.length),
      type: property.type,
      defaultValue: property.default,
      title: toTitle(name.slice(prefix.length)),
      descriptionHtml: toDescriptionHtml(property),
    })
  );
}

function renderOption(option) {
  const id = `option-${option.key}`;

  if (option.type === 'boolean') {
    return `<div class="option">
          <label class="toggle" for="${id}">
            <input type="checkbox" role="switch" id="${id}" name="${option.key}" data-option="${option.key}" data-type="boolean"${option.defaultValue ? ' checked' : ''} />
            <span class="toggle__track" aria-hidden="true"></span>
            <span class="toggle__title">${option.title}</span>
          </label>
          <p class="option__description">${option.descriptionHtml}</p>
        </div>`;
  }

  if (option.type === 'array') {
    return `<div class="option">
          <label class="option__title" for="${id}">${option.title}</label>
          <input type="text" class="text-input" id="${id}" name="${option.key}" data-option="${option.key}" data-type="array" value="${escapeHtml(option.defaultValue.join(', '))}" placeholder=".container, .text-center, p" spellcheck="false" autocomplete="off" />
          <p class="option__description">${option.descriptionHtml} Separate entries with commas.</p>
        </div>`;
  }

  throw new Error(`Unsupported option type "${option.type}" for ${option.key}`);
}

function renderFormats() {
  return FORMATS.map(
    format => `<label class="segmented__item">
            <input type="radio" name="format" value="${format.id}"${format.id === DEFAULT_FORMAT ? ' checked' : ''} />
            <span>${format.label}</span>
          </label>`
  ).join('\n          ');
}

function renderExampleButtons() {
  return EXAMPLES.map(
    example =>
      `<button type="button" class="chip" data-example="${example.id}">${example.label}</button>`
  ).join('\n            ');
}

/** Loads the extension's converter into this Node process. */
async function loadConverter() {
  const result = await esbuild.build({
    entryPoints: [`${root}src/services/html-converter.service.ts`],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'warning',
  });
  const source = Buffer.from(result.outputFiles[0].contents).toString('base64');
  const module = await import(`data:text/javascript;base64,${source}`);
  return module.default;
}

async function renderPage(options) {
  const HtmlConverterService = await loadConverter();
  const defaults = Object.fromEntries(options.map(option => [option.key, option.defaultValue]));
  const example = EXAMPLES[0];
  const exampleOutput = new HtmlConverterService(defaults).convert(example.code, DEFAULT_FORMAT);

  const template = await readFile(`${webDir}index.html`, 'utf8');
  const replacements = {
    SITE_URL: siteUrl,
    OPTIONS: options.map(renderOption).join('\n        '),
    FORMATS: renderFormats(),
    EXAMPLE_BUTTONS: renderExampleButtons(),
    EXAMPLE_INPUT: escapeHtml(example.code),
    EXAMPLE_OUTPUT: escapeHtml(exampleOutput),
  };

  return template.replace(/\{\{(\w+)\}\}/g, (match, name) => {
    if (!(name in replacements)) {
      throw new Error(`Unknown template placeholder ${match}`);
    }
    return replacements[name];
  });
}

function renderSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
}

function renderRobots() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`;
}

const bundleOptions = {
  entryPoints: { app: `${webDir}main.ts`, styles: `${webDir}styles.css` },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020', 'chrome100', 'firefox100', 'safari15'],
  outdir: outDir,
  minify: production,
  sourcemap: !production,
  logLevel: 'warning',
};

const packageJson = JSON.parse(await readFile(`${root}package.json`, 'utf8'));
const options = readOptionDefinitions(packageJson);

await rm(outDir, { recursive: true, force: true });
await mkdir(`${outDir}images`, { recursive: true });

await Promise.all([
  renderPage(options).then(html => writeFile(`${outDir}index.html`, html)),
  writeFile(`${outDir}sitemap.xml`, renderSitemap()),
  writeFile(`${outDir}robots.txt`, renderRobots()),
  // Serve files as-is: GitHub Pages would otherwise run them through Jekyll.
  writeFile(`${outDir}.nojekyll`, ''),
  copyFile(`${root}images/html2css_transparent.png`, `${outDir}images/icon.png`),
  copyFile(`${root}images/html2css_preview.gif`, `${outDir}images/preview.gif`),
]);

if (production) {
  await esbuild.build(bundleOptions);
  console.log(`Website built into ${outDir} for ${siteUrl}`);
} else {
  const context = await esbuild.context(bundleOptions);
  await context.watch();
  const { hosts, port } = await context.serve({ servedir: outDir });
  console.log(`Serving the website on http://${hosts[0]}:${port}/ (HTML changes need a restart)`);
}
