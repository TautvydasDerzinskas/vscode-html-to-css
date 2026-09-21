import { describe, expect, it } from 'vitest';
import HtmlConverterService from './html-converter.service';
import IOptions from '../interfaces/options.interface';

const baseOptions: IOptions = {
  reduceSiblings: true,
  combineParents: true,
  hideTags: true,
  convertBEM: true,
  preappendHtml: false,
  classesOnly: false,
  ignoredSelectors: [],
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

  describe('template syntax (Twig, Jinja2, Nunjucks, Liquid, Handlebars, Vue)', () => {
    const twigBlock = `{% block card %}
<div class="card {{ extraClass }}">
  {# the header #}
  <div class="card__header {% if featured %}card__header--featured{% endif %}">
    <h2 class="card__title">{{ title }}</h2>
  </div>
  {% for item in items %}
    <div class="card__item card__item--{{ item.type }}">{{ item.name }}</div>
  {% endfor %}
</div>
{% endblock %}`;

    it('converts a Twig block', () => {
      expect(convert(twigBlock, 'scss')).toBe(
        '.card {\n' +
          '  &__header {\n' +
          '    .card__title {}\n' +
          '    &--featured {}\n' +
          '  }\n' +
          '  &__item {}\n' +
          '}\n'
      );
    });

    it('keeps a class written inside a statement', () => {
      expect(convert('<div class="a {% if x %}a--on{% endif %}">y</div>', 'scss')).toBe(
        '.a {\n  &--on {}\n}\n'
      );
    });

    it('drops a class that is entirely an expression', () => {
      expect(convert('<div class="card {{ extra }}">x</div>', 'css')).toBe('.card {}\n');
    });

    it('drops a class only partly built from an expression', () => {
      // ".card__item--" would be a selector that can never match.
      expect(convert('<div class="card__item card__item--{{ t }}">x</div>', 'css')).toBe(
        '.card__item {}\n'
      );
    });

    it('drops an id built from an expression', () => {
      expect(convert('<div id="{{ id }}" class="a">x</div>', 'css')).toBe('.a {}\n');
    });

    it('removes template comments', () => {
      expect(convert('{# note #}<div class="a">x</div>', 'css')).toBe('.a {}\n');
    });

    it('ignores statements that wrap whole elements', () => {
      const html = '{% for i in items %}<div class="item">x</div>{% endfor %}';
      expect(convert(html, 'css')).toBe('.item {}\n');
    });

    it('keeps a class inside a Handlebars or Mustache block helper', () => {
      expect(convert('<div class="card {{#if on}}card--on{{/if}}">x</div>', 'scss')).toBe(
        '.card {\n  &--on {}\n}\n'
      );
    });

    it('removes Handlebars comments', () => {
      expect(convert('{{! note }}<div class="a">x</div>', 'css')).toBe('.a {}\n');
    });

    it('handles Vue and Angular style interpolation', () => {
      expect(convert('<div class="row" :class="x">{{ value }}</div>', 'css')).toBe('.row {}\n');
    });

    it('skips an element whose tag name is an expression', () => {
      expect(convert('<{{ tag }}><div class="a">x</div></{{ tag }}>', 'css')).toBe('.a {}\n');
    });

    it('recognises a Twig block as convertible markup', () => {
      const service = new HtmlConverterService(baseOptions);
      expect(service.isStringHtml(twigBlock)).toBe(true);
      expect(service.isStringHtml('{% include "x.twig" %}')).toBe(false);
      expect(service.isStringHtml('{% if a < b %}text{% endif %}')).toBe(false);
    });

    it('leaves plain HTML untouched', () => {
      expect(convert('<div class="a"><span class="b">x</span></div>', 'scss')).toBe(
        '.a {\n  .b {}\n}\n'
      );
    });
  });

  describe('JSX (React, Next.js)', () => {
    it('reads className instead of class', () => {
      expect(
        convert('<div className="card"><span className="card__title">x</span></div>', 'scss')
      ).toBe('.card {\n  &__title {}\n}\n');
    });

    it('is not derailed by an arrow function in an attribute', () => {
      // The `>` in `=>` used to end the tag early, losing every attribute after it.
      expect(
        convert('<button className="btn" onClick={() => setOpen(true)}>x</button>', 'css')
      ).toBe('.btn {}\n.btn:hover {}\n.btn:active {}\n.btn:focus {}\n');
    });

    it('ignores a style object without mistaking it for a template expression', () => {
      expect(convert('<div className="a" style={{ color: \'red\' }}>x</div>', 'css')).toBe(
        '.a {}\n'
      );
    });

    it('resolves CSS-modules lookups', () => {
      expect(
        convert(
          '<div className={styles.card}><p className={styles["card-text"]}>x</p></div>',
          'scss'
        )
      ).toBe('.card {\n  .card-text {}\n}\n');
    });

    it('collects class names from clsx and friends', () => {
      expect(convert('<div className={clsx("card", isOn && "card--on")}>x</div>', 'scss')).toBe(
        '.card {\n  &--on {}\n}\n'
      );
    });

    it('keeps only the first branch of a ternary', () => {
      // ".link.link-off" would describe a state that can never happen.
      expect(convert('<a className={on ? "link" : "link-off"}>x</a>', 'css')).toBe(
        '.link {}\n.link:hover {}\n.link:active {}\n.link:focus {}\n'
      );
    });

    it('keeps a ternary inside a clsx call from creating an impossible selector', () => {
      expect(convert('<div className={clsx("card", on ? "a" : "b")}>x</div>', 'css')).toBe(
        '.card.a {}\n'
      );
    });

    it('keeps the static part of a template literal and drops the dynamic one', () => {
      // "card--" on its own would be a selector that never matches.
      expect(convert('<div className={`card card--${size}`}>x</div>', 'css')).toBe('.card {}\n');
    });

    it('drops a className it cannot resolve, leaving a plain element', () => {
      expect(convert('<div className={getClass()}><b className="b">x</b></div>', 'css')).toBe(
        'div {}\ndiv .b {}\n'
      );
    });

    it('does not turn a component into a tag selector', () => {
      expect(convert('<Layout><main className="main">x</main></Layout>', 'css')).toBe('.main {}\n');
    });

    it('keeps a className passed to a component', () => {
      expect(
        convert(
          '<Card className="card"><Card.Header className="card__header">x</Card.Header></Card>',
          'scss'
        )
      ).toBe('.card {\n  &__header {}\n}\n');
    });

    it('never adds state stubs for a component named like a clickable tag', () => {
      expect(convert('<Button className="btn">x</Button>', 'css')).toBe('.btn {}\n');
    });

    it('handles fragments, spreads and JSX comments', () => {
      expect(
        convert(
          '<><div {...props} className="a">{/* note */}<i className="a__icon" /></div></>',
          'scss'
        )
      ).toBe('.a {\n  &__icon {}\n}\n');
    });

    it('still treats upper-case HTML as HTML', () => {
      expect(convert('<DIV><SPAN>x</SPAN></DIV>', 'css')).toBe('div {}\ndiv span {}\n');
    });

    it('recognises a JSX snippet as convertible markup', () => {
      const service = new HtmlConverterService(baseOptions);
      expect(service.isStringHtml('<div className={styles.a}>x</div>')).toBe(true);
    });
  });

  describe('classesOnly option', () => {
    it('is off by default', () => {
      expect(convert('<div id="app"><p>x</p></div>', 'css')).toBe('#app {}\n#app p {}\n');
    });

    it('emits class selectors only', () => {
      const html =
        '<main id="app"><section class="hero"><p>x</p><h1 class="hero__title">y</h1></section></main>';
      expect(convert(html, 'scss', { classesOnly: true })).toBe('.hero {\n  &__title {}\n}\n');
    });

    it('drops the id but keeps the class of an element that has both', () => {
      expect(convert('<div id="a" class="b">x</div>', 'css', { classesOnly: true })).toBe(
        '.b {}\n'
      );
    });

    it('overrides hideTags: false', () => {
      expect(
        convert('<div class="a"><span>x</span></div>', 'css', {
          classesOnly: true,
          hideTags: false,
        })
      ).toBe('.a {}\n');
    });

    it('keeps state stubs for clickable elements', () => {
      expect(convert('<a class="link">x</a>', 'css', { classesOnly: true })).toBe(
        '.link {}\n.link:hover {}\n.link:active {}\n.link:focus {}\n'
      );
    });

    it('returns nothing for markup without classes', () => {
      expect(convert('<div id="a"><p>x</p></div>', 'css', { classesOnly: true })).toBe('');
    });
  });

  describe('ignoredSelectors option', () => {
    const html =
      '<div class="container"><p class="text-center intro">x</p><p>y</p><span id="app">z</span></div>';

    it('is empty by default', () => {
      expect(convert(html, 'css')).toContain('.container');
    });

    it("skips ignored classes, keeping the element's other classes", () => {
      expect(convert(html, 'css', { ignoredSelectors: ['.container', '.text-center'] })).toBe(
        '.intro {}\np {}\n#app {}\n'
      );
    });

    it('skips ignored tags and ids', () => {
      expect(convert(html, 'css', { ignoredSelectors: ['p', '#app'] })).toBe(
        '.container {}\n.container .text-center.intro {}\n'
      );
    });

    it('accepts a comma-separated entry', () => {
      expect(convert(html, 'css', { ignoredSelectors: ['.container, .text-center, p'] })).toBe(
        '.intro {}\n#app {}\n'
      );
    });

    it('matches classes as written, before BEM conversion', () => {
      const bem =
        '<div class="card"><h2 class="card__title">x</h2><p class="card__text">y</p></div>';
      expect(convert(bem, 'scss', { ignoredSelectors: ['.card__title'] })).toBe(
        '.card {\n  &__text {}\n}\n'
      );
    });

    it('matches tags case-insensitively', () => {
      expect(convert('<DIV class="a"><P>x</P></DIV>', 'css', { ignoredSelectors: ['P'] })).toBe(
        '.a {}\n'
      );
    });

    it('ignores entries that are not simple selectors', () => {
      expect(
        convert('<div class="a">x</div>', 'css', { ignoredSelectors: ['div > .a', '', '.'] })
      ).toBe('.a {}\n');
    });

    it('falls back to an empty list for invalid values', () => {
      const service = new HtmlConverterService({
        ignoredSelectors: 'not-an-array' as unknown as string[],
      });
      expect(service.convert('<div class="a">x</div>', 'css')).toBe('.a {}\n');
    });
  });

  describe('clipboard content that v1.2.0 rejected as "not valid HTML code"', () => {
    // v1.2.0 required the whole clipboard to start with "<" and end with ">", so any
    // snippet with template syntax, code or text around the markup was refused.
    const service = new HtmlConverterService(baseOptions);
    const cases: [string, string, string][] = [
      ['a Twig block', '{% block card %}\n<div class="card">x</div>\n{% endblock %}', '.card {}\n'],
      ['a Twig comment first', '{# card #}\n<div class="card">x</div>', '.card {}\n'],
      ['a React return statement', 'return (\n  <div className="card">x</div>\n);', '.card {}\n'],
      [
        'a whole React component',
        'export default function Card() {\n  return <div className="card">x</div>;\n}',
        '.card {}\n',
      ],
      ['JSX ending with an expression', '<div className="a">x</div>\n{footer}', '.a {}\n'],
      ['a JSX comment first', '{/* hero */}\n<section className="hero">x</section>', '.hero {}\n'],
      ['text before the markup', 'Hello <b class="b">x</b>', '.b {}\n'],
      ['text after the markup', '<div class="a">x</div> trailing text', '.a {}\n'],
      ['a trailing semicolon', '<div className="a">x</div>;', '.a {}\n'],
      ['a Handlebars block', '{{#if x}}<div class="a">y</div>{{/if}}', '.a {}\n'],
    ];

    it.each(cases)('accepts and converts %s', (_name, clipboard, expected) => {
      expect(service.isStringHtml(clipboard)).toBe(true);
      expect(service.convert(clipboard, 'css')).toBe(expected);
    });
  });

  describe('wrapper elements', () => {
    it('converts the contents of a Vue <template> root', () => {
      expect(
        convert(
          '<template>\n  <div class="a"><span class="b">{{ msg }}</span></div>\n</template>',
          'scss'
        )
      ).toBe('.a {\n  .b {}\n}\n');
    });

    it('never emits a selector for the wrapper itself', () => {
      expect(convert('<template><p>x</p></template>', 'css', { hideTags: false })).toBe('p {}\n');
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
