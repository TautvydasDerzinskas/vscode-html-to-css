<p align="center">
  <a href="https://github.com/SlimDogs/vscode-html-to-css"><img src="https://raw.githubusercontent.com/SlimDogs/vscode-html-to-css/master/images/html2css_dark.png" alt="Visual Studio Code extension: Html to css" title="Visual Studio Code extension: Html to css" /></a>
</p>

<p align="center">
  <a href="#" target="_blank"><img src="https://travis-ci.com/TautvydasDerzinskas/vscode-html-to-css.svg?branch=master" alt="Latest CI build status" title="Latest CI build status"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=tautvydasderzinskas.vscode-html-to-css" target="_blank"><img src="https://img.shields.io/visual-studio-marketplace/d/tautvydasderzinskas.vscode-html-to-css.svg" alt="Visual Studio Marketplace" title="Visual Studio Marketplace"></a>
  <a href="https://greenkeeper.io" target="_blank"><img src="https://badges.greenkeeper.io/SlimDogs/vscode-html-to-css.svg" alt="Greenkeeper" title="Greenkeeper"></a>
  <a href="http://commitizen.github.io/cz-cli" target="_blank"><img src="https://img.shields.io/badge/commitizen-friendly-brightgreen.svg" alt="Commitizen friendly" title="Commitizen friendly"></a>
  <a href="https://github.com/semantic-release/semantic-release" target="_blank"><img src="https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg" alt="Semantic release" title="Semantic release"></a>
  <a href="https://opensource.org/licenses/MIT" target="_blank"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" title="MIT License"></a>
  <a href="https://github.com/igrigorik/ga-beacon" target="_blank"><img src="https://ga-beacon.appspot.com/UA-131052445-2/SlimDogs/vscode-html-to-css" alt="Analytics" title="Analytics"></a>
</p>

## Table of content
- [About](#about)
- [Preview](#preview)
- [Usage](#usage)
- [Installation](#installation)
- [Configuration](#configuration)
- [Credits](#credits)
- [License](#license)
- [Changelog](CHANGELOG.md)

## About
Visual Studio Code extension enables developers to convert HTML code to CSS / LESS / SCSS style syntax!

Please see preview & usage for more information.

## Preview
<a href="images/html2css_preview.gif" target="_blank"><img width="800px" src="https://raw.githubusercontent.com/SlimDogs/vscode-html-to-css/master/images/html2css_preview.gif" alt="Preview" title="Preview" /></a>

## Usage

Default usage:
1. Copy valid HTML code (including opening & closing tags)
2. Activate the window where you want to paste the converted style selectors & click right mouse button to get to the its context menus then select highlighted option:

<img width="300px" src="https://raw.githubusercontent.com/SlimDogs/vscode-html-to-css/master/images/html2css_menu.png" alt="Context menu" title="Context menu" />

Keybind usage:
1. Copy valid HTML code (including opening & closing tags)
2. Paste the code using key combination `CMD/CTRL+ALT+V`
3. It will paste CSS selectors to *.css files and SCSS / LESS selectors to all other files.

Alternative usage:
1. Open command pallete by clicking `CMD/CTRL+SHIFT+P`
2. Type `Paste HTML converted to CSS / LESS / SCSS` and select suggested option

## Installation

Via Quick Open:

1. [Download](https://code.visualstudio.com/download), install and open VS Code
2. Press `CMD/CTRL+P` to open the Quick Open dialog
3. Type `ext install tautvydasderzinskas.vscode-html-to-css`
4. Click the *Install* button, then the *Enable* button

Via the Extensions tab:

1. Click the extensions tab or press `CMD/CTRL+SHIFT+X`
2. Search for `html for css/less/scss`
3. Click the `Install` button, then the `Enable` button

Via the command line:

1. Open a command-line prompt
2. Run `code --install-extension TautvydasDerzinskas.vscode-html-to-css`

## Configuration

Extension provides these [User and Workspace settings](https://code.visualstudio.com/docs/getstarted/settings):
- `htmlToCss.hideTags` - hide tag selector if element has class or id (default: ***true***)
- `htmlToCss.convertBEM` - recognize BEM classes and split them accordingly (default: ***true***)
- `htmlToCss.preappendHtml` - pre-append comment containing transformed html structure (default: ***false***)

## Credits

This project uses big portion of logic written by [Harry Horton](https://github.com/Johnhhorton).

Please check out his awesome [scssifyhtml project](https://github.com/Johnhhorton/scssifyhtml)!

## License

The repository code is open-sourced software licensed under the [MIT license](https://github.com/SlimDogs/vscode-html-to-css/blob/master/LICENSE?raw=true).