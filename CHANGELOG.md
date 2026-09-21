## [1.5.1](https://github.com/TautvydasDerzinskas/vscode-html-to-css/compare/v1.5.0...v1.5.1) (2026-09-21)

### Bug Fixes

* vue template closing tag issue ([f762a1f](https://github.com/TautvydasDerzinskas/vscode-html-to-css/commit/f762a1fd9acbd8a716f473331ab083b12a4be9d7))

## [1.5.0](https://github.com/TautvydasDerzinskas/vscode-html-to-css/compare/v1.4.0...v1.5.0) (2026-09-21)

### Features

* add two new configurable options for ignoring selectors ([f46afa1](https://github.com/TautvydasDerzinskas/vscode-html-to-css/commit/f46afa135a7766a66a1fc54e8380e8e49cbe7a32))

## [1.4.0](https://github.com/TautvydasDerzinskas/vscode-html-to-css/compare/v1.3.0...v1.4.0) (2026-09-21)

### Features

* add support for JSX ([92783b1](https://github.com/TautvydasDerzinskas/vscode-html-to-css/commit/92783b13462b3fe0e6e4eb30af91b4ce0cb69208))
* add template markup support ([a81139f](https://github.com/TautvydasDerzinskas/vscode-html-to-css/commit/a81139faa24ef71e013b33be5350422099e4cb49))

## [1.3.0](https://github.com/TautvydasDerzinskas/vscode-html-to-css/compare/v1.2.0...v1.3.0) (2026-09-21)

### Features

* bring back the code to up to date state ([ee6f624](https://github.com/TautvydasDerzinskas/vscode-html-to-css/commit/ee6f62407704ad66dd1eadd1600e6488bef08b96))

### Bug Fixes

* releasing issues ([c21bb61](https://github.com/TautvydasDerzinskas/vscode-html-to-css/commit/c21bb61b0efd4d07432f31e73eec88506b73e205))
* upgrade repo ([6dcc883](https://github.com/TautvydasDerzinskas/vscode-html-to-css/commit/6dcc8838a60e0dd05cd05ae031157cabc379aa87))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2024-02-20

### Added
- Support for multiple file extensions (.css, .less, .scss, .sass)
- Smart tag hiding when classes or IDs are present
- Sibling reduction for cleaner output
- Parent combination for better organization
- Support for clickable elements (hover, active, focus states)
- Comprehensive test coverage
- Improved error handling and validation
- Better TypeScript type safety
- Performance optimizations

### Changed
- Updated all dependencies to latest versions
- Replaced TSLint with ESLint
- Added Prettier for code formatting
- Improved BEM conversion logic
- Enhanced error messages and user feedback
- Optimized DOM object comparison
- Improved code organization and readability

### Fixed
- Fixed issues with BEM class conversion
- Fixed handling of multiple IDs and classes
- Fixed edge cases in HTML parsing
- Fixed configuration update handling
- Fixed clipboard content validation

### Removed
- Removed deprecated dependencies
- Removed redundant code
- Removed unnecessary type assertions

### Security
- Added input validation
- Improved error handling
- Added type guards

## [1.1.0] - 2023-12-15

### Added
- Support for LESS syntax
- Support for SCSS syntax
- BEM methodology support
- Configuration options for customization

### Changed
- Updated to latest VSCode extension API
- Improved HTML parsing
- Enhanced error handling

### Fixed
- Fixed issues with nested elements
- Fixed class name handling
- Fixed ID handling

## [1.0.0] - 2023-10-01

### Added
- Initial release
- Basic HTML to CSS conversion
- Support for basic selectors
- Simple configuration options
