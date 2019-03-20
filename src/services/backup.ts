// import { JSDOM } from 'jsdom';

// class HtmlConverterService {
//     constructor() {}

//     public isStringHtml(text: string) {
//         if (typeof text === 'string' && text.length !== 0) {
//             const cleanText = text.replace(/\n|\r/g, '').trim();
//             return cleanText.match(/^(\<)(.*)(\>)$/);
//         } else {
//             return false;
//         }
//     }

//     public convert(text: string, type: 'css' | 'scss') {
//         const dom = new JSDOM(text);
//         const domObject = dom.window.document.createElement('div');
//         const css: string[] = [];
//         let styleString;

//         text = text.replace(/[\t]+/mig, ' ')
//             .replace(/[\s]+/mig, ' ')
//             .replace(/^[\s]+/mig, '')
//             .replace(/[\s]+$/mig, '')
//             .replace(/(\>)([\s]+)(\<)/mig, '$1$3');

//         this.order = 0;
//         domObject.innerHTML = text;
//         this.populate(domObject, css, 0);
//         this.refactorAll(css);
//         this.emptyCheck(css);
//         this.reorder(css);

//         switch (type) {
//             case 'css':
//                 styleString = this.printCSS(css);
//                 break;
//             case 'scss':
//             default:
//                 styleString = this.printIndented(css);
//                 break;
//         }

//         return styleString;
//     }

//     /**
//      * Privates
//      */
//     private order = 0;

//     private generateSelector(element: Element) {
//         const selector: string[] = [];

//         if (element) {
//             if (element.className) {
//                 const cssClasses = element.className.split(' ');

//                 cssClasses.forEach(cssClass => {
//                     selector.unshift(`.${cssClass}`);
//                 });
//             }

//             // Always use id
//             if (element.id) {
//                 selector.push(`#${element.id}`);
//             }

//             // Use tag name if no id and classes found
//             if (selector.length === 0) {
//                 selector.push(element.tagName.toLowerCase());
//             }
//         }

//         return selector;
//     }

//     private recursive(array: any[], params: any) {
//         params = params || {};
//         let can_go = 1;

//         function recursive(array: any[], parent: any[] | null, depth: number, back: number) {
//             if (can_go) {
//                 if (array.length > 0) {
//                     for (var i = 0; i < array.length; i++) {
//                         if (can_go) {
//                             if (params.callback) {
//                                 can_go = params.callback(array[i], array, parent, depth, i, back);
//                             }
//                         }

//                         if (can_go) {
//                             if (array && array[i] && array[i].children.length > 0) {
//                                 recursive(array[i].children, array, depth + 1, i);
//                             }
//                         }
//                     }
//                 }
//             }
//         }
//         recursive(array, null, 0, 0);
//     }

//     private printAdd(what: string, printed: { text: string }) {
//         printed.text = printed.text + what;
//     }

//     private printIndentedChildren(
//         array: any[],
//         printed: { text: string },
//         params?: { open: string, close: string }
//     ) {
//         let _array;
//         const selectors: string[] = [];
//         if (!params) {
//             params = {
//                 open: '{',
//                 close: '}',
//             };
//         }
//         if (array.length > 0) {
//             for (var i = 0; i < array.length; i++) {
//                 _array = array[i];
//                 this.printAdd(
//                     _array.selector + ' ' + params.open + '\n',
//                     printed
//                 );
//                 if (_array.tag === 'a') {
//                     this.printAdd(
//                         '&:hover' + params.open + '\n' +
//                         params.close + '\n',
//                         printed
//                     );
//                 }
//                 if (_array.all.length) {
//                     for (var n in _array.all) {
//                         this.printAdd(
//                             '&' + _array.all[n] + params.open + '\n' +
//                             params.close + '\n',
//                             printed
//                         );
//                     }
//                 }
//                 if (_array.children.length > 0) {
//                     this.printIndentedChildren(_array.children, printed, params);
//                 }
//                 this.printAdd(
//                     params.close + '\n',
//                     printed
//                 );
//                 selectors.push(printed.text);
//             }
//         }
//     }
    
//     private printIndented(array: any[]) {
//         var printed = {
//             text: ''
//         };
//         this.printIndentedChildren(array, printed);
//         return printed.text.trim().replace(/\n$/, '');
//     }

//     private printCSSChildren(array: any[], parents: any[] | any, printed: { text: string }) {
//         var send = [],
//             _array,
//             n;
//         if (array.length > 0) {
//             for (var i = 0; i < array.length; i++) {
//                 _array = array[i];
//                 this.printAdd(
//                     (parents.length ? parents.join(' ') + ' ' + _array.selector : _array.selector) +
//                     ' {\n}\n',
//                     printed
//                 );
//                 if (_array.all.length) {
//                     for (n in _array.all) {
//                         this.printAdd(
//                             parents.length ?
//                             parents.join(' ') + ' ' + _array.selector :
//                             _array.selector + _array.all[n] + '{\n}\n',
//                             printed
//                         );
//                     }
//                 }

//                 if (array[i].children && array[i].children.length) {
//                     send = parents.slice(0);
//                     send.push(array[i].selector);
//                     this.printCSSChildren(array[i].children, send, printed);
//                 }
//             }
//         }
//     }

//     private printCSS(array: any[]) {
//         var printed = {
//             text: ''
//         };
//         this.printCSSChildren(array, [], printed);
//         return printed.text.trim().replace(/\n$/, '');
//     }

//     private printClean(array: any[]) {
//         var printed = {
//             text: ''
//         };
//         this.printIndentedChildren(array, printed, {
//             open: '',
//             close: ''
//         });
//         return printed.text.trim().replace(/\n$/, '') + '\n';
//     }

//     private hasChild(element: any, compare:any) {
//         var has = false;
//         if (element.children && !element.children.length) {
//             return has;
//         }

//         this.recursive(element.children, {
//             callback: function (el: any, elementArray: any[], parent: any[], depth: number) {
//                 if (el !== compare.element) {
//                     if (el.selector === compare.selector) {
//                         if (el.tag === compare.tag) {
//                             has = true;
//                             return false;
//                         }
//                     }
//                 }
//                 return true;
//             }
//         });
//         return has;
//     }

//     private getLastDepth(elementArray: any[]) {
//         var d = 0;
//         this.recursive(elementArray, {
//             callback: function (el: any, elementArray: any[], parent: any[], depth: number) {
//                 if (depth > d) {
//                     d = depth;
//                 }
//                 return true;
//             }
//         });
//         return d;
//     }

//     private getSelectorsFromDepth(elementArray: any[], n: number) {
//         let result: any[] = [];
//         let root: any;
//         this.recursive(elementArray, {
//             callback: function (el: any, elementArray: any[], parent: any[], depth: number, i: number, back: any) {
//                 if (depth === 0) {
//                     root = el;
//                 }
//                 if (depth === n) {
//                     result.push({
//                         parent: parent,
//                         element: el,
//                         selector: el.selector,
//                         root,
//                         tag: el.tag,
//                         back: back
//                     });
//                 }
//                 return true;
//             }
//         });
//         return result;
//     }

//     private toParent(elementArray: any[], parent: any, element: any, pos: number) {
//         var result = [];
//         this.recursive(elementArray, {
//             callback: function (el: any, arr: any[], parent: any[], depth: number, i: number) {
//                 var can_go = 1;
//                 if (el === element) {
//                     can_go = 0;
//                     var n = Object.assign({}, el);
//                     n.depth = n.depth - 1;
//                     parent.splice(pos + 1, 0, n);
//                     arr.splice(i, 1);
//                 }
//                 return can_go;
//             }
//         });
//         return elementArray;
//     }
    
//     private emptyCheck(elementArray: any[]) {
//         var result = [];
//         this.recursive(elementArray, {
//             callback: function (el: any, elementArray: any[], parent: any[], depth: number) {
//                 if (parent) {
//                     var dif = el.depth - parent[0].depth;
//                     if (dif > 1) {
//                         el.depth = el.depth - dif + 1;
//                     }
//                 }
//                 return true;
//             }
//         });
//     }

//     private refactor(cssi: any, css: any) {
//         var max = this.getLastDepth(cssi),
//             selectors,
//             current,
//             parent,
//             has, i, j, n;
//         //for (i = max; i > 1; i--) {
//         for (i = 2; i <= max; i++) {
//             selectors = this.getSelectorsFromDepth(cssi, i);
//             for (j in selectors) {
//                 current = selectors[j];
//                 parent = selectors[j].parent;
//                 has = false;
//                 for (n in parent) {
//                     if (this.hasChild(parent[n], current)) {
//                         has = true;
//                         break;
//                     }
//                     if (current.selector === parent[n].selector || current.tag === parent[n].tag) {
//                         if (current.tag !== parent[n].tag && current.element.selector.match(/^(\.|\#)/)) {
//                             current.element.selector = current.tag + current.selector;
//                             if (parent[n].selector && parent[n].selector.match(/^(\.|\#)/)) {
//                                 parent[n].selector = parent[n].tag + parent[n].selector;
//                             }
//                         } else {
//                             if (current.selector === parent[n].selector || current.tag === current.selector) {
//                                 has = true;
//                                 break;
//                             }
//                         }
//                     }
//                 }
//                 if (!has) {
//                     this.toParent(css, parent, current.element, current.back);
//                     return false;
//                 }
//             }
//         }
//         return true;
//     }
    
//     private refactorAll(elementArray: any[]) {
//         var result = [],
//             ref;
//         const self = this;
//         this.recursive(elementArray, {
//             callback: function (el: any, arr: any, parent: any, depth: any) {
//                 ref = self.refactor([el], elementArray);
//                 if (!ref) {
//                     self.refactorAll(elementArray);
//                     return false;
//                 }
//                 return true;
//             }
//         });
//     }

//     private swap(arr: any[], i: number, j: number) {
//         var temp = arr[j];
//         arr[j] = arr[i];
//         arr[i] = temp;
//     }

//     private reorder(elementArray: any[]) {
//         var result = [],
//             ref,
//             index,
//             prev;
//         this.recursive(elementArray, {
//             callback: (el: any, arr: any, parent: any, depth: any) => {
//                 index = arr.indexOf(el);
//                 if (index > 0) {
//                     prev = index - 1;
//                     if (arr[prev].order > el.order) {
//                         this.swap(arr, index, prev);
//                         this.reorder(elementArray);
//                         return false;
//                     }
//                 }
//                 return true;
//             }
//         });
//     }

//     private addDepth(index: number, css: any[], selector: string[], tag: string, depth: number) {
//         if (css[index]) {
//             while (css[index]) {
//                 index++;
//             }
//         }
//         css[index] = {};
//         css[index].selector = selector[selector.length - 1];
//         selector.splice(selector.length - 1, 1);
//         css[index].all = selector;
//         css[index].depth = depth;
//         css[index].tag = tag;
//         css[index].order = this.order++;
//         css[index].children = [];
//         return index;
//     }

//     private populate(rootElement: Element, css: any, depth: number) {
//         const all = rootElement.children;
//         var i = 0,
//             selectors = [],
//             selector,
//             index: any,
//             ready,
//             to_add;

//         const self = this;
//         for (let a = 0, b = all.length; a < b; a += 1) {
//             const activeElement = all[a];

//             var z, x;
//             selector = self.generateSelector(activeElement);
//             index = [];
//             for (z in css) {
//                 for (x in selector) {
//                     if (css[z].selector === selector[x]) {
//                         index.push(x);
//                     }
//                 }
//             }
//             to_add = [];
//             for (x in selector) {
//                 if (
//                     index.indexOf(x) === -1 &&
//                     to_add.indexOf(selector[x]) === -1) {
//                     to_add.push(selector[x]);
//                 }
//             }
//             if (to_add.length > 0) {
//                 index = self.addDepth(i, css, selector, activeElement.tagName.toLowerCase(), depth);
//             }
//             if (activeElement.children && activeElement.children.length > 0 && index >= 0) {
//                 self.populate(activeElement, css[index].children, depth + 1);
//             }
//         };
//     }
// }

// export default new HtmlConverterService();
