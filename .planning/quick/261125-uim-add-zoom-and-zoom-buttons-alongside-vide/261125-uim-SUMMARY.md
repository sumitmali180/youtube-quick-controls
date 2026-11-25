---
quick_id: 261125-uim
slug: add-zoom-and-zoom-buttons-alongside-vide
description: Add Zoom + and Zoom - buttons alongside video display controls
status: complete
completed_at: 2026-11-25T16:31:30Z
files_modified:
  - youtube-quick-controls/content.js
  - youtube-quick-controls/styles.css
  - youtube-quick-controls/README.md
  - README.md
  - tests/unit-manifest-bridge.test.mjs
  - tests/e2e-chrome-dom.test.mjs
---

# Summary: Video Zoom + and Zoom − Controls (`261125-uim`)

## What Changed

1. **[`youtube-quick-controls/content.js`](../../../youtube-quick-controls/content.js)**:
   - Added `ZOOM_MIN = 0.5`, `ZOOM_MAX = 2.5`, `ZOOM_STEP = 0.1`, `clampZoom()`, `zoomScale` controller state, and `adjustZoom()`.
   - Added a vertical `role="separator"` plus **Zoom +** (`data-yqc-zoom="in"`) and **Zoom −** (`data-yqc-zoom="out"`) action buttons inside `#yqc-display-row` alongside **Fit**, **Stretch**, **Fill**, and **Original** (setting `aria-disabled="true"` at min/max bounds without `aria-pressed`).
   - Updated `applyVideoDisplayElement()` so zoom scales independently while preserving the active display mode (`Fit`, `Stretch`, `Fill`, or `Original`), animates smoothly back to `1.0x` before cleaning up `.yqc-video-zoom`, and resets on new video navigation / unmount.
2. **[`youtube-quick-controls/styles.css`](../../../youtube-quick-controls/styles.css)**:
   - Styled `.yqc-separator` (including `forced-colors: active` border color) and `video.yqc-video-zoom` with `transform: scale(var(--yqc-zoom-scale, 1)) !important; transform-origin: center center !important;` and `transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1)` inside `@media (prefers-reduced-motion: no-preference)`.
   - Scoped `overflow: hidden !important` on `.html5-video-container` / `.html5-video-player` when zoomed so scaled video stays clipped inside the player frame without affecting surrounding UI.
3. **Tests & Documentation**:
   - Added unit assertions in [`tests/unit-manifest-bridge.test.mjs`](../../../tests/unit-manifest-bridge.test.mjs), real Chrome E2E zoom/bounds/mode-preservation checks in [`tests/e2e-chrome-dom.test.mjs`](../../../tests/e2e-chrome-dom.test.mjs), and README updates in [`youtube-quick-controls/README.md`](../../../youtube-quick-controls/README.md) and [`README.md`](../../../README.md).

## Verification

- `node --check youtube-quick-controls/*.js && ! grep -rnE "TODO|FIXME" youtube-quick-controls/ && node --test tests/*.test.mjs`: 6/6 tests passed (0 failed, 0 skipped).

