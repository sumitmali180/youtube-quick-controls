---
quick_id: 261111-sph
slug: replace-dropdowns-with-two-compact-horiz
description: Replace dropdowns with two compact horizontal pill rows for playback speed and video quality
completed_at: 2026-11-11T15:23:00Z
files_modified:
  - youtube-quick-controls/content.js
  - youtube-quick-controls/styles.css
  - youtube-quick-controls/README.md
  - README.md
  - tests/unit-manifest-bridge.test.mjs
  - tests/e2e-chrome-dom.test.mjs
---

# Summary: Two Compact Horizontal Pill Rows Above Like Button (`261111-sph`)

## What Changed

1. **[`youtube-quick-controls/content.js`](../../../youtube-quick-controls/content.js)**:
   - Replaced dropdown triggers, HTML Popover menus, and inline custom speed inputs with a permanent two-row `role="toolbar"` (`focusgroup="toolbar wrap"`) UI anchored directly above YouTube's Like button across Watch, Fullscreen (`above-like` / `quick-actions-inline` / `classic-overlay`), and Shorts modes:
     - **Row 1 (`#yqc-speed-row`, `role="group"`):** `0.25x`, `0.5x`, `0.75x`, `1.0x`, `1.25x`, `1.5x`, `1.75x`, `2.0x`, `2.5x`, `3.0x` plus any dynamic custom/exposed playback rates.
     - **Row 2 (`#yqc-quality-row`, `role="group"`):** `Auto`, `144p`, `240p`, `360p`, `480p`, `720p`, `1080p`, `1440p`, `2160p` (plus `4320p` when exposed), disabling unavailable/loading resolutions with `aria-disabled="true"`, showing a compact `Loading…` badge while manifests load, and keeping the active pill highlighted with `aria-pressed="true"`.
   - Kept all underlying playback speed, quality verification (`applyVideoQuality` + `⚠` tooltip rollback), storage (`SettingsStore`), bridge (`BridgeClient`), SPA routing, and fullscreen autohide/top-layer behavior unchanged; fixed classic fullscreen overlay positioning (`position: absolute; inset-block-end: 64px; inset-inline-end: 16px;`) and roving-`tabindex` keyboard fallback when native `focusGroup` is unavailable.
2. **[`youtube-quick-controls/styles.css`](../../../youtube-quick-controls/styles.css)**:
   - Replaced popover/dropdown/caret styles with compact flex-row pill styles (`.yqc-root`, `.yqc-row`, `.yqc-chip`), `order`/`::before` line-break wrapping in `.yqc-actions-column`, ARIA-driven `[aria-pressed="true"]` and `[aria-disabled="true"]` states, `min-inline-size`/`min-block-size >= 24px` (scaled under `@media (pointer: coarse)`), Light/Dark & fullscreen scrim tokens, `@media (hover: hover)`, `@media (prefers-reduced-motion: no-preference)`, and `@media (forced-colors: active)`.
3. **Tests & Documentation**:
   - Updated [`tests/unit-manifest-bridge.test.mjs`](../../../tests/unit-manifest-bridge.test.mjs) and [`tests/e2e-chrome-dom.test.mjs`](../../../tests/e2e-chrome-dom.test.mjs) for two-row inline controls and added a conditional Brave `157.1.99.56` `--load-extension` unpacked MV3 `service_worker` + `chrome.storage` persistence test.
   - Updated [`youtube-quick-controls/README.md`](../../../youtube-quick-controls/README.md) and [`README.md`](../../../README.md).

## Verification

- `node --test tests/*.test.mjs`: 6/6 tests passed (unit + bridge + Chrome 156 Watch/Fullscreen/Shorts/SPA/Theme/Popup E2E + Brave 157 unpacked `--load-extension` `service_worker` & popup persistence).
- `node --check youtube-quick-controls/*.js`: all extension JS files clean.
- `! grep -rnE "TODO|FIXME" youtube-quick-controls/`: zero markers.

