import IDomObject from '../interfaces/dom-object.interface';

/**
 * Utility service for DOM object manipulation and comparison
 */
class UtilityService {
    /**
     * Deeply compares two DOM objects for structural equality
     * @param el1 First DOM object
     * @param el2 Second DOM object
     * @returns Whether the objects are identical, including children
     */
    public compareElements(el1: IDomObject, el2: IDomObject): boolean {
        return this.areDomObjectsEqual(el1, el2);
    }

    /**
     * Compares two DOM objects, ignoring their children
     * @param el1 First DOM object
     * @param el2 Second DOM object
     * @returns Whether tag, metaTag, ids, and classes match
     */
    public compareElementsWithoutChildren(el1: IDomObject, el2: IDomObject): boolean {
        return (
            el1.tag === el2.tag &&
            el1.metaTag === el2.metaTag &&
            this.areArraysEqual(el1.ids, el2.ids) &&
            this.areArraysEqual(el1.classes, el2.classes)
        );
    }

    /**
     * Converts a DOMTokenList to an array of strings
     * @param tokenList DOMTokenList to convert
     * @returns Array of token strings
     */
    public toArray(tokenList: DOMTokenList): string[] {
        return Array.from(tokenList);
    }

    /**
     * Creates a deep copy of an object
     * @param obj Object to copy (defaults to empty object if undefined)
     * @returns Deep copied object
     * @template T
     */
    public deepCopy<T extends object = object>(obj: T = {} as T): T {
        return structuredClone(obj);
    }

    /**
     * Generates a unique key for a DOM object
     * @param el DOM object to generate key for
     * @returns Unique string key
     */
    public generateKey(el: IDomObject): string {
        return `${el.tag}|${el.metaTag ?? ''}|${el.ids.join(',')}|${el.classes.join(',')}`;
    }

    // Private helper methods
    private areArraysEqual(arr1: string[], arr2: string[]): boolean {
        if (arr1.length !== arr2.length) return false;
        return arr1.every((item, index) => item === arr2[index]);
    }

    private areDomObjectsEqual(el1: IDomObject, el2: IDomObject): boolean {
        if (el1 === el2) return true;
        if (!el1 || !el2) return false;

        // Compare shallow properties
        if (
            el1.tag !== el2.tag ||
            el1.metaTag !== el2.metaTag ||
            !this.areArraysEqual(el1.ids, el2.ids) ||
            !this.areArraysEqual(el1.classes, el2.classes) ||
            el1.children.length !== el2.children.length
        ) {
            return false;
        }

        // Recursively compare children
        return el1.children.every((child, index) =>
            this.areDomObjectsEqual(child, el2.children[index])
        );
    }
}

export default new UtilityService();