# Project Research Summary

**Project:** YouTube Quick Controls (Chrome Extension MV3)
**Domain:** YouTube Web Client UX Enhancement / Browser Extension (Manifest V3)
**Researched:** 2026-11-11
**Confidence:** HIGH

## Executive Summary

**YouTube Quick Controls** is a zero-dependency Manifest V3 Chrome extension packaged cleanly under `youtube-quick-controls/` for direct "Load unpacked" installation. Its single objective is to eliminate multi-click navigation inside YouTube's settings gear menu by placing compact, native-looking Playback Speed (`[ 1.0x ▼ ]`) and Video Quality (`[ 1080p ▼ ]`) pill dropdowns directly **above YouTube's Like button** across normal watch pages, fullscreen playback (both modern "Delhi" UI and classic layouts), and YouTube Shorts.

Across the four research tracks (`STACK`, `FEATURES`, `ARCHITECTURE`, `PITFALLS`), the central architectural finding is the **MV3 Dual-World Split Constraint**: YouTube enforces strict Trusted Types Content Security Policy (`require-trusted-types-for 'script'`), blocking inline `<script>` injection, while MV3 `ISOLATED` content scripts cannot invoke JavaScript methods attached to `#movie_player` (such as `getAvailableQualityLevels()`, `getPlaybackQuality()`, `setPlaybackQualityRange()`, and `addEventListener('onPlaybackQualityChange')`). Declaring a thin `"world": "MAIN"` bridge script (`page-bridge.js`) alongside the `"world": "ISOLATED"` UI/storage controller (`content.js`) in `manifest.json` resolves both constraints with minimal permissions (`storage` only, scoped strictly to `https://www.youtube.com/*`) and clean origin-verified `window.postMessage` RPC.

The primary UX and DOM engineering risks are: (1) the browser Fullscreen **Top Layer** hiding watch-page DOM nodes outside `document.fullscreenElement`, (2) Polymer SPA node recycling causing duplicate pills or memory leaks on `yt-navigate-finish`, (3) YouTube Adaptive Bitrate (ABR) buffer lag delaying quality confirmation after `setPlaybackQualityRange()`, and (4) Light/Dark theme mismatch between OS `prefers-color-scheme` and YouTube's independent `html[dark]` state. Addressing each explicitly in phased order ensures production reliability without intercepting network requests or modifying YouTube's native buttons.

## Key Findings

### Recommended Stack
- **Extension Platform:** Manifest V3 (`manifest.json`), permissions limited strictly to `["storage"]`, content scripts scoped strictly to `https://www.youtube.com/*`.
- **Execution Architecture:** Zero-build Vanilla ES6+ JavaScript, HTML5, CSS3 split into `page-bridge.js` (`world: "MAIN"`) and `content.js` + `styles.css` (`world: "ISOLATED"`), plus `background.js` (MV3 service worker) and `popup.html` / `popup.css` / `popup.js`.
- **Modern Web UI Standards:** Semantic Popover API (`popover="auto"`) with `getBoundingClientRect()` fallback positioning (top-layer compatible in fullscreen, click-outside/Escape light dismiss, `:focus-visible` outlines, `min-block-size: 24px` target sizing), YouTube `--yt-spec-*` tokens paired with `html[dark]` / `light-dark()` theming.
- **Verification Tooling:** Node.js v24 native test runner (`node:test`), JSDOM DOM simulation for multi-mode placement and SPA navigation tests, and headless Chromium verification (`Google Chrome 156`).

### Expected Features
- **Must-Have Core (v1):**
  - Compact pill controls directly above Like button in normal watch pages (`ytd-watch-metadata #actions`).
  - Playback Speed dropdown (`0.25x`–`3.0x` presets in `0.25x` steps including `2.25x`, custom rates exposed by YouTube/user input, immediate `video.playbackRate` update without pausing/restarting, bidirectional `ratechange` sync).
  - Dynamic Video Quality dropdown populated strictly from `#movie_player` available levels (`144p`–`2160p` 4K + `Auto` where available), quality-switch verification with tooltip/rollback on refusal, loading state handling, and external change sync.
  - Fullscreen support inside `document.fullscreenElement` above the fullscreen Like button (Delhi `.ytp-fullscreen-quick-actions`) with classic fallback above `.ytp-chrome-controls`.
  - Full YouTube SPA navigation lifecycle (`yt-navigate-finish`, `yt-page-data-updated`, `popstate`, URL/video change detection), YouTube Shorts (`ytd-reel-video-renderer[is-active]`, `#shorts-player`), and dynamic Light/Dark theme adaptation.
  - Extension Popup + `chrome.storage.sync` (`local` fallback) for enable/disable, default speed, default quality, and auto-apply on new videos.
- **Anti-Features (Explicitly Out of Scope):** DASH/HLS stream or network request interception, video downloading, ad-blocking, mutating native YouTube Like/Dislike button behavior, hardcoded unavailable resolutions, broad host permissions.

### Architecture Approach
- **Modular Runtime Files under `youtube-quick-controls/`:**
  - `manifest.json`: Dual content scripts (`MAIN` bridge + `ISOLATED` controller), `background.js`, `action` popup, real PNG `icons/` (`16`, `48`, `128`).
  - `page-bridge.js` (`MAIN`): Safe player discovery (`#movie_player`, `#shorts-player`), typed RPC handlers (`GET_QUALITIES`, `SET_QUALITY`, `PING`), defensive invocation (`setPlaybackQualityRange(q, q)` + fallback `setPlaybackQuality(q)`), resolution metadata normalization, and `onPlaybackQualityChange` / `onStateChange` event forwarding.
  - `content.js` (`ISOLATED`): Context-aware DOM selector discovery chain (Watch, Fullscreen Delhi, Fullscreen Classic, Shorts), `<video>` binding with `ratechange` feedback-loop guard (`isInternalRateChange`), debounced targeted `MutationObserver` + `AbortController` teardown, accessible dropdown UI (`popover="auto"` + `focusgroup`/keyboard fallback), quality confirmation + fallback/error tooltip, and `chrome.storage.sync` integration.
  - `styles.css`: Scoped styles adhering to YouTube Delhi pill styling, dark/light tokens, popup `:popover-open` top-layer alignment, and upward/flipping dropdown viewport containment.

### Critical Pitfalls
1. **Isolated World & Trusted Types CSP (Phase 1):** Calling `#movie_player.getAvailableQualityLevels()` in `ISOLATED` world returns `undefined`; inline `<script>` injection fails Trusted Types CSP. *Prevention:* Declarative `"world": "MAIN"` bridge in `manifest.json` + origin/source-validated `window.postMessage` RPC.
2. **Fullscreen Top Layer Invisibility (Phase 3):** Watch-page controls are obscured behind `document.fullscreenElement`. *Prevention:* Mount/re-anchor controls directly inside `document.fullscreenElement` (`fullscreenchange` listener), targeting `.ytp-fullscreen-quick-actions` above the fullscreen Like button and `#movie_player` fallback.
3. **SPA Node Recycling & Duplicate Injections (Phase 2):** YouTube moves/recycles `ytd-watch-metadata` and `#actions` on navigation. *Prevention:* Strict DOM idempotency guards, debounced subtree-scoped `MutationObserver`, `yt-navigate-finish` / `yt-page-data-updated` / `popstate` rebinding, and `AbortController` listener cleanup.
4. **Quality API Quirks & ABR Buffer Lag (Phase 2):** `setPlaybackQuality` alone is ignored in modern ABR players, manifests load asynchronously (reporting only `tiny`/`small` initially), and `Auto` uses unconstrained range (`default`/`highres` or internal auto reset). *Prevention:* `setPlaybackQualityRange(q, q)` primary + `setPlaybackQuality(q)` fallback, player state/quality listener re-queries, verification timeout with previous-state rollback + subtle error tooltip if unfulfilled.
5. **Shorts Virtualized Reels & `ratechange` Loops (Phase 3):** Multiple `<video>` nodes exist simultaneously in Shorts feeds and speed resets on scroll. *Prevention:* Target `ytd-reel-video-renderer[is-active] video` strictly and guard `ratechange` with `isInternalRateChange`.
6. **YouTube vs OS Theme Mismatch (Phase 2 & 4):** OS dark mode with YouTube light mode breaks `prefers-color-scheme`-only UI. *Prevention:* Bind widget theme to YouTube's `html[dark]` / `ytd-app[dark]` + fullscreen player dark context and `--yt-spec-*` variables; reserve `light-dark()` + `prefers-color-scheme` for the isolated `popup.html`.
7. **Native Hotkeys & Fullscreen Auto-Hide (Phase 3):** Clicking inside `#movie_player` pauses video, `.ytp-autohide` hides controls mid-menu, and `overflow: hidden` clips downward menus. *Prevention:* `stopPropagation()` on pointer/keyboard events inside widget controls, autohide keepalive / upward viewport-aware popovers (`popover="auto"`).

## Implications for Roadmap

Based on research, a 4-phase execution structure cleanly satisfies dependencies and isolation boundaries:

1. **Phase 1: Extension Foundation, Storage & Dual-World Bridge**
   - Rationale: Establishes loadable MV3 package (`youtube-quick-controls/`), PNG icons, storage defaults/popup UI, and verified `MAIN` ↔ `ISOLATED` player RPC before any DOM injection begins.
   - Addresses: Pitfall 1 (CSP / Trusted Types & Isolated World boundary).
2. **Phase 2: Watch-Page Controls, Playback Speed & Dynamic Quality Engine**
   - Rationale: Builds resilient Like-button-above placement, accessible speed/quality dropdowns, YouTube dark/light styling, `ratechange` sync, custom rates, and verified quality switching with rollback/tooltip.
   - Addresses: Pitfalls 3, 4, 6.
3. **Phase 3: Fullscreen Mode, YouTube Shorts & SPA Lifecycle**
   - Rationale: Implements `document.fullscreenElement` top-layer anchoring (modern Delhi quick actions + classic fallback), Shorts active reel binding, keyboard/autohide isolation, and full SPA navigation teardown/re-anchoring + default auto-apply.
   - Addresses: Pitfalls 2, 5, 7 (plus Pitfall 3 SPA continuity).
4. **Phase 4: Documentation, Automated Test Suite & End-to-End Verification**
   - Rationale: Validates all requirements via unit tests, JSDOM watch/fullscreen/Shorts/SPA/theme simulations, live headless Chrome extension load tests, bug-fix pass, and complete README / GSD verification & UAT artifacts.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack & MV3 Security | HIGH | Native Chrome MV3 `world: "MAIN"` declarative injection and `chrome.storage.sync` are standard Chromium 111+ capabilities. |
| YouTube Watch & Fullscreen Selectors | HIGH | Multi-tier fallback chains verified across Polymer (`ytd-watch-metadata`, `segmented-like-dislike-button-view-model`) and Delhi fullscreen (`.ytp-fullscreen-quick-actions`). |
| YouTube Player Quality API | MEDIUM-HIGH | `#movie_player` methods (`setPlaybackQualityRange`, `getAvailableQualityLevels`) are standard in YouTube web player, though YouTube ABR may defer buffer switches or restrict `Auto` reset behavior on some player versions — handled via verification & graceful rollback. |
| Shorts & Theme Adaptation | HIGH | Active reel scoping (`ytd-reel-video-renderer[is-active]`) and YouTube `--yt-spec-*` / `[dark]` attributes directly resolve known failure modes. |

## Sources

- `.planning/research/STACK.md`
- `.planning/research/FEATURES.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/research/PITFALLS.md`

---
*Research synthesis for: YouTube Quick Controls*
*Ready for requirements: yes*
