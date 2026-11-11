# Architecture Research

**Domain:** Chrome Extension (Manifest V3) / YouTube Web Client Integration  
**Researched:** 2026-11-11  
**Confidence:** HIGH  

---

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CHROME BROWSER EXTENSION                               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────┐  ┌──────────────────────────────────────────────────────┐  │
│  │   Popup UI Context     │  │             Background Service Worker                │  │
│  │   (popup.html/js/css)  │  │                  (background.js)                     │  │
│  │  - User Preferences   │  │  - Extension install/update lifecycle                │  │
│  │  - Defaults Config     │  │  - Storage schema migration & defaults seeding       │  │
│  └───────────┬────────────┘  └──────────────────────────┬───────────────────────────┘  │
│              │                                          │                              │
│              ▼                                          ▼                              │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                    chrome.storage.sync (with local fallback)                     │  │
│  │     { enabled, defaultSpeed, defaultQuality, autoApply, customSpeeds, ... }      │  │
│  └──────────────────────────────────────┬───────────────────────────────────────────┘  │
├─────────────────────────────────────────┼──────────────────────────────────────────────┤
│                                         ▼                                              │
│                            YOUTUBE TAB (DOM & RUNTIME)                                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  ISOLATED WORLD (content.js & styles.css)                                              │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │  - DOM Selector Discovery Engine (Watch, Fullscreen, Shorts)                      │  │
│  │  - MutationObserver Manager (SPA-aware, debounced, targeted subtree)             │  │
│  │  - Quick Controls UI (Pills: Speed [1.0x ▼] & Quality [1080p ▼])                  │  │
│  │  - HTML5 Video Controller (video.playbackRate, ratechange sync)                  │  │
│  │  - Storage Sync Listener (chrome.storage.onChanged)                              │  │
│  │  - RPC Client Bridge (window.postMessage sender & response listener)             │  │
│  │  - Teardown & Lifecycle Registry (prevents duplicate pills & memory leaks)        │  │
│  └──────────────────────────────────────▲───────────────────────────────────────────┘  │
│                                         │                                              │
│                window.postMessage Bridge│(Typed Envelopes + Correlation IDs)           │
│                                         │                                              │
│  MAIN WORLD (page-bridge.js)            ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │  - Direct Access to YouTube Player JS API (#movie_player)                        │  │
│  │  - RPC Server Bridge (request dispatcher & response poster)                      │  │
│  │  - API Calls: getAvailableQualityLevels(), getAvailableQualityData()             │  │
│  │  - API Calls: getPlaybackQuality(), setPlaybackQualityRange()                    │  │
│  │  - Player Event Listeners (onPlaybackQualityChange, onStateChange)                │  │
│  └──────────────────────────────────────┬───────────────────────────────────────────┘  │
│                                         ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                     YouTube Polymer Web Client & Player Engine                   │  │
│  │  (#movie_player, <video>, ytd-watch-metadata, .ytp-fullscreen-quick-actions)     │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Component Responsibilities

| Component | Execution Context | Permissions / Access | Primary Responsibilities |
|---|---|---|---|
| **`manifest.json`** | Metadata | Declares MV3 config | Defines extension metadata, MV3 permissions (`storage`), host permissions (`https://www.youtube.com/*`), dual content script declarations, popup action, and asset paths. |
| **`content.js`** | `ISOLATED` World | Chrome APIs (`storage`), DOM access | Discovers injection anchor targets across Watch, Fullscreen, and Shorts; creates, styles, and mounts dropdown pills; controls HTML5 `<video>.playbackRate`; communicates with `page-bridge.js` via `window.postMessage`; handles teardown on SPA navigation. |
| **`page-bridge.js`** | `MAIN` World | Page JS execution context | Interacts directly with `#movie_player` JavaScript methods (`getAvailableQualityLevels`, `getPlaybackQuality`, `setPlaybackQualityRange`); listens to player quality events; responds to RPC requests from `content.js`. |
| **`styles.css`** | Injected with `content.js` | Applied to YouTube DOM | Styles the speed and quality pill controls, dropdown menus, animations, dark/light theme overrides, and fullscreen layering (`z-index: 2147483647`). |
| **`background.js`** | Extension Service Worker | `chrome.runtime`, `chrome.storage` | Handles extension installation, version migrations, default configuration seeding, and badge status updates. |
| **`popup.html / js / css`** | Browser Action Popup | `chrome.storage`, `chrome.tabs` | Provides a clean settings UI to configure default playback speed, default video quality, auto-apply flags, and toggles for Shorts/Fullscreen injection. |
| **`icons/`** | Static Assets | Extension UI & Web Store | PNG icons in standard densities (16x16, 32x32, 48x48, 128x128) representing YouTube Quick Controls. |

---

## Recommended Project Structure

All deployable extension assets reside under the standalone directory `youtube-quick-controls/`. This structure allows pointing Chrome's **Load unpacked** directly at `youtube-quick-controls/` without exposing development tooling, planning artifacts, or agent configurations.

```
youtube-quick-controls/
├── manifest.json            # MV3 manifest defining dual-world scripts, popup, permissions
├── content.js               # ISOLATED world UI controller, selector resolver, RPC client
├── page-bridge.js           # MAIN world bridge executing inside YouTube's JS context
├── styles.css               # Native YouTube theme-matching styling for pills & dropdowns
├── background.js            # MV3 service worker for lifecycle events and defaults seeding
├── popup.html               # Settings modal popup markup
├── popup.js                 # Settings modal state management and chrome.storage sync
├── popup.css                # Compact modern styling for popup interface
└── icons/                   # Icon assets across standard resolutions
    ├── icon-16.png
    ├── icon-32.png
    ├── icon-48.png
    └── icon-128.png
```

### Structure Rationale

- **Root Isolation (`youtube-quick-controls/`)**: Separates production-ready runtime files from `.planning/`, `.git/`, `.agents/`, and markdown files. Eliminates accidental bundling of development overhead during packaging or unpacked loading.
- **Dual Content Scripts**: Declaring both `page-bridge.js` (`world: "MAIN"`) and `content.js` (`world: "ISOLATED"`) directly in `manifest.json` complies with MV3 specifications without requiring CSP-violating dynamic `<script>` tag injections or `web_accessible_resources` exposure.
- **Zero-Dependency Architecture**: Pure vanilla ES6+ JavaScript, CSS3, and standard HTML5 Web APIs. Requires no Node.js compilation, bundlers, or transpilation steps to execute in Google Chrome.

---

## Architectural Patterns

### Pattern 1: Dual-World MV3 Content Script Separation

**What:** Manifest V3 allows content scripts to run in either the `ISOLATED` world (default) or the `MAIN` world (the page's execution context).  
**Why It Is Essential for YouTube:**  
1. YouTube attaches its player control methods directly to the DOM element `#movie_player` or within `window.ytplayer`.  
2. Scripts running in the `ISOLATED` world can access DOM elements, but cannot call custom JavaScript properties or methods attached to those elements by YouTube's scripts (e.g., `#movie_player.getAvailableQualityLevels` is `undefined` in `ISOLATED` world).  
3. Conversely, scripts in the `MAIN` world have direct access to `#movie_player`, but **cannot** call Chrome Extension APIs such as `chrome.storage.sync`.  
4. The solution is a dual-world architecture: `content.js` manages UI, DOM injection, and settings storage in the `ISOLATED` world, while `page-bridge.js` runs in the `MAIN` world to query and manipulate the player API, exchanging messages over `window.postMessage`.

**Manifest V3 Declaration:**
```json
{
  "manifest_version": 3,
  "name": "YouTube Quick Controls",
  "version": "1.0.0",
  "permissions": ["storage"],
  "host_permissions": ["https://www.youtube.com/*"],
  "content_scripts": [
    {
      "matches": ["https://www.youtube.com/*"],
      "js": ["page-bridge.js"],
      "world": "MAIN",
      "run_at": "document_start"
    },
    {
      "matches": ["https://www.youtube.com/*"],
      "js": ["content.js"],
      "css": ["styles.css"],
      "world": "ISOLATED",
      "run_at": "document_idle"
    }
  ]
}
```

---

### Pattern 2: Window postMessage RPC Bridge with Typed Envelopes

**What:** A bidirectional, asynchronous Remote Procedure Call (RPC) layer between `content.js` (`ISOLATED`) and `page-bridge.js` (`MAIN`).  
**Protocol Specification:**
- **Source Verification:** Every listener checks `event.source === window` to prevent cross-frame injection attacks.
- **Namespacing:** Message envelopes use distinct prefixes `YTC_REQ_` and `YTC_RESP_`.
- **Correlation IDs:** Each request carries a unique `requestId` (timestamp + random token). The caller creates a deferred Promise with a timeout (default 1500ms). The recipient echoes the `requestId` in its response.
- **Unsolicited Broadcasts:** `page-bridge.js` emits `YTC_EVENT_` notifications when YouTube triggers native quality or state change callbacks.

**Message Envelope Structure:**
```typescript
interface YtcBridgeMessage<T = any> {
  source: 'YTC_ISOLATED' | 'YTC_MAIN';
  type: 'YTC_REQ_GET_QUALITIES' 
      | 'YTC_RESP_GET_QUALITIES' 
      | 'YTC_REQ_SET_QUALITY' 
      | 'YTC_RESP_SET_QUALITY' 
      | 'YTC_EVENT_QUALITY_CHANGED' 
      | 'YTC_PING' 
      | 'YTC_PONG';
  requestId?: string;
  payload?: T;
  error?: string | null;
}
```

**Implementation Pattern:**

*In `content.js` (ISOLATED World):*
```javascript
class BridgeClient {
  constructor() {
    this.pending = new Map();
    this.eventListeners = new Map();

    window.addEventListener('message', (event) => {
      if (event.source !== window || !event.data || event.data.source !== 'YTC_MAIN') return;
      const { type, requestId, payload, error } = event.data;

      // Handle RPC response
      if (requestId && this.pending.has(requestId)) {
        const { resolve, reject, timer } = this.pending.get(requestId);
        clearTimeout(timer);
        this.pending.delete(requestId);
        if (error) reject(new Error(error));
        else resolve(payload);
        return;
      }

      // Handle broadcast events
      if (type.startsWith('YTC_EVENT_')) {
        const handlers = this.eventListeners.get(type) || [];
        handlers.forEach(fn => fn(payload));
      }
    });
  }

  request(type, payload = {}, timeoutMs = 1500) {
    return new Promise((resolve, reject) => {
      const requestId = `ytc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const timer = setTimeout(() => {
        if (this.pending.has(requestId)) {
          this.pending.delete(requestId);
          reject(new Error(`Bridge request timed out: ${type}`));
        }
      }, timeoutMs);

      this.pending.set(requestId, { resolve, reject, timer });
      window.postMessage({
        source: 'YTC_ISOLATED',
        type,
        requestId,
        payload
      }, '*');
    });
  }

  on(eventType, handler) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType).push(handler);
  }
}
```

*In `page-bridge.js` (MAIN World):*
```javascript
(function initPageBridge() {
  function getPlayer() {
    return document.getElementById('movie_player') || document.querySelector('.html5-video-player');
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'YTC_ISOLATED') return;
    const { type, requestId, payload } = event.data;
    const player = getPlayer();

    function reply(respType, respPayload = {}, error = null) {
      window.postMessage({
        source: 'YTC_MAIN',
        type: respType,
        requestId,
        payload: respPayload,
        error
      }, '*');
    }

    switch (type) {
      case 'YTC_REQ_GET_QUALITIES': {
        if (!player || typeof player.getAvailableQualityLevels !== 'function') {
          return reply('YTC_RESP_GET_QUALITIES', null, 'Player API not ready');
        }
        const levels = player.getAvailableQualityLevels() || [];
        const current = player.getPlaybackQuality ? player.getPlaybackQuality() : 'unknown';
        const data = player.getAvailableQualityData ? player.getAvailableQualityData() : null;
        reply('YTC_RESP_GET_QUALITIES', { levels, current, data });
        break;
      }
      case 'YTC_REQ_SET_QUALITY': {
        const { quality } = payload;
        if (!player) return reply('YTC_RESP_SET_QUALITY', null, 'Player not found');
        
        if (typeof player.setPlaybackQualityRange === 'function') {
          player.setPlaybackQualityRange(quality, quality);
        }
        if (typeof player.setPlaybackQuality === 'function') {
          player.setPlaybackQuality(quality);
        }
        reply('YTC_RESP_SET_QUALITY', { success: true, requested: quality });
        break;
      }
      case 'YTC_PING':
        reply('YTC_PONG', { ready: !!player });
        break;
    }
  });

  // Listen for native player events
  function attachPlayerListeners() {
    const player = getPlayer();
    if (!player || !player.addEventListener) return;
    try {
      player.addEventListener('onPlaybackQualityChange', (newQuality) => {
        window.postMessage({
          source: 'YTC_MAIN',
          type: 'YTC_EVENT_QUALITY_CHANGED',
          payload: { quality: newQuality }
        }, '*');
      });
    } catch (_) {}
  }
  attachPlayerListeners();
})();
```

---

### Pattern 3: DOM Selector Discovery & Fallback Chains

YouTube continually experiments with A/B layouts (Polymer, Delhi redesign, updated button view models). Controls must be anchored directly above the Like button across all three viewing modes, falling back gracefully if elements change.

```
                  ┌─────────────────────────────────────┐
                  │      Determine Viewing Context      │
                  └──────────────────┬──────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
   [ Fullscreen Mode ]       [ YouTube Shorts ]        [ Standard Watch ]
 (document.fullscreenElement)  (location.pathname       (location.pathname
                               .startsWith('/shorts'))   .startsWith('/watch'))
           │                         │                         │
           ▼                         ▼                         ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│ Primary:              │ │ Primary:              │ │ Primary:              │
│ .ytp-fullscreen-      │ │ ytd-reel-video-       │ │ #actions              │
│ quick-actions         │ │ renderer[is-active]   │ │ #top-level-buttons-   │
│ button[aria-label     │ │ #actions              │ │ computed              │
│ *="like" i]           │ │ #like-button          │ │ segmented-like-       │
│                       │ │                       │ │ dislike-button-view-  │
│ Secondary:            │ │ Secondary:            │ │ model                 │
│ .ytp-chrome-bottom    │ │ ytd-reel-video-       │ │                       │
│ .ytp-right-controls   │ │ renderer[is-active]   │ │ Secondary:            │
│                       │ │ ytd-like-button-      │ │ ytd-watch-metadata    │
│ Tertiary:             │ │ renderer              │ │ #top-row #actions     │
│ Direct child of       │ │                       │ │                       │
│ document.             │ │ Tertiary:             │ │ Tertiary:             │
│ fullscreenElement     │ │ ytd-reel-video-       │ │ #above-the-fold       │
│ (absolute overlay)    │ │ renderer[is-active]   │ │ #actions-inner        │
│                       │ │ #actions              │ │                       │
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
```

#### Detailed Selector Priority Table

| Context | Priority | CSS Selector | Notes |
|---|---|---|---|
| **Standard Watch** | 1 (Primary) | `ytd-watch-metadata #actions #top-level-buttons-computed segmented-like-dislike-button-view-model` | Anchored directly above the modern segmented Like/Dislike button. |
| | 2 (Fallback) | `ytd-watch-metadata #actions-inner #top-level-buttons-computed` | Catches experiments where segmented model is wrapped or renamed. |
| | 3 (Fallback) | `#owner` / `#above-the-fold #top-row` | Sits aligned with channel/action top row if actions bar is delayed. |
| **Fullscreen** | 1 (Primary) | `document.fullscreenElement .ytp-fullscreen-quick-actions button[aria-label*="like" i]` | YouTube modern Delhi fullscreen overlay: Like button appears on hover. |
| | 2 (Fallback) | `document.fullscreenElement .ytp-fullscreen-quick-actions` | Direct anchor inside the fullscreen quick actions container. |
| | 3 (Fallback) | `document.fullscreenElement .ytp-chrome-bottom .ytp-right-controls` | Classic player chrome fallback when quick actions are disabled. |
| | 4 (Fallback) | `document.fullscreenElement #movie_player` | Absolute top-layer overlay with `z-index: 2147483647` positioned above controls. |
| **Shorts** | 1 (Primary) | `ytd-reel-video-renderer[is-active] #actions #like-button` | Targets the active short's vertical action stack right above Like. |
| | 2 (Fallback) | `ytd-reel-video-renderer[is-active] ytd-like-button-renderer` | Alternate component tag for Shorts Like button. |
| | 3 (Fallback) | `ytd-reel-video-renderer[is-active] #actions` | Prepend to top of actions column on active reel. |

---

### Pattern 4: SPA Navigation Lifecycle & Idempotent DOM Injection

YouTube does not trigger full page reloads when navigating between videos. Instead, Polymer fires custom navigation lifecycle events.

**Lifecycle Event Hierarchy:**
1. `yt-navigate-start`: Navigation initiated. Immediately pause UI updates and dismiss open dropdowns.
2. `yt-navigate-finish`: New route rendered. Re-evaluate URL (`/watch`, `/shorts`, `/`).
3. `yt-page-data-updated`: Page metadata and video player updated. Trigger anchor resolution.
4. `document.fullscreenchange`: Toggled fullscreen. Re-anchor to `document.fullscreenElement`.
5. `ratechange` on `<video>`: Syncs speed pill with native YouTube keyboard shortcuts (`<`, `>`).

**Idempotency & MutationObserver Guarding:**
- Every injection pass checks whether `#ytc-quick-controls-watch`, `#ytc-quick-controls-fullscreen`, or `#ytc-quick-controls-shorts` already exists within the target anchor.
- Uses `MutationObserver` on targeted subtrees (`ytd-watch-metadata`, `ytd-shorts`, `.html5-video-player`) rather than observing `document.body` with deep recursion.
- Debounces DOM mutations by 150ms to prevent thrashing during Polymer DOM re-stamping.

```javascript
class InjectionManager {
  constructor(bridge, storage) {
    this.bridge = bridge;
    this.storage = storage;
    this.observer = null;
    this.currentContext = null;
    this.isInjecting = false;
  }

  init() {
    window.addEventListener('yt-navigate-finish', () => this.handleNavigation());
    window.addEventListener('yt-page-data-updated', () => this.handleNavigation());
    document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
    this.handleNavigation();
  }

  handleNavigation() {
    this.teardownContext();
    const path = window.location.pathname;

    if (path.startsWith('/watch')) {
      this.currentContext = 'WATCH';
      this.startObservation('ytd-watch-metadata', () => this.injectWatchControls());
    } else if (path.startsWith('/shorts')) {
      this.currentContext = 'SHORTS';
      this.startObservation('ytd-shorts', () => this.injectShortsControls());
    } else {
      this.currentContext = 'OTHER';
    }
  }

  startObservation(rootSelector, callback) {
    if (this.observer) this.observer.disconnect();

    const checkAndRun = () => {
      const target = this.resolveAnchor();
      if (target && !target.querySelector('.ytc-container')) {
        callback();
      }
    };

    checkAndRun();

    this.observer = new MutationObserver(() => {
      clearTimeout(this._debounce);
      this._debounce = setTimeout(checkAndRun, 150);
    });

    const root = document.querySelector(rootSelector) || document.body;
    this.observer.observe(root, { childList: true, subtree: true });
  }

  teardownContext() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    document.querySelectorAll('.ytc-container').forEach(el => el.remove());
  }
}
```

---

### Pattern 5: Unified Teardown Registry & Memory Leak Prevention

To guarantee zero memory leaks and prevent dangling listeners during long YouTube sessions:
1. **AbortController**: All DOM event listeners (clicks, dropdown toggles, mouse interactions) are registered using `{ signal: this.abortController.signal }`. A single `this.abortController.abort()` cleanly removes all attached listeners.
2. **Video Element Detachment**: Listeners on `<video>` (`ratechange`, `loadedmetadata`) are detached whenever the active video instance changes.
3. **Pending Promise Eviction**: Any unfulfilled bridge requests in `pending` Map are rejected and cleared on route change.

```javascript
class ComponentInstance {
  constructor() {
    this.abortController = new AbortController();
  }

  mount(parentEl) {
    const { signal } = this.abortController;
    
    // Add dropdown toggle listener
    this.speedPill.addEventListener('click', (e) => this.toggleDropdown(e), { signal });
    
    // Add document outside-click listener
    document.addEventListener('click', (e) => this.handleOutsideClick(e), { signal });
  }

  destroy() {
    this.abortController.abort(); // Removes all attached listeners instantly
    if (this.domNode && this.domNode.parentNode) {
      this.domNode.parentNode.removeChild(this.domNode);
    }
  }
}
```

---

## Data Flow

### 1. Video Quality Selection Flow

```
[ User clicks Quality Pill (e.g., "1080p") ]
                     │
                     ▼
[ content.js (ISOLATED World) ]
  - Updates pill UI to show loading/pending state
  - Dispatches YTC_REQ_SET_QUALITY via window.postMessage
                     │
                     ▼ (window.postMessage)
[ page-bridge.js (MAIN World) ]
  - Receives event (source === window)
  - Identifies player: #movie_player
  - Calls: player.setPlaybackQualityRange('hd1080', 'hd1080')
  - Calls: player.setPlaybackQuality('hd1080')
  - Replies with YTC_RESP_SET_QUALITY { success: true }
                     │
                     ▼ (window.postMessage)
[ content.js (ISOLATED World) ]
  - Resolves RPC Promise
  - Waits for native confirmation
                     │
                     ▼
[ Native YouTube Player Engine ]
  - Switches video stream quality
  - Fires native event: onPlaybackQualityChange('hd1080')
                     │
                     ▼
[ page-bridge.js (MAIN World) ]
  - Intercepts onPlaybackQualityChange
  - Broadcasts YTC_EVENT_QUALITY_CHANGED { quality: 'hd1080' }
                     │
                     ▼ (window.postMessage)
[ content.js (ISOLATED World) ]
  - Updates Quality pill label to "1080p"
  - Persists preference if auto-apply is enabled in storage
```

---

### 2. Playback Speed Control Flow

Unlike quality (which requires proprietary player APIs), the HTML5 `<video>` element's `playbackRate` property can be manipulated directly from the `ISOLATED` world without passing through the bridge.

```
[ User selects Speed (e.g., "1.5x") ]
                 │
                 ▼
[ content.js (ISOLATED World) ]
  - Locates active <video> element
  - Sets video.playbackRate = 1.5
                 │
                 ▼
[ HTML5 <video> Element ]
  - Updates hardware playback clock
  - Fires native 'ratechange' event
                 │
                 ▼
[ content.js (ratechange listener) ]
  - Confirms video.playbackRate === 1.5
  - Updates Speed pill text to "1.5x"
  - Closes dropdown menu
```

*Note: If the user adjusts speed using YouTube's native keyboard shortcuts (`Shift+>` or `Shift+<`), the `ratechange` listener automatically captures the change and updates the pill label, keeping the UI perfectly synchronized.*

---

### 3. User Preferences & Storage Sync Flow

```
┌───────────────────────┐             ┌─────────────────────────┐
│      popup.html       │             │   content.js (Tab A)    │
│  User changes default │             │   Listens to:           │
│  speed to "1.25x"     │             │   chrome.storage        │
└───────────┬───────────┘             │   .onChanged            │
            │                         └────────────▲────────────┘
            ▼                                      │
┌──────────────────────────────────────┐           │
│         chrome.storage.sync          ├───────────┤
│  { defaultSpeed: "1.25x", ... }      │           │
└──────────────────────────────────────┘           │
                                      ┌────────────▼────────────┐
                                      │   content.js (Tab B)    │
                                      │   Dynamically updates   │
                                      │   active controls       │
                                      └─────────────────────────┘
```

---

## Scaling & Performance Considerations

| Scale Dimension | Bottleneck / Risk | Mitigation Strategy |
|---|---|---|
| **CPU Usage on DOM Changes** | YouTube re-renders hundreds of elements on scroll or recommendation load. Unrestricted `MutationObserver` triggers CPU lag. | Scope observers to strict subtrees (`ytd-watch-metadata`, `ytd-shorts`). Debounce all mutation handlers with 150ms timeout. Disconnect observers immediately when target anchor is located. |
| **Player API Readiness** | `#movie_player` methods are not immediately available when `yt-navigate-finish` fires. Calling too early yields errors. | Implement retry polling with exponential backoff: 5 attempts (50ms, 100ms, 200ms, 400ms, 800ms) with a 1500ms total timeout. Fail gracefully if player does not report qualities. |
| **Fullscreen Top Layer** | Fullscreen elements render in the browser's "Top Layer". Regular DOM elements placed outside `document.fullscreenElement` are invisible. | Detect `document.fullscreenchange`. When active, dynamically move or re-anchor the controls inside `document.fullscreenElement` with `position: absolute; z-index: 2147483647`. |
| **Shorts Infinite Scroll** | Shorts continuously recycle DOM nodes (`ytd-reel-video-renderer`). Injected controls could be duplicated across multiple inactive reels. | Observe only `ytd-reel-video-renderer[is-active]`. When the active short changes, immediately destroy controls on the previous reel before mounting on the active one. |

---

## Anti-Patterns

### Anti-Pattern 1: Injecting Inline `<script>` Tags for MAIN World Execution
- **What people do:** Injecting a `<script>` tag into the DOM (`document.head.appendChild(s)`) to run code in the main world.
- **Why it is wrong:** YouTube enforces strict Content Security Policy (`script-src 'nonce-...'`). Injected inline scripts are blocked by Chrome MV3 CSP.
- **Do this instead:** Declare `page-bridge.js` with `"world": "MAIN"` in `manifest.json`. Chrome natively runs the script in the page context without CSP friction.

### Anti-Pattern 2: Global `window.postMessage` Without Source Validation
- **What people do:** Listening to `window.addEventListener('message')` without checking `event.source === window` or message structure.
- **Why it is wrong:** Third-party iframes or malicious page scripts can forge messages, triggering arbitrary quality changes or causing unhandled exceptions.
- **Do this instead:** Validate `event.source === window`, verify `event.data.source === 'YTC_MAIN'` (or `'YTC_ISOLATED'`), and validate message types against an allowed enum.

### Anti-Pattern 3: Observing `document.body` with Deep Recursion
- **What people do:** Setting `new MutationObserver(cb).observe(document.body, { childList: true, subtree: true })` permanently.
- **Why it is wrong:** YouTube's dynamic feed continuously mutates the DOM, firing the observer hundreds of times per second and causing severe frame drops.
- **Do this instead:** Narrow observation to specific parent containers (`ytd-watch-metadata`, `ytd-shorts`). Once the anchor element is found, disconnect the observer until the next SPA navigation.

### Anti-Pattern 4: Hardcoding YouTube Video Resolutions
- **What people do:** Displaying a static list of resolutions (`['1080p', '720p', '480p']`).
- **Why it is wrong:** Many videos (older uploads, Shorts, live streams) do not support 1080p, 4K, or 60fps. Selecting an unavailable resolution fails silently.
- **Do this instead:** Query `player.getAvailableQualityLevels()` or `player.getAvailableQualityData()` dynamically via the bridge. Only present resolutions confirmed available for the currently loaded video.

---

## Integration Points & Contracts

### 1. YouTube Player API Contract (`page-bridge.js` ↔ `#movie_player`)

The bridge utilizes the following internal YouTube Player JavaScript API methods:

```typescript
interface YouTubePlayerAPI {
  // Returns array of quality keys: ['highres', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny', 'auto']
  getAvailableQualityLevels(): string[];

  // Returns array of detailed quality metadata objects (includes resolution, label, fps)
  getAvailableQualityData?(): Array<{
    quality: string;
    qualityLabel: string;
    isSeamless: boolean;
  }>;

  // Returns currently active playback quality string
  getPlaybackQuality(): string;

  // Requests explicit quality range (min, max)
  setPlaybackQualityRange(min: string, max: string): void;

  // Legacy quality setter
  setPlaybackQuality(quality: string): void;

  // Event listener hook
  addEventListener(event: string, callback: (arg: any) => void): void;
  removeEventListener(event: string, callback: (arg: any) => void): void;
}
```

### 2. Quality Level Mapping Table

| YouTube Player API Token | User-Facing Display Label | Resolution Category |
|---|---|---|
| `highres` | **4320p (8K)** / **2160p (4K)** | Ultra HD |
| `hd2160` | **2160p (4K)** | Ultra HD |
| `hd1440` | **1440p (2K)** | Quad HD |
| `hd1080` | **1080p** | Full HD |
| `hd720` | **720p** | HD |
| `large` | **480p** | SD |
| `medium` | **360p** | SD |
| `small` | **240p** | Low |
| `tiny` | **144p** | Minimum |
| `auto` | **Auto** | Adaptive |

---

## Sources & References

- [Chrome Extensions Manifest V3 Content Scripts Specification](https://developer.chrome.com/docs/extensions/mv3/content_scripts/#isolated_world)
- [Chrome Extensions Scripting `ExecutionWorld` Reference](https://developer.chrome.com/docs/extensions/reference/scripting/#type-ExecutionWorld)
- [YouTube IFrame Player API Reference](https://developers.google.com/youtube/iframe_api_reference)
- [W3C HTML5 Fullscreen API Specification](https://fullscreen.spec.whatwg.org/)
