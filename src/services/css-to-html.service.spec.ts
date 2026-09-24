import { describe, expect, it } from 'vitest';
import CssToHtmlService from './css-to-html.service';
import HtmlConverterService from './html-converter.service';

const convert = (css: string, options?: ConstructorParameters<typeof CssToHtmlService>[0]) =>
  new CssToHtmlService(options).convert(css);

describe('CssToHtmlService', () => {
  describe('nesting', () => {
    it('turns nested SCSS into nested elements, folding BEM modifiers into their block', () => {
      const scss = `
        .card {
          &--featured {}
          &__header {
            .card__title {}
          }
          &__body {
            .card__text {}
            a.card__link {
              &:hover {}
            }
          }
        }`;

      expect(convert(scss)).toBe(
        [
          '<div class="card card--featured">',
          '  <div class="card__header">',
          '    <div class="card__title"></div>',
          '  </div>',
          '  <div class="card__body">',
          '    <div class="card__text"></div>',
          '    <a class="card__link"></a>',
          '  </div>',
          '</div>',
          '',
        ].join('\n')
      );
    });

    it('reads flat CSS descendant and child selectors as nesting', () => {
      const css = `
        .nav {}
        .nav .nav__list {}
        .nav > .nav__list > li {}
        .nav .nav__list li a:hover {}`;

      expect(convert(css)).toBe(
        [
          '<div class="nav">',
          '  <div class="nav__list">',
          '    <li>',
          '      <a></a>',
          '    </li>',
          '  </div>',
          '</div>',
          '',
        ].join('\n')
      );
    });

    it('treats `&-suffix` as a child and `&.class` as the same element', () => {
      expect(convert('.card { &-title {} &.is-open {} }')).toBe(
        '<div class="card is-open">\n  <div class="card-title"></div>\n</div>\n'
      );
    });

    it('nests a plain nested selector without `&` as a descendant', () => {
      expect(convert('.a { .b { .c {} } }')).toBe(
        '<div class="a">\n  <div class="b">\n    <div class="c"></div>\n  </div>\n</div>\n'
      );
    });

    it('expands comma-separated selectors against every parent', () => {
      expect(convert('.a, .b { .c {} }')).toBe(
        [
          '<div class="a">',
          '  <div class="c"></div>',
          '</div>',
          '<div class="b">',
          '  <div class="c"></div>',
          '</div>',
          '',
        ].join('\n')
      );
    });

    it('places sibling combinators next to each other', () => {
      expect(convert('.list .a + .b {} .list .a ~ .c {}')).toBe(
        [
          '<div class="list">',
          '  <div class="a"></div>',
          '  <div class="b"></div>',
          '  <div class="c"></div>',
          '</div>',
          '',
        ].join('\n')
      );
    });
  });

  describe('merging', () => {
    it('merges state classes and modifiers into one element', () => {
      expect(convert('.btn {} .btn.is-active {} .btn--primary {}')).toBe(
        '<div class="btn is-active btn--primary"></div>\n'
      );
    });

    it('collapses repeated selectors into one element', () => {
      expect(convert('.a {} .a {} .a:hover {} .a::before {}')).toBe('<div class="a"></div>\n');
    });

    it('keeps elements that differ only by attribute value apart', () => {
      expect(convert('input[type=text] {} input[type=email] {}')).toBe(
        '<input type="text">\n<input type="email">\n'
      );
    });
  });

  describe('tags', () => {
    it('only uses tags written in the selector by default', () => {
      expect(convert('.card__link {} .card__title {} span.card__badge {}')).toBe(
        '<div class="card__link"></div>\n<div class="card__title"></div>\n<span class="card__badge"></span>\n'
      );
    });

    it('uses the configured default tag', () => {
      expect(convert('.a {}', { defaultTagName: 'section' })).toBe(
        '<section class="a"></section>\n'
      );
    });

    it('falls back to div for an invalid default tag', () => {
      expect(convert('.a {}', { defaultTagName: '<script>' })).toBe('<div class="a"></div>\n');
    });

    it('guesses tags from BEM names, parents and attributes when asked', () => {
      const scss = `
        .card {
          &__title {}
          &__link {}
          &__list { .card__entry {} }
          &__image {}
          &__primary-btn {}
          .card__field[type=email] {}
          .card__box[href] {}
        }`;

      expect(convert(scss, { guessTagNames: true })).toBe(
        [
          '<div class="card">',
          '  <h2 class="card__title"></h2>',
          '  <a class="card__link"></a>',
          '  <ul class="card__list">',
          '    <li class="card__entry"></li>',
          '  </ul>',
          '  <img class="card__image">',
          '  <button class="card__primary-btn"></button>',
          '  <input class="card__field" type="email">',
          '  <a class="card__box" href></a>',
          '</div>',
          '',
        ].join('\n')
      );
    });

    it('guesses from the last word of a name only, and never nests a form in a form', () => {
      const scss = '.form { &-row {} .nav-link {} .main-nav {} .form__form {} }';

      expect(convert(scss, { guessTagNames: true })).toBe(
        [
          '<form class="form">',
          '  <div class="form-row"></div>',
          '  <a class="nav-link"></a>',
          '  <nav class="main-nav"></nav>',
          '  <div class="form__form"></div>',
          '</form>',
          '',
        ].join('\n')
      );
    });

    it('never lets a guess override a written tag', () => {
      expect(convert('section.card__title {}', { guessTagNames: true })).toBe(
        '<section class="card__title"></section>\n'
      );
    });

    it('keeps custom elements and lower-cases tag names', () => {
      expect(convert('my-widget .a {} DIV.b {}')).toBe(
        '<my-widget>\n  <div class="a"></div>\n</my-widget>\n<div class="b"></div>\n'
      );
    });

    it('writes void elements without a closing tag, and their children after them', () => {
      expect(convert('.a img.b .c {}')).toBe(
        '<div class="a">\n  <img class="b">\n  <div class="c"></div>\n</div>\n'
      );
    });
  });

  describe('attributes', () => {
    it('keeps exact values, and only the name for partial matches', () => {
      expect(convert('a[href^="http"] {} label[for=email] {} input[disabled] {}')).toBe(
        '<a href></a>\n<label for="email"></label>\n<input disabled>\n'
      );
    });

    it('writes ids before classes and escapes quotes', () => {
      expect(convert('#main.page[title=\'say "hi"\'] {}')).toBe(
        '<div id="main" class="page" title="say &quot;hi&quot;"></div>\n'
      );
    });
  });

  describe('JSX output', () => {
    it('uses className and htmlFor, and self-closes void elements', () => {
      const scss = '.form { label[for=email] {} input.form__input[readonly] {} }';

      expect(new CssToHtmlService().convert(scss, 'jsx')).toBe(
        [
          '<div className="form">',
          '  <label htmlFor="email"></label>',
          '  <input className="form__input" readOnly />',
          '</div>',
          '',
        ].join('\n')
      );
    });
  });

  describe('what is skipped', () => {
    it('skips page-level selectors and moves their children up', () => {
      expect(convert('html, body {} :root {} * {} body .page {} html > body > main {}')).toBe(
        '<div class="page"></div>\n<main></main>\n'
      );
    });

    it('reads rules inside @media, @supports and @include, and skips keyframes and fonts', () => {
      const scss = `
        @media (min-width: 600px) { .a { .b {} } }
        @supports (display: grid) { .a .c {} }
        .a { @include breakpoint(md) { .d {} } }
        @keyframes spin { from {} to {} }
        @font-face { font-family: x; }`;

      expect(convert(scss)).toBe(
        [
          '<div class="a">',
          '  <div class="b"></div>',
          '  <div class="c"></div>',
          '  <div class="d"></div>',
          '</div>',
          '',
        ].join('\n')
      );
    });

    it('moves @at-root rules to the top level', () => {
      expect(convert('.a { @at-root .b {} }')).toBe(
        '<div class="a"></div>\n<div class="b"></div>\n'
      );
    });

    it('drops SCSS placeholders, interpolation and nested properties, with their children', () => {
      const scss = `
        @use 'x';
        $gap: 4px;
        %placeholder { .hidden {} }
        .icon-#{$name} { .inner {} }
        .a { font: { family: x; } }`;

      expect(convert(scss)).toBe('<div class="a"></div>\n');
    });

    it('drops LESS variables, mixin definitions, mixin calls and guards', () => {
      const less = `
        @color: red;
        .mixin(@a) { .inner {} }
        .card {
          .mixin(red);
          &-title {}
          .guarded() when (@mode = dark) { .x {} }
        }
        .item-@{name} {}`;

      expect(convert(less)).toBe('<div class="card">\n  <div class="card-title"></div>\n</div>\n');
    });

    it.each([
      ['empty text', '   '],
      ['HTML', '<div class="a">x</div>'],
      ['plain words', 'hello world'],
      ['JavaScript', 'if (x) { y(); } else { z(); }'],
      ['a JavaScript-like block', 'else { color: red; }'],
      ['declarations only', 'color: red;'],
      ['only at-rules', '@keyframes spin { from {} }'],
    ])('does not treat %s as CSS', (_label, text) => {
      const service = new CssToHtmlService();
      expect(service.isStringCss(text)).toBe(false);
      expect(service.convert(text)).toBe('');
    });

    it('recognises real stylesheets', () => {
      const service = new CssToHtmlService();
      expect(service.isStringCss('.a { color: red; }')).toBe(true);
      expect(service.isStringCss('@color: red; .a { color: @color; }')).toBe(true);
    });
  });

  describe('round trip from HTML', () => {
    it.each([
      [
        'BEM card',
        `<div class="card card--featured">
          <div class="card__header"><h2 class="card__title">Title</h2></div>
          <div class="card__body"><p class="card__text">Text</p></div>
        </div>`,
        [
          '<div class="card card--featured">',
          '  <div class="card__header">',
          '    <div class="card__title"></div>',
          '  </div>',
          '  <div class="card__body">',
          '    <div class="card__text"></div>',
          '  </div>',
          '</div>',
          '',
        ],
      ],
      [
        'navigation with tags',
        `<nav class="menu"><ul class="menu__list"><li><a class="menu__link">A</a></li></ul></nav>`,
        [
          '<div class="menu">',
          '  <div class="menu__list">',
          '    <li>',
          '      <div class="menu__link"></div>',
          '    </li>',
          '  </div>',
          '</div>',
          '',
        ],
      ],
    ])('keeps the structure of %s through HTML -> SCSS -> HTML', (_label, html, expected) => {
      const scss = new HtmlConverterService().convert(html, 'scss');
      expect(convert(scss)).toBe(expected.join('\n'));
    });

    it('also round-trips through flat CSS', () => {
      const html = '<div class="a"><div class="b"><span class="c"></span></div></div>';
      const css = new HtmlConverterService().convert(html, 'css');
      expect(convert(css)).toBe(
        '<div class="a">\n  <div class="b">\n    <div class="c"></div>\n  </div>\n</div>\n'
      );
    });
  });
});
