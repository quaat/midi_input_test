# MIDI Input Lab

A browser MIDI input monitor with device selection, note visualization, velocity,
channels, and a live log of decoded messages and raw bytes. Includes a simulated
demo for exploring the interface without a controller. No runtime dependencies,
external assets, accounts, or uploads. It monitors input and does not generate audio.

## Develop

Use Node.js 24 (see `.nvmrc`).

```sh
npm ci
npm run dev
```

The development server uses port 4173. Open it locally in a browser supporting
Web MIDI, such as Chrome or Edge. MIDI requires HTTPS or localhost. Click
**Connect MIDI**, allow access, then select your input. Devices attached after
permission is granted appear automatically. System-exclusive access is not requested.

## Validate and build

```sh
npm test
npm run build
npm run test:browser
npm run preview
```

Browser tests use `/usr/bin/chromium` when available. Otherwise install the matching
browser with `npx playwright install --with-deps chromium`, or set `CHROMIUM_PATH`
to an installed Chromium executable. Browser tests start their own preview server,
so leave port 4173 free. The build must run before browser tests.

The static build is in `dist/`. Tests exercise the `/midi_input_test/` project
prefix, MIDI messages through a simulated device, permission errors, hot plugging,
device filtering, the demo, and mobile layout. Real hardware requires a MIDI device
connected to the browser's machine; it cannot be verified by cloud CI.

## GitHub Pages

In this repository's **Settings → Pages → Build and deployment**, set **Source**
to **GitHub Actions**. Commit and push these files to `main` (or merge a pull request).

The Pages workflow tests and builds every pull request to `main` and every push to
`main`. Successful `main` builds deploy `dist/` to GitHub Pages. Pull requests only
validate; manual runs on `main` also deploy. A failed test or build blocks deployment.
The workflow uses GitHub's built-in token; no personal access token is needed.

The expected site address after the first successful deployment is
`https://quaat.github.io/midi_input_test/` (unless a custom domain is configured).
Application assets use relative paths so they work under the repository prefix.
GitHub Pages must be available for the repository's visibility and account plan.
