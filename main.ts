import { moment, Plugin } from "obsidian";
import { Dropbox, DropboxAuth, files } from "dropbox";
import Bluebird from "bluebird";

type file = { path: string; contents: string };

export default class DropboxBackups extends Plugin {
    dbx: Dropbox;
    dbxAuth: DropboxAuth;
    CLIENT_ID = "40ig42vaqj3762d";

    storedAccessTokenResponse: unknown = JSON.parse(
        localStorage.getItem("dropboxAccessTokenResponse")
    );

    lastBackup: string;

    allFiles: file[];

    async getAllFiles() {
        const vaultPath = this.app.vault.getName();
        this.allFiles = await Promise.all(
            this.app.vault.getFiles().map(async (tfile) => {
                const fileContents = await this.app.vault.read(tfile);
                return {
                    path: `${vaultPath}/${tfile.path}`,
                    contents: fileContents,
                };
            })
        );
    }

    async backup(): Promise<void> {
        await this.getAllFiles();
        if (this.allFiles && this.allFiles.length > 0) {
            const now = Date.now();

            const year = moment(new Date(now)).format("YYYY");
            const month = moment(new Date(now)).format("MM");
            const day = moment(new Date(now)).format("DD");
            const time = moment(new Date(now)).format("HH_mm_ss_SSS");

            const pathPrefix = `/${year}/${month}/${day}/${time}`;
            console.log(`Backing up to: ${pathPrefix}`);

            await Bluebird.map(
                this.allFiles,
                async (file: file) => {
                    return await this.dbx.filesUpload({
                        path: `${pathPrefix}/${file.path}`,
                        mode: ("overwrite" as unknown) as files.WriteMode,
                        mute: true,
                        contents: file.contents,
                    });
                },
                { concurrency: 1 }
            );

            console.log(`Backup to ${pathPrefix} complete!`);
            this.lastBackup = moment(new Date(now)).format(
                "YYYY.MM.DD, HH:mm:ss"
            );

            // @ts-ignore
            const dropboxBackupsRibbonIcon = this.app.workspace.leftRibbon.ribbonActionsEl.querySelector(
                "[aria-label^='Backup to Dropbox']"
            );

            if (dropboxBackupsRibbonIcon) {
                dropboxBackupsRibbonIcon.ariaLabel =
                    "Backup to Dropbox\n" + `Last backup: ${this.lastBackup}`;
            }
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
                "obsidian://dropbox-backups-auth",
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
            "obsidian://dropbox-backups-auth",
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
            "dropbox-backups-auth",
            async (params) => {
                await this.doAuth(params);
            }
        );

        this.addRibbonIcon("popup-open", "Backup to Dropbox", async () => {
            await this.attemptBackup();
        });

        await this.attemptAuth();

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
