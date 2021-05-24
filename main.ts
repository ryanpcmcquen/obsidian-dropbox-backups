import { App, Modal, Plugin } from "obsidian";
import { Dropbox, DropboxAuth } from "dropbox";
import Bluebird from "bluebird";
// import { BrowserWindow } from "electron";

type file = { path: string; contents: string };

export default class DropboxBackups extends Plugin {
    dbx: Dropbox;
    dbxAuth: DropboxAuth;
    clientId = "40ig42vaqj3762d";

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

        return authUrl;
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

        this.dbxAuth.setAccessToken(
            // @ts-ignore
            accessTokenResponse.result.access_token
        );

        this.dbx = new Dropbox({
            auth: this.dbxAuth,
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

        const authUrl = await this.setupAuth();
        // const authFetch = await fetch(
        //     `https://api.allorigins.win/raw?url=${encodeURIComponent(
        //         authUrl
        //     )}` as RequestInfo
        // );
        if (authUrl) {
            // const { BrowserWindow, ipcMain } = remote;
            // @ts-ignore
            new DropboxModal(this.app, authUrl).open();
            // this.app.vault.adapter.shell.openExternal(authUrl);
            // const browserWindow = new BrowserWindow({
            //     width: 1000,
            //     height: 600,
            //     webPreferences: {
            //         webSecurity: false,
            //         nodeIntegration: true,
            //         images: true,
            //     },
            //     show: true,
            // });
            // browserWindow.loadURL(authUrl);
            // browserWindow.open();
            // console.log(authFetch.text());
            // const newElement = document.createElement("div");
            // newElement.innerHTML = htmlText;
            // fetchModal.contentEl = newElement;
            // const htmlText = await authFetch.text();
            // const doc = new DOMParser().parseFromString(htmlText, "text/html");
            // const fetchModal = new DropboxModal(
            // this.app,
            // `<iframe style="height: 50vh; width: 50vw;" src="${authUrl}"></iframe>`
            // );
            // fetchModal.open();
        } else {
            window.location.assign(authUrl);
        }
        this.addRibbonIcon("popup-open", "Backup to Dropbox", async () => {
            try {
                await this.backup();
            } catch (ignore) {
                await this.setupAuth();
                // await this.doAuth();
            }
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

const createIframeContainerEl = (
    contentEl: HTMLElement,
    url: string
): HTMLElement => {
    const iframeContainer = contentEl.createEl("div");
    iframeContainer.style.setProperty("--width", "100%");
    iframeContainer.style.position = "relative";
    iframeContainer.style.width = "100%";
    // iframeContainer.style.paddingBottom = defaultHeightValue;
    // Overflow cannot be set to "visible" (default) when using resize
    iframeContainer.style.overflow = "auto";
    iframeContainer.style.resize = "vertical";

    const iframe = iframeContainer.createEl("iframe");
    iframe.src = url;
    iframe.style.position = "absolute";
    iframe.style.height = "100%";
    iframe.style.width = "100%";

    return iframeContainer;
};

class DropboxModal extends Modal {
    url: string;
    sucess: boolean;
    generatedIframe: string;
    editor: any;

    constructor(app: App, url: string, editor: any) {
        super(app);
        this.url = url;
        this.editor = editor;
    }

    onOpen() {
        let { contentEl } = this;

        const container = contentEl.createEl("div");
        container.className = "iframe__container";

        // const title = contentEl.createEl("h2");
        // title.innerText =
        // "This is how the iframe is going to look (your can choose the size)";

        const iframeContainer = createIframeContainerEl(contentEl, this.url);
        // const widthCheckbox = createShouldUseDefaultWidthCheckbox(
        //     iframeContainer
        // );
        // const heightInput = createHeightInput(iframeContainer);

        const okButton = contentEl.createEl("button");
        okButton.setText("OK");
        okButton.className = "mod-warning";
        okButton.onclick = (e) => {
            e.preventDefault();

            const generatedIframe = iframeContainer.outerHTML;
            this.editor.replaceSelection(generatedIframe);
            this.close();
        };

        const cancelButton = contentEl.createEl("button");
        cancelButton.setText("Cancel");
        cancelButton.onclick = (e) => {
            e.preventDefault();
            this.close();
        };

        const buttonContainer = contentEl.createEl("div");
        buttonContainer.className = "button__container";
        // buttonContainer.appendChild(okButton);
        // buttonContainer.appendChild(cancelButton);

        // container.appendChild(title);
        // container.appendChild(widthCheckbox);
        // container.appendChild(heightInput);
        container.appendChild(iframeContainer);
        container.appendChild(buttonContainer);
        contentEl.appendChild(container);
    }

    onClose() {
        let { contentEl } = this;
        contentEl.empty();
    }
}
