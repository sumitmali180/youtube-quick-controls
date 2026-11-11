<!-- GSD:project-start source:PROJECT.md -->

## Project

**YouTube Quick Controls**

A lightweight, native-feeling Manifest V3 Chrome extension (**YouTube Quick Controls**) that places compact playback speed and video quality dropdown controls directly above YouTube's Like button — on regular watch pages, YouTube Shorts, and inside the fullscreen video player. Users can switch speed (`0.25x`–`3.0x` plus any custom rates) and dynamically available resolutions (including `Auto`) in one click without opening YouTube's Settings gear submenu.

**Core Value:** Playback speed and video quality controls must remain always accessible directly above YouTube's Like button in both normal mode and fullscreen mode, updating immediately and staying synchronized with YouTube's native player state.

### Constraints

- **Tech stack**: Vanilla Manifest V3 Chrome Extension (`HTML`, `CSS`, `ES6+ JavaScript`), zero external runtime dependencies or build bundlers required to load unpacked.
- **Permissions**: Minimum necessary MV3 permissions (`storage`, scoped `https://www.youtube.com/*` content script matching).
- **Security/CSP**: No inline scripts, no `eval()`, no inline event handlers; `MAIN` world bridge communicates with `ISOLATED` UI via validated `window.postMessage` envelope.
- **Performance**: Debounced `MutationObserver`, batched DOM updates, full cleanup of observers/listeners on navigation/teardown.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Executive Summary

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

## Manifest V3 Architecture & Key Declarations

### Architectural Key Points

## Modern Web UI & Styling APIs

### 1. Light/Dark Theme Adaptation with `light-dark()` & CSS Custom Properties

### 2. Popover API & Dropdown Menus with Fallback

- Automatic **Top Layer** rendering (essential for fullscreen mode).
- Automatic **light dismiss** on click outside or `Escape`.
- Accessible keyboard navigation (`role="menu"`, `role="menuitem"`, `aria-expanded`).

#### Positioning & Fullscreen Fallback Strategy:

- **CSS Anchor Positioning**: `@supports (position-area: block-start span-inline-start)` positions the menu tethered directly to the pill.
- **Fixed/Absolute Fallback**: In browsers or environments without Anchor Positioning (or inside YouTube's custom fullscreen container), dropdowns compute coordinates relative to the trigger via `getBoundingClientRect()` or nest inside the relative pill wrapper.
- **Fullscreen Top Layer**: In fullscreen mode (`document.fullscreenElement === #movie_player`), popovers declared with `popover="auto"` or elements appended into `document.fullscreenElement` guarantee visibility above the video frame and below native player HUDs.

## Development & Test Setup

### Dev Dependencies (0 Runtime Dependencies)

# Core extension runtime: 0 dependencies (vanilla JS/HTML/CSS in youtube-quick-controls/)

# Root-level development & verification tooling:

### `package.json` Scripts

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Vanilla ES6+ (No Bundler)** | Vite / Webpack / Rollup | When the extension requires large third-party npm packages, TypeScript transpilation, or JSX. For direct DOM injection on YouTube, bundlers add debugging friction, build latency, and sourcemap confusion. |
| **Declarative MV3 `world: "MAIN"` Script** | Dynamic `<script>` Tag Injection (`document.createElement`) | Only in MV2 or legacy setups. In MV3, inline script injection is restricted by CSP and triggers security warnings; manifest-declared `world: "MAIN"` is the official, CSP-compliant Chromium solution. |
| **`chrome.storage.sync` with `local` Fallback** | `window.localStorage` | `localStorage` is completely inaccessible from MV3 service workers and is partition-scoped to youtube.com rather than the extension origin. `chrome.storage.sync` ensures cross-device user preference persistence. |
| **Native Popover API + CSS** | Custom absolute-positioned `<div>` with global click listeners | When supporting pre-2024 browsers lacking Popover support. Popover API solves z-index stacking and fullscreen top-layer rendering natively. |
| **Node.js Native Test Runner (`node:test`)** | Jest / Vitest | When complex mocking frameworks, snapshot testing, or Vite plugin pipelines are strictly required. For lightweight DOM and messaging unit tests, native runner is faster and has zero dependency churn. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Manifest V2 APIs** (`chrome.extension.*`, persistent background pages, `"manifest_version": 2`) | Chrome Web Store has completely deprecated MV2; MV2 extensions will not install or run in modern Chrome. | Manifest V3 standards (`chrome.runtime.*`, `action`, declarative content scripts). |
| **Inline Script Injection** (`document.createElement('script')` with `.textContent = ...`, `eval()`, `new Function()`) | Violates MV3 Content Security Policy (CSP). Triggers runtime errors and Chrome Web Store security rejections. | Manifest-declared `world: "MAIN"` content scripts communicating via structured `window.postMessage`. |
| **Broad Host Permissions** (`<all_urls>`, `*://*/*`, `https://*/*`) | Unnecessary attack surface; triggers intrusive browser permission warnings and lengthy CWS manual reviews. | Minimum necessary permissions: `permissions: ["storage"]` and scoped content script match: `"https://www.youtube.com/*"`. |
| **Synchronous `setInterval` Polling** | Consumes high CPU cycles and battery during video playback; causes frame drops on 4K/60fps streams. | Targeted `MutationObserver` on toolbar containers, debounced with `requestAnimationFrame`, coupled with YouTube's native `yt-navigate-finish` event hooks. |
| **Direct `#movie_player` Access from `ISOLATED` World** | Returns `undefined` or partial DOM stubs because YouTube's player API methods are attached to the element prototype in the page's execution context. | Execute API calls inside `world: "MAIN"` and pass data across to `ISOLATED` via `window.postMessage`. |
| **Heavy Frontend Frameworks** (React, Vue, Tailwind CLI in extension bundle) | Massive bundle size, DOM hydration overhead, styling conflicts with YouTube's Polymer elements, and build-step requirements. | Native Web Components / lightweight vanilla DOM templates with scoped CSS classes (`.yqc-*`). |

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

## Version Compatibility

| Component | Compatible Target | Notes |
|-----------|-------------------|-------|
| **Chrome Runtime** | Chrome 120+ (Baseline 2024+) | Supports MV3 `world: "MAIN"`, Popover API, `light-dark()`, and CSS Nesting. |
| **Node.js** | Node.js v24 LTS (v24.16.0+) | Uses built-in `node:test`, `node:assert/strict`, and ES modules (`"type": "module"`). |
| **JSDOM** | JSDOM `^26.0.0` | Node 24 compatible; supports modern DOM APIs and custom event dispatching. |
| **Puppeteer-Core** | `^24.0.0` | Connects directly to local Chrome binary for automated headless extension verification. |

## Sources

- [Chrome Extensions Official Documentation: Manifest V3 Migration](https://developer.chrome.com/docs/extensions/mv3/intro/) — Verified content script execution worlds (`world: "MAIN"` vs `"world": "ISOLATED"`).
- [Chrome Extensions Official Documentation: Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) — Verified manifest syntax, run_at timing, and isolation rules.
- [MDN Web Docs: Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) — Top-layer placement and auto-dismiss behavior.
- [MDN Web Docs: light-dark() CSS Color function](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark) — Color scheme adaptive properties.
- YouTube Polymer Architecture Analysis (`ytd-app`, `#movie_player`) — Verified player JS API methods (`getAvailableQualityLevels`, `setPlaybackQualityRange`, `setPlaybackRate`).

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.agents/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
