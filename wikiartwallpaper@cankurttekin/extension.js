const { St, Clutter, Gio, GLib, GObject, Shell } = imports.gi;
const Mainloop = imports.mainloop;
const Soup = imports.gi.Soup;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

var deneme = "There will be info about resource...";

var MyExtension = GObject.registerClass(
    class MyExtension extends PanelMenu.Button {
        _init() {
            super._init(0.0, "MyExtension");

            this.icon = new St.Icon({
                icon_name: "system-run-symbolic",
                style_class: "system-status-icon",
            });

            this.actor.add_child(this.icon);

            // Create a menu item
            let menuItem = new PopupMenu.PopupMenuItem(deneme);
            this.menu.addMenuItem(menuItem);

            this.actor.connect("button-press-event", () => {
                this._onButtonPress();
            });
        }

        async _onButtonPress() {
            let myUrl = getArtworkApiUrl();
            try {
                let myImageUrl = await getWallpaperUrl(myUrl);
                downloadAndSetWallpaper(myImageUrl);
            } catch (error) {
                log('Failed to get wallpaper URL: ' + error);
            }
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

    GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
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

            if (json && json.ImageDescription && json.ImageDescription.Url) {
                let imageUrl = json.ImageDescription.Url;
                imageUrl = imageUrl.slice(0, -10);
                resolve(imageUrl);
            } else {
                reject('ImageDescription or Url property is missing');
            }
        });
    });
}

function init() {}

function enable() {
    // Create and add the extension to the panel
    let myExtension = new MyExtension();
    Main.panel.addToStatusArea("my-extension", myExtension);
}

function disable() {
    // Remove the extension from the panel
    Main.panel.statusArea["my-extension"].destroy();
}
