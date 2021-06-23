curl "https://cdn.skypack.dev$(curl https://cdn.skypack.dev/dropbox | grep -o '/-/dropbox.*dropbox.js' | tail -1)" -o assets/Dropbox-sdk.js
curl https://cdn.jsdelivr.net/npm/dropbox/types/dropbox_types.d.ts -o assets/dropbox_types.d.ts
curl https://cdn.jsdelivr.net/npm/dropbox/types/index.d.ts -o assets/Dropbox-sdk.d.ts
