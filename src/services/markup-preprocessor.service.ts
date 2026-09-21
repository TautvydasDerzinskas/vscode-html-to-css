/**
 * Normalises JSX and Twig-style template markup down to plain HTML, so the converter only
 * ever sees `class` / `id` attributes it can build selectors from.
 */

/**
 * Stands in for a value that is only known at render time. Tokens containing it are dropped,
 * because a selector cannot be built from them.
 */
export const DYNAMIC_VALUE_MARKER = '';

/** `{# comment #}`, `{% statement %}` and `{{ expression }}`. */
const TEMPLATE_COMMENT_PATTERN = /\{#[\s\S]*?#\}/g;
const TEMPLATE_STATEMENT_PATTERN = /\{%[\s\S]*?%\}/g;
/** Handlebars and Mustache block helpers and comments: `{{#if}}`, `{{/if}}`, `{{! note }}`. */
const TEMPLATE_BLOCK_PATTERN = /\{\{[#/!][\s\S]*?\}\}/g;
const TEMPLATE_EXPRESSION_PATTERN = /\{\{[\s\S]*?\}\}/g;

/** JSX comments, `<>` fragments and `{...spread}` attributes. */
const JSX_COMMENT_PATTERN = /\{\s*\/\*[\s\S]*?\*\/\s*\}/g;
const JSX_FRAGMENT_PATTERN = /<\/?>/g;
const JSX_SPREAD_PATTERN = /\{\s*\.\.\.[^{}]*\}/g;

/** An attribute whose value is a JSX expression, e.g. `onClick={...}`. */
const ATTRIBUTE_EXPRESSION_PATTERN = /([A-Za-z_$][\w$:.-]*)\s*=\s*\{/g;

/** Plain-string `className="..."`, which only needs renaming. */
const CLASS_NAME_ATTRIBUTE_PATTERN = /\bclassName(\s*=\s*["'])/g;

/** Objects a CSS-modules class is usually read from: `styles.card`, `css.card`. */
const STYLES_OBJECT_PATTERN = /^(?:styles?|classes|css)$/i;

const BRACKET_ACCESS_PATTERN = /([A-Za-z_$][\w$]*)\s*\[\s*(['"])([^'"]*)\2\s*\]/g;
const MEMBER_ACCESS_PATTERN = /([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$-]*)/g;
const STRING_LITERAL_PATTERN = /(['"])((?:\\.|(?!\1)[^\\])*)\1/g;
const INTERPOLATION_PATTERN = /\$\{[^{}]*\}/g;

/**
 * Converts JSX and template markup into plain HTML.
 *
 * JSX attribute expressions are resolved first, so braces can never swallow the `>` that ends
 * a tag (`onClick={() => x}` would otherwise truncate the element and lose its className).
 * Template syntax is handled afterwards, by which point `style={{ ... }}` is already gone and
 * cannot be mistaken for a `{{ expression }}`.
 */
export function preprocessMarkup(source: string): string {
  const withoutJsxNoise = source
    .replace(JSX_COMMENT_PATTERN, '')
    .replace(JSX_FRAGMENT_PATTERN, '')
    .replace(JSX_SPREAD_PATTERN, '');

  return (
    resolveAttributeExpressions(withoutJsxNoise)
      .replace(CLASS_NAME_ATTRIBUTE_PATTERN, 'class$1')
      .replace(TEMPLATE_COMMENT_PATTERN, '')
      .replace(TEMPLATE_STATEMENT_PATTERN, '')
      // Must run before the expression pattern, which would otherwise swallow `{{#if}}` and
      // take the literal class names between the helpers down with it.
      .replace(TEMPLATE_BLOCK_PATTERN, '')
      .replace(TEMPLATE_EXPRESSION_PATTERN, DYNAMIC_VALUE_MARKER)
  );
}

/**
 * Rewrites `className={...}` to a plain `class="..."` and drops every other braced attribute,
 * so no JSX expression survives into the markup the parser sees.
 */
function resolveAttributeExpressions(source: string): string {
  let result = '';
  let cursor = 0;

  ATTRIBUTE_EXPRESSION_PATTERN.lastIndex = 0;
  let match = ATTRIBUTE_EXPRESSION_PATTERN.exec(source);

  while (match) {
    const openIndex = match.index + match[0].length - 1;
    const closeIndex = findClosingBrace(source, openIndex);
    if (closeIndex === -1) {
      break;
    }

    result += source.slice(cursor, match.index);
    if (match[1] === 'className' || match[1] === 'class') {
      result += `class="${extractClassNames(source.slice(openIndex + 1, closeIndex))}"`;
    }

    cursor = closeIndex + 1;
    ATTRIBUTE_EXPRESSION_PATTERN.lastIndex = cursor;
    match = ATTRIBUTE_EXPRESSION_PATTERN.exec(source);
  }

  return result + source.slice(cursor);
}

/** Finds the `}` matching the `{` at `openIndex`, ignoring braces inside strings. */
function findClosingBrace(source: string, openIndex: number): number {
  let depth = 0;
  let quote = '';

  for (let index = openIndex; index < source.length; index += 1) {
    const character = source[index];

    if (quote) {
      if (character === '\\') {
        index += 1;
      } else if (character === quote) {
        quote = '';
      }
      continue;
    }

    if (character === '"' || character === "'" || character === '`') {
      quote = character;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

/** Advances past a quoted string starting at `start`, returning the index of its closing quote. */
function skipString(source: string, start: number): number {
  const quote = source[start];
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === '\\') {
      index += 1;
    } else if (source[index] === quote) {
      return index;
    }
  }
  return source.length - 1;
}

const OPENING_BRACKETS = '([{';
const CLOSING_BRACKETS = ')]}';

/** Finds the `:` belonging to the `?` that opened this ternary, skipping nested ones. */
function findTernaryColon(source: string, start: number): number {
  let depth = 0;
  let pending = 0;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];

    if (character === '"' || character === "'" || character === '`') {
      index = skipString(source, index);
    } else if (OPENING_BRACKETS.includes(character)) {
      depth += 1;
    } else if (CLOSING_BRACKETS.includes(character)) {
      if (depth === 0) {
        return -1;
      }
      depth -= 1;
    } else if (depth === 0 && character === '?' && source[index + 1] !== '.') {
      pending += 1;
    } else if (depth === 0 && character === ':') {
      if (pending === 0) {
        return index;
      }
      pending -= 1;
    }
  }

  return -1;
}

/** Finds where the alternative branch of a ternary ends: a comma or a closing bracket. */
function findTernaryEnd(source: string, start: number): number {
  let depth = 0;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];

    if (character === '"' || character === "'" || character === '`') {
      index = skipString(source, index);
    } else if (OPENING_BRACKETS.includes(character)) {
      depth += 1;
    } else if (CLOSING_BRACKETS.includes(character)) {
      if (depth === 0) {
        return index;
      }
      depth -= 1;
    } else if (depth === 0 && character === ',') {
      return index;
    }
  }

  return source.length;
}

/**
 * Replaces each ternary with its first branch.
 *
 * The branches of `on ? 'link' : 'link-off'` are alternatives, so keeping both would emit
 * `.link.link-off`, a compound selector describing a state that never happens.
 */
function collapseTernaries(expression: string): string {
  let result = '';
  let index = 0;

  while (index < expression.length) {
    const character = expression[index];

    if (character === '"' || character === "'" || character === '`') {
      const end = skipString(expression, index);
      result += expression.slice(index, end + 1);
      index = end + 1;
      continue;
    }

    if (character === '?' && expression[index + 1] !== '.' && expression[index + 1] !== '?') {
      const colon = findTernaryColon(expression, index + 1);
      if (colon !== -1) {
        result += ` ${collapseTernaries(expression.slice(index + 1, colon))} `;
        index = findTernaryEnd(expression, colon + 1);
        continue;
      }
    }

    result += character;
    index += 1;
  }

  return result;
}

/**
 * Pulls class names out of a className expression.
 *
 * Handles string literals, template literals, CSS-modules lookups (`styles.card`) and helper
 * calls such as `clsx(...)`. Every string literal inside a className is treated as a class
 * name, which is what makes `clsx('a', on && 'b')` work. A ternary keeps only its first
 * branch, since its branches are alternatives rather than classes applied together. Anything
 * left with no recognisable class name becomes the dynamic marker and is dropped later.
 */
function extractClassNames(expression: string): string {
  const trimmed = expression.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length > 1) {
    // Substituted inline, with no padding: `card--${size}` must stay a single dynamic token
    // rather than leaving a danging `card--` behind.
    return trimmed.slice(1, -1).replace(INTERPOLATION_PATTERN, DYNAMIC_VALUE_MARKER).trim();
  }

  const names: string[] = [];
  let rest = collapseTernaries(trimmed);

  rest = rest.replace(BRACKET_ACCESS_PATTERN, (_match, object: string, _q, property: string) => {
    if (STYLES_OBJECT_PATTERN.test(object)) {
      names.push(property);
    }
    return ' ';
  });

  rest = rest.replace(MEMBER_ACCESS_PATTERN, (match, object: string, property: string) => {
    if (!STYLES_OBJECT_PATTERN.test(object)) {
      return match;
    }
    names.push(property);
    return ' ';
  });

  for (const literal of rest.matchAll(STRING_LITERAL_PATTERN)) {
    names.push(...literal[2].split(/\s+/));
  }

  const classNames = names.filter(Boolean);
  return classNames.length ? classNames.join(' ') : DYNAMIC_VALUE_MARKER;
}
