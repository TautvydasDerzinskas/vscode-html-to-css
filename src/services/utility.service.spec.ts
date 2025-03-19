import utilityService from './utility.service';

describe('Utility Service', () => {
  describe('compareElements', () => {
    it('should compare identical elements', () => {
      const el1 = {
        tag: 'div',
        metaTag: 'div',
        classes: ['test'],
        ids: ['id1'],
        children: [],
      };
      const el2 = { ...el1 };
      expect(utilityService.compareElements(el1, el2)).toBe(true);
    });

    it('should compare different elements', () => {
      const el1 = {
        tag: 'div',
        metaTag: 'div',
        classes: ['test'],
        ids: ['id1'],
        children: [],
      };
      const el2 = {
        ...el1,
        classes: ['different'],
      };
      expect(utilityService.compareElements(el1, el2)).toBe(false);
    });

    it('should compare elements with nested children', () => {
      const el1 = {
        tag: 'div',
        metaTag: 'div',
        classes: ['parent'],
        ids: [],
        children: [
          {
            tag: 'span',
            metaTag: 'span',
            classes: ['child'],
            ids: [],
            children: [],
          },
        ],
      };
      const el2 = { ...el1 };
      expect(utilityService.compareElements(el1, el2)).toBe(true);
    });

    it('should handle null/undefined elements', () => {
      expect(utilityService.compareElements(null as any, {} as any)).toBe(false);
      expect(utilityService.compareElements({} as any, null as any)).toBe(false);
      expect(utilityService.compareElements(null as any, null as any)).toBe(false);
    });
  });

  describe('compareElementsWithoutChildren', () => {
    it('should compare elements without considering children', () => {
      const el1 = {
        tag: 'div',
        metaTag: 'div',
        classes: ['test'],
        ids: ['id1'],
        children: [
          {
            tag: 'span',
            metaTag: 'span',
            classes: ['child1'],
            ids: [],
            children: [],
          },
        ],
      };
      const el2 = {
        ...el1,
        children: [
          {
            tag: 'span',
            metaTag: 'span',
            classes: ['child2'],
            ids: [],
            children: [],
          },
        ],
      };
      expect(utilityService.compareElementsWithoutChildren(el1, el2)).toBe(true);
    });

    it('should detect differences in main properties', () => {
      const el1 = {
        tag: 'div',
        metaTag: 'div',
        classes: ['test'],
        ids: ['id1'],
        children: [],
      };
      const el2 = {
        ...el1,
        classes: ['different'],
      };
      expect(utilityService.compareElementsWithoutChildren(el1, el2)).toBe(false);
    });
  });

  describe('toArray', () => {
    it('should convert DOMTokenList to array', () => {
      const mockTokenList = {
        length: 2,
        item: (index: number) => ['class1', 'class2'][index],
        [Symbol.iterator]: function* () {
          yield 'class1';
          yield 'class2';
        },
      } as unknown as DOMTokenList;
      const result = utilityService.toArray(mockTokenList);
      expect(result).toEqual(['class1', 'class2']);
    });
  });

  describe('deepCopy', () => {
    it('should create a deep copy of an object', () => {
      const original = {
        tag: 'div',
        metaTag: 'div',
        classes: ['test'],
        ids: ['id1'],
        children: [
          {
            tag: 'span',
            metaTag: 'span',
            classes: ['child'],
            ids: [],
            children: [],
          },
        ],
      };
      const copy = utilityService.deepCopy(original);
      expect(copy).toEqual(original);
      expect(copy).not.toBe(original);
      expect(copy.children[0]).not.toBe(original.children[0]);
    });

    it('should handle empty object', () => {
      const copy = utilityService.deepCopy({});
      expect(copy).toEqual({});
    });
  });

  describe('generateKey', () => {
    it('should generate unique keys for elements', () => {
      const el1 = {
        tag: 'div',
        metaTag: 'div',
        classes: ['test'],
        ids: ['id1'],
        children: [],
      };
      const el2 = {
        ...el1,
        classes: ['different'],
      };
      const key1 = utilityService.generateKey(el1);
      const key2 = utilityService.generateKey(el2);
      expect(key1).not.toBe(key2);
      expect(key1).toBe('div|div|id1|test');
      expect(key2).toBe('div|div|id1|different');
    });

    it('should handle elements without metaTag', () => {
      const el = {
        tag: 'div',
        classes: ['test'],
        ids: ['id1'],
        children: [],
      };
      const key = utilityService.generateKey(el);
      expect(key).toBe('div||id1|test');
    });

    it('should handle elements with multiple classes and ids', () => {
      const el = {
        tag: 'div',
        metaTag: 'div',
        classes: ['class1', 'class2'],
        ids: ['id1', 'id2'],
        children: [],
      };
      const key = utilityService.generateKey(el);
      expect(key).toBe('div|div|id1,id2|class1,class2');
    });
  });
}); 