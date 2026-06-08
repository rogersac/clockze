# World Clocks

A lightweight static world clocks web app built for GitHub Pages.

It uses:

- `HTML`
- `CSS`
- Vanilla `JavaScript`

It does not use:

- React, Vue, Angular
- TypeScript
- npm
- bundlers
- backend services

## Features

- Row-based world clock layout
- Dark theme optimized for iPad and older Safari
- 12-hour / 24-hour time support
- Optional seconds display
- Optional date display
- Optional location details display
- Optional time zone details display
- Optional weather column visibility
- Per-second clock updates using `Intl.DateTimeFormat`
- Geolocation-based default clock when available
- Nashville fallback when geolocation is unavailable
- City search using the Open-Meteo Geocoding API
- Saved clocks stored in `localStorage`
- Reset support
- Touch-friendly swipe-to-delete behavior on phones and iPads

## Files

- `index.html`:
  Main page markup, modal dialogs, and clock row template.
- `styles.css`:
  App styling, responsive layout, modal styles, and touch swipe UI.
- `app.js`:
  Clock rendering, storage, settings, geolocation, search, and swipe logic.

## APIs

This app uses:

- Open-Meteo Geocoding API for city search
- OpenStreetMap Nominatim reverse geocoding for current city naming
- Browser `Intl` APIs for time zone-aware date/time formatting
- Browser `localStorage` for settings and saved clocks

No API keys are required.

## Running Locally

Because this is a static app, you can open `index.html` directly in a browser.

For best results, especially with geolocation and remote API calls, serve it from a local web server. For example:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## GitHub Pages Deployment

1. Push `index.html`, `styles.css`, `app.js`, and `README.md` to your repository.
2. Open the repository on GitHub.
3. Go to `Settings` > `Pages`.
4. Under `Build and deployment`, choose `Deploy from a branch`.
5. Select your branch, usually `main`.
6. Select the `/(root)` folder.
7. Save the settings and wait for GitHub Pages to publish the site.

## Notes

- Settings are remembered in `localStorage`.
- Saved clocks are remembered in `localStorage`.
- Current weather, daily condition, and high/low use the Open-Meteo Forecast API when enabled.
- Older Safari support is a design goal, so the JavaScript avoids modules, `async/await`, optional chaining, and similar newer syntax.
- A browser tab cannot force fullscreen automatically. On iPad and iPhone, use `Add to Home Screen` to launch the app in standalone fullscreen mode.
