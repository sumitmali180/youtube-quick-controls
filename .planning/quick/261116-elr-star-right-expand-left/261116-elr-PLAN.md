# Quick Plan: Star on Right with Smooth Leftward Elongation (`261116-elr`)

## Objective
Reorder the star button to sit on the right side of the YouTube Quick Controls component (`.yqc-root`), and configure the two-row speed and quality controls panel (`#yqc-controls-panel`) to smoothly elongate towards the left when hovered/revealed and collapse back to the right into the star when idle/unhovered.

## Proposed Changes

1. **[`youtube-quick-controls/styles.css`](file:///Users/sumit/Projects/speedoq/youtube-quick-controls/styles.css)**:
   - Configure `.yqc-panel` with `order: 1`, `align-items: flex-end`, `transform-origin: right center`, and collapsed `transform: translateX(8px)`.
   - Configure `.yqc-star-btn` with `order: 2` (anchoring it on the right side).
   - Configure `.yqc-row` with `justify-content: flex-end` so speed and quality pills remain aligned against the star and smoothly reveal outwards to the left.
   - When revealed/hovered/pinned, smoothly animate `.yqc-panel` from right to left (`transform: translateX(0)` with `cubic-bezier(0.2, 0, 0, 1)` easing).

2. **[`youtube-quick-controls/content.js`](file:///Users/sumit/Projects/speedoq/youtube-quick-controls/content.js)**:
   - In `buildAndAttachHost()`, append `panel` before `starBtn`: `host.append(panel, starBtn, tooltip)`.
   - In `installToolbarKeyboardFallback()`, update arrow key handling so that pressing `ArrowLeft` from the star button enters the chips from the right (`chips[chips.length - 1]`), pressing `ArrowRight` from the last chip moves to the star button, and `ArrowRight` from the star wraps around to the first chip.

3. **[`youtube-quick-controls/README.md`](file:///Users/sumit/Projects/speedoq/youtube-quick-controls/README.md)**:
   - Update documentation to reflect the right-anchored star button and smooth leftward elongation behavior.

4. **Tests & Verification**:
   - Verify `tests/unit-manifest-bridge.test.mjs` invariants.
   - Verify `tests/e2e-chrome-dom.test.mjs` against real Chrome 156 with CDP.
