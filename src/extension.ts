import * as vscode from 'vscode';
import HtmlConverterService from './services/html-converter.service';
import IOptions from './interfaces/options.interface';
import * as manifest from '../package.json';

export function activate(context: vscode.ExtensionContext) {
    const configuration = vscode.workspace.getConfiguration('htmlToCss');
    const options: IOptions = {
        reduceSiblings: configuration.get('reduceSiblings', true),
        combineParents: configuration.get('combineParents', true),
        hideTags: configuration.get('hideTags', true),
        convertBEM: configuration.get('convertBEM', true),
        preappendHtml: configuration.get('preappendHtml', false),
    };

    const htmlConverter = new HtmlConverterService(options);

    const disposable = vscode.commands.registerCommand('htmlToCss.paste', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                throw new Error('No active editor found');
            }

            const document = editor.document;
            const fileExtension = document.fileName.split('.').pop()?.toLowerCase();
            
            if (!fileExtension) {
                throw new Error('File has no extension');
            }

            const clipboardText = await vscode.env.clipboard.readText();
            if (!clipboardText) {
                throw new Error('Clipboard is empty');
            }

            if (!htmlConverter.isStringHtml(clipboardText)) {
                throw new Error('Clipboard content is not valid HTML');
            }

            const convertedCode = htmlConverter.convert(clipboardText, fileExtension);
            
            editor.edit(editBuilder => {
                const position = editor.selection.active;
                editBuilder.insert(position, convertedCode);
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            vscode.window.showErrorMessage(`HTML to CSS conversion failed: ${errorMessage}`);
        }
    });

    context.subscriptions.push(disposable);

    // Listen for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('htmlToCss')) {
                const newConfiguration = vscode.workspace.getConfiguration('htmlToCss');
                const newOptions: IOptions = {
                    reduceSiblings: newConfiguration.get('reduceSiblings', true),
                    combineParents: newConfiguration.get('combineParents', true),
                    hideTags: newConfiguration.get('hideTags', true),
                    convertBEM: newConfiguration.get('convertBEM', true),
                    preappendHtml: newConfiguration.get('preappendHtml', false),
                };
                htmlConverter.updateConfiguration(newOptions);
            }
        })
    );

    console.info(
        `[vscode-html-to-css] v${manifest.version} activated!`,
    );
}

export function deactivate() {}
