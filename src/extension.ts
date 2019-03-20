import * as vscode from 'vscode';
import htmlConverterService from './services/html-converter.service';

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('extension.htmlToCss', () => {
		const editor = vscode.window.activeTextEditor;

		if (editor) {
			const start = editor.selection.start;
			vscode.commands.executeCommand('editor.action.clipboardPasteAction').then(() => {
				let end = editor.selection.end;
				let selectionToIndent = new vscode.Selection(start.line, start.character, end.line, end.character);
				let text = editor.document.getText(selectionToIndent);

				if (htmlConverterService.isStringHtml(text)) {
					editor.edit((editBuilder: vscode.TextEditorEdit) => {
						editBuilder.replace(selectionToIndent, htmlConverterService.convert(text));

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

export function deactivate() {}
