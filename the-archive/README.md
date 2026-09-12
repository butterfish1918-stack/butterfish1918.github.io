# The Archive · Wardrobe OS v10

Mobile/PWA wardrobe management system for GitHub Pages and Android.

## Live app

`https://butterfish1918-stack.github.io/butterfish1918.github.io/the-archive/`

## v10 features

- Individual garment inventory with compressed photos, colour, material, size, season, status, price, fit/tailoring and care records
- Visual outfit builder with compatibility scoring and perfume suggestion
- Saved outfits linked to real garment IDs while retaining legacy imported outfit support
- Wear history, ratings, automatic cost-per-wear and wardrobe rotation analysis
- Laundry / worn / dry-clean / repair / stored availability states
- Outfit calendar / planner
- "What should I wear?" generator based on season, occasion, weather tags, archetype and availability
- Wardrobe-gap and maintenance intelligence
- Wishlist / acquisition queue with category gap score
- Capsule / packing combination estimator
- Full collection export plus complete JSON backup / restore
- Existing perfume, archetype, hairstyle and TSV/CSV import compatibility
- Installable Android PWA

## Storage

By default the app uses private on-device browser storage and keeps the existing v9 storage namespace, so previously imported Archive data remains available after upgrading.

For cross-device cloud sync, add a Firebase Web App configuration to `config.js`, enable Anonymous Authentication, and configure Firestore security rules.
