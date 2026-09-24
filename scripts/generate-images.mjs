/**
 * Generates every logo image from images/logo.svg:
 *
 * - images/icon.png            256×256, the extension icon and the README logo
 * - web/assets/favicon.svg     tight crop without shadow, for browser tabs and the site header
 * - web/assets/favicon.ico     16, 32 and 48 px versions of the favicon
 * - web/assets/apple-touch-icon.png  180×180, full-bleed (iOS rounds the corners itself)
 * - web/assets/og-image.png    1200×630 link preview for Slack, X, LinkedIn and others
 *
 * Renders with headless Chrome. Run it after changing the logo: `npm run images`.
 * Set CHROME to the browser binary if it is not in the default macOS location.
 */
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const logo = await readFile(join(root, 'images/logo.svg'), 'utf8');

/** The logo's rounded square spans 20..236 of the 256 viewBox; the rest is padding and shadow. */
const tight = logo
  .replace('viewBox="0 0 256 256"', 'viewBox="20 20 216 216"')
  .replace(' filter="url(#shadow)"', '');

/** Square corners for iOS, which masks the icon itself and fills transparency with black. */
const square = tight.replaceAll(/ rx="52" ry="52"/g, '');

const workDir = await mkdtemp(join(tmpdir(), 'html-to-css-images-'));

/** Screenshots `html` at exactly `width`×`height`, keeping transparency. */
async function render(name, html, width, height) {
  const page = join(workDir, `${name}.html`);
  const output = join(workDir, `${name}.png`);
  await writeFile(page, html);
  execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--default-background-color=00000000',
      '--force-device-scale-factor=1',
      `--window-size=${width},${height}`,
      `--screenshot=${output}`,
      `file://${page}`,
    ],
    { stdio: 'ignore' }
  );
  return readFile(output);
}

function svgPage(svg, size) {
  return `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`;
}

/** An .ico file holding PNG images, supported by every current browser. */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

const ogImage = `<!doctype html>
<style>
  html, body { margin: 0; }
  body {
    width: 1200px; height: 630px; box-sizing: border-box; padding: 64px 72px;
    display: grid; grid-template-columns: 1fr 470px; gap: 48px; align-items: center;
    background: radial-gradient(circle at 15% 20%, #1e3a8a 0%, transparent 45%),
      linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
    color: #f8fafc; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .logo { width: 132px; height: 132px; margin: -12px 0 12px -12px; }
  .logo svg { width: 100%; height: 100%; }
  h1 { margin: 0; font-size: 60px; line-height: 1.05; letter-spacing: -1.5px; }
  h1 span { background: linear-gradient(90deg, #22d3ee, #818cf8); -webkit-background-clip: text; color: transparent; }
  p { margin: 20px 0 0; font-size: 26px; line-height: 1.4; color: #cbd5e1; }
  .code { display: grid; gap: 14px; }
  pre {
    margin: 0; padding: 20px 24px; border-radius: 16px; font: 20px/1.5 Menlo, Consolas, monospace;
    background: rgb(15 23 42 / 0.75); border: 1px solid rgb(148 163 184 / 0.25); color: #e2e8f0;
  }
  .swap { justify-self: center; font-size: 30px; color: #22d3ee; line-height: 1; }
  .t { color: #f472b6; } .a { color: #7dd3fc; } .s { color: #a5f3fc; } .c { color: #c4b5fd; }
</style>
<div>
  <div class="logo">${logo}</div>
  <h1>HTML <span>⇄</span> CSS,<br />SCSS &amp; LESS</h1>
  <p>Turn markup into selectors and back.<br />Free online and in VS Code.</p>
</div>
<div class="code">
<pre>&lt;<span class="t">div</span> <span class="a">class</span>=<span class="s">"card"</span>&gt;
  &lt;<span class="t">h2</span> <span class="a">class</span>=<span class="s">"card__title"</span>&gt;&lt;/<span class="t">h2</span>&gt;
&lt;/<span class="t">div</span>&gt;</pre>
<div class="swap">⇅</div>
<pre><span class="c">.card</span> {
  <span class="c">&amp;__title</span> {}
}</pre>
</div>`;

try {
  await mkdir(join(root, 'web/assets'), { recursive: true });

  await writeFile(
    join(root, 'images/icon.png'),
    await render('icon', svgPage(logo, 256), 256, 256)
  );
  await writeFile(join(root, 'web/assets/favicon.svg'), `${tight.trim()}\n`);

  const icoImages = await Promise.all(
    [16, 32, 48].map(async size => ({
      size,
      png: await render(`favicon-${size}`, svgPage(tight, size), size, size),
    }))
  );
  await writeFile(join(root, 'web/assets/favicon.ico'), buildIco(icoImages));

  await writeFile(
    join(root, 'web/assets/apple-touch-icon.png'),
    await render('apple-touch-icon', svgPage(square, 180), 180, 180)
  );
  await writeFile(
    join(root, 'web/assets/og-image.png'),
    await render('og-image', ogImage, 1200, 630)
  );

  console.log('Generated images/icon.png and web/assets/*');
} finally {
  await rm(workDir, { recursive: true, force: true });
}
