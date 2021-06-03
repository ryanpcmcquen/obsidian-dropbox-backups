import { moment, Plugin } from "obsidian";
import { Dropbox, DropboxAuth, files } from "dropbox";

export default class DropboxBackups extends Plugin {
    dbx: Dropbox;
    dbxAuth: DropboxAuth;

    CLIENT_ID = "40ig42vaqj3762d";
    obsidianProtocol = "obsidian://";
    obsidianProtocolAction = "dropbox-backups-auth";
    obsidianProtocolActionUrl = `${this.obsidianProtocol}${this.obsidianProtocolAction}`;
    defaultAriaLabel = "Backup to Dropbox";

    dropboxBackupsRibbonIcon: HTMLElement;

    storedAccessTokenResponse: unknown = JSON.parse(
        localStorage.getItem("dropboxAccessTokenResponse")
    );

    vaultPath = this.app.vault.getName();

    async backup(): Promise<void> {
        const now = Date.now();

        const year = moment(new Date(now)).format("YYYY");
        const month = moment(new Date(now)).format("MM");
        const day = moment(new Date(now)).format("DD");
        const time = moment(new Date(now)).format("HH_mm_ss_SSS");

        const pathPrefix = `/${this.vaultPath}/${year}/${month}/${day}/${time}`;

        const backupAttemptLogMessage = `Attempting backup to: ${pathPrefix}`;
        console.log(backupAttemptLogMessage);
        if (this.dropboxBackupsRibbonIcon) {
            // @ts-ignore
            this.dropboxBackupsRibbonIcon.ariaLabel =
                this.defaultAriaLabel + "\n" + backupAttemptLogMessage;
        }

        // @ts-ignore
        for (let file of this.app.vault.getFiles()) {
            // @ts-ignore
            if (this.app.vault.exists(file.path)) {
                await this.dbx.filesUpload({
                    path: `${pathPrefix}/${file.path}`,
                    mode: ("overwrite" as unknown) as files.WriteMode,
                    mute: true,
                    // @ts-ignore
                    contents: file.contents,
                });
            }
        }

        console.log(`Backup to ${pathPrefix} complete!`);

        if (this.dropboxBackupsRibbonIcon) {
            // @ts-ignore
            this.dropboxBackupsRibbonIcon.ariaLabel =
                this.defaultAriaLabel + "\n" + `Last backup: ${pathPrefix}`;
        }
    }

    async setupAuth() {
        this.dbxAuth = new DropboxAuth({ clientId: this.CLIENT_ID });

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
        // @ts-ignore
        sessionStorage.setItem("codeVerifier", this.dbxAuth.codeVerifier);
        // @ts-ignore
        localStorage.setItem("codeVerifier", this.dbxAuth.codeVerifier);

        window.open(authUrl);
    }

    async doAuth(params: any) {
        this.dbxAuth.setCodeVerifier(
            sessionStorage.getItem("codeVerifier") ||
                localStorage.getItem("codeVerifier")
        );

        const accessTokenResponse = await this.dbxAuth.getAccessTokenFromCode(
            this.obsidianProtocolActionUrl,
            params.code
        );

        localStorage.setItem(
            "dropboxAccessTokenResponse",
            JSON.stringify(accessTokenResponse?.result)
        );

        this.dbxAuth.setAccessToken(
            // @ts-ignore
            accessTokenResponse.result.access_token
        );

        this.dbx = new Dropbox({
            auth: this.dbxAuth,
        });

        await this.backup();
    }

    async doStoredAuth(): Promise<void> {
        if (!this.dbxAuth) {
            this.dbxAuth = new DropboxAuth({
                clientId: this.CLIENT_ID,
                // @ts-ignore
                accessToken: this.storedAccessTokenResponse.access_token,
                // @ts-ignore
                refreshToken: this.storedAccessTokenResponse.refresh_token,
            });
        }

        // @ts-ignore
        await this.dbxAuth.checkAndRefreshAccessToken();

        this.dbx = new Dropbox({
            auth: this.dbxAuth,
        });

        await this.backup();
    }

    async attemptAuth() {
        if (this.storedAccessTokenResponse) {
            await this.doStoredAuth();
        } else {
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
        console.log("Loading Dropbox Backups plugin ...");

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
                await this.attemptBackup();
            }
        );

        this.attemptAuth();

        this.registerInterval(
            window.setInterval(
                async () => {
                    await this.attemptBackup();
                },
                // Every 10 minutes:
                60000 * 10
            )
        );
    }

    onunload() {
        console.log("Unloading Dropbox Backups plugin ...");
    }
}
