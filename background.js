/**
 * YouTube Quick Controls — MV3 Background Service Worker
 *
 * Registers top-level lifecycle and message listeners synchronously so
 * extension wakeup works reliably after service worker suspension.
 */

const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  defaultSpeed: 1.0,
  defaultQuality: 'auto',
  autoApply: true
});

/**
 * Clamp and validate settings object against supported schema bounds.
 * @param {Record<string, unknown>} raw
 * @returns {{ enabled: boolean, defaultSpeed: number, defaultQuality: string, autoApply: boolean }}
 */
function sanitizeSettings(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const enabled = typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_SETTINGS.enabled;
  const autoApply = typeof input.autoApply === 'boolean' ? input.autoApply : DEFAULT_SETTINGS.autoApply;

  const parsedSpeed = Number(input.defaultSpeed);
  const defaultSpeed =
    Number.isFinite(parsedSpeed) && parsedSpeed >= 0.1 && parsedSpeed <= 16.0
      ? Math.round(parsedSpeed * 100) / 100
      : DEFAULT_SETTINGS.defaultSpeed;

  const validQualities = new Set([
    'auto',
    'highres',
    'hd2160',
    'hd1440',
    'hd1080',
    'hd720',
    'large',
    'medium',
    'small',
    'tiny'
  ]);
  const defaultQuality =
    typeof input.defaultQuality === 'string' && validQualities.has(input.defaultQuality)
      ? input.defaultQuality
      : DEFAULT_SETTINGS.defaultQuality;

  return { enabled, defaultSpeed, defaultQuality, autoApply };
}

/**
 * Read current settings from chrome.storage.sync with automatic fallback to local.
 * @returns {Promise<{ settings: ReturnType<typeof sanitizeSettings>, storageArea: 'sync' | 'local' }>}
 */
async function readSettings() {
  try {
    const syncData = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    return { settings: sanitizeSettings(syncData), storageArea: 'sync' };
  } catch {
    const localData = await chrome.storage.local.get(DEFAULT_SETTINGS);
    return { settings: sanitizeSettings(localData), storageArea: 'local' };
  }
}

/**
 * Write settings cleanly to chrome.storage.sync with automatic fallback to local.
 * @param {Record<string, unknown>} partial
 * @returns {Promise<{ settings: ReturnType<typeof sanitizeSettings>, storageArea: 'sync' | 'local' }>}
 */
async function writeSettings(partial) {
  const { settings: existing } = await readSettings();
  const next = sanitizeSettings({ ...existing, ...partial });
  try {
    await chrome.storage.sync.set(next);
    // Keep local mirror updated so isolated fallbacks always stay fresh.
    try {
      await chrome.storage.local.set(next);
    } catch {
      // Ignore secondary mirror write failure.
    }
    return { settings: next, storageArea: 'sync' };
  } catch {
    await chrome.storage.local.set(next);
    return { settings: next, storageArea: 'local' };
  }
}

/**
 * Seed any missing default preference keys without clobbering existing user choices.
 */
async function seedMissingDefaults() {
  try {
    const existingSync = await chrome.storage.sync.get(null);
    const missing = {};
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      if (existingSync[key] === undefined) {
        missing[key] = value;
      }
    }
    if (Object.keys(missing).length > 0) {
      await chrome.storage.sync.set(missing);
    }
  } catch {
    try {
      const existingLocal = await chrome.storage.local.get(null);
      const missing = {};
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        if (existingLocal[key] === undefined) {
          missing[key] = value;
        }
      }
      if (Object.keys(missing).length > 0) {
        await chrome.storage.local.set(missing);
      }
    } catch {
      // Storage temporarily unavailable; content script / popup handle defaults safely.
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void seedMissingDefaults();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') {
    return false;
  }

  if (message.type === 'YQC_GET_SETTINGS') {
    (async () => {
      try {
        const result = await readSettings();
        sendResponse({ ok: true, ...result });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || 'Failed to load settings' });
      }
    })();
    return true;
  }

  if (message.type === 'YQC_SAVE_SETTINGS') {
    (async () => {
      try {
        const result = await writeSettings(message.payload || {});
        sendResponse({ ok: true, ...result });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || 'Failed to save settings' });
      }
    })();
    return true;
  }

  if (message.type === 'YQC_RESET_SETTINGS') {
    (async () => {
      try {
        const result = await writeSettings(DEFAULT_SETTINGS);
        sendResponse({ ok: true, ...result });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || 'Failed to reset settings' });
      }
    })();
    return true;
  }

  return false;
});
