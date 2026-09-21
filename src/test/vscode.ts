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
}

export interface TextEditorEdit {
  insert(position: Position, value: string): void;
  replace(selection: Selection, value: string): void;
}

export interface TextDocument {
  languageId: string;
  fileName: string;
  uri: Uri | undefined;
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

export interface Edit {
  type: 'insert' | 'replace';
  value: string;
}

/** Everything a test needs to drive and observe a command run. */
export const state = {
  activeTextEditor: undefined as TextEditor | undefined,
  clipboardText: '',
  configuration: {} as Record<string, unknown>,
  editSucceeds: true,
  errorMessages: [] as string[],
  warningMessages: [] as string[],
  edits: [] as Edit[],
  commands: new Map<string, (...args: unknown[]) => unknown>(),
};

export function reset(): void {
  state.activeTextEditor = undefined;
  state.clipboardText = '';
  state.configuration = {};
  state.editSucceeds = true;
  state.errorMessages = [];
  state.warningMessages = [];
  state.edits = [];
  state.commands = new Map();
}

/** Builds an editor whose `edit()` records what the command wrote. */
export function createEditor(
  document: Partial<TextDocument>,
  selections?: Selection[]
): TextEditor {
  return {
    document: { languageId: '', fileName: '', uri: undefined, ...document },
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
  showErrorMessage(message: string): void {
    state.errorMessages.push(message);
  },
  showWarningMessage(message: string): void {
    state.warningMessages.push(message);
  },
};

export const env = {
  clipboard: {
    readText: (): Promise<string> => Promise.resolve(state.clipboardText),
  },
};

export const workspace = {
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
};
