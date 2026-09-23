import HtmlConverterService from '../src/services/html-converter.service';
import IOptions from '../src/interfaces/options.interface';
import { EXAMPLES } from './examples.mjs';

const STORAGE_KEY = 'html-to-css:settings';

interface StoredSettings {
  format?: string;
  options?: Partial<IOptions>;
}

const form = document.querySelector<HTMLFormElement>('#converter')!;
const input = document.querySelector<HTMLTextAreaElement>('#input')!;
const output = document.querySelector<HTMLTextAreaElement>('#output')!;
const status = document.querySelector<HTMLElement>('#status')!;
const outputFormatLabel = document.querySelector<HTMLElement>('#output-format')!;
const copyButton = document.querySelector<HTMLButtonElement>('#copy')!;
const clearButton = document.querySelector<HTMLButtonElement>('#clear')!;
const optionFields = Array.from(document.querySelectorAll<HTMLInputElement>('[data-option]'));
const formatFields = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[name="format"]')
);

function readOptions(): Partial<IOptions> {
  const options: Record<string, unknown> = {};
  for (const field of optionFields) {
    const key = field.dataset.option!;
    options[key] =
      field.dataset.type === 'array'
        ? field.value
            .split(',')
            .map(selector => selector.trim())
            .filter(Boolean)
        : field.checked;
  }
  return options as Partial<IOptions>;
}

function readFormat(): string {
  return formatFields.find(field => field.checked)?.value ?? 'scss';
}

function showStatus(message: string, tone: 'success' | 'warning' | 'error'): void {
  status.textContent = message;
  status.dataset.tone = tone;
}

function convert(): void {
  const format = readFormat();
  outputFormatLabel.textContent = format.toUpperCase();

  const markup = input.value;
  if (!markup.trim()) {
    output.value = '';
    showStatus('Paste some HTML, JSX or template markup first.', 'error');
    return;
  }

  const converter = new HtmlConverterService(readOptions());
  if (!converter.isStringHtml(markup)) {
    output.value = '';
    showStatus('That does not look like HTML markup.', 'error');
    return;
  }

  const converted = converter.convert(markup, format);
  output.value = converted;
  if (converted) {
    const count = converted.split('\n').filter(line => line.includes('{')).length;
    showStatus(
      `Generated ${count} ${format.toUpperCase()} selector${count === 1 ? '' : 's'}.`,
      'success'
    );
  } else {
    showStatus('The markup has no elements to convert with these options.', 'warning');
  }
}

function saveSettings(): void {
  const settings: StoredSettings = { format: readFormat(), options: readOptions() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable (private mode, blocked site data); settings just don't persist.
  }
}

function restoreSettings(): void {
  let settings: StoredSettings;
  try {
    settings = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as StoredSettings;
  } catch {
    return;
  }

  for (const field of formatFields) {
    if (field.value === settings.format) {
      field.checked = true;
    }
  }

  const options = (settings.options ?? {}) as Record<string, unknown>;
  for (const field of optionFields) {
    const value = options[field.dataset.option!];
    if (field.dataset.type === 'array' && Array.isArray(value)) {
      field.value = value.join(', ');
    } else if (typeof value === 'boolean') {
      field.checked = value;
    }
  }
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

copyButton.addEventListener('click', () => void copyOutput());

clearButton.addEventListener('click', () => {
  input.value = '';
  output.value = '';
  status.textContent = '';
  input.focus();
});

restoreSettings();
// The static page ships output for the defaults; redo it in case saved settings differ.
convert();
