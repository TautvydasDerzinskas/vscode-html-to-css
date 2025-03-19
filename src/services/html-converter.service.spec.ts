import HtmlConverterService from './html-converter.service';
import utilityService from './utility.service';

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

const complexHTMLCode = `
    <div class="container">
        <header class="header">
            <nav class="nav">
                <a href="#" class="nav__link">Link 1</a>
                <a href="#" class="nav__link nav__link--active">Link 2</a>
            </nav>
        </header>
        <main class="main">
            <section class="section">
                <h1 class="section__title">Title</h1>
                <p class="section__text">Text</p>
            </section>
        </main>
    </div>
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

            const filePathThree = 'styles.SCSS';
            const fileExtensionThree = service.getFileExtension(filePathThree);
            expect(fileExtensionThree).toBe('scss');
        });

        it('should recognize valid html code', () => {
            expect(service.isStringHtml(validHTMLCode)).toBeTruthy();
            expect(service.isStringHtml(complexHTMLCode)).toBeTruthy();
        });

        it('should recognize not valid html code', () => {
            expect(service.isStringHtml(invalidHTMLCode)).toBeFalsy();
            expect(service.isStringHtml('')).toBeFalsy();
            expect(service.isStringHtml('   ')).toBeFalsy();
        });
    });

    describe('Code conversion tests', () => {
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

            it('should handle complex BEM structures', () => {
                const newOptions = Object.assign({}, configurationMock, { convertBEM: true });
                service.updateConfiguration(newOptions);
                const result = service.convert(complexHTMLCode, 'less');
                expect(result).toContain('&__link');
                expect(result).toContain('&__link--active');
                expect(result).toContain('&__title');
                expect(result).toContain('&__text');
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
                expect(result).toContain(' * <div class="organism">');
            });

            it('should pre-append HTML Code (LESS/SASS)', () => {
                const newOptions = Object.assign({}, configurationMock, { preappendHtml: true });
                service.updateConfiguration(newOptions);
                const result = service.convert(validHTMLCode, 'less');
                expect(result).toContain('/*');
                expect(result).toContain(' * <div class="organism">');
            });
        });
    });

    describe('Edge case testing', () => {
        it('should not have class without children repeated on BEM conversion', () => {
            const newOptions = Object.assign({}, configurationMock, { convertBEM: true });
            service.updateConfiguration(newOptions);
            const result = service.convert(validHTMLCode, 'less');
            expect(result.split('.organism__atom').length).toBe(2);
        });

        it('should handle empty HTML input', () => {
            expect(() => service.convert('', 'css')).toThrow('Failed to convert HTML to CSS/SCSS');
        });

        it('should handle invalid HTML input', () => {
            expect(() => service.convert('<div>', 'css')).toThrow('Failed to convert HTML to CSS/SCSS');
        });

        it('should handle elements with multiple IDs', () => {
            const html = '<div id="id1 id2" class="test">Test</div>';
            const result = service.convert(html, 'css');
            expect(result).toContain('#id1#id2');
        });

        it('should handle elements with multiple classes', () => {
            const html = '<div class="class1 class2">Test</div>';
            const result = service.convert(html, 'css');
            expect(result).toContain('.class1.class2');
        });

        it('should handle clickable elements', () => {
            const html = '<a href="#" class="link">Link</a>';
            const result = service.convert(html, 'css');
            expect(result).toContain(':hover');
            expect(result).toContain(':active');
            expect(result).toContain(':focus');
        });
    });

    describe('Performance optimization tests', () => {
        it('should efficiently reduce siblings', () => {
            const html = `
                <div class="same">1</div>
                <div class="same">2</div>
                <div class="same">3</div>
            `;
            const result = service.convert(html, 'css');
            const occurrences = (result.match(/\.same/g) || []).length;
            expect(occurrences).toBe(1);
        });

        it('should efficiently combine similar parents', () => {
            const html = `
                <div class="parent">
                    <div class="child">1</div>
                </div>
                <div class="parent">
                    <div class="child">2</div>
                </div>
            `;
            const result = service.convert(html, 'css');
            const occurrences = (result.match(/\.parent/g) || []).length;
            expect(occurrences).toBe(1);
        });
    });
});
