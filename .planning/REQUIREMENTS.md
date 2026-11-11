# Requirements: YouTube Quick Controls

**Defined:** 2026-11-11
**Core Value:** Eliminate nested YouTube Settings gear navigation by providing instant, reliable Playback Speed and Video Quality controls directly above YouTube's Like button across normal watch pages, fullscreen mode, and Shorts.

## v1 Requirements

### Extension Foundation & Dual-World Bridge

- [ ] **FOUND-01**: Extension uses valid Manifest V3 (`manifest_version: 3`) in self-contained `youtube-quick-controls/` directory ready for Chrome "Load unpacked".
- [ ] **FOUND-02**: Requests strictly minimal permissions (`"storage"`) and scopes content scripts to `https://www.youtube.com/*`; includes real valid PNG icons (`16`, `48`, `128`).
- [ ] **FOUND-03**: Communicates between `world: "MAIN"` (`page-bridge.js`) and `world: "ISOLATED"` (`content.js`) via source/origin-verified `window.postMessage` RPC without CSP/Trusted Types violations or inline `<script>` tags.
- [ ] **FOUND-04**: Never intercepts or modifies YouTube network requests, media streams, or native YouTube Like/Dislike button click handlers.
- [ ] **FOUND-05**: Includes MV3 background service worker (`background.js`) registering synchronous top-level listeners (`onInstalled`, `onMessage`) and seeding default preferences without relying on in-memory globals.

### Playback Speed Control

- [ ] **SPEED-01**: Displays a compact pill dropdown trigger (`[ 1.0x ▼ ]`) showing the active video's current playback speed.
- [ ] **SPEED-02**: Provides all standard presets (`0.25x`, `0.5x`, `0.75x`, `1.0x`, `1.25x`, `1.5x`, `1.75x`, `2.0x`, `2.25x`, `2.5x`, `3.0x`) and highlights the currently active speed.
- [ ] **SPEED-03**: Selecting a speed immediately sets `video.playbackRate` without pausing, seeking, or restarting the video.
- [ ] **SPEED-04**: Synchronizes displayed speed bidirectionally on HTML5 `<video>` `ratechange` events (including changes from YouTube native controls or keyboard shortcuts like `Shift+>` / `Shift+<`) without feedback loops.
- [ ] **SPEED-05**: Supports custom playback rates exposed by YouTube / active playbackRate (e.g., slider/custom rate values such as `1.15x`) and allows applying custom rates safely.

### Video Quality Control

- [ ] **QUAL-01**: Dynamically queries available resolutions from YouTube's player API (`getAvailableQualityLevels` / `getAvailableQualityData` across `#movie_player` / `#shorts-player`) and never shows unavailable resolutions as selectable options.
- [ ] **QUAL-02**: Displays human-readable resolution labels (`144p`, `240p`, `360p`, `480p`, `720p`, `1080p`, `1440p`, `2160p (4K)`, etc.) and supports `Auto` when available (including showing active auto-resolved resolution where known).
- [ ] **QUAL-03**: Selecting a resolution invokes `setPlaybackQualityRange` (with `setPlaybackQuality` fallback) cleanly, without network interception.
- [ ] **QUAL-04**: Verifies quality changes via player events/queries; never falsely marks an unapplied quality as active, and on rejection/failure keeps previous visible quality selected while displaying a subtle non-color-only error message/tooltip and graceful fallback.
- [ ] **QUAL-05**: Handles videos that are still loading, videos with limited resolutions (e.g., 360p/480p max), and updates displayed quality dynamically when YouTube changes quality (`onPlaybackQualityChange`).

### UI/UX & Watch-Page Placement

- [ ] **UI-01**: Injects two compact pill dropdowns directly **above** YouTube's Like button on standard watch pages, aligned cleanly with the existing video action toolbar without modifying YouTube's native buttons or causing layout breaks.
- [ ] **UI-02**: Dropdown menus feature YouTube-compatible dark/light styling (`#282828` menu surface in dark mode, light surface in light mode), rounded corners, subtle borders/shadows, smooth hover states, clear active highlight, and scrollable list when tall.
- [ ] **UI-03**: Dropdowns close cleanly on outside click, pressing `Escape`, or opening the sibling dropdown, and never clip offscreen (viewport-aware upward/flip positioning).
- [ ] **UI-04**: Adapts dynamically to YouTube's Light and Dark themes (`html[dark]` / `ytd-app[dark]` + fullscreen dark player context), independent of OS color-scheme mismatch.
- [ ] **UI-05**: Accessible keyboard navigation (`ArrowUp`/`ArrowDown`/`Home`/`End`, `Escape` focus return), `>= 24x24` CSS px hit targets, and visible `:focus-visible` rings without consuming YouTube hotkeys globally or pausing playback when clicked.

### Fullscreen, Shorts & SPA Lifecycle

- [ ] **FULL-01**: Remains visible, usable, non-overlapping, and consistently styled when entering/exiting fullscreen (`fullscreenchange`, `document.fullscreenElement`).
- [ ] **FULL-02**: Positions controls directly above the fullscreen Like button inside modern YouTube fullscreen overlay (`.ytp-fullscreen-quick-actions` / Top Layer), and provides a clean non-overlapping classic fullscreen fallback inside `document.fullscreenElement` (`#movie_player` above `.ytp-chrome-controls`).
- [ ] **FULL-03**: Prevents click-through play/pause toggling, prevents hotkey interception inside open dropdowns, avoids `.ytp-fullscreen-quick-actions` / `.ytp-chrome-bottom` overflow clipping, and keeps player controls alive while interacting with open menus in fullscreen.
- [ ] **SHORTS-01**: Supports YouTube Shorts (`ytd-reel-video-renderer[is-active]`, `#shorts-player`) by binding to the active reel's `<video>` and anchoring above the active reel's Like button without affecting preloaded off-screen Shorts.
- [ ] **SPA-01**: Handles YouTube SPA navigation (`yt-navigate-finish`, `yt-page-data-updated`, `popstate`, URL/video changes, back/forward, Watch <-> Shorts <-> Home) with debounced subtree observation, zero duplicate controls, and full `AbortController` / observer cleanup on teardown.

### Settings, Persistence & Auto-Apply

- [ ] **SET-01**: Provides `popup.html`, `popup.css`, and `popup.js` configuring: Enable/Disable controls, Default playback speed, Default video quality, and Auto-apply defaults on new videos.
- [ ] **SET-02**: Persists settings in `chrome.storage.sync` (with `chrome.storage.local` fallback if sync fails) with defaults `{ enabled: true, defaultSpeed: 1.0, defaultQuality: "auto", autoApply: true }`, and reacts live via `chrome.storage.onChanged`.
- [ ] **SET-03**: When enabled and `autoApply` is true, automatically applies saved default speed and best matching available default quality to newly loaded videos without throwing errors if preferred resolution exceeds video max.

### Documentation & Verification

- [ ] **DOC-01**: Provides complete `youtube-quick-controls/README.md` (and root `README.md`) documenting features, Chrome Load Unpacked instructions, fullscreen DOM injection architecture, and known YouTube quality API limitations.
- [ ] **VER-01**: Verified end-to-end with automated unit & DOM integration tests (watch, fullscreen Delhi & classic, Shorts, speed/quality sync & failure rollback, SPA navigation, theme adaptation, popup/storage) AND real Chromium extension loading check with 100% passing suite after final edit.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Intercepting or modifying YouTube network requests / DASH manifests | Explicitly prohibited by security/stability requirements; breaks DRM and violates platform integrity |
| Video downloading or audio extraction | Chrome Web Store policy violation and outside scope |
| Ad blocking / SponsorBlock | Scope creep outside speed and quality quick controls |
| Modifying native YouTube Like/Dislike functionality | Native buttons must remain completely untouched |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01..05 | Phase 1 | Pending |
| SET-01..02 | Phase 1 | Pending |
| SPEED-01..05 | Phase 2 | Pending |
| QUAL-01..05 | Phase 2 | Pending |
| UI-01..05 | Phase 2 | Pending |
| FULL-01..03 | Phase 3 | Pending |
| SHORTS-01 | Phase 3 | Pending |
| SPA-01 | Phase 3 | Pending |
| SET-03 | Phase 3 | Pending |
| DOC-01 | Phase 4 | Pending |
| VER-01 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

---
*Requirements defined: 2026-11-11*
*Last updated: 2026-11-11 after research synthesis*
