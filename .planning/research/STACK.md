# Stack Research

**Domain:** Chrome Extension (Manifest V3) — YouTube Video Player Controls & UI Injection  
**Researched:** 2026-11-11  
**Confidence:** HIGH  

---

## Executive Summary

**YouTube Quick Controls** is designed as a zero-build, native-feeling Manifest V3 extension delivered in `youtube-quick-controls/` for immediate "Load unpacked" capability in Google Chrome. 

To bridge YouTube's Polymer SPA architecture and player controls without triggering Content Security Policy (CSP) violations or permissions bloat:
1. **Dual-World Execution:** Uses declared MV3 `"world": "MAIN"` content script for direct `#movie_player` API access (`getAvailableQualityLevels`, `setPlaybackQualityRange`) paired with `"world": "ISOLATED"` content script for secure DOM injection, UI event listeners, and `chrome.storage.sync` access, communicating across the isolation boundary via structured `window.postMessage` envelopes.
2. **Modern Web UI & CSS:** Employs the HTML Popover API (`popover="auto"`), CSS custom properties, and `light-dark()` color styling adapted to YouTube's dynamic theme tokens (`html[dark]`), ensuring zero layout shift and Top-Layer visibility in fullscreen mode (`document.fullscreenElement`).
3. **Lean Dev & Test Tooling:** Requires zero runtime dependencies. Development and automated verification rely on Node.js v24 native test runner (`node:test`, `node:assert/strict`), JSDOM for isolated DOM testing, and headless Chrome (`puppeteer-core` or native `--headless=new --load-extension`) for E2E extension load verification.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Chrome Extensions MV3** | Manifest V3 (Chrome 120+ / Baseline) | Extension platform definition & lifecycle management | Standard format for Chromium extensions; required for Chrome Web Store. Provides declarative content script execution worlds (`MAIN` vs `ISOLATED`). |
| **Vanilla JavaScript** | ECMAScript 2024+ (ES6+) | Content scripts, bridge layer, and settings popup logic | Zero compilation or bundler overhead. Keeps the unpacked extension directory directly inspectable and readable without sourcemaps or build steps. |
| **Vanilla HTML5 & CSS3** | Modern Baseline (2024–2026) | Dropdown controls UI, settings popup, and responsive player overlays | Native Popover API, CSS Anchor Positioning (with fixed-position fallback), and CSS Custom Properties integrate cleanly into YouTube's Polymer DOM. |
| **Chrome Storage API** | MV3 (`chrome.storage.sync` + `chrome.storage.local`) | User preference persistence (speeds, quality defaults, toggle states) | Seamless cross-browser sync with automatic fallback to local storage if account sync is unavailable or offline. |

### Supporting Libraries & Web APIs

| Library / API | Version / Spec | Purpose | When to Use |
|---------------|----------------|---------|-------------|
| **HTML Popover API** | WHATWG / Baseline 2024 | Native top-layer dropdown management for speed & quality menus | Used for pill dropdown menus; handles light dismiss (click outside / `Escape`), focus management, and automatic top-layer placement without z-index collisions. |
| **CSS `light-dark()` & Custom Properties** | CSS Color Module Level 5 | Semantic theming reacting to YouTube's dark/light modes | Adapts pill buttons and popup UI seamlessly when YouTube toggles `html[dark]`. |
| **MutationObserver & ResizeObserver** | DOM Level 4 | YouTube SPA navigation tracking & toolbar presence detection | Detects when Like button toolbar mounts (`ytd-watch-metadata`, `segmented-like-dislike-button-view-model`) or when fullscreen mode toggles. |
| **Custom Event Envelope (`window.postMessage`)** | HTML5 Messaging | Bidirectional communication between `MAIN` world bridge and `ISOLATED` UI | Bridges isolated extension storage/DOM to YouTube's page-level player methods safely with origin and namespace verification. |

### Development, Testing & Verification Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| **Node.js Test Runner** | Node.js v24 (`node:test`, `node:assert/strict`) | Unit tests for storage serialization, message protocol, and state management | Built into Node v24; eliminates Jest/Mocha dependency bloat and executes sub-millisecond tests natively. |
| **JSDOM** | `^26.0.0` | Headless DOM simulation for content script UI injection & keyboard navigation | Allows rapid headless unit testing of DOM anchoring above the Like button without launching a browser. |
| **Puppeteer-Core / Chrome Launcher** | `^24.0.0` | Headless E2E smoke testing of unpacked extension | Launches real headless Chromium (`--headless=new`, `--load-extension=./youtube-quick-controls`) to verify manifest loading, permissions, and zero console errors. |

---

## Manifest V3 Architecture & Key Declarations

The deliverable lives in `youtube-quick-controls/` with a clean, minimal `manifest.json`.

```json
{
  "manifest_version": 3,
  "name": "YouTube Quick Controls",
  "version": "1.0.0",
  "description": "Quick playback speed and video quality dropdowns directly above YouTube's Like button.",
  "permissions": [
    "storage"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://www.youtube.com/*"
      ],
      "js": [
        "content/bridge-main.js"
      ],
      "world": "MAIN",
      "run_at": "document_idle"
    },
    {
      "matches": [
        "https://www.youtube.com/*"
      ],
      "js": [
        "content/content-isolated.js"
      ],
      "css": [
        "content/quick-controls.css"
      ],
      "world": "ISOLATED",
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "YouTube Quick Controls Settings",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

### Architectural Key Points

1. **`"world": "MAIN"` Content Script:**
   - Runs in the execution context of the YouTube web page.
   - Accesses YouTube's internal `#movie_player` DOM object and its JavaScript API methods:
     - `moviePlayer.getAvailableQualityLevels()`
     - `moviePlayer.getAvailableQualityData()`
     - `moviePlayer.getPlaybackQuality()`
     - `moviePlayer.setPlaybackQualityRange(quality, quality)`
     - `moviePlayer.setPlaybackQuality(quality)`
     - `moviePlayer.getPlaybackRate()` / `moviePlayer.setPlaybackRate(rate)`
   - Relays state changes to the `ISOLATED` world via `window.postMessage`.
2. **`"world": "ISOLATED"` Content Script:**
   - Runs in Chrome's isolated world; has access to `chrome.storage.sync` and `chrome.runtime`.
   - Injects the pill UI directly above the native Like button container (`segmented-like-dislike-button-view-model`).
   - Listens to native video element events (`ratechange`, `play`, `loadedmetadata`, `volumechange`).
   - Listens to YouTube SPA navigation events: `yt-navigate-finish`, `yt-page-data-updated`, and window `popstate`.
3. **Strict Origin & Envelope Verification:**
   - All `window.postMessage` payloads use a namespaced contract:
     ```js
     // Main to Isolated
     window.postMessage({ source: 'YQC_MAIN_BRIDGE', type: 'QUALITY_UPDATE', payload: { levels, current } }, '*');
     
     // Isolated to Main
     window.postMessage({ source: 'YQC_ISOLATED_UI', type: 'SET_QUALITY', payload: { quality: 'hd1080' } }, '*');
     ```
   - Listeners strictly verify `event.source === window` and `event.data?.source === 'YQC_...'` to prevent cross-frame or third-party interference.

---

## Modern Web UI & Styling APIs

### 1. Light/Dark Theme Adaptation with `light-dark()` & CSS Custom Properties

YouTube alternates themes by toggling the `dark` attribute on the `<html>` root (`<html dark="true">`). Quick Controls uses semantic CSS Custom Properties with modern `light-dark()` values and attribute overrides:

```css
:root {
  color-scheme: light dark;
  --yqc-bg-light: rgba(0, 0, 0, 0.05);
  --yqc-bg-dark: rgba(255, 255, 255, 0.1);
  --yqc-bg-hover-light: rgba(0, 0, 0, 0.1);
  --yqc-bg-hover-dark: rgba(255, 255, 255, 0.2);
  --yqc-text-light: #0f0f0f;
  --yqc-text-dark: #f1f1f1;
  --yqc-border-light: rgba(0, 0, 0, 0.1);
  --yqc-border-dark: rgba(255, 255, 255, 0.15);
  --yqc-menu-bg-light: #ffffff;
  --yqc-menu-bg-dark: #282828;

  --yqc-pill-bg: light-dark(var(--yqc-bg-light), var(--yqc-bg-dark));
  --yqc-pill-text: light-dark(var(--yqc-text-light), var(--yqc-text-dark));
  --yqc-menu-bg: light-dark(var(--yqc-menu-bg-light), var(--yqc-menu-bg-dark));
}

/* Explicit fallback matching YouTube's DOM attribute */
html[dark] {
  color-scheme: dark;
  --yqc-pill-bg: var(--yqc-bg-dark);
  --yqc-pill-text: var(--yqc-text-dark);
  --yqc-menu-bg: var(--yqc-menu-bg-dark);
}
```

### 2. Popover API & Dropdown Menus with Fallback

Pill dropdowns use `popover="auto"` to guarantee:
- Automatic **Top Layer** rendering (essential for fullscreen mode).
- Automatic **light dismiss** on click outside or `Escape`.
- Accessible keyboard navigation (`role="menu"`, `role="menuitem"`, `aria-expanded`).

```html
<!-- Pill Trigger -->
<button type="button" class="yqc-pill-btn" aria-haspopup="menu" aria-expanded="false" id="yqc-speed-trigger">
  <span class="yqc-pill-label">1.0x</span>
  <span class="yqc-pill-arrow" aria-hidden="true">▾</span>
</button>

<!-- Dropdown Popover -->
<div id="yqc-speed-menu" popover="auto" class="yqc-dropdown-menu" role="menu" aria-labelledby="yqc-speed-trigger">
  <div class="yqc-menu-items">
    <button type="button" role="menuitemradio" aria-checked="false" data-rate="0.5">0.5x</button>
    <button type="button" role="menuitemradio" aria-checked="true" data-rate="1.0">1.0x</button>
    <button type="button" role="menuitemradio" aria-checked="false" data-rate="1.5">1.5x</button>
    <button type="button" role="menuitemradio" aria-checked="false" data-rate="2.0">2.0x</button>
  </div>
</div>
```

#### Positioning & Fullscreen Fallback Strategy:
- **CSS Anchor Positioning**: `@supports (position-area: block-start span-inline-start)` positions the menu tethered directly to the pill.
- **Fixed/Absolute Fallback**: In browsers or environments without Anchor Positioning (or inside YouTube's custom fullscreen container), dropdowns compute coordinates relative to the trigger via `getBoundingClientRect()` or nest inside the relative pill wrapper.
- **Fullscreen Top Layer**: In fullscreen mode (`document.fullscreenElement === #movie_player`), popovers declared with `popover="auto"` or elements appended into `document.fullscreenElement` guarantee visibility above the video frame and below native player HUDs.

---

## Development & Test Setup

### Dev Dependencies (0 Runtime Dependencies)

```bash
# Core extension runtime: 0 dependencies (vanilla JS/HTML/CSS in youtube-quick-controls/)

# Root-level development & verification tooling:
npm install -D jsdom puppeteer-core
```

### `package.json` Scripts

```json
{
  "name": "youtube-quick-controls-project",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/**/*.test.js",
    "test:unit": "node --test tests/unit/**/*.test.js",
    "test:e2e": "node tests/e2e/verify-extension.js",
    "lint": "eslint youtube-quick-controls/"
  },
  "devDependencies": {
    "jsdom": "^26.0.0",
    "puppeteer-core": "^24.0.0"
  }
}
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Vanilla ES6+ (No Bundler)** | Vite / Webpack / Rollup | When the extension requires large third-party npm packages, TypeScript transpilation, or JSX. For direct DOM injection on YouTube, bundlers add debugging friction, build latency, and sourcemap confusion. |
| **Declarative MV3 `world: "MAIN"` Script** | Dynamic `<script>` Tag Injection (`document.createElement`) | Only in MV2 or legacy setups. In MV3, inline script injection is restricted by CSP and triggers security warnings; manifest-declared `world: "MAIN"` is the official, CSP-compliant Chromium solution. |
| **`chrome.storage.sync` with `local` Fallback** | `window.localStorage` | `localStorage` is completely inaccessible from MV3 service workers and is partition-scoped to youtube.com rather than the extension origin. `chrome.storage.sync` ensures cross-device user preference persistence. |
| **Native Popover API + CSS** | Custom absolute-positioned `<div>` with global click listeners | When supporting pre-2024 browsers lacking Popover support. Popover API solves z-index stacking and fullscreen top-layer rendering natively. |
| **Node.js Native Test Runner (`node:test`)** | Jest / Vitest | When complex mocking frameworks, snapshot testing, or Vite plugin pipelines are strictly required. For lightweight DOM and messaging unit tests, native runner is faster and has zero dependency churn. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Manifest V2 APIs** (`chrome.extension.*`, persistent background pages, `"manifest_version": 2`) | Chrome Web Store has completely deprecated MV2; MV2 extensions will not install or run in modern Chrome. | Manifest V3 standards (`chrome.runtime.*`, `action`, declarative content scripts). |
| **Inline Script Injection** (`document.createElement('script')` with `.textContent = ...`, `eval()`, `new Function()`) | Violates MV3 Content Security Policy (CSP). Triggers runtime errors and Chrome Web Store security rejections. | Manifest-declared `world: "MAIN"` content scripts communicating via structured `window.postMessage`. |
| **Broad Host Permissions** (`<all_urls>`, `*://*/*`, `https://*/*`) | Unnecessary attack surface; triggers intrusive browser permission warnings and lengthy CWS manual reviews. | Minimum necessary permissions: `permissions: ["storage"]` and scoped content script match: `"https://www.youtube.com/*"`. |
| **Synchronous `setInterval` Polling** | Consumes high CPU cycles and battery during video playback; causes frame drops on 4K/60fps streams. | Targeted `MutationObserver` on toolbar containers, debounced with `requestAnimationFrame`, coupled with YouTube's native `yt-navigate-finish` event hooks. |
| **Direct `#movie_player` Access from `ISOLATED` World** | Returns `undefined` or partial DOM stubs because YouTube's player API methods are attached to the element prototype in the page's execution context. | Execute API calls inside `world: "MAIN"` and pass data across to `ISOLATED` via `window.postMessage`. |
| **Heavy Frontend Frameworks** (React, Vue, Tailwind CLI in extension bundle) | Massive bundle size, DOM hydration overhead, styling conflicts with YouTube's Polymer elements, and build-step requirements. | Native Web Components / lightweight vanilla DOM templates with scoped CSS classes (`.yqc-*`). |

---

## Stack Patterns by Variant

### 1. Standard Watch Page (`/watch?v=...`)
- **Anchor Target:** Directly above `ytd-watch-metadata #top-row #actions #top-level-buttons-computed segmented-like-dislike-button-view-model` (the Like/Dislike button group).
- **Injection Lifecycle:** Triggered on `yt-navigate-finish` and observed via `MutationObserver` until the action toolbar mounts.

### 2. Fullscreen Video Player
- **Context:** `document.fullscreenElement` holds `#movie_player` or `.html5-video-player`.
- **Placement:** Modern YouTube ("Delhi" UI) provides `.ytp-fullscreen-quick-actions`; fallback injects directly into `.ytp-chrome-bottom` or Top Layer overlay within `document.fullscreenElement`.
- **Top Layer Rendering:** The Popover API (`popover="auto"`) automatically elevates menus into the browser's top layer above the fullscreen `<video>` element.

### 3. YouTube Shorts (`/shorts/...`)
- **Context:** Rendered inside `ytd-reel-video-renderer` items.
- **Behavior:** Speed controls remain active; quality controls reflect dynamic adaptive streaming rates for vertical video.
- **Event Scope:** Scoped to the currently active reel renderer element.

---

## Version Compatibility

| Component | Compatible Target | Notes |
|-----------|-------------------|-------|
| **Chrome Runtime** | Chrome 120+ (Baseline 2024+) | Supports MV3 `world: "MAIN"`, Popover API, `light-dark()`, and CSS Nesting. |
| **Node.js** | Node.js v24 LTS (v24.16.0+) | Uses built-in `node:test`, `node:assert/strict`, and ES modules (`"type": "module"`). |
| **JSDOM** | JSDOM `^26.0.0` | Node 24 compatible; supports modern DOM APIs and custom event dispatching. |
| **Puppeteer-Core** | `^24.0.0` | Connects directly to local Chrome binary for automated headless extension verification. |

---

## Sources

- [Chrome Extensions Official Documentation: Manifest V3 Migration](https://developer.chrome.com/docs/extensions/mv3/intro/) — Verified content script execution worlds (`world: "MAIN"` vs `"world": "ISOLATED"`).
- [Chrome Extensions Official Documentation: Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) — Verified manifest syntax, run_at timing, and isolation rules.
- [MDN Web Docs: Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) — Top-layer placement and auto-dismiss behavior.
- [MDN Web Docs: light-dark() CSS Color function](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark) — Color scheme adaptive properties.
- YouTube Polymer Architecture Analysis (`ytd-app`, `#movie_player`) — Verified player JS API methods (`getAvailableQualityLevels`, `setPlaybackQualityRange`, `setPlaybackRate`).

---
*Stack research for: YouTube Quick Controls (Manifest V3 Chrome Extension)*  
*Researched: 2026-11-11*
