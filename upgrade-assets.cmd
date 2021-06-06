curl https://cdn.jsdelivr.net/npm/dropbox@9/dist/Dropbox-sdk.js -o assets/Dropbox-sdk.js

sed -i.bak "s/require('node-fetch')/fetch/g" assets/Dropbox-sdk.js
sed -i.bak "s/require('crypto')/crypto/g" assets/Dropbox-sdk.js
sed -i.bak "s/require('util').//g" assets/Dropbox-sdk.js
sed -i.bak "s/exports.Dropbox = Dropbox;/window.Dropbox = Dropbox;/g" assets/Dropbox-sdk.js
sed -i.bak "s/exports.DropboxAuth = DropboxAuth;/window.DropboxAuth = DropboxAuth;/g" assets/Dropbox-sdk.js

rm assets/Dropbox-sdk.js.bak

curl https://cdn.jsdelivr.net/npm/dropbox@9/types/index.d.ts -o assets/Dropbox-sdk.d.ts
