import * as vscode from 'vscode';
import HtmlConverterService from './services/html-converter.service';
import IOptions from './interfaces/options.interface';
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

/** True when `text` is HTML that converts to at least one selector with the current settings. */
function isConvertible(text: string, scope: vscode.Uri | undefined): boolean {
  if (!text.trim()) {
    return false;
  }
  const converter = new HtmlConverterService(readOptions(scope));
  // CSS and nested output always hold the same rules, so either flavour answers the question.
  return converter.isStringHtml(text) && converter.convert(text, 'css') !== '';
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

  const applied = await editor.edit(editBuilder => {
    for (const selection of editor.selections) {
      if (selection.isEmpty) {
        editBuilder.insert(selection.active, converted);
      } else {
        editBuilder.replace(selection, converted);
      }
    }
  });

  if (!applied) {
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
  // The clipboard now holds CSS, so the paste menu entries must switch off straight away.
  await contextKeys?.updateClipboard();
  // Every rule opens on a line ending in `{` or `{}`; the optional HTML comment never does.
  const ruleCount = converted.split('\n').filter(line => /\{\}?$/.test(line)).length;
  vscode.window.showInformationMessage(
    `HTML to CSS: copied ${ruleCount} ${FLAVOUR_LABELS[outputFlavour]} selector${ruleCount === 1 ? '' : 's'} to the clipboard.`
  );
}

// LESS and SCSS share the same nested selector syntax, so both get `scss` output.
const COMMANDS: Record<string, () => Promise<void>> = {
  // Follows the type of the stylesheet being pasted into.
  'htmlToCss.paste': () => paste(),
  'htmlToCss.pasteAsCss': () => paste('css'),
  'htmlToCss.pasteAsNested': () => paste('scss'),
  'htmlToCss.copyAsCss': () => copyAs('css'),
  'htmlToCss.copyAsNested': () => copyAs('scss'),
};

export function activate(context: vscode.ExtensionContext): void {
  contextKeys = new ContextKeys(isConvertible);
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
