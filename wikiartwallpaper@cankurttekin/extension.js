const { St, Clutter, Gio, GLib, GObject, Shell } = imports.gi;
const Mainloop = imports.mainloop;
const Soup = imports.gi.Soup;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

var currentImageUrl = '';
var currentImageDescription = '';
var timeoutId = null;
var myExtension = null;

let wallpaperAdjustment = 'scaled';
let color = '#000000';

const TrayIcon = 'wikiartwallpaper';

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var MyExtension = GObject.registerClass(
    class MyExtension extends PanelMenu.Button {
        _init() {
            super._init(0.0, "MyExtension");

            this.icon = new St.Icon({
                style_class: "system-status-icon",
            });

            this.icon.gicon = Gio.icon_new_for_string(`${Me.path}/icons/${TrayIcon}.svg`);
            this.actor.add_child(this.icon);

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

            // Create open image folder button
            this.folderMenuItem = new PopupMenu.PopupMenuItem("Open Image Folder");
            this.menu.addMenuItem(this.folderMenuItem);
            
            this.folderMenuItem.connect('activate', () => {
                openImageFolder();
            });


            // Create a menu item to display the current current image description
            this.titleMenuItem = new PopupMenu.PopupMenuItem("Info about artwork will be displayed here when refreshed.", { reactive: false });
            //this.urlMenuItem = new PopupMenu.PopupMenuItem("", { reactive: false });

            this.titleMenuItem.label.clutter_text.line_wrap = true;
            //this.urlMenuItem.label.clutter_text.line_wrap = true;

            this.menu.addMenuItem(this.titleMenuItem);
            //this.menu.addMenuItem(this.urlMenuItem);

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
                log('Failed to get wallpaper URL: ' + error);
            }
        }

        _updateMenuItems() {
            this.titleMenuItem.label.text = currentImageDescription;
            //this.urlMenuItem.label.text = currentImageUrl;
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
        
        let uri = 'file:///tmp/wallpaper.jpg';

	wallpaperSettings.set_string('picture-uri', 'file:///tmp/wallpaper.jpg');
	//setWallpaperAdjustment('centered');
        wallpaperSettings.set_string('picture-uri', uri);
        try {
            wallpaperSettings.set_string('picture-uri-dark', uri);
        }
        catch (e) {
            log("Can't set wallpaper for dark mode - " + e);
        }
        
        return GLib.SOURCE_REMOVE;
    });
}

function setWallpaperAdjustment(adjustmentMode) {
    let wallpaperSettings = new Gio.Settings({ schema: 'org.gnome.desktop.background' });
    wallpaperSettings.set_string('picture-options', adjustmentMode);
}

function openImageFolder() {
    const WikiArtWallpaperDir = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES) + '/WikiArtWallpaper/'; // REFACTOR THIS
    Gio.AppInfo.launch_default_for_uri('file:///tmp', null);
}

function getWallpaperUrl(url) {
    return new Promise((resolve, reject) => {
        let session = new Soup.Session();
        let message = Soup.Message.new('GET', url);

        session.queue_message(message, function (session, message) {
            if (message.status_code !== 200) {
                reject('Failed to fetch data from ' + url);
                return;
            }

            let rawJson = message.response_body.data;

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

function init() {}

function enable() {
    // Create and add the extension to the panel
    myExtension = new MyExtension();
    Main.panel.addToStatusArea("my-extension", myExtension);
}

function disable() {
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
