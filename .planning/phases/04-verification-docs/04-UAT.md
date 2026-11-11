---
phase: 04-verification-docs
status: verified_automated_e2e_manual_live_ready
updated: 2026-11-11
---

# User Acceptance Testing (UAT): YouTube Quick Controls

## Automated Acceptance Checks (Chrome 156 CDP + Node VM)

All scenarios below executed and passed in `node --test tests/*.test.mjs` after final extension edits:

1. **Watch-Page Controls Placement (`UI-01`, `UI-05`):**
   - Verified single `#yqc-controls-host` rendered directly above `#watch-like-btn` (`hostBottom <= likeTop + 1`), left-aligned within `<= 10px`, native Like click handler unaffected (`likeClicks === 1`), pill hit targets `>= 24x24` CSS px.
2. **Playback Speed Control (`SPEED-01`..`SPEED-05`):**
   - Verified all 11 standard presets (`0.25x`..`3.0x` including `2.25x`) plus YouTube-exposed custom rate `1.15x` and inline custom input `1.65x` update `video.playbackRate` without pausing, and external `ratechange` (`1.75x`) updates the pill label immediately.
3. **Dynamic Quality Control & Error Rollback (`QUAL-01`..`QUAL-05`):**
   - Verified dynamic population of `4K` down to `144p` + `Auto`, exclusion of unavailable/unplayable options on limited (`360p` max) videos, `Loading...` UI while empty, and keeping previous `720p` selected with visible `⚠` status tooltip when YouTube rejects a switch to `1080p`.
4. **Fullscreen Mode (`FULL-01`..`FULL-03`):**
   - Verified real user-gesture `requestFullscreen()` places controls inside `document.fullscreenElement`, positioned above fullscreen Like button inside `.ytp-fullscreen-quick-actions` (modern Delhi overlay), keeps open controls opaque during `.ytp-autohide`, falls back cleanly above `.ytp-chrome-bottom` when `.ytp-fullscreen-quick-actions` is removed, and restores single Watch toolbar on exit.
5. **Themes, Keyboard/Outside Dismiss, Shorts & SPA (`UI-02`..`UI-04`, `SHORTS-01`, `SPA-01`, `SET-03`):**
   - Verified live switch from Light (`rgb(255, 255, 255)`) to Dark (`rgb(40, 40, 40)`), `Escape` closing popover and restoring focus to `#yqc-quality-trigger`, outside click dismissing open menu, Watch -> Shorts reel 1 -> Shorts reel 2 active reel video binding with `1.5x` auto-apply on active reel only, and clean teardown (`0` hosts) on `/`.
6. **Extension Popup & Storage (`SET-01`, `SET-02`):**
   - Verified preset speed, custom speed input, local storage fallback when `chrome.storage.sync.set` rejects, disable toggle, and Reset Defaults in Chrome 156 on `/popup.html`.

## Interactive Manual Check Checklist for Chrome on Live `youtube.com`

1. Open `chrome://extensions/`, enable **Developer mode**, click **Load unpacked**, and select `youtube-quick-controls/`.
2. Open a standard 1080p/4K video on `https://www.youtube.com/watch?...`, confirm `[ 1.0x ▼ ] [ Auto (...) ▼ ]` sits cleanly above Like, test Light & Dark theme appearance, and enter/exit Fullscreen.
3. Navigate via video cards, search results, Shorts feed, and Back/Forward to confirm single-bar anchoring and saved popup defaults.
