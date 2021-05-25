import { Plugin } from "obsidian";
import { Dropbox, DropboxAuth } from "dropbox";
import Bluebird from "bluebird";

type file = { path: string; contents: string };

export default class DropboxBackups extends Plugin {
    dbx: Dropbox;
    dbxAuth: DropboxAuth;
    clientId = "40ig42vaqj3762d";

    accessTokenResponse: unknown = JSON.parse(
        localStorage.getItem("dropboxAccessTokenResponse")
    );

    lastBackup: Date;

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
            // Add 1 because no one thinks of January as 0.
            const month = new Date(now).getMonth() + 1;
            const year = new Date(now).getFullYear();
            const pathPrefix = `/${year}/${month}/${now}`;
            console.log(`Backing up to: ${pathPrefix}`);

            await Bluebird.map(
                this.allFiles,
                async (file: file) => {
                    return await this.dbx.filesUpload({
                        path: `${pathPrefix}/${file.path}`,
                        // @ts-ignore
                        mode: "overwrite",
                        mute: true,
                        contents: file.contents,
                    });
                },
                { concurrency: 1 }
            );
            console.log(`Backup to ${pathPrefix} complete!`);
            this.lastBackup = new Date(now);
            // @ts-ignore
            this.app.workspace.leftRibbon.ribbonActionsEl.querySelector(
                "[aria-label^='Backup to Dropbox']"
            ).ariaLabel =
                "Backup to Dropbox\n" + `Last backup: ${this.lastBackup}`;
        }
    }

    async setupAuth() {
        this.dbxAuth = new DropboxAuth();
        this.dbxAuth.setClientId(this.clientId);

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

        window.location.assign(authUrl);
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

    async doStoredAuth() {
        this.dbx = new Dropbox({
            // @ts-ignore
            accessToken: this.accessTokenResponse.access_token,
            // @ts-ignore
            refreshToken: this.accessTokenResponse.refresh_token,
        });
        await this.backup();
    }

    async onload(): Promise<void> {
        console.log("Loading Dropbox Backups plugin ...");

        this.registerObsidianProtocolHandler(
            "dropbox-backups-auth",
            async (params) => {
                await this.doAuth(params);
            }
        );

        if (this.accessTokenResponse) {
            await this.doStoredAuth();
        } else {
            await this.setupAuth();
        }

        this.addRibbonIcon("popup-open", "Backup to Dropbox", async () => {
            try {
                await this.backup();
            } catch (ignore) {
                await this.setupAuth();
            }
        });

        this.registerInterval(
            window.setInterval(
                async () => {
                    await this.backup();
                },
                // Every 10 minutes:
                60000 * 10
            )
        );

        await this.backup();
    }

    onunload() {
        console.log("Unloading Dropbox Backups plugin ...");
    }
}
