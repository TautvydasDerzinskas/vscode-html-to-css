import {
  window,
  commands,
  ExtensionContext,
  TextEditor,
  TextEditorEdit,
  Selection,
  workspace
} from 'vscode';
import htmlConverterService from './services/html-converter.service';

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
          window.showErrorMessage('Your clipboard value does not contain valid html structure');
        }
      });
    }
  });

  const configurationListenerDisposable = workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('htmlToCss')) {
      htmlConverterService.updateConfiguration();
    }
  });

  context.subscriptions.push(commandDisposable, configurationListenerDisposable);
}

export function deactivate() { }
