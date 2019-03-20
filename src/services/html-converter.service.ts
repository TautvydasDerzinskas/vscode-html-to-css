import { JSDOM } from 'jsdom';
import utilityService from './utility.service';
import IOptions from '../interfaces/options.interface';
import IDomObject from '../interfaces/dom-object.interface';

class HtmlToScss {
    private options: IOptions = {
        reduceSiblings: true,
        combineParents: true,
        hidetags: true,
        convertBEM: true,
    };

    constructor() {}

    public getFileExtension(filePath: string) {
        const tempArray = filePath.split('.');
        return tempArray[(tempArray.length - 1)];
    }

    public isStringHtml(text: string) {
        if (typeof text === 'string' && text.length !== 0) {
            const cleanText = text.replace(/\n|\r/g, '').trim();
            return cleanText.match(/^(\<)(.*)(\>)$/);
        } else {
            return false;
        }
    }

    public convert(dom: string, fileExtension: string) {
        const isCss = fileExtension === 'css';

        const extractedHtml = this.extractHtml(dom);
        const tagsRemoved = (this.options.hidetags && !isCss) ? this.removeTags(extractedHtml) : extractedHtml;
        const reduced = (this.options.reduceSiblings) ? this.reduceSiblings(tagsRemoved) : tagsRemoved;
        const combinedParents = (this.options.combineParents) ? this.combineSimilarParents(reduced) : reduced;
        const BEMConverted = (this.options.convertBEM && !isCss) ? this.convertBEM(combinedParents) : combinedParents;
        const buttonStates = this.addButtonStates(BEMConverted);
        const reducedTiers = this.reduceTiers(buttonStates, 4);

        let styleSelectors = '';
        if (isCss) {
            styleSelectors = this.convertToCss(reducedTiers);
        } else {
            styleSelectors = this.convertToScss(reducedTiers);
        }
        return styleSelectors;
    }

    private removeTags(dom: IDomObject[]) {
        const newDom: IDomObject[] = utilityService.deepCopy(dom);

        newDom.forEach(el => {
          if (el.classes.length !== 0 || el.ids.length !== 0) {
              el.tag = '';
          }

          el.children = this.removeTags(el.children);
        });

        return newDom;
    }

    private addButtonStates(dom: IDomObject[]) {
        const newDom: IDomObject[] = utilityService.deepCopy(dom);
        newDom.forEach(el => {
            if (el.tag === 'a' || el.tag === 'button') {
                el.children = el.children.concat([{
                    tag: '',
                    ids: [],
                    classes: ['&:hover'],
                    children: []
                }, {
                    tag: '',
                    ids: [],
                    classes: ['&:active'],
                    children: []
                }, {
                    tag: '',
                    ids: [],
                    classes: ['&:focus'],
                    children: []
                }]);
            }
            el.children = this.addButtonStates(el.children);
        });

        return newDom;
    }

    private reduceSiblings(dom: IDomObject[]) {
        let newDom: IDomObject[] = utilityService.deepCopy(dom);
        if (newDom.length > 1) {
            newDom = newDom.filter((el, index, arr) => {
                let filter = true;
                for (let i = index; i < arr.length; i++) {
                    if (i + 1 !== arr.length && utilityService.compareElements(el, arr[i + 1])) {
                        filter = false;
                    }
                }
                return filter;
            });
        }
        newDom.forEach(el => {
            el.children = this.reduceSiblings(el.children);
        });

        return newDom;
    }

    private combineSimilarParents(dom: IDomObject[]) {
        let newDom: IDomObject[] = utilityService.deepCopy(dom);
        if (newDom.length > 1) {
            let oneHasChildren = false;
            newDom.forEach(el => {
                if (el.children.length > 0) { oneHasChildren = true; }
            });
            if (oneHasChildren) {
                newDom = newDom.filter((el, index, arr) => {
                    let filter = true;
                    for (let i = index; i < arr.length; i++) {
                        if (i + 1 !== arr.length && utilityService.compareElementsWithoutChildren(el, arr[i + 1])) {
                            arr[i + 1].children = arr[i + 1].children.concat(el.children);
                            filter = false;
                        }
                    }
                    return filter;
                });
            }

        }
        newDom.forEach(el => {
            el.children = this.combineSimilarParents(el.children);
        });

        return newDom;
    }

    // TODO figure out why the 6th level deep doesn't get reduced
    private reduceTiers(dom: IDomObject[], maxDepth = 4, currentDepth = 1) {
        let newDom: IDomObject[] = utilityService.deepCopy(dom);
        const tierChildren: IDomObject[] = [];
        if (maxDepth <= currentDepth) {
            newDom.forEach(el => {
                el.children = el.children.filter(child => {
                    if (child.classes.length > 0 && child.classes[0].indexOf('&') === 0) {
                        return true;
                    } else {
                        tierChildren.push(child);
                        return false;
                    }
                });
            });
            // tierChildren = this.reduceTiers(tierChildren, maxDepth, currentDepth + 1)
            newDom = newDom.concat(tierChildren);
        }
        newDom.forEach(el => {
            el.children = this.reduceTiers(el.children, maxDepth, currentDepth + 1);
        });


        return newDom;
    }

    private convertBEM(dom: IDomObject[], parentClasses?: string[], bemParentCallback?: (parentClass: string) => void) {
        const newDom: IDomObject[] = utilityService.deepCopy(dom);
        newDom.forEach(el => {
            const newChildren: IDomObject[] = [];
            let isBEMParent = false;
            let BEMParentClass = '';
            if (el.children.length > 0) {
                el.children = this.convertBEM(el.children, el.classes, (bemParentClass) => {
                    isBEMParent = true;
                    BEMParentClass = bemParentClass;
                });
            }

            // if class modifier, create &--modifer child.
            el.classes = el.classes.filter(theClass => {
                let isKeptClass = true;
                el.classes.forEach(compareClass => {
                    // if it's not the same, and theclass is modifer
                    if (theClass !== compareClass && theClass.indexOf(compareClass + '--') !== -1) {
                        const modiferClass = theClass.replace(compareClass, '&');
                        newChildren.push({
                            tag: '',
                            ids: [],
                            classes: [modiferClass],
                            children: []
                        });
                        isKeptClass = false;
                    }
                });
                return isKeptClass;
            });
            el.children = newChildren.concat(el.children);


            if (parentClasses !== null && typeof parentClasses !== 'undefined') {
                // if class bemchild, modify, push others to newChildren
                parentClasses.forEach((parentClass: string) => {
                    el.classes = el.classes.map((childClass: string) => {
                        // check if class is block child of parent
                        if (childClass.indexOf(parentClass + '__') !== -1) {
                            if (bemParentCallback) {
                                bemParentCallback(parentClass);
                            }
                            return childClass.replace(parentClass + '__', '&__');
                        }
                        return childClass;
                    });

                });

                // If bemchild class found, remove any other classes
                let isBEMChild = false;
                el.classes.forEach((theClass: string) => {
                    if (theClass.indexOf('&__') !== -1) { isBEMChild = true; }
                });
                // remove everything but bem rule if child.
                if (isBEMChild) {
                    el.classes = el.classes.filter((theClass: string) => {
                        return (theClass.indexOf('&__') !== -1);
                    });
                }
            }

            //
            if (isBEMParent && BEMParentClass.indexOf('__') === -1) {
                el.classes = [BEMParentClass];
            }

        });
        return newDom;
    }


    private convertBEMRecursive(parent: IDomObject) {
        parent.children = parent.children.map((el) => this.convertBEMRecursive(el));

        let bemParentClassIndex = -1;
        parent.children.forEach(child => {
            let isBemChild = false;
            let bemClassIndex = -1;
            child.classes = child.classes.map((childClass: string, childClassIndex: number) => {
                let childClassOutput = childClass;
                parent.classes.forEach((parentClass: string, index: number) => {
                    if (childClassOutput.indexOf(parentClass + '__') !== -1) {
                        isBemChild = true;
                        childClassOutput = childClassOutput.replace(parentClass + '__', '&__');
                        bemParentClassIndex = index;
                        bemClassIndex = childClassIndex;
                    }
                });
                return childClassOutput;
            });

            if (isBemChild) {
                child.tag = '';
                if (bemClassIndex > 0) {
                    const bemClass = child.classes[bemClassIndex];
                    const newClasses = [];
                    child.classes = child.classes.slice(bemClassIndex, bemClassIndex);

                    newClasses.push(bemClass);
                    // newClasses.concat(child.classes)
                    child.classes = newClasses;
                }

            }
        });
        // move bem parent to end of array
        if (bemParentClassIndex > 0) {
            const bemParent = parent.classes[bemParentClassIndex];
            parent.classes = parent.classes.slice(bemParentClassIndex, bemParentClassIndex);
            parent.classes.push(bemParent);
        }

        return parent;
    }

    private extractHtml(inputHtml: string | HTMLCollection) {
        const parsedHtml = typeof inputHtml === 'string' ? new JSDOM(inputHtml) : inputHtml;
        const nodes: any[] = [];

        const elements = typeof inputHtml === 'string' ? (parsedHtml as JSDOM).window.document.body.children : inputHtml;

        for (let i = 0, b = elements.length; i < b; i++) {
            const el = elements[i];
            if (el.nodeName !== '#text') {
                const ids = (el.id === '') ? [] : el.id.split(' ');
                nodes.push({
                    tag: el.nodeName.toLowerCase(),
                    classes: utilityService.toArray(el.classList),
                    ids: ids,
                    children: this.extractHtml(el.children)
                });
            }
        }

        return nodes;
    }

    private convertToScss(DOMObject: IDomObject[], nest = 1) {
        let sass = '';
        const spacing = '  '.repeat(nest);
        DOMObject.forEach(el => {
            const classes = this.getDottedClasses(el);
            const ids = (el.ids.length) ? '#' + el.ids.join('#') : '';
            const tag = el.tag;
            if (classes !== '' || ids !== '' || tag !== '') {
                sass += `\n${spacing}${el.tag}${ids}${classes} {${this.convertToScss(el.children, nest + 1)}\n${spacing}}`;
            } else {
                sass += `${this.convertToScss(el.children, nest)}`;
            }

        });
        return sass;
    }

    private convertToCss(DOMObject: IDomObject[]) {
        let css = '';
        DOMObject.forEach(el => {
            const classes = this.getDottedClasses(el);
            const ids = (el.ids.length) ? '#' + el.ids.join('#') : '';
            const tag = el.tag;
            if (classes !== '' || ids !== '' || tag !== '') {
                css += `${el.tag}${ids}${classes} {\n\n}\n${this.convertToCss(el.children)}`;
            } else {
                css += `${this.convertToCss(el.children)}\n`;
            }

        });
        return css;
    }

    private getDottedClasses(DOMObject: IDomObject) {
        const classesDotted = DOMObject.classes.map(theclass => {
            if (theclass.indexOf('&') < 0) {
                theclass = `.${theclass}`;
            }

            return theclass;
        });

        return (classesDotted.length > 0) ? classesDotted.join('') : '';
    }
}

export default new HtmlToScss();
