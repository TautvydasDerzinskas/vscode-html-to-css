import * as vscode from 'vscode';

/** Set while the editor selection holds HTML that converts to at least one selector. */
export const SELECTION_HAS_HTML = 'htmlToCss.selectionHasHtml';
/** Set while the clipboard holds HTML that converts to at least one selector. */
export const CLIPBOARD_HAS_HTML = 'htmlToCss.clipboardHasHtml';

/** Waits for a selection drag or burst of typing to settle before converting. */
const SELECTION_DEBOUNCE_MS = 100;
/**
 * VS Code has no clipboard change event, so the clipboard is also re-read on this interval
 * while the window is focused. Copies made in other apps are caught by the focus event.
 */
const CLIPBOARD_POLL_MS = 1000;

/** Reports whether `text` holds HTML that converts to at least one selector. */
export type ConvertibleCheck = (text: string, scope: vscode.Uri | undefined) => boolean;

/**
 * Keeps the `when`-clause context keys that enable the copy and paste menu entries in step
 * with the selection and the clipboard.
 */
export class ContextKeys implements vscode.Disposable {
  private readonly values = new Map<string, boolean>();
  private readonly disposables: vscode.Disposable[] = [];
  private selectionTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly clipboardTimer: ReturnType<typeof setInterval>;
  /** The clipboard text last checked, so an unchanged clipboard is not converted again. */
  private lastClipboardText: string | undefined;

  constructor(private readonly isConvertible: ConvertibleCheck) {
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection(() => this.scheduleSelectionUpdate()),
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.scheduleSelectionUpdate();
        void this.updateClipboard();
      }),
      vscode.window.onDidChangeWindowState(state => {
        if (state.focused) {
          void this.updateClipboard();
        }
      }),
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('htmlToCss')) {
          this.updateSelection();
          void this.updateClipboard(true);
        }
      })
    );

    this.clipboardTimer = setInterval(() => {
      if (vscode.window.state.focused) {
        void this.updateClipboard();
      }
    }, CLIPBOARD_POLL_MS);

    this.updateSelection();
    void this.updateClipboard();
  }

  /** Re-checks the clipboard, e.g. straight after a command has written to it. */
  public async updateClipboard(force = false): Promise<void> {
    const text = await vscode.env.clipboard.readText();
    if (!force && text === this.lastClipboardText) {
      return;
    }
    this.lastClipboardText = text;
    this.set(CLIPBOARD_HAS_HTML, this.isConvertible(text, this.activeScope()));
  }

  public dispose(): void {
    clearTimeout(this.selectionTimer);
    clearInterval(this.clipboardTimer);
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private scheduleSelectionUpdate(): void {
    clearTimeout(this.selectionTimer);
    this.selectionTimer = setTimeout(() => this.updateSelection(), SELECTION_DEBOUNCE_MS);
  }

  private updateSelection(): void {
    const editor = vscode.window.activeTextEditor;
    const text = editor ? getSelectedText(editor) : '';
    this.set(SELECTION_HAS_HTML, this.isConvertible(text, editor?.document.uri));
  }

  private activeScope(): vscode.Uri | undefined {
    return vscode.window.activeTextEditor?.document.uri;
  }

  /** Only talks to VS Code when a value actually changes. */
  private set(key: string, value: boolean): void {
    if (this.values.get(key) === value) {
      return;
    }
    this.values.set(key, value);
    void vscode.commands.executeCommand('setContext', key, value);
  }
}

/** The text of every non-empty selection, joined as one fragment. */
export function getSelectedText(editor: vscode.TextEditor): string {
  return editor.selections
    .filter(selection => !selection.isEmpty)
    .map(selection => editor.document.getText(selection))
    .join('\n');
}
