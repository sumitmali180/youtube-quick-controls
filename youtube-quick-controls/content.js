/**
 * YouTube Quick Controls — ISOLATED World Content Controller
 *
 * Renders speed and quality pill dropdowns directly above YouTube's Like button,
 * syncs HTML5 video playbackRate, verifies dynamic quality updates via MAIN bridge,
 * and integrates settings persistence.
 */

(function initYqcContentController() {
  if (globalThis.__yqcContentInitialized) {
    return;
  }
  globalThis.__yqcContentInitialized = true;

  const BRIDGE_CHANNEL = 'YQC_BRIDGE';
  const SOURCE_ISOLATED = 'YQC_ISOLATED';
  const SOURCE_MAIN = 'YQC_MAIN';
  const HOST_ID = 'yqc-controls-host';

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    defaultSpeed: 1.0,
    defaultQuality: 'auto',
    autoApply: true
  });

  const STANDARD_SPEEDS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 3.0];

  const QUALITY_RANK = Object.freeze({
    highres: 9,
    hd2160: 8,
    hd1440: 7,
    hd1080: 6,
    hd720: 5,
    large: 4,
    medium: 3,
    small: 2,
    tiny: 1
  });

  function formatRate(rate) {
    const n = Number(rate);
    if (!Number.isFinite(n) || n <= 0) return '1.0x';
    if (Number.isInteger(n)) return `${n}.0x`;
    const rounded = Math.round(n * 100) / 100;
    return `${rounded}x`;
  }

  function clampSpeed(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0.1 || n > 16.0) return null;
    return Math.round(n * 100) / 100;
  }

  /**
   * Async storage wrapper using chrome.storage.sync with chrome.storage.local fallback.
   */
  class SettingsStore {
    constructor() {
      this.settings = { ...DEFAULT_SETTINGS };
      this.listeners = new Set();
      this.boundOnChanged = this.handleStorageChange.bind(this);
    }

    async load() {
      if (typeof chrome !== 'undefined' && chrome?.storage) {
        try {
          const syncData = await chrome.storage.sync.get(DEFAULT_SETTINGS);
          this.settings = { ...DEFAULT_SETTINGS, ...syncData };
          return this.settings;
        } catch {
          try {
            const localData = await chrome.storage.local.get(DEFAULT_SETTINGS);
            this.settings = { ...DEFAULT_SETTINGS, ...localData };
            return this.settings;
          } catch {
            return this.settings;
          }
        }
      }
      return this.settings;
    }

    observe() {
      if (typeof chrome !== 'undefined' && chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener(this.boundOnChanged);
      }
    }

    destroy() {
      if (typeof chrome !== 'undefined' && chrome?.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(this.boundOnChanged);
      }
      this.listeners.clear();
    }

    onChange(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    }

    async handleStorageChange(_changes, areaName) {
      if (areaName !== 'sync' && areaName !== 'local') return;
      const updated = await this.load();
      for (const fn of this.listeners) {
        fn(updated);
      }
    }
  }

  /**
   * Origin/source-verified postMessage RPC client communicating with MAIN world bridge.
   */
  class BridgeClient {
    constructor() {
      this.pending = new Map();
      this.eventListeners = new Map();
      this.counter = 0;
      this.boundOnMessage = this.onMessage.bind(this);
      window.addEventListener('message', this.boundOnMessage);
    }

    onMessage(event) {
      if (event.source !== window || event.origin !== window.location.origin) {
        return;
      }
      const msg = event.data;
      if (!msg || msg.channel !== BRIDGE_CHANNEL || msg.source !== SOURCE_MAIN) {
        return;
      }

      if (msg.requestId && this.pending.has(msg.requestId)) {
        const entry = this.pending.get(msg.requestId);
        this.pending.delete(msg.requestId);
        clearTimeout(entry.timer);
        if (msg.error) {
          entry.reject(new Error(msg.error));
        } else {
          entry.resolve(msg.payload);
        }
        return;
      }

      if (typeof msg.type === 'string' && msg.type.startsWith('YQC_EVENT_')) {
        const handlers = this.eventListeners.get(msg.type);
        if (handlers) {
          for (const handler of handlers) {
            handler(msg.payload);
          }
        }
      }
    }

    request(type, payload = {}, timeoutMs = 2500) {
      this.counter += 1;
      const requestId = `yqc_${Date.now()}_${this.counter}`;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(requestId);
          reject(new Error(`Bridge request timed out: ${type}`));
        }, timeoutMs);

        this.pending.set(requestId, { resolve, reject, timer });
        window.postMessage(
          {
            channel: BRIDGE_CHANNEL,
            source: SOURCE_ISOLATED,
            requestId,
            type,
            payload
          },
          window.location.origin
        );
      });
    }

    onEvent(type, fn) {
      if (!this.eventListeners.has(type)) {
        this.eventListeners.set(type, new Set());
      }
      this.eventListeners.get(type).add(fn);
      return () => this.eventListeners.get(type)?.delete(fn);
    }

    clearPending() {
      for (const [, entry] of this.pending.entries()) {
        clearTimeout(entry.timer);
        const err = new Error('Bridge request aborted on navigation');
        err.isNavigationAbort = true;
        entry.reject(err);
      }
      this.pending.clear();
    }

    destroy() {
      this.clearPending();
      window.removeEventListener('message', this.boundOnMessage);
      this.eventListeners.clear();
    }
  }

  function isDislikeElement(el) {
    if (!el) return false;
    const label = (el.getAttribute?.('aria-label') || '').toLowerCase();
    if (label.includes('dislike')) return true;
    return Boolean(el.closest?.('dislike-button-view-model, ytd-toggle-button-renderer#dislike-button, #dislike-button'));
  }

  function queryFirstLike(root, selectors) {
    if (!root || typeof root.querySelectorAll !== 'function') {
      return null;
    }
    for (const selector of selectors) {
      const matches = root.querySelectorAll(selector);
      for (const candidate of matches) {
        if (candidate && candidate.isConnected && !isDislikeElement(candidate)) {
          return candidate;
        }
      }
    }
    return null;
  }

  function createCaretSvg() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 12 12');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'yqc-caret');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M2.5 4.25L6 7.75L9.5 4.25');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.6');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    return svg;
  }

  /**
   * Main UI & Media Controller managing watch placement, speed, quality,
   * theme responsiveness, and popover lifecycle.
   */
  class QuickControlsController {
    constructor() {
      this.settingsStore = new SettingsStore();
      this.bridge = new BridgeClient();
      this.mode = 'watch';
      this.hostEl = null;
      this.controlsAbort = null;
      this.lifecycleAbort = null;
      this.videoEl = null;
      this.videoAbort = null;
      this.observer = null;
      this.resizeObserver = null;
      this.anchorColumnEl = null;
      this.activeAnchor = null;
      this.debounceTimer = null;
      this.keepaliveTimer = null;
      this.qualityPollTimers = [];
      this.tooltipTimer = null;
      this.isInternalRateChange = false;
      this.expectedInternalRate = null;
      this.isQualitySwitching = false;
      this.manualSpeedOverride = false;
      this.manualQualityOverride = false;
      this.openDropdownName = null;
      this.lastVideoKey = null;
      this.lastUrlHref = typeof location === 'object' ? location.href : '';
      this.appliedDefaultsForKey = null;

      this.qualityState = {
        available: false,
        isLoading: true,
        options: [],
        autoAvailable: false,
        currentQuality: null,
        currentLabel: 'Auto',
        isAuto: false,
        preferredRates: [],
        currentRate: null,
        videoId: null
      };

      this.ui = null;
    }

    async init() {
      await this.settingsStore.load();
      this.settingsStore.observe();
      this.settingsStore.onChange((settings) => this.handleSettingsUpdate(settings));

      this.bridge.onEvent('YQC_EVENT_PLAYER_STATE', (state) => {
        if (!state) return;
        this.mergePlayerState(state);
      });

      this.bridge.onEvent('YQC_EVENT_RATE_CHANGE', (payload) => {
        if (payload && Number.isFinite(payload.rate)) {
          this.syncSpeedUi(payload.rate);
        }
      });

      this.setupLifecycleObservers();
      this.refreshContext({ applyDefaultsIfNew: true });
    }

    setupLifecycleObservers() {
      if (this.lifecycleAbort) {
        this.lifecycleAbort.abort();
      }
      this.lifecycleAbort = new AbortController();
      const { signal } = this.lifecycleAbort;

      window.addEventListener(
        'yt-navigate-start',
        () => {
          this.handleNavigationStart();
        },
        { signal }
      );

      window.addEventListener(
        'yt-navigate-finish',
        () => {
          this.refreshContext({ applyDefaultsIfNew: true });
        },
        { signal }
      );

      window.addEventListener(
        'yt-page-data-updated',
        () => {
          this.refreshContext({ applyDefaultsIfNew: false });
        },
        { signal }
      );

      window.addEventListener(
        'popstate',
        () => {
          this.refreshContext({ applyDefaultsIfNew: true });
        },
        { signal }
      );

      const handleFsChange = () => {
        this.handleFullscreenTransition();
      };
      document.addEventListener('fullscreenchange', handleFsChange, { signal });
      document.addEventListener('webkitfullscreenchange', handleFsChange, { signal });

      window.addEventListener(
        'resize',
        () => {
          if (this.hostEl?.isConnected && this.activeAnchor) {
            this.alignHostWithAnchor(this.hostEl, this.activeAnchor);
          }
          if (this.openDropdownName && this.ui?.[this.openDropdownName]) {
            const ctrl = this.ui[this.openDropdownName];
            this.positionDropdownFallback(ctrl.trigger, ctrl.dropdown);
          }
        },
        { signal }
      );

      this.observer = new MutationObserver(() => {
        if (typeof location === 'object' && location.href !== this.lastUrlHref) {
          this.lastUrlHref = location.href;
          clearTimeout(this.debounceTimer);
          this.debounceTimer = setTimeout(() => {
            this.refreshContext({ applyDefaultsIfNew: true });
          }, 60);
          return;
        }
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          const prevVideo = this.videoEl;
          this.ensureMounted();
          if (this.mode === 'shorts' && this.videoEl && this.videoEl !== prevVideo) {
            this.manualSpeedOverride = false;
            this.manualQualityOverride = false;
            this.appliedDefaultsForKey = null;
            void this.fetchAndUpdateQualityState({ tryApplyDefaults: true });
          }
        }, 80);
      });

      const observeRoot = document.querySelector('ytd-app') || document.body || document.documentElement;
      this.observer.observe(observeRoot, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['is-active']
      });
    }

    handleNavigationStart() {
      this.closeAllDropdowns({ returnFocus: false });
      this.clearQualityTimers();
      this.bridge.clearPending();
      this.isQualitySwitching = false;
      this.manualSpeedOverride = false;
      this.manualQualityOverride = false;
    }

    handleFullscreenTransition() {
      this.closeAllDropdowns({ returnFocus: false });
      this.stopFullscreenKeepalive();
      this.ensureMounted();
      // YouTube may render .ytp-fullscreen-quick-actions slightly asynchronously after fullscreenchange
      for (const delay of [60, 260]) {
        setTimeout(() => {
          if (this.lifecycleAbort?.signal.aborted) return;
          this.ensureMounted();
        }, delay);
      }
      void this.fetchAndUpdateQualityState({ tryApplyDefaults: false });
    }

    detectMode() {
      if (document.fullscreenElement) {
        return 'fullscreen';
      }
      if (location.pathname.startsWith('/shorts')) {
        return 'shorts';
      }
      if (location.pathname.startsWith('/watch')) {
        return 'watch';
      }
      return 'other';
    }

    getVideoKey() {
      const url = new URL(location.href);
      if (url.pathname.startsWith('/watch')) {
        return `watch:${url.searchParams.get('v') || ''}`;
      }
      if (url.pathname.startsWith('/shorts')) {
        return `shorts:${url.pathname}`;
      }
      return url.pathname;
    }

    handleSettingsUpdate(settings) {
      if (!settings.enabled) {
        this.unmountControls();
        return;
      }
      this.refreshContext({ applyDefaultsIfNew: false });
    }

    /**
     * Locate active HTML5 video element for the current view mode.
     */
    findActiveVideo(mode = this.mode) {
      if (mode === 'shorts') {
        const activeShortsVideo =
          document.querySelector('ytd-reel-video-renderer[is-active] video') ||
          document.querySelector('#shorts-player video');
        if (activeShortsVideo) return activeShortsVideo;
      }
      if (document.fullscreenElement) {
        const fsVideo = document.fullscreenElement.querySelector('video');
        if (fsVideo) return fsVideo;
      }
      const playerVideo =
        document.querySelector('#movie_player video') ||
        document.querySelector('video.html5-main-video');
      if (playerVideo) return playerVideo;
      return document.querySelector('video');
    }

    bindVideoElement(video) {
      if (this.videoEl === video && this.videoAbort) {
        return;
      }
      if (this.videoAbort) {
        this.videoAbort.abort();
        this.videoAbort = null;
      }
      this.videoEl = video || null;
      if (!this.videoEl) {
        return;
      }

      this.videoAbort = new AbortController();
      const { signal } = this.videoAbort;

      this.videoEl.addEventListener(
        'ratechange',
        () => {
          const currentRate = this.videoEl.playbackRate;
          if (
            this.isInternalRateChange &&
            this.expectedInternalRate !== null &&
            Math.abs(currentRate - this.expectedInternalRate) < 0.005
          ) {
            this.isInternalRateChange = false;
            this.expectedInternalRate = null;
            return;
          }
          this.isInternalRateChange = false;
          this.expectedInternalRate = null;
          this.manualSpeedOverride = true;
          this.syncSpeedUi(currentRate);
        },
        { signal }
      );

      this.videoEl.addEventListener(
        'loadedmetadata',
        () => {
          void this.fetchAndUpdateQualityState({ tryApplyDefaults: true });
        },
        { signal }
      );

      this.videoEl.addEventListener(
        'playing',
        () => {
          const settings = this.settingsStore.settings;
          if (
            settings.enabled &&
            settings.autoApply &&
            !this.manualSpeedOverride &&
            settings.defaultSpeed !== 1.0 &&
            Math.abs((this.videoEl?.playbackRate || 1.0) - settings.defaultSpeed) > 0.01
          ) {
            this.applyPlaybackSpeed(settings.defaultSpeed, { markManual: false });
          }
        },
        { signal }
      );

      this.syncSpeedUi(this.videoEl.playbackRate || 1.0);
    }

    /**
     * Find Watch-page Like button element & safe container directly above it.
     */
    findWatchAnchor() {
      const likeSelectors = [
        'ytd-watch-metadata #actions segmented-like-dislike-button-view-model',
        'ytd-watch-metadata #actions ytd-segmented-like-dislike-button-renderer',
        'ytd-watch-metadata #actions like-button-view-model',
        'ytd-watch-metadata #top-level-buttons-computed segmented-like-dislike-button-view-model',
        'ytd-watch-metadata #top-level-buttons-computed ytd-toggle-button-renderer:first-child',
        'ytd-watch-metadata #top-level-buttons-computed button[aria-label*="like" i]',
        '#above-the-fold #top-level-buttons-computed button[aria-label*="like" i]',
        'ytd-watch-metadata #top-level-buttons-computed',
        '#above-the-fold #actions'
      ];

      const likeEl = queryFirstLike(document, likeSelectors);
      if (!likeEl) {
        return null;
      }

      const actionsInner = likeEl.closest('#actions-inner');
      const actionsContainer = likeEl.closest('#actions');
      const menuRenderer = likeEl.closest('ytd-menu-renderer');
      const mountParent =
        actionsInner || actionsContainer || menuRenderer?.parentElement || likeEl.parentElement;
      if (!mountParent) {
        return null;
      }

      const referenceNode = actionsInner
        ? actionsInner.querySelector('ytd-menu-renderer') || actionsInner.firstElementChild
        : actionsContainer
          ? actionsContainer.querySelector('#actions-inner, ytd-menu-renderer') || actionsContainer.firstElementChild
          : menuRenderer || likeEl;

      return {
        mode: 'watch',
        mountParent,
        referenceNode: referenceNode === this.hostEl ? referenceNode.nextElementSibling : referenceNode,
        likeEl
      };
    }

    /**
     * Find Fullscreen anchor inside document.fullscreenElement so controls remain
     * inside the browser Top Layer, directly above the fullscreen Like button or
     * cleanly above .ytp-chrome-controls when in classic fullscreen layout.
     */
    findFullscreenAnchor() {
      const fsRoot = document.fullscreenElement;
      if (!fsRoot) {
        return null;
      }

      const fsPlayer = fsRoot.matches?.('#movie_player, .html5-video-player')
        ? fsRoot
        : fsRoot.querySelector?.('#movie_player, .html5-video-player') || fsRoot;

      const fsLikeSelectors = [
        '.ytp-fullscreen-quick-actions segmented-like-dislike-button-view-model',
        '.ytp-fullscreen-quick-actions like-button-view-model',
        '.ytp-fullscreen-quick-actions ytd-toggle-button-renderer',
        '.ytp-fullscreen-quick-actions button[aria-label*="like" i]',
        '.ytp-fullscreen-quick-actions button:first-of-type'
      ];

      const likeEl = queryFirstLike(fsRoot, fsLikeSelectors);
      if (likeEl) {
        try {
          const likeRect = likeEl.getBoundingClientRect();
          const playerRect = fsPlayer.getBoundingClientRect();
          if (likeRect.height > 0 && playerRect.height > 0) {
            return {
              mode: 'fullscreen',
              fsPlacement: 'above-like',
              mountParent: fsPlayer,
              referenceNode: null,
              likeEl,
              fsPlayer
            };
          }
        } catch {
          // Fall through to inline quick-actions placement when rects are unavailable.
        }

        const quickActions =
          likeEl.closest('.ytp-overlay-bottom-right') ||
          likeEl.closest('.ytp-fullscreen-quick-actions') ||
          likeEl.parentElement;
        if (quickActions) {
          const wrapper =
            likeEl.closest('segmented-like-dislike-button-view-model, like-button-view-model, button-view-model') ||
            likeEl;
          return {
            mode: 'fullscreen',
            fsPlacement: 'quick-actions-inline',
            mountParent: quickActions,
            referenceNode: wrapper === this.hostEl ? wrapper.nextElementSibling : wrapper,
            likeEl,
            fsPlayer
          };
        }
      }

      // Classic fullscreen fallback: anchored cleanly above bottom controls inside fullscreen Top Layer
      const chromeBottom = fsPlayer.querySelector('.ytp-chrome-bottom');
      return {
        mode: 'fullscreen',
        fsPlacement: 'classic-overlay',
        mountParent: fsPlayer,
        referenceNode: chromeBottom === this.hostEl ? null : chromeBottom,
        likeEl: null,
        fsPlayer
      };
    }

    /**
     * Find active Shorts reel Like button strictly inside ytd-reel-video-renderer[is-active].
     */
    findShortsAnchor() {
      const activeReel =
        document.querySelector('ytd-reel-video-renderer[is-active]') ||
        document.getElementById('shorts-player')?.closest('ytd-reel-video-renderer');
      if (!activeReel || !activeReel.isConnected) {
        return null;
      }

      const shortsLikeSelectors = [
        'ytd-reel-player-overlay-renderer #actions #like-button',
        '#actions #like-button',
        'ytd-like-button-renderer',
        'like-button-view-model',
        'button[aria-label*="like" i]',
        '#actions'
      ];

      const likeEl = queryFirstLike(activeReel, shortsLikeSelectors);
      if (!likeEl) {
        return null;
      }

      const actionsCol = likeEl.closest('#actions') || likeEl.parentElement;
      if (!actionsCol) {
        return null;
      }

      const likeNode =
        likeEl.closest('#like-button, ytd-like-button-renderer, like-button-view-model') || likeEl;
      return {
        mode: 'shorts',
        mountParent: actionsCol,
        referenceNode: likeNode === this.hostEl ? likeNode.nextElementSibling : likeNode,
        likeEl: likeNode
      };
    }

    resolveAnchor(mode = this.mode) {
      if (mode === 'fullscreen') {
        return this.findFullscreenAnchor();
      }
      if (mode === 'shorts') {
        return this.findShortsAnchor();
      }
      if (mode === 'watch') {
        return this.findWatchAnchor();
      }
      return null;
    }

    alignHostWithAnchor(host, anchor) {
      if (!host || !anchor) {
        return;
      }

      host.dataset.yqcMode = anchor.mode;
      if (anchor.fsPlacement) {
        host.dataset.yqcFsPlacement = anchor.fsPlacement;
      } else {
        delete host.dataset.yqcFsPlacement;
      }

      host.classList.toggle(
        'yqc-fullscreen-overlay-slot',
        anchor.mode === 'fullscreen' && anchor.fsPlacement === 'classic-overlay'
      );

      if (anchor.mode === 'watch' && anchor.likeEl) {
        host.style.left = '';
        host.style.bottom = '';
        try {
          const likeRect = anchor.likeEl.getBoundingClientRect();
          const parentRect = anchor.mountParent.getBoundingClientRect();
          if (likeRect.width > 0 && parentRect.width > 0) {
            const offset = Math.max(0, Math.round(likeRect.left - parentRect.left));
            host.style.marginInlineStart = offset > 0 && offset < parentRect.width ? `${offset}px` : '0px';
          }
        } catch {
          host.style.marginInlineStart = '0px';
        }
        return;
      }

      if (anchor.mode === 'fullscreen' && anchor.fsPlacement === 'above-like' && anchor.likeEl) {
        host.style.marginInlineStart = '';
        try {
          const likeRect = anchor.likeEl.getBoundingClientRect();
          const playerRect = anchor.fsPlayer.getBoundingClientRect();
          const hostWidth = host.offsetWidth || 156;
          if (likeRect.height > 0 && playerRect.height > 0) {
            const rawLeft = likeRect.left - playerRect.left;
            const maxLeft = Math.max(8, playerRect.width - hostWidth - 8);
            const clampedLeft = Math.max(8, Math.min(Math.round(rawLeft), Math.round(maxLeft)));
            const rawBottom = playerRect.bottom - likeRect.top + 8;
            const clampedBottom = Math.max(56, Math.min(Math.round(rawBottom), Math.round(playerRect.height - 48)));
            host.style.left = `${clampedLeft}px`;
            host.style.bottom = `${clampedBottom}px`;
          }
        } catch {
          // Leave default overlay fallback coordinates if geometry temporarily unavailable.
        }
        return;
      }

      host.style.marginInlineStart = '';
      host.style.left = '';
      host.style.bottom = '';
    }

    ensureMounted() {
      if (!this.settingsStore.settings.enabled) {
        this.bindVideoElement(null);
        this.unmountControls();
        return false;
      }

      this.mode = this.detectMode();
      const video = this.findActiveVideo(this.mode);
      if (video) {
        this.bindVideoElement(video);
      }

      const anchor = this.resolveAnchor(this.mode);
      if (!anchor) {
        if (this.mode === 'other') {
          this.bindVideoElement(null);
          this.unmountControls();
        }
        return false;
      }

      // Deduplicate any stale containers elsewhere in the DOM.
      document.querySelectorAll(`#${HOST_ID}`).forEach((node) => {
        if (node !== this.hostEl) {
          node.remove();
        }
      });

      if (this.hostEl && this.hostEl.isConnected && this.hostEl.parentElement === anchor.mountParent) {
        const prevFsPlacement = this.hostEl.dataset.yqcFsPlacement || null;
        if (
          this.hostEl.dataset.yqcMode === anchor.mode &&
          prevFsPlacement === (anchor.fsPlacement || null)
        ) {
          this.activeAnchor = anchor;
          this.alignHostWithAnchor(this.hostEl, anchor);
          return true;
        }
      }

      this.buildAndAttachHost(anchor);
      return true;
    }

    startFullscreenKeepalive() {
      this.stopFullscreenKeepalive();
      if (this.mode !== 'fullscreen' || !document.fullscreenElement) return;
      if (this.hostEl) {
        this.hostEl.dataset.yqcOpen = 'true';
      }
      const fsTarget = this.activeAnchor?.fsPlayer || document.fullscreenElement;
      const pulse = () => {
        if (!fsTarget || !document.fullscreenElement) return;
        try {
          fsTarget.classList?.remove('ytp-autohide');
          fsTarget.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true }));
        } catch {
          // Ignore keepalive pulse errors.
        }
      };
      pulse();
      this.keepaliveTimer = setInterval(pulse, 900);
    }

    stopFullscreenKeepalive() {
      if (this.keepaliveTimer) {
        clearInterval(this.keepaliveTimer);
        this.keepaliveTimer = null;
      }
      if (this.hostEl && !this.openDropdownName) {
        delete this.hostEl.dataset.yqcOpen;
      }
    }

    buildAndAttachHost(anchor) {
      this.unmountControls();
      this.activeAnchor = anchor;

      this.controlsAbort = new AbortController();
      const { signal } = this.controlsAbort;

      const host = document.createElement('div');
      host.id = HOST_ID;
      host.className = 'yqc-root';
      host.dataset.yqcMode = anchor.mode;
      if (anchor.fsPlacement) {
        host.dataset.yqcFsPlacement = anchor.fsPlacement;
      }
      host.setAttribute('role', 'toolbar');
      host.setAttribute('aria-label', 'YouTube Quick Controls');

      if (anchor.mode === 'watch' || (anchor.mode === 'fullscreen' && anchor.fsPlacement === 'quick-actions-inline')) {
        anchor.mountParent.classList.add('yqc-actions-column');
        this.anchorColumnEl = anchor.mountParent;
      }

      // Prevent player click/hotkey side effects inside controls.
      const stopEvents = ['click', 'mousedown', 'pointerdown', 'dblclick', 'keydown', 'keyup'];
      for (const evtName of stopEvents) {
        host.addEventListener(
          evtName,
          (event) => {
            event.stopPropagation();
          },
          { signal }
        );
      }

      host.addEventListener('pointerenter', () => {
        if (this.mode === 'fullscreen') {
          this.startFullscreenKeepalive();
        }
      }, { signal });

      host.addEventListener('pointerleave', () => {
        if (!this.openDropdownName) {
          this.stopFullscreenKeepalive();
        }
      }, { signal });

      const speedControl = this.buildDropdownControl('speed', 'Playback speed', '1.0x');
      const qualityControl = this.buildDropdownControl('quality', 'Video quality', 'Auto');

      const tooltip = document.createElement('div');
      tooltip.className = 'yqc-tooltip';
      tooltip.setAttribute('role', 'status');
      tooltip.setAttribute('aria-live', 'polite');
      tooltip.hidden = true;

      const tooltipIcon = document.createElement('span');
      tooltipIcon.setAttribute('aria-hidden', 'true');
      tooltipIcon.textContent = '⚠';
      const tooltipText = document.createElement('span');
      tooltip.append(tooltipIcon, tooltipText);

      host.append(speedControl.group, qualityControl.group, tooltip);

      if (anchor.referenceNode && anchor.referenceNode.parentElement === anchor.mountParent) {
        anchor.mountParent.insertBefore(host, anchor.referenceNode);
      } else if (anchor.mode === 'fullscreen' && anchor.fsPlacement === 'above-like') {
        anchor.mountParent.appendChild(host);
      } else {
        anchor.mountParent.prepend(host);
      }

      this.hostEl = host;
      this.ui = {
        speed: speedControl,
        quality: qualityControl,
        tooltip,
        tooltipText
      };

      this.alignHostWithAnchor(host, anchor);
      this.setupDropdownBehavior('speed', speedControl, signal);
      this.setupDropdownBehavior('quality', qualityControl, signal);

      document.addEventListener(
        'click',
        (event) => {
          if (!this.hostEl || !this.hostEl.contains(event.target)) {
            this.closeAllDropdowns({ returnFocus: false });
          }
        },
        { signal }
      );

      document.addEventListener(
        'keydown',
        (event) => {
          if (event.key !== 'Escape') return;
          const hasOpenMenu =
            Boolean(this.openDropdownName) ||
            ['speed', 'quality'].some((candidate) => this.isDropdownOpen(candidate));
          if (hasOpenMenu) {
            event.preventDefault();
            event.stopPropagation();
            this.closeAllDropdowns({ returnFocus: true });
          }
        },
        { signal }
      );

      if (typeof ResizeObserver === 'function' && (anchor.likeEl || anchor.fsPlayer)) {
        this.resizeObserver = new ResizeObserver(() => {
          if (this.hostEl?.isConnected && this.activeAnchor) {
            this.alignHostWithAnchor(this.hostEl, this.activeAnchor);
          }
        });
        this.resizeObserver.observe(anchor.mountParent);
        if (anchor.fsPlayer && anchor.fsPlayer !== anchor.mountParent) {
          this.resizeObserver.observe(anchor.fsPlayer);
        }
      }

      this.renderSpeedMenu();
      this.renderQualityMenu();
      this.syncSpeedUi(this.videoEl ? this.videoEl.playbackRate : 1.0);
    }

    buildDropdownControl(name, ariaLabel, initialLabel) {
      const group = document.createElement('div');
      group.className = 'yqc-control-group';

      const triggerId = `yqc-${name}-trigger`;
      const menuId = `yqc-${name}-menu`;
      const anchorToken = `--yqc-anchor-${name}`;

      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.id = triggerId;
      trigger.className = `yqc-pill yqc-pill-${name}`;
      trigger.setAttribute('aria-haspopup', 'menu');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-label', ariaLabel);

      if ('anchorName' in trigger.style) {
        trigger.style.anchorName = anchorToken;
      }

      const labelSpan = document.createElement('span');
      labelSpan.className = 'yqc-pill-label';
      labelSpan.textContent = initialLabel;

      const busyDot = document.createElement('span');
      busyDot.className = 'yqc-pill-busy';
      busyDot.setAttribute('aria-hidden', 'true');

      trigger.append(labelSpan, busyDot, createCaretSvg());

      const dropdown = document.createElement('div');
      dropdown.id = menuId;
      dropdown.className = `yqc-dropdown yqc-dropdown-${name}`;
      dropdown.setAttribute('aria-labelledby', triggerId);

      const supportsPopover =
        typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;
      if (supportsPopover) {
        dropdown.setAttribute('popover', 'auto');
      } else {
        dropdown.hidden = true;
      }

      if ('positionAnchor' in dropdown.style) {
        dropdown.style.positionAnchor = anchorToken;
      }

      // Apply native command invoker attributes when supported (Modern Web Guidance `menu`)
      const supportsInvoker =
        typeof HTMLButtonElement !== 'undefined' && 'commandForElement' in HTMLButtonElement.prototype;
      if (supportsInvoker && supportsPopover) {
        trigger.setAttribute('commandfor', menuId);
        trigger.setAttribute('command', 'toggle-popover');
      }

      const menuList = document.createElement('div');
      menuList.className = 'yqc-menu-list';
      menuList.setAttribute('focusgroup', 'menu nomemory');
      if (typeof HTMLElement !== 'undefined' && !('focusGroup' in HTMLElement.prototype)) {
        menuList.setAttribute('role', 'menu');
      }

      dropdown.appendChild(menuList);

      let customInput = null;
      let customApplyBtn = null;
      if (name === 'speed') {
        const customRow = document.createElement('div');
        customRow.className = 'yqc-custom-row';

        customInput = document.createElement('input');
        customInput.type = 'number';
        customInput.className = 'yqc-custom-input';
        customInput.min = '0.1';
        customInput.max = '16';
        customInput.step = '0.05';
        customInput.placeholder = '1.15';
        customInput.setAttribute('aria-label', 'Custom playback speed');

        customApplyBtn = document.createElement('button');
        customApplyBtn.type = 'button';
        customApplyBtn.className = 'yqc-custom-apply';
        customApplyBtn.textContent = 'Set';

        customRow.append(customInput, customApplyBtn);
        dropdown.appendChild(customRow);
      }

      group.append(trigger, dropdown);
      return { group, trigger, labelSpan, dropdown, menuList, customInput, customApplyBtn, supportsPopover, supportsInvoker };
    }

    setupDropdownBehavior(name, control, signal) {
      const { trigger, dropdown, menuList, customInput, customApplyBtn, supportsPopover, supportsInvoker } = control;

      const handleOpen = () => {
        if (this.openDropdownName === name) {
          this.positionDropdownFallback(trigger, dropdown);
          return;
        }
        if (this.openDropdownName && this.openDropdownName !== name) {
          this.closeDropdown(this.openDropdownName, { returnFocus: false });
        }
        this.openDropdownName = name;
        trigger.setAttribute('aria-expanded', 'true');
        if (this.mode === 'fullscreen') {
          this.startFullscreenKeepalive();
        }
        this.positionDropdownFallback(trigger, dropdown);
        if (name === 'quality') {
          void this.fetchAndUpdateQualityState({ tryApplyDefaults: false });
        }
      };

      const handleClose = () => {
        const wasTrackedOpen =
          this.openDropdownName === name || trigger.getAttribute('aria-expanded') === 'true';
        if (this.openDropdownName === name) {
          this.openDropdownName = null;
        }
        trigger.setAttribute('aria-expanded', 'false');
        if (wasTrackedOpen) {
          this.stopFullscreenKeepalive();
        }
      };

      if (supportsPopover) {
        dropdown.addEventListener(
          'beforetoggle',
          (event) => {
            if (event.newState === 'open') {
              handleOpen();
            } else {
              handleClose();
            }
          },
          { signal }
        );
        dropdown.addEventListener(
          'toggle',
          (event) => {
            const isActuallyOpen = this.isDropdownOpen(name);
            if (event.newState === 'open' && isActuallyOpen) {
              handleOpen();
            } else if (event.newState === 'closed' && !isActuallyOpen) {
              handleClose();
            }
          },
          { signal }
        );
      }

      trigger.addEventListener(
        'click',
        (event) => {
          event.stopPropagation();
          if (supportsPopover && supportsInvoker) {
            // Browser handles toggle via commandfor="menuId" command="toggle-popover"
            return;
          }
          if (supportsPopover) {
            dropdown.togglePopover();
            return;
          }
          const isOpening = dropdown.hidden;
          if (isOpening) {
            dropdown.hidden = false;
            handleOpen();
          } else {
            dropdown.hidden = true;
            handleClose();
          }
        },
        { signal }
      );

      // Keyboard fallback navigation when native focusGroup is unavailable
      if (typeof HTMLElement !== 'undefined' && !('focusGroup' in HTMLElement.prototype)) {
        menuList.addEventListener(
          'keydown',
          (event) => {
            const items = Array.from(menuList.querySelectorAll('button.yqc-menu-item:not(:disabled)'));
            if (items.length === 0) return;
            const currentIndex = items.indexOf(document.activeElement);
            let nextIndex = -1;

            if (event.key === 'ArrowDown') {
              nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
            } else if (event.key === 'ArrowUp') {
              nextIndex = currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
            } else if (event.key === 'Home') {
              nextIndex = 0;
            } else if (event.key === 'End') {
              nextIndex = items.length - 1;
            } else if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              this.closeDropdown(name, { returnFocus: true });
              return;
            }

            if (nextIndex !== -1) {
              event.preventDefault();
              event.stopPropagation();
              items[nextIndex].focus();
            }
          },
          { signal }
        );
      }

      if (name === 'speed' && customInput && customApplyBtn) {
        const submitCustom = () => {
          const parsed = clampSpeed(customInput.value);
          if (parsed === null) {
            this.showTooltip('Enter a speed between 0.1x and 16.0x');
            customInput.focus();
            return;
          }
          this.applyPlaybackSpeed(parsed);
          this.closeDropdown('speed', { returnFocus: true });
        };

        customApplyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          submitCustom();
        }, { signal });

        customInput.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            submitCustom();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            this.closeDropdown('speed', { returnFocus: true });
          }
        }, { signal });
      }
    }

    positionDropdownFallback(trigger, dropdown) {
      const supportsCssAnchor =
        typeof CSS !== 'undefined' &&
        typeof CSS.supports === 'function' &&
        CSS.supports('position-area', 'block-end span-inline-end');

      if (supportsCssAnchor && dropdown.hasAttribute('popover')) {
        dropdown.style.top = '';
        dropdown.style.left = '';
        return;
      }

      try {
        const tRect = trigger.getBoundingClientRect();
        const menuHeight = Math.min(dropdown.scrollHeight || 220, 300);
        const menuWidth = Math.max(dropdown.offsetWidth || 160, 152);
        const openUpward =
          this.mode === 'fullscreen' ||
          (window.innerHeight - tRect.bottom < menuHeight + 12 && tRect.top > menuHeight + 12);

        const rawTop = openUpward ? tRect.top - menuHeight - 6 : tRect.bottom + 6;
        const clampedTop = Math.max(8, Math.min(rawTop, Math.max(8, window.innerHeight - menuHeight - 8)));
        const clampedLeft = Math.max(8, Math.min(tRect.left, Math.max(8, window.innerWidth - menuWidth - 8)));

        dropdown.style.top = `${Math.round(clampedTop)}px`;
        dropdown.style.left = `${Math.round(clampedLeft)}px`;
      } catch {
        // Safe no-op in layoutless test environments.
      }
    }

    closeDropdown(name, { returnFocus = false } = {}) {
      const control = this.ui?.[name];
      if (!control) return;
      const { trigger, dropdown, supportsPopover } = control;

      if (supportsPopover) {
        try {
          if (dropdown.matches(':popover-open')) {
            dropdown.hidePopover();
          }
        } catch {
          // Ignore if already hidden/detached.
        }
      } else {
        dropdown.hidden = true;
      }

      trigger.setAttribute('aria-expanded', 'false');
      if (this.openDropdownName === name) {
        this.openDropdownName = null;
      }
      if (returnFocus) {
        trigger.focus();
      }
    }

    isDropdownOpen(name) {
      const control = this.ui?.[name];
      if (!control) return false;
      if (control.supportsPopover) {
        try {
          return control.dropdown.matches(':popover-open');
        } catch {
          return false;
        }
      }
      return !control.dropdown.hidden;
    }

    closeAllDropdowns({ returnFocus = false } = {}) {
      const namesToClose = new Set();
      if (this.openDropdownName) {
        namesToClose.add(this.openDropdownName);
      }
      for (const candidate of ['speed', 'quality']) {
        if (this.isDropdownOpen(candidate)) {
          namesToClose.add(candidate);
        }
      }
      for (const candidate of namesToClose) {
        this.closeDropdown(candidate, { returnFocus });
      }
    }

    getAvailableRates() {
      const merged = new Set(STANDARD_SPEEDS);
      if (Array.isArray(this.qualityState.preferredRates)) {
        for (const rate of this.qualityState.preferredRates) {
          const valid = clampSpeed(rate);
          if (valid !== null) merged.add(valid);
        }
      }
      if (this.videoEl && Number.isFinite(this.videoEl.playbackRate)) {
        const current = clampSpeed(this.videoEl.playbackRate);
        if (current !== null) merged.add(current);
      }
      return Array.from(merged).sort((a, b) => a - b);
    }

    renderSpeedMenu() {
      const control = this.ui?.speed;
      if (!control) return;

      const currentRate = clampSpeed(this.videoEl?.playbackRate ?? 1.0) ?? 1.0;
      const rates = this.getAvailableRates();
      const useFallbackMenuRoles =
        typeof HTMLElement !== 'undefined' && !('focusGroup' in HTMLElement.prototype);

      control.menuList.replaceChildren();
      for (const rate of rates) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'yqc-menu-item';
        item.dataset.yqcRate = String(rate);
        if (useFallbackMenuRoles) {
          item.setAttribute('role', 'menuitem');
        }

        const isActive = Math.abs(rate - currentRate) < 0.005;
        if (isActive) {
          item.classList.add('yqc-is-active');
          item.setAttribute('aria-current', 'true');
        }

        const textSpan = document.createElement('span');
        textSpan.textContent = formatRate(rate);
        const checkSpan = document.createElement('span');
        checkSpan.className = 'yqc-menu-check';
        checkSpan.setAttribute('aria-hidden', 'true');
        checkSpan.textContent = '✓';

        item.append(textSpan, checkSpan);
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          this.applyPlaybackSpeed(rate);
          this.closeDropdown('speed', { returnFocus: true });
        });
        control.menuList.appendChild(item);
      }

      if (control.customInput) {
        control.customInput.value = String(currentRate);
      }
    }

    applyPlaybackSpeed(rate, { markManual = true } = {}) {
      const targetRate = clampSpeed(rate);
      if (targetRate === null) return false;
      if (markManual) {
        this.manualSpeedOverride = true;
      }

      const video = this.findActiveVideo(this.mode) || this.videoEl;
      if (video) {
        this.bindVideoElement(video);
        this.isInternalRateChange = true;
        this.expectedInternalRate = targetRate;
        try {
          // Mutate playbackRate directly without pausing or seeking.
          video.playbackRate = targetRate;
        } finally {
          setTimeout(() => {
            if (this.expectedInternalRate === targetRate) {
              this.isInternalRateChange = false;
              this.expectedInternalRate = null;
            }
          }, 50);
        }
      }

      this.syncSpeedUi(video ? video.playbackRate : targetRate);
      return true;
    }

    syncSpeedUi(rate) {
      const valid = clampSpeed(rate) ?? 1.0;
      const control = this.ui?.speed;
      if (!control) return;

      control.labelSpan.textContent = formatRate(valid);
      this.renderSpeedMenu();
    }

    getQualityDisplayLabel() {
      const q = this.qualityState;
      if (q.isLoading && q.options.length === 0) {
        return 'Loading...';
      }
      if (q.isAuto && q.autoAvailable) {
        return q.currentLabel && q.currentLabel !== 'Auto' ? `Auto (${q.currentLabel})` : 'Auto';
      }
      return q.currentLabel || 'Auto';
    }

    renderQualityMenu() {
      const control = this.ui?.quality;
      if (!control) return;

      const q = this.qualityState;
      const useFallbackMenuRoles =
        typeof HTMLElement !== 'undefined' && !('focusGroup' in HTMLElement.prototype);

      control.labelSpan.textContent = this.getQualityDisplayLabel();
      control.trigger.setAttribute('aria-busy', this.isQualitySwitching ? 'true' : 'false');
      control.menuList.replaceChildren();

      if (!q.options || q.options.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'yqc-menu-empty';
        empty.textContent = q.isLoading ? 'Loading available qualities...' : 'No quality options available';
        control.menuList.appendChild(empty);
        return;
      }

      for (const opt of q.options) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'yqc-menu-item';
        item.dataset.yqcQuality = opt.quality;
        if (useFallbackMenuRoles) {
          item.setAttribute('role', 'menuitem');
        }

        const isActive = opt.isAutoOption
          ? Boolean(q.isAuto)
          : !q.isAuto && q.currentQuality === opt.quality;

        if (isActive) {
          item.classList.add('yqc-is-active');
          item.setAttribute('aria-current', 'true');
        }

        const textSpan = document.createElement('span');
        textSpan.textContent =
          opt.isAutoOption && q.isAuto && q.currentLabel && q.currentLabel !== 'Auto'
            ? `Auto (${q.currentLabel})`
            : opt.label;

        const checkSpan = document.createElement('span');
        checkSpan.className = 'yqc-menu-check';
        checkSpan.setAttribute('aria-hidden', 'true');
        checkSpan.textContent = '✓';

        item.append(textSpan, checkSpan);
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          void this.applyVideoQuality(opt.quality, { markManual: true });
          this.closeDropdown('quality', { returnFocus: true });
        });
        control.menuList.appendChild(item);
      }
    }

    mergePlayerState(nextState) {
      const prevRatesKey = JSON.stringify(this.qualityState.preferredRates || []);
      this.qualityState = {
        ...this.qualityState,
        ...nextState
      };
      this.renderQualityMenu();

      const nextRatesKey = JSON.stringify(this.qualityState.preferredRates || []);
      if (nextRatesKey !== prevRatesKey) {
        this.renderSpeedMenu();
      }
    }

    showTooltip(message) {
      if (!this.ui?.tooltip || !this.ui?.tooltipText) return;
      clearTimeout(this.tooltipTimer);
      this.ui.tooltipText.textContent = message;
      this.ui.tooltip.hidden = false;
      this.tooltipTimer = setTimeout(() => {
        if (this.ui?.tooltip) {
          this.ui.tooltip.hidden = true;
        }
      }, 3600);
    }

    async applyVideoQuality(targetQuality, { markManual = true } = {}) {
      if (this.isQualitySwitching) {
        return false;
      }
      if (markManual) {
        this.manualQualityOverride = true;
      }

      const previousState = { ...this.qualityState };
      this.isQualitySwitching = true;
      this.renderQualityMenu();

      try {
        const result = await this.bridge.request(
          'YQC_REQ_SET_QUALITY',
          { mode: this.mode, quality: targetQuality, verifyTimeoutMs: 1500 },
          3500
        );

        this.isQualitySwitching = false;

        if (result?.applied && result?.state) {
          this.mergePlayerState(result.state);
          return true;
        }

        // Graceful fallback: keep previous selected quality visible unless player reports real active state
        const fallbackState = result?.state?.available ? result.state : previousState;
        this.mergePlayerState(fallbackState);
        const targetLabel =
          previousState.options.find((o) => o.quality === targetQuality)?.label || targetQuality;
        this.showTooltip(
          result?.reason || `Could not switch to ${targetLabel}. Keeping previous quality.`
        );
        return false;
      } catch (error) {
        this.isQualitySwitching = false;
        if (error?.isNavigationAbort) {
          return false;
        }
        this.mergePlayerState(previousState);
        this.showTooltip(error?.message || 'Quality change could not be verified.');
        return false;
      }
    }

    pickBestAvailableQuality(desiredQuality, state) {
      if (!state?.options || state.options.length === 0) return null;
      if (desiredQuality === 'auto') {
        return state.autoAvailable ? 'auto' : null;
      }
      if (state.options.some((o) => o.quality === desiredQuality)) {
        return desiredQuality;
      }
      const desiredRank = QUALITY_RANK[desiredQuality] || 0;
      const concrete = state.options.filter((o) => !o.isAutoOption);
      const lowerOrEqual = concrete
        .filter((o) => (QUALITY_RANK[o.quality] || 0) <= desiredRank)
        .sort((a, b) => (QUALITY_RANK[b.quality] || 0) - (QUALITY_RANK[a.quality] || 0));
      if (lowerOrEqual.length > 0) {
        return lowerOrEqual[0].quality;
      }
      return concrete[0]?.quality || null;
    }

    async fetchAndUpdateQualityState({ tryApplyDefaults = false } = {}) {
      try {
        const state = await this.bridge.request('YQC_REQ_GET_STATE', { mode: this.mode }, 1500);
        if (state) {
          this.mergePlayerState(state);
          if (tryApplyDefaults && state.available) {
            await this.maybeApplyDefaults();
          }
          if (state.isLoading || !state.available) {
            this.scheduleQualityRefetch();
          }
        }
      } catch {
        this.scheduleQualityRefetch();
      }
    }

    scheduleQualityRefetch() {
      this.clearQualityTimers();
      for (const delay of [300, 900, 1800]) {
        const id = setTimeout(async () => {
          if (!this.hostEl?.isConnected) return;
          try {
            const state = await this.bridge.request('YQC_REQ_GET_STATE', { mode: this.mode }, 1200);
            if (state?.available) {
              this.mergePlayerState(state);
              await this.maybeApplyDefaults();
            }
          } catch {
            // Player state not ready yet; subsequent timer or event will refresh.
          }
        }, delay);
        this.qualityPollTimers.push(id);
      }
    }

    clearQualityTimers() {
      for (const id of this.qualityPollTimers) {
        clearTimeout(id);
      }
      this.qualityPollTimers = [];
    }

    async maybeApplyDefaults() {
      const settings = this.settingsStore.settings;
      if (!settings.enabled || !settings.autoApply) return;
      const key = this.getVideoKey();
      if (this.appliedDefaultsForKey === key) return;
      this.appliedDefaultsForKey = key;

      if (!this.manualSpeedOverride && settings.defaultSpeed && settings.defaultSpeed !== 1.0) {
        this.applyPlaybackSpeed(settings.defaultSpeed, { markManual: false });
      }
      if (!this.manualQualityOverride && settings.defaultQuality && settings.defaultQuality !== 'auto' && this.qualityState.available) {
        const best = this.pickBestAvailableQuality(settings.defaultQuality, this.qualityState);
        if (best && best !== this.qualityState.currentQuality) {
          await this.applyVideoQuality(best, { markManual: false });
        }
      }
    }

    refreshContext({ applyDefaultsIfNew = false } = {}) {
      this.lastUrlHref = typeof location === 'object' ? location.href : '';
      const nextKey = this.getVideoKey();
      if (nextKey !== this.lastVideoKey) {
        this.lastVideoKey = nextKey;
        if (applyDefaultsIfNew) {
          this.appliedDefaultsForKey = null;
          this.manualSpeedOverride = false;
          this.manualQualityOverride = false;
        }
      }
      this.ensureMounted();
      void this.fetchAndUpdateQualityState({ tryApplyDefaults: applyDefaultsIfNew });
    }

    unmountControls() {
      this.closeAllDropdowns({ returnFocus: false });
      this.stopFullscreenKeepalive();
      this.clearQualityTimers();
      clearTimeout(this.tooltipTimer);

      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }
      if (this.controlsAbort) {
        this.controlsAbort.abort();
        this.controlsAbort = null;
      }
      if (this.anchorColumnEl) {
        this.anchorColumnEl.classList.remove('yqc-actions-column');
        this.anchorColumnEl = null;
      }
      if (this.hostEl) {
        this.hostEl.remove();
        this.hostEl = null;
      }
      document.querySelectorAll(`#${HOST_ID}`).forEach((el) => el.remove());
      this.activeAnchor = null;
      this.ui = null;
    }

    destroy() {
      this.unmountControls();
      clearTimeout(this.debounceTimer);
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      if (this.lifecycleAbort) {
        this.lifecycleAbort.abort();
        this.lifecycleAbort = null;
      }
      if (this.videoAbort) {
        this.videoAbort.abort();
        this.videoAbort = null;
      }
      this.settingsStore.destroy();
      this.bridge.destroy();
      globalThis.__yqcContentInitialized = false;
    }
  }

  const controller = new QuickControlsController();
  globalThis.__YQC_CONTROLLER__ = controller;
  void controller.init();
})();
