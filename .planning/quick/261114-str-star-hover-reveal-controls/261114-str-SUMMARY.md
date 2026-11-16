---
quick_id: 261114-str
slug: star-hover-reveal-controls
description: Display controls as a compact star icon that reveals the speed and quality rows on hover
completed_at: 2026-11-14T14:52:00Z
files_modified:
  - youtube-quick-controls/content.js
  - youtube-quick-controls/styles.css
  - youtube-quick-controls/README.md
  - tests/unit-manifest-bridge.test.mjs
  - tests/e2e-chrome-dom.test.mjs
---

# Summary: Star Icon with Hover-Reveal for Speed & Quality Rows (`261114-str`)

## What Changed

1. **[`youtube-quick-controls/content.js`](../../../youtube-quick-controls/content.js)**:
   - Added a compact, theme-adaptive star button (`#yqc-star-btn`, `.yqc-star-btn`) featuring a native YouTube-styled 5-point star SVG icon.
   - Wrapped `#yqc-speed-row` and `#yqc-quality-row` in a dedicated panel container (`#yqc-controls-panel`, `.yqc-panel`).
   - Implemented hover reveal and graceful collapse state management (`setRevealed`, `scheduleCollapse`, `clearCollapseTimer`, `isRevealed`, `isPinned`):
     - Moving the pointer over the star or toolbar instantly reveals the controls panel (`data-yqc-revealed="true"` and `aria-expanded="true"`).
     - Moving the pointer away smoothly collapses back to the star after a 200ms grace period so moving between chips never jitters.
     - Clicking the star button toggles pinning the controls open/closed (`data-yqc-pinned="true"`).
     - Full keyboard accessibility: focusing the star reveals the panel, `Enter`/`Space` toggles pin, `ArrowRight`/`ArrowDown` navigates into the speed/quality chips, and `Escape` collapses back to the star.
     - Preserved all playback speed, quality negotiation, rollback, SPA, and idle auto-hide functionality without disruption.
2. **[`youtube-quick-controls/styles.css`](../../../youtube-quick-controls/styles.css)**:
   - Configured `.yqc-root` to lay out the star trigger and revealed panel inline horizontally (`flex-direction: row; align-items: center; gap: 6px`).
   - Styled `.yqc-star-btn` as a sleek circular pill button (`26x26px`, `border-radius: 999px`) adapting seamlessly to Light, Dark, Fullscreen, and Shorts theme tokens.
   - Styled `.yqc-panel` with smooth GPU-accelerated opacity and transform transitions (`140ms ease-out`), hiding the rows when resting (`opacity: 0; pointer-events: none; transform: translateX(-4px)`) and displaying them smoothly when hovered, focused, or pinned (`opacity: 1; pointer-events: auto; transform: translateX(0)`).
   - Added coarse pointer target sizing (`36x36px`) and Windows Forced Colors / High Contrast styling.
3. **Tests & Documentation**:
   - Updated [`tests/unit-manifest-bridge.test.mjs`](../../../tests/unit-manifest-bridge.test.mjs) and [`tests/e2e-chrome-dom.test.mjs`](../../../tests/e2e-chrome-dom.test.mjs) to verify star button creation, aria states, hover reveal, and click pin toggle alongside real Chrome E2E and Brave MV3 tests.
   - Updated [`youtube-quick-controls/README.md`](../../../youtube-quick-controls/README.md).

## Verification

- `node --test tests/*.test.mjs`: 6/6 tests passed (unit + bridge + Chrome 156 Watch/Fullscreen/Star-Hover/Shorts/SPA/Theme/Popup E2E + Brave 157 unpacked `--load-extension` test).
- `node --check youtube-quick-controls/*.js`: passed.
- `! grep -rnE "TODO|FIXME" youtube-quick-controls/`: zero markers.

