---
quick_id: 261111-t2f
slug: add-idle-auto-hide-behavior-on-player-ho
description: Add idle auto-hide behavior on player hover and mouse movement
completed_at: 2026-11-11T15:30:30Z
files_modified:
  - youtube-quick-controls/content.js
  - youtube-quick-controls/styles.css
  - youtube-quick-controls/README.md
  - tests/unit-manifest-bridge.test.mjs
  - tests/e2e-chrome-dom.test.mjs
---

# Summary: Idle Auto-Hide Behavior (`261111-t2f`)

## What Changed

1. **[`youtube-quick-controls/content.js`](../../../youtube-quick-controls/content.js)**:
   - Added `IDLE_HIDE_DELAY_MS = 2500` (`ACTIVITY_THROTTLE_MS = 150`) and controller idle/activity state (`clearIdleTimer`, `isInteractionActive`, `setIdleHidden`, `scheduleIdleHide`, `showControlsOnActivity`, `getPlayerActivityContainers`, `bindActivityTargets`).
   - Bound throttled `mousemove`, `pointermove`, `pointerenter`, and touch `pointerdown` listeners to the active player container (`#movie_player`, `.html5-video-player`, active Shorts `#shorts-player`, `<video>`) and toolbar mount parent across watch, Shorts, and fullscreen modes; ignored synthetic `.ytp-autohide` keepalive pulses via `isEmittingKeepalive`.
   - Preserved visibility while hovering either control row (`pointerenter`..`pointerleave`), holding a press (`pointerdown`..`pointerup`), navigating via keyboard (`:focus-visible`), switching quality (`isQualitySwitching`), or displaying an error tooltip (`!tooltip.hidden`), and cleaned up all timers/listeners on unmount, navigation, and destroy.
2. **[`youtube-quick-controls/styles.css`](../../../youtube-quick-controls/styles.css)**:
   - Placed the idle/autohide rule cleanly after mode-specific fullscreen rules so `.yqc-root[data-yqc-idle='true']:not(:has(:focus-visible))` and `#movie_player.ytp-autohide` smoothly set `opacity: 0; pointer-events: none` in both normal and fullscreen modes without shifting YouTube's Like button row or affecting video playback.
   - Wrapped opacity transitions (`140ms ease-out` fade-in, `280ms ease-in` fade-out) inside `@media (prefers-reduced-motion: no-preference)`.
3. **Tests & Documentation**:
   - Updated [`tests/unit-manifest-bridge.test.mjs`](../../../tests/unit-manifest-bridge.test.mjs), [`tests/e2e-chrome-dom.test.mjs`](../../../tests/e2e-chrome-dom.test.mjs) (verifying real ~2.5s idle fade-out, instant `#movie_player` `mousemove` wake, hover interaction hold, and `pointerleave` fade in both normal Watch and Fullscreen Top Layer modes), and [`youtube-quick-controls/README.md`](../../../youtube-quick-controls/README.md).

## Verification

- `node --test tests/*.test.mjs`: 6/6 tests passed (unit + bridge + Chrome 156 Watch/Fullscreen/Idle-Auto-Hide/Shorts/SPA/Theme/Popup E2E + Brave 157 unpacked `--load-extension` test).
- `node --check youtube-quick-controls/*.js`: passed.
- `! grep -rnE "TODO|FIXME" youtube-quick-controls/`: zero markers.

