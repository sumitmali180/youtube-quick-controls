/**
 * YouTube Quick Controls — MAIN World Player Bridge
 *
 * Runs directly in YouTube's execution context (`world: "MAIN"`) so it can
 * inspect and call methods on `#movie_player` and `#shorts-player` without
 * violating YouTube's Trusted Types Content Security Policy.
 */

(function initYqcMainBridge() {
  if (globalThis.__yqcMainBridgeInitialized) {
    return;
  }
  globalThis.__yqcMainBridgeInitialized = true;

  const BRIDGE_CHANNEL = 'YQC_BRIDGE';
  const SOURCE_ISOLATED = 'YQC_ISOLATED';
  const SOURCE_MAIN = 'YQC_MAIN';

  const QUALITY_ORDER = [
    'highres',
    'hd2160',
    'hd1440',
    'hd1080',
    'hd720',
    'large',
    'medium',
    'small',
    'tiny'
  ];

  const QUALITY_LABELS = Object.freeze({
    auto: 'Auto',
    default: 'Auto',
    highres: '4320p (8K)',
    hd2160: '2160p (4K)',
    hd1440: '1440p',
    hd1080: '1080p',
    hd720: '720p',
    large: '480p',
    medium: '360p',
    small: '240p',
    tiny: '144p'
  });

  const watchedPlayers = new WeakSet();
  const autoPreferenceByPlayer = new WeakMap();

  /**
   * Resolve the active YouTube player API host element for the current view.
   * @param {'watch'|'fullscreen'|'shorts'|'auto'} mode
   * @returns {HTMLElement|null}
   */
  function resolvePlayer(mode = 'auto') {
    const isShortsRoute =
      mode === 'shorts' ||
      (mode === 'auto' && typeof location === 'object' && location.pathname.startsWith('/shorts'));

    if (isShortsRoute) {
      const activeReelPlayer =
        document.querySelector('ytd-reel-video-renderer[is-active] #shorts-player') ||
        document.querySelector('ytd-reel-video-renderer[is-active] .html5-video-player');
      if (activeReelPlayer) {
        return activeReelPlayer;
      }
      const shortsPlayer = document.getElementById('shorts-player');
      if (shortsPlayer) {
        return shortsPlayer;
      }
    }

    if (document.fullscreenElement) {
      if (document.fullscreenElement.matches?.('#movie_player, .html5-video-player')) {
        return document.fullscreenElement;
      }
      const fsPlayer = document.fullscreenElement.querySelector?.('#movie_player, .html5-video-player');
      if (fsPlayer) {
        return fsPlayer;
      }
    }

    const moviePlayer = document.getElementById('movie_player');
    if (moviePlayer) {
      return moviePlayer;
    }

    const genericPlayers = Array.from(document.querySelectorAll('.html5-video-player'));
    return genericPlayers.find((el) => el.id !== 'shorts-player') || genericPlayers[0] || null;
  }

  /**
   * Safely invoke a method on the player without throwing on internal changes.
   */
  function safeCall(player, methodName, ...args) {
    try {
      if (player && typeof player[methodName] === 'function') {
        return player[methodName](...args);
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  function formatQualityLabel(qualityKey, rawLabel) {
    if (qualityKey === 'auto' || qualityKey === 'default') {
      return 'Auto';
    }
    const baseLabel = QUALITY_LABELS[qualityKey] || rawLabel || qualityKey;
    if (typeof rawLabel === 'string' && rawLabel.trim().length > 0) {
      const cleaned = rawLabel.trim();
      if (qualityKey === 'hd2160' && !cleaned.includes('4K')) {
        return `${cleaned} (4K)`;
      }
      if (qualityKey === 'highres' && !cleaned.includes('8K')) {
        return `${cleaned} (8K)`;
      }
      return cleaned;
    }
    return baseLabel;
  }

  function getPlayerVideoId(player) {
    const data = safeCall(player, 'getVideoData');
    return data && typeof data.video_id === 'string' ? data.video_id : null;
  }

  function getTrackedAutoPreference(player, videoId) {
    const record = autoPreferenceByPlayer.get(player);
    if (!record || record.videoId !== videoId) {
      const fresh = { videoId, isAuto: true };
      autoPreferenceByPlayer.set(player, fresh);
      return fresh;
    }
    return record;
  }

  function inferPreferredAutoState(player, autoAvailable) {
    const preferred = safeCall(player, 'getPreferredQuality');
    if (preferred === 'auto' || preferred === 'default') {
      return true;
    }
    if (typeof preferred === 'string' && preferred.length > 0) {
      return false;
    }
    const videoId = getPlayerVideoId(player);
    const tracked = getTrackedAutoPreference(player, videoId);
    return autoAvailable ? tracked.isAuto : false;
  }

  /**
   * Extract normalized playback qualities, active resolution, Auto support,
   * and exposed playback speeds from `#movie_player` or `#shorts-player`.
   */
  function extractPlayerState(player) {
    if (!player) {
      return {
        available: false,
        isLoading: true,
        options: [],
        autoAvailable: false,
        currentQuality: null,
        currentLabel: 'Auto',
        isAuto: false,
        preferredRates: [],
        currentRate: null,
        videoId: null,
        playerState: -1
      };
    }

    const rawLevels = safeCall(player, 'getAvailableQualityLevels');
    const rawData = safeCall(player, 'getAvailableQualityData');
    const levelsList = Array.isArray(rawLevels) ? rawLevels : [];
    const dataList = Array.isArray(rawData) ? rawData : [];

    const dataByQuality = new Map();
    let dataIncludesAuto = false;

    for (const item of dataList) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const q = item.quality;
      if (q === 'auto' || q === 'default') {
        if (item.isPlayable !== false) {
          dataIncludesAuto = true;
        }
        continue;
      }
      if (item.isPlayable === false) {
        continue;
      }
      if (typeof q === 'string' && q.length > 0 && !dataByQuality.has(q)) {
        dataByQuality.set(q, item);
      }
    }

    const autoAvailable =
      levelsList.includes('auto') ||
      levelsList.includes('default') ||
      dataIncludesAuto;

    // Collect only truly available concrete quality keys.
    const concreteSet = new Set();
    for (const q of levelsList) {
      if (typeof q === 'string' && q !== 'auto' && q !== 'default') {
        const meta = dataByQuality.get(q);
        if (meta || dataList.length === 0) {
          concreteSet.add(q);
        }
      }
    }
    for (const [q] of dataByQuality.entries()) {
      concreteSet.add(q);
    }

    const sortedConcrete = Array.from(concreteSet).sort((a, b) => {
      const idxA = QUALITY_ORDER.indexOf(a);
      const idxB = QUALITY_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    const options = sortedConcrete.map((quality) => {
      const meta = dataByQuality.get(quality);
      return {
        quality,
        label: formatQualityLabel(quality, meta?.qualityLabel),
        isAutoOption: false
      };
    });

    if (autoAvailable && options.length > 0) {
      options.push({
        quality: 'auto',
        label: 'Auto',
        isAutoOption: true
      });
    }

    const rawCurrent = safeCall(player, 'getPlaybackQuality');
    const currentQuality =
      typeof rawCurrent === 'string' && rawCurrent !== 'unknown' ? rawCurrent : null;
    const rawCurrentLabel = safeCall(player, 'getPlaybackQualityLabel');
    const isAuto = inferPreferredAutoState(player, autoAvailable);

    const concreteMeta = currentQuality ? dataByQuality.get(currentQuality) : null;
    const resolvedCurrentLabel = currentQuality
      ? formatQualityLabel(currentQuality, rawCurrentLabel || concreteMeta?.qualityLabel)
      : null;

    const preferredRatesRaw = safeCall(player, 'getAvailablePlaybackRates');
    const preferredRates = Array.isArray(preferredRatesRaw)
      ? preferredRatesRaw
          .map((r) => Number(r))
          .filter((r) => Number.isFinite(r) && r >= 0.1 && r <= 16)
      : [];

    const currentRateRaw = safeCall(player, 'getPlaybackRate');
    const currentRate =
      typeof currentRateRaw === 'number' && Number.isFinite(currentRateRaw)
        ? currentRateRaw
        : null;

    const playerState = safeCall(player, 'getPlayerState');
    const videoId = getPlayerVideoId(player);
    const isLoading = options.length === 0 || currentQuality === null;

    return {
      available: options.length > 0,
      isLoading,
      options,
      autoAvailable,
      currentQuality,
      currentLabel: resolvedCurrentLabel || (isAuto ? 'Auto' : 'Auto'),
      isAuto: autoAvailable && isAuto,
      preferredRates,
      currentRate,
      videoId,
      playerState: typeof playerState === 'number' ? playerState : -1
    };
  }

  function broadcastEvent(type, payload) {
    window.postMessage(
      {
        channel: BRIDGE_CHANNEL,
        source: SOURCE_MAIN,
        type,
        payload
      },
      window.location.origin
    );
  }

  function attachPlayerListeners(player) {
    if (!player || watchedPlayers.has(player) || typeof player.addEventListener !== 'function') {
      return;
    }
    watchedPlayers.add(player);

    const emitUpdate = () => {
      const state = extractPlayerState(player);
      broadcastEvent('YQC_EVENT_PLAYER_STATE', state);
    };

    try {
      player.addEventListener('onPlaybackQualityChange', () => {
        emitUpdate();
      });
    } catch {
      // Ignore if player restricts custom listener registration.
    }

    try {
      player.addEventListener('onStateChange', (playerState) => {
        if (playerState === 1 || playerState === 3 || playerState === 5) {
          emitUpdate();
        }
      });
    } catch {
      // Ignore if unavailable.
    }

    try {
      player.addEventListener('onPlaybackRateChange', (rate) => {
        broadcastEvent('YQC_EVENT_RATE_CHANGE', { rate: Number(rate) });
      });
    } catch {
      // Ignore if unavailable.
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Invoke quality change on YouTube player and verify whether the switch
   * actually took effect rather than assuming success blindly.
   */
  async function applyQuality(mode, requestedQuality, verifyTimeoutMs = 1500) {
    const player = resolvePlayer(mode);
    if (!player) {
      return {
        applied: false,
        reason: 'Player not ready',
        state: extractPlayerState(null)
      };
    }

    attachPlayerListeners(player);
    const beforeState = extractPlayerState(player);
    const validTarget =
      requestedQuality === 'auto'
        ? beforeState.autoAvailable
        : beforeState.options.some((opt) => opt.quality === requestedQuality);

    if (!validTarget) {
      return {
        applied: false,
        reason: 'Requested resolution is unavailable for this video',
        state: beforeState
      };
    }

    const canSetRange = typeof player.setPlaybackQualityRange === 'function';
    const canSetSingle = typeof player.setPlaybackQuality === 'function';
    if (!canSetRange && !canSetSingle) {
      return {
        applied: false,
        reason: 'Quality switching API unavailable on this player',
        state: beforeState
      };
    }

    const videoId = getPlayerVideoId(player);
    const tracked = getTrackedAutoPreference(player, videoId);
    let sawEventQuality = null;
    let sawRateOrQualityEvent = false;

    const tempListener = (newQuality) => {
      sawRateOrQualityEvent = true;
      sawEventQuality = typeof newQuality === 'string' ? newQuality : null;
    };

    try {
      player.addEventListener?.('onPlaybackQualityChange', tempListener);
    } catch {
      // Optional listener.
    }

    try {
      let setterResult;
      if (requestedQuality === 'auto') {
        const autoToken = beforeState.options.some((o) => o.quality === 'default')
          ? 'default'
          : 'auto';
        if (canSetRange) {
          setterResult = player.setPlaybackQualityRange(autoToken);
        }
        if (canSetSingle) {
          const singleRes = player.setPlaybackQuality(autoToken);
          if (setterResult === undefined) setterResult = singleRes;
        }
      } else {
        if (canSetRange) {
          setterResult = player.setPlaybackQualityRange(requestedQuality, requestedQuality);
        }
        if (canSetSingle) {
          const singleRes = player.setPlaybackQuality(requestedQuality);
          if (setterResult === undefined) setterResult = singleRes;
        }
      }

      if (setterResult === false) {
        return {
          applied: false,
          reason: 'Player rejected quality request',
          state: extractPlayerState(player)
        };
      }
    } catch (error) {
      return {
        applied: false,
        reason: error?.message || 'Failed while invoking YouTube quality setter',
        state: extractPlayerState(player)
      };
    }

    const timeout = Math.max(150, Math.min(3000, Number(verifyTimeoutMs) || 1500));
    const started = Date.now();
    let confirmed = false;

    while (Date.now() - started <= timeout) {
      const currentQuality = safeCall(player, 'getPlaybackQuality');
      const preferredQuality = safeCall(player, 'getPreferredQuality');

      if (requestedQuality === 'auto') {
        if (preferredQuality !== undefined) {
          if (preferredQuality === 'auto' || preferredQuality === 'default') {
            confirmed = true;
            break;
          }
          // If player exposes getPreferredQuality and kept a fixed non-auto value, stop waiting once settled.
          if (Date.now() - started >= 200) {
            break;
          }
        } else if (sawEventQuality === 'auto' || sawEventQuality === 'default') {
          confirmed = true;
          break;
        } else if (Date.now() - started >= 200) {
          // Player lacks explicit getPreferredQuality; Auto setter did not throw or return false.
          confirmed = true;
          break;
        }
      } else {
        if (
          currentQuality === requestedQuality ||
          preferredQuality === requestedQuality ||
          sawEventQuality === requestedQuality
        ) {
          confirmed = true;
          break;
        }
        // If player actively emitted a DIFFERENT quality than requested after settling, stop waiting.
        if (
          sawRateOrQualityEvent &&
          sawEventQuality &&
          sawEventQuality !== requestedQuality &&
          Date.now() - started >= 150
        ) {
          break;
        }
      }

      await sleep(80);
    }

    try {
      player.removeEventListener?.('onPlaybackQualityChange', tempListener);
    } catch {
      // Some YouTube player mocks only provide addEventListener.
    }

    if (confirmed) {
      tracked.isAuto = requestedQuality === 'auto';
    }

    const afterState = extractPlayerState(player);
    return {
      applied: confirmed,
      reason: confirmed
        ? null
        : `YouTube kept ${afterState.currentLabel || 'previous quality'} instead of switching`,
      state: afterState
    };
  }

  function applyRateOnPlayer(mode, rate) {
    const player = resolvePlayer(mode);
    if (!player || typeof player.setPlaybackRate !== 'function') {
      return { applied: false };
    }
    try {
      player.setPlaybackRate(Number(rate));
      return { applied: true, rate: safeCall(player, 'getPlaybackRate') };
    } catch {
      return { applied: false };
    }
  }

  function reply(requestId, type, payload = null, error = null) {
    window.postMessage(
      {
        channel: BRIDGE_CHANNEL,
        source: SOURCE_MAIN,
        requestId,
        type,
        payload,
        error
      },
      window.location.origin
    );
  }

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }
    const msg = event.data;
    if (!msg || msg.channel !== BRIDGE_CHANNEL || msg.source !== SOURCE_ISOLATED) {
      return;
    }

    const { requestId, type, payload } = msg;
    const mode = payload?.mode || 'auto';

    switch (type) {
      case 'YQC_REQ_PING': {
        const player = resolvePlayer(mode);
        if (player) attachPlayerListeners(player);
        reply(requestId, 'YQC_RESP_PING', { ready: Boolean(player) });
        break;
      }
      case 'YQC_REQ_GET_STATE': {
        const player = resolvePlayer(mode);
        if (player) attachPlayerListeners(player);
        reply(requestId, 'YQC_RESP_GET_STATE', extractPlayerState(player));
        break;
      }
      case 'YQC_REQ_SET_QUALITY': {
        const result = await applyQuality(mode, payload?.quality, payload?.verifyTimeoutMs);
        reply(requestId, 'YQC_RESP_SET_QUALITY', result);
        break;
      }
      case 'YQC_REQ_SET_RATE': {
        const result = applyRateOnPlayer(mode, payload?.rate);
        reply(requestId, 'YQC_RESP_SET_RATE', result);
        break;
      }
      default:
        break;
    }
  });

  // Expose lightweight hooks for automated test inspection without polling overhead.
  globalThis.__YQC_MAIN_BRIDGE__ = {
    resolvePlayer,
    extractPlayerState,
    applyQuality
  };
})();
