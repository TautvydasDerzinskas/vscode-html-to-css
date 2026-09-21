import { beforeEach, describe, expect, it } from 'vitest';
import { activate, deactivate } from './extension';
import * as vscode from './test/vscode';

const { state, reset, createEditor } = vscode;

/** Registers the command through activate(), then runs it. */
async function runPasteCommand(): Promise<void> {
  const context: vscode.ExtensionContext = { subscriptions: [] };
  activate(context as never);
  const command = state.commands.get('htmlToCss.paste');
  if (!command) {
    throw new Error('htmlToCss.paste was not registered');
  }
  await command();
}

describe('extension', () => {
  beforeEach(() => reset());

  it('registers the paste command and tracks the disposable', () => {
    const context: vscode.ExtensionContext = { subscriptions: [] };
    activate(context as never);
    expect(state.commands.has('htmlToCss.paste')).toBe(true);
    expect(context.subscriptions).toHaveLength(1);
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

  it('deactivates without throwing', () => {
    expect(() => deactivate()).not.toThrow();
  });
});
