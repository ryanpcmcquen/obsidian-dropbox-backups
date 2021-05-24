import { Plugin } from "obsidian";
import { Dropbox, DropboxAuth } from "dropbox";
import Bluebird from "bluebird";

type file = { path: string; contents: string };

export default class DropboxBackups extends Plugin {
    dbx: Dropbox;
    dbxAuth: DropboxAuth;
    clientId = "40ig42vaqj3762d";

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

            console.log(`Backing up at ${now} ...`);

            await Bluebird.map(
                this.allFiles,
                async (file: file) => {
                    return await this.dbx.filesUpload({
                        path: `/${year}/${month}/${now}/${file.path}`,
                        // @ts-ignore
                        mode: "overwrite",
                        mute: true,
                        contents: file.contents,
                    });
                },
                { concurrency: 1 }
            );
        }
    }

    async onload(): Promise<void> {
        console.log("Loading Dropbox Backups plugin ...");

        this.registerObsidianProtocolHandler(
            "dropbox-backups-auth",
            async (params) => {
                this.dbxAuth.setCodeVerifier(
                    sessionStorage.getItem("codeVerifier") ||
                        localStorage.getItem("codeVerifier")
                );

                const accessTokenResponse = await this.dbxAuth.getAccessTokenFromCode(
                    "obsidian://dropbox-backups-auth",
                    params.code
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
        );

        this.addRibbonIcon("dice", "Backup to Dropbox", async () => {
            this.dbxAuth = new DropboxAuth();
            this.dbxAuth.setClientId(this.clientId);
            const authUrl = await this.dbxAuth.getAuthenticationUrl(
                "obsidian://dropbox-backups-auth",
                undefined,
                "code",
                "offline",
                undefined,
                undefined,
                true
            );
            // @ts-ignore
            sessionStorage.setItem("codeVerifier", this.dbxAuth.codeVerifier);
            // @ts-ignore
            localStorage.setItem("codeVerifier", this.dbxAuth.codeVerifier);

            window.location.assign(String(authUrl));
        });

        this.registerInterval(
            window.setInterval(async () => {
                await this.backup();
            }, 60000 * 10)
        );

        await this.backup();
    }

    onunload() {
        console.log("Unloading Dropbox Backups plugin ...");
    }
}
