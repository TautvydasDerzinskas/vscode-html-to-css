import * as vscode from 'vscode';
import HtmlConverterService from './services/html-converter.service';
import IOptions from './interfaces/options.interface';

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

function resolveOutputFlavour(document: vscode.TextDocument): string | undefined {
  const byLanguageId = OUTPUT_BY_LANGUAGE_ID[document.languageId];
  if (byLanguageId) {
    return byLanguageId;
  }

  const extension = document.fileName.split('.').pop()?.toLowerCase() ?? '';
  return OUTPUT_BY_EXTENSION[extension];
}

async function paste(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('HTML to CSS: open a file before pasting.');
    return;
  }

  const outputFlavour = resolveOutputFlavour(editor.document);
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

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('htmlToCss.paste', async () => {
      try {
        await paste();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        vscode.window.showErrorMessage(`HTML to CSS conversion failed: ${message}`);
      }
    })
  );
}

export function deactivate(): void {
  // Nothing to clean up: the command disposable is owned by the extension context.
}
