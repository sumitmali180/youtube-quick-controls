# Pitfalls Research

**Domain:** YouTube DOM & Manifest V3 Chrome Extension  
**Researched:** 2026-11-11  
**Confidence:** HIGH  

---

## Critical Pitfalls

### Pitfall 1: MV3 Isolated World Blocking `#movie_player` API & YouTube Trusted Types CSP Blocking Inline `<script>` Injection

**What goes wrong:**  
Content scripts in Manifest V3 run in Chrome's `ISOLATED` execution world by default. Although isolated content scripts share the live DOM with the web page, they execute in a completely isolated JavaScript heap with a distinct `window` object and prototype chain. YouTube's HTML5 video player instance (`document.getElementById('movie_player')` or `document.querySelector('.html5-video-player')`) exposes its internal playback and quality APIs—such as `getAvailableQualityLevels()`, `getPlaybackQuality()`, `setPlaybackQualityRange()`, `setPlaybackQuality()`, and `getAvailableQualityData()`—exclusively on its element prototype in YouTube's `MAIN` execution world. Calling these methods from an isolated content script returns `undefined` or throws a fatal error: `TypeError: moviePlayer.getAvailableQualityLevels is not a function`.

Historically (in MV2 and legacy user scripts), developers bypassed world isolation by injecting an inline `<script>` tag:
```javascript
// DO NOT DO THIS — FAILS CATASTROPHICALLY ON MODERN YOUTUBE
const script = document.createElement('script');
script.textContent = `document.getElementById('movie_player').setPlaybackQualityRange('hd1080', 'hd1080');`;
document.head.appendChild(script);
```
On modern YouTube, this injection triggers an immediate Content Security Policy (CSP) violation. YouTube strictly enforces Trusted Types (`Content-Security-Policy: require-trusted-types-for 'script'`). Browser consoles will log:
`[Report Only] Refused to execute inline script because it violates the following Content Security Policy directive...` and `TypeError: Failed to set the 'textContent' property on 'Node': This document requires 'TrustedScript' assignment.` The extension is blocked from reading or controlling video quality altogether.

**Why it happens:**  
Developers assume DOM elements expose the same JavaScript object references across both extension worlds, or rely on outdated StackOverflow / MV2 patterns using inline `<script>` injection without accounting for Trusted Types CSP restrictions.

**How to avoid:**  
1. Architect the extension as a clean dual-world system using native Manifest V3 declarative content scripts in `manifest.json`:
   - Declare a lightweight bridge script configured with `"world": "MAIN"`. Chrome injects this script directly into YouTube's execution context, granting full, native access to `#movie_player` and its player methods without creating inline scripts or violating Trusted Types.
   - Declare the core extension UI, styling, and storage logic in a content script configured with `"world": "ISOLATED"`, retaining access to `chrome.storage` and extension APIs.
2. Establish secure, asynchronous bi-directional communication between the `MAIN` world bridge and the `ISOLATED` world UI controller via `window.postMessage`:
   - Enforce a strict message contract with a unique namespaced prefix (e.g., `SPEEDOQ_YQC_REQ_*` and `SPEEDOQ_YQC_RES_*`).
   - Validate `event.source === window` and `event.origin === window.location.origin` (strictly `https://www.youtube.com`).
   - Prevent data leakage by serializing only plain JSON primitives (no functions or raw prototypes).

**Warning signs:**  
- `TypeError: player.getAvailableQualityLevels is not a function` in the DevTools console.
- CSP or Trusted Types errors: `This document requires 'TrustedScript' assignment`.
- Quality dropdown displays only fallback or empty options despite the video playing in 1080p/4K.

**Phase to address:**  
Phase 1: Architecture, Manifest V3 Foundation & Dual-World Bridge.

---

### Pitfall 2: Fullscreen Top Layer Hiding Elements Outside `document.fullscreenElement`

**What goes wrong:**  
When a user toggles fullscreen mode on YouTube (by pressing the 'f' key, double-clicking the video, or clicking the native fullscreen button), the browser invokes the HTML Fullscreen API (`element.requestFullscreen()`). YouTube initiates fullscreen on the video player container (typically `div#player-container`, `ytd-watch-flexy`, or `#movie_player`).

The browser renders `document.fullscreenElement` in an isolated browser-level stacking context known as the **Top Layer**. The Top Layer sits above all other elements in the document:
- Any element located outside `document.fullscreenElement`—such as the standard watch page action toolbar (`ytd-watch-metadata #actions`), the main Like button, or elements appended to `document.body`—is completely invisible behind the Top Layer.
- Setting `z-index: 2147483647` or `position: fixed` on elements outside `document.fullscreenElement` has zero effect; CSS stacking contexts cannot transcend the Top Layer boundary.
- If the extension simply anchors controls above the watch page Like button, those controls vanish the instant the video enters fullscreen mode.

**Why it happens:**  
Developers test controls only in the standard windowed watch view, assuming `position: fixed` with maximum `z-index` will float above fullscreen content.

**How to avoid:**  
1. Implement dynamic fullscreen tracking using standard `fullscreenchange` and `webkitfullscreenchange` event listeners on `document`.
2. Support YouTube's dual fullscreen DOM topologies:
   - **Modern Delhi Fullscreen UI:** YouTube provides a dedicated fullscreen quick-actions container (`.ytp-fullscreen-quick-actions` inside `.ytp-chrome-bottom`), which contains a mirrored fullscreen Like button (`button[aria-label^="like"]`). Mount or teleport the extension's pill controls into this container directly above the fullscreen Like button.
   - **Classic Fullscreen Fallback:** If `.ytp-fullscreen-quick-actions` is absent, mount a dedicated fullscreen instance of the controls directly inside `#movie_player` / `document.fullscreenElement`. Anchor it above the control bar (`.ytp-chrome-bottom`), styled with matching YouTube player button tokens and high z-index *within* the player's subtree.
3. Automatically detach, hide, or restore the controls when exiting fullscreen mode back to standard watch view.

**Warning signs:**  
- Controls work perfectly on regular watch pages, but disappear completely when pressing 'f'.
- Inspecting DOM shows the injected element still has `display: block` and `opacity: 1`, but its parent node is not an ancestor or descendant of `document.fullscreenElement`.

**Phase to address:**  
Phase 3: Fullscreen Top Layer & YouTube Shorts Integration.

---

### Pitfall 3: YouTube SPA DOM Node Recycling, Navigation Races & Duplicate Control Injections

**What goes wrong:**  
YouTube operates as a complex Single Page Application (built on Polymer / Web Components). When users navigate between videos, click related suggestions, or use browser back/forward buttons, the browser does not perform a full page reload. Instead:
1. YouTube dispatches custom lifecycle events: `yt-navigate-start`, `yt-navigate-finish`, `yt-page-data-updated`.
2. YouTube recycles existing DOM elements: `ytd-watch-metadata`, `div#actions`, and `segmented-like-dislike-button-view-model` may be detached, re-attached, emptied, or reused for subsequent videos.
3. If an extension naively injects controls on `window.onload` or runs an un-debounced, un-scoped `MutationObserver`, several severe bugs occur:
   - **Duplicate controls:** Multiple identical speed and quality pill buttons stack on top of each other above the Like button (e.g., 4 speed dropdowns appearing after 4 video clicks).
   - **Orphaned injections:** Controls are injected into an old DOM node that YouTube detaches a millisecond later, leaving the user with no visible controls on the new video.
   - **Stale data & memory leaks:** Event listeners and state from Video A persist while Video B plays, showing Video A's resolution options and leaking memory over long viewing sessions.

**Why it happens:**  
Treating YouTube like a traditional multi-page website, relying on global page load events, or failing to implement idempotent injection guards and lifecycle cleanup.

**How to avoid:**  
1. Enforce strict **DOM idempotency**:
   - Assign a canonical ID and custom attribute to the injected host container (e.g., `<div id="yqc-controls-container" data-yqc-version="1.0">`).
   - Always verify whether `#yqc-controls-container` already exists and whether its `isConnected` property is `true` before initiating injection.
2. Coordinate with YouTube SPA navigation events:
   - Listen for `yt-navigate-finish` and `yt-page-data-updated` on `window` to detect route transitions.
   - Clear existing video-specific resolution caches and reset pending asynchronous bridge requests upon navigation.
3. Use a targeted, debounced `MutationObserver`:
   - Never observe `document.body` with deep subtree mutations indefinitely.
   - Scope the observer specifically to watch metadata containers (`ytd-watch-metadata`, `ytd-reel-video-renderer`, or `#actions`).
   - Debounce mutation callbacks by 50–100ms to allow Polymer component rendering to settle before inserting controls.
4. Verify anchor connectivity: confirm that `segmented-like-dislike-button-view-model` or `like-button-view-model` is fully attached and visible before appending controls.

**Warning signs:**  
- Stacking/multiplying pill buttons when clicking through 3 or more related videos.
- Dropdown appears momentarily during navigation, then vanishes when YouTube's Polymer finishes rendering the video title and action buttons.
- Tab memory usage steadily climbs by several megabytes per video watched.

**Phase to address:**  
Phase 2: Core Watch Page DOM Injection, Dropdown UI & Quality/Speed API Integration.

---

### Pitfall 4: YouTube Quality API Quirks: `setPlaybackQualityRange` vs `setPlaybackQuality`, ABR Buffer Lag & Unavailable Resolutions

**What goes wrong:**  
Manipulating video quality on YouTube involves nuanced behaviors in YouTube's Adaptive Bitrate (ABR) streaming engine:
1. **Deprecated vs Active API Methods:** YouTube deprecated the single-parameter `player.setPlaybackQuality(quality)`. In modern HTML5 player builds, calling `setPlaybackQuality` alone is often ignored or overridden by internal ABR logic. The supported method is `player.setPlaybackQualityRange(minQuality, maxQuality)` (e.g., `setPlaybackQualityRange('hd1080', 'hd1080')`).
2. **ABR Buffer Delay (Switch Lag):** YouTube pre-buffers 15–45 seconds of video stream ahead of the playhead. When `setPlaybackQualityRange` is executed, YouTube does *not* flush existing buffered chunks unless forced. Consequently:
   - The visual video stream remains at the old resolution until the buffer depletes and the new stream chunk arrives.
   - `player.getPlaybackQuality()` continues returning the old quality for several seconds after the command is issued.
   - If the extension UI relies on immediate polling of `getPlaybackQuality()`, it may falsely conclude the switch failed and reset the dropdown label.
3. **`Auto` Resolution Ambiguity:** In `player.getAvailableQualityLevels()`, `'auto'` is not consistently listed as a standalone resolution string (levels are typically `['hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny']`). Selecting "Auto" requires resetting quality boundaries via `player.setPlaybackQualityRange('default', 'highres')` or clearing manual constraints so YouTube's internal ABR algorithm re-engages.
4. **Dynamic Manifest Parsing:** At video start, `getAvailableQualityLevels()` often returns only low-tier resolutions (`['auto', 'tiny', 'small']`) while the DASH/MPD manifest is being initialized. If the extension queries resolutions immediately on page load, it registers 1440p/1080p as unavailable.
5. **Unavailable Resolution Defaults:** If a user configures their default quality to "1440p" or "4K", but the active video was only uploaded in 720p, blindly requesting `hd1440` will either fail silently or cause undefined player behavior.

**Why it happens:**  
Treating video quality as a synchronous property setter rather than an asynchronous, multi-stage adaptive streaming pipeline.

**How to avoid:**  
1. Standardize quality commands in the `MAIN` world bridge:
   - For specific resolutions: call `player.setPlaybackQualityRange(targetQuality, targetQuality)` with fallback to `player.setPlaybackQuality(targetQuality)`.
   - For Auto mode: call `player.setPlaybackQualityRange('default', 'highres')` or `player.setPlaybackQuality('default')`.
2. Handle ABR buffer lag gracefully in the UI:
   - Provide an optimistic UI state (e.g., `1080p (switching...)` or subtle pulse) upon selection.
   - Listen to player event listeners (`onPlaybackQualityChange`) dispatched by `#movie_player` to confirm when the active segment actually transitions.
   - Apply an 8-second safety timeout: if `onPlaybackQualityChange` does not fire, poll `getPlaybackQuality()` or revert gracefully.
3. Query available resolutions reactively:
   - Do not query resolutions once on static load. Subscribe to player state change events (Player State `1` = `PLAYING`) and `onPlaybackQualityChange` to retrieve the finalized `getAvailableQualityLevels()` and `getAvailableQualityData()`.
4. Implement intelligent quality fallbacks:
   - Parse YouTube quality strings (`hd2160` -> 4K, `hd1440` -> 1440p, `hd1080` -> 1080p, `hd720` -> 720p, `large` -> 480p, `medium` -> 360p, `small` -> 240p, `tiny` -> 1440p).
   - If user default is 1080p but max available is 720p, automatically choose the highest available level below the target (720p) and inform the user.

**Warning signs:**  
- Quality dropdown says "1080p", but opening YouTube's "Stats for nerds" reveals `Current / Optimal Res` is still streaming at 480p.
- Dropdown only displays "360p" and "Auto" on newly opened videos until the page is refreshed.
- Clicking a resolution causes video stutter or gets immediately reverted by YouTube's auto engine.

**Phase to address:**  
Phase 2: Core Watch Page DOM Injection, Dropdown UI & Quality/Speed API Integration.

---

### Pitfall 5: YouTube Shorts Active Reel Virtualization & External `ratechange` Synchronization

**What goes wrong:**  
YouTube Shorts (`https://www.youtube.com/shorts/*`) introduces a fundamentally distinct player architecture from standard watch pages:
1. **Virtual Reel Container:** Shorts uses a virtualized scrolling feed (`ytd-reel-video-renderer`). Multiple video elements (typically 3: previous, current, next) exist simultaneously in the DOM to enable zero-latency vertical swiping. If a script executes `document.querySelector('video')`, it often captures an off-screen, preloaded Short rather than the currently active, audible video.
2. **Non-Standard Button Hierarchy:** Shorts does not render `ytd-watch-metadata`. Action buttons are arranged in a floating vertical column on the right side of the active reel (`ytd-reel-player-overlay-renderer #actions`).
3. **Reel PlaybackRate Resets:** When scrolling to a new Short, YouTube's internal controller resets the active video's `playbackRate` to `1.0` by default.
4. **`ratechange` Desynchronization and Infinite Loops:**
   - If the user uses YouTube keyboard shortcuts (Shift+> or Shift+<) to alter speed, or if YouTube resets the speed on scroll, the extension's speed pill must reflect the new rate.
   - However, if the extension listens to `ratechange` and naively re-invokes `video.playbackRate = newRate`, it triggers a cyclic feedback loop, locking the browser tab.

**Why it happens:**  
Assuming a single `<video>` element per page, hardcoding selectors specific to `ytd-watch-flexy`, and neglecting bidirectional event loop guards.

**How to avoid:**  
1. Identify the active Short reel:
   - Detect route via `window.location.pathname.startsWith('/shorts/')`.
   - Query strictly within the active reel: `ytd-reel-video-renderer[is-active] video` or match against the video whose `paused === false` and `readyState >= 2`.
2. Anchor controls within Shorts overlay:
   - Position the compact pill container directly above the Like button within the active reel's overlay action stack (`ytd-reel-video-renderer[is-active] ytd-reel-player-overlay-renderer #like-button`).
   - Use a lightweight, vertical or compact horizontal layout that does not obscure Shorts comments or description text.
3. Manage `ratechange` with an internal update guard:
   ```javascript
   let isInternalRateChange = false;

   function setSpeed(rate) {
     isInternalRateChange = true;
     activeVideo.playbackRate = rate;
     setTimeout(() => { isInternalRateChange = false; }, 50);
   }

   activeVideo.addEventListener('ratechange', () => {
     if (isInternalRateChange) return;
     updateSpeedDropdownLabel(activeVideo.playbackRate);
   });
   ```
4. Re-apply user's default speed on active reel change: observe attribute changes on `ytd-reel-video-renderer[is-active]` and re-apply user preferences.

**Warning signs:**  
- Changing speed changes the audio/video of a hidden Short while the visible Short stays at 1.0x.
- Speed pill displays "1.5x", but Short video is visibly playing at 1.0x after scrolling.
- Scrolling down 3 Shorts causes the browser tab CPU to spike to 100% due to an uncontrolled `ratechange` event loop.

**Phase to address:**  
Phase 3: Fullscreen Top Layer & YouTube Shorts Integration.

---

### Pitfall 6: YouTube Light/Dark Theme vs OS System Color Scheme Mismatch

**What goes wrong:**  
YouTube manages its appearance independently from the client operating system:
1. Users can configure YouTube to:
   - **Dark theme** (`<html dark="true">`, `<ytd-app dark>`)
   - **Light theme** (`<html>` without `dark` attribute)
   - **Use device theme** (mirrors OS `prefers-color-scheme`)
2. If the extension relies solely on standard CSS media queries (`@media (prefers-color-scheme: dark)`):
   - A user with macOS in Dark Mode who chooses YouTube's Light theme will see a pitch-black dropdown pill floating above a clean white Like button. Text will be unreadable (white text on light background or black on black).
   - Conversely, a user in OS Light Mode watching YouTube in Dark Mode will see an unstyled light box clashing severely with YouTube's dark UI.
3. YouTube allows on-the-fly theme switching from the avatar account menu without reloading the page. If extension styles are static, colors break until reload.

**Why it happens:**  
Relying on OS media queries rather than YouTube's internal DOM theme indicators and design tokens.

**How to avoid:**  
1. Adopt YouTube's native CSS custom properties (variables) for all UI elements:
   - Background: `var(--yt-spec-badge-chip-background, rgba(0, 0, 0, 0.05))`
   - Hover Background: `var(--yt-spec-button-chip-background-hover, rgba(0, 0, 0, 0.1))`
   - Primary Text: `var(--yt-spec-text-primary, #0f0f0f)`
   - Border / Separator: `var(--yt-spec-10-percent-layer, rgba(0, 0, 0, 0.1))`
   - Dropdown Menu Surface: `var(--yt-spec-menu-background, #ffffff)`
2. Target YouTube theme selectors directly in extension CSS:
   ```css
   /* Light Theme Defaults */
   .yqc-pill {
     background-color: var(--yt-spec-badge-chip-background, rgba(0, 0, 0, 0.05));
     color: var(--yt-spec-text-primary, #0f0f0f);
   }
   /* YouTube Dark Theme */
   html[dark] .yqc-pill,
   ytd-app[dark] .yqc-pill,
   [dark] .yqc-pill {
     background-color: var(--yt-spec-badge-chip-background, rgba(255, 255, 255, 0.1));
     color: var(--yt-spec-text-primary, #f1f1f1);
   }
   ```
3. Dynamically observe theme attribute changes on `document.documentElement` (`attributes: ['dark']`) if custom styling recalculations are required.

**Warning signs:**  
- Unreadable text (white text on light grey pill, or dark grey text on charcoal background).
- Extension buttons look foreign or out-of-place compared to the adjacent native Like/Share buttons.
- Changing YouTube appearance setting breaks button contrast until manual page refresh.

**Phase to address:**  
Phase 2: Core Watch Page DOM Injection, Dropdown UI & Quality/Speed API Integration (and verified in Phase 4).

---

### Pitfall 7: YouTube Native Keyboard Shortcuts, Mouse Inactivity Fading & Fullscreen Control Auto-Hide

**What goes wrong:**  
In both windowed and fullscreen players, YouTube runs aggressive event management:
1. **Player Controls Auto-Hide:** In fullscreen mode, YouTube hides the player control bar (`.ytp-chrome-bottom`) after ~2.5 seconds of mouse inactivity by adding the `.ytp-autohide` class to `#movie_player`. If a user hovers over the extension's dropdown or opens a resolution menu, and the cursor stops moving, YouTube fades out the entire controls bar—including the extension's open dropdown menu.
2. **Click Propagation Causing Unwanted Pause/Play:** Clicking anywhere on `#movie_player` toggles playback. If a click inside the extension's pill or dropdown menu bubbles up the DOM to the player container, the video pauses or resumes unexpectedly.
3. **Global Shortcut Hijacking:** YouTube listens for global keyboard hotkeys (`k`, `Space`, `j`, `l`, `f`, `m`, `0`-`9`, `<`, `>`). If the extension provides a custom speed input or dropdown menu and the user presses `Space` or `Down Arrow` to navigate, YouTube intercepts the keydown event, skipping the video timeline or pausing the video.
4. **`overflow: hidden` Menu Clipping:** YouTube control bars (`.ytp-chrome-bottom`, `.ytp-fullscreen-quick-actions`) have `overflow: hidden` set on parent containers. If the extension dropdown opens downwards or uses standard relative positioning, the menu options are clipped and rendered completely invisible.

**Why it happens:**  
Failing to isolate event bubbling, ignoring YouTube's inactivity timers, and positioning dropdown popups inside overflow-restricted player containers.

**How to avoid:**  
1. Prevent click and keyboard event bubbling:
   - Call `event.stopPropagation()` on all `click`, `mousedown`, and `keydown` events originating inside the extension container.
   - For keyboard navigation within the dropdown (Arrow keys, Enter, Esc), consume the event completely so YouTube's global hotkey listener never receives it.
2. Maintain player activity state in fullscreen:
   - When hovering over or opening the extension dropdown in fullscreen, periodically dispatch synthetic `mousemove` events to `#movie_player` or temporarily suppress `.ytp-autohide` while the menu is active.
3. Prevent menu clipping via smart upward rendering or portal anchoring:
   - In player environments, render the dropdown menu **upward** (`bottom: calc(100% + 8px)`) rather than downward.
   - Or mount the dropdown list directly to `#movie_player` as a floating portal with `position: absolute`, calculating position via `getBoundingClientRect()`.
4. Auto-dismiss dropdowns reliably:
   - Close open menus immediately upon pressing `Escape`, clicking outside the dropdown, or when entering/exiting fullscreen.

**Warning signs:**  
- Clicking the speed dropdown accidentally pauses the video.
- The dropdown menu disappears while reading resolutions because the mouse paused for 2 seconds.
- Pressing space inside a custom speed input toggles playback.
- Half of the resolution menu is cut off below the bottom edge of the player.

**Phase to address:**  
Phase 3: Fullscreen Top Layer & YouTube Shorts Integration.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Injecting inline `<script>` tags with `textContent` | Quick execution in page context | Fails completely due to YouTube Trusted Types CSP enforcement | **Never acceptable** in modern MV3 YouTube extensions |
| Polling DOM with `setInterval(checkButtons, 500)` | Avoids learning Polymer SPA lifecycle events | Constant CPU overhead, battery drain, delayed UI rendering | **Never acceptable**; use scoped `MutationObserver` + `yt-navigate-finish` |
| `querySelector('video')` without active reel check | Simple one-line video element selection | Breaks on Shorts by manipulating hidden/cached video streams | **Never acceptable**; must check active Shorts reel |
| Hardcoding light/dark hex colors (e.g. `#fff`, `#222`) | Fast CSS implementation | Visual clashes with YouTube's dynamic theme settings | Acceptable only in initial local prototype; refactor before PR |
| Mutating `document.body` directly in fullscreen | Easy fixed positioning | Completely invisible behind Fullscreen Top Layer | **Never acceptable**; must mount within `document.fullscreenElement` |
| Global event listeners without teardown | Fewer lines of cleanup logic | Massive memory leaks across long YouTube sessions | **Never acceptable** in production content scripts |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `#movie_player` Lifecycle | Querying `#movie_player` before YouTube initializes the player object | Check `player && typeof player.getAvailableQualityLevels === 'function'`; listen for `yt-player-updated` or player state transitions |
| `window.postMessage` Envelope | Using generic message payloads without namespace or origin checks | Use unique namespaced types (`SPEEDOQ_YQC_*`), validate `event.origin === window.location.origin`, and verify `event.source === window` |
| Chrome Storage API Sync | Assuming `chrome.storage.sync` is always available and writes synchronously | Wrap storage calls in asynchronous helpers; provide seamless fallback to `chrome.storage.local` if sync quota or policy fails |
| Polymer Custom Elements | Inserting elements before custom element shadow/children hydration finishes | Wait for target anchor (`segmented-like-dislike-button-view-model`) to be connected in DOM before mounting |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Global `MutationObserver` on `document.body` | Dropped video frames, UI lag on low-end machines | Observe only specific parent containers (`ytd-watch-metadata`, `#actions`); disconnect when inactive | Immediate; YouTube triggers thousands of mutations during video playback |
| Un-debounced SPA Navigation Handlers | Multiple redundant bridge calls and DOM restyling | Debounce injection logic by 50–100ms; enforce idempotent DOM checks | Clicking rapidly through playlist or recommendations |
| Infinite `ratechange` Feedback Loop | Tab freezes, CPU at 100%, browser unresponsive | Maintain an `isInternalChange` semaphore flag when setting `video.playbackRate` | As soon as user selects a speed preset |
| Memory Leaks in Detached Elements | Browser tab consumes >1GB RAM after 2 hours of watching | Track and destroy orphaned observers, bridge listeners, and DOM nodes on `yt-navigate-finish` | Long YouTube viewing sessions (>10 videos) |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Accepting unvalidated `window.postMessage` data | Malicious third-party scripts on YouTube can spoof messages and trigger unexpected extension actions | Strictly validate message structure, expected action strings, and sender origin (`https://www.youtube.com`) |
| Broad host permissions (`*://*/*` or `<all_urls>`) | Security review rejection in Chrome Web Store, excessive user permission warnings | Scrictly scope content scripts and permissions to `https://www.youtube.com/*` |
| Using `innerHTML` with unsanitized dynamic strings | Potential Cross-Site Scripting (DOM XSS) if YouTube data contains unexpected markup | Construct DOM nodes programmatically (`document.createElement`, `textContent`, `classList`) |
| Storing sensitive data in unencrypted storage | Privacy leaks | Extension only stores public UX preferences (speed, quality, enabled toggles) |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Layout shift (CLS) above Like button | Native YouTube action buttons jerk downwards when controls inject | Reserve fixed container dimensions (`min-height`) and animate entry smoothly |
| Dropdown clipped inside player controls | User cannot see or click higher resolution options in fullscreen | Render dropdown menus upward (`bottom: 100%`) or portal to `#movie_player` |
| Video pause when clicking dropdown | Annoying stutter whenever adjusting speed or quality | Call `event.stopPropagation()` on all dropdown interactive events |
| No feedback during ABR quality transition | User clicks 1080p, nothing visibly changes for 4 seconds, user clicks again | Show optimistic loading/switching indicator on pill until actual stream switch confirms |
| Stuck open dropdowns | Dropdown stays open when user clicks video or scrolls away | Implement global outside-click and `Escape` key dismiss handlers |

---

## "Looks Done But Isn't" Checklist

- [ ] **SPA Navigation:** Watch video A, navigate to video B via sidebar, then video C via search — verify exactly one set of controls exists, no duplicates, and resolutions update to video C's actual options.
- [ ] **Fullscreen Mode (Delhi & Classic UI):** Press 'f' on watch page — verify speed and quality pills remain visible above or adjacent to fullscreen Like button, are fully clickable, and do not vanish after 2 seconds.
- [ ] **Dropdown Clipped in Fullscreen:** Open quality dropdown in fullscreen mode — verify all options (4K down to 1440p/144p) render inside viewable screen area without being cut off by `.ytp-chrome-bottom`.
- [ ] **Shorts Feed Scrolling:** Open YouTube Shorts, scroll through 5 consecutive Shorts — verify speed pill attaches to the active Short, modifies only the playing Short, and does not reset or lag.
- [ ] **ABR Quality Verification:** Select 1080p on an Auto video — open YouTube's native "Stats for nerds" and confirm `Current / Optimal Res` actually switches to `1920x1080`.
- [ ] **Theme Permutations:** Verify readable contrast and correct styling across all 4 combinations: (1) OS Light + YT Light, (2) OS Light + YT Dark, (3) OS Dark + YT Light, (4) OS Dark + YT Dark.
- [ ] **Keyboard Interaction:** Click inside custom speed input or dropdown, press Space, Left/Right arrow keys — verify video does not pause or seek.
- [ ] **Memory & Tab Stability:** Rapidly change speeds and navigate 20 videos — verify browser tab memory stays flat and no console errors accumulate.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Trusted Types CSP Blockage | HIGH | Remove all inline scripts; migrate `#movie_player` access to a dedicated declarative `world: "MAIN"` content script in `manifest.json` communicating via `window.postMessage`. |
| Fullscreen Top Layer Invisibility | MEDIUM | Refactor DOM injection architecture to maintain dual mounting targets: watch page action bar and `.ytp-fullscreen-quick-actions` / `#movie_player`. |
| Duplicate Injections on SPA Navigation | LOW | Add strict idempotency check (`#yqc-controls-container`) and tie lifecycle to `yt-navigate-finish` with debounced mutation handling. |
| ABR Quality Delay / Failure | MEDIUM | Update bridge to use `setPlaybackQualityRange(target, target)` and add optimistic UI states with `onPlaybackQualityChange` confirmation listeners. |
| Shorts Multi-Reel Desync | MEDIUM | Scope all queries strictly to `ytd-reel-video-renderer[is-active]` and add `isInternalRateChange` guard on `ratechange` events. |
| Dark/Light Theme Illegibility | LOW | Replace hardcoded colors with YouTube's CSS custom properties (`--yt-spec-text-primary`, `--yt-spec-badge-chip-background`). |
| Hotkey / Focus Hijacking | LOW | Add `event.stopPropagation()` to dropdown click/keyboard listeners and render dropdown menus upward. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification Check |
|---------|------------------|--------------------|
| **1. MV3 Isolated World & Trusted Types CSP** | Phase 1: Architecture, Manifest V3 Foundation & Dual-World Bridge | Inspect DevTools console on `https://www.youtube.com/watch*`: zero CSP/Trusted Types errors; verify `postMessage` bridge successfully retrieves `getAvailableQualityLevels()` from `MAIN` world. |
| **2. Fullscreen Top Layer Hiding Elements** | Phase 3: Fullscreen Top Layer & YouTube Shorts Integration | Enter fullscreen ('f') on watch page: controls remain visible, anchored above fullscreen Like button, clickable, and correctly styled inside `document.fullscreenElement`. |
| **3. YouTube SPA DOM Recycling & Duplicates** | Phase 2: Core Watch Page DOM Injection, Dropdown UI & Quality/Speed API Integration | Click through 10 consecutive YouTube videos: exactly one set of pill controls exists above the Like button at all times; zero orphaned elements or memory leaks. |
| **4. YouTube Quality API Quirks & ABR Lag** | Phase 2: Core Watch Page DOM Injection, Dropdown UI & Quality/Speed API Integration | Select specific resolution from dropdown: UI shows switching state, confirms via `onPlaybackQualityChange`, and "Stats for nerds" verifies physical video stream resolution match. |
| **5. Shorts Active Reel Switching & `ratechange` Sync** | Phase 3: Fullscreen Top Layer & YouTube Shorts Integration | Scroll through 5 Shorts in `/shorts/`: controls attach to active reel, speed changes affect only the active video, external speed adjustments update pill label, and no feedback loops occur. |
| **6. YouTube Light/Dark Theme Mismatch** | Phase 2: Core Watch Page DOM Injection, Dropdown UI & Quality/Speed API Integration (Verified in Phase 4) | Toggle YouTube theme between Dark and Light via avatar menu while switching OS between Dark and Light: dropdown pill text and background maintain optimal contrast and match adjacent native buttons. |
| **7. Native Shortcuts & Fullscreen Auto-Hide** | Phase 3: Fullscreen Top Layer & YouTube Shorts Integration | In fullscreen mode, open dropdown: controls bar does not fade out while interacting; clicking dropdown does not toggle play/pause; pressing Space/Arrows does not seek/pause video; menu options are never clipped. |

---

## Sources

- Chrome Extensions Manifest V3 Content Scripts (`"world": "MAIN"` vs `"world": "ISOLATED"`) Specification
- W3C Fullscreen API Stacking Context & Top Layer Specification
- W3C Trusted Types Specification (`require-trusted-types-for 'script'`)
- YouTube HTML5 Player Reference & Empirical `#movie_player` API Inspection
- YouTube Polymer Web Component DOM (`ytd-app`, `ytd-watch-metadata`, `ytd-reel-video-renderer`, `.ytp-fullscreen-quick-actions`)

---
*Pitfalls research for: YouTube Quick Controls Manifest V3 Chrome Extension*  
*Researched: 2026-11-11*
