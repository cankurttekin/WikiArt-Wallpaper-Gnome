# WikiArt Wallpaper GNOME Extension
 [![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0) [![Zip and Release](https://github.com/cankurttekin/WikiArt-Wallpaper-Gnome/actions/workflows/zip-release.yml/badge.svg)](https://github.com/cankurttekin/WikiArt-Wallpaper-Gnome/actions/workflows/zip-release.yml)
  <br>
 GNOME Shell Extension that changes your desktop wallpaper to WikiArt's Artwork of the day with single click.
 
You can view the title, artist, description of the image and some quick settings for background from the menu in tray.
<br>

[<img src="/resources/get_it_on_gnome_extensions.png" height="128">](https://extensions.gnome.org/extension/7071/wikiart-wallpaper/)

_Disclaimer: This extension is not affiliated, funded, or in any way associated with WikiArt._

## Version

The main branch supports GNOME Shell `45` to `50`. Older GNOME releases use the legacy branch below.

|Branch                   |Version|Compatible GNOME version|
|-------------------------|:-----:|------------------------|
| main                    |    15  | GNOME 45–50   |
| [gnome-shell-before-45](https://github.com/cankurttekin/WikiArt-Wallpaper-Gnome/tree/gnome-shell-before-45)   |    [3.1(8)](https://github.com/cankurttekin/WikiArt-Wallpaper-Gnome/releases/tag/3.1)  | GNOME 3.4 -> 44        |


## Installing
You can get this extension from [extensions.gnome.org](https://extensions.gnome.org/extension/7071/wikiart-wallpaper/) or copy the `wikiartwallpaper@cankurttekin` directory to `~/.local/share/gnome-shell/extensions/`.

To build and install the current source, run these commands from the repository root:

```sh
gnome-extensions pack --force --extra-source=icons --out-dir=/tmp wikiartwallpaper@cankurttekin
gnome-extensions install --force /tmp/wikiartwallpaper@cankurttekin.shell-extension.zip
```

Log out and back in, then enable the extension:

```sh
gnome-extensions enable wikiartwallpaper@cankurttekin
```

## Screenshots & Features
![Screenshot_1](/screenshots/screenshot.png)
<br>
![til](/screenshots/wikiart-extension-demo.gif)

## Contribute
You can help with development by contributing code, testing on other GNOME versions and reporting issues.<br>
Alternatively, you can consider supporting the WikiArt project, [WikiArt.org - How to contribute](https://www.wikiart.org/en/how-to-contribute).
