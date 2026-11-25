---
quick_id: 261125-uim
slug: add-zoom-and-zoom-buttons-alongside-vide
description: Add Zoom + and Zoom - buttons alongside video display controls
date: 2026-11-25
files_modified:
  - youtube-quick-controls/content.js
  - youtube-quick-controls/styles.css
  - youtube-quick-controls/README.md
  - README.md
  - tests/unit-manifest-bridge.test.mjs
  - tests/e2e-chrome-dom.test.mjs
---

# Quick Plan: Video Zoom + and Zoom − Controls (`261125-uim`)

## Objective
Add **Zoom +** and **Zoom −** buttons alongside the **Fit**, **Stretch**, **Fill**, and **Original** controls in `#yqc-display-row` to smoothly zoom the YouTube `<video>` in or out incrementally (`0.5x`–`2.5x`, `0.1x` steps) while preserving the active display mode, preventing excessive zoom levels via `aria-disabled="true"` bounds, and clipping overflow inside the video container without affecting surrounding player UI.

## Implementation Steps
1. **Zoom State & Toolbar Controls ([`youtube-quick-controls/content.js`](../../../youtube-quick-controls/content.js)):**
   - Add `ZOOM_MIN = 0.5`, `ZOOM_MAX = 2.5`, `ZOOM_STEP = 0.1`, `clampZoom()`, and `this.zoomScale = 1.0`.
   - Render a vertical `role="separator"` plus `Zoom +` (`data-yqc-zoom="in"`) and `Zoom −` (`data-yqc-zoom="out"`) action buttons inside `#yqc-display-row`, updating `aria-disabled` at bounds and preserving active display mode when zooming or switching display modes.
   - Reset `zoomScale = 1.0` cleanly on new video navigation and clear zoom overrides on unmount/destroy.
2. **Smooth Transform & Player Clipping ([`youtube-quick-controls/styles.css`](../../../youtube-quick-controls/styles.css)):**
   - Style `.yqc-separator` with border-based `forced-colors` support.
   - Apply `transform: scale(var(--yqc-zoom-scale, 1)) !important; transform-origin: center center !important;` on `video.yqc-video-zoom` with `transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1)` inside `@media (prefers-reduced-motion: no-preference)`, and enforce `overflow: hidden !important` on `.html5-video-container` / `.html5-video-player` so zoom never overflows surrounding UI.
3. **Tests & Documentation:**
   - Add static checks in `tests/unit-manifest-bridge.test.mjs` and Chrome E2E coverage in `tests/e2e-chrome-dom.test.mjs` verifying incremental zoom in/out, smooth transition rule, bounds clamping (`ZOOM_MIN`/`ZOOM_MAX`), display mode preservation, zero player UI interference, and fullscreen persistence; update READMEs.

