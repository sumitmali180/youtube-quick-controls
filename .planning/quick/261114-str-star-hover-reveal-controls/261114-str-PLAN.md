---
quick_id: 261114-str
slug: star-hover-reveal-controls
description: Display controls as a compact star icon that reveals the speed and quality rows on hover
date: 2026-11-14
files_modified:
  - youtube-quick-controls/content.js
  - youtube-quick-controls/styles.css
  - youtube-quick-controls/README.md
  - tests/unit-manifest-bridge.test.mjs
  - tests/e2e-chrome-dom.test.mjs
---

# Quick Plan: Star Icon with Hover-Reveal for Speed & Quality Rows

## Objective
Update the UI so that in its default resting state, YouTube Quick Controls displays as a compact, native-feeling star button directly above YouTube's Like button. When the user hovers over the star (or interacts via touch/click/keyboard), it smoothly reveals the two horizontal rows of Playback Speed and Video Quality controls. When the pointer leaves the controls, it smoothly collapses back to the star. All existing underlying functionality (speed selection, quality changes, dynamic quality discovery, rollback/tooltips, auto-hide on idle, SPA transitions, Fullscreen, and Shorts) remains 100% functional.

## Design & Technical Approach
1. **Host Structure & Star Trigger (`youtube-quick-controls/content.js`):**
   - Add a compact star button (`yqc-star-btn`, with SVG 5-point star) directly inside `.yqc-root`.
   - Wrap `#yqc-speed-row` and `#yqc-quality-row` in a container (`.yqc-panel` / `.yqc-rows-container`).
   - Manage hover/reveal states via CSS (`:hover`, `:focus-within`) augmented by state attributes (`data-yqc-revealed="true"`, `data-yqc-pinned="true"`):
     - `pointerenter` on the star or host sets revealed state immediately.
     - `pointerleave` with a slight debounce (~200ms grace period) smoothly collapses back if pointer leaves both the star and the rows.
     - Clicking the star can toggle pinning open/closed.
     - Pressing Escape while revealed collapses back to the star and refocuses it.
     - Keyboard focus (`:focus-within`) keeps the panel revealed so users navigating via Tab or arrow keys have full access.
2. **Styling & Transitions (`youtube-quick-controls/styles.css`):**
   - Style `.yqc-star-btn` to match YouTube's native action buttons / chips: pill/circle, theme-aware (`--yqc-bg`, `--yqc-fg`, `--yqc-border`), high contrast hover states, and dark/fullscreen support.
   - Style `.yqc-panel` with smooth opacity, transform, and max-width transitions (`160ms ease`) so expanding and collapsing feels fluid and avoids jarring page layout shifts.
   - Maintain compatibility with idle auto-hide (`data-yqc-idle="true"`) and fullscreen top-layer styling.
3. **Automated Tests & Docs:**
   - Verify unit and E2E tests (`tests/unit-manifest-bridge.test.mjs`, `tests/e2e-chrome-dom.test.mjs`) continue passing with the star trigger and revealed rows.
   - Update `youtube-quick-controls/README.md` to document the new star hover-reveal interaction.

