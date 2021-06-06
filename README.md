## Obsidian Dropbox Backups

Automated backups to Dropbox of your entire vault every 15 minutes.

![Obsidian Dropbox Backups logo](256x256_obsidian-dropbox-backups.png)

Backups are stored here:

```
/Apps/Obsidian Backups/
```

Underneath that folder, backups get stored as:

```
/VAULT_NAME/YEAR/MONTH/DAY/TIME_WITH_FRACTIONAL_SECONDS/VAULT_CONTENTS
```

We use fractional seconds to prevent collisions with ad hoc backups.

<img width="355" alt="Screen Shot 2021-06-02 at 10 44 08 AM" src="https://user-images.githubusercontent.com/772937/120528074-e387ce80-c38f-11eb-97ac-72a4007fa8d7.png">
<img width="365" alt="Screen Shot 2021-06-02 at 10 44 15 AM" src="https://user-images.githubusercontent.com/772937/120528075-e4b8fb80-c38f-11eb-9be9-8b335e2ab84a.png">

### Usage

Click the icon to authenticate with Dropbox. After that, backups will happen every 15 minutes. You can also fire off a backup at any time by clicking the ribbon icon.

### Dropbox permissions

This app requires the following Dropbox permissions:
![IMG_5695](https://user-images.githubusercontent.com/772937/119743485-dbcfa380-be3e-11eb-9872-ffae4c4fa02c.png)

-   `account_info.read`: You can't turn this one off, I don't think I actually need it. You can see in the source code that I don't read anything from it.
-   `files.metadata.read`: You can't turn this one off either. I never read or list files, so it shouldn't be necessary, but Dropbox doesn't allow turning it off.
-   `files.content.write`: This is the one I actually need. This app only writes files. This app cannot read files. It is also scoped to only its folder.

### Known limitations

Any files not in this list:

-   `md`
-   `org`
-   `txt`

Are _assumed_ to be binary files, and read/uploaded as such. Please let me know if more files need to be added to this list that are actually plain text.

### Manually installing the plugin

-   Copy over `main.js`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/obsidian-dropbox-backups/`.
