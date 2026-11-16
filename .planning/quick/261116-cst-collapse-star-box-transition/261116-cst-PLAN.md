---
quick_id: 261116-cst
slug: collapse-star-box-transition
description: Collapse star box div into compact shape when not hovering and smoothly expand with transition animation on hover
date: 2026-11-16
files_modified:
  - youtube-quick-controls/styles.css
  - youtube-quick-controls/content.js
  - youtube-quick-controls/README.md
  - tests/unit-manifest-bridge.test.mjs
  - tests/e2e-chrome-dom.test.mjs
---

# Quick Plan: Collapse Star Box into Compact Shape with Smooth Expansion Animation

## Objective
When the cursor is not hovering over the star box (`.yqc-root`), collapse it into a compact, smaller shape (neatly hugging the star button without taking empty space across the toolbar or player). When hovered (or focused/pinned), smoothly expand the star box into its current full size and two-row layout. Provide a smooth, fluid transition animation between both states while preserving all existing controls, functionality, and accessibility.

## Implementation Details
1. **Compact Resting State (`styles.css`):**
   - In its collapsed state (not hovered, not focused, not pinned):
     - The container `.yqc-root` collapses its dimensions and gap (`gap: 0; inline-size: fit-content; max-inline-size: fit-content;`).
     - In Fullscreen and Shorts modes, `.yqc-root` collapses its padding and border radius (`padding: 3px; border-radius: 999px;`) to form a compact, circular/pill frosted badge around the star button.
     - The panel `.yqc-panel` collapses cleanly (`max-inline-size: 0; max-block-size: 0; opacity: 0; overflow: hidden; pointer-events: none;`).
     - Ensure rows have `flex-wrap: nowrap;` so chip dimensions and top/bottom relative alignments remain consistent without vertical wrapping artifacts.
2. **Smooth Transition Animation (`styles.css`):**
   - Apply smooth transitions on `.yqc-root` and `.yqc-panel`:
     - Transition `max-inline-size`, `max-block-size`, `padding`, `border-radius`, `gap`, `opacity`, and `transform` with cubic-bezier easing (`cubic-bezier(0.2, 0, 0, 1)` expand, `cubic-bezier(0.4, 0, 0.2, 1)` collapse).
     - Gate transitions under `@media (prefers-reduced-motion: no-preference)`.
3. **Hover & Reveal States (`content.js` & `styles.css`):**
   - Expanded state applies cleanly via `:hover`, `data-yqc-revealed="true"`, `data-yqc-pinned="true"`, and `:focus-within`.
   - The 200ms grace period on mouseleave in `content.js` ensures smooth cursor movement across the star and panel buttons without premature collapse.
4. **Verification & Tests:**
   - Verify unit invariants and Chrome E2E tests (`tests/unit-manifest-bridge.test.mjs`, `tests/e2e-chrome-dom.test.mjs`).

