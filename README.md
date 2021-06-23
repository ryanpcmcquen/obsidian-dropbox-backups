## Obsidian Dropbox Backups

Automated backups to Dropbox of your entire vault every 20 minutes.

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

### Usage

Click the icon to authenticate with Dropbox. After that, backups will happen every 20 minutes. You can also fire off a backup at any time by clicking the ribbon icon.

The slashed cloud indicates that you need to authenticate with Dropbox:

<img width="222" alt="Screen Shot 2021-06-07 at 9 57 49 AM" src="https://user-images.githubusercontent.com/772937/121060384-68e7f600-c777-11eb-98df-093799e28eca.png">

The large arrow indicates the the upload has started:

<img width="353" alt="Screen Shot 2021-06-07 at 9 58 19 AM" src="https://user-images.githubusercontent.com/772937/121060390-6ab1b980-c777-11eb-8663-86d53f6ad893.png">

The small arrow inside the cloud indicates the upload is about 50% done:

<img width="362" alt="Screen Shot 2021-06-07 at 9 57 59 AM" src="https://user-images.githubusercontent.com/772937/121060385-69808c80-c777-11eb-9251-e6e2a92ddb72.png">

The cloud with a check mark indicates that the backup is complete!

<img width="351" alt="Screen Shot 2021-06-07 at 9 58 13 AM" src="https://user-images.githubusercontent.com/772937/121060387-6a192300-c777-11eb-83de-a6c71c8b71af.png">

Demo:

![Demo](https://github.com/ryanpcmcquen/obsidian-dropbox-backups/raw/master/obsidian-dropbox-backups-demo-v2.gif)

### Settings

A setting is available to 'Exclude binary files', this will skip any file without one of the following extensions:

-   md
-   org
-   txt

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
