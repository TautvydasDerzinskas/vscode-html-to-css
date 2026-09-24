/**
 * Minimal stand-in for the `vscode` module, which only exists inside the extension
 * host. Jest maps `vscode` to this file so `extension.ts` can be tested in Node.
 */

type EditCallback = (editBuilder: TextEditorEdit) => void;

export interface Position {
  line: number;
  character: number;
}

export interface Selection {
  active: Position;
  isEmpty: boolean;
  /** The selected text, returned by `document.getText(selection)`. */
  text?: string;
}

export interface TextEditorEdit {
  insert(position: Position, value: string): void;
  replace(selection: Selection, value: string): void;
}

export interface TextDocument {
  languageId: string;
  fileName: string;
  uri: Uri | undefined;
  getText(selection?: Selection): string;
}

export interface Uri {
  path: string;
}

export interface TextEditor {
  document: TextDocument;
  selections: Selection[];
  edit(callback: EditCallback): Promise<boolean>;
}

export interface ExtensionContext {
  subscriptions: { dispose(): void }[];
}

export interface Disposable {
  dispose(): void;
}

type Listener = (event: any) => void;

/** Event listeners registered through the stubbed `onDid...` functions, keyed by event name. */
const listeners = new Map<string, Set<Listener>>();

function event(name: string): (listener: Listener) => Disposable {
  return listener => {
    const set = listeners.get(name) ?? new Set();
    set.add(listener);
    listeners.set(name, set);
    return { dispose: (): void => void set.delete(listener) };
  };
}

/** Fires a stubbed VS Code event, e.g. `fire('selection')`. */
export function fire(name: string, payload?: unknown): void {
  for (const listener of listeners.get(name) ?? []) {
    listener(payload);
  }
}

export function listenerCount(name: string): number {
  return listeners.get(name)?.size ?? 0;
}

export interface Edit {
  type: 'insert' | 'replace';
  value: string;
}

/** Everything a test needs to drive and observe a command run. */
export const state = {
  activeTextEditor: undefined as TextEditor | undefined,
  clipboardText: '',
  copiedText: undefined as string | undefined,
  configuration: {} as Record<string, unknown>,
  editSucceeds: true,
  errorMessages: [] as string[],
  warningMessages: [] as string[],
  infoMessages: [] as string[],
  edits: [] as Edit[],
  commands: new Map<string, (...args: unknown[]) => unknown>(),
  /** Values set through `executeCommand('setContext', key, value)`. */
  contexts: {} as Record<string, unknown>,
  windowFocused: true,
};

export function reset(): void {
  state.activeTextEditor = undefined;
  state.clipboardText = '';
  state.copiedText = undefined;
  state.configuration = {};
  state.editSucceeds = true;
  state.errorMessages = [];
  state.warningMessages = [];
  state.infoMessages = [];
  state.edits = [];
  state.commands = new Map();
  state.contexts = {};
  state.windowFocused = true;
  listeners.clear();
}

/** Builds an editor whose `edit()` records what the command wrote. */
export function createEditor(
  document: Partial<TextDocument>,
  selections?: Selection[]
): TextEditor {
  return {
    document: {
      languageId: '',
      fileName: '',
      uri: undefined,
      getText: selection => selection?.text ?? '',
      ...document,
    },
    selections: selections ?? [{ active: { line: 0, character: 0 }, isEmpty: true }],
    edit: (callback: EditCallback): Promise<boolean> => {
      callback({
        insert: (_position, value) => state.edits.push({ type: 'insert', value }),
        replace: (_selection, value) => state.edits.push({ type: 'replace', value }),
      });
      return Promise.resolve(state.editSucceeds);
    },
  };
}

export const window = {
  get activeTextEditor(): TextEditor | undefined {
    return state.activeTextEditor;
  },
  get state(): { focused: boolean } {
    return { focused: state.windowFocused };
  },
  onDidChangeTextEditorSelection: event('selection'),
  onDidChangeActiveTextEditor: event('activeEditor'),
  onDidChangeWindowState: event('windowState'),
  showErrorMessage(message: string): void {
    state.errorMessages.push(message);
  },
  showWarningMessage(message: string): void {
    state.warningMessages.push(message);
  },
  showInformationMessage(message: string): void {
    state.infoMessages.push(message);
  },
};

export const env = {
  clipboard: {
    readText: (): Promise<string> => Promise.resolve(state.clipboardText),
    writeText: (value: string): Promise<void> => {
      state.copiedText = value;
      state.clipboardText = value;
      return Promise.resolve();
    },
  },
};

export const workspace = {
  onDidChangeConfiguration: event('configuration'),
  getConfiguration: (
    section: string,
    _scope?: Uri
  ): { get<T>(key: string, defaultValue: T): T } => ({
    get: <T>(key: string, defaultValue: T): T => {
      const value = state.configuration[`${section}.${key}`];
      return value === undefined ? defaultValue : (value as T);
    },
  }),
};

export const commands = {
  registerCommand: (
    command: string,
    callback: (...args: unknown[]) => unknown
  ): { dispose(): void } => {
    state.commands.set(command, callback);
    return { dispose: (): void => undefined };
  },
  executeCommand: (command: string, ...args: unknown[]): Promise<void> => {
    if (command === 'setContext') {
      state.contexts[args[0] as string] = args[1];
    }
    return Promise.resolve();
  },
};
