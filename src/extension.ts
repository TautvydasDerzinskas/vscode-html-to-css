import {
  window,
  commands,
  ExtensionContext,
  TextEditor,
  TextEditorEdit,
  Selection,
  workspace,
} from 'vscode';
import HtmlConverterService from './services/html-converter.service';
import IOptions from './interfaces/options.interface';
import * as manifest from '../package.json';

const getExtensionConfigurationOptions = (): IOptions => {
  const configuration = workspace.getConfiguration('htmlToCss');

  return {
    reduceSiblings: true,
    combineParents: true,
    hideTags: configuration.get('hideTags', true),
    convertBEM: configuration.get('convertBEM', true),
    preappendHtml: configuration.get('preappendHtml', false),
  };
};

const htmlConverterService = new HtmlConverterService(getExtensionConfigurationOptions());

export function activate(context: ExtensionContext) {
  const commandDisposable = commands.registerCommand('htmlToCss.paste', () => {
    const editor = window.activeTextEditor;

    if (editor) {
      const start = editor.selection.start;
      const filePath = (editor as TextEditor).document.fileName.toLowerCase();
      const fileExtension = htmlConverterService.getFileExtension(filePath);

      commands.executeCommand('editor.action.clipboardPasteAction').then(() => {
        const end = editor.selection.end;
        const selectionToIndent = new Selection(start.line, start.character, end.line, end.character);
        const text = editor.document.getText(selectionToIndent);

        if (htmlConverterService.isStringHtml(text)) {
          editor.edit((editBuilder: TextEditorEdit) => {
            editBuilder.replace(selectionToIndent, htmlConverterService.convert(text, fileExtension));

            window.showInformationMessage('HTML successfuly converted');
          });
        } else {
          window.showErrorMessage(
            'Your clipboard value is not valid HTML code.' +
            'Please make sure you copied full HTML structure, including opening and closing tags.',
          );
        }
      });
    }
  });

  const configurationListenerDisposable = workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('htmlToCss')) {
      htmlConverterService.updateConfiguration(getExtensionConfigurationOptions());
    }
  });

  context.subscriptions.push(commandDisposable, configurationListenerDisposable);

  console.info(
    `[vscode-html-to-css] v${manifest.version} activated!`,
  );
}

export function deactivate() { }
