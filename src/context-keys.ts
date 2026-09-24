import * as vscode from 'vscode';

/**
 * Context keys, set while the selection or clipboard holds HTML that converts to at least one
 * selector, or CSS whose rules describe at least one element. Never both at once.
 */
const KEYS = {
  selection: { html: 'htmlToCss.selectionHasHtml', css: 'htmlToCss.selectionHasCss' },
  clipboard: { html: 'htmlToCss.clipboardHasHtml', css: 'htmlToCss.clipboardHasCss' },
} as const;

/** Waits for a selection drag or burst of typing to settle before converting. */
const SELECTION_DEBOUNCE_MS = 100;
/**
 * VS Code has no clipboard change event, so the clipboard is also re-read on this interval
 * while the window is focused. Copies made in other apps are caught by the focus event.
 */
const CLIPBOARD_POLL_MS = 1000;

/** Reports whether `text` can be converted, using the settings for `scope`. */
export type ConvertibleCheck = (text: string, scope: vscode.Uri | undefined) => boolean;

export interface ConvertibleChecks {
  /** HTML that converts to at least one selector. */
  html: ConvertibleCheck;
  /** CSS, SCSS or LESS whose rules describe at least one element. */
  css: ConvertibleCheck;
}

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

  constructor(private readonly checks: ConvertibleChecks) {
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
    this.update('clipboard', text, this.activeScope());
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
    this.update('selection', text, editor?.document.uri);
  }

  private update(source: keyof typeof KEYS, text: string, scope: vscode.Uri | undefined): void {
    const isHtml = this.checks.html(text, scope);
    // HTML is checked first and wins, so the CSS parser never runs on markup.
    this.set(KEYS[source].html, isHtml);
    this.set(KEYS[source].css, !isHtml && this.checks.css(text, scope));
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
