import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const EXT_DIR = path.join(ROOT_DIR, 'youtube-quick-controls');

function readExtFile(relPath) {
  return fs.readFileSync(path.join(EXT_DIR, relPath), 'utf8');
}

function readPngDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  const sig = buf.subarray(0, 8);
  assert.deepEqual(
    sig,
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    `${filePath} must have valid PNG magic bytes`
  );
  assert.equal(buf.toString('ascii', 12, 16), 'IHDR', `${filePath} must start with IHDR chunk`);
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20)
  };
}

test('MV3 manifest declares minimal permissions, scoped YouTube content scripts, and valid PNG icons', () => {
  const manifest = JSON.parse(readExtFile('manifest.json'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, 'YouTube Quick Controls');
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.equal(manifest.host_permissions, undefined, 'Should avoid redundant broad host_permissions');

  assert.equal(manifest.action?.default_popup, 'popup.html');
  assert.equal(manifest.background?.service_worker, 'background.js');

  assert.equal(Array.isArray(manifest.content_scripts), true);
  assert.equal(manifest.content_scripts.length, 2);

  const mainScript = manifest.content_scripts.find((c) => c.world === 'MAIN');
  const isolatedScript = manifest.content_scripts.find((c) => c.world === 'ISOLATED');
  assert.ok(mainScript, 'Expected MAIN world content script');
  assert.ok(isolatedScript, 'Expected ISOLATED world content script');
  assert.deepEqual(mainScript.matches, ['https://www.youtube.com/*']);
  assert.deepEqual(mainScript.js, ['page-bridge.js']);
  assert.deepEqual(isolatedScript.matches, ['https://www.youtube.com/*']);
  assert.deepEqual(isolatedScript.js, ['content.js']);
  assert.deepEqual(isolatedScript.css, ['styles.css']);

  for (const expectedSize of [16, 48, 128]) {
    const iconRel = manifest.icons[String(expectedSize)];
    const actionIconRel = manifest.action.default_icon[String(expectedSize)];
    assert.ok(iconRel, `Missing icon for ${expectedSize}`);
    assert.equal(iconRel, actionIconRel);
    const dims = readPngDimensions(path.join(EXT_DIR, iconRel));
    assert.deepEqual(dims, { width: expectedSize, height: expectedSize });
  }
});

test('Static MV3 security, CSP, and Modern Web Guidance CSS invariants hold', () => {
  const popupHtml = readExtFile('popup.html');
  assert.equal(/\son[a-z]+\s*=/i.test(popupHtml), false, 'popup.html must have zero inline event handlers');
  assert.equal(/<script(?![^>]*src=)/i.test(popupHtml), false, 'popup.html must have zero inline script blocks');

  for (const file of ['background.js', 'popup.js', 'page-bridge.js', 'content.js']) {
    const src = readExtFile(file);
    assert.equal(/\beval\s*\(/.test(src), false, `${file} must never use eval()`);
    assert.equal(/new Function\s*\(/.test(src), false, `${file} must never use new Function()`);
    assert.equal(/\.then\s*\(/.test(src), false, `${file} should avoid .then() chains`);
    assert.equal(/TODO|FIXME/.test(src), false, `${file} must contain zero TODO/FIXME markers`);
    assert.equal(/webRequest|declarativeNetRequest|fetch\s*=|XMLHttpRequest\.prototype/i.test(src), false, `${file} must never intercept network requests`);
  }

  const stylesCss = readExtFile('styles.css');
  assert.equal(
    /@supports \(position-area: block-end span-inline-end\)[\s\S]*inset: auto;/.test(stylesCss),
    true,
    'inset: auto must be gated inside @supports (position-area: ...)'
  );
  const unconditionalBlock = stylesCss.split('@supports (position-area:')[0];
  assert.equal(/\binset:\s*auto\b/.test(unconditionalBlock), false, 'inset: auto must not appear unconditionally on [popover]');

  const popupCss = readExtFile('popup.css');
  assert.match(popupCss, /color-scheme:\s*light dark/);
  assert.match(popupCss, /accent-color:/);
  assert.match(popupCss, /@media \(prefers-color-scheme: dark\)/);
  assert.match(popupCss, /:focus-visible/);
});

test('background.js registers synchronous listeners, seeds missing defaults, and falls back to local storage', async () => {
  const code = readExtFile('background.js');
  const installedListeners = [];
  const messageListeners = [];

  const syncStore = { enabled: false };
  const localStore = {};
  let failSync = false;

  const sandbox = {
    chrome: {
      runtime: {
        onInstalled: { addListener: (fn) => installedListeners.push(fn) },
        onMessage: { addListener: (fn) => messageListeners.push(fn) }
      },
      storage: {
        sync: {
          async get(keys) {
            if (failSync) throw new Error('Sync disabled');
            if (keys === null) return { ...syncStore };
            const res = {};
            for (const [k, defVal] of Object.entries(keys)) {
              res[k] = syncStore[k] !== undefined ? syncStore[k] : defVal;
            }
            return res;
          },
          async set(obj) {
            if (failSync) throw new Error('Sync quota exceeded');
            Object.assign(syncStore, obj);
          }
        },
        local: {
          async get(keys) {
            if (keys === null) return { ...localStore };
            const res = {};
            for (const [k, defVal] of Object.entries(keys)) {
              res[k] = localStore[k] !== undefined ? localStore[k] : defVal;
            }
            return res;
          },
          async set(obj) {
            Object.assign(localStore, obj);
          }
        }
      }
    }
  };

  vm.runInNewContext(code, sandbox);
  assert.equal(installedListeners.length, 1);
  assert.equal(messageListeners.length, 1);

  installedListeners[0]({ reason: 'install' });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(syncStore.enabled, false, 'Must preserve existing user setting on install/update');
  assert.equal(syncStore.defaultSpeed, 1.0);
  assert.equal(syncStore.defaultQuality, 'auto');
  assert.equal(syncStore.autoApply, true);

  // Test message handler async GET & SAVE + sync failure fallback to local
  failSync = true;
  const saveResp = await new Promise((resolve) => {
    const keepChannelOpen = messageListeners[0](
      { type: 'YQC_SAVE_SETTINGS', payload: { enabled: true, defaultSpeed: 2.25, defaultQuality: 'hd1080' } },
      {},
      resolve
    );
    assert.equal(keepChannelOpen, true);
  });
  assert.equal(saveResp.ok, true);
  assert.equal(saveResp.storageArea, 'local');
  assert.equal(localStore.defaultSpeed, 2.25);
  assert.equal(localStore.defaultQuality, 'hd1080');
});

test('page-bridge.js filters playable qualities, validates origins, and verifies/rejects quality switches cleanly', async () => {
  const code = readExtFile('page-bridge.js');
  const messageHandlers = [];
  const postedMessages = [];
  const playerListeners = new Map();

  let currentPlaybackQuality = 'large';
  let currentPreferredQuality = 'large';
  let allowSwitch = true;

  const fakePlayer = {
    id: 'movie_player',
    matches: (sel) => sel.includes('#movie_player'),
    getVideoData: () => ({ video_id: 'vid_unit_1' }),
    getAvailableQualityLevels: () => ['hd2160', 'hd1080', 'hd720', 'large', 'medium', 'auto'],
    getAvailableQualityData: () => [
      { quality: 'hd2160', qualityLabel: '2160p60', isPlayable: true },
      { quality: 'hd1080', qualityLabel: '1080p', isPlayable: false }, // locked premium bitrate -> must filter out!
      { quality: 'hd720', qualityLabel: '720p60', isPlayable: true },
      { quality: 'large', qualityLabel: '480p', isPlayable: true },
      { quality: 'medium', qualityLabel: '360p', isPlayable: true },
      { quality: 'auto', qualityLabel: 'Auto', isPlayable: true }
    ],
    getPlaybackQuality: () => currentPlaybackQuality,
    getPreferredQuality: () => currentPreferredQuality,
    getAvailablePlaybackRates: () => [0.25, 0.5, 1, 1.15, 1.5, 2],
    getPlaybackRate: () => 1,
    setPlaybackQualityRange: (minQ) => {
      if (!allowSwitch) return;
      if (minQ === 'auto') {
        currentPreferredQuality = 'auto';
        return;
      }
      currentPreferredQuality = minQ;
      currentPlaybackQuality = minQ;
    },
    setPlaybackQuality: () => {},
    addEventListener: (evt, fn) => {
      if (!playerListeners.has(evt)) playerListeners.set(evt, []);
      playerListeners.get(evt).push(fn);
    }
  };

  const sandbox = {
    setTimeout,
    clearTimeout,
    Date,
    location: { pathname: '/watch', origin: 'https://www.youtube.com' },
    document: {
      fullscreenElement: null,
      getElementById: (id) => (id === 'movie_player' ? fakePlayer : null),
      querySelector: () => fakePlayer,
      querySelectorAll: () => [fakePlayer]
    },
    window: null
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext('this.window = this; this.globalThis = this;', ctx);
  ctx.location = sandbox.location;
  ctx.addEventListener = (type, fn) => {
    if (type === 'message') messageHandlers.push(fn);
  };
  ctx.postMessage = (data, targetOrigin) => {
    postedMessages.push({ data, targetOrigin });
  };

  vm.runInContext(code, ctx);
  const winRef = vm.runInContext('window', ctx);

  // Verify foreign origin messages are ignored
  await messageHandlers[0]({
    source: winRef,
    origin: 'https://evil.example',
    data: { channel: 'YQC_BRIDGE', source: 'YQC_ISOLATED', requestId: '1', type: 'YQC_REQ_GET_STATE' }
  });
  assert.equal(postedMessages.length, 0);

  // Verify valid GET_STATE filters out unplayable hd1080 and preserves 2160p60 (4K) + Auto
  await messageHandlers[0]({
    source: winRef,
    origin: 'https://www.youtube.com',
    data: { channel: 'YQC_BRIDGE', source: 'YQC_ISOLATED', requestId: 'req_1', type: 'YQC_REQ_GET_STATE' }
  });
  assert.equal(postedMessages.length, 1);
  const state = postedMessages[0].data.payload;
  assert.equal(state.autoAvailable, true);
  assert.deepEqual(
    Array.from(state.options, (o) => o.quality),
    ['hd2160', 'hd720', 'large', 'medium', 'auto']
  );
  assert.equal(state.options[0].label, '2160p60 (4K)');

  // Verify requesting unavailable hd1080 fails safely
  postedMessages.length = 0;
  await messageHandlers[0]({
    source: winRef,
    origin: 'https://www.youtube.com',
    data: {
      channel: 'YQC_BRIDGE',
      source: 'YQC_ISOLATED',
      requestId: 'req_2',
      type: 'YQC_REQ_SET_QUALITY',
      payload: { quality: 'hd1080', verifyTimeoutMs: 200 }
    }
  });
  assert.equal(postedMessages[0].data.payload.applied, false);

  // Verify valid hd720 succeeds when player honors switch
  postedMessages.length = 0;
  await messageHandlers[0]({
    source: winRef,
    origin: 'https://www.youtube.com',
    data: {
      channel: 'YQC_BRIDGE',
      source: 'YQC_ISOLATED',
      requestId: 'req_3',
      type: 'YQC_REQ_SET_QUALITY',
      payload: { quality: 'hd720', verifyTimeoutMs: 250 }
    }
  });
  assert.equal(postedMessages[0].data.payload.applied, true);
  assert.equal(postedMessages[0].data.payload.state.currentQuality, 'hd720');

  // Verify refusal: player ignores hd2160 and remains on hd720
  allowSwitch = false;
  postedMessages.length = 0;
  await messageHandlers[0]({
    source: winRef,
    origin: 'https://www.youtube.com',
    data: {
      channel: 'YQC_BRIDGE',
      source: 'YQC_ISOLATED',
      requestId: 'req_4',
      type: 'YQC_REQ_SET_QUALITY',
      payload: { quality: 'hd2160', verifyTimeoutMs: 250 }
    }
  });
  assert.equal(postedMessages[0].data.payload.applied, false);
  assert.equal(postedMessages[0].data.payload.state.currentQuality, 'hd720');
});
