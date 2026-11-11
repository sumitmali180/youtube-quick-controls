# YouTube Quick Controls

## What This Is

A lightweight, native-feeling Manifest V3 Chrome extension (**YouTube Quick Controls**) that places compact playback speed and video quality dropdown controls directly above YouTube's Like button — on regular watch pages, YouTube Shorts, and inside the fullscreen video player. Users can switch speed (`0.25x`–`3.0x` plus any custom rates) and dynamically available resolutions (including `Auto`) in one click without opening YouTube's Settings gear submenu.

## Core Value

Playback speed and video quality controls must remain always accessible directly above YouTube's Like button in both normal mode and fullscreen mode, updating immediately and staying synchronized with YouTube's native player state.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Inject two compact pill dropdowns (`[ 1.0x ▼ ] [ 1080p ▼ ]`) directly above YouTube's Like button on standard watch pages, aligned with the existing action toolbar.
- [ ] Keep speed and quality controls visible, clickable, non-overlapping, and styled identically above the Like button (with robust fallback positioning inside `document.fullscreenElement`) when in fullscreen mode.
- [ ] Provide playback speed presets (`0.25x` through `3.0x` in `0.25x` steps) plus custom rate support, updating `video.playbackRate` immediately without pausing/restarting and syncing on external `ratechange` events.
- [ ] Dynamically detect available resolutions from YouTube's player API, support `Auto`, never show unavailable resolutions, verify actual quality transitions, and handle failures/loading gracefully with non-intrusive feedback.
- [ ] Support YouTube SPA navigation (`yt-navigate-finish`, `yt-page-data-updated`, `popstate`, URL/video changes), YouTube Shorts, and both dark and light YouTube themes with zero duplicate injections or memory leaks.
- [ ] Provide an accessible MV3 popup settings UI backed by `chrome.storage.sync` (enable/disable controls, default speed, default quality, auto-apply defaults on new videos).

### Out of Scope

- Intercepting or rewriting YouTube network requests / video stream URLs — violates reliability/safety constraints and is unnecessary given YouTube's player API.
- Custom video downloaders, ad-blocking, or modifying YouTube's native button behavior — out of scope and risks breakage/CWS rejection.
- Broad host permissions (`<all_urls>`) — strictly scoped to `https://www.youtube.com/*` (and `https://m.youtube.com/*` if applicable, or `https://www.youtube.com/*` primary).

## Context

- Target runtime: Google Chrome (Manifest V3, tested against Chrome 156+ and modern Baseline Chromium).
- YouTube runs a Polymer/Web Component SPA (`ytd-app`, `ytd-watch-metadata`, `segmented-like-dislike-button-view-model`, `#movie_player`, `.ytp-fullscreen-quick-actions`, `.ytp-chrome-bottom`, `ytd-reel-video-renderer`).
- In MV3, content scripts default to the `ISOLATED` world and cannot read JS methods attached by page scripts to `#movie_player` (`getAvailableQualityLevels`, `getAvailableQualityData`, `getPlaybackQuality`, `setPlaybackQualityRange`, `setPlaybackQuality`). A `world: "MAIN"` bridge script declared in `manifest.json` resolves this cleanly without CSP-breaking inline script injection.
- Deliverable extension root resides cleanly in `youtube-quick-controls/` so users can point Chrome's **Load unpacked** directly at a clean directory free of `.git/`, `.planning/`, `.agents/`, and test suites.

## Constraints

- **Tech stack**: Vanilla Manifest V3 Chrome Extension (`HTML`, `CSS`, `ES6+ JavaScript`), zero external runtime dependencies or build bundlers required to load unpacked.
- **Permissions**: Minimum necessary MV3 permissions (`storage`, scoped `https://www.youtube.com/*` content script matching).
- **Security/CSP**: No inline scripts, no `eval()`, no inline event handlers; `MAIN` world bridge communicates with `ISOLATED` UI via validated `window.postMessage` envelope.
- **Performance**: Debounced `MutationObserver`, batched DOM updates, full cleanup of observers/listeners on navigation/teardown.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Place clean extension bundle under `youtube-quick-controls/` | Matches requested architecture and ensures `chrome://extensions` Load unpacked loads zero `.git`/`.planning`/`.agents` noise | — Pending |
| Dual-world content scripts (`MAIN` bridge + `ISOLATED` UI/storage) | Required in MV3 so player quality APIs on `#movie_player` are accessible without inline `<script>` CSP violations | — Pending |
| Use `chrome.storage.sync` with `chrome.storage.local` fallback | Keeps user defaults synced across devices while staying resilient if sync is disabled | — Pending |
| Anchor controls directly above Like button in watch page, Shorts, and `.ytp-fullscreen-quick-actions` (plus classic fullscreen fallback inside `document.fullscreenElement`) | Satisfies fullscreen visibility inside Top Layer across both modern Delhi fullscreen UI and classic fullscreen layout | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-11 after initialization*

