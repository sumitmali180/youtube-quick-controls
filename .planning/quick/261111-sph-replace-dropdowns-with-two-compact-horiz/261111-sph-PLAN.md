---
quick_id: 261111-sph
slug: replace-dropdowns-with-two-compact-horiz
description: Replace dropdowns with two compact horizontal pill rows for playback speed and video quality
date: 2026-11-11
files_modified:
  - youtube-quick-controls/content.js
  - youtube-quick-controls/styles.css
  - youtube-quick-controls/README.md
  - README.md
  - tests/unit-manifest-bridge.test.mjs
  - tests/e2e-chrome-dom.test.mjs
---

# Quick Plan: Two Compact Horizontal Pill Rows Above Like Button

## Objective
Replace dropdown trigger buttons and popover menus with two permanently visible, compact horizontal rows of pill buttons positioned directly above YouTube's Like button across Watch pages, Fullscreen mode, and YouTube Shorts — keeping all underlying playback speed, quality verification, storage, SPA, and Fullscreen logic intact.

## Layout & Behavior Changes
1. **Row 1 — Playback Speed (`yqc-speed-row`):**
   - Render compact pills: `0.25x`, `0.5x`, `0.75x`, `1.0x`, `1.25x`, `1.5x`, `1.75x`, `2.0x`, `2.5x`, `3.0x` (plus any custom/exposed rate if active on `<video>` or exposed by YouTube).
   - One click immediately applies `video.playbackRate` via `applyPlaybackSpeed()` without pausing/seeking and sets `aria-pressed="true"` on the matching pill.
2. **Row 2 — Video Quality (`yqc-quality-row`):**
   - Render compact pills: `Auto`, `144p`, `240p`, `360p`, `480p`, `720p`, `1080p`, `1440p`, `2160p` (plus `4320p` dynamically if exposed).
   - Unavailable resolutions for the active video (or while loading) are dynamically disabled with `aria-disabled="true"` and click-ignored; available resolutions apply immediately via `applyVideoQuality()` with verification/rollback + `⚠` status tooltip on refusal.
   - Highlight active resolution (or `Auto`) with `aria-pressed="true"`.
3. **Toolbar Accessibility & Theme CSS (`styles.css`):**
   - Use `role="toolbar"` with `focusgroup="toolbar wrap"`, grouped `role="group"` rows, `<button type="button">` pills (`>= 24x24` CSS px hit targets via `min-inline-size` / `min-block-size`), JS roving-tabindex fallback when `!('focusGroup' in HTMLElement.prototype)`, YouTube Light/Dark adaptive high-contrast active tokens, `@media (hover: hover)`, `@media (prefers-reduced-motion: no-preference)`, and `@media (forced-colors: active)`.
4. **Verification:**
   - Update `tests/unit-manifest-bridge.test.mjs` and `tests/e2e-chrome-dom.test.mjs` for the inline two-row UI and run `node --test tests/*.test.mjs` plus Brave 157 `--load-extension` live MV3 verification.

