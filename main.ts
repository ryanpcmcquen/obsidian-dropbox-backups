import { BlockCache, moment, Platform, Plugin } from "obsidian";
import "./assets/Dropbox-sdk.js";
declare var Dropbox: unknown;
declare var DropboxAuth: unknown;

type accessTokenStore = {
    access_token: string;
    refresh_token: string;
};

interface codeVerifierCache extends BlockCache {
    codeVerifier: string;
}

let dropboxBackupsCodeVerifierStore: codeVerifierCache;

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

export default class DropboxBackups extends Plugin {
    dbx: unknown;
    dbxAuth: unknown;

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

    async backup(): Promise<void> {
        const now = Date.now();

        const year = moment(new Date(now)).format("YYYY");
        const month = moment(new Date(now)).format("MM");
        const day = moment(new Date(now)).format("DD");
        const time = moment(new Date(now)).format("HH_mm_ss_SSS");

        const pathPrefix = `/${this.vaultPath}/${year}/${month}/${day}/${time}`;

        const backupAttemptLogMessage = `Attempting backup to: ${pathPrefix}`;
        console.log(backupAttemptLogMessage);

        if (!Platform.isMobile && this.dropboxBackupsRibbonIcon) {
            this.dropboxBackupsRibbonIcon.setAttribute(
                "aria-label",
                this.defaultAriaLabel + "\n" + backupAttemptLogMessage
            );
        }

        const fileList = this.app.vault.getFiles();

        if (fileList.length > 0) {
            for (const file of fileList) {
                if (this.app.vault.adapter.exists(file.path)) {
                    const fileContents = this.couldBeBinary(file.extension)
                        ? await this.app.vault.adapter.readBinary(file.path)
                        : await this.app.vault.adapter.read(file.path);

                    // @ts-ignore
                    await this.dbx.filesUpload({
                        path: `${pathPrefix}/${file.path}`,
                        mode: "overwrite",
                        mute: true,
                        contents: fileContents,
                    });
                }
            }
        }

        console.log(`Backup to ${pathPrefix} complete!`);

        if (!Platform.isMobile && this.dropboxBackupsRibbonIcon) {
            this.dropboxBackupsRibbonIcon.setAttribute(
                "aria-label",
                this.defaultAriaLabel + "\n" + `Last backup: ${pathPrefix}`
            );
        }
    }

    async setupAuth() {
        // @ts-ignore
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
            // @ts-ignore
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

        // @ts-ignore
        dropboxBackupsCodeVerifierStore = this.dbxAuth.getCodeVerifier();

        // This fails on mobile, probably because it is delayed:
        // window.open(authUrl)
        window.location.assign(authUrl);
    }

    async doAuth(params: any) {
        // @ts-ignore
        this.dbxAuth.setCodeVerifier(dropboxBackupsCodeVerifierStore);

        // @ts-ignore
        const accessTokenResponse = await this.dbxAuth.getAccessTokenFromCode(
            this.obsidianProtocolActionUrl,
            params.code
        );

        console.log(accessTokenResponse);

        const accessTokenResponseResult = accessTokenResponse?.result as accessTokenStore;
        this.dropboxBackupsTokenStore = accessTokenResponseResult;
        await this.app.vault.adapter.write(
            this.dropboxBackupsTokenStorePath,
            JSON.stringify(this.dropboxBackupsTokenStore)
        );

        // @ts-ignore
        this.dbxAuth.setAccessToken(accessTokenResponseResult?.access_token);

        // @ts-ignore
        this.dbx = new Dropbox({
            auth: this.dbxAuth,
        });

        await this.backup();
    }

    async doStoredAuth(): Promise<void> {
        if (!this.dbxAuth) {
            // @ts-ignore
            this.dbxAuth = new DropboxAuth({
                clientId: this.CLIENT_ID,
                accessToken: this.dropboxBackupsTokenStore.access_token,
                refreshToken: this.dropboxBackupsTokenStore.refresh_token,
            });
        }

        // @ts-ignore
        await this.dbxAuth.checkAndRefreshAccessToken();

        // @ts-ignore
        this.dbx = new Dropbox({
            auth: this.dbxAuth,
        });

        await this.backup();
    }

    async attemptAuth() {
        if (this.dropboxBackupsTokenStore) {
            console.log("Attempting stored auth ...");
            await this.doStoredAuth();
        } else {
            console.log("Attempting auth setup ...");
            await this.setupAuth();
        }
    }

    async attemptBackup() {
        try {
            await this.backup();
        } catch (ignore) {
            await this.attemptAuth();
        }
    }

    async onload(): Promise<void> {
        monkeyPatchConsole(this);
        console.log("Loading Dropbox Backups plugin ...");

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
            "popup-open",
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
                // Every 15 minutes:
                60000 * 15
            )
        );
    }

    onunload() {
        console.log("Unloading Dropbox Backups plugin ...");
    }
}
