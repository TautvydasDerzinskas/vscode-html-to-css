import type { ChildNode, Container, Root } from 'postcss';
import postcssLess from 'postcss-less';
import postcssScss from 'postcss-scss';
import selectorParser from 'postcss-selector-parser';
import ICssToHtmlOptions from '../interfaces/css-to-html-options.interface';

/** `html` writes `class` / `for`; `jsx` writes `className` / `htmlFor` and self-closes void tags. */
export type MarkupSyntax = 'html' | 'jsx';

/** One step of a selector: `a.link#main[href]`. */
interface Compound {
  tag: string;
  ids: string[];
  classes: string[];
  attributes: [name: string, value: string | undefined][];
}

type Combinator = 'descendant' | 'sibling';

interface Step {
  /** How this step relates to the one before it; the first step has none. */
  combinator: Combinator | undefined;
  compound: Compound;
}

interface ElementNode extends Compound {
  children: ElementNode[];
}

const INDENT = '  ';

const DEFAULT_OPTIONS: ICssToHtmlOptions = {
  guessTagNames: false,
  defaultTagName: 'div',
};

/** At-rules whose body applies to the surrounding selector, so their rules are kept. */
const TRANSPARENT_AT_RULES = new Set([
  'media',
  'supports',
  'container',
  'layer',
  'document',
  'include',
  'if',
  'else',
]);

/** Selectors for the page itself, never an element in a fragment. */
const PAGE_TAGS = new Set(['html', 'body']);

/** `#{...}` (SCSS) and `@{...}` (LESS): a selector only known once the stylesheet compiles. */
const INTERPOLATION_PATTERN = /[#@]\{/;

/** A LESS mixin definition or guard, e.g. `.mixin(@a)` or `.theme() when (@dark)`. */
const MIXIN_PATTERN = /[.#][\w-]+\s*\(/;

/** `&__element`, `&-element` or `&_element`, but not a `&--modifier`. */
const BEM_ELEMENT_SUFFIX_PATTERN = /^&(?!--)[-_]/;

/** The part of a selector after its last combinator: `.a > .b.c` -> `.b.c`. */
function lastCompound(selector: string): string {
  const parts = selector.split(/\s*[>+~]\s*|\s+/);
  return parts[parts.length - 1];
}

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

/**
 * Every HTML and SVG element name. A tag outside this list, such as the `else` in a selected
 * `else { ... }` block of JavaScript, means the text is not a stylesheet.
 */
const KNOWN_TAGS = new Set([
  ...VOID_TAGS,
  ...'a abbr address article aside audio b bdi bdo blockquote body button canvas caption cite code colgroup data datalist dd del details dfn dialog div dl dt em fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup html i iframe ins kbd label legend li main map mark menu meter nav noscript object ol optgroup option output p picture pre progress q rp rt ruby s samp script search section select slot small span strong style sub summary sup table tbody td template textarea tfoot th thead time title tr u ul var video'.split(
    ' '
  ),
  ...'svg g path circle ellipse line polygon polyline rect text tspan use defs symbol clippath mask pattern lineargradient radialgradient stop image foreignobject'.split(
    ' '
  ),
]);

/** Tags a child must have for its parent to be valid HTML; only used when guessing. */
const CHILD_TAG_BY_PARENT: Record<string, string> = {
  ul: 'li',
  ol: 'li',
  menu: 'li',
  table: 'tr',
  thead: 'tr',
  tbody: 'tr',
  tfoot: 'tr',
  tr: 'td',
  select: 'option',
  optgroup: 'option',
  dl: 'dt',
};

/** Words in a class or id that suggest a tag; only used when guessing. First match wins. */
const TAG_BY_WORD: [RegExp, string][] = [
  [/^(link|anchor)$/, 'a'],
  [/^(btn|button|cta)$/, 'button'],
  [/^(title|heading|headline)$/, 'h2'],
  [/^(subtitle|subheading)$/, 'h3'],
  [/^(text|paragraph|description|desc|lead|intro|excerpt|copy)$/, 'p'],
  [/^(img|image|avatar|photo|picture|thumbnail|thumb)$/, 'img'],
  [/^(icon)$/, 'i'],
  [/^(list|items)$/, 'ul'],
  [/^(item)$/, 'li'],
  [/^(nav|navigation|navbar)$/, 'nav'],
  [/^(header|masthead)$/, 'header'],
  [/^(footer)$/, 'footer'],
  [/^(main)$/, 'main'],
  [/^(section)$/, 'section'],
  [/^(article|post)$/, 'article'],
  [/^(aside|sidebar)$/, 'aside'],
  [/^(form)$/, 'form'],
  [/^(input|field)$/, 'input'],
  [/^(label)$/, 'label'],
  [/^(textarea)$/, 'textarea'],
  [/^(select|dropdown)$/, 'select'],
  [/^(table)$/, 'table'],
  [/^(figure)$/, 'figure'],
  [/^(caption|figcaption)$/, 'figcaption'],
  [/^(video)$/, 'video'],
  [/^(quote|blockquote)$/, 'blockquote'],
  [/^(code)$/, 'code'],
  [/^(time|date)$/, 'time'],
  [/^(badge|tag|chip|pill)$/, 'span'],
];

/** Tags that cannot contain themselves; a guess never nests one directly inside another. */
const NON_NESTABLE_TAGS = new Set(['a', 'button', 'form', 'label', 'p']);

/** Attributes that only one tag carries; only used when guessing. */
const TAG_BY_ATTRIBUTE: Record<string, string> = {
  href: 'a',
  src: 'img',
  alt: 'img',
  for: 'label',
  type: 'input',
  placeholder: 'input',
};

const JSX_ATTRIBUTE_NAMES: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
};

/**
 * Converts CSS / SCSS / LESS rules into the HTML skeleton their selectors describe.
 *
 * Only what the selectors say is kept: classes, ids, attributes and nesting. Tags come from
 * the selectors too; anything without one gets `defaultTagName`, unless `guessTagNames`
 * picks one from the class names.
 */
class CssToHtmlService {
  private options: ICssToHtmlOptions;

  constructor(options?: Partial<ICssToHtmlOptions>) {
    this.options = this.normalizeOptions(options);
  }

  /** True when `text` is a stylesheet with at least one rule that describes an element. */
  public isStringCss(text: string): boolean {
    return this.buildTree(text).length > 0;
  }

  /** Returns the HTML skeleton, or an empty string when the text holds no usable rules. */
  public convert(css: string, syntax: MarkupSyntax = 'html'): string {
    const tree = this.buildTree(css);
    if (!tree.length) {
      return '';
    }
    return `${this.render(tree, syntax, 0, undefined).join('\n')}\n`;
  }

  private normalizeOptions(options?: Partial<ICssToHtmlOptions>): ICssToHtmlOptions {
    const tagName = options?.defaultTagName?.trim().toLowerCase();
    return {
      guessTagNames:
        typeof options?.guessTagNames === 'boolean'
          ? options.guessTagNames
          : DEFAULT_OPTIONS.guessTagNames,
      defaultTagName:
        tagName && /^[a-z][a-z0-9-]*$/.test(tagName) ? tagName : DEFAULT_OPTIONS.defaultTagName,
    };
  }

  private buildTree(css: string): ElementNode[] {
    const root = this.parse(css);
    if (!root) {
      return [];
    }

    const tree: ElementNode[] = [];
    for (const selector of this.collectSelectors(root, [])) {
      const steps = this.parseSelector(selector);
      if (steps) {
        this.insert(tree, steps);
      }
    }
    return tree;
  }

  /** SCSS syntax also reads plain CSS; LESS mixins and guards need their own parser. */
  private parse(css: string): Root | undefined {
    if (!css.trim()) {
      return undefined;
    }
    for (const syntax of [postcssScss, postcssLess]) {
      try {
        return syntax.parse(css);
      } catch {
        // Not this syntax; try the next one.
      }
    }
    return undefined;
  }

  /** Flattens nested rules into full selectors, resolving `&` against the parents. */
  private collectSelectors(container: Container, parents: string[]): string[] {
    const selectors: string[] = [];

    for (const node of container.nodes ?? []) {
      if (node.type === 'rule') {
        const resolved = this.resolveNesting(node.selectors, parents);
        // Nothing usable here, so nothing nested inside can be placed either.
        if (resolved.length) {
          selectors.push(...resolved, ...this.collectSelectors(node, resolved));
        }
      } else if (node.type === 'atrule' && this.isTransparentAtRule(node)) {
        selectors.push(...this.collectSelectors(node, parents));
      } else if (node.type === 'atrule' && node.name === 'at-root') {
        // `@at-root .b {}` carries its selector as the at-rule's params; the block form
        // `@at-root { .b {} }` holds ordinary rules. Either way they leave the parents behind.
        const resolved = node.params ? this.resolveNesting(node.params.split(','), []) : [];
        selectors.push(...resolved);
        if (!node.params || resolved.length) {
          selectors.push(...this.collectSelectors(node, resolved));
        }
      }
    }

    return selectors;
  }

  private isTransparentAtRule(node: ChildNode & { type: 'atrule' }): boolean {
    // postcss-less reports mixin calls and variables as at-rules too.
    const lessNode = node as { mixin?: boolean; variable?: boolean };
    return !lessNode.mixin && !lessNode.variable && TRANSPARENT_AT_RULES.has(node.name);
  }

  /**
   * Joins each selector with each parent. Selectors that cannot become an element (SCSS
   * placeholders, LESS mixin definitions and guards, interpolation, nested properties) are
   * dropped, and with them everything nested inside.
   */
  private resolveNesting(selectors: string[], parents: string[]): string[] {
    const usable = selectors
      .map(selector => selector.trim())
      .filter(
        selector =>
          !INTERPOLATION_PATTERN.test(selector) &&
          !MIXIN_PATTERN.test(selector) &&
          !selector.startsWith('%') &&
          !selector.endsWith(':')
      );
    if (!parents.length) {
      return usable.filter(selector => !selector.includes('&'));
    }

    return parents.flatMap(parent =>
      usable.map(selector => {
        if (!selector.includes('&')) {
          return `${parent} ${selector}`;
        }
        const joined = selector.replaceAll('&', parent);
        // `&__title` and `&-title` name a BEM element, which lives inside its block. CSS would
        // compile them to a bare `.card__title`, losing the nesting the author wrote.
        // `&--modifier` stays as it is: it is the same element, and is merged back into it.
        return BEM_ELEMENT_SUFFIX_PATTERN.test(selector)
          ? `${parent} ${lastCompound(joined)}`
          : joined;
      })
    );
  }

  /** Splits a full selector into steps, or returns undefined if it names no element. */
  private parseSelector(selector: string): Step[] | undefined {
    let parsed: selectorParser.Root;
    try {
      parsed = selectorParser().astSync(selector);
    } catch {
      return undefined;
    }
    if (parsed.nodes.length !== 1) {
      return undefined;
    }

    const steps: Step[] = [];
    let combinator: Combinator | undefined;
    let compound = this.emptyCompound();
    let hasContent = false;

    const flush = (): boolean => {
      if (hasContent) {
        steps.push({ combinator: steps.length ? combinator : undefined, compound });
      } else if (combinator === 'sibling') {
        // `:root + .a` or similar: nothing to be a sibling of.
        return false;
      }
      compound = this.emptyCompound();
      hasContent = false;
      return true;
    };

    for (const node of parsed.nodes[0].nodes) {
      switch (node.type) {
        case 'tag': {
          const tag = node.value.toLowerCase();
          if (!KNOWN_TAGS.has(tag) && !tag.includes('-')) {
            return undefined;
          }
          if (!PAGE_TAGS.has(tag)) {
            compound.tag = tag;
            hasContent = true;
          }
          break;
        }
        case 'class':
          compound.classes.push(node.value);
          hasContent = true;
          break;
        case 'id':
          compound.ids.push(node.value);
          hasContent = true;
          break;
        case 'attribute':
          compound.attributes.push([
            node.attribute.toLowerCase(),
            node.operator === '=' ? node.value : undefined,
          ]);
          hasContent = true;
          break;
        case 'combinator': {
          if (!flush()) {
            return undefined;
          }
          const value = node.value.trim();
          combinator = value === '+' || value === '~' ? 'sibling' : 'descendant';
          break;
        }
        case 'pseudo':
        case 'universal':
        case 'comment':
          // States, pseudo-elements and `*` describe no element of their own.
          break;
        default:
          return undefined;
      }
    }

    if (!flush()) {
      return undefined;
    }
    if (steps.length && steps[0].combinator) {
      steps[0].combinator = undefined;
    }
    return steps.length ? steps : undefined;
  }

  private emptyCompound(): Compound {
    return { tag: '', ids: [], classes: [], attributes: [] };
  }

  /** Adds a selector's elements to the tree, reusing elements it already describes. */
  private insert(tree: ElementNode[], steps: Step[]): void {
    let siblings = tree;
    let previousSiblings = tree;

    for (const { combinator, compound } of steps) {
      const container = combinator === 'sibling' ? previousSiblings : siblings;
      const element = this.findOrAdd(container, compound);
      previousSiblings = container;
      siblings = element.children;
    }
  }

  /**
   * Finds an element in `container` that `compound` describes, merging the two, or adds a new
   * one. Two compounds describe the same element when one's identity contains the other's:
   * `.btn` and `.btn.is-active`, or `.card` and its BEM modifier `.card--featured`.
   */
  private findOrAdd(container: ElementNode[], compound: Compound): ElementNode {
    const identity = this.identity(compound);
    const existing = container.find(element => {
      if (compound.tag && element.tag && compound.tag !== element.tag) {
        return false;
      }
      const other = this.identity(element);
      return this.isSubset(identity, other) || this.isSubset(other, identity);
    });

    if (!existing) {
      const element: ElementNode = { ...compound, children: [] };
      container.push(element);
      return element;
    }

    existing.tag ||= compound.tag;
    existing.ids = this.union(existing.ids, compound.ids);
    existing.classes = this.union(existing.classes, compound.classes);
    for (const attribute of compound.attributes) {
      if (!existing.attributes.some(([name]) => name === attribute[0])) {
        existing.attributes.push(attribute);
      }
    }
    return existing;
  }

  /** Tag, ids, classes and attributes, with each BEM modifier reduced to its block. */
  private identity(compound: Compound): Set<string> {
    return new Set([
      ...(compound.tag ? [`<${compound.tag}`] : []),
      ...compound.ids.map(id => `#${id}`),
      ...compound.classes.map(className => `.${className.split('--')[0]}`),
      ...compound.attributes.map(([name, value]) => `[${name}=${value ?? ''}`),
    ]);
  }

  private isSubset(subset: Set<string>, superset: Set<string>): boolean {
    return subset.size > 0 && [...subset].every(token => superset.has(token));
  }

  private union(first: string[], second: string[]): string[] {
    return [...new Set([...first, ...second])];
  }

  private render(
    elements: ElementNode[],
    syntax: MarkupSyntax,
    depth: number,
    parentTag: string | undefined
  ): string[] {
    const indent = INDENT.repeat(depth);
    const lines: string[] = [];

    for (const element of elements) {
      const tag = this.resolveTag(element, parentTag);
      const opening = `<${tag}${this.renderAttributes(element, syntax)}`;

      if (VOID_TAGS.has(tag)) {
        lines.push(`${indent}${opening}${syntax === 'jsx' ? ' />' : '>'}`);
        // Children of a void element have nowhere to go, so they follow it instead.
        lines.push(...this.render(element.children, syntax, depth, parentTag));
      } else if (element.children.length) {
        lines.push(
          `${indent}${opening}>`,
          ...this.render(element.children, syntax, depth + 1, tag),
          `${indent}</${tag}>`
        );
      } else {
        lines.push(`${indent}${opening}></${tag}>`);
      }
    }

    return lines;
  }

  private resolveTag(element: ElementNode, parentTag: string | undefined): string {
    if (element.tag) {
      return element.tag;
    }
    if (this.options.guessTagNames) {
      const guessed = this.guessTag(element, parentTag);
      if (guessed) {
        return guessed;
      }
    }
    return this.options.defaultTagName;
  }

  private guessTag(element: ElementNode, parentTag: string | undefined): string | undefined {
    const byParent = parentTag ? CHILD_TAG_BY_PARENT[parentTag] : undefined;
    if (byParent) {
      return byParent;
    }

    // The last word of a name says what the element is: `card__title` is a title,
    // `primary-btn` is a button, and `form-row` is a row rather than a form.
    const words = [...element.classes, ...element.ids]
      .filter(name => !name.includes('--'))
      .map(name => name.toLowerCase().split(/[-_]+/).pop() ?? '');

    const guesses = [
      ...words.map(word => TAG_BY_WORD.find(([pattern]) => pattern.test(word))?.[1]),
      ...element.attributes.map(([name]) => TAG_BY_ATTRIBUTE[name]),
    ];
    // A guess must never produce invalid nesting, such as a form directly inside a form.
    return guesses.find(tag => tag && !(tag === parentTag && NON_NESTABLE_TAGS.has(tag)));
  }

  private renderAttributes(element: ElementNode, syntax: MarkupSyntax): string {
    const attributes: [string, string | undefined][] = [];
    if (element.ids.length) {
      attributes.push(['id', element.ids[0]]);
    }
    if (element.classes.length) {
      attributes.push(['class', element.classes.join(' ')]);
    }
    attributes.push(...element.attributes.filter(([name]) => name !== 'id' && name !== 'class'));

    return attributes
      .map(([name, value]) => {
        const attributeName = syntax === 'jsx' ? (JSX_ATTRIBUTE_NAMES[name] ?? name) : name;
        return value === undefined
          ? ` ${attributeName}`
          : ` ${attributeName}="${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`;
      })
      .join('');
  }
}

export default CssToHtmlService;
