import { moment, Plugin } from "obsidian";
import "./assets/Dropbox-sdk.js";
declare var Dropbox: unknown;
declare var DropboxAuth: unknown;

type accessTokenResponseResultType = {
    access_token: string;
    refresh_token: string;
};

export default class DropboxBackups extends Plugin {
    dbx: unknown;
    dbxAuth: unknown;

    CLIENT_ID = "40ig42vaqj3762d";
    obsidianProtocol = "obsidian://";
    obsidianProtocolAction = "dropbox-backups-auth";
    obsidianProtocolActionUrl = `${this.obsidianProtocol}${this.obsidianProtocolAction}`;
    defaultAriaLabel = "Backup to Dropbox";

    dropboxBackupsRibbonIcon: HTMLElement;

    storedAccessTokenResponse: accessTokenResponseResultType = JSON.parse(
        localStorage.getItem("dropboxAccessTokenResponse")
    );

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
        if (this.dropboxBackupsRibbonIcon) {
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
                        ? await this.app.vault.readBinary(file)
                        : await this.app.vault.read(file);

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

        if (this.dropboxBackupsRibbonIcon) {
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
        sessionStorage.setItem("codeVerifier", this.dbxAuth.getCodeVerifier());
        // @ts-ignore
        localStorage.setItem("codeVerifier", this.dbxAuth.getCodeVerifier());

        window.open(authUrl);
    }

    async doAuth(params: any) {
        // @ts-ignore
        this.dbxAuth.setCodeVerifier(
            sessionStorage.getItem("codeVerifier") ||
                localStorage.getItem("codeVerifier")
        );

        // @ts-ignore
        const accessTokenResponse = await this.dbxAuth.getAccessTokenFromCode(
            this.obsidianProtocolActionUrl,
            params.code
        );

        const accessTokenResponseResult = accessTokenResponse?.result as accessTokenResponseResultType;

        localStorage.setItem(
            "dropboxAccessTokenResponse",
            JSON.stringify(accessTokenResponseResult)
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
                accessToken: this.storedAccessTokenResponse.access_token,
                refreshToken: this.storedAccessTokenResponse.refresh_token,
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
