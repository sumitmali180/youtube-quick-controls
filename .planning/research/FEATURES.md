# Feature Research: YouTube Quick Controls

**Domain:** Browser Extension / YouTube Video Player UX Enhancements (Manifest V3)  
**Researched:** 2026-11-11  
**Confidence:** HIGH  

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing any of these makes the extension feel broken or intrusive.

| Feature | Why Expected | Complexity | Implementation Notes |
|---------|--------------|------------|----------------------|
| **Playback Speed Presets (0.25x–3.0x)** | Standard YouTube speed presets exist in 0.25x steps; users expect instant switching without navigating deep gear menus. | LOW | Directly modifies HTML5 `video.playbackRate`. Presets: `0.25x`, `0.5x`, `0.75x`, `1.0x`, `1.25x`, `1.5x`, `1.75x`, `2.0x`, `2.5x`, `3.0x`. Listens for `ratechange` event on `<video>` to maintain bidirectional sync. |
| **Dynamic Video Quality Selector + "Auto"** | Users want to lock resolution (1080p, 1440p, 4K, 720p, etc.) or set to Auto in 1 click. Crucially, options must reflect *only* what the current video actually provides. | HIGH | Requires MV3 `MAIN` world bridge to query `#movie_player.getAvailableQualityLevels()` / `getAvailableQualityData()`. Formats human-readable labels (`4K / 2160p`, `1440p`, `1080p`, `720p`, `480p`, `360p`, `240p`, `1440p`, `Auto`). |
| **Watch-Page Placement Directly Above Like Button** | Core UX promise of the extension: controls must anchor directly above YouTube's segmented Like/Dislike action bar (`segmented-like-dislike-button-view-model` inside `ytd-watch-metadata`), visually unified with action buttons. | MEDIUM | Uses a mutation observer to locate metadata actions container, injects `.yqc-controls-container` above the like button bar with zero layout thrashing or overflow clipping. |
| **Fullscreen Player Integration (Delhi & Classic)** | When entering fullscreen, standard watch-page DOM is hidden beneath the browser's Top Layer (`document.fullscreenElement`). Controls must remain visible and interactive in fullscreen. | HIGH | Listens to `fullscreenchange`. In modern YouTube "Delhi" layout, attaches to `.ytp-fullscreen-quick-actions` or top player controls; in classic layout, anchors inside `#movie_player` above bottom controls. Must prevent z-index clipping and overlay autohide collisions. |
| **YouTube SPA Navigation Handling** | YouTube is a Polymer/SPA application (`ytd-app`). Page changes occur without full reloads via client-side routing. | MEDIUM | Listens to `yt-navigate-finish`, `yt-page-data-updated`, and `popstate`. Re-binds to new `<video>` elements, updates quality lists, re-checks DOM anchors, and cleanly tears down previous observers to eliminate duplicate injections and memory leaks. |
| **Theme Matching (Light & Dark Mode)** | YouTube supports dynamic light and dark themes, as well as ambient mode. Controls must not clash or be unreadable. | LOW | Uses YouTube's native CSS custom properties (`--yt-spec-text-primary`, `--yt-spec-text-secondary`, `--yt-spec-menu-background`, `--yt-spec-badge-chip-background`, `--yt-spec-10-percent-layer`). Adapts automatically without hardcoded colors. |
| **Bidirectional State Synchronization** | If the user changes speed via keyboard (`Shift+>` / `Shift+<`) or native gear settings, the quick controls pill label must reflect the new state instantly. | MEDIUM | Subscribes to HTML5 `ratechange` event on active `<video>` element, and polls/receives quality change events (`onPlaybackQualityChange`) from the `MAIN` world bridge. |
| **MV3 Settings Popup & Sync Storage** | Users need an accessible popup to set defaults (e.g., always default to 1.5x speed, always prefer 1080p) and toggle features on/off. | MEDIUM | Built with vanilla HTML/CSS/JS in `popup/`. Backed by `chrome.storage.sync` with automatic fallback to `chrome.storage.local` if sync is quota-throttled or disabled. |

---

### Differentiators (Competitive Advantage)

Features that set YouTube Quick Controls apart from legacy or bloated alternatives (e.g., Enhancer for YouTube).

| Feature | Value Proposition | Complexity | Implementation Notes |
|---------|-------------------|------------|----------------------|
| **Native YouTube Look-and-Feel (Compact Pill UI)** | Zero visual clutter. Styled exactly like YouTube's Delhi-spec rounded pill chips (`border-radius: 18px`, YouTube font stack, subtle hover states). Looks like an official YouTube native feature rather than a third-party hack. | LOW | Uses YouTube chip styling conventions, matching font-family (`Roboto`, sans-serif), elevation, transitions, and SVG dropdown carats. |
| **Custom Playback Speed Input** | Power users frequently want non-standard speeds (e.g., `1.15x`, `1.6x`, `2.2x`, or up to `5.0x`) not offered by YouTube's fixed 0.25x steps. | MEDIUM | Dropdown includes a "Custom..." action that reveals an inline precision numeric input / quick-stepper (0.1x to 16.0x with 0.05x resolution), validating and applying instantly. |
| **Dynamic Quality Transition Verification & Graceful Fallback** | YouTube's `setPlaybackQualityRange()` request can fail or take several seconds to buffer. Competitor extensions often display the requested quality immediately even if YouTube ignores it. | HIGH | Bridges to `MAIN` world, initiates quality switch, listens for `onPlaybackQualityChange`, verifies active quality against requested target, and shows a subtle spinner/pulse state with non-intrusive fallback if YouTube cannot fulfill the bitrate. |
| **Seamless YouTube Shorts Support** | Shorts player hides playback speed and quality behind secondary menus. Placing speed/quality pills above the action column on Shorts dramatically improves Shorts viewing. | HIGH | Observes `ytd-reel-video-renderer` active items, anchors controls above the right-hand action column (Like/Dislike/Comments stack) on desktop Shorts view, binding to the active short's `<video>`. |
| **Strict CSP Dual-World MV3 Architecture** | Complete compliance with Manifest V3 security rules. Zero inline script tags, zero `eval()`, zero blob injection hacks. | MEDIUM | Uses declarative `world: "MAIN"` bridge content script communicating with `world: "ISOLATED"` UI script via strongly typed, origin-checked `window.postMessage` protocol. Zero host permission bloat (`<all_urls>` avoided; scoped exclusively to `https://www.youtube.com/*`). |
| **Zero-Bundle, Load-Unpacked Clean Root** | Pure Vanilla JS/CSS/HTML with zero npm/webpack/Vite overhead. Can be loaded unpacked immediately from `youtube-quick-controls/` folder. | LOW | Organized into clean modular ES files, no build step required, no bloated dependencies, tiny disk footprint (< 100 KB total). |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem appealing on the surface but create security, maintenance, or platform issues.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Intercepting / Rewriting Video Stream URLs (DASH/HLS)** | "Guarantee 4K bitrate or bypass auto-downgrading." | Breaks YouTube DRM (Widevine / Encrypted Media Extensions), triggers CORS failures, violates YouTube TOS, and causes constant player crashes whenever YouTube updates playback manifests. | Use official `#movie_player.setPlaybackQualityRange(val, val)` and `#movie_player.setPlaybackQuality(val)` via the `MAIN` world bridge. |
| **Video Downloading / Audio Ripping** | "Download video at selected resolution." | Immediate violation of Chrome Web Store policies (results in extension takedown), legal liability, and massive code bloat. | Explicitly out of scope. Refer users to dedicated external open-source tools (yt-dlp). |
| **Ad-Blocking / Sponsor Skipping** | "All-in-one YouTube enhancer." | Engages in cat-and-mouse detection warfare with YouTube anti-adblock scripts, resulting in video playback pauses or account warnings. | Keep extension strictly focused on player UX controls. Works seamlessly alongside dedicated user ad-blockers without conflict. |
| **Modifying YouTube's Native Like Button Behavior** | "Enhance the like button or alter its click handler." | Breaks YouTube analytics, conflicts with A/B testing variations of the Polymer action bar, and risks breaking user engagement. | Never alter the Like button itself. Anchor an independent container *above* or adjacent to the Like button bar with CSS flexbox layout. |
| **Hardcoded Static Quality Lists** | "Simpler code without querying player API." | Offering 1080p, 1440p, or 4K on a 480p archival video causes broken UI states, silent failures, and user frustration. | Always query `getAvailableQualityLevels()` / `getAvailableQualityData()` dynamically on each video load. |
| **Broad Host Permissions (`<all_urls>` / `*://*/*`)** | "Allow extension to work everywhere or inject helpers." | Triggers intense Chrome Web Store review scrutiny, triggers permission warnings during installation ("Can read and change data on all websites"), and compromises security. | Strict minimal permissions: `storage` only, with content scripts strictly scoped to `*://*.youtube.com/*`. |

---

## Feature Dependencies

```
[Dual-World MV3 Bridge] (MAIN <-> ISOLATED)
    └──enables──> [Dynamic Video Quality API Access]
                      └──requires──> [Quality Dropdown Pill UI]
                                         └──requires──> [DOM Anchor Engine (Watch & Fullscreen)]

[HTML5 <video> Event Listener]
    └──enables──> [Playback Speed Control (video.playbackRate)]
                      └──requires──> [Speed Dropdown Pill UI]
                                         └──requires──> [DOM Anchor Engine (Watch & Fullscreen)]

[YouTube SPA Navigation Observer]
    └──triggers──> [Re-anchoring & Element Binding]
    └──triggers──> [Dynamic Quality Re-query]
    └──triggers──> [Storage Defaults Auto-Apply]

[chrome.storage.sync Storage Layer]
    ├──configures──> [Popup Settings UI]
    └──enables──> [Storage Defaults Auto-Apply]

[Fullscreen Change Observer]
    └──switches──> [Watch Page Anchor] <──mutually exclusive──> [Fullscreen Top-Layer Anchor]

[Shorts Viewport Observer]
    └──switches──> [Watch Page Anchor] <──mutually exclusive──> [Shorts Action Reel Anchor]
```

### Dependency Notes

- **Dynamic Video Quality API requires Dual-World MV3 Bridge:** Manifest V3 content scripts run in an `ISOLATED` execution environment and cannot access properties attached to DOM nodes by YouTube's page scripts (such as `#movie_player.getAvailableQualityLevels`). The `MAIN` world script executes in the page context to interact with `#movie_player` and communicates with the `ISOLATED` UI script via postMessage.
- **Speed & Quality Pills require DOM Anchor Engine:** The pills cannot render in a vacuum. The anchor engine must identify the exact YouTube Web Component container (`segmented-like-dislike-button-view-model` on watch pages, `.ytp-fullscreen-quick-actions` or `#movie_player` in fullscreen, and `ytd-reel-video-renderer` on Shorts).
- **Storage Defaults Auto-Apply requires YouTube SPA Navigation Observer:** When a new video starts (`yt-navigate-finish`), the extension must read user preferences from `chrome.storage.sync` (e.g. default speed `1.5x`, default quality `1080p`) and apply them once the player finishes loading available qualities.
- **Fullscreen vs. Watch Page Anchoring is Mutually Exclusive:** When entering fullscreen (`document.fullscreenElement != null`), the watch page DOM is obscured by the browser's top layer. The controls must dynamically migrate or toggle visibility to the top-layer container, returning to the metadata bar upon exiting fullscreen.

---

## MVP Definition

### Launch With (v1)

Minimum viable product required to validate the core user experience and achieve production-grade reliability.

- [x] **Dual-World MV3 Bridge (`world: "MAIN"` + `world: "ISOLATED"`):** Secure postMessage bridge enabling `#movie_player` quality API queries and quality changes without CSP violations.
- [x] **Playback Speed Dropdown Pill (`[ 1.0x ▼ ]`):**
  - Presets: `0.25x`, `0.5x`, `0.75x`, `1.0x`, `1.25x`, `1.5x`, `1.75x`, `2.0x`, `2.5x`, `3.0x`.
  - Immediate `video.playbackRate` update without pausing or buffering.
  - Bidirectional sync with `ratechange` events.
- [x] **Dynamic Video Quality Dropdown Pill (`[ 1080p ▼ ]`):**
  - Dynamic discovery of active qualities via `getAvailableQualityLevels()`.
  - Clean labeling (`4K`, `1440p`, `1080p`, `720p`, `480p`, `360p`, `240p`, `144p`, `Auto`).
  - Active resolution checkmark and visual transition feedback.
- [x] **Watch-Page Placement Directly Above Like Button:**
  - Injected directly above `segmented-like-dislike-button-view-model` in `ytd-watch-metadata`.
  - Styled with YouTube native pill aesthetic (rounded corners, dark/light theme CSS variables).
- [x] **Fullscreen Player Integration:**
  - Modern Delhi UI support (`.ytp-fullscreen-quick-actions`).
  - Classic player fallback inside `document.fullscreenElement` / `#movie_player`.
  - Resilient z-index and top-layer visibility.
- [x] **YouTube SPA Navigation Lifecycle:**
  - Clean re-injection on `yt-navigate-finish`, `yt-page-data-updated`, and browser history events.
  - Zero duplicate pills or orphaned event listeners.
- [x] **Popup Settings UI & Storage Sync:**
  - MV3 popup with toggles: Enable/disable controls, default speed preset, default quality preference, auto-apply on video start.
  - Stored in `chrome.storage.sync` with `chrome.storage.local` fallback.

### Add After Validation (v1.x)

Features to add once core watch-page and fullscreen usage is validated and stable.

- [ ] **Custom Playback Speed Input:** An inline precision stepper / input field in the speed dropdown allowing rates like `1.15x`, `1.85x`, or `3.5x` (up to `16.0x`).
- [ ] **Desktop YouTube Shorts Support:** Anchor controls above the action buttons on `ytd-reel-video-renderer` desktop reels.
- [ ] **High Frame Rate & HDR Badges:** Display `60fps` and `HDR` badges next to quality items (e.g. `1080p60 HDR`).
- [ ] **Keyboard Shortcuts (Hotkeys):** Quick keys to cycle through favorite speeds or bump speed by `+0.1x` / `-0.1x`.

### Future Consideration (v2+)

Features to defer until user feedback confirms demand.

- [ ] **Per-Channel Default Rules:** Automatically use `1.5x` on podcast/tutorial channels but `1.0x` on music/movie channels.
- [ ] **Audio Pitch Correction / Volume Booster:** Independent pitch correction slider or 200% volume boost for quiet videos.
- [ ] **Embedded Player Support:** Inject quick controls into embedded YouTube iframes (`youtube.com/embed/*`).

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Rationale |
|---------|------------|---------------------|----------|-----------|
| **Speed Pill Dropdown (0.25x–3.0x)** | HIGH | LOW | **P1** | Core functionality; instant value with minimal overhead via HTML5 API. |
| **Dynamic Quality Pill Dropdown + Auto** | HIGH | HIGH | **P1** | Primary reason users install quality tools; requires MV3 dual-world bridge. |
| **Watch-Page Like-Button Placement** | HIGH | MEDIUM | **P1** | Definitive UX differentiator; seamless native integration above actions bar. |
| **Fullscreen Player Integration** | HIGH | HIGH | **P1** | High percentage of watch time is spent in fullscreen; essential table stake. |
| **SPA Navigation & Lifecycle Resilience** | HIGH | MEDIUM | **P1** | Without rock-solid SPA support, extension breaks on first clicked video. |
| **Light & Dark Theme Dynamic Styling** | MEDIUM | LOW | **P1** | Prevents visual breakage and ensures polished native feel. |
| **Popup Settings UI & Storage Sync** | MEDIUM | MEDIUM | **P1** | Essential for user customization and setting persistent defaults. |
| **Custom Playback Speed Input** | MEDIUM | MEDIUM | **P2** | Highly requested by power users; builds naturally on v1 speed engine. |
| **Desktop YouTube Shorts Support** | MEDIUM | HIGH | **P2** | High value for Shorts viewers, but Shorts DOM structure is distinct from watch page. |
| **Quality Verification & Fallback Feedback** | MEDIUM | MEDIUM | **P2** | Improves UX during buffering or when YouTube ignores resolution changes. |
| **Framerate & HDR Badges (60fps, HDR)** | LOW | LOW | **P2** | Visual polish for videophiles; reads easily from player quality metadata. |
| **Keyboard Shortcut Triggers** | MEDIUM | LOW | **P2** | Useful utility for hands-free power users. |
| **Per-Channel Settings** | MEDIUM | HIGH | **P3** | Complex channel ID caching; defer until core experience is battle-tested. |
| **Embedded iFrame Support** | LOW | HIGH | **P3** | Different sandboxing and layout constraints; niche usage compared to youtube.com. |

**Priority key:**
- **P1:** Non-negotiable for initial v1 release.
- **P2:** Fast-follow enhancement after core validation.
- **P3:** Future roadmap candidate.

---

## Competitor Feature Analysis

| Feature | Enhancer for YouTube | YouTube Playback Speed Control | Native YouTube Gear Menu | Our Approach (YouTube Quick Controls) |
|---|---|---|---|---|
| **Placement & Footprint** | Fixed toolbar below player or pinned overlay; heavy UI clutter with 30+ icons. | Floating overlay in top-left corner of video; covers video content. | Nested inside settings gear icon; requires 3 clicks per adjustment. | **Directly above Like button** on watch page; clean compact pills that match YouTube's design system. |
| **Fullscreen Accessibility** | Toolbar disappears or requires mouse hover to reveal bottom bar. | Static overlay floats over video; distracts from viewing. | Nested gear menu requires opening full controls bar. | **Integrated in fullscreen Top Layer** (both Delhi quick actions and classic player fallback). |
| **Dynamic Quality Detection** | Often forces quality via aggressive script injection; can stutter stream. | Speed only (no quality control). | Shows available qualities, but hidden behind 3 menu clicks. | **Dynamic query of player API**; shows only available resolutions + Auto with smooth transition. |
| **Speed Range & Control** | Slider or button steps; bulky controls. | Text overlay with keyboard shortcuts (`[` and `]`). | 0.25x–2.0x in 0.25x steps (up to 2.0x only). | **0.25x–3.0x presets** + seamless custom rate support up to arbitrary speeds. |
| **Architecture & Permissions** | Heavy MV2/MV3 legacy codebase with broad permissions and feature bloat. | Simple content script, often broken by YouTube UI updates. | Native Polymer/Wiz implementation. | **Clean Vanilla MV3 dual-world bridge**; minimum permissions (`storage` only, scoped to youtube.com). |
| **Shorts Support** | Inconsistent or disabled on Shorts reels. | Inconsistent floating overlay. | Hidden behind 3-dot kebab menu. | **Dedicated anchor above Shorts action stack**. |

---

## Sources

- YouTube Web Component DOM Inspection (`ytd-app`, `ytd-watch-metadata`, `segmented-like-dislike-button-view-model`, `#movie_player`, `.ytp-fullscreen-quick-actions`, `ytd-reel-video-renderer`).
- Chrome Extensions Manifest V3 Content Script `world: "MAIN"` API Specification (Chrome 111+).
- YouTube HTML5 Player JS API Reference (`getAvailableQualityLevels`, `getPlaybackQuality`, `setPlaybackQualityRange`, `setPlaybackQuality`, `video.playbackRate`, `video.onratechange`).
- Chrome Extensions Storage API Specification (`chrome.storage.sync`, `chrome.storage.local`).
- YouTube Delhi UI design system specifications (rounded pill buttons, CSS variables `--yt-spec-*`).

---
*Feature research for: YouTube Quick Controls*  
*Researched: 2026-11-11*  
