---
quick_id: 261125-umw
slug: add-reset-button-to-return-video-zoom-to
description: Add Reset button to return video zoom to original 1.0x
status: complete
completed_at: 2026-11-25T16:35:00Z
files_modified:
  - youtube-quick-controls/content.js
  - youtube-quick-controls/README.md
  - README.md
  - tests/unit-manifest-bridge.test.mjs
  - tests/e2e-chrome-dom.test.mjs
---

# Summary: Zoom Reset Button (`261125-umw`)

## What Changed

1. **[`youtube-quick-controls/content.js`](../../../youtube-quick-controls/content.js)**:
   - Added a `Reset` button (`data-yqc-zoom="reset"`, `aria-label="Reset zoom"`) after `Zoom −` inside `#yqc-display-row`.
   - Disabled (`aria-disabled="true"`) when zoom is already `1.0x`, enabled when zoomed in or out, and added `resetZoom()` to smoothly restore zoom to `1.0x` while preserving the active display mode.
2. **Tests & Documentation**:
   - Updated [`tests/unit-manifest-bridge.test.mjs`](../../../tests/unit-manifest-bridge.test.mjs), [`tests/e2e-chrome-dom.test.mjs`](../../../tests/e2e-chrome-dom.test.mjs), [`youtube-quick-controls/README.md`](../../../youtube-quick-controls/README.md), and [`README.md`](../../../README.md).

## Verification

- `node --check youtube-quick-controls/*.js && ! grep -rnE "TODO|FIXME" youtube-quick-controls/ && node --test tests/*.test.mjs`: 6/6 tests passed (0 failed, 0 skipped).

