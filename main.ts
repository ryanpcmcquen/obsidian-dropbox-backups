import {
    App,
    addIcon,
    moment,
    Platform,
    Plugin,
    PluginSettingTab,
    setIcon,
    Setting,
} from "obsidian";
import { Dropbox, DropboxAuth, files } from "./assets/Dropbox-sdk.js";

type accessTokenStore = {
    access_token: string;
    refresh_token: string;
};

let dropboxBackupsCodeVerifier: string;

interface DropboxBackupsPluginSettings {
    excludeBinaryFiles: boolean;
}

const DEFAULT_SETTINGS: DropboxBackupsPluginSettings = {
    excludeBinaryFiles: false,
};
const oneMinute = 60000;

// Call this method inside your plugin's
// `onload` function like so:
// monkeyPatchConsole(this);
const monkeyPatchConsole = (plugin: Plugin) => {
    if (!Platform.isMobile) {
        return;
    }

    const logFile = `${plugin.manifest.dir}/logs.txt`;
    const logs: string[] = [];
    const logMessages = (prefix: string) => (...messages: unknown[]) => {
        logs.push(`\n[${prefix}]`);
        for (const message of messages) {
            logs.push(String(message));
        }
        plugin.app.vault.adapter.write(logFile, logs.join(" "));
    };

    console.debug = logMessages("debug");
    console.error = logMessages("error");
    console.info = logMessages("info");
    console.log = logMessages("log");
    console.warn = logMessages("warn");
};

class DropboxBackupsSettingTab extends PluginSettingTab {
    plugin: DropboxBackups;

    constructor(app: App, plugin: DropboxBackups) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        let { containerEl } = this;

        containerEl.empty();

        containerEl.createEl("h2", { text: "Aut-O-Backups Settings" });

        new Setting(containerEl)
            .setName("Exclude binary files")
            .setDesc(
                "Exclude files without the following extensions: md, org, txt"
            )
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.excludeBinaryFiles);
                toggle.onChange(async (value) => {
                    this.plugin.settings.excludeBinaryFiles = value;

                    await this.plugin.saveSettings();
                });
            });
    }
}

export default class DropboxBackups extends Plugin {
    settings: DropboxBackupsPluginSettings;

    dbx: Dropbox;
    dbxAuth: DropboxAuth;

    currentBackupTime: number;

    icons = {
        cloudSlash: `
            <path d="M8.4,4.7L5.6,7.5l22,22c0,0-0.1,0-0.1,0l8.7,8.7l0-0.1L74.1,76h-0.1l4,4h0.1l14,14l2.8-2.8L83.6,79.9 c9.1-0.7,16.4-8.4,16.4-17.7c0-9.1-6.9-16.7-15.7-17.7c0-0.4,0-0.8,0-1.1c0-14.5-11.8-26.3-26.3-26.3c-9.8,0-18.7,5.5-23.2,14 L8.4,4.7z M58,21.1c12.3,0,22.3,10,22.3,22.3c0,0.8-0.1,1.7-0.2,2.8l-0.3,2.2h2.4c7.6,0,13.7,6.2,13.7,13.8 C96,69.8,89.8,76,82.2,76h-2.5l-42-41.9C41.4,26.2,49.3,21.1,58,21.1L58,21.1z M22.4,30.1c-5.3,1.7-9.3,6.6-9.7,12.4 C5.2,45.3,0,52.5,0,60.7C0,71.3,8.7,80,19.3,80h52.9l-4-4H19.3C10.9,76,4,69.1,4,60.7c0-6.9,4.6-12.9,11.3-14.8l1.5-0.4l-0.1-2 c0-5.2,4-9.5,9.1-9.9L22.4,30.1z"/>
        `,
        cloudStartUpload: `
            <path d="M58,9.1c-10.4,0-19.3,6.2-23.5,15.1c-2.3-1.6-4.9-2.7-7.8-2.7c-7.5,0-13.4,5.9-13.8,13.3C5.4,37.4,0,44.3,0,52.7 C0,63.3,8.7,72,19.3,72H36c0.7,0,1.4-0.4,1.8-1c0.4-0.6,0.4-1.4,0-2c-0.4-0.6-1-1-1.8-1H19.3C10.8,68,4,61.2,4,52.7 c0-7.1,4.8-13,11.3-14.8c0.9-0.3,1.5-1.1,1.4-2c0-0.3,0-0.4,0-0.4c0-5.6,4.4-10,10-10c2.8,0,5.3,1.1,7.1,2.9 c0.5,0.5,1.2,0.7,1.8,0.5c0.7-0.1,1.2-0.6,1.4-1.2c3.1-8.5,11.3-14.6,20.9-14.6c12.3,0,22.3,10,22.3,22.3c0,0.9-0.1,1.8-0.2,2.8 c-0.1,0.6,0.1,1.1,0.5,1.6c0.4,0.4,0.9,0.7,1.5,0.7h0.1c7.6,0,13.8,6.2,13.8,13.8S89.8,68,82.2,68H64c-0.7,0-1.4,0.4-1.8,1 c-0.4,0.6-0.4,1.4,0,2c0.4,0.6,1,1,1.8,1h18.2C92,72,100,64,100,54.2c0-9.1-7-16.3-15.8-17.4c0-0.5,0.1-0.9,0.1-1.4 C84.3,20.9,72.5,9.1,58,9.1z M50,43.2l-1.4,1.4l-10,10c-0.8,0.8-0.8,2.1,0,2.9c0.8,0.8,2.1,0.8,2.9,0l6.6-6.6V86 c0,0.7,0.4,1.4,1,1.8c0.6,0.4,1.4,0.4,2,0c0.6-0.4,1-1,1-1.8V50.9l6.6,6.6c0.8,0.8,2.1,0.8,2.9,0c0.8-0.8,0.8-2.1,0-2.9l-10-10 L50,43.2z"/>
        `,
        cloudHalfUploaded: `
            <path d="M40,16c-12.9,0-23.3,10.2-23.8,23C6.8,41.6,0,50,0,60c0,12.1,9.9,22,22,22h60c9.9,0,18-8.1,18-18 c0-7.8-5.2-14.4-12.2-16.8C87.4,35.5,77.8,26,66,26c-2.1,0-4,0.5-5.9,1.1C55.8,20.5,48.4,16,40,16L40,16z M40,20 c7.5,0,14,4.2,17.4,10.2l0.9,1.4l1.6-0.6c2-0.7,3.9-1.1,6.1-1.1c9.9,0,18,8.1,18,18v2.2l1.6,0.4C91.4,51.9,96,57.5,96,64 c0,7.7-6.3,14-14,14H22c-9.9,0-18-8.1-18-18c0-8.7,6.1-16,14.4-17.6l1.6-0.3V40C20,28.9,28.9,20,40,20L40,20z M50,37.2l-1.4,1.4 l-12,12l2.9,2.9l8.6-8.6V68h4V44.9l8.6,8.6l2.9-2.9l-12-12L50,37.2z"/>
        `,
        cloudUploadComplete: `
            <path d="M58,18c-10.6,0-19.6,6.6-23.6,15.8c-1.9-1-4-1.8-6.4-1.8c-6.6,0-12.1,4.7-13.5,10.9C6.2,45.4,0,52.9,0,62c0,11,9,20,20,20 h62c9.9,0,18-8.1,18-18c0-9.3-7.2-16.7-16.2-17.6c0.1-0.8,0.2-1.6,0.2-2.4C84,29.7,72.3,18,58,18L58,18z M58,22 c12.2,0,22,9.8,22,22c0,1.2-0.1,2.5-0.3,3.7c-0.1,0.6,0.1,1.2,0.5,1.6c0.4,0.5,1,0.7,1.5,0.7c0.3,0,0.4,0,0.3,0 c7.8,0,14,6.2,14,14s-6.2,14-14,14H20c-8.9,0-16-7.1-16-16c0-7.7,5.4-14,12.6-15.6c0.8-0.2,1.5-0.9,1.6-1.7 c0.6-4.9,4.8-8.7,9.9-8.7c2.3,0,4.3,0.8,6,2.1c0.5,0.4,1.2,0.5,1.8,0.3c0.6-0.2,1.1-0.7,1.3-1.3C40,28.3,48.3,22,58,22L58,22z M66.5,40.6L45.9,63.1L35.4,52.6l-2.9,2.9l12,12l1.5,1.4l1.4-1.5l22-24L66.5,40.6z"/>
        `,
    };

    dropboxBackupsTokenStorePath = `${this.manifest.dir}/.__dropbox_backups_token_store__`;
    dropboxBackupsTokenStore: accessTokenStore;

    CLIENT_ID = "40ig42vaqj3762d";
    obsidianProtocol = "obsidian://";
    obsidianProtocolAction = "dropbox-backups-auth";
    obsidianProtocolActionUrl = `${this.obsidianProtocol}${this.obsidianProtocolAction}`;
    defaultAriaLabel = "Backup to Dropbox";

    dropboxBackupsRibbonIcon: HTMLElement;

    vaultPath = this.app.vault.getName();

    couldBeBinary(extension: string) {
        return extension !== "md" && extension !== "org" && extension !== "txt";
    }

    async _backup(): Promise<void> {
        const now = Date.now();
        let finalStatus = "complete";

        this.currentBackupTime = now;

        const year = moment(new Date(now)).format("YYYY");
        const month = moment(new Date(now)).format("MM");
        const day = moment(new Date(now)).format("DD");
        const time = moment(new Date(now)).format("HH_mm_ss_SSS");

        const pathPrefix = `/${this.vaultPath}/${year}/${month}/${day}/${time}`;

        const backupAttemptLogMessage = `Aut-O-Backups: Attempting backup to: ${pathPrefix}`;
        console.log(backupAttemptLogMessage);

        if (!Platform.isMobile && this.dropboxBackupsRibbonIcon) {
            this.dropboxBackupsRibbonIcon.setAttribute(
                "aria-label",
                this.defaultAriaLabel + "\n" + backupAttemptLogMessage
            );
        }
        setIcon(this.dropboxBackupsRibbonIcon, "dropbox-backups-start-upload");

        const fileList = this.app.vault.getFiles();

        if (fileList.length > 0) {
            let counter = 0;
            for (const file of fileList) {
                if (this.currentBackupTime !== now) {
                    finalStatus = "canceled";
                    break;
                }
                if (this.app.vault.adapter.exists(file.path)) {
                    let fileContents;
                    if (
                        this.couldBeBinary(file.extension) &&
                        this.settings.excludeBinaryFiles
                    ) {
                        continue;
                    } else if (
                        this.couldBeBinary(file.extension) &&
                        !this.settings.excludeBinaryFiles
                    ) {
                        fileContents = await this.app.vault.adapter.readBinary(
                            file.path
                        );
                    } else {
                        fileContents = await this.app.vault.adapter.read(
                            file.path
                        );
                    }

                    try {
                        await this.dbx.filesUpload({
                            path: `${pathPrefix}/${file.path}`,
                            mode: ("add" as unknown) as files.WriteModeAdd,
                            mute: true,
                            contents: fileContents,
                        });

                        counter++;
                        if (counter + 1 === Math.floor(fileList.length / 2)) {
                            setIcon(
                                this.dropboxBackupsRibbonIcon,
                                "dropbox-backups-half-uploaded"
                            );
                        }
                    } catch (err) {
                        console.error("Aut-O-Backups: Backup error: ", err);
                    }
                }
            }
        }

        console.log(`Aut-O-Backups: Backup to ${pathPrefix} ${finalStatus}!`);

        if (!Platform.isMobile && this.dropboxBackupsRibbonIcon) {
            this.dropboxBackupsRibbonIcon.setAttribute(
                "aria-label",
                this.defaultAriaLabel + "\n" + `Last backup: ${pathPrefix}`
            );
        }

        if (this.currentBackupTime === now) {
            setIcon(
                this.dropboxBackupsRibbonIcon,
                "dropbox-backups-upload-complete"
            );
        }
    }

    async backup() {
        window.setTimeout(
            async () => {
                await this._backup();
            },
            // Delay everything 10 minutes, since syncing
            // right when the app launches is kind of
            // annoying and could back up old
            // versions if other syncs
            // are executing.
            oneMinute * 10
        );
    }

    async setupAuth() {
        this.dbxAuth = new DropboxAuth({
            clientId: this.CLIENT_ID,
        });

        // From the Dropbox docs:
        // getAuthenticationUrl(
        //     redirectUri,
        //     state,
        //     authType = 'token',
        //     tokenAccessType = null,
        //     scope = null,
        //     includeGrantedScopes = 'none',
        //     usePKCE = false
        // )
        const authUrl = String(
            await this.dbxAuth.getAuthenticationUrl(
                this.obsidianProtocolActionUrl,
                undefined,
                "code",
                "offline",
                undefined,
                undefined,
                true
            )
        );

        dropboxBackupsCodeVerifier = this.dbxAuth.getCodeVerifier();

        // This fails on mobile, probably because it is delayed:
        // window.open(authUrl)
        window.location.assign(authUrl);
    }

    async doAuth(params: any) {
        this.dbxAuth.setCodeVerifier(dropboxBackupsCodeVerifier);

        const accessTokenResponse = await this.dbxAuth.getAccessTokenFromCode(
            this.obsidianProtocolActionUrl,
            params.code
        );

        const accessTokenResponseResult = accessTokenResponse?.result as accessTokenStore;
        this.dropboxBackupsTokenStore = accessTokenResponseResult;
        await this.app.vault.adapter.write(
            this.dropboxBackupsTokenStorePath,
            JSON.stringify(this.dropboxBackupsTokenStore)
        );

        this.dbxAuth.setAccessToken(accessTokenResponseResult?.access_token);

        this.dbx = new Dropbox({
            auth: this.dbxAuth,
        });

        await this.backup();
    }

    async doStoredAuth(): Promise<void> {
        if (!this.dbxAuth) {
            this.dbxAuth = new DropboxAuth({
                clientId: this.CLIENT_ID,
                accessToken: this.dropboxBackupsTokenStore.access_token,
                refreshToken: this.dropboxBackupsTokenStore.refresh_token,
            });
        }

        await this.dbxAuth.checkAndRefreshAccessToken();

        this.dbx = new Dropbox({
            auth: this.dbxAuth,
        });

        await this.backup();
    }

    async attemptAuth() {
        try {
            if (this.dropboxBackupsTokenStore) {
                console.log("Aut-O-Backups: Attempting stored auth ...");
                await this.doStoredAuth();
            } else {
                console.log("Aut-O-Backups: Attempting auth setup ...");
                await this.setupAuth();
            }
        } catch (error) {
            console.error("Aut-O-Backups: Auth error: ", error);
        }
        setIcon(
            this.dropboxBackupsRibbonIcon,
            "dropbox-backups-upload-complete"
        );
    }

    async attemptBackup() {
        try {
            await this.backup();
        } catch (ignore) {
            await this.attemptAuth();
        }
    }

    async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData()
        );
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async onload(): Promise<void> {
        monkeyPatchConsole(this);
        console.log("Loading Aut-O-Backups plugin ...");
        await this.loadSettings();

        addIcon("dropbox-backups-init", this.icons.cloudSlash);
        addIcon("dropbox-backups-start-upload", this.icons.cloudStartUpload);
        addIcon("dropbox-backups-half-uploaded", this.icons.cloudHalfUploaded);
        addIcon(
            "dropbox-backups-upload-complete",
            this.icons.cloudUploadComplete
        );

        this.addSettingTab(new DropboxBackupsSettingTab(this.app, this));

        if (
            await this.app.vault.adapter.exists(
                this.dropboxBackupsTokenStorePath
            )
        ) {
            this.dropboxBackupsTokenStore = JSON.parse(
                await this.app.vault.adapter.read(
                    this.dropboxBackupsTokenStorePath
                )
            );
        }

        this.registerObsidianProtocolHandler(
            this.obsidianProtocolAction,
            async (params) => {
                await this.doAuth(params);
            }
        );

        this.dropboxBackupsRibbonIcon = this.addRibbonIcon(
            "dropbox-backups-init",
            this.defaultAriaLabel,
            async () => {
                try {
                    await this.attemptBackup();
                } catch (ignore) {
                    await this.attemptAuth();
                }
            }
        );

        this.attemptAuth();

        this.registerInterval(
            window.setInterval(
                async () => {
                    try {
                        await this.attemptBackup();
                    } catch (ignore) {
                        await this.attemptAuth();
                    }
                },
                // Every 20 minutes:
                oneMinute * 20
            )
        );
    }

    onunload() {
        console.log("Unloading Aut-O-Backups plugin ...");
    }
}
