export default interface IOptions {
  reduceSiblings: boolean;
  combineParents: boolean;
  hideTags: boolean;
  convertBEM: boolean;
  preappendHtml: boolean;
  /** Emit class selectors only: tag and id selectors are never generated. */
  classesOnly: boolean;
  /** Selectors never to generate, e.g. `.container`, `#app`, `p`. */
  ignoredSelectors: string[];
}
