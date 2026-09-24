import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activate, deactivate } from './extension';
import * as vscode from './test/vscode';
import packageJson from '../package.json';

const { state, reset, createEditor, fire, listenerCount } = vscode;

/** Registers the commands through activate(), then runs one of them. */
async function runPasteCommand(commandId = 'htmlToCss.paste'): Promise<void> {
  const context: vscode.ExtensionContext = { subscriptions: [] };
  activate(context as never);
  const command = state.commands.get(commandId);
  if (!command) {
    throw new Error(`${commandId} was not registered`);
  }
  try {
    await command();
  } finally {
    // Stops the clipboard poll, so no timer outlives the test.
    for (const disposable of context.subscriptions) {
      disposable.dispose();
    }
  }
}

/** A non-empty selection holding `text`. */
function selected(text: string): vscode.Selection {
  return { active: { line: 0, character: 0 }, isEmpty: false, text };
}

describe('extension', () => {
  beforeEach(() => reset());

  it('registers every contributed command and tracks the disposables', () => {
    const context: vscode.ExtensionContext = { subscriptions: [] };
    activate(context as never);

    const contributed = packageJson.contributes.commands.map(({ command }) => command);
    expect(new Set(state.commands.keys())).toEqual(new Set(contributed));
    // One disposable per command, plus the context key tracker.
    expect(context.subscriptions).toHaveLength(contributed.length + 1);
    for (const disposable of context.subscriptions) {
      disposable.dispose();
    }
  });

  it('inserts converted selectors at an empty selection', async () => {
    state.activeTextEditor = createEditor({ languageId: 'scss', fileName: '/styles.scss' });
    state.clipboardText = '<div class="a"><span class="b">x</span></div>';

    await runPasteCommand();

    expect(state.edits).toEqual([{ type: 'insert', value: '.a {\n  .b {}\n}\n' }]);
    expect(state.errorMessages).toEqual([]);
  });

  it('replaces a non-empty selection instead of inserting', async () => {
    state.activeTextEditor = createEditor({ languageId: 'css', fileName: '/styles.css' }, [
      { active: { line: 0, character: 0 }, isEmpty: false },
    ]);
    state.clipboardText = '<div class="a">x</div>';

    await runPasteCommand();

    expect(state.edits).toEqual([{ type: 'replace', value: '.a {}\n' }]);
  });

  it('works in an untitled buffer that has a language id but no file extension', async () => {
    // Regression guard: the file extension used to be read from the file name only,
    // so untitled CSS buffers were rejected outright.
    state.activeTextEditor = createEditor({ languageId: 'css', fileName: 'Untitled-1' });
    state.clipboardText = '<div class="a">x</div>';

    await runPasteCommand();

    expect(state.edits).toEqual([{ type: 'insert', value: '.a {}\n' }]);
    expect(state.errorMessages).toEqual([]);
  });

  it('falls back to the file extension when the language id is unknown', async () => {
    state.activeTextEditor = createEditor({ languageId: 'plaintext', fileName: '/theme.less' });
    state.clipboardText = '<div class="a"><span class="b">x</span></div>';

    await runPasteCommand();

    expect(state.edits).toEqual([{ type: 'insert', value: '.a {\n  .b {}\n}\n' }]);
  });

  it('honours configuration overrides', async () => {
    state.activeTextEditor = createEditor({ languageId: 'css', fileName: '/styles.css' });
    state.clipboardText = '<div class="a">x</div>';
    state.configuration['htmlToCss.hideTags'] = false;

    await runPasteCommand();

    expect(state.edits).toEqual([{ type: 'insert', value: 'div.a {}\n' }]);
  });

  it('passes classesOnly and ignoredSelectors through from settings', async () => {
    state.activeTextEditor = createEditor({ languageId: 'css', fileName: '/styles.css' });
    state.clipboardText = '<div id="app" class="container"><p class="intro">x</p></div>';
    state.configuration['htmlToCss.classesOnly'] = true;
    state.configuration['htmlToCss.ignoredSelectors'] = ['.container'];

    await runPasteCommand();

    expect(state.edits).toEqual([{ type: 'insert', value: '.intro {}\n' }]);
  });

  it('reports when there is no active editor', async () => {
    await runPasteCommand();
    expect(state.edits).toEqual([]);
    expect(state.errorMessages[0]).toContain('open a file');
  });

  it('reports when the file type is not a stylesheet', async () => {
    state.activeTextEditor = createEditor({ languageId: 'typescript', fileName: '/index.ts' });
    state.clipboardText = '<div class="a">x</div>';

    await runPasteCommand();

    expect(state.edits).toEqual([]);
    expect(state.errorMessages[0]).toContain('CSS, LESS, SCSS or SASS');
  });

  it('pastes flat CSS into any file type with pasteAsCss', async () => {
    state.activeTextEditor = createEditor({ languageId: 'vue', fileName: '/Card.vue' });
    state.clipboardText = '<div class="a"><span class="b">x</span></div>';

    await runPasteCommand('htmlToCss.pasteAsCss');

    expect(state.edits).toEqual([{ type: 'insert', value: '.a {}\n.a .b {}\n' }]);
    expect(state.errorMessages).toEqual([]);
  });

  it('pastes nested selectors into any file type with pasteAsNested', async () => {
    state.activeTextEditor = createEditor({ languageId: 'typescript', fileName: '/styles.ts' });
    state.clipboardText = '<div class="a"><span class="b">x</span></div>';

    await runPasteCommand('htmlToCss.pasteAsNested');

    expect(state.edits).toEqual([{ type: 'insert', value: '.a {\n  .b {}\n}\n' }]);
    expect(state.errorMessages).toEqual([]);
  });

  it('lets the chosen format override the stylesheet type', async () => {
    state.activeTextEditor = createEditor({ languageId: 'scss', fileName: '/styles.scss' });
    state.clipboardText = '<div class="a"><span class="b">x</span></div>';

    await runPasteCommand('htmlToCss.pasteAsCss');

    expect(state.edits).toEqual([{ type: 'insert', value: '.a {}\n.a .b {}\n' }]);
  });

  it('still reports an empty clipboard for the format-specific commands', async () => {
    state.activeTextEditor = createEditor({ languageId: 'vue', fileName: '/Card.vue' });
    state.clipboardText = '';

    await runPasteCommand('htmlToCss.pasteAsNested');

    expect(state.edits).toEqual([]);
    expect(state.errorMessages[0]).toContain('clipboard is empty');
  });

  describe('copy as selectors', () => {
    it('copies the selection as CSS without touching the document', async () => {
      state.activeTextEditor = createEditor({ languageId: 'twig', fileName: '/card.twig' }, [
        selected('<div class="a {{ extra }}"><span class="b">x</span></div>'),
      ]);

      await runPasteCommand('htmlToCss.copyAsCss');

      expect(state.copiedText).toBe('.a {}\n.a .b {}\n');
      expect(state.edits).toEqual([]);
      expect(state.infoMessages).toEqual(['HTML to CSS: copied 2 CSS selectors to the clipboard.']);
    });

    it('copies the selection as nested selectors', async () => {
      state.activeTextEditor = createEditor({ languageId: 'html', fileName: '/index.html' }, [
        selected('<div class="a"><span class="b">x</span></div>'),
      ]);

      await runPasteCommand('htmlToCss.copyAsNested');

      expect(state.copiedText).toBe('.a {\n  .b {}\n}\n');
      expect(state.infoMessages[0]).toContain('2 SCSS / LESS selectors');
    });

    it('converts several selections together and ignores empty cursors', async () => {
      state.activeTextEditor = createEditor({ languageId: 'html', fileName: '/index.html' }, [
        selected('<div class="a">x</div>'),
        { active: { line: 3, character: 0 }, isEmpty: true },
        selected('<p class="b">y</p>'),
      ]);

      await runPasteCommand('htmlToCss.copyAsCss');

      expect(state.copiedText).toBe('.a {}\n.b {}\n');
    });

    it('reports when nothing is selected', async () => {
      state.activeTextEditor = createEditor({ languageId: 'html', fileName: '/index.html' });

      await runPasteCommand('htmlToCss.copyAsCss');

      expect(state.copiedText).toBeUndefined();
      expect(state.errorMessages[0]).toContain('select some HTML');
    });

    it('reports a selection that is not HTML', async () => {
      state.activeTextEditor = createEditor({ languageId: 'css', fileName: '/styles.css' }, [
        selected('.selector { color: white; }'),
      ]);

      await runPasteCommand('htmlToCss.copyAsNested');

      expect(state.copiedText).toBeUndefined();
      expect(state.errorMessages[0]).toContain('selection does not contain HTML');
    });

    it('warns when the selected markup holds nothing convertible', async () => {
      state.activeTextEditor = createEditor({ languageId: 'html', fileName: '/index.html' }, [
        selected('<script>var a = 1;</script>'),
      ]);

      await runPasteCommand('htmlToCss.copyAsCss');

      expect(state.copiedText).toBeUndefined();
      expect(state.warningMessages[0]).toContain('no elements');
    });

    it('reports when there is no active editor', async () => {
      await runPasteCommand('htmlToCss.copyAsCss');
      expect(state.errorMessages[0]).toContain('open a file');
    });
  });

  it('reports an empty clipboard', async () => {
    state.activeTextEditor = createEditor({ languageId: 'css', fileName: '/styles.css' });
    state.clipboardText = '   ';

    await runPasteCommand();

    expect(state.edits).toEqual([]);
    expect(state.errorMessages[0]).toContain('clipboard is empty');
  });

  it('reports clipboard content that is not HTML', async () => {
    state.activeTextEditor = createEditor({ languageId: 'css', fileName: '/styles.css' });
    state.clipboardText = '.selector { color: white; }';

    await runPasteCommand();

    expect(state.edits).toEqual([]);
    expect(state.errorMessages[0]).toContain('does not contain HTML');
  });

  it('warns when the markup holds nothing convertible', async () => {
    state.activeTextEditor = createEditor({ languageId: 'css', fileName: '/styles.css' });
    state.clipboardText = '<script>var a = 1;</script>';

    await runPasteCommand();

    expect(state.edits).toEqual([]);
    expect(state.warningMessages[0]).toContain('no elements');
  });

  it('reports a rejected edit', async () => {
    // Regression guard: editor.edit() used to be fired without awaiting its result,
    // so a failed insert was silently swallowed.
    state.activeTextEditor = createEditor({ languageId: 'css', fileName: '/styles.css' });
    state.clipboardText = '<div class="a">x</div>';
    state.editSucceeds = false;

    await runPasteCommand();

    expect(state.errorMessages[0]).toContain('could not be inserted');
  });

  it('surfaces unexpected failures as an error message', async () => {
    state.activeTextEditor = createEditor({ languageId: 'css', fileName: '/styles.css' });
    state.clipboardText = '<div class="a">x</div>';
    state.activeTextEditor.edit = (): Promise<boolean> => {
      throw new Error('boom');
    };

    await runPasteCommand();

    expect(state.errorMessages[0]).toBe('HTML to CSS conversion failed: boom');
  });

  describe('context keys for the menu entries', () => {
    let context: vscode.ExtensionContext;

    /** Activates, then lets the initial clipboard read settle. */
    async function start(): Promise<void> {
      context = { subscriptions: [] };
      activate(context as never);
      await vi.advanceTimersByTimeAsync(0);
    }

    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
      for (const disposable of context?.subscriptions ?? []) {
        disposable.dispose();
      }
      vi.useRealTimers();
    });

    it('starts with both keys off when nothing useful is selected or copied', async () => {
      state.activeTextEditor = createEditor({ languageId: 'html', fileName: '/index.html' });

      await start();

      expect(state.contexts).toEqual({
        'htmlToCss.selectionHasHtml': false,
        'htmlToCss.clipboardHasHtml': false,
      });
    });

    it('turns the selection key on once a selection of HTML settles', async () => {
      const editor = createEditor({ languageId: 'html', fileName: '/index.html' });
      state.activeTextEditor = editor;
      await start();

      editor.selections = [selected('<div class="a">x</div>')];
      fire('selection');
      expect(state.contexts['htmlToCss.selectionHasHtml']).toBe(false);

      await vi.advanceTimersByTimeAsync(100);
      expect(state.contexts['htmlToCss.selectionHasHtml']).toBe(true);
    });

    it.each(['just words', '.a { color: red; }', '<script>x()</script>'])(
      'keeps the selection key off for %j',
      async text => {
        const editor = createEditor({ languageId: 'html', fileName: '/index.html' });
        state.activeTextEditor = editor;
        await start();

        editor.selections = [selected(text)];
        fire('selection');
        await vi.advanceTimersByTimeAsync(100);

        expect(state.contexts['htmlToCss.selectionHasHtml']).toBe(false);
      }
    );

    it('respects settings: an ignored-only selection does not count', async () => {
      state.configuration['htmlToCss.ignoredSelectors'] = ['.a'];
      state.activeTextEditor = createEditor({ languageId: 'html', fileName: '/index.html' }, [
        selected('<div class="a">x</div>'),
      ]);
      state.configuration['htmlToCss.classesOnly'] = true;

      await start();

      expect(state.contexts['htmlToCss.selectionHasHtml']).toBe(false);
    });

    it('turns the clipboard key on when HTML is copied, found by the poll', async () => {
      await start();
      expect(state.contexts['htmlToCss.clipboardHasHtml']).toBe(false);

      state.clipboardText = '<div class="a">x</div>';
      await vi.advanceTimersByTimeAsync(1000);

      expect(state.contexts['htmlToCss.clipboardHasHtml']).toBe(true);
    });

    it('does not poll the clipboard while the window is unfocused, but checks on refocus', async () => {
      await start();
      state.windowFocused = false;

      state.clipboardText = '<div class="a">x</div>';
      await vi.advanceTimersByTimeAsync(3000);
      expect(state.contexts['htmlToCss.clipboardHasHtml']).toBe(false);

      state.windowFocused = true;
      fire('windowState', { focused: true });
      await vi.advanceTimersByTimeAsync(0);
      expect(state.contexts['htmlToCss.clipboardHasHtml']).toBe(true);
    });

    it('turns the clipboard key off right after a copy-as command', async () => {
      state.clipboardText = '<div class="a">x</div>';
      state.activeTextEditor = createEditor({ languageId: 'html', fileName: '/index.html' }, [
        selected('<p class="b">y</p>'),
      ]);
      await start();
      expect(state.contexts['htmlToCss.clipboardHasHtml']).toBe(true);

      await state.commands.get('htmlToCss.copyAsCss')!();

      expect(state.copiedText).toBe('.b {}\n');
      expect(state.contexts['htmlToCss.clipboardHasHtml']).toBe(false);
    });

    it('re-checks both keys when the extension settings change', async () => {
      state.clipboardText = '<div class="a">x</div>';
      state.activeTextEditor = createEditor({ languageId: 'html', fileName: '/index.html' }, [
        selected('<div class="a">x</div>'),
      ]);
      await start();
      expect(state.contexts['htmlToCss.selectionHasHtml']).toBe(true);
      expect(state.contexts['htmlToCss.clipboardHasHtml']).toBe(true);

      state.configuration['htmlToCss.ignoredSelectors'] = ['.a'];
      state.configuration['htmlToCss.classesOnly'] = true;
      fire('configuration', { affectsConfiguration: (section: string) => section === 'htmlToCss' });
      await vi.advanceTimersByTimeAsync(0);

      expect(state.contexts['htmlToCss.selectionHasHtml']).toBe(false);
      expect(state.contexts['htmlToCss.clipboardHasHtml']).toBe(false);
    });

    it('stops listening and polling once disposed', async () => {
      await start();
      for (const disposable of context.subscriptions) {
        disposable.dispose();
      }

      expect(listenerCount('selection')).toBe(0);
      state.clipboardText = '<div class="a">x</div>';
      await vi.advanceTimersByTimeAsync(3000);
      expect(state.contexts['htmlToCss.clipboardHasHtml']).toBe(false);
    });
  });

  it('only shows the paste entries in the menu when the clipboard holds HTML', () => {
    const menu = packageJson.contributes.menus['editor/context'];
    const pasteEntries = menu.filter(entry => entry.command.startsWith('htmlToCss.paste'));

    expect(pasteEntries).toHaveLength(3);
    for (const entry of pasteEntries) {
      expect(entry.when.startsWith('htmlToCss.clipboardHasHtml')).toBe(true);
    }
  });

  it('only shows the match-file-type paste in the menu for stylesheets', () => {
    const menuEntry = packageJson.contributes.menus['editor/context'].find(
      entry => entry.command === 'htmlToCss.paste'
    );
    const command = packageJson.contributes.commands.find(
      entry => entry.command === 'htmlToCss.paste'
    );
    const fileTypeTest = command?.enablement.match(/\(.*\)/)?.[0];

    // Same file-type test as the command itself, so the two can never disagree.
    expect(fileTypeTest).toBeDefined();
    expect(menuEntry?.when).toBe(`htmlToCss.clipboardHasHtml && ${fileTypeTest}`);
  });

  it('never lets the clipboard check block a command, only hide its menu entry', () => {
    // The check can lag a moment behind a copy, so a quick copy-then-shortcut must still work.
    for (const command of packageJson.contributes.commands) {
      expect(command.enablement ?? '').not.toContain('htmlToCss.clipboardHasHtml');
    }
  });

  it('only shows the copy-as entries in the menu for a convertible selection', () => {
    const copyEntries = packageJson.contributes.menus['editor/context'].filter(entry =>
      entry.command.startsWith('htmlToCss.copyAs')
    );

    expect(copyEntries).toHaveLength(2);
    for (const entry of copyEntries) {
      expect(entry.when).toBe('htmlToCss.selectionHasHtml');
    }
  });

  it('deactivates without throwing', () => {
    expect(() => deactivate()).not.toThrow();
  });
});
