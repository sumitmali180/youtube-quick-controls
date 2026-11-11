# Roadmap: YouTube Quick Controls

## Overview

Build a production-ready Manifest V3 Chrome extension inside `youtube-quick-controls/` that places compact, theme-adaptive Playback Speed and Video Quality pill dropdowns directly above YouTube's Like button across standard watch pages, fullscreen playback, and YouTube Shorts, with SPA resilience and persistent popup preferences.

## Phases

- [ ] **Phase 1: Extension Foundation, Storage & Dual-World Bridge** - MV3 manifest, icons, service worker, popup settings UI, and CSP-safe `MAIN`/`ISOLATED` player RPC bridge.
- [ ] **Phase 2: Watch-Page Controls, Playback Speed & Dynamic Quality Engine** - Anchor injection above watch-page Like button, speed/quality pill UI, `ratechange` sync, custom rates, verified quality switching with rollback/tooltip, and dark/light theme support.
- [ ] **Phase 3: Fullscreen Mode, YouTube Shorts & SPA Lifecycle** - `document.fullscreenElement` Top-Layer anchoring (modern Delhi + classic fallback), Shorts active reel binding, SPA navigation teardown/re-injection, and auto-apply defaults.
- [ ] **Phase 4: Documentation, Automated Test Suite & End-to-End Verification** - Comprehensive README docs, automated unit/DOM/chrome verification tests, bug-fix pass, and final GSD verification/UAT signoff.

## Phase Details

### Phase 1: Extension Foundation, Storage & Dual-World Bridge
**Goal**: Establish an immediately loadable Manifest V3 package (`youtube-quick-controls/`), persistent user preferences with a modern popup UI, and a working CSP-compliant bridge to YouTube's `#movie_player` / `#shorts-player` APIs.
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, SET-01, SET-02
**Success Criteria** (what must be TRUE):
  1. `youtube-quick-controls/manifest.json` passes MV3 validation with `"storage"` permission only, scoped `https://www.youtube.com/*` content scripts, valid PNG icons (`16`, `48`, `128`), and zero inline scripts.
  2. `popup.html` / `popup.js` / `popup.css` allow toggling controls on/off, setting default speed/quality and auto-apply, and persisting changes cleanly via `chrome.storage.sync` (with `local` fallback).
  3. `page-bridge.js` (`world: "MAIN"`) responds to `window.postMessage` RPC requests (`PING`, `GET_QUALITIES`, `SET_QUALITY`) safely without CSP or Trusted Types violations.
**Plans**: 1 plan

Plans:
- [ ] 01-01-PLAN.md — MV3 manifest, PNG icons, service worker, popup UI + storage layer, and dual-world `page-bridge.js` RPC contract

### Phase 2: Watch-Page Controls, Playback Speed & Dynamic Quality Engine
**Goal**: Inject compact native-feeling `[ 1.0x ▼ ] [ 1080p ▼ ]` controls directly above YouTube's Like button on standard watch pages with full playback speed sync, custom rate support, dynamic quality discovery/application with verification/fallback, and Light/Dark theme matching.
**Depends on**: Phase 1
**Requirements**: SPEED-01, SPEED-02, SPEED-03, SPEED-04, SPEED-05, QUAL-01, QUAL-02, QUAL-03, QUAL-04, QUAL-05, UI-01, UI-02, UI-03, UI-04, UI-05
**Success Criteria** (what must be TRUE):
  1. On a standard `/watch` page, compact speed and quality pill buttons render directly above YouTube's Like button without overlapping adjacent controls or altering native buttons.
  2. Changing speed (including custom rates) immediately adjusts `video.playbackRate` without pausing/restarting, and external speed changes (`ratechange` / keyboard shortcuts) sync back to the UI cleanly.
  3. Quality dropdown displays only dynamically available resolutions (plus `Auto` when available), applies switches, verifies confirmation, and gracefully rolls back with a subtle non-color-only tooltip on failure.
  4. Dropdowns adapt to YouTube's Dark and Light modes, stay keyboard/pointer accessible, close on outside click or `Escape`, and handle loading/limited-resolution videos cleanly.
**Plans**: 1 plan

Plans:
- [ ] 02-01-PLAN.md — Watch-page anchor discovery, accessible pill/popover dropdown UI, speed & quality engines, verification/rollback tooltip, and YouTube theme CSS

### Phase 3: Fullscreen Mode, YouTube Shorts & SPA Lifecycle
**Goal**: Ensure controls stay visible, interactive, and accurately placed above the Like button in fullscreen (Delhi overlay + classic player fallback) and YouTube Shorts, while surviving arbitrary YouTube SPA navigation and automatically applying saved defaults without duplicates or leaks.
**Depends on**: Phase 2
**Requirements**: FULL-01, FULL-02, FULL-03, SHORTS-01, SPA-01, SET-03
**Success Criteria** (what must be TRUE):
  1. Entering/exiting fullscreen keeps controls inside `document.fullscreenElement`, positioned cleanly above the fullscreen Like button (Delhi overlay) or above `.ytp-chrome-controls` (classic fallback), never clipped or paused on click, and without controls auto-hiding while a dropdown is open.
  2. Navigating across Watch, Search, Recommendations, Back/Forward, Home, and Shorts injects at most one control bar per active player, binds to the active Shorts `<video>` (`ytd-reel-video-renderer[is-active]`), and tears down prior observers/listeners cleanly.
  3. Newly loaded videos automatically apply enabled user defaults (`defaultSpeed`, best matching `defaultQuality`) when `autoApply` is enabled.
**Plans**: 1 plan

Plans:
- [ ] 03-01-PLAN.md — Fullscreen Top-Layer controller, Shorts active-reel engine, SPA navigation lifecycle manager, and auto-apply defaults

### Phase 4: Documentation, Automated Test Suite & End-to-End Verification
**Goal**: Complete user and technical documentation, execute thorough automated unit/DOM/headless-Chrome verification across all requirements and modes, fix any uncovered bugs, and produce final GSD verification & UAT artifacts.
**Depends on**: Phase 3
**Requirements**: DOC-01, VER-01
**Success Criteria** (what must be TRUE):
  1. `youtube-quick-controls/README.md` (and root `README.md`) clearly explain installation, Load Unpacked steps in Chrome, fullscreen DOM injection strategy, and known YouTube quality API limitations.
  2. Automated test suite under `tests/` passes 100% after final edits (covering MV3/icons, watch/fullscreen/Shorts placement, speed/quality sync + rollback, SPA navigation, themes, popup storage, and headless Chromium unpacked load verification).
  3. Zero placeholder functions, zero TODOs, and verified clean git working tree with GSD `VERIFICATION.md` and `UAT.md` completed.
**Plans**: 1 plan

Plans:
- [ ] 04-01-PLAN.md — Comprehensive README documentation, automated Node/DOM/Chrome test suite, bug-fix pass, and final verification

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Extension Foundation, Storage & Dual-World Bridge | 0/1 | Planned | - |
| 2. Watch-Page Controls, Playback Speed & Dynamic Quality Engine | 0/1 | Planned | - |
| 3. Fullscreen Mode, YouTube Shorts & SPA Lifecycle | 0/1 | Planned | - |
| 4. Documentation, Automated Test Suite & End-to-End Verification | 0/1 | Planned | - |
