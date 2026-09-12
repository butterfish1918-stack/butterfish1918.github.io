# Clinical Pitch Synthesiser

Mobile-ready PWA packaging of the Clinical Pitch Synthesiser React application.

## Android

Open the GitHub Pages URL in Chrome, grant microphone access when requested, then use Chrome's **Install app** / **Add to Home screen** action. The installed version opens in standalone app mode.

## Feature preservation

The original React application logic is retained across the `app-*.part` source files, apart from the browser-global bootstrap needed for static GitHub Pages deployment and a mobile-compatible MediaRecorder MIME negotiation fallback.

This preserves the scale and tuning systems, free note sequences, synthesised playback, room calibration, microphone capture, live pitch tracking, monitoring, Lombard and Void protocols, recorded-audio comparison, clinical telemetry, phase-space visualisation, session history and grading.

The mobile packaging adds responsive/touch defaults, Android-safe viewport and safe-area handling, an installable web-app manifest, launcher icons, and a service worker for app-shell/runtime caching.
