import { JSDOM } from 'jsdom';
import utilityService from './utility.service';
import IOptions from '../interfaces/options.interface';
import IDomObject from '../interfaces/dom-object.interface';

/**
 * Converts HTML to SCSS/CSS with configurable options
 */
class HtmlToScss {
  private static readonly CLICKABLE_TAGS = new Set(['a', 'button']);
  private static readonly MAX_DEPTH = 4;
  private static readonly HTML_PATTERNS = [
    /<\s*[a-zA-Z][^>]*>/,         // Opening tag
    /<\s*\/\s*[a-zA-Z][^>]*>/,    // Closing tag
    /<\s*[a-zA-Z][^>]*\s*\/>/,    // Self-closing tag
  ];

  constructor(private options: IOptions) {
    this.validateOptions(options);
  }

  /**
   * Updates configuration options with validation
   */
  public updateConfiguration(options: IOptions): void {
    this.validateOptions(options);
    this.options = { ...options };
  }

  /**
   * Extracts file extension from a file path
   */
  public getFileExtension(filePath: string): string {
    return filePath.split('.').pop()?.toLowerCase() || '';
  }

  /**
   * Checks if a string contains valid HTML-like content
   */
  public isStringHtml(text: string): boolean {
    if (!text?.trim()) return false;

    const cleanText = text.replace(/\s+/g, ' ').trim();
    return HtmlToScss.HTML_PATTERNS.some(pattern => pattern.test(cleanText));
  }

  /**
   * Converts HTML string to SCSS/CSS based on file extension
   */
  public convert(dom: string, fileExtension: string): string {
    try {
      const isCss = fileExtension === 'css';
      let processedDom = this.extractHtml(dom);

      processedDom = this.options.hideTags ? this.removeTags(processedDom) : processedDom;
      processedDom = this.options.reduceSiblings ? this.reduceSiblings(processedDom) : processedDom;
      processedDom = this.options.combineParents ? this.combineSimilarParents(processedDom) : processedDom;
      processedDom = this.options.convertBEM && !isCss ? this.convertBEM(processedDom) : processedDom;
      processedDom = this.reduceTiers(processedDom, HtmlToScss.MAX_DEPTH);

      const prefix = this.options.preappendHtml
        ? `/*\n${dom.trim().split('\n').map(line => ` * ${line}`).join('\n')}\n */\n`
        : '';

      return prefix + (isCss ? this.convertToCss(processedDom) : this.convertToScss(processedDom));
    } catch (error) {
      console.error('Error converting HTML:', error);
      throw new Error('Failed to convert HTML to CSS/SCSS');
    }
  }

  private validateOptions(options: IOptions): void {
    if (!options || typeof options !== 'object') {
      throw new Error('Options must be a valid object');
    }
    const requiredOptions: (keyof IOptions)[] = ['reduceSiblings', 'combineParents', 'hideTags', 'convertBEM', 'preappendHtml'];
    for (const option of requiredOptions) {
      if (typeof options[option] !== 'boolean') {
        throw new Error(`Option ${option} must be a boolean`);
      }
    }
  }

  private removeTags(dom: IDomObject[]): IDomObject[] {
    return utilityService.deepCopy(dom).map(el => ({
      ...el,
      tag: (el.classes.length || el.ids.length) ? '' : el.tag,
      children: this.removeTags(el.children),
    }));
  }

  private getClickSelectors(domElement: IDomObject, isCss: boolean, spacing = '', prefix = ''): string {
    if (domElement.metaTag && HtmlToScss.CLICKABLE_TAGS.has(domElement.metaTag)) {
      const selectorPrefix = isCss ? prefix : '&';
      return [
        `${spacing}${selectorPrefix}:hover {}`,
        `${spacing}${selectorPrefix}:active {}`,
        `${spacing}${selectorPrefix}:focus {}`,
      ].join('\n');
    }
    return '';
  }

  private reduceSiblings(dom: IDomObject[]): IDomObject[] {
    const newDom = utilityService.deepCopy(dom);
    if (newDom.length > 1) {
      const uniqueElements = new Map<string, IDomObject>();
      newDom.forEach(el => {
        const key = utilityService.generateKey(el);
        if (!uniqueElements.has(key)) uniqueElements.set(key, el);
      });
      return Array.from(uniqueElements.values()).map(el => ({
        ...el,
        children: this.reduceSiblings(el.children),
      }));
    }
    return newDom.map(el => ({ ...el, children: this.reduceSiblings(el.children) }));
  }

  private combineSimilarParents(dom: IDomObject[]): IDomObject[] {
    const newDom = utilityService.deepCopy(dom);
    if (newDom.length <= 1 || !newDom.some(el => el.children.length)) return newDom;

    const combined = new Map<string, IDomObject>();
    newDom.forEach(el => {
      const key = `${el.tag}|${el.metaTag ?? ''}|${el.ids.join()}|${el.classes.join()}`;
      if (combined.has(key)) {
        combined.get(key)!.children = combined.get(key)!.children.concat(el.children);
      } else {
        combined.set(key, { ...el });
      }
    });

    return Array.from(combined.values()).map(el => ({
      ...el,
      children: this.combineSimilarParents(el.children),
    }));
  }

  private reduceTiers(dom: IDomObject[], maxDepth: number, currentDepth = 1): IDomObject[] {
    const newDom = utilityService.deepCopy(dom);
    if (currentDepth >= maxDepth) {
      const tierChildren: IDomObject[] = [];
      newDom.forEach(el => {
        el.children = el.children.filter(child => {
          const keep = child.classes.length > 0 && child.classes[0].startsWith('&');
          if (!keep) tierChildren.push(child);
          return keep;
        });
      });
      return newDom.concat(tierChildren);
    }
    return newDom.map(el => ({
      ...el,
      children: this.reduceTiers(el.children, maxDepth, currentDepth + 1),
    }));
  }

  private convertBEM(dom: IDomObject[]): IDomObject[] {
    return utilityService.deepCopy(dom).map(el => {
      const modifiers: IDomObject[] = [];
      const baseClasses = new Set(el.classes);

      // Extract BEM modifiers
      el.classes = el.classes.filter(cls => {
        const modifierPrefix = cls.split('--')[0];
        if (baseClasses.has(modifierPrefix) && cls !== modifierPrefix) {
          modifiers.push({ tag: '', ids: [], classes: [`&--${cls.split('--')[1]}`], children: [] });
          return false;
        }
        return true;
      });

      // Process children for BEM elements
      el.children = this.convertBEM(el.children.map(child => ({
        ...child,
        classes: child.classes.map(cls => {
          const parentMatch = el.classes.find(p => cls.startsWith(`${p}__`));
          return parentMatch ? cls.replace(`${parentMatch}__`, '&__') : cls;
        }),
      }))).concat(modifiers);

      return el;
    });
  }

  private extractHtml(inputHtml: string | HTMLCollection): IDomObject[] {
    if (typeof inputHtml === 'string') {
      const doc = new JSDOM(inputHtml).window.document;
      return this.processElements(doc.body.children);
    }
    return this.processElements(inputHtml);
  }

  private processElements(elements: HTMLCollection): IDomObject[] {
    return Array.from(elements)
      .filter((el): el is Element => el instanceof Element && el.nodeName !== '#text')
      .map(el => ({
        tag: el.nodeName.toLowerCase(),
        metaTag: el.nodeName.toLowerCase(),
        classes: utilityService.toArray(el.classList),
        ids: el.id ? el.id.split(' ') : [],
        children: this.processElements(el.children),
      }));
  }

  private convertToScss(dom: IDomObject[], nest = 1): string {
    const spacing = '  '.repeat(nest);
    return dom.map(el => {
      const selector = this.getSelector(el);
      if (!selector) return this.convertToScss(el.children, nest);
      const childrenScss = this.convertToScss(el.children, nest + 1);
      const clickSelectors = this.getClickSelectors(el, false, spacing);
      return `\n${spacing}${selector} {${childrenScss}\n${clickSelectors}${spacing}}`;
    }).join('');
  }

  private convertToCss(dom: IDomObject[], prefix = ''): string {
    return dom.map(el => {
      const selector = this.getSelector(el);
      if (!selector) return this.convertToCss(el.children, prefix);
      const fullSelector = `${prefix}${selector}`;
      const clickSelectors = this.getClickSelectors(el, true, '', fullSelector);
      const childrenCss = this.convertToCss(el.children, `${fullSelector} `);
      return `${fullSelector} {}\n${clickSelectors}${childrenCss}`;
    }).join('');
  }

  private getSelector(dom: IDomObject): string {
    const ids = dom.ids.length ? `#${dom.ids.join('#')}` : '';
    const classes = dom.classes.length
      ? dom.classes.map(cls => cls.startsWith('&') ? cls : `.${cls}`).join('')
      : '';
    return `${dom.tag}${ids}${classes}`;
  }
}

export default HtmlToScss;