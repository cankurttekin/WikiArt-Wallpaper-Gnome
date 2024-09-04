/* extension.js
 *
 * WikiArt GNOME Shell Extension is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * WikiArt GNOME Shell Extension is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with WikiArt GNOME Shell Extension.  If not, see <http://www.gnu.org/licenses/>.
 *
 * License: GPL-3.0
 */

const { Shell } = imports.gi;
import St from "gi://St";
import Gio from "gi://Gio";
import Clutter from "gi://Clutter";
import Soup from 'gi://Soup';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const WIKIART_WALLPAPER_DIR = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES) + '/WikiArtWallpaper/';
const MAX_ARTWORK_INDEX = 3810;

const TrayIcon = 'wikiartwallpaper';
let currentImageUrl = '';
let currentImageDescription = '';
let currentImageTitle = '';
let wallpaperAdjustment = 'scaled'; // Default wallpaper adjustment mode
let color = '#000000'; // Default background color
let timeoutId = null;
let myExtension = null;

const WikiArtWallpaper = GObject.registerClass(
    class WikiArtWallpaper extends PanelMenu.Button {
        _init(extension) {
            super._init(0.0, "WikiArtWallpaper");

            this.extension = extension;
            
            // Set up the icon for the tray button
            this.icon = new St.Icon({
                style_class: "system-status-icon",
            });

            this.icon.gicon = Gio.icon_new_for_string(`${this.extension.path}/icons/${TrayIcon}.svg`);
            this.add_child(this.icon);

            // Create and connect a "Refresh" button to update the wallpaper
            this.refreshMenuItem = new PopupMenu.PopupMenuItem("Refresh");
            this.refreshMenuItem.connect('activate', () => {
                this._refreshWallpaper();
            });
            this.menu.addMenuItem(this.refreshMenuItem);

            // Create menu items for adjusting wallpaper settings
            this.wallpaperMenuItem = new PopupMenu.PopupMenuItem("Wallpaper");
            this.wallpaperMenuItem.connect('activate', () => {
                wallpaperAdjustment = 'wallpaper';
                setWallpaperAdjustment(wallpaperAdjustment);
            });
            
            this.centeredMenuItem = new PopupMenu.PopupMenuItem("Centered");
            this.centeredMenuItem.connect('activate', () => {
                wallpaperAdjustment = 'centered';
                setWallpaperAdjustment(wallpaperAdjustment);
            });
            
            this.scaledMenuItem = new PopupMenu.PopupMenuItem("Scaled (Default)");
            this.scaledMenuItem.connect('activate', () => {
                wallpaperAdjustment = 'scaled';
                setWallpaperAdjustment(wallpaperAdjustment);
            });
            
            this.strechedMenuItem = new PopupMenu.PopupMenuItem("Streched");
            this.strechedMenuItem.connect('activate', () => {
                wallpaperAdjustment = 'streched';
                setWallpaperAdjustment(wallpaperAdjustment);
            });

            this.zoomMenuItem = new PopupMenu.PopupMenuItem("Zoom");
            this.zoomMenuItem.connect('activate', () => {
                wallpaperAdjustment = 'zoom';
                setWallpaperAdjustment(wallpaperAdjustment);
            });
            
            this.spannedMenuItem = new PopupMenu.PopupMenuItem("Spanned");
            this.spannedMenuItem.connect('activate', () => {
                wallpaperAdjustment = 'spanned';
                setWallpaperAdjustment(wallpaperAdjustment);
            });

            // Add all adjustment options to a submenu
            this.subMenu = new PopupMenu.PopupSubMenuMenuItem('Change Wallpaper Adjustment');
            [this.wallpaperMenuItem, this.centeredMenuItem, this.scaledMenuItem, this.strechedMenuItem, this.zoomMenuItem, this.spannedMenuItem]
                .forEach(e => this.subMenu.menu.addMenuItem(e));
            this.menu.addMenuItem(this.subMenu);  

            // Create menu item for setting background color
            this.setColorButton = new St.Button({
                label: "Set Color for Background",
            });

            // Create a button to set a custom background color
            let setColorButtonMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
            setColorButtonMenuItem.add_child(this.setColorButton);
            this.menu.addMenuItem(setColorButtonMenuItem);
            
            // Create input field for hex color
            this.colorEntry = new St.Entry({
                style_class: 'color-entry',
                can_focus: true,
                hint_text: 'Enter hex color (default: #000000)',
            });

            // Create an input field for entering a hex color value
            let colorEntryMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
            colorEntryMenuItem.add_child(this.colorEntry);
            this.menu.addMenuItem(colorEntryMenuItem);
            
            // Create a button to open the image folder
            this.folderMenuItem = new PopupMenu.PopupMenuItem("Open Image Folder");
            this.menu.addMenuItem(this.folderMenuItem);
            
            this.folderMenuItem.connect('activate', () => {
                openImageFolder();
            });
            
            // Connect the activate signal to set the background color
            this.colorEntry.clutter_text.connect('activate', () => {
                let color = this.colorEntry.get_text();
                setBackgroundColor(color);
            });
            
            // Create a menu item to display the current image description
            this.titleMenuItem = new PopupMenu.PopupMenuItem("Info about artwork will be displayed here when refreshed.", { reactive: false });
            //this.titleMenuItem.label = new St.Label({ text: "Description here", x_align: Clutter.ActorAlign.START });
            this.titleMenuItem.label.clutter_text.line_wrap = true;
            this.menu.addMenuItem(this.titleMenuItem);

            // Set a fixed size for the menu
            this.menu.actor.width = 500; // Fixed width in pixels
        }

        async _refreshWallpaper() {
            let myUrl = getArtworkApiUrl();
            try {
                let { url: myImageUrl, title: myImageTitle, description: myImageDescription } = await getWallpaperUrl(myUrl);
                if (!myImageUrl || !myImageTitle || !myImageDescription) {
                    log('Incomplete data received from the API');
                    return;
                }
                downloadWallpaper(myImageUrl, myImageTitle);
                currentImageUrl = myImageUrl;
                currentImageDescription = myImageDescription;
                currentImageTitle = myImageTitle;
                renameFile(myImageTitle);
                this._updateMenuItems();
            } catch (error) {
                console.log('Failed to get wallpaper URL: ' + error);
                this.titleMenuItem.label.text = 'Failed to fetch artwork data.';
            }
        }
        // Update the menu items with the current image description
        _updateMenuItems() {
            this.titleMenuItem.label.text = currentImageDescription;
        }
    }
);

function getArtworkApiUrl() {
    let randomIndex = Math.floor(Math.random() * MAX_ARTWORK_INDEX) + 1;
    let artworkApi = `https://www.wikiart.org/en/app/home/ArtworkOfTheDay?direction=next&index=${randomIndex}`;
    return artworkApi;
}

function downloadWallpaper(urlToDownload, titleToFileName) {
    const filePath = WIKIART_WALLPAPER_DIR + 'wallpaper.jpg';

    try {
        let [success, stdout, stderr, exitStatus] = GLib.spawn_sync(
            null, ['wget', '-O', filePath, urlToDownload], null, GLib.SpawnFlags.SEARCH_PATH, null
        );

        if (exitStatus === 0) {
            log('Image downloaded successfully.');
            // Verify if the file is a valid image before setting it as wallpaper
            if (isImageFileValid(filePath)) {
                setWallpaper(filePath);
            } else {
                log('Downloaded file is not a valid image format.');
            }
        } else {
            log('Download failed with status: ' + exitStatus);
        }

    } catch (e) {
        log('Error during download process: ' + e.message);
    }
}

function isImageFileValid(filePath) {
    try {
        let file = Gio.File.new_for_path(filePath);
        let fileInfo = file.query_info('standard::content-type', Gio.FileQueryInfoFlags.NONE, null);
        let contentType = fileInfo.get_content_type();

        // Check if the content type is a valid image format
        return contentType.startsWith('image/');
    } catch (e) {
        log('Error checking file content type: ' + e.message);
        return false;
    }
}

function setWallpaper(filePath) {
    try {
        let wallpaperSettings = new Gio.Settings({ schema: 'org.gnome.desktop.background' });
        wallpaperSettings.set_string('picture-uri', 'file://' + filePath);

        try {
            wallpaperSettings.set_string('picture-uri-dark', 'file://' + filePath);
        } catch (e) {
            log("Can't set wallpaper for dark mode - " + e);
        }
    } catch (e) {
        log('Error setting wallpaper: ' + e.message);
    }
}

function renameFile(imageTitle) {
    try {
        let file = Gio.File.new_for_path(WIKIART_WALLPAPER_DIR + 'wallpaper.jpg');
        let newFile = Gio.File.new_for_path(WIKIART_WALLPAPER_DIR + imageTitle + '.jpg');
        file.copy(newFile, Gio.FileCopyFlags.NONE, null, null);
        log('File renamed successfully');
    } catch (e) {
        log('Error renaming file: ' + e.message);
    }
}

function setWallpaperAdjustment(adjustmentMode) {
    const wallpaperSettings = new Gio.Settings({ schema: 'org.gnome.desktop.background' });
    wallpaperSettings.set_string('picture-options', adjustmentMode);
}

function openImageFolder() {
    //const WikiArtWallpaperDir = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES) + '/WikiArtWallpaper/'; // REFACTOR THIS
    Gio.AppInfo.launch_default_for_uri('file:///' + WIKIART_WALLPAPER_DIR, null);
}

function setBackgroundColor(color) {
    const wallpaperSettings = new Gio.Settings({ schema: 'org.gnome.desktop.background' });
    wallpaperSettings.set_string('primary-color', color);
}

function getWallpaperUrl(url) {
    return new Promise((resolve, reject) => {
        let session = new Soup.Session();
        let message = Soup.Message.new('GET', url);

        session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
            let data;
            try {
                data = session.send_and_read_finish(result);
                if (message.status_code !== 200) {
                    reject('Non-OK HTTP status: ' + message.status_code);
                return;
                }
            } catch (e) {
                reject('Failed to fetch data, Error - ' + e.message);
                return;
            }

            let rawJson = new TextDecoder().decode(data.get_data());
            let json;
            try {
                json = JSON.parse(JSON.parse(rawJson));
            } catch (e) {
                reject('Failed to parse JSON: ' + e);
                return;
            }

            if (json && json.ImageDescription && json.ImageDescription.Url && json.Title) {
                let imageTitle = json.Title;
                let imageUrl = json.ImageDescription.Url.slice(0, -10);
                let imageDesc = 'Title: ' + json.Title + '\n';
                imageDesc += 'Artist: ' + json.ArtistName + '\n';
                imageDesc += 'Year: ' + json.CompletitionYear + '\n';
                imageDesc += 'Description: ' + json.Description + '\n';
                imageDesc = convertHtmlToPlainText(imageDesc);
                imageTitle = convertHtmlToPlainText(imageTitle)
                resolve({ url: imageUrl, title: imageTitle, description: imageDesc });
            } else {
                reject('ImageDescription, Url or Title property is missing');
            }
        });
    });
}

function convertHtmlToPlainText(html) {
    let text = html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/?[^>]+(>|$)/g, "")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\\r/g, "")
        .replace(/\\n/g, "\n");
    return text;
}

export default class WikiArtWallpaperExtension extends Extension {
    enable() {
        // Create and add the extension to the panel
        myExtension = new WikiArtWallpaper(this);
        Main.panel.addToStatusArea(this.uuid, myExtension);
    }

    disable() {
        // Remove the extension from the panel
        if (myExtension) {
            myExtension.destroy();
            myExtension = null;
        }

        // Remove any active timeout
        if (timeoutId) {
            GLib.Source.remove(timeoutId);
            timeoutId = null;
        }
        
        // Clean up any active Soup sessions if needed
        if (this.session) {
            this.session.abort();
            this.session = null;
        }
    }
}
