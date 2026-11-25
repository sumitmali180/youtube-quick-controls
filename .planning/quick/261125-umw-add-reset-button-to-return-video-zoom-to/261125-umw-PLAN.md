---
quick_id: 261125-umw
slug: add-reset-button-to-return-video-zoom-to
description: Add Reset button to return video zoom to original 1.0x
date: 2026-11-25
files_modified:
  - youtube-quick-controls/content.js
  - youtube-quick-controls/README.md
  - README.md
  - tests/unit-manifest-bridge.test.mjs
  - tests/e2e-chrome-dom.test.mjs
---

# Quick Plan: Zoom Reset Button (`261125-umw`)

## Objective
Add a **Reset** button next to **Zoom +** and **Zoom −** in `#yqc-display-row` so users can smoothly return video zoom back to its original `1.0x` scale in one click while keeping the selected display mode intact.

## Implementation Steps
1. **Controller & Display Row ([`youtube-quick-controls/content.js`](../../../youtube-quick-controls/content.js)):**
   - Render a `Reset` action button (`data-yqc-zoom="reset"`, `aria-label="Reset zoom"`) after `Zoom −` inside `#yqc-display-row`.
   - Disable (`aria-disabled="true"`) when `zoomScale` is already `1.0`, and enable when zoomed in or out (`zoomScale !== 1.0`).
   - Add `resetZoom()` to reset `this.zoomScale = 1.0`, smoothly transition `<video>` zoom back to `1.0x` while preserving `this.displayMode`, and refresh button states.
2. **Tests & Documentation:**
   - Update `tests/unit-manifest-bridge.test.mjs`, `tests/e2e-chrome-dom.test.mjs` (verifying `Reset` disabled at `1.0x`, enabled when zoomed, and smoothly resetting zoom back to `1.0x` in one click while preserving display mode), `youtube-quick-controls/README.md`, and `README.md`.

