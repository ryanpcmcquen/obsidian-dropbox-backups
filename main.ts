import { moment, Plugin } from "obsidian";
import { Dropbox, DropboxAuth, DropboxResponse, files } from "dropbox";

type accessTokenResponseResultType = {
    access_token: string;
    refresh_token: string;
};

export default class DropboxBackups extends Plugin {
    dbx: Dropbox;
    dbxAuth: DropboxAuth;

    CLIENT_ID = "40ig42vaqj3762d";
    obsidianProtocol = "obsidian://";
    obsidianProtocolAction = "dropbox-backups-auth";
    obsidianProtocolActionUrl = `${this.obsidianProtocol}${this.obsidianProtocolAction}`;
    defaultAriaLabel = "Backup to Dropbox";

    dropboxBackupsRibbonIcon: HTMLElement;

    storedAccessTokenResponse: DropboxResponse<accessTokenResponseResultType>["result"] = JSON.parse(
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

                    await this.dbx.filesUpload({
                        path: `${pathPrefix}/${file.path}`,
                        mode: ("overwrite" as unknown) as files.WriteMode,
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

        sessionStorage.setItem("codeVerifier", this.dbxAuth.getCodeVerifier());
        localStorage.setItem("codeVerifier", this.dbxAuth.getCodeVerifier());

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

        const accessTokenResponseResult = accessTokenResponse?.result as accessTokenResponseResultType;

        localStorage.setItem(
            "dropboxAccessTokenResponse",
            JSON.stringify(accessTokenResponseResult)
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
                accessToken: this.storedAccessTokenResponse.access_token,
                refreshToken: this.storedAccessTokenResponse.refresh_token,
            });
        }

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
