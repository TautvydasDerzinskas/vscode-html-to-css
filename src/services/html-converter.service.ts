import { HTMLElement, parse } from 'node-html-parser';
import { DYNAMIC_VALUE_MARKER, preprocessMarkup } from './markup-preprocessor.service';
import IOptions from '../interfaces/options.interface';
import IDomObject from '../interfaces/dom-object.interface';

/** Tags that get :hover / :active / :focus stubs generated for them. */
const CLICKABLE_TAGS = new Set(['a', 'button']);

/** Tags that never render, so they never produce a selector. */
const NON_RENDERED_TAGS = new Set([
  'base',
  'head',
  'link',
  'meta',
  'noscript',
  'script',
  'style',
  'template',
  'title',
]);

const STATE_SELECTORS = [':hover', ':active', ':focus'];

/** Matches an opening, closing or self-closing tag. */
const HTML_PATTERN = /<\s*\/?\s*[a-zA-Z][^>]*>/;

const INDENT = '  ';

const DEFAULT_OPTIONS: IOptions = {
  reduceSiblings: true,
  combineParents: true,
  hideTags: true,
  convertBEM: true,
  preappendHtml: false,
  classesOnly: false,
  ignoredSelectors: [],
};

/** The parsed form of `ignoredSelectors`, split by selector kind. */
interface IgnoredSelectors {
  classes: Set<string>;
  ids: Set<string>;
  tags: Set<string>;
}

const TAG_NAME_PATTERN = /^[a-z][\w-]*$/i;

/**
 * Converts an HTML fragment into CSS / LESS / SCSS selector scaffolding.
 */
class HtmlConverterService {
  private options: IOptions;

  constructor(options?: Partial<IOptions>) {
    this.options = this.normalizeOptions(options);
  }

  /**
   * Replaces the current options. Missing or invalid values fall back to defaults.
   */
  public updateConfiguration(options?: Partial<IOptions>): void {
    this.options = this.normalizeOptions(options);
  }

  /**
   * Returns the lower-cased extension of a file path, or '' when there is none.
   */
  public getFileExtension(filePath: string): string {
    return filePath.split('.').pop()?.toLowerCase() ?? '';
  }

  /**
   * Cheap check for whether a string looks like an HTML fragment.
   */
  public isStringHtml(text: string): boolean {
    return !!text?.trim() && HTML_PATTERN.test(preprocessMarkup(text));
  }

  /**
   * Converts an HTML fragment into selector scaffolding. `css` gets flat descendant
   * selectors, every other extension gets nested (LESS/SCSS) output.
   *
   * Returns an empty string when the fragment holds no renderable elements.
   */
  public convert(html: string, fileExtension: string): string {
    const isCss = fileExtension.toLowerCase() === 'css';

    let dom = this.filterSelectors(this.parseHtml(html), this.parseIgnoredSelectors());
    if (this.options.convertBEM && !isCss) {
      dom = this.convertBEM(dom);
    }
    dom = this.mergeSiblings(dom);

    const rules = isCss ? this.renderCss(dom, '') : this.renderScss(dom, 0);
    if (!rules.length) {
      return '';
    }

    const body = `${rules.join('\n')}\n`;
    return this.options.preappendHtml ? `${this.buildHtmlComment(html)}${body}` : body;
  }

  private normalizeOptions(options?: Partial<IOptions>): IOptions {
    const normalized: IOptions = { ...DEFAULT_OPTIONS, ignoredSelectors: [] };
    const booleanKeys = [
      'reduceSiblings',
      'combineParents',
      'hideTags',
      'convertBEM',
      'preappendHtml',
      'classesOnly',
    ] as const;

    for (const key of booleanKeys) {
      const value = options?.[key];
      if (typeof value === 'boolean') {
        normalized[key] = value;
      }
    }

    if (Array.isArray(options?.ignoredSelectors)) {
      normalized.ignoredSelectors = options.ignoredSelectors.filter(
        (selector): selector is string => typeof selector === 'string'
      );
    }

    return normalized;
  }

  /**
   * Sorts `ignoredSelectors` into classes, ids and tags. Entries may themselves be
   * comma-separated (`.container, .text-center, p`); anything that is not a simple class,
   * id or tag selector, such as `div > .a`, is ignored as a whole.
   */
  private parseIgnoredSelectors(): IgnoredSelectors {
    const ignored: IgnoredSelectors = { classes: new Set(), ids: new Set(), tags: new Set() };

    for (const entry of this.options.ignoredSelectors) {
      for (const selector of entry.split(',').map(part => part.trim())) {
        if (selector.startsWith('.') && selector.length > 1) {
          ignored.classes.add(selector.slice(1));
        } else if (selector.startsWith('#') && selector.length > 1) {
          ignored.ids.add(selector.slice(1));
        } else if (TAG_NAME_PATTERN.test(selector)) {
          ignored.tags.add(selector.toLowerCase());
        }
      }
    }

    return ignored;
  }

  /**
   * Removes ignored selectors, and every tag and id in `classesOnly` mode. Runs before any
   * other transform so the ignore list matches the class names as written in the markup.
   * It also applies `hideTags`, for the same reason. An element left with nothing to select
   * on produces no rule; its children move up.
   * `metaTag` is untouched, so `<a>` and `<button>` keep their state stubs.
   */
  private filterSelectors(dom: IDomObject[], ignored: IgnoredSelectors): IDomObject[] {
    const { classesOnly, hideTags } = this.options;

    return dom.map(element => {
      // Decided on the markup as written: ignoring `.container` must not turn
      // `<div class="container">` into a bare `div` rule.
      const tagHidden =
        classesOnly ||
        ignored.tags.has(element.tag) ||
        (hideTags && (element.classes.length > 0 || element.ids.length > 0));

      return {
        ...element,
        tag: tagHidden ? '' : element.tag,
        ids: classesOnly ? [] : element.ids.filter(id => !ignored.ids.has(id)),
        classes: element.classes.filter(className => !ignored.classes.has(className)),
        children: this.filterSelectors(element.children, ignored),
      };
    });
  }

  private parseHtml(html: string): IDomObject[] {
    return this.toDomObjects(parse(preprocessMarkup(html)).children);
  }

  private toDomObjects(elements: HTMLElement[]): IDomObject[] {
    const dom: IDomObject[] = [];

    for (const element of elements) {
      const rawTag = element.rawTagName ?? '';
      const tag = rawTag.toLowerCase();
      if (!tag || tag.includes(DYNAMIC_VALUE_MARKER) || NON_RENDERED_TAGS.has(tag)) {
        continue;
      }

      const isComponent = this.isComponentTag(rawTag);

      dom.push({
        tag: isComponent ? '' : tag,
        metaTag: isComponent ? undefined : tag,
        ids: this.splitTokens(element.id),
        classes: this.filterTokens(Array.from(element.classList.values())),
        children: this.toDomObjects(element.children),
      });
    }

    return dom;
  }

  private splitTokens(value: string | undefined): string[] {
    return this.filterTokens(value ? value.trim().split(/\s+/) : []);
  }

  /**
   * A JSX component renders to markup we cannot see, so its name is never a CSS selector.
   * Detected as PascalCase (or dotted, like `Foo.Bar`) to leave upper-case HTML alone:
   * `<DIV>` is a div, `<Card>` is a component.
   */
  private isComponentTag(rawTag: string): boolean {
    return /^[A-Z]/.test(rawTag) && (/[a-z]/.test(rawTag) || rawTag.includes('.'));
  }

  /** Drops empty tokens and any token whose value depends on a template expression. */
  private filterTokens(tokens: string[]): string[] {
    return tokens.filter(token => token && !token.includes(DYNAMIC_VALUE_MARKER));
  }

  /**
   * Rewrites BEM classes into nestable `&` selectors: a modifier becomes a child
   * `&--modifier` block, and an element named after its parent block becomes `&__element`.
   */
  private convertBEM(dom: IDomObject[]): IDomObject[] {
    return dom.map(element => {
      const ownClasses = new Set(element.classes);
      const modifiers: IDomObject[] = [];

      const classes = element.classes.filter(className => {
        const block = className.split('--')[0];
        if (block === className || !ownClasses.has(block)) {
          return true;
        }
        modifiers.push({
          tag: '',
          ids: [],
          classes: [`&--${className.slice(block.length + 2)}`],
          children: [],
        });
        return false;
      });

      const children = element.children.map(child => ({
        ...child,
        classes: child.classes.map(className => {
          const block = classes.find(
            candidate => !candidate.startsWith('&') && className.startsWith(`${candidate}__`)
          );
          return block ? `&__${className.slice(block.length + 2)}` : className;
        }),
      }));

      return { ...element, classes, children: this.convertBEM(children).concat(modifiers) };
    });
  }

  /**
   * Collapses sibling elements that render to the same selector, concatenating their
   * children so nothing is lost. Childless duplicates are governed by `reduceSiblings`,
   * duplicates with children by `combineParents`.
   */
  private mergeSiblings(dom: IDomObject[]): IDomObject[] {
    const merged: IDomObject[] = [];
    const indexBySelector = new Map<string, number>();

    for (const element of dom) {
      const selector = this.getSelector(element);
      const existingIndex = selector ? indexBySelector.get(selector) : undefined;

      if (existingIndex === undefined) {
        indexBySelector.set(selector, merged.length);
        merged.push({ ...element, children: [...element.children] });
        continue;
      }

      const existing = merged[existingIndex];
      const hasChildren = !!existing.children.length || !!element.children.length;
      const allowed = hasChildren ? this.options.combineParents : this.options.reduceSiblings;

      if (!allowed) {
        merged.push({ ...element, children: [...element.children] });
        continue;
      }

      existing.children = existing.children.concat(element.children);
      // Keep the state stubs if any of the merged elements was clickable.
      if (!this.isClickable(existing) && this.isClickable(element)) {
        existing.metaTag = element.metaTag;
      }
    }

    // Every entry was freshly constructed above, so it is safe to recurse in place.
    for (const element of merged) {
      element.children = this.mergeSiblings(element.children);
    }

    return merged;
  }

  private renderScss(dom: IDomObject[], depth: number): string[] {
    const lines: string[] = [];

    for (const element of dom) {
      const selector = this.getSelector(element);
      if (!selector) {
        lines.push(...this.renderScss(element.children, depth));
        continue;
      }

      const indent = INDENT.repeat(depth);
      const childIndent = INDENT.repeat(depth + 1);
      const body = [
        ...this.getStateSelectors(element).map(state => `${childIndent}&${state} {}`),
        ...this.renderScss(element.children, depth + 1),
      ];

      if (body.length) {
        lines.push(`${indent}${selector} {`, ...body, `${indent}}`);
      } else {
        lines.push(`${indent}${selector} {}`);
      }
    }

    return lines;
  }

  private renderCss(dom: IDomObject[], prefix: string): string[] {
    const lines: string[] = [];

    for (const element of dom) {
      const selector = this.getSelector(element);
      if (!selector) {
        lines.push(...this.renderCss(element.children, prefix));
        continue;
      }

      const fullSelector = `${prefix}${selector}`;
      lines.push(`${fullSelector} {}`);
      lines.push(...this.getStateSelectors(element).map(state => `${fullSelector}${state} {}`));
      lines.push(...this.renderCss(element.children, `${fullSelector} `));
    }

    return lines;
  }

  private getStateSelectors(element: IDomObject): string[] {
    return this.isClickable(element) ? STATE_SELECTORS : [];
  }

  private isClickable(element: IDomObject): boolean {
    return !!element.metaTag && CLICKABLE_TAGS.has(element.metaTag);
  }

  private getSelector(element: IDomObject): string {
    const ids = element.ids.length ? `#${element.ids.join('#')}` : '';
    const classes = element.classes
      .map(className => (className.startsWith('&') ? className : `.${className}`))
      .join('');
    return `${element.tag}${ids}${classes}`;
  }

  private buildHtmlComment(html: string): string {
    // `*/` inside the markup would close the comment early.
    const safeHtml = html.trim().replace(/\*\//g, '*\\/');
    return `/*\n${safeHtml
      .split('\n')
      .map(line => ` * ${line}`)
      .join('\n')}\n */\n`;
  }
}

export default HtmlConverterService;
