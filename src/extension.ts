import * as vscode from 'vscode';
import htmlConverterService from './services/html-converter.service';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('extension.htmlToCss', () => {
    const editor = vscode.window.activeTextEditor;

    if (editor) {
      const start = editor.selection.start;
      const filePath = (editor as vscode.TextEditor).document.fileName.toLowerCase();
      const fileExtension = htmlConverterService.getFileExtension(filePath);

      vscode.commands.executeCommand('editor.action.clipboardPasteAction').then(() => {
        const end = editor.selection.end;
        const selectionToIndent = new vscode.Selection(start.line, start.character, end.line, end.character);
        const text = editor.document.getText(selectionToIndent);

        if (htmlConverterService.isStringHtml(text)) {
          editor.edit((editBuilder: vscode.TextEditorEdit) => {
            editBuilder.replace(selectionToIndent, htmlConverterService.convert(text, fileExtension));

            vscode.window.showInformationMessage('HTML successfuly converted');
          });
        } else {
          vscode.window.showErrorMessage('Your clipboard value does not contain valid html structure');
        }
      });
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() { }
