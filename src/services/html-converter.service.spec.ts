import { describe, expect, it } from 'vitest';
import HtmlConverterService from './html-converter.service';
import IOptions from '../interfaces/options.interface';

const baseOptions: IOptions = {
  reduceSiblings: true,
  combineParents: true,
  hideTags: true,
  convertBEM: true,
  preappendHtml: false,
};

const validHTMLCode = `
    <div class="organism">
        <div class="organism__molecule">
            <div class="organism__atom">Atom</div>
            <div class="organism__atom">Atom</div>
        </div>
        <div class="organism__molecule">
            <div class="organism__atom organism__atom--red">Atom</div>
            <div class="organism__atom">Atom</div>
        </div>
    </div>
`;

const invalidHTMLCode = `
    .selector { color: white; }
`;

const complexHTMLCode = `
    <div class="container">
        <header class="header">
            <nav class="nav">
                <a href="#" class="nav__link">Link 1</a>
                <a href="#" class="nav__link nav__link--active">Link 2</a>
            </nav>
        </header>
        <main class="main">
            <section class="section">
                <h1 class="section__title">Title</h1>
                <p class="section__text">Text</p>
            </section>
        </main>
    </div>
`;

const convert = (html: string, extension: string, options: Partial<IOptions> = {}): string =>
  new HtmlConverterService({ ...baseOptions, ...options }).convert(html, extension);

describe('HtmlConverterService', () => {
  describe('helpers', () => {
    const service = new HtmlConverterService(baseOptions);

    it('returns the lower-cased file extension', () => {
      expect(service.getFileExtension('/test/src/file.html')).toBe('html');
      expect(service.getFileExtension('~/Desktop/gitHUB/src/styles.css')).toBe('css');
      expect(service.getFileExtension('styles.SCSS')).toBe('scss');
    });

    it('recognises HTML', () => {
      expect(service.isStringHtml(validHTMLCode)).toBe(true);
      expect(service.isStringHtml(complexHTMLCode)).toBe(true);
      expect(service.isStringHtml('<br />')).toBe(true);
    });

    it('rejects non-HTML', () => {
      expect(service.isStringHtml(invalidHTMLCode)).toBe(false);
      expect(service.isStringHtml('')).toBe(false);
      expect(service.isStringHtml('   ')).toBe(false);
    });

    it('falls back to defaults for missing options', () => {
      const withDefaults = new HtmlConverterService();
      expect(withDefaults.convert('<div class="a"><span class="b">x</span></div>', 'scss')).toBe(
        '.a {\n  .b {}\n}\n'
      );
    });
  });

  describe('runs in the extension host environment', () => {
    it('converts without relying on DOM globals', () => {
      // Regression guard: the previous implementation used `instanceof Element`,
      // which throws ReferenceError in Node, where the extension actually runs.
      expect(typeof (globalThis as Record<string, unknown>).Element).toBe('undefined');
      expect(convert('<div class="a">x</div>', 'css')).toBe('.a {}\n');
    });
  });

  describe('hideTags option', () => {
    it('omits tag names when an element has a class (CSS)', () => {
      expect(convert(validHTMLCode, 'css', { hideTags: true })).not.toContain('div');
    });

    it('omits tag names when an element has a class (LESS/SCSS)', () => {
      expect(convert(validHTMLCode, 'less', { hideTags: true })).not.toContain('div');
    });

    it('keeps tag names when disabled (CSS)', () => {
      expect(convert(validHTMLCode, 'css', { hideTags: false })).toContain('div');
    });

    it('keeps tag names when disabled (LESS/SCSS)', () => {
      expect(convert(validHTMLCode, 'less', { hideTags: false })).toContain('div');
    });

    it('keeps the tag when the element has neither class nor id', () => {
      expect(convert('<section><p>hi</p></section>', 'scss')).toBe('section {\n  p {}\n}\n');
    });
  });

  describe('BEM option', () => {
    it('extracts modifiers into nested & selectors', () => {
      expect(convert(validHTMLCode, 'less', { convertBEM: true })).toContain('&--red');
    });

    it('leaves modifiers alone when disabled', () => {
      expect(convert(validHTMLCode, 'less', { convertBEM: false })).not.toContain('&--red');
    });

    it('never emits & selectors for flat CSS', () => {
      const result = convert(validHTMLCode, 'css', { convertBEM: true });
      expect(result).not.toContain('&');
    });

    it('handles nested BEM structures', () => {
      const result = convert(complexHTMLCode, 'less');
      expect(result).toContain('&__link');
      expect(result).toContain('&--active');
      expect(result).toContain('&__title');
      expect(result).toContain('&__text');
    });

    it('keeps every segment of a multi-dash modifier', () => {
      expect(convert('<div class="b b--a--c">x</div>', 'scss')).toBe('.b {\n  &--a--c {}\n}\n');
    });

    it('only treats a class as a modifier when its block is also present', () => {
      expect(convert('<div class="standalone--thing">x</div>', 'scss')).toBe(
        '.standalone--thing {}\n'
      );
    });
  });

  describe('sibling merging', () => {
    it('collapses identical childless siblings', () => {
      const html = '<div class="same">1</div><div class="same">2</div><div class="same">3</div>';
      expect(convert(html, 'css')).toBe('.same {}\n');
    });

    it('keeps identical childless siblings when reduceSiblings is off', () => {
      const html = '<div class="same">1</div><div class="same">2</div>';
      expect(convert(html, 'css', { reduceSiblings: false })).toBe('.same {}\n.same {}\n');
    });

    it('merges duplicate parents and keeps every child', () => {
      const html = `
        <ul class="list">
          <li class="item"><span class="a">A</span></li>
          <li class="item"><span class="b">B</span></li>
        </ul>
      `;
      // Regression guard: the previous implementation dropped ".b" entirely.
      expect(convert(html, 'scss')).toBe('.list {\n  .item {\n    .a {}\n    .b {}\n  }\n}\n');
    });

    it('keeps duplicate parents separate when combineParents is off', () => {
      const html = `
        <div class="parent"><div class="a">A</div></div>
        <div class="parent"><div class="b">B</div></div>
      `;
      expect(convert(html, 'scss', { combineParents: false })).toBe(
        '.parent {\n  .a {}\n}\n.parent {\n  .b {}\n}\n'
      );
    });

    it('does not emit the same selector twice for different tags', () => {
      const html = '<div class="x">1</div><span class="x">2</span>';
      expect(convert(html, 'css')).toBe('.x {}\n');
    });

    it('deduplicates a BEM modifier against its plain sibling', () => {
      // Regression guard: modifier extraction used to run after sibling merging,
      // which left a stray empty ".organism__atom {}" block behind.
      const result = convert(validHTMLCode, 'less');
      expect(result.split('.organism__atom').length - 1).toBe(1);
    });
  });

  describe('nesting depth', () => {
    it('mirrors the full HTML structure instead of flattening at depth 4', () => {
      const html =
        '<div class="a"><div class="b"><div class="c"><div class="d"><div class="e">x</div></div></div></div></div>';
      // Regression guard: the old tier reduction re-parented ".e" as a sibling of ".d",
      // producing ".a .b .c .e", a selector that matches nothing.
      expect(convert(html, 'css')).toBe(
        '.a {}\n.a .b {}\n.a .b .c {}\n.a .b .c .d {}\n.a .b .c .d .e {}\n'
      );
      expect(convert(html, 'scss')).toBe(
        '.a {\n  .b {\n    .c {\n      .d {\n        .e {}\n      }\n    }\n  }\n}\n'
      );
    });
  });

  describe('clickable elements', () => {
    it('adds state stubs in CSS, each on its own line', () => {
      expect(convert('<a href="#" class="link">Link</a>', 'css')).toBe(
        '.link {}\n.link:hover {}\n.link:active {}\n.link:focus {}\n'
      );
    });

    it('adds state stubs in SCSS at the correct indentation', () => {
      expect(convert('<button class="btn">Go</button>', 'scss')).toBe(
        '.btn {\n  &:hover {}\n  &:active {}\n  &:focus {}\n}\n'
      );
    });

    it('does not add state stubs to non-clickable elements', () => {
      expect(convert('<div class="plain">x</div>', 'css')).toBe('.plain {}\n');
    });

    it('keeps the state stubs when a clickable element is merged with a plain one', () => {
      const html = '<div class="x">1</div><a class="x">2</a>';
      expect(convert(html, 'css')).toBe('.x {}\n.x:hover {}\n.x:active {}\n.x:focus {}\n');
    });
  });

  describe('non-rendered elements', () => {
    it('skips script and style tags', () => {
      const html = '<div class="x"><script>var a = "<div>";</script><style>.a{}</style></div>';
      expect(convert(html, 'css')).toBe('.x {}\n');
    });
  });

  describe('preappendHtml option', () => {
    it('omits the comment when disabled (CSS)', () => {
      expect(convert(validHTMLCode, 'css', { preappendHtml: false })).not.toContain('/*');
    });

    it('omits the comment when disabled (LESS/SCSS)', () => {
      expect(convert(validHTMLCode, 'less', { preappendHtml: false })).not.toContain('/*');
    });

    it('prepends the source markup (CSS)', () => {
      const result = convert(validHTMLCode, 'css', { preappendHtml: true });
      expect(result).toContain('/*');
      expect(result).toContain(' * <div class="organism">');
    });

    it('prepends the source markup (LESS/SCSS)', () => {
      const result = convert(validHTMLCode, 'less', { preappendHtml: true });
      expect(result).toContain('/*');
      expect(result).toContain(' * <div class="organism">');
    });

    it('escapes a comment terminator in the markup', () => {
      const result = convert('<div class="a" title="*/">x</div>', 'css', { preappendHtml: true });
      expect(result).not.toContain('*/ ');
      expect(result.indexOf('*/')).toBe(result.lastIndexOf('*/'));
    });
  });

  describe('edge cases', () => {
    it('returns an empty string for empty input', () => {
      expect(convert('', 'css')).toBe('');
      expect(convert('', 'scss')).toBe('');
    });

    it('returns an empty string when there is no markup to convert', () => {
      expect(convert('just some text', 'css')).toBe('');
    });

    it('recovers from an unclosed tag', () => {
      expect(convert('<div>', 'css')).toBe('div {}\n');
    });

    it('handles multiple ids', () => {
      expect(convert('<div id="id1 id2" class="test">Test</div>', 'css')).toBe(
        '#id1#id2.test {}\n'
      );
    });

    it('handles multiple classes', () => {
      expect(convert('<div class="class1 class2">Test</div>', 'css')).toBe('.class1.class2 {}\n');
    });

    it('ignores stray whitespace in the class attribute', () => {
      expect(convert('<div class="  a   b  ">Test</div>', 'css')).toBe('.a.b {}\n');
    });

    it('lower-cases upper-case tag names', () => {
      expect(convert('<DIV><SPAN>x</SPAN></DIV>', 'css')).toBe('div {}\ndiv span {}\n');
    });
  });

  describe('updateConfiguration', () => {
    it('applies the new options to later conversions', () => {
      const service = new HtmlConverterService({ ...baseOptions, hideTags: true });
      expect(service.convert('<div class="a">x</div>', 'css')).toBe('.a {}\n');

      service.updateConfiguration({ ...baseOptions, hideTags: false });
      expect(service.convert('<div class="a">x</div>', 'css')).toBe('div.a {}\n');
    });
  });
});
