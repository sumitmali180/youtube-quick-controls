---
quick_id: 261125-ua6
slug: ensure-each-control-occupies-only-one-ro
description: Ensure each control occupies only one row
status: complete
completed_at: 2026-11-25T16:20:00Z
files_modified:
  - youtube-quick-controls/styles.css
  - youtube-quick-controls/content.js
  - tests/unit-manifest-bridge.test.mjs
  - tests/e2e-chrome-dom.test.mjs
---

# Summary: Single-Row Control Groups (`261125-ua6`)

## What Changed

1. **[`youtube-quick-controls/styles.css`](../../../youtube-quick-controls/styles.css)**:
   - Updated `.yqc-row` from `flex-wrap: wrap` to `flex-wrap: nowrap` with `gap: 3px`, `overflow-x: auto`, `scrollbar-width: none`, and `scroll-snap-type: x proximity`, and set `flex: 0 0 auto` + `padding-inline: 6px` on `.yqc-chip` so every control group (`Display`, `Speed`, `Quality`) strictly stays on a single row.
   - Added `inline-size: max-content` and viewport-bounded `max-inline-size` on fullscreen `.yqc-root` overlays so the toolbar expands leftward above the fullscreen Like button instead of wrapping against the right edge of `#movie_player`.
2. **[`youtube-quick-controls/content.js`](../../../youtube-quick-controls/content.js)**:
   - Updated watch-page `alignHostWithAnchor` fallback offset to `0` when `parentRect.width <= hostWidth` so narrow toolbars align flush left rather than overflowing.
3. **Tests**:
   - Added `flex-wrap: nowrap` check in [`tests/unit-manifest-bridge.test.mjs`](../../../tests/unit-manifest-bridge.test.mjs) and single-row vertical spread + horizontal overflow assertions across Watch and Fullscreen Top Layer in [`tests/e2e-chrome-dom.test.mjs`](../../../tests/e2e-chrome-dom.test.mjs).

## Verification

- `node --check youtube-quick-controls/*.js && ! grep -rnE "TODO|FIXME" youtube-quick-controls/ && node --test tests/*.test.mjs`: 6/6 tests passed (0 failed, 0 skipped).
