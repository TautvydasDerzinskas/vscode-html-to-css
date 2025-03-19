# HTML to CSS / LESS / SCSS Converter

A Visual Studio Code extension that converts HTML structure to CSS, LESS, or SCSS selectors. This extension helps you quickly generate CSS selectors from HTML markup, with support for BEM methodology and various optimization options.

## Features

- Convert HTML structure to CSS/LESS/SCSS selectors
- Support for BEM methodology
- Smart tag hiding when classes or IDs are present
- Sibling reduction for cleaner output
- Parent combination for better organization
- Support for clickable elements (hover, active, focus states)
- Configuration options for customization
- Support for multiple file extensions (.css, .less, .scss, .sass)

## Installation

1. Open Visual Studio Code
2. Go to the Extensions view (Ctrl+Shift+X or Cmd+Shift+X)
3. Search for "HTML to CSS"
4. Click Install

## Usage

1. Copy your HTML code to the clipboard
2. Open a CSS/LESS/SCSS file in VS Code
3. Place your cursor where you want to insert the converted code
4. Press `Ctrl+Alt+V` (Windows/Linux) or `Cmd+Alt+V` (Mac)
5. The converted CSS/LESS/SCSS code will be inserted at the cursor position

## Configuration

The extension can be configured through VS Code settings:

```json
{
    "htmlToCss.hideTags": true,        // Hide tag selectors if element has class or id
    "htmlToCss.convertBEM": true,      // Convert BEM classes to nested selectors
    "htmlToCss.preappendHtml": false,  // Add original HTML as a comment
    "htmlToCss.reduceSiblings": true,  // Combine identical sibling elements
    "htmlToCss.combineParents": true   // Combine identical parent elements
}
```

## Examples

### Input HTML
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

### Output CSS
```css
.card {}
.card__header {}
.card__title {}
.card__body {}
.card__text {}
```

### Output SCSS/LESS
```scss
.card {
    &__header {}
    &__title {}
    &__body {}
    &__text {}
}
```

## Features in Detail

### BEM Support
When using SCSS or LESS, the extension automatically converts BEM classes to nested selectors using the `&` parent selector.

### Clickable Elements
The extension automatically adds hover, active, and focus states for clickable elements (a, button).

### Smart Tag Hiding
When an element has classes or IDs, the tag selector is hidden to reduce specificity.

### Sibling Reduction
Identical sibling elements are combined to reduce code duplication.

### Parent Combination
Similar parent elements are combined to improve code organization.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This extension is licensed under the MIT License - see the LICENSE file for details.

## Support

If you encounter any issues or have suggestions, please file them in the [GitHub issues](https://github.com/SlimDogs/vscode-html-to-css/issues).