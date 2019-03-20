import IDomObject from '../interfaces/dom-object.interface';

class UtilityService {
    public compareElements(el1: IDomObject, el2: IDomObject) {
        return JSON.stringify(el1) === JSON.stringify(el2);
    }

    public compareElementsWithoutChildren(el1: IDomObject, el2: IDomObject) {
        const tagsMatch = (el1.tag === el2.tag);
        const idsMatch = (JSON.stringify(el1.ids) === JSON.stringify(el2.ids));
        const classesMatch = (JSON.stringify(el1.classes) === JSON.stringify(el2.classes));

        return tagsMatch && idsMatch && classesMatch;
    }

    public toArray(obj: DOMTokenList) {
        const array = [];
        // iterate backwards ensuring that length is an UInt32
        // tslint:disable-next-line: no-bitwise
        for (let i = obj.length >>> 0; i--;) {
            array[i] = obj[i];
        }
        return array;
    }

    public deepCopy(obj?: object) {
        if (typeof obj === 'undefined') { obj = {}; }
        return JSON.parse(JSON.stringify(obj));
    }
}

export default new UtilityService();
