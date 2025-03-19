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
