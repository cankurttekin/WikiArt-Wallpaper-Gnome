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

var currentImageUrl = '';
var currentImageDescription = '';
var timeoutId = null;
var myExtension = null;
const TrayIcon = 'wikiartwallpaper';

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

            // Create a menu item to display the current image URL and title
            this.titleMenuItem = new PopupMenu.PopupMenuItem("Info about artwork will be displayed here when refreshed.", { reactive: false });

            this.titleMenuItem.label.clutter_text.line_wrap = true;

            this.menu.addMenuItem(this.titleMenuItem);

            // Set a fixed size for the menu
            this.menu.actor.width = 500; // Fixed width in pixels
        }

        async _refreshWallpaper() {
            let myUrl = getArtworkApiUrl();
            try {
                let { url: myImageUrl, title: myImageDescription } = await getWallpaperUrl(myUrl);
                downloadAndSetWallpaper(myImageUrl);
                currentImageUrl = myImageUrl;
                currentImageDescription = myImageDescription;
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

function downloadAndSetWallpaper(urlToDownload) {
    // Download the image
    GLib.spawn_async(null, ['wget', '-O', '/tmp/wallpaper.jpg', urlToDownload], null, GLib.SpawnFlags.SEARCH_PATH, null);

    timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
        // Set the wallpaper
        let wallpaperSettings = new Gio.Settings({ schema: 'org.gnome.desktop.background' });
        wallpaperSettings.set_string('picture-uri', 'file:///tmp/wallpaper.jpg');
        setWallpaperAdjustment('centered');
        return GLib.SOURCE_REMOVE;
    });
}

function setWallpaperAdjustment(adjustmentMode) {
    let wallpaperSettings = new Gio.Settings({ schema: 'org.gnome.desktop.background' });
    wallpaperSettings.set_string('picture-options', adjustmentMode);
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
                let imageUrl = json.ImageDescription.Url.slice(0, -10);
                let imageDesc = 'Title: ' + json.Title + '\n';
                imageDesc += 'Artist: ' + json.ArtistName + '\n';
                imageDesc += 'Year: ' + json.CompletitionYear + '\n';
                imageDesc += 'Description: ' + json.Description + '\n';
                imageDesc = convertHtmlToPlainText(imageDesc);
                resolve({ url: imageUrl, title: imageDesc });
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

