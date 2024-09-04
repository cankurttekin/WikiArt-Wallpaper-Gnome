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

const TrayIcon = 'wikiartwallpaper';
let currentImageUrl = '';
let currentImageDescription = '';
let currentImageTitle = '';
let wallpaperAdjustment = 'scaled';
let color = '#000000';
let timeoutId = null;
let myExtension = null;

const WikiArtWallpaper = GObject.registerClass(
    class WikiArtWallpaper extends PanelMenu.Button {
        _init(extension) {
            super._init(0.0, "WikiArtWallpaper");

            this.extension = extension;  // Store the extension object

            this.icon = new St.Icon({
                style_class: "system-status-icon",
            });

            this.icon.gicon = Gio.icon_new_for_string(`${this.extension.path}/icons/${TrayIcon}.svg`);
            this.add_child(this.icon);

            // Create a refresh button
            this.refreshMenuItem = new PopupMenu.PopupMenuItem("Refresh");
            this.refreshMenuItem.connect('activate', () => {
                this._refreshWallpaper();
            });
            this.menu.addMenuItem(this.refreshMenuItem);

            // Create menu items for wallpaper adjustments
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

            this.zoomMenuItem = new PopupMenu.PopupMenuItem("Zoom");
            this.zoomMenuItem.connect('activate', () => {
                wallpaperAdjustment = 'zoom';
                setWallpaperAdjustment(wallpaperAdjustment);
            });
            
            this.subMenu = new PopupMenu.PopupSubMenuMenuItem('Change Wallpaper Adjustment');
            [this.centeredMenuItem, this.scaledMenuItem, this.zoomMenuItem]
                .forEach(e => this.subMenu.menu.addMenuItem(e));
            this.menu.addMenuItem(this.subMenu);  

            // Create menu item for setting background color
            this.setColorButton = new St.Button({
                label: "Set Color for Background",
            });
            
            let setColorButtonMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
            setColorButtonMenuItem.add_child(this.setColorButton);
            this.menu.addMenuItem(setColorButtonMenuItem);
            
            // Create input field for hex color
            this.colorEntry = new St.Entry({
                style_class: 'color-entry',
                can_focus: true,
                hint_text: 'Enter hex color (default: #000000)',
            });
            
            let colorEntryMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
            colorEntryMenuItem.add_child(this.colorEntry);
            this.menu.addMenuItem(colorEntryMenuItem);
            
            // Create open image folder button
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
            this.titleMenuItem.label.clutter_text.line_wrap = true;
            this.menu.addMenuItem(this.titleMenuItem);

            // Set a fixed size for the menu
            this.menu.actor.width = 500; // Fixed width in pixels
        }

        async _refreshWallpaper() {
            let myUrl = getArtworkApiUrl();
            try {
                let { url: myImageUrl, title: myImageTitle, description: myImageDescription } = await getWallpaperUrl(myUrl);
                downloadAndSetWallpaper(myImageUrl, myImageTitle);
                currentImageUrl = myImageUrl;
                currentImageDescription = myImageDescription;
                currentImageTitle = myImageTitle;
                renameFile(myImageTitle);
                this._updateMenuItems();
            } catch (error) {
                console.log('Failed to get wallpaper URL: ' + error);
            }
        }

        _updateMenuItems() {
            this.titleMenuItem.label.text = currentImageDescription;
        }
    }
);

function getArtworkApiUrl() {
    let randomIndex = Math.floor(Math.random() * 3810) + 1; // fix this later
    let artworkApi = `https://www.wikiart.org/en/app/home/ArtworkOfTheDay?direction=next&index=${randomIndex}`;
    return artworkApi;
}
    


function downloadAndSetWallpaper(urlToDownload, titleToFileName) {
    const WikiArtWallpaperDir = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES) + '/WikiArtWallpaper/'; // REFACTOR THIS
    console.log(WikiArtWallpaperDir);
    console.log(titleToFileName);
    // Download the image
    //GLib.spawn_async(null, ['wget', '-O', (WikiArtWallpaperDir + titleToFileName + '.jpg'), urlToDownload], null, GLib.SpawnFlags.SEARCH_PATH, null);
    GLib.spawn_async(null, ['wget', '-O', (WikiArtWallpaperDir + 'wallpaper.jpg'), urlToDownload], null, GLib.SpawnFlags.SEARCH_PATH, null);

    timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
        // Set the wallpaper
        let wallpaperSettings = new Gio.Settings({ schema: 'org.gnome.desktop.background' });
        wallpaperSettings.set_string('picture-uri', ('file://' + WikiArtWallpaperDir + 'wallpaper.jpg'));
        try {
            wallpaperSettings.set_string('picture-uri-dark', ('file://' + WikiArtWallpaperDir + 'wallpaper.jpg'));
        }
        catch (e) {
            log("Can't set wallpaper for dark mode - " + e);
        }
        return GLib.SOURCE_REMOVE;
    });
}

function renameFile(imageTitle) {
    try {
        const WikiArtWallpaperDir = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES) + '/WikiArtWallpaper/';
        let file = Gio.File.new_for_path(WikiArtWallpaperDir + 'wallpaper.jpg');
        let newFile = Gio.File.new_for_path(WikiArtWallpaperDir + imageTitle + '.jpg');
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
    const WikiArtWallpaperDir = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES) + '/WikiArtWallpaper/'; // REFACTOR THIS
    Gio.AppInfo.launch_default_for_uri('file:///' + WikiArtWallpaperDir, null);
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
            } catch (e) {
                reject('Failed to fetch data from ' + url);
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
    }
}
