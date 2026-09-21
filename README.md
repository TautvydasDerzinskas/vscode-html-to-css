# HTML to CSS / LESS / SCSS

A Visual Studio Code extension that turns HTML markup on your clipboard into ready-to-fill
CSS, LESS or SCSS selectors.

## Usage

1. Copy some HTML to the clipboard.
2. Open a `.css`, `.less`, `.scss` or `.sass` file.
3. Press `Ctrl+Alt+V` (Windows/Linux) or `Cmd+Alt+V` (macOS), or pick
   **Paste HTML converted to CSS / LESS / SCSS** from the editor context menu.

The selectors are inserted at the cursor. If you have text selected, it is replaced.

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

## Settings

| Setting                    | Default | Description                                                                              |
| -------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| `htmlToCss.hideTags`       | `true`  | Drop the tag name when an element already has a class or an id, keeping specificity low. |
| `htmlToCss.convertBEM`     | `true`  | Fold BEM elements and modifiers into `&__element` / `&--modifier`. Nested output only.   |
| `htmlToCss.reduceSiblings` | `true`  | Collapse duplicate sibling elements that produce the same selector.                      |
| `htmlToCss.combineParents` | `true`  | Merge duplicate sibling elements that have children, combining their children.           |
| `htmlToCss.preappendHtml`  | `false` | Prepend the source markup as a comment above the generated selectors.                    |

`hideTags` keeps track of the original tag internally, so state stubs are still generated
for `<a>` and `<button>` even when their tag name is hidden.

Elements that never render — `script`, `style`, `meta`, `link`, `title`, `base`, `head`,
`noscript` and `template` — are skipped.

## Development

Requires Node 22.14 or newer (see `.nvmrc`).

```bash
npm install
npm run lint        # oxlint
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run build       # esbuild -> dist/extension.js
npm run package     # produces a .vsix
```

Press `F5` in VS Code to launch the extension in a development host.

The converter has no VS Code dependency, so it is unit tested directly. `src/test/vscode.ts`
is a small stand-in for the `vscode` module that lets `src/extension.ts` be tested in Node too.

### Releasing

Releases are automatic. Commit with `npm run commit` (commitizen) so messages follow
[conventional commits](https://www.conventionalcommits.org/); on every push to `main`,
semantic-release works out the next version from those messages, updates the changelog,
tags the release and publishes to the VS Code Marketplace and Open VSX.

## Contributing

Contributions are welcome. Please open a pull request.

## License

MIT — see [LICENSE](LICENSE).

## Support

Please file issues at
[GitHub issues](https://github.com/TautvydasDerzinskas/vscode-html-to-css/issues).
