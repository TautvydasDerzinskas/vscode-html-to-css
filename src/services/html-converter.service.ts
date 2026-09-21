import { HTMLElement, parse } from 'node-html-parser';
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
};

/**
 * Converts an HTML fragment into CSS / LESS / SCSS selector scaffolding.
 */
class HtmlConverterService {
  private options: IOptions;

  constructor(options?: Partial<IOptions>) {
    this.options = this.normalizeOptions(options);
  }

  /**
   * Replaces the current options. Missing or non-boolean values fall back to defaults.
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
    return !!text?.trim() && HTML_PATTERN.test(text);
  }

  /**
   * Converts an HTML fragment into selector scaffolding. `css` gets flat descendant
   * selectors, every other extension gets nested (LESS/SCSS) output.
   *
   * Returns an empty string when the fragment holds no renderable elements.
   */
  public convert(html: string, fileExtension: string): string {
    const isCss = fileExtension.toLowerCase() === 'css';

    let dom = this.parseHtml(html);
    if (this.options.hideTags) {
      dom = this.removeTags(dom);
    }
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
    const normalized = { ...DEFAULT_OPTIONS };
    for (const key of Object.keys(DEFAULT_OPTIONS) as (keyof IOptions)[]) {
      if (typeof options?.[key] === 'boolean') {
        normalized[key] = options[key] as boolean;
      }
    }
    return normalized;
  }

  private parseHtml(html: string): IDomObject[] {
    return this.toDomObjects(parse(html).children);
  }

  private toDomObjects(elements: HTMLElement[]): IDomObject[] {
    const dom: IDomObject[] = [];

    for (const element of elements) {
      const tag = element.rawTagName?.toLowerCase() ?? '';
      if (!tag || NON_RENDERED_TAGS.has(tag)) {
        continue;
      }

      dom.push({
        tag,
        metaTag: tag,
        ids: this.splitTokens(element.id),
        classes: Array.from(element.classList.values()).filter(Boolean),
        children: this.toDomObjects(element.children),
      });
    }

    return dom;
  }

  private splitTokens(value: string | undefined): string[] {
    return value ? value.trim().split(/\s+/).filter(Boolean) : [];
  }

  /**
   * Drops the tag from any element that already has a class or an id, so the selector
   * stays as unspecific as possible. `metaTag` keeps the original tag for state stubs.
   */
  private removeTags(dom: IDomObject[]): IDomObject[] {
    return dom.map(element => ({
      ...element,
      tag: element.classes.length || element.ids.length ? '' : element.tag,
      children: this.removeTags(element.children),
    }));
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
