import { JSDOM } from 'jsdom';

interface IDomObject {
    tag: string;
    classes: string[];
    ids: string[];
    children: IDomObject[];
}

class HtmlToScss {
    private options = {
        reduceSiblings: true,
        combineParents: true,
        convertBEM: true,
    };

    private newDom: any = null;
    private output: any = null;

    constructor() {}

    public isStringHtml(text: string) {
        if (typeof text === 'string' && text.length !== 0) {
            const cleanText = text.replace(/\n|\r/g, '').trim();
            return cleanText.match(/^(\<)(.*)(\>)$/);
        } else {
            return false;
        }
    }


    public convert(dom: string) {
        let extractedHtml = this.extractHtml(dom);
        let reduced = (this.options.reduceSiblings) ? this.reduceSiblings(extractedHtml) : extractedHtml;
        let combinedParents = (this.options.combineParents) ? this.combineSimilarParents(reduced) : reduced;
        let BEMConverted = (this.options.convertBEM) ? this.convertBEM(combinedParents) : combinedParents;
        let buttonStates = this.addButtonStates(BEMConverted);
        let reducedTiers = this.reduceTiers(buttonStates, 4);
        let scss = this.convertToScss(reducedTiers);

        return scss;
    }

    private addButtonStates(dom: IDomObject[]) {
        let newDom: IDomObject[] = this.deepCopy(dom);
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
        let newDom: IDomObject[] = this.deepCopy(dom);
        if (newDom.length > 1) {
            newDom = newDom.filter((el, index, arr) => {
                let filter = true;
                for (var i = index; i < arr.length; i++) {
                    if (i + 1 !== arr.length && this.compareElements(el, arr[i + 1])) {
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
        let newDom: IDomObject[] = this.deepCopy(dom);
        if (newDom.length > 1) {
            //make sure at least one has chilren.
            let oneHasChildren = false;
            newDom.forEach(el => {
                if (el.children.length > 0) { oneHasChildren = true; }
            });
            if (oneHasChildren) {
                //combine similar parents
                newDom = newDom.filter((el, index, arr) => {
                    let filter = true;
                    for (var i = index; i < arr.length; i++) {
                        if (i + 1 !== arr.length && this.compareElementsWithoutChildren(el, arr[i + 1])) {
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

    //TODO figure out why the 6th level deep doesn't get reduced
    private reduceTiers(dom: IDomObject[], maxDepth = 4, currentDepth = 1) {
        let depth = currentDepth;
        let newDom: IDomObject[] = this.deepCopy(dom);
        let tierChildren: IDomObject[] = [];
        if (maxDepth <= currentDepth) {
            console.log('running');
            newDom.forEach(el => {
                console.log('foreach');
                console.log(el);
                el.children = el.children.filter(child => {
                    console.log('filter callback');
                    if (child.classes.length > 0 && child.classes[0].indexOf('&') === 0) {
                        console.log('returned true');
                        return true;
                    } else {
                        console.log('returned false');
                        tierChildren.push(child);
                        return false;
                    }
                });
            });
            //tierChildren = this.reduceTiers(tierChildren, maxDepth, currentDepth + 1)
            newDom = newDom.concat(tierChildren);
        }
        console.log(currentDepth);
        newDom.forEach(el => {
            el.children = this.reduceTiers(el.children, maxDepth, currentDepth + 1);
        });


        return newDom;
    }

    private convertBEM(dom: IDomObject[], parentClasses?: string[], bemParentCallback?: (parentClass: string) => void) {
        let newDom: IDomObject[] = this.deepCopy(dom);

        newDom.forEach(el => {
            let newChildren: IDomObject[] = [];
            let isBEMParent = false;
            let BEMParentClass = '';
            if (el.children.length > 0) {
                el.children = this.convertBEM(el.children, el.classes, (bemParentClass) => {
                    isBEMParent = true;
                    BEMParentClass = bemParentClass;
                });
            }

            //if class modifier, create &--modifer child.
            el.classes = el.classes.filter(theClass => {
                let isKeptClass = true;
                el.classes.forEach(compareClass => {
                    //if it's not the same, and theclass is modifer
                    if (theClass !== compareClass && theClass.indexOf(compareClass + '--') !== -1) {
                        let modiferClass = theClass.replace(compareClass, '&');
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
                //if class bemchild, modify, push others to newChildren
                parentClasses.forEach((parentClass: string) => {
                    el.classes = el.classes.map((childClass: string) => {
                        //check if class is block child of parent
                        if (childClass.indexOf(parentClass + '__') !== -1) {
                            if (bemParentCallback) {
                                bemParentCallback(parentClass);
                            }
                            return childClass.replace(parentClass + '__', '&__');
                        }
                        return childClass;
                    });

                });

                //If bemchild class found, remove any other classes
                let isBEMChild = false;
                el.classes.forEach((theClass: string) => {
                    if (theClass.indexOf('&__') !== -1) { isBEMChild = true; }
                });
                //remove everything but bem rule if child.
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
                    let bemClass = child.classes[bemClassIndex];
                    let newClasses = [];
                    child.classes = child.classes.slice(bemClassIndex, bemClassIndex);

                    newClasses.push(bemClass);
                    // newClasses.concat(child.classes)
                    child.classes = newClasses;
                }

            }
        });
        //move bem parent to end of array
        if (bemParentClassIndex > 0) {
            let bemParent = parent.classes[bemParentClassIndex];
            parent.classes = parent.classes.slice(bemParentClassIndex, bemParentClassIndex);
            parent.classes.push(bemParent);
        }

        return parent;
    }

    private compareElements(el1: IDomObject, el2: IDomObject) {

        if (JSON.stringify(el1) === JSON.stringify(el2)) {
            return true;
        } else {
            return false;
        }
    }

    private compareElementsWithoutChildren(el1: IDomObject, el2: IDomObject) {
        let tagsMatch = (el1.tag === el2.tag);
        let idsMatch = (JSON.stringify(el1.ids) === JSON.stringify(el2.ids));
        let classesMatch = (JSON.stringify(el1.classes) === JSON.stringify(el2.classes));
        if (tagsMatch && idsMatch && classesMatch) {
            return true;
        } else {
            return false;
        }

    }

    private emptyElementValues(el: IDomObject) {
        let newElement = this.deepCopy(el);
        newElement.tag = '';
        newElement.ids = [];
        newElement.classes = [];
        return newElement;
    }

    private toArray(obj: DOMTokenList) {
        var array = [];
        // iterate backwards ensuring that length is an UInt32
        for (var i = obj.length >>> 0; i--;) {
            array[i] = obj[i];
        }
        return array;
    }

    deepCopy(obj?: object) {
        if (typeof obj === 'undefined') { obj = {}; }
        return JSON.parse(JSON.stringify(obj));
    }

    private extractHtml(inputHtml: string | HTMLCollection) {
        let parsedHtml = typeof inputHtml === 'string' ? new JSDOM(inputHtml) : inputHtml;
        let nodes: any[] = [];

        const elements = typeof inputHtml === 'string' ? (parsedHtml as JSDOM).window.document.body.children : inputHtml;

        for (let i = 0, b = elements.length; i < b; i++) {
            const el = elements[i];
            if (el.nodeName !== '#text') {

                let ids = (el.id === "") ? [] : el.id.split(' ');
                nodes.push({
                    tag: el.nodeName.toLowerCase(),
                    classes: this.toArray(el.classList),
                    ids: ids,
                    children: this.extractHtml(el.children)
                });
            }
        }

        return nodes;
    }

    private convertToScss(DOMObject: IDomObject[], nest = 1) {
        let sass = "";
        let spacing = '  '.repeat(nest);
        DOMObject.forEach(el => {
            let classesDotted = el.classes.map((theclass) => {
                if (theclass.indexOf('&') === -1) {
                    theclass = '.' + theclass;

                }

                return theclass;
            });
            let classes = (classesDotted.length > 0) ? classesDotted.join('') : '';
            let ids = (el.ids.length) ? '#' + el.ids.join('#') : '';
            let tag = el.tag;
            if (classes !== '' || ids !== '' || tag !== '') {
                sass = sass.concat(`
  ${spacing}${el.tag}${ids}${classes} {
  ${spacing}  ${this.convertToScss(el.children, nest + 1)}
  ${spacing}}`);
            } else {
                sass = sass.concat(`${spacing}  ${this.convertToScss(el.children, nest)}`);
            }

        });
        return sass;
    }
}

export default new HtmlToScss();
