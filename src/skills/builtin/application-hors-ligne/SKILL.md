---
name: application-hors-ligne
description: Makes a web application usable without an internet connection or with an unstable connection (service worker, cache, local storage, deferred synchronisation). To be used for classroom use, on the move, or in low-bandwidth areas.
---

# Offline application

1. **Do not load anything from a CDN** at runtime: fonts, icons and libraries are bundled into the project.
2. **Service worker** (`sw.js`): cache the application's files on first load ("cache first, network as fallback" strategy for files, "network first" for data), cache version number and cleanup of old caches.
3. **Manifest** (`manifest.webmanifest`) so the application can be "installed" on a tablet or computer.
4. **Data** stored locally (`localStorage` for small amounts of data, IndexedDB otherwise); if synchronisation exists, queue the uploads and replay them when the network comes back.
5. **Interface**: clear "hors ligne" indicator; no action should fail silently.
6. **Check**: load the page, cut the network (browser dev tools), reload: the application must display and work.
