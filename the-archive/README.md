# The Archive · Wardrobe Intelligence v11

A mobile-first wardrobe operating system for GitHub Pages / Android PWA use.

## Live app

https://butterfish1918-stack.github.io/butterfish1918.github.io/the-archive/

## v11 capabilities

- Today screen with weather-aware, occasion-aware outfit selection
- Garment inventory with camera/photo capture, palette extraction and studio cutout helper
- Visual closet and outfit builder
- Adaptive preference learning from likes/dislikes
- Wear history, advanced rotation, cost-per-wear and wardrobe-value analytics
- Laundry and care thresholds, maintenance tasks and repair/cleaning states
- Internal planner plus `.ics` import/export for calendar interoperability
- Travel capsules and packing tracking
- Purchase simulation and wardrobe-gap scoring
- Style DNA based on what is actually worn/rated
- Archetype 2.0 rulesets
- Perfume rotation, layering, incense/bakhoor pairing and outfit/weather recommendations
- First-class accessories (watches, belts, ties, bags, jewellery, glasses, etc.)
- Lookbook PNG export from saved or in-progress outfits
- Full JSON backup/restore and legacy TSV/CSV imports
- Local-first storage with optional Firebase cross-device sync

## Existing data

v11 deliberately retains the existing `archive:v9:<app-id>:<collection>` local-storage namespace. Existing v9/v10 garment, outfit, perfume, archetype and wear data therefore remains available after the upgrade.

## Cross-device sync

The app works without an account. For PC ↔ Android synchronization, open **Sync** and paste a Firebase Web App config. The setup UI creates a high-entropy `archiveVault` namespace and stores the config only in that browser. Paste the same resulting config on the other device to join the same vault.

Firebase project requirements:

1. Enable **Anonymous Authentication**.
2. Create **Cloud Firestore**.
3. Configure Firestore rules appropriate for your personal project.

The storage adapter mirrors cloud snapshots back into local storage and merges pre-existing local records into the cloud when the connection is first enabled.

## Weather

Weather uses Open-Meteo from the browser. The user can either grant browser geolocation permission or search/select a city manually. No location is required for the rest of the app.

## Calendar

Because this is a static GitHub Pages app without Google/Microsoft OAuth credentials, v11 implements portable calendar integration via `.ics` import/export rather than direct Google Calendar or Outlook account access.

## Android

Open the live URL in Chrome and choose **Install app** / **Add to Home screen**. The service worker caches the v11 application shell and runtime assets for repeat/offline use.
