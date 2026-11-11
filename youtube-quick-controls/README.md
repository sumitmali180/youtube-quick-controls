# YouTube Quick Controls

A lightweight **Manifest V3 Chrome Extension** that adds compact, native-styled **Playback Speed** (`[ 1.0x ▼ ]`) and **Video Quality** (`[ 1080p ▼ ]`) dropdown pills directly **above YouTube's Like button** on normal watch pages, in **fullscreen mode**, and on **YouTube Shorts** — eliminating nested gear-menu clicks without intercepting network streams or modifying native YouTube buttons.

---

## Features

- **Directly Above the Like Button:** Anchors cleanly above YouTube's action bar aligned with the Like button, adapting automatically to horizontal or wrapped action layouts.
- **Instant Playback Speed Control:**
  - Standard presets: `0.25x`, `0.5x`, `0.75x`, `1.0x`, `1.25x`, `1.5x`, `1.75x`, `2.0x`, `2.25x`, `2.5x`, `3.0x`.
  - Automatically merges custom speeds exposed by YouTube (`getAvailablePlaybackRates()`) plus an inline custom speed input (`0.1x`–`16.0x`).
  - Applies immediately via `video.playbackRate` without pausing, seeking, or restarting playback.
  - Stays bidirectionally synced when speed is changed via YouTube shortcuts (`Shift+>` / `Shift+<`) or native controls.
- **Dynamic Video Quality Control:**
  - Queries only resolutions actually available for the current video (`144p` through `2160p (4K)` + `4320p (8K)` if present, and `Auto` when supported).
  - Never lists unplayable or unavailable resolutions.
  - Verifies quality switches with YouTube's player API before updating the badge; if YouTube cannot apply a resolution, keeps the previous quality visible, displays a subtle warning tooltip (`⚠`), and falls back cleanly.
  - Handles still-loading video manifests and live quality transitions.
- **Fullscreen Support (Critical Mode):**
  - Renders inside `document.fullscreenElement` so controls remain visible in Chrome's Fullscreen Top Layer.
  - Places controls directly above the fullscreen Like button in modern YouTube fullscreen layouts (`.ytp-fullscreen-quick-actions`), with a non-overlapping overlay fallback above `.ytp-chrome-bottom` in classic layouts.
  - Prevents click-through pause/play, hotkey leakage (`Space` / arrows), menu clipping, and idle auto-hide while interacting with dropdowns.
- **YouTube SPA & Shorts Support:**
  - Tracks `yt-navigate-start`, `yt-navigate-finish`, `yt-page-data-updated`, `popstate`, active Shorts reel attributes (`ytd-reel-video-renderer[is-active]`), and DOM mutations with debouncing and `AbortController` teardown to prevent duplicate buttons or leaks.
- **Dark & Light Theme Adaptation + Persistent Settings:**
  - Follows YouTube's live `html[dark]` / `ytd-app[dark]` theme tokens automatically.
  - Extension popup (`popup.html`) lets you toggle quick controls, configure default speed & quality, and enable/disable auto-apply on new videos using `chrome.storage.sync` (with automatic `chrome.storage.local` fallback).

---

## Folder Structure

```text
youtube-quick-controls/
├── manifest.json       # MV3 configuration & dual-world content script registration
├── page-bridge.js      # MAIN-world YouTube player API RPC bridge
├── content.js          # ISOLATED-world UI injection, speed/quality logic & SPA router
├── styles.css          # Native pill/dropdown styles, Light/Dark theme & fullscreen rules
├── background.js       # MV3 service worker seeding default settings
├── popup.html          # Extension settings popup markup
├── popup.css           # Adaptive Light/Dark popup styles
├── popup.js            # Popup storage controller
├── icons/              # Extension icons (16x16, 48x48, 128x128 PNG)
└── README.md           # Extension documentation
```

---

## Installation (Load Unpacked in Chrome)

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click **Load unpacked**.
4. Select the **`youtube-quick-controls/`** folder directly (the folder containing `manifest.json`).
5. Pin **YouTube Quick Controls** from Chrome's Extensions toolbar menu (optional) to configure defaults via the popup.
6. Open or refresh any YouTube watch video or Short (`https://www.youtube.com/watch?v=...` or `https://www.youtube.com/shorts/...`).

---

## How Fullscreen Injection Works

When a web page enters fullscreen via the Fullscreen API, Chrome promotes `document.fullscreenElement` (typically `#movie_player` or `ytd-watch-flexy`) into the browser's **Top Layer**. Any element left outside `document.fullscreenElement` — including the normal watch-page Like toolbar (`ytd-watch-metadata #actions`) — is covered and invisible regardless of `z-index`.

YouTube Quick Controls solves this using a three-layer strategy:

1. **Dual-World Bridge Without CSP Errors (`page-bridge.js` + `content.js`):**
   YouTube enforces strict **Trusted Types CSP** (blocking inline `<script>` injection), while MV3 `ISOLATED` content scripts cannot read JavaScript methods attached to `#movie_player`. Registering `page-bridge.js` declaratively with `"world": "MAIN"` in `manifest.json` grants safe `#movie_player` / `#shorts-player` API access and exchanges typed, origin-verified `window.postMessage` messages with `content.js` (`"world": "ISOLATED"`).
2. **Fullscreen Top-Layer Anchoring (`findFullscreenAnchor`):**
   On `fullscreenchange` (with short follow-up checks as YouTube lazily hydrates fullscreen chrome), `content.js` inspects `document.fullscreenElement`:
   - **Modern Fullscreen Overlay (`.ytp-fullscreen-quick-actions`):** Locates the fullscreen Like button inside `document.fullscreenElement`, mounts `#yqc-controls-host` directly inside the Top Layer `#movie_player` container (so `overflow: hidden` on `.ytp-fullscreen-quick-actions` cannot clip pills or menus), and aligns it directly above the fullscreen Like button's coordinates via `getBoundingClientRect()` + `ResizeObserver`. If bounding layout is temporarily unmeasured, it falls back inline before the Like button inside `.ytp-fullscreen-quick-actions`.
   - **Classic Fullscreen Fallback:** When `.ytp-fullscreen-quick-actions` is absent, mounts inside `document.fullscreenElement` above `.ytp-chrome-bottom` (`.yqc-fullscreen-overlay-slot`) clear of playback/scrubber/right controls.
3. **Interactive Guardrails:**
   - Dropdown popups use the HTML Popover API (`popover="auto"`) + viewport-clamped positioning opening **upward** in fullscreen so options remain clickable without bottom-edge clipping.
   - Pointer/keyboard propagation inside `#yqc-controls-host` is stopped (`stopPropagation()`) so clicks do not toggle play/pause and arrow keys/`Space` do not trigger YouTube hotkeys.
   - Hovering controls or opening a menu triggers a lightweight `.ytp-autohide` keepalive so YouTube does not fade controls away mid-selection.

---

## Known Limitations of YouTube's Quality API

- **Unlisted / Deprecated Internal APIs:** YouTube deprecated official programmatic quality overrides in the public IFrame API. Quality discovery (`getAvailableQualityLevels`, `getAvailableQualityData`) and switching (`setPlaybackQualityRange`, `setPlaybackQuality`) rely on internal `#movie_player` / `#shorts-player` methods in the `MAIN` world, which YouTube can change across player updates.
- **Adaptive Bitrate (ABR) Buffer Delay:** Calling `setPlaybackQualityRange()` asks YouTube's ABR engine to prefer the selected resolution for upcoming segments, rather than rewriting or flushing already-buffered media chunks (because the extension intentionally does **not** intercept or modify network requests). High-buffer videos may take a few seconds before `getPlaybackQuality()` reports the new resolution; if the player refuses or retains another tier after verification, the UI preserves the active state and displays a subtle warning tooltip.
- **Initial Loading Window:** While a video's DASH manifest is still initializing, YouTube may temporarily return an empty list or only low-tier qualities; the extension displays `Loading...` and refreshes automatically once `onStateChange` / manifest polling delivers the full resolution list.
- **Shorts & Premium-Locked Tiers:** Many YouTube Shorts expose a single fixed quality or omit quality tiers altogether (`getAvailableQualityLevels()` may be empty on some Shorts builds). Options marked unplayable by YouTube (such as locked Premium bitrates when `isPlayable === false`) are filtered out rather than presented as broken buttons.
