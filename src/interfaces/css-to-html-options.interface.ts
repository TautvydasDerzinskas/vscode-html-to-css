export default interface ICssToHtmlOptions {
  /** Pick tags from class names (`__link` -> `a`) instead of always using `defaultTagName`. */
  guessTagNames: boolean;
  /** The tag for an element whose selector names none, e.g. `div`. */
  defaultTagName: string;
}
