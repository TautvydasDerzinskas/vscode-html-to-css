import HtmlConverterService from '../src/services/html-converter.service';
import CssToHtmlService, { MarkupSyntax } from '../src/services/css-to-html.service';
import { EXAMPLES } from './examples.mjs';

type Direction = 'html-to-css' | 'css-to-html';

const STORAGE_KEY = 'html-to-css:settings';
/** Opening the page at this hash starts it in the CSS -> HTML direction. */
const REVERSE_HASH = '#css-to-html';

interface StoredSettings {
  direction?: Direction;
  formats?: Partial<Record<Direction, string>>;
  options?: Record<string, unknown>;
}

/** Everything on the page that changes with the direction. */
const COPY: Record<
  Direction,
  { input: string; placeholder: string; switchLabel: string; empty: string }
> = {
  'html-to-css': {
    input: 'HTML, JSX or template markup',
    placeholder: 'Paste your HTML, JSX, Vue, Twig or Handlebars markup here…',
    switchLabel: 'Switch direction: convert CSS to HTML',
    empty: 'Paste some HTML, JSX or template markup first.',
  },
  'css-to-html': {
    input: 'CSS, SCSS or LESS',
    placeholder: 'Paste your CSS, SCSS or LESS here…',
    switchLabel: 'Switch direction: convert HTML to CSS',
    empty: 'Paste some CSS, SCSS or LESS first.',
  },
};

const form = document.querySelector<HTMLFormElement>('#converter')!;
const input = document.querySelector<HTMLTextAreaElement>('#input')!;
const output = document.querySelector<HTMLTextAreaElement>('#output')!;
const status = document.querySelector<HTMLElement>('#status')!;
const inputLabel = document.querySelector<HTMLElement>('#input-label')!;
const outputFormatLabel = document.querySelector<HTMLElement>('#output-format')!;
const switchButton = document.querySelector<HTMLButtonElement>('#switch-direction')!;
const copyButton = document.querySelector<HTMLButtonElement>('#copy')!;
const clearButton = document.querySelector<HTMLButtonElement>('#clear')!;
const optionFields = Array.from(document.querySelectorAll<HTMLInputElement>('[data-option]'));
const formatFields = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[name^="format-"]')
);

let direction: Direction = 'html-to-css';

function readOptions(forDirection: Direction): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  for (const field of optionFields) {
    if (field.dataset.direction !== forDirection) {
      continue;
    }
    const key = field.dataset.option!;
    if (field.dataset.type === 'array') {
      options[key] = field.value
        .split(',')
        .map(selector => selector.trim())
        .filter(Boolean);
    } else if (field.dataset.type === 'string') {
      options[key] = field.value.trim() || field.placeholder;
    } else {
      options[key] = field.checked;
    }
  }
  return options;
}

function readFormat(forDirection: Direction): string {
  return (
    formatFields.find(field => field.dataset.direction === forDirection && field.checked)?.value ??
    ''
  );
}

function showStatus(message: string, tone: 'success' | 'warning' | 'error'): void {
  status.textContent = message;
  status.dataset.tone = tone;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function convertHtmlToCss(markup: string): void {
  const format = readFormat('html-to-css');
  outputFormatLabel.textContent = format.toUpperCase();

  const converter = new HtmlConverterService(readOptions('html-to-css'));
  if (!converter.isStringHtml(markup)) {
    output.value = '';
    showStatus('That does not look like HTML markup.', 'error');
    return;
  }

  const converted = converter.convert(markup, format);
  output.value = converted;
  if (converted) {
    const count = converted.split('\n').filter(line => /\{\}?$/.test(line)).length;
    showStatus(`Generated ${plural(count, `${format.toUpperCase()} selector`)}.`, 'success');
  } else {
    showStatus('The markup has no elements to convert with these options.', 'warning');
  }
}

function convertCssToHtml(css: string): void {
  const syntax = readFormat('css-to-html') as MarkupSyntax;
  outputFormatLabel.textContent = syntax.toUpperCase();

  if (new HtmlConverterService().isStringHtml(css)) {
    output.value = '';
    showStatus('That looks like HTML. Switch direction to convert it to CSS.', 'error');
    return;
  }

  const converted = new CssToHtmlService(readOptions('css-to-html')).convert(css, syntax);
  output.value = converted;
  if (converted) {
    const count = converted.match(/<[a-z]/gi)?.length ?? 0;
    showStatus(`Generated ${plural(count, `${syntax.toUpperCase()} element`)}.`, 'success');
  } else {
    showStatus('That does not look like CSS, SCSS or LESS with selectors.', 'error');
  }
}

function convert(): void {
  if (!input.value.trim()) {
    output.value = '';
    outputFormatLabel.textContent = readFormat(direction).toUpperCase();
    showStatus(COPY[direction].empty, 'error');
    return;
  }

  if (direction === 'html-to-css') {
    convertHtmlToCss(input.value);
  } else {
    convertCssToHtml(input.value);
  }
}

/** Shows the labels, settings and examples for `next`, without touching the text. */
function applyDirection(next: Direction): void {
  direction = next;
  form.dataset.direction = next;
  inputLabel.textContent = COPY[next].input;
  input.placeholder = COPY[next].placeholder;
  switchButton.setAttribute('aria-label', COPY[next].switchLabel);
  switchButton.title = COPY[next].switchLabel;

  try {
    const url = next === 'css-to-html' ? REVERSE_HASH : window.location.pathname;
    history.replaceState(null, '', url);
  } catch {
    // Some sandboxed previews refuse history changes; the hash is only a convenience.
  }
}

/**
 * Flips the direction. What was generated becomes the new input, so HTML -> CSS -> HTML is one
 * click; with nothing generated yet, the first example for the new direction is used.
 */
function switchDirection(): void {
  const next: Direction = direction === 'html-to-css' ? 'css-to-html' : 'html-to-css';
  const carriedOver = output.value.trim()
    ? output.value
    : EXAMPLES.find(example => example.direction === next)?.code;

  applyDirection(next);
  input.value = carriedOver ?? '';
  convert();
  saveSettings();
}

function saveSettings(): void {
  const settings: StoredSettings = {
    direction,
    formats: {
      'html-to-css': readFormat('html-to-css'),
      'css-to-html': readFormat('css-to-html'),
    },
    options: { ...readOptions('html-to-css'), ...readOptions('css-to-html') },
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable (private mode, blocked site data); settings just don't persist.
  }
}

function restoreSettings(): StoredSettings {
  let settings: StoredSettings & { format?: string };
  try {
    settings = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }

  // Settings saved before the CSS -> HTML direction existed had a single `format`.
  const formats = settings.formats ?? { 'html-to-css': settings.format };
  for (const field of formatFields) {
    if (formats[field.dataset.direction as Direction] === field.value) {
      field.checked = true;
    }
  }

  const options = settings.options ?? {};
  for (const field of optionFields) {
    const value = options[field.dataset.option!];
    if (field.dataset.type === 'array' && Array.isArray(value)) {
      field.value = value.join(', ');
    } else if (field.dataset.type === 'string' && typeof value === 'string') {
      field.value = value;
    } else if (typeof value === 'boolean') {
      field.checked = value;
    }
  }
  return settings;
}

async function copyOutput(): Promise<void> {
  if (!output.value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(output.value);
  } catch {
    output.select();
    document.execCommand('copy');
  }
  copyButton.textContent = 'Copied!';
  setTimeout(() => {
    copyButton.textContent = 'Copy';
  }, 1500);
}

form.addEventListener('submit', event => {
  event.preventDefault();
  convert();
});

// Options apply straight away once there is something to convert.
form.addEventListener('change', event => {
  if (event.target === input) {
    return;
  }
  saveSettings();
  if (input.value.trim()) {
    convert();
  }
});

input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    convert();
  }
});

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-example]')) {
  button.addEventListener('click', () => {
    const example = EXAMPLES.find(candidate => candidate.id === button.dataset.example);
    if (example) {
      input.value = example.code;
      convert();
    }
  });
}

switchButton.addEventListener('click', switchDirection);

copyButton.addEventListener('click', () => void copyOutput());

clearButton.addEventListener('click', () => {
  input.value = '';
  output.value = '';
  status.textContent = '';
  input.focus();
});

// In-page links to `#css-to-html` switch the converter and bring it into view.
window.addEventListener('hashchange', () => {
  if (window.location.hash === REVERSE_HASH && direction !== 'css-to-html') {
    output.value = '';
    switchDirection();
    form.scrollIntoView({ behavior: 'smooth' });
  }
});

const saved = restoreSettings();
// A link to `#css-to-html` wins over the direction the visitor last used.
const startDirection: Direction =
  window.location.hash === REVERSE_HASH ? 'css-to-html' : (saved.direction ?? 'html-to-css');
if (startDirection === 'css-to-html') {
  applyDirection('css-to-html');
  input.value = EXAMPLES.find(example => example.direction === 'css-to-html')?.code ?? '';
}
// The static page ships output for the default settings; redo it in case saved ones differ.
convert();
