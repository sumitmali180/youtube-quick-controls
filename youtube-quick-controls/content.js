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
  const IDLE_HIDE_DELAY_MS = 2500;
  const ACTIVITY_THROTTLE_MS = 150;

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    defaultSpeed: 1.0,
    defaultQuality: 'auto',
    autoApply: true
  });

  const STANDARD_SPEEDS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

  const STANDARD_QUALITY_SLOTS = Object.freeze([
    { quality: 'auto', label: 'Auto', isAutoOption: true },
    { quality: 'tiny', label: '144p', isAutoOption: false },
    { quality: 'small', label: '240p', isAutoOption: false },
    { quality: 'medium', label: '360p', isAutoOption: false },
    { quality: 'large', label: '480p', isAutoOption: false },
    { quality: 'hd720', label: '720p', isAutoOption: false },
    { quality: 'hd1080', label: '1080p', isAutoOption: false },
    { quality: 'hd1440', label: '1440p', isAutoOption: false },
    { quality: 'hd2160', label: '2160p', isAutoOption: false }
  ]);

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

  /**
   * Main UI & Media Controller managing two inline pill rows across watch,
   * fullscreen, and Shorts views alongside speed/quality sync.
   */
  class QuickControlsController {
    constructor() {
      this.settingsStore = new SettingsStore();
      this.bridge = new BridgeClient();
      this.mode = 'watch';
      this.hostEl = null;
      this.controlsAbort = null;
      this.activityAbort = null;
      this.lifecycleAbort = null;
      this.videoEl = null;
      this.videoAbort = null;
      this.observer = null;
      this.resizeObserver = null;
      this.anchorColumnEl = null;
      this.activeAnchor = null;
      this.debounceTimer = null;
      this.idleTimer = null;
      this.idleHideDelayMs = IDLE_HIDE_DELAY_MS;
      this.isIdleHidden = false;
      this.isPointerInsideHost = false;
      this.isPointerDownInsideHost = false;
      this.isKeyboardFocusedInsideHost = false;
      this.lastActivityTimestamp = 0;
      this.isEmittingKeepalive = false;
      this.keepaliveTimer = null;
      this.qualityPollTimers = [];
      this.tooltipTimer = null;
      this.isInternalRateChange = false;
      this.expectedInternalRate = null;
      this.isQualitySwitching = false;
      this.pendingQualityTarget = null;
      this.manualSpeedOverride = false;
      this.manualQualityOverride = false;
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
      this.stopFullscreenKeepalive();
      this.clearQualityTimers();
      this.bridge.clearPending();
      this.isQualitySwitching = false;
      this.pendingQualityTarget = null;
      this.manualSpeedOverride = false;
      this.manualQualityOverride = false;
    }

    handleFullscreenTransition() {
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
      if (this.hostEl?.isConnected) {
        this.bindActivityTargets();
      }
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
          const hostWidth = host.getBoundingClientRect().width || host.offsetWidth || 0;
          if (likeRect.width > 0 && parentRect.width > 0) {
            const rawOffset = Math.max(0, Math.round(likeRect.left - parentRect.left));
            const maxOffset =
              hostWidth > 0 && parentRect.width > hostWidth
                ? Math.round(parentRect.width - hostWidth)
                : rawOffset;
            const clampedOffset = Math.min(rawOffset, Math.max(0, maxOffset));
            host.style.marginInlineStart =
              clampedOffset > 0 && clampedOffset < parentRect.width ? `${clampedOffset}px` : '0px';
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
          const hostWidth = host.offsetWidth || 380;
          const hostHeight = host.offsetHeight || 56;
          if (likeRect.height > 0 && playerRect.height > 0) {
            const rawLeft = likeRect.left - playerRect.left;
            const maxLeft = Math.max(8, playerRect.width - hostWidth - 8);
            const clampedLeft = Math.max(8, Math.min(Math.round(rawLeft), Math.round(maxLeft)));
            const rawBottom = playerRect.bottom - likeRect.top + 8;
            const clampedBottom = Math.max(
              56,
              Math.min(Math.round(rawBottom), Math.round(playerRect.height - hostHeight - 8))
            );
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
          this.bindActivityTargets();
          return true;
        }
      }

      this.buildAndAttachHost(anchor);
      return true;
    }

    clearIdleTimer() {
      if (this.idleTimer) {
        clearTimeout(this.idleTimer);
        this.idleTimer = null;
      }
    }

    isInteractionActive() {
      return Boolean(
        this.isPointerInsideHost ||
          this.isPointerDownInsideHost ||
          this.isKeyboardFocusedInsideHost ||
          this.isQualitySwitching ||
          (this.ui?.tooltip && !this.ui.tooltip.hidden)
      );
    }

    setIdleHidden(hidden) {
      this.isIdleHidden = Boolean(hidden);
      if (!this.hostEl) return;
      if (this.isIdleHidden) {
        this.hostEl.dataset.yqcIdle = 'true';
      } else {
        delete this.hostEl.dataset.yqcIdle;
      }
    }

    scheduleIdleHide() {
      this.clearIdleTimer();
      if (!this.hostEl || !this.hostEl.isConnected || this.isInteractionActive()) {
        return;
      }
      const delay = Math.max(0, Number(this.idleHideDelayMs) || IDLE_HIDE_DELAY_MS);
      this.idleTimer = setTimeout(() => {
        this.idleTimer = null;
        if (!this.hostEl || !this.hostEl.isConnected || this.isInteractionActive()) {
          return;
        }
        this.setIdleHidden(true);
      }, delay);
    }

    showControlsOnActivity({ force = false } = {}) {
      if (this.isEmittingKeepalive) return;
      const now = Date.now();
      const wasHidden = this.isIdleHidden;
      if (wasHidden) {
        this.setIdleHidden(false);
      }
      if (force || wasHidden || !this.idleTimer || now - this.lastActivityTimestamp >= ACTIVITY_THROTTLE_MS) {
        this.lastActivityTimestamp = now;
        this.scheduleIdleHide();
      }
    }

    getPlayerActivityContainers() {
      const containers = new Set();
      if (this.activeAnchor?.fsPlayer) {
        containers.add(this.activeAnchor.fsPlayer);
      }
      if (document.fullscreenElement) {
        containers.add(document.fullscreenElement);
      }
      if (this.mode === 'shorts') {
        const activeReel =
          document.querySelector('ytd-reel-video-renderer[is-active]') ||
          document.getElementById('shorts-player')?.closest('ytd-reel-video-renderer');
        const reelPlayer =
          activeReel?.querySelector?.('#shorts-player, .html5-video-player, video') || activeReel;
        if (reelPlayer) {
          containers.add(reelPlayer);
        }
      } else {
        const moviePlayer = document.querySelector('#movie_player, .html5-video-player');
        if (moviePlayer) {
          containers.add(moviePlayer);
        }
      }
      if (this.videoEl) {
        const closestPlayer = this.videoEl.closest?.('#movie_player, .html5-video-player, #shorts-player');
        containers.add(closestPlayer || this.videoEl);
      }
      if (this.activeAnchor?.mountParent && this.activeAnchor.mountParent !== document.body) {
        containers.add(this.activeAnchor.mountParent);
      }
      return Array.from(containers).filter(Boolean);
    }

    bindActivityTargets() {
      if (this.activityAbort) {
        this.activityAbort.abort();
        this.activityAbort = null;
      }
      if (!this.hostEl || !this.hostEl.isConnected) {
        return;
      }
      this.activityAbort = new AbortController();
      const { signal } = this.activityAbort;
      const targets = this.getPlayerActivityContainers();

      const onMove = () => {
        this.showControlsOnActivity();
      };
      const onTouchTap = (event) => {
        if (event.pointerType === 'touch') {
          this.showControlsOnActivity({ force: true });
        }
      };

      for (const el of targets) {
        el.addEventListener('mousemove', onMove, { passive: true, signal });
        el.addEventListener('pointermove', onMove, { passive: true, signal });
        el.addEventListener('pointerenter', onMove, { passive: true, signal });
        el.addEventListener('pointerdown', onTouchTap, { passive: true, signal });
      }
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
        this.isEmittingKeepalive = true;
        try {
          fsTarget.classList?.remove('ytp-autohide');
          fsTarget.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true }));
        } catch {
          // Ignore keepalive pulse errors.
        } finally {
          this.isEmittingKeepalive = false;
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
      if (this.hostEl) {
        delete this.hostEl.dataset.yqcOpen;
      }
    }

    buildRowGroup(id, className, ariaLabel) {
      const row = document.createElement('div');
      row.id = id;
      row.className = `yqc-row ${className}`;
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', ariaLabel);
      return row;
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
      host.setAttribute('focusgroup', 'toolbar wrap');

      if (
        anchor.mode === 'watch' ||
        (anchor.mode === 'fullscreen' && anchor.fsPlacement === 'quick-actions-inline')
      ) {
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

      const handleHostEngage = () => {
        this.setIdleHidden(false);
        this.clearIdleTimer();
      };

      host.addEventListener(
        'pointerenter',
        () => {
          this.isPointerInsideHost = true;
          handleHostEngage();
          if (this.mode === 'fullscreen') {
            this.startFullscreenKeepalive();
          }
        },
        { signal }
      );

      host.addEventListener(
        'pointermove',
        () => {
          this.isPointerInsideHost = true;
          handleHostEngage();
        },
        { signal }
      );

      host.addEventListener(
        'pointerdown',
        () => {
          this.isPointerDownInsideHost = true;
          this.isPointerInsideHost = true;
          handleHostEngage();
        },
        { signal }
      );

      host.addEventListener(
        'pointerleave',
        () => {
          this.isPointerInsideHost = false;
          this.isPointerDownInsideHost = false;
          if (!this.isKeyboardFocusedInsideHost) {
            this.stopFullscreenKeepalive();
          }
          this.scheduleIdleHide();
        },
        { signal }
      );

      const clearPointerDown = () => {
        if (!this.isPointerDownInsideHost) return;
        this.isPointerDownInsideHost = false;
        if (!this.isPointerInsideHost && !this.isKeyboardFocusedInsideHost) {
          this.scheduleIdleHide();
        }
      };
      window.addEventListener('pointerup', clearPointerDown, { signal });
      window.addEventListener('pointercancel', clearPointerDown, { signal });

      host.addEventListener(
        'keydown',
        () => {
          this.isKeyboardFocusedInsideHost = true;
          handleHostEngage();
        },
        { signal }
      );

      host.addEventListener(
        'focusin',
        (event) => {
          let isKeyboardFocus = false;
          try {
            isKeyboardFocus = Boolean(!this.isPointerDownInsideHost && event.target?.matches?.(':focus-visible'));
          } catch {
            isKeyboardFocus = !this.isPointerDownInsideHost;
          }
          if (isKeyboardFocus) {
            this.isKeyboardFocusedInsideHost = true;
            handleHostEngage();
          }
          if (this.mode === 'fullscreen') {
            this.startFullscreenKeepalive();
          }
        },
        { signal }
      );

      host.addEventListener(
        'focusout',
        (event) => {
          const nextFocused = event.relatedTarget;
          if (nextFocused && host.contains(nextFocused)) {
            return;
          }
          this.isKeyboardFocusedInsideHost = false;
          if (!this.isPointerInsideHost) {
            this.stopFullscreenKeepalive();
          }
          this.scheduleIdleHide();
        },
        { signal }
      );

      const speedRow = this.buildRowGroup('yqc-speed-row', 'yqc-row-speed', 'Playback speed');
      const qualityRow = this.buildRowGroup('yqc-quality-row', 'yqc-row-quality', 'Video quality');

      const qualityStatus = document.createElement('span');
      qualityStatus.className = 'yqc-row-status';
      qualityStatus.setAttribute('aria-live', 'polite');
      qualityStatus.hidden = true;
      qualityRow.appendChild(qualityStatus);

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

      host.append(speedRow, qualityRow, tooltip);

      if (anchor.referenceNode && anchor.referenceNode.parentElement === anchor.mountParent) {
        anchor.mountParent.insertBefore(host, anchor.referenceNode);
      } else if (anchor.mode === 'fullscreen' && anchor.fsPlacement === 'above-like') {
        anchor.mountParent.appendChild(host);
      } else {
        anchor.mountParent.prepend(host);
      }

      this.hostEl = host;
      this.ui = {
        speedRow,
        qualityRow,
        qualityStatus,
        tooltip,
        tooltipText
      };

      if (typeof HTMLElement !== 'undefined' && !('focusGroup' in HTMLElement.prototype)) {
        this.installToolbarKeyboardFallback(host, signal);
      }

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

      this.renderSpeedRow();
      this.renderQualityRow();
      this.syncRovingTabIndex(host);
      this.alignHostWithAnchor(host, anchor);
      this.setIdleHidden(false);
      this.bindActivityTargets();
      this.scheduleIdleHide();
    }

    syncRovingTabIndex(host = this.hostEl) {
      if (!host) return;
      if (typeof HTMLElement !== 'undefined' && 'focusGroup' in HTMLElement.prototype) {
        return;
      }
      const items = Array.from(host.querySelectorAll('button.yqc-chip'));
      if (items.length === 0) return;

      const activeFocused =
        document.activeElement && host.contains(document.activeElement)
          ? items.find((el) => el === document.activeElement)
          : null;
      const existingStop = items.find((el) => el.getAttribute('tabindex') === '0');
      const activePressed = items.find((el) => el.getAttribute('aria-pressed') === 'true');
      const stop = activeFocused || existingStop || activePressed || items[0];

      for (const item of items) {
        item.setAttribute('tabindex', item === stop ? '0' : '-1');
      }
    }

    installToolbarKeyboardFallback(host, signal) {
      host.addEventListener(
        'focusin',
        (event) => {
          const target = event.target?.closest?.('button.yqc-chip');
          if (!target || !host.contains(target)) return;
          for (const item of host.querySelectorAll('button.yqc-chip')) {
            item.setAttribute('tabindex', item === target ? '0' : '-1');
          }
        },
        { signal }
      );

      host.addEventListener(
        'keydown',
        (event) => {
          const target = event.target?.closest?.('button.yqc-chip');
          if (!target || !host.contains(target)) return;

          const items = Array.from(host.querySelectorAll('button.yqc-chip'));
          if (items.length === 0) return;

          let isRtl = false;
          try {
            isRtl = getComputedStyle(host).direction === 'rtl';
          } catch {
            isRtl = false;
          }

          const nextKey = isRtl ? 'ArrowLeft' : 'ArrowRight';
          const prevKey = isRtl ? 'ArrowRight' : 'ArrowLeft';
          const currentIndex = items.indexOf(target);
          let nextTarget = null;

          if (event.key === nextKey) {
            nextTarget = items[currentIndex < 0 ? 0 : (currentIndex + 1) % items.length];
          } else if (event.key === prevKey) {
            nextTarget =
              items[currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length];
          } else if (event.key === 'Home') {
            nextTarget = items[0];
          } else if (event.key === 'End') {
            nextTarget = items[items.length - 1];
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            const speedChips = Array.from(
              this.ui?.speedRow?.querySelectorAll('button.yqc-chip') || []
            );
            const qualityChips = Array.from(
              this.ui?.qualityRow?.querySelectorAll('button.yqc-chip') || []
            );
            const inSpeed = speedChips.includes(target);
            const sourceRow = inSpeed ? speedChips : qualityChips;
            const destRow = inSpeed ? qualityChips : speedChips;
            if (destRow.length > 0) {
              const colIdx = Math.max(0, sourceRow.indexOf(target));
              nextTarget = destRow[Math.min(colIdx, destRow.length - 1)];
            }
          }

          if (nextTarget) {
            event.preventDefault();
            event.stopPropagation();
            for (const item of items) {
              item.setAttribute('tabindex', item === nextTarget ? '0' : '-1');
            }
            nextTarget.focus();
          }
        },
        { signal }
      );
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

    renderSpeedRow() {
      const speedRow = this.ui?.speedRow;
      if (!speedRow) return;

      const currentRate = clampSpeed(this.videoEl?.playbackRate ?? 1.0) ?? 1.0;
      const rates = this.getAvailableRates();
      const existingButtons = Array.from(speedRow.querySelectorAll('button.yqc-chip-speed'));
      const canUpdateInPlace =
        existingButtons.length === rates.length &&
        existingButtons.every((btn, idx) => btn.dataset.yqcRate === String(rates[idx]));

      if (canUpdateInPlace) {
        for (let idx = 0; idx < existingButtons.length; idx += 1) {
          const btn = existingButtons[idx];
          const isActive = Math.abs(rates[idx] - currentRate) < 0.005;
          btn.classList.toggle('yqc-is-active', isActive);
          btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        }
        return;
      }

      const focusedRate =
        document.activeElement && speedRow.contains(document.activeElement)
          ? document.activeElement.dataset?.yqcRate || null
          : null;

      speedRow.replaceChildren();
      let restoredFocusBtn = null;

      for (const rate of rates) {
        const label = formatRate(rate);
        const isActive = Math.abs(rate - currentRate) < 0.005;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'yqc-chip yqc-chip-speed';
        btn.dataset.yqcRate = String(rate);
        btn.textContent = label;
        btn.title = `Playback speed ${label}`;
        btn.setAttribute('aria-label', `Playback speed ${label}`);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        if (isActive) {
          btn.classList.add('yqc-is-active');
        }

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (btn.getAttribute('aria-disabled') === 'true') return;
          this.applyPlaybackSpeed(rate);
        });

        speedRow.appendChild(btn);
        if (focusedRate && btn.dataset.yqcRate === focusedRate) {
          restoredFocusBtn = btn;
        }
      }

      if (restoredFocusBtn) {
        restoredFocusBtn.focus();
      }
      this.syncRovingTabIndex(this.hostEl);
      if (this.hostEl?.isConnected && this.activeAnchor) {
        this.alignHostWithAnchor(this.hostEl, this.activeAnchor);
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
      if (!this.ui?.speedRow) return;
      if (clampSpeed(rate) === null) return;
      this.renderSpeedRow();
    }

    getQualitySlots(q) {
      const slots = STANDARD_QUALITY_SLOTS.map((slot) => ({ ...slot }));
      const standardSet = new Set(STANDARD_QUALITY_SLOTS.map((slot) => slot.quality));
      const extras = (q.options || [])
        .filter((opt) => opt && opt.quality && !standardSet.has(opt.quality))
        .sort((a, b) => (QUALITY_RANK[a.quality] || 99) - (QUALITY_RANK[b.quality] || 99));

      for (const opt of extras) {
        const compact =
          opt.quality === 'highres'
            ? '4320p'
            : String(opt.label || opt.quality).replace(/\s*\([^)]*\)$/, '').trim();
        slots.push({
          quality: opt.quality,
          label: compact || opt.quality,
          isAutoOption: Boolean(opt.isAutoOption)
        });
      }
      return slots;
    }

    renderQualityRow() {
      const qualityRow = this.ui?.qualityRow;
      if (!qualityRow) return;

      const q = this.qualityState;
      const slots = this.getQualitySlots(q);
      const byQuality = new Map((q.options || []).map((opt) => [opt.quality, opt]));
      const showLoadingStatus = Boolean(q.isLoading && (!q.options || q.options.length === 0));

      qualityRow.setAttribute('aria-busy', this.isQualitySwitching ? 'true' : 'false');

      if (this.ui.qualityStatus) {
        this.ui.qualityStatus.hidden = !showLoadingStatus;
        this.ui.qualityStatus.textContent = showLoadingStatus ? 'Loading…' : '';
      }

      const existingButtons = Array.from(qualityRow.querySelectorAll('button.yqc-chip-quality'));
      const canUpdateInPlace =
        existingButtons.length === slots.length &&
        existingButtons.every((btn, idx) => btn.dataset.yqcQuality === slots[idx].quality);

      const applySlotProps = (btn, slot) => {
        const opt = byQuality.get(slot.quality) || null;
        const isAvailable = Boolean(opt);
        const isActive =
          isAvailable &&
          (slot.isAutoOption ? Boolean(q.isAuto) : !q.isAuto && q.currentQuality === slot.quality);
        const isPending = this.isQualitySwitching && this.pendingQualityTarget === slot.quality;

        btn.classList.toggle('yqc-is-active', isActive);
        btn.classList.toggle('yqc-is-pending', isPending);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');

        if (isAvailable) {
          btn.removeAttribute('aria-disabled');
        } else {
          btn.setAttribute('aria-disabled', 'true');
        }

        if (slot.isAutoOption) {
          if (!isAvailable) {
            const msg = showLoadingStatus ? 'Auto (Loading…)' : 'Auto quality unavailable';
            btn.title = msg;
            btn.setAttribute('aria-label', msg);
          } else if (isActive && q.currentLabel && q.currentLabel !== 'Auto') {
            btn.title = `Auto (${q.currentLabel})`;
            btn.setAttribute('aria-label', `Auto quality (currently ${q.currentLabel})`);
          } else {
            btn.title = 'Auto quality';
            btn.setAttribute('aria-label', 'Auto quality');
          }
        } else if (isAvailable) {
          const fullLabel = opt.label || slot.label;
          btn.title = fullLabel;
          btn.setAttribute('aria-label', `Video quality ${fullLabel}`);
        } else {
          btn.title = showLoadingStatus ? `${slot.label} (Loading…)` : `${slot.label} (Unavailable)`;
          btn.setAttribute('aria-label', `Video quality ${slot.label} unavailable`);
        }
      };

      if (canUpdateInPlace) {
        for (let idx = 0; idx < existingButtons.length; idx += 1) {
          applySlotProps(existingButtons[idx], slots[idx]);
        }
        return;
      }

      const focusedQuality =
        document.activeElement && qualityRow.contains(document.activeElement)
          ? document.activeElement.dataset?.yqcQuality || null
          : null;

      for (const oldBtn of existingButtons) {
        oldBtn.remove();
      }

      let restoredFocusBtn = null;
      const statusNode = this.ui.qualityStatus || null;

      for (const slot of slots) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'yqc-chip yqc-chip-quality';
        btn.dataset.yqcQuality = slot.quality;
        btn.textContent = slot.label;
        applySlotProps(btn, slot);

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (btn.getAttribute('aria-disabled') === 'true' || this.isQualitySwitching) {
            return;
          }
          void this.applyVideoQuality(slot.quality, { markManual: true });
        });

        if (statusNode && statusNode.parentElement === qualityRow) {
          qualityRow.insertBefore(btn, statusNode);
        } else {
          qualityRow.appendChild(btn);
        }

        if (focusedQuality && slot.quality === focusedQuality) {
          restoredFocusBtn = btn;
        }
      }

      if (restoredFocusBtn) {
        restoredFocusBtn.focus();
      }
      this.syncRovingTabIndex(this.hostEl);
      if (this.hostEl?.isConnected && this.activeAnchor) {
        this.alignHostWithAnchor(this.hostEl, this.activeAnchor);
      }
    }

    mergePlayerState(nextState) {
      const prevRatesKey = JSON.stringify(this.qualityState.preferredRates || []);
      this.qualityState = {
        ...this.qualityState,
        ...nextState
      };
      this.renderQualityRow();

      const nextRatesKey = JSON.stringify(this.qualityState.preferredRates || []);
      if (nextRatesKey !== prevRatesKey) {
        this.renderSpeedRow();
      }
    }

    showTooltip(message) {
      if (!this.ui?.tooltip || !this.ui?.tooltipText) return;
      clearTimeout(this.tooltipTimer);
      this.ui.tooltipText.textContent = message;
      this.ui.tooltip.hidden = false;
      this.setIdleHidden(false);
      this.clearIdleTimer();
      this.tooltipTimer = setTimeout(() => {
        if (this.ui?.tooltip) {
          this.ui.tooltip.hidden = true;
        }
        this.scheduleIdleHide();
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
      this.pendingQualityTarget = targetQuality;
      this.setIdleHidden(false);
      this.clearIdleTimer();
      this.renderQualityRow();

      try {
        const result = await this.bridge.request(
          'YQC_REQ_SET_QUALITY',
          { mode: this.mode, quality: targetQuality, verifyTimeoutMs: 1500 },
          3500
        );

        this.isQualitySwitching = false;
        this.pendingQualityTarget = null;

        if (result?.applied && result?.state) {
          this.mergePlayerState(result.state);
          this.scheduleIdleHide();
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
        this.pendingQualityTarget = null;
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
      this.pendingQualityTarget = null;
      this.isPointerInsideHost = false;
      this.isPointerDownInsideHost = false;
      this.isKeyboardFocusedInsideHost = false;
      this.isIdleHidden = false;
      this.clearIdleTimer();
      this.stopFullscreenKeepalive();
      this.clearQualityTimers();
      clearTimeout(this.tooltipTimer);

      if (this.activityAbort) {
        this.activityAbort.abort();
        this.activityAbort = null;
      }
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
