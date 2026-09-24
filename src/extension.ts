import * as vscode from 'vscode';
import HtmlConverterService from './services/html-converter.service';
import CssToHtmlService, { MarkupSyntax } from './services/css-to-html.service';
import IOptions from './interfaces/options.interface';
import ICssToHtmlOptions from './interfaces/css-to-html-options.interface';
import { ContextKeys, getSelectedText } from './context-keys';

/** Language ids we can paste into, mapped to the output flavour to generate. */
const OUTPUT_BY_LANGUAGE_ID: Record<string, string> = {
  css: 'css',
  postcss: 'css',
  less: 'less',
  scss: 'scss',
  sass: 'scss',
};

/** Fallback for documents whose language id is not set (e.g. plain text buffers). */
const OUTPUT_BY_EXTENSION: Record<string, string> = {
  css: 'css',
  less: 'less',
  scss: 'scss',
  sass: 'scss',
};

/** Documents that get JSX (`className`) instead of HTML when CSS is pasted as markup. */
const REACT_LANGUAGE_IDS = new Set(['javascriptreact', 'typescriptreact']);
const REACT_EXTENSIONS = new Set(['jsx', 'tsx']);

function readOptions(scope: vscode.Uri | undefined): IOptions {
  const configuration = vscode.workspace.getConfiguration('htmlToCss', scope);
  return {
    reduceSiblings: configuration.get('reduceSiblings', true),
    combineParents: configuration.get('combineParents', true),
    hideTags: configuration.get('hideTags', true),
    convertBEM: configuration.get('convertBEM', true),
    preappendHtml: configuration.get('preappendHtml', false),
    classesOnly: configuration.get('classesOnly', false),
    ignoredSelectors: configuration.get<string[]>('ignoredSelectors', []),
  };
}

function readCssToHtmlOptions(scope: vscode.Uri | undefined): ICssToHtmlOptions {
  const configuration = vscode.workspace.getConfiguration('htmlToCss', scope);
  return {
    guessTagNames: configuration.get('guessTagNames', false),
    defaultTagName: configuration.get('defaultTagName', 'div'),
  };
}

/** True when `text` is HTML that converts to at least one selector with the current settings. */
function isConvertibleHtml(text: string, scope: vscode.Uri | undefined): boolean {
  if (!text.trim()) {
    return false;
  }
  const converter = new HtmlConverterService(readOptions(scope));
  // CSS and nested output always hold the same rules, so either flavour answers the question.
  return converter.isStringHtml(text) && converter.convert(text, 'css') !== '';
}

/** True when `text` is a stylesheet, not markup, whose rules describe at least one element. */
function isConvertibleCss(text: string, scope: vscode.Uri | undefined): boolean {
  return (
    !!text.trim() &&
    !new HtmlConverterService().isStringHtml(text) &&
    new CssToHtmlService(readCssToHtmlOptions(scope)).isStringCss(text)
  );
}

function resolveMarkupSyntax(document: vscode.TextDocument): MarkupSyntax {
  const extension = document.fileName.split('.').pop()?.toLowerCase() ?? '';
  return REACT_LANGUAGE_IDS.has(document.languageId) || REACT_EXTENSIONS.has(extension)
    ? 'jsx'
    : 'html';
}

/** Inserts `text` at every cursor, replacing any selected text. Reports whether it worked. */
async function insertAtSelections(editor: vscode.TextEditor, text: string): Promise<boolean> {
  return editor.edit(editBuilder => {
    for (const selection of editor.selections) {
      if (selection.isEmpty) {
        editBuilder.insert(selection.active, text);
      } else {
        editBuilder.replace(selection, text);
      }
    }
  });
}

let contextKeys: ContextKeys | undefined;

function resolveOutputFlavour(document: vscode.TextDocument): string | undefined {
  const byLanguageId = OUTPUT_BY_LANGUAGE_ID[document.languageId];
  if (byLanguageId) {
    return byLanguageId;
  }

  const extension = document.fileName.split('.').pop()?.toLowerCase() ?? '';
  return OUTPUT_BY_EXTENSION[extension];
}

/**
 * Converts the clipboard HTML and pastes it into the active editor.
 *
 * With no `forcedFlavour` the output follows the stylesheet type being pasted into, and any
 * other file is rejected. With one, the paste works in any file, so selectors can be dropped
 * into a Vue `<style>` block, a CSS-in-JS template or a markdown note.
 */
async function paste(forcedFlavour?: string): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('HTML to CSS: open a file before pasting.');
    return;
  }

  const outputFlavour = forcedFlavour ?? resolveOutputFlavour(editor.document);
  if (!outputFlavour) {
    vscode.window.showErrorMessage(
      'HTML to CSS: open a CSS, LESS, SCSS or SASS file to paste converted selectors.'
    );
    return;
  }

  const clipboardText = await vscode.env.clipboard.readText();
  if (!clipboardText.trim()) {
    vscode.window.showErrorMessage('HTML to CSS: the clipboard is empty.');
    return;
  }

  const converter = new HtmlConverterService(readOptions(editor.document.uri));
  if (!converter.isStringHtml(clipboardText)) {
    vscode.window.showErrorMessage('HTML to CSS: the clipboard does not contain HTML.');
    return;
  }

  const converted = converter.convert(clipboardText, outputFlavour);
  if (!converted) {
    vscode.window.showWarningMessage('HTML to CSS: the clipboard HTML has no elements to convert.');
    return;
  }

  if (!(await insertAtSelections(editor, converted))) {
    vscode.window.showErrorMessage('HTML to CSS: the converted selectors could not be inserted.');
  }
}

/** How copied output is named in the confirmation message. */
const FLAVOUR_LABELS: Record<string, string> = {
  css: 'CSS',
  scss: 'SCSS / LESS',
};

/**
 * Converts the selected HTML and puts the result on the clipboard, leaving the document as it
 * is. Several selections are converted together, as one fragment.
 */
async function copyAs(outputFlavour: string): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('HTML to CSS: open a file and select some HTML to copy.');
    return;
  }

  const selectedText = getSelectedText(editor);
  if (!selectedText.trim()) {
    vscode.window.showErrorMessage('HTML to CSS: select some HTML to copy as selectors.');
    return;
  }

  const converter = new HtmlConverterService(readOptions(editor.document.uri));
  if (!converter.isStringHtml(selectedText)) {
    vscode.window.showErrorMessage('HTML to CSS: the selection does not contain HTML.');
    return;
  }

  const converted = converter.convert(selectedText, outputFlavour);
  if (!converted) {
    vscode.window.showWarningMessage('HTML to CSS: the selected HTML has no elements to convert.');
    return;
  }

  await vscode.env.clipboard.writeText(converted);
  // The clipboard now holds CSS, so the menu entries must switch straight away.
  await contextKeys?.updateClipboard();
  // Every rule opens on a line ending in `{` or `{}`; the optional HTML comment never does.
  const ruleCount = converted.split('\n').filter(line => /\{\}?$/.test(line)).length;
  vscode.window.showInformationMessage(
    `HTML to CSS: copied ${ruleCount} ${FLAVOUR_LABELS[outputFlavour]} selector${ruleCount === 1 ? '' : 's'} to the clipboard.`
  );
}

function countElements(html: string): number {
  return html.match(/<[a-z]/gi)?.length ?? 0;
}

/** Converts the selected CSS / SCSS / LESS into HTML and puts it on the clipboard. */
async function copyAsHtml(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('HTML to CSS: open a file and select some CSS to copy.');
    return;
  }

  const selectedText = getSelectedText(editor);
  if (!selectedText.trim()) {
    vscode.window.showErrorMessage('HTML to CSS: select some CSS, SCSS or LESS to copy as HTML.');
    return;
  }

  const scope = editor.document.uri;
  if (!isConvertibleCss(selectedText, scope)) {
    vscode.window.showErrorMessage(
      'HTML to CSS: the selection does not contain CSS rules that describe elements.'
    );
    return;
  }

  const html = new CssToHtmlService(readCssToHtmlOptions(scope)).convert(selectedText);
  await vscode.env.clipboard.writeText(html);
  // The clipboard now holds HTML, so the menu entries must switch straight away.
  await contextKeys?.updateClipboard();
  const count = countElements(html);
  vscode.window.showInformationMessage(
    `HTML to CSS: copied ${count} HTML element${count === 1 ? '' : 's'} to the clipboard.`
  );
}

/**
 * Converts the clipboard CSS / SCSS / LESS into HTML and pastes it, in any file. React files
 * (`.jsx` / `.tsx`) get JSX, with `className` instead of `class`.
 */
async function pasteAsHtml(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('HTML to CSS: open a file before pasting.');
    return;
  }

  const clipboardText = await vscode.env.clipboard.readText();
  if (!clipboardText.trim()) {
    vscode.window.showErrorMessage('HTML to CSS: the clipboard is empty.');
    return;
  }

  const scope = editor.document.uri;
  if (!isConvertibleCss(clipboardText, scope)) {
    vscode.window.showErrorMessage(
      'HTML to CSS: the clipboard does not contain CSS rules that describe elements.'
    );
    return;
  }

  const markup = new CssToHtmlService(readCssToHtmlOptions(scope)).convert(
    clipboardText,
    resolveMarkupSyntax(editor.document)
  );
  if (!(await insertAtSelections(editor, markup))) {
    vscode.window.showErrorMessage('HTML to CSS: the converted HTML could not be inserted.');
  }
}

// LESS and SCSS share the same nested selector syntax, so both get `scss` output.
const COMMANDS: Record<string, () => Promise<void>> = {
  // Follows the type of the stylesheet being pasted into.
  'htmlToCss.paste': () => paste(),
  'htmlToCss.pasteAsCss': () => paste('css'),
  'htmlToCss.pasteAsNested': () => paste('scss'),
  'htmlToCss.copyAsCss': () => copyAs('css'),
  'htmlToCss.copyAsNested': () => copyAs('scss'),
  'htmlToCss.copyAsHtml': () => copyAsHtml(),
  'htmlToCss.pasteAsHtml': () => pasteAsHtml(),
};

export function activate(context: vscode.ExtensionContext): void {
  contextKeys = new ContextKeys({ html: isConvertibleHtml, css: isConvertibleCss });
  context.subscriptions.push(contextKeys);

  for (const [command, run] of Object.entries(COMMANDS)) {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, async () => {
        try {
          await run();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'An unknown error occurred';
          vscode.window.showErrorMessage(`HTML to CSS conversion failed: ${message}`);
        }
      })
    );
  }
}

export function deactivate(): void {
  // Everything else is disposed through the extension context.
  contextKeys = undefined;
}
