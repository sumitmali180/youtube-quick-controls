/**
 * YouTube Quick Controls — Settings Popup Controller
 *
 * Persists user preferences cleanly in chrome.storage.sync with automatic
 * fallback to chrome.storage.local when sync storage is unavailable.
 */

const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  defaultSpeed: 1.0,
  defaultQuality: 'auto',
  autoApply: true
});

const PRESET_SPEEDS = new Set([0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3]);

const els = {
  enabled: document.getElementById('setting-enabled'),
  autoApply: document.getElementById('setting-auto-apply'),
  defaultSpeed: document.getElementById('setting-default-speed'),
  customSpeedWrap: document.getElementById('custom-speed-wrap'),
  customSpeedInput: document.getElementById('setting-custom-speed'),
  applyCustomSpeedBtn: document.getElementById('apply-custom-speed'),
  defaultQuality: document.getElementById('setting-default-quality'),
  resetBtn: document.getElementById('reset-defaults'),
  statusBanner: document.getElementById('status-banner'),
  statusIcon: document.querySelector('#status-banner .status-icon'),
  statusText: document.querySelector('#status-banner .status-text')
};

function sanitizeSpeed(rawValue) {
  const num = Number(rawValue);
  if (!Number.isFinite(num) || num < 0.1 || num > 16.0) {
    return null;
  }
  return Math.round(num * 100) / 100;
}

function setStatus(icon, text, tone = 'ok') {
  els.statusIcon.textContent = icon;
  els.statusText.textContent = text;
  els.statusBanner.dataset.tone = tone;
}

async function readSettings() {
  try {
    const syncData = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    return { settings: { ...DEFAULT_SETTINGS, ...syncData }, area: 'sync' };
  } catch {
    const localData = await chrome.storage.local.get(DEFAULT_SETTINGS);
    return { settings: { ...DEFAULT_SETTINGS, ...localData }, area: 'local' };
  }
}

async function savePartialSettings(partial) {
  const { settings: current } = await readSettings();
  const next = { ...current, ...partial };
  try {
    await chrome.storage.sync.set(next);
    try {
      await chrome.storage.local.set(next);
    } catch {
      // Ignore secondary mirror write failure.
    }
    return { settings: next, area: 'sync' };
  } catch {
    await chrome.storage.local.set(next);
    return { settings: next, area: 'local' };
  }
}

function renderSettings(settings) {
  els.enabled.checked = Boolean(settings.enabled);
  els.autoApply.checked = Boolean(settings.autoApply);
  els.defaultQuality.value = settings.defaultQuality || DEFAULT_SETTINGS.defaultQuality;

  const speed = sanitizeSpeed(settings.defaultSpeed) ?? DEFAULT_SETTINGS.defaultSpeed;
  if (PRESET_SPEEDS.has(speed)) {
    els.defaultSpeed.value = String(speed);
    els.customSpeedWrap.hidden = true;
  } else {
    els.defaultSpeed.value = 'custom';
    els.customSpeedInput.value = String(speed);
    els.customSpeedWrap.hidden = false;
  }
}

async function persistChange(partial) {
  try {
    const { area } = await savePartialSettings(partial);
    if (area === 'sync') {
      setStatus('✓', 'Settings saved', 'ok');
    } else {
      setStatus('⚠', 'Saved locally (sync unavailable)', 'warn');
    }
  } catch {
    setStatus('✕', 'Could not save settings', 'warn');
  }
}

async function commitCustomSpeed() {
  const speed = sanitizeSpeed(els.customSpeedInput.value);
  if (speed === null) {
    setStatus('⚠', 'Enter speed between 0.1x and 16.0x', 'warn');
    els.customSpeedInput.focus();
    return;
  }
  els.customSpeedInput.value = String(speed);
  await persistChange({ defaultSpeed: speed });
}

function bindEvents() {
  els.enabled.addEventListener('change', () => {
    void persistChange({ enabled: els.enabled.checked });
  });

  els.autoApply.addEventListener('change', () => {
    void persistChange({ autoApply: els.autoApply.checked });
  });

  els.defaultSpeed.addEventListener('change', () => {
    const value = els.defaultSpeed.value;
    if (value === 'custom') {
      els.customSpeedWrap.hidden = false;
      els.customSpeedInput.focus();
      els.customSpeedInput.select();
      return;
    }
    els.customSpeedWrap.hidden = true;
    const speed = sanitizeSpeed(value) ?? DEFAULT_SETTINGS.defaultSpeed;
    void persistChange({ defaultSpeed: speed });
  });

  els.applyCustomSpeedBtn.addEventListener('click', () => {
    void commitCustomSpeed();
  });

  els.customSpeedInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void commitCustomSpeed();
    }
  });

  els.defaultQuality.addEventListener('change', () => {
    void persistChange({ defaultQuality: els.defaultQuality.value });
  });

  els.resetBtn.addEventListener('click', async () => {
    renderSettings(DEFAULT_SETTINGS);
    await persistChange(DEFAULT_SETTINGS);
    setStatus('✓', 'Reset to defaults', 'ok');
  });

  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((_changes, areaName) => {
      if (areaName === 'sync' || areaName === 'local') {
        void (async () => {
          const { settings } = await readSettings();
          renderSettings(settings);
        })();
      }
    });
  }
}

async function initPopup() {
  try {
    const { settings, area } = await readSettings();
    renderSettings(settings);
    bindEvents();
    setStatus(area === 'sync' ? '✓' : '⚠', area === 'sync' ? 'Synced' : 'Local storage mode', area === 'sync' ? 'ok' : 'warn');
  } catch {
    renderSettings(DEFAULT_SETTINGS);
    bindEvents();
    setStatus('⚠', 'Using default settings', 'warn');
  }
}

void initPopup();
