# The PAIN Engine on iPhone

This package is an installable iOS web app/PWA.

## Install

1. Upload this folder's contents to GitHub Pages. The app now works from either a root site such as `https://YOUR_NAME.github.io/` or a project site such as `https://YOUR_NAME.github.io/REPO_NAME/`.
2. Open the exact GitHub Pages URL in Safari on the iPhone.
3. Tap Share.
4. Tap Add to Home Screen.
5. Open PAIN Engine from the home screen.

## Notes

- Local/offline data is stored on the device.
- Cloud sync works when the app is run with a real Firebase config through Sync Settings.
- A signed native IPA requires Apple Developer signing and Xcode, which cannot be produced from this Windows/offline runner.

## If you see a startup error

Make sure the GitHub repo contains the app files directly in the published folder:

- `index.html`
- `manifest.webmanifest`
- `sw.js`
- `.nojekyll`
- `icons/`
- `src/`
- `vendor/`

Do not upload the ZIP itself as the website, and do not leave the app files buried inside an extra folder unless that folder is the URL you are opening.
