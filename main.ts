import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { Dropbox } from "dropbox";

// interface MyPluginSettings {
//  mySetting: string;
// }

// const DEFAULT_SETTINGS: MyPluginSettings = {
//  mySetting: "default",
// };

export default class DropboxBackups extends Plugin {
    // settings: MyPluginSettings;

    async onload() {
        console.log("loading plugin");

        // await this.loadSettings();

        this.addRibbonIcon("dice", "Backup to Dropbox", async () => {
            const vaultPath = this.app.vault.getName();
            const start = performance.now();
            const allFiles = await Promise.all(
                this.app.vault.getFiles().map(async (tfile) => {
                    const fileContents = await this.app.vault.read(tfile);
                    return {
                        path: `${vaultPath}/${tfile.path}`,
                        contents: fileContents,
                    };
                })
            );
            console.log(allFiles);
            console.log(performance.now() - start);

            console.log(Dropbox);
        });

        // this.addSettingTab(new SampleSettingTab(this.app, this));

        // this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
    }

    onunload() {
        console.log("unloading plugin");
    }

    // async loadSettings() {
    //  this.settings = Object.assign(
    //      {},
    //      DEFAULT_SETTINGS,
    //      await this.loadData()
    //  );
    // }

    // async saveSettings() {
    //  await this.saveData(this.settings);
    // }
}

// class SampleModal extends Modal {
//  constructor(app: App) {
//      super(app);
//  }

//  onOpen() {
//      let { contentEl } = this;
//      contentEl.setText("Woah!");
//  }

//  onClose() {
//      let { contentEl } = this;
//      contentEl.empty();
//  }
// }

// class SampleSettingTab extends PluginSettingTab {
//     plugin: MyPlugin;

//     constructor(app: App, plugin: MyPlugin) {
//         super(app, plugin);
//         this.plugin = plugin;
//     }

//     display(): void {
//         let { containerEl } = this;

//         containerEl.empty();

//         containerEl.createEl("h2", { text: "Settings for my awesome plugin." });

//         new Setting(containerEl)
//             .setName("Setting #1")
//             .setDesc("It's a secret")
//             .addText((text) =>
//                 text
//                     .setPlaceholder("Enter your secret")
//                     .setValue("")
//                     .onChange(async (value) => {
//                         console.log("Secret: " + value);
//                         this.plugin.settings.mySetting = value;
//                         await this.plugin.saveSettings();
//                     })
//             );
//     }
// }
