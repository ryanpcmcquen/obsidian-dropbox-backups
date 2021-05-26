## Obsidian Dropbox Backups

Automated backups to Dropbox of your entire vault every 10 minutes.

![Obsidian Dropbox Backups logo](256x256_obsidian-dropbox-backups.png)

Backups are stored here:

```
/Apps/Obsidian Backups/
```

Underneath that folder, backups get stored as:

```
/YEAR/MONTH/DAY/UNIX_EPOCH/VAULT_NAME
```

<img width="312" alt="Screen Shot 2021-05-26 at 7 50 56 AM" src="https://user-images.githubusercontent.com/772937/119681930-55dc3a00-bdf7-11eb-9389-800bbf1f6d0f.png">

### Usage

Click the icon to authenticate with Dropbox. After that, backups will happen every 10 minutes. You can also fire off a backup by clicking the ribbon icon.

### Manually installing the plugin

-   Copy over `main.js`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/obsidian-dropbox-backups/`.
