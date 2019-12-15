import HtmlConverterService from './html-converter.service';

// Mocks
const configurationMock = {
    reduceSiblings: true,
    combineParents: true,
    hideTags: true,
    convertBEM: true,
    preappendHtml: false,
};

const validHTMLCode = `
    <div class="organism">
        <div class="organism__molecule">
            <div class="organism__atom">Atom</div>
            <div class="organism__atom">Atom</div>
        </div>
        <div class="organism__molecule">
            <div class="organism__atom organism__atom--red">Atom</div>
            <div class="organism__atom">Atom</div>
        </div>
    </div>
`;

const invalidHTMLCode = `
    .selector { color: white; }
`;

// Test instances
const service = new HtmlConverterService(configurationMock);

// Tests
describe('Core tests', () => {
    it('should exist', () => {
        expect(service).toBeDefined();
    });

    describe('Helper functions', () => {
        it('should return correct file extension', () => {
            const filePathOne = '/test/src/file.html';
            const fileExtensionOne = service.getFileExtension(filePathOne);
            expect(fileExtensionOne).toBe('html');

            const filePathTwo = '~/Desktop/gitHUB/src/styles.css';
            const fileExtensionTwo = service.getFileExtension(filePathTwo);
            expect(fileExtensionTwo).toBe('css');
        });

        it('should recognize valid html code', () => {
            expect(service.isStringHtml(validHTMLCode)).toBeTruthy();
        });

        it('should recognize not valid html code', () => {
            expect(service.isStringHtml(invalidHTMLCode)).toBeFalsy();
        });
    });

    describe('Code convertion tests', () => {
        describe('Tag names configuration option tests', () => {
            it('should not add element tag names (CSS)', () => {
                const newOptions = Object.assign({}, configurationMock, { hideTags: true });
                service.updateConfiguration(newOptions);
                const result = service.convert(validHTMLCode, 'css');
                expect(result).not.toContain('div');
            });

            it('should not add element tag names (LESS/SASS)', () => {
                const newOptions = Object.assign({}, configurationMock, { hideTags: true });
                service.updateConfiguration(newOptions);
                const result = service.convert(validHTMLCode, 'less');
                expect(result).not.toContain('div');
            });

            it('should add element tag names (CSS)', () => {
                const newOptions = Object.assign({}, configurationMock, { hideTags: false });
                service.updateConfiguration(newOptions);
                const result = service.convert(validHTMLCode, 'css');
                expect(result).toContain('div');
            });

            it('should add element tag names (LESS/SASS)', () => {
                const newOptions = Object.assign({}, configurationMock, { hideTags: false });
                service.updateConfiguration(newOptions);
                const result = service.convert(validHTMLCode, 'less');
                expect(result).toContain('div');
            });
        });

        describe('BEM configuration option tests', () => {
            it('should not output BEM specific selectors', () => {
                const newOptions = Object.assign({}, configurationMock, { convertBEM: false });
                service.updateConfiguration(newOptions);
                const result = service.convert(validHTMLCode, 'less');
                expect(result).not.toContain('&--red');
            });

            it('should output BEM specific selectors', () => {
                const newOptions = Object.assign({}, configurationMock, { convertBEM: true });
                service.updateConfiguration(newOptions);
                const result = service.convert(validHTMLCode, 'less');
                expect(result).toContain('&--red');
            });

            it('should not affect CSS output with BEM specific selectors', () => {
                const newOptions = Object.assign({}, configurationMock, { convertBEM: true });
                service.updateConfiguration(newOptions);
                const result = service.convert(validHTMLCode, 'css');
                expect(result).not.toContain('&--red');
            });
        });

        describe('HTML pre-append configuration option tests', () => {
            it('should not pre-append HTML Code (CSS)', () => {
                const newOptions = Object.assign({}, configurationMock, { preappendHtml: false });
                service.updateConfiguration(newOptions);
                const result = service.convert(validHTMLCode, 'css');
                expect(result).not.toContain('/*');
            });

            it('should not pre-append HTML Code (LESS/SASS)', () => {
                const newOptions = Object.assign({}, configurationMock, { preappendHtml: false });
                service.updateConfiguration(newOptions);
                const result = service.convert(validHTMLCode, 'less');
                expect(result).not.toContain('/*');
            });

            it('should pre-append HTML Code (CSS)', () => {
                const newOptions = Object.assign({}, configurationMock, { preappendHtml: true });
                service.updateConfiguration(newOptions);
                const result = service.convert(validHTMLCode, 'css');
                expect(result).toContain('/*');
            });

            it('should pre-append HTML Code (LESS/SASS)', () => {
                const newOptions = Object.assign({}, configurationMock, { preappendHtml: true });
                service.updateConfiguration(newOptions);
                const result = service.convert(validHTMLCode, 'less');
                expect(result).toContain('/*');
            });
        });
    });
});
