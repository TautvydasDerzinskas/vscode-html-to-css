<p align="center">
  <img src="images/icon.png" alt="HTML to CSS / LESS / SCSS" width="128" height="128">
</p>

<p align="center">
  <a href="https://tautvydasderzinskas.github.io/vscode-html-to-css/"><img src="https://img.shields.io/badge/Try_it_online-HTML_to_CSS_converter-4f46e5?style=for-the-badge" alt="Try it online: HTML to CSS converter"></a>
</p>

A Visual Studio Code extension that turns HTML, JSX or template markup into ready-to-fill CSS,
LESS or SCSS selectors. Paste markup from the clipboard straight into a stylesheet as
selectors, or select markup in any file and copy it as selectors. Works with plain HTML, React
and Next.js, Vue, and Twig and friends.

It also works the other way round: turn CSS, SCSS or LESS into the HTML (or JSX) skeleton its
selectors describe. See [CSS to HTML](#css-to-html).

Prefer the browser? The same converter runs online at
[tautvydasderzinskas.github.io/vscode-html-to-css](https://tautvydasderzinskas.github.io/vscode-html-to-css/),
in both directions.

## Usage

1. Copy some HTML, JSX or template markup to the clipboard.
2. Open a `.css`, `.less`, `.scss` or `.sass` file.
3. Press `Ctrl+Alt+V` (Windows/Linux) or `Cmd+Alt+V` (macOS), or pick
   **Paste HTML as Selectors (Match File Type)** from the editor context menu.

The selectors are inserted at the cursor. If you have text selected, it is replaced.

### Pasting into any file

The editor context menu (and the Command Palette, under **HTML to CSS**) has three paste
commands:

| Command                                        | Output                                  | Works in                                |
| ---------------------------------------------- | --------------------------------------- | --------------------------------------- |
| **Paste HTML as Selectors (Match File Type)**  | CSS or nested SCSS / LESS, by file type | `.css`, `.less`, `.scss`, `.sass` files |
| **Paste HTML as CSS Selectors**                | Flat CSS                                | Any file                                |
| **Paste HTML as Nested SCSS / LESS Selectors** | Nested SCSS / LESS                      | Any file                                |

The last two are handy for a Vue or Svelte `<style>` block, a styled-components template, a
markdown note or an untitled buffer. In the context menu, the paste commands only appear once
the clipboard holds HTML that converts to at least one selector, and the first one only in
stylesheets. The keyboard shortcut and Command Palette are always available, and explain what
is wrong if there is nothing to paste.

### Copying from a selection

Select some HTML, JSX or template markup in any file, right-click and pick
**Copy as CSS Selectors** or **Copy as Nested SCSS / LESS Selectors**, right below the
built-in Copy. The converted selectors go to the clipboard, ready to paste anywhere with a
normal `Ctrl+V` / `Cmd+V`. The document itself is not changed, and several selections are
converted together. Both entries only appear when the selection holds HTML that converts to
at least one selector with your current settings.

## Examples

Given this markup:

```html
<div class="card">
  <div class="card__header">
    <h2 class="card__title">Title</h2>
  </div>
  <div class="card__body">
    <p class="card__text">Content</p>
  </div>
</div>
```

In a `.scss` or `.less` file you get nested selectors, with BEM modifiers folded into `&`:

```scss
.card {
  &__header {
    .card__title {
    }
  }
  &__body {
    .card__text {
    }
  }
}
```

`.card__title` stays written out in full on purpose: nesting it as `&__title` inside
`&__header` would compile to `.card__header__title`, which is not the class in your markup.

In a `.css` file you get flat descendant selectors instead:

```css
.card {
}
.card .card__header {
}
.card .card__header .card__title {
}
.card .card__body {
}
.card .card__body .card__text {
}
```

Clickable elements (`<a>`, `<button>`) also get state stubs:

```scss
.nav {
  &__link {
    &:hover {
    }
    &:active {
    }
    &:focus {
    }
  }
}
```

## React and Next.js

JSX is supported directly, including `className`, so you can copy a component's markup
straight out of a `.jsx` or `.tsx` file:

```jsx
<div className="card">
  <button className="card__btn" onClick={() => setOpen(true)} style={{ color: 'red' }}>
    {label}
  </button>
  {items.map(item => (
    <span className={styles.item} key={item.id}>
      {item.name}
    </span>
  ))}
</div>
```

gives you:

```scss
.card {
  &__btn {
    &:hover {
    }
    &:active {
    }
    &:focus {
    }
  }
  .item {
  }
}
```

What it understands:

| Written as                                   | Becomes                                                    |
| -------------------------------------------- | ---------------------------------------------------------- |
| `className="card"`                           | `.card`                                                    |
| `className={styles.card}` (CSS modules)      | `.card`                                                    |
| `className={styles['card-text']}`            | `.card-text`                                               |
| ``className={`card card--${size}`}``         | `.card` — the dynamic half is dropped                      |
| `className={clsx('card', on && 'card--on')}` | `.card.card--on`                                           |
| `className={on ? 'link' : 'link-off'}`       | `.link` — first branch only                                |
| `className={getClass()}`                     | nothing resolvable, so the element is treated as unclassed |

A few deliberate choices:

- **Components never become selectors.** `<Card className="card">` contributes `.card`, but
  `Card` itself is not a CSS element, so no `card` tag selector is emitted. `<Layout>` with no
  className simply disappears and its children move up. Upper-case HTML like `<DIV>` is still
  treated as HTML.
- **A ternary keeps only its first branch**, because the branches are alternatives —
  `.link.link-off` would describe a state that can never happen.
- **Dynamic class names are dropped**, not guessed at. `card--${size}` would otherwise leave
  `.card--`, which matches nothing.
- Fragments (`<>`), spread props (`{...props}`), JSX comments, `style={{ ... }}` and event
  handlers are all ignored safely. An arrow function in an attribute no longer truncates the
  element.

## Template languages

Twig templates work the same as plain HTML — paste a block and the template syntax is stripped
before the markup is read:

```twig
{% block card %}
<div class="card {{ extraClass }}">
  {# the header #}
  <div class="card__header {% if featured %}card__header--featured{% endif %}">
    <h2 class="card__title">{{ title }}</h2>
  </div>
  {% for item in items %}
    <div class="card__item card__item--{{ item.type }}">{{ item.name }}</div>
  {% endfor %}
</div>
{% endblock %}
```

gives you:

```scss
.card {
  &__header {
    .card__title {
    }
    &--featured {
    }
  }
  &__item {
  }
}
```

Two things worth knowing:

- A class written inside `{% if %}` is **kept**, so `card__header--featured` still becomes a
  `&--featured` modifier.
- A class built from an expression is **dropped**, because its value is only known at render
  time. `card__item--{{ item.type }}` would otherwise produce `.card__item--`, a selector that
  can never match anything.

The same handling covers **Jinja2**, **Nunjucks**, **Liquid**, **Handlebars** and **Mustache**,
and the `{{ ... }}` half covers **Vue** and **Angular** templates.

## CSS to HTML

The reverse direction turns CSS, SCSS or LESS into the element tree its selectors describe.

- **Copy as HTML** — select a CSS, SCSS or LESS block in any file, right-click and pick
  **Copy as HTML**. The HTML goes to the clipboard.
- **Paste as HTML** — copy a CSS, SCSS or LESS block, right-click in any file and pick
  **Paste as HTML**. In a React file (`.jsx` / `.tsx`) it pastes JSX instead, with `className`
  and `htmlFor`, and void elements such as `<img />` self-closed.

Like the other commands, both only appear in the context menu when the selection or clipboard
holds something they can convert: a stylesheet whose rules describe at least one element.

Given this SCSS:

```scss
.card {
  &--featured {
  }
  &__header {
    .card__title {
    }
  }
  &__body {
    a.card__link {
      &:hover {
      }
    }
  }
}
```

you get:

```html
<div class="card card--featured">
  <div class="card__header">
    <div class="card__title"></div>
  </div>
  <div class="card__body">
    <a class="card__link"></a>
  </div>
</div>
```

How selectors are read:

| Written as                                       | Becomes                                                |
| ------------------------------------------------ | ------------------------------------------------------ |
| Nesting, descendant (` `) and child (`>`)        | A child element                                        |
| `&__element`, `&-element`                        | A child element — BEM elements live inside their block |
| `&--modifier`, `&.is-active`                     | An extra class on the same element                     |
| `+` and `~`                                      | A sibling element                                      |
| `#id`, `[type=email]`, `[disabled]`              | `id="…"`, `type="email"`, `disabled`                   |
| `a.link`, `section.hero`                         | That tag                                               |
| `.card` (no tag)                                 | `div`, or the `defaultTagName` setting                 |
| `:hover`, `::before`, `:nth-child(2)`            | Ignored — they describe states, not elements           |
| `html`, `body`, `:root`, `*`                     | Skipped; their children move up                        |
| `@media`, `@supports`, `@include` blocks         | Read as if the wrapper were not there                  |
| LESS mixins and variables, SCSS `%placeholders`  | Skipped                                                |
| `.icon-#{$name}`, `.item-@{name}` (interpolated) | Skipped, with everything nested inside                 |

**Tags are never guessed by default.** Only tags written in the selectors are used; anything
else becomes a `div`. Turn on `htmlToCss.guessTagNames` to pick tags from the last word of a
class name (`.card__link` → `<a>`, `.card__title` → `<h2>`, `.primary-btn` → `<button>`),
from the parent (`ul` children become `<li>`) and from attributes (`[href]` → `<a>`).

CSS does not say everything HTML does, so the result is a skeleton: elements are empty, and a
descendant selector always becomes a direct child, since CSS cannot tell how many wrappers sit
in between.

## Settings

HTML → CSS / LESS / SCSS:

| Setting                      | Default | Description                                                                                   |
| ---------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| `htmlToCss.hideTags`         | `true`  | Drop the tag name when an element already has a class or an id, keeping specificity low.      |
| `htmlToCss.convertBEM`       | `true`  | Fold BEM elements and modifiers into `&__element` / `&--modifier`. Nested output only.        |
| `htmlToCss.reduceSiblings`   | `true`  | Collapse duplicate sibling elements that produce the same selector.                           |
| `htmlToCss.combineParents`   | `true`  | Merge duplicate sibling elements that have children, combining their children.                |
| `htmlToCss.preappendHtml`    | `false` | Prepend the source markup as a comment above the generated selectors.                         |
| `htmlToCss.classesOnly`      | `false` | Generate class selectors only — no tag or id selectors. Elements without a class are skipped. |
| `htmlToCss.ignoredSelectors` | `[]`    | Selectors never to generate, e.g. `[".container", ".text-center", "p"]`.                      |

CSS / LESS / SCSS → HTML:

| Setting                    | Default | Description                                                                              |
| -------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| `htmlToCss.guessTagNames`  | `false` | Guess tags from class names, parents and attributes instead of always using the default. |
| `htmlToCss.defaultTagName` | `div`   | The tag for an element whose selector names none (and none is guessed).                  |

### Class-only output and ignored selectors

If you write your styles with classes only, turn on `classesOnly`: tag and id selectors are
never generated, and elements without a class are skipped (their children move up a level).

`ignoredSelectors` stops specific selectors from ever being generated — handy for layout or
utility classes you never style per component:

```json
{
  "htmlToCss.classesOnly": true,
  "htmlToCss.ignoredSelectors": [".container", ".text-center", "p"]
}
```

With those settings, this markup:

```html
<main id="app">
  <div class="container">
    <section class="hero">
      <h1 class="hero__title text-center">Title</h1>
      <p>Intro</p>
    </section>
  </div>
</main>
```

gives you just:

```scss
.hero {
  &__title {
  }
}
```

Entries can be class (`.container`), id (`#app`) or tag (`p`) selectors, and one entry may hold
several, separated by commas. Classes are matched as written in the markup, before BEM
conversion, so ignore `.card__title` rather than `&__title`. An element whose only class is
ignored produces no rule — it does not fall back to a bare tag selector.

`hideTags` keeps track of the original tag internally, so state stubs are still generated
for `<a>` and `<button>` even when their tag name is hidden.

Elements that never render — `script`, `style`, `meta`, `link`, `title`, `base`, `head`,
and `noscript` — are skipped. A `<template>` wrapper, such as a Vue single-file component root, produces no selector of its own, but its contents are converted.

## Contributing

Contributions are welcome. Please open a pull request.

The website lives in [`web/`](web/) and bundles the extension's converter. Its options form is
generated from `contributes.configuration` in `package.json`, so new settings show up there
automatically. Run `npm run web:serve` to work on it locally, or `npm run web:build` to build
it into `web/dist`. CI deploys it to GitHub Pages on every push to `main`.

## License

MIT — see [LICENSE](LICENSE).

## Support

Please file issues at
[GitHub issues](https://github.com/TautvydasDerzinskas/vscode-html-to-css/issues).

If this extension saves you time, you can support its development:

- [GitHub Sponsors](https://github.com/sponsors/TautvydasDerzinskas)
- [Buy Me a Coffee](https://buymeacoffee.com/TautvydasDerzinskas)
