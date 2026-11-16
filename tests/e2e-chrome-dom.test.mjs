import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const EXT_DIR = path.join(ROOT_DIR, 'youtube-quick-controls');
const CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BRAVE_BIN = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';

function readExt(file) {
  return fs.readFileSync(path.join(EXT_DIR, file), 'utf8');
}

function buildYoutubeHarnessHtml() {
  const stylesCss = readExt('styles.css');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>YouTube Mock Harness</title>
  <style>
    :root {
      --yt-spec-badge-chip-background: rgba(0, 0, 0, 0.05);
      --yt-spec-button-chip-background-hover: rgba(0, 0, 0, 0.1);
      --yt-spec-text-primary: #0f0f0f;
      --yt-spec-text-secondary: #606060;
      --yt-spec-10-percent-layer: rgba(0, 0, 0, 0.1);
      --yt-spec-menu-background: #ffffff;
    }
    html[dark] {
      --yt-spec-badge-chip-background: rgba(255, 255, 255, 0.1);
      --yt-spec-button-chip-background-hover: rgba(255, 255, 255, 0.2);
      --yt-spec-text-primary: #f1f1f1;
      --yt-spec-text-secondary: #aaaaaa;
      --yt-spec-10-percent-layer: rgba(255, 255, 255, 0.14);
      --yt-spec-menu-background: #282828;
      background: #0f0f0f;
      color: #f1f1f1;
    }
    body { margin: 0; font-family: Roboto, sans-serif; padding: 16px; }
    ytd-app { display: block; max-width: 1100px; margin: 0 auto; }
    #movie_player {
      position: relative;
      width: 800px;
      height: 450px;
      background: #000;
      overflow: hidden;
    }
    #movie_player:fullscreen {
      width: 100vw;
      height: 100vh;
    }
    video { width: 100%; height: 100%; display: block; background: #111; }
    .ytp-chrome-bottom {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 52px;
      background: rgba(0, 0, 0, 0.65);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      overflow: hidden;
      color: #fff;
    }
    .ytp-fullscreen-quick-actions {
      position: absolute;
      right: 16px;
      bottom: 64px;
      display: none;
      gap: 8px;
      align-items: center;
      overflow: hidden;
    }
    #movie_player:fullscreen .ytp-fullscreen-quick-actions {
      display: flex;
    }
    .ytp-fullscreen-quick-actions button,
    ytd-watch-metadata button {
      min-height: 36px;
      padding: 0 14px;
      border-radius: 18px;
      border: 1px solid rgba(128,128,128,0.25);
      background: var(--yt-spec-badge-chip-background);
      color: var(--yt-spec-text-primary);
      cursor: pointer;
    }
    #movie_player:fullscreen .ytp-fullscreen-quick-actions button {
      background: rgba(255,255,255,0.14);
      color: #fff;
    }
    ytd-watch-metadata { display: block; padding-top: 14px; }
    #top-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
    }
    #actions { display: flex; }
    #actions-inner { display: flex; }
    ytd-menu-renderer { display: block; }
    #top-level-buttons-computed {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #shorts-stage { display: none; gap: 24px; }
    ytd-reel-video-renderer { display: flex; align-items: flex-end; gap: 16px; margin-bottom: 16px; }
    #shorts-player, .shorts-player-box { width: 320px; height: 520px; background: #111; }
    #shorts-stage #actions { display: flex; flex-direction: column; gap: 8px; align-items: center; }
    #fs-gesture-trigger { position: fixed; top: 8px; right: 8px; z-index: 1000; }
  </style>
  <style>${stylesCss}</style>
</head>
<body>
  <button id="fs-gesture-trigger" type="button">Enter FS</button>
  <ytd-app>
    <div id="watch-stage">
      <div id="movie_player" class="html5-video-player">
        <video class="html5-main-video"></video>
        <div class="ytp-fullscreen-quick-actions">
          <div class="ytp-overlay-bottom-right" style="display:flex;gap:8px;align-items:center;">
            <button-view-model><button type="button" aria-label="like this video">👍 Like</button></button-view-model>
            <button-view-model><button type="button" aria-label="Dislike this video">👎</button></button-view-model>
            <button-view-model><button type="button" aria-label="Share">Share</button></button-view-model>
          </div>
        </div>
        <div class="ytp-chrome-bottom">
          <div class="ytp-left-controls"><button type="button">Play</button></div>
          <div class="ytp-right-controls"><button type="button">Settings</button><button type="button">Fullscreen</button></div>
        </div>
      </div>

      <ytd-watch-metadata>
        <div id="above-the-fold">
          <div id="top-row">
            <div id="owner"><strong>Creator Channel</strong></div>
            <div id="actions">
              <div id="actions-inner">
                <ytd-menu-renderer>
                  <div id="top-level-buttons-computed">
                    <segmented-like-dislike-button-view-model>
                      <like-button-view-model><button id="watch-like-btn" type="button" aria-label="like this video along with 100 other people">👍 100</button></like-button-view-model>
                      <dislike-button-view-model><button type="button" aria-label="Dislike this video">👎</button></dislike-button-view-model>
                    </segmented-like-dislike-button-view-model>
                    <button type="button">Share</button>
                    <button type="button">Download</button>
                    <button type="button">Clip</button>
                  </div>
                </ytd-menu-renderer>
              </div>
            </div>
          </div>
        </div>
      </ytd-watch-metadata>
    </div>

    <div id="shorts-stage">
      <ytd-shorts>
        <ytd-reel-video-renderer id="reel-1" is-active>
          <div id="shorts-player" class="html5-video-player"><video class="shorts-vid-1"></video></div>
          <ytd-reel-player-overlay-renderer>
            <div id="actions">
              <div id="like-button"><button type="button" aria-label="like this video">👍 1K</button></div>
              <div id="dislike-button"><button type="button" aria-label="Dislike this video">👎</button></div>
            </div>
          </ytd-reel-player-overlay-renderer>
        </ytd-reel-video-renderer>
        <ytd-reel-video-renderer id="reel-2">
          <div class="html5-video-player"><video class="shorts-vid-2"></video></div>
          <ytd-reel-player-overlay-renderer>
            <div id="actions">
              <div id="like-button"><button type="button" aria-label="like this video">👍 2K</button></div>
              <div id="dislike-button"><button type="button" aria-label="Dislike this video">👎</button></div>
            </div>
          </ytd-reel-player-overlay-renderer>
        </ytd-reel-video-renderer>
      </ytd-shorts>
    </div>
  </ytd-app>

  <script>
    // Track player interactions so tests prove quick controls never trigger playback toggles or global hotkeys.
    window.__TEST_STATE__ = {
      playerClicks: 0,
      globalHotkeys: 0,
      likeClicks: 0,
      videoId: 'vidA',
      levels: ['hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny', 'auto'],
      data: [
        { quality: 'hd2160', qualityLabel: '2160p60', isPlayable: true },
        { quality: 'hd1440', qualityLabel: '1440p60', isPlayable: true },
        { quality: 'hd1080', qualityLabel: '1080p60', isPlayable: true },
        { quality: 'hd720', qualityLabel: '720p', isPlayable: true },
        { quality: 'large', qualityLabel: '480p', isPlayable: true },
        { quality: 'medium', qualityLabel: '360p', isPlayable: true },
        { quality: 'small', qualityLabel: '240p', isPlayable: true },
        { quality: 'tiny', qualityLabel: '144p', isPlayable: true },
        { quality: 'auto', qualityLabel: 'Auto', isPlayable: true }
      ],
      currentQuality: 'hd720',
      preferredQuality: 'auto',
      refuseQuality: false,
      preferredRates: [0.25, 0.5, 0.75, 1, 1.15, 1.25, 1.5, 1.75, 2],
      listeners: {}
    };

    // Mock chrome.storage in isolated-equivalent harness environment
    const syncData = { enabled: true, defaultSpeed: 1.0, defaultQuality: 'auto', autoApply: true };
    const localData = { ...syncData };
    const storageChangedListeners = [];
    window.chrome = {
      storage: {
        sync: {
          async get(defaults) { return { ...defaults, ...syncData }; },
          async set(obj) {
            Object.assign(syncData, obj);
            storageChangedListeners.forEach(fn => fn({}, 'sync'));
          }
        },
        local: {
          async get(defaults) { return { ...defaults, ...localData }; },
          async set(obj) { Object.assign(localData, obj); }
        },
        onChanged: {
          addListener(fn) { storageChangedListeners.push(fn); },
          removeListener(fn) {
            const idx = storageChangedListeners.indexOf(fn);
            if (idx >= 0) storageChangedListeners.splice(idx, 1);
          }
        }
      }
    };

    const mp = document.getElementById('movie_player');
    mp.addEventListener('click', () => { window.__TEST_STATE__.playerClicks += 1; });
    document.getElementById('watch-like-btn').addEventListener('click', () => { window.__TEST_STATE__.likeClicks += 1; });
    document.addEventListener('keydown', (e) => {
      if ([' ', 'ArrowDown', 'ArrowUp', 'k'].includes(e.key)) {
        window.__TEST_STATE__.globalHotkeys += 1;
      }
    });

    // Attach MAIN-world style player methods onto #movie_player and #shorts-player
    function wirePlayerApi(el) {
      el.getVideoData = () => ({ video_id: window.__TEST_STATE__.videoId });
      el.getAvailableQualityLevels = () => [...window.__TEST_STATE__.levels];
      el.getAvailableQualityData = () => [...window.__TEST_STATE__.data];
      el.getPlaybackQuality = () => window.__TEST_STATE__.currentQuality;
      el.getPreferredQuality = () => window.__TEST_STATE__.preferredQuality;
      el.getAvailablePlaybackRates = () => [...window.__TEST_STATE__.preferredRates];
      el.getPlaybackRate = () => document.querySelector('#movie_player video')?.playbackRate || 1;
      el.setPlaybackRate = (r) => {
        const v = el.querySelector('video');
        if (v) v.playbackRate = r;
      };
      el.setPlaybackQualityRange = (q) => {
        if (window.__TEST_STATE__.refuseQuality) return;
        window.__TEST_STATE__.preferredQuality = q;
        if (q !== 'auto') window.__TEST_STATE__.currentQuality = q;
        (window.__TEST_STATE__.listeners.onPlaybackQualityChange || []).forEach(fn => fn(q));
      };
      el.setPlaybackQuality = () => {};
      const origAdd = el.addEventListener.bind(el);
      el.addEventListener = (evt, fn, opts) => {
        if (evt.startsWith('on')) {
          window.__TEST_STATE__.listeners[evt] = window.__TEST_STATE__.listeners[evt] || [];
          window.__TEST_STATE__.listeners[evt].push(fn);
          return;
        }
        origAdd(evt, fn, opts);
      };
    }

    wirePlayerApi(mp);
    wirePlayerApi(document.getElementById('shorts-player'));
    wirePlayerApi(document.querySelector('#reel-2 .html5-video-player'));

    document.getElementById('fs-gesture-trigger').addEventListener('click', async () => {
      try {
        await mp.requestFullscreen();
      } catch (e) {
        window.__FS_ERROR__ = e.message;
      }
    });

    history.replaceState({}, '', '/watch?v=vidA');
  </script>
</body>
</html>`;
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
  }

  send(method, params = {}, sessionId = undefined) {
    this.id += 1;
    const reqId = this.id;
    const payload = { id: reqId, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(reqId, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }

  close() {
    this.ws.close();
  }
}

async function launchBrowser(binPath = CHROME_BIN, extraFlags = []) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yqc-e2e-'));
  const proc = spawn(
    binPath,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1280,900',
      `--user-data-dir=${userDataDir}`,
      '--remote-debugging-port=0',
      ...extraFlags,
      'about:blank'
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  const wsUrl = await new Promise((resolve, reject) => {
    let stderr = '';
    const timer = setTimeout(() => reject(new Error(`Browser start timeout: ${stderr}`)), 12000);
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
  });

  const cdp = new CDPClient(wsUrl);
  await cdp.connect();

  return {
    cdp,
    async dispose() {
      try { cdp.close(); } catch {}
      try { proc.kill('SIGKILL'); } catch {}
      await new Promise((r) => setTimeout(r, 150));
      try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
    }
  };
}

async function launchChrome() {
  return launchBrowser(CHROME_BIN);
}

async function evalInPage(cdp, sessionId, expression) {
  const res = await cdp.send(
    'Runtime.evaluate',
    { expression, awaitPromise: true, returnByValue: true },
    sessionId
  );
  if (res.exceptionDetails) {
    throw new Error(
      `Page eval error: ${res.exceptionDetails.exception?.description || res.exceptionDetails.text}`
    );
  }
  return res.result?.value;
}

test('Real Chrome 156 E2E: Watch placement, Speed/Quality sync + rollback, Fullscreen Top Layer, Shorts, SPA, Themes & Popup', async () => {
  const html = buildYoutubeHarnessHtml();
  const popupHtml = readExt('popup.html');
  const popupCss = readExt('popup.css');
  const popupJs = readExt('popup.js');
  const pageBridgeJs = readExt('page-bridge.js');
  const contentJs = readExt('content.js');

  const server = http.createServer((req, res) => {
    const reqUrl = (req.url || '/').split('?')[0];
    if (reqUrl === '/popup.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(popupHtml);
    } else if (reqUrl === '/popup.css') {
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
      res.end(popupCss);
    } else if (reqUrl === '/popup.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end(popupJs);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    }
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const chrome = await launchChrome();

  try {
    const { targetId } = await chrome.cdp.send('Target.createTarget', { url: `${baseUrl}/watch?v=vidA` });
    const { sessionId } = await chrome.cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await chrome.cdp.send('Page.enable', {}, sessionId);
    await chrome.cdp.send('Runtime.enable', {}, sessionId);

    // Wait for DOM readiness
    await new Promise((r) => setTimeout(r, 250));
    await evalInPage(chrome.cdp, sessionId, pageBridgeJs);
    await evalInPage(chrome.cdp, sessionId, contentJs);
    await new Promise((r) => setTimeout(r, 150));

    // 1. Watch-page placement directly above Like button + two horizontal pill rows + target dimensions >= 24px
    const watchLayout = await evalInPage(chrome.cdp, sessionId, `(() => {
      const hosts = document.querySelectorAll('#yqc-controls-host');
      const host = hosts[0];
      const starBtn = document.getElementById('yqc-star-btn');
      const panel = document.getElementById('yqc-controls-panel');
      const likeBtn = document.getElementById('watch-like-btn');
      const speedRow = document.getElementById('yqc-speed-row');
      const qualityRow = document.getElementById('yqc-quality-row');
      const speedBtns = Array.from(speedRow.querySelectorAll('button.yqc-chip'));
      const qualityBtns = Array.from(qualityRow.querySelectorAll('button.yqc-chip'));
      const activeSpeed = speedBtns.find(b => b.getAttribute('aria-pressed') === 'true');
      const activeQuality = qualityBtns.find(b => b.getAttribute('aria-pressed') === 'true');
      const hRect = host.getBoundingClientRect();
      const sRowRect = speedRow.getBoundingClientRect();
      const qRowRect = qualityRow.getBoundingClientRect();
      const lRect = likeBtn.getBoundingClientRect();
      const sRect = speedBtns[0].getBoundingClientRect();
      const qRect = qualityBtns[0].getBoundingClientRect();
      likeBtn.click();
      return {
        hostCount: hosts.length,
        hasStarBtn: Boolean(starBtn),
        hasPanel: Boolean(panel),
        starExpanded: starBtn?.getAttribute('aria-expanded'),
        mode: host.dataset.yqcMode,
        role: host.getAttribute('role'),
        focusgroup: host.getAttribute('focusgroup'),
        speedGroupRole: speedRow.getAttribute('role'),
        qualityGroupRole: qualityRow.getAttribute('role'),
        hostBottom: Math.round(hRect.bottom),
        likeTop: Math.round(lRect.top),
        speedRowBottom: Math.round(sRowRect.bottom),
        qualityRowTop: Math.round(qRowRect.top),
        hostLeft: Math.round(hRect.left),
        likeLeft: Math.round(lRect.left),
        speedLabels: speedBtns.map(b => b.textContent.trim()),
        qualityLabels: qualityBtns.map(b => b.textContent.trim()),
        activeSpeedLabel: activeSpeed?.textContent.trim(),
        activeQualityLabel: activeQuality?.textContent.trim(),
        activeQualityTitle: activeQuality?.title,
        speedDims: [Math.round(sRect.width), Math.round(sRect.height)],
        qualityDims: [Math.round(qRect.width), Math.round(qRect.height)],
        likeClicks: window.__TEST_STATE__.likeClicks
      };
    })()`);

    assert.equal(watchLayout.hostCount, 1);
    assert.ok(watchLayout.hasStarBtn, 'Host must render star trigger button');
    assert.ok(watchLayout.hasPanel, 'Host must render controls panel');
    assert.equal(watchLayout.starExpanded, 'false');
    assert.equal(watchLayout.mode, 'watch');
    assert.equal(watchLayout.role, 'toolbar');
    assert.equal(watchLayout.focusgroup, 'toolbar wrap');
    assert.equal(watchLayout.speedGroupRole, 'group');
    assert.equal(watchLayout.qualityGroupRole, 'group');
    assert.ok(watchLayout.speedRowBottom <= watchLayout.qualityRowTop + 2, 'Row 1 speed pills must sit directly above Row 2 quality pills');
    assert.ok(watchLayout.hostBottom <= watchLayout.likeTop + 1, `Controls must render ABOVE Like button (${watchLayout.hostBottom} <= ${watchLayout.likeTop})`);
    assert.ok(Math.abs(watchLayout.hostLeft - watchLayout.likeLeft) <= 10, 'Controls must align with Like button left edge');
    assert.ok(watchLayout.speedDims[0] >= 24 && watchLayout.speedDims[1] >= 24);
    assert.ok(watchLayout.qualityDims[0] >= 24 && watchLayout.qualityDims[1] >= 24);
    assert.equal(watchLayout.likeClicks, 1, 'Native Like button click handler must stay intact');
    assert.deepEqual(watchLayout.speedLabels, ['0.25x', '0.5x', '0.75x', '1.0x', '1.15x', '1.25x', '1.5x', '1.75x', '2.0x', '2.5x', '3.0x']);
    assert.deepEqual(watchLayout.qualityLabels, ['Auto', '144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p']);
    assert.equal(watchLayout.activeSpeedLabel, '1.0x');
    assert.equal(watchLayout.activeQualityLabel, 'Auto');
    assert.equal(watchLayout.activeQualityTitle, 'Auto (720p)');

    // 2. One-click speed pills, custom YouTube-exposed rate, external ratechange sync, keyboard navigation & propagation isolation
    const speedRes = await evalInPage(chrome.cdp, sessionId, `(async () => {
      const video = document.querySelector('#movie_player video');
      const host = document.getElementById('yqc-controls-host');
      const starBtn = document.getElementById('yqc-star-btn');
      const speedRow = document.getElementById('yqc-speed-row');
      const rates = Array.from(speedRow.querySelectorAll('button.yqc-chip')).map(b => Number(b.dataset.yqcRate));

      // Star hover-reveal & pin toggle
      starBtn.dispatchEvent(new MouseEvent('pointerenter', { bubbles: true }));
      const afterStarEnter = {
        revealed: host.dataset.yqcRevealed === 'true',
        starExpanded: starBtn.getAttribute('aria-expanded')
      };
      starBtn.click();
      const afterStarClick = {
        pinned: host.dataset.yqcPinned === 'true',
        starExpanded: starBtn.getAttribute('aria-expanded')
      };
      starBtn.click();
      const afterStarUnclick = {
        pinned: host.dataset.yqcPinned === 'true'
      };

      // One click directly on 2.5x pill (no dropdown)
      speedRow.querySelector('[data-yqc-rate="2.5"]').click();
      const after25 = {
        rate: video.playbackRate,
        pressed: speedRow.querySelector('[data-yqc-rate="2.5"]').getAttribute('aria-pressed'),
        pressedCount: speedRow.querySelectorAll('[aria-pressed="true"]').length
      };

      // Custom YouTube exposed rate (1.15)
      speedRow.querySelector('[data-yqc-rate="1.15"]').click();
      const afterCustomYt = {
        rate: video.playbackRate,
        pressed: speedRow.querySelector('[data-yqc-rate="1.15"]').getAttribute('aria-pressed')
      };

      // External ratechange with custom non-standard speed (1.4) + 1.75 preset
      video.playbackRate = 1.4;
      video.dispatchEvent(new Event('ratechange'));
      await new Promise(r => setTimeout(r, 60));
      const dynamicCustomBtn = speedRow.querySelector('[data-yqc-rate="1.4"]');
      const afterExternalCustom = {
        exists: Boolean(dynamicCustomBtn),
        label: dynamicCustomBtn?.textContent.trim(),
        pressed: dynamicCustomBtn?.getAttribute('aria-pressed')
      };

      video.playbackRate = 1.75;
      video.dispatchEvent(new Event('ratechange'));
      await new Promise(r => setTimeout(r, 80));
      const afterExternalPreset = speedRow.querySelector('[aria-pressed="true"]')?.textContent.trim();

      // Toolbar keyboard navigation fallback when focusGroup isn't native
      const startBtn = speedRow.querySelector('[data-yqc-rate="1"]');
      startBtn.focus();
      startBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      const afterArrowRightRate = document.activeElement?.dataset?.yqcRate || null;
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      const afterArrowDownInQuality = Boolean(document.getElementById('yqc-quality-row')?.contains(document.activeElement));

      return {
        rates,
        afterStarEnter,
        afterStarClick,
        afterStarUnclick,
        after25,
        afterCustomYt,
        afterExternalCustom,
        afterExternalPreset,
        afterArrowRightRate,
        afterArrowDownInQuality,
        hasNativeFocusGroup: 'focusGroup' in HTMLElement.prototype,
        playerClicks: window.__TEST_STATE__.playerClicks,
        globalHotkeys: window.__TEST_STATE__.globalHotkeys
      };
    })()`);

    assert.equal(speedRes.afterStarEnter.revealed, true);
    assert.equal(speedRes.afterStarEnter.starExpanded, 'true');
    assert.equal(speedRes.afterStarClick.pinned, true);
    assert.equal(speedRes.afterStarClick.starExpanded, 'true');
    assert.equal(speedRes.afterStarUnclick.pinned, false);
    assert.equal(speedRes.rates.includes(2.5), true);
    assert.equal(speedRes.rates.includes(1.15), true);
    assert.equal(speedRes.after25.rate, 2.5);
    assert.equal(speedRes.after25.pressed, 'true');
    assert.equal(speedRes.after25.pressedCount, 1);
    assert.equal(speedRes.afterCustomYt.rate, 1.15);
    assert.equal(speedRes.afterCustomYt.pressed, 'true');
    assert.equal(speedRes.afterExternalCustom.exists, true);
    assert.equal(speedRes.afterExternalCustom.label, '1.4x');
    assert.equal(speedRes.afterExternalCustom.pressed, 'true');
    assert.equal(speedRes.afterExternalPreset, '1.75x');
    if (!speedRes.hasNativeFocusGroup) {
      assert.equal(speedRes.afterArrowRightRate, '1.15');
      assert.equal(speedRes.afterArrowDownInQuality, true);
    }
    assert.equal(speedRes.playerClicks, 0, 'Clicking controls must not bubble clicks to #movie_player');
    assert.equal(speedRes.globalHotkeys, 0, 'Toolbar keys must not trigger YouTube hotkeys');

    // 3. One-click quality pills, unavailable quality disabled (aria-disabled), loading state & refusal tooltip/rollback
    const qualityRes = await evalInPage(chrome.cdp, sessionId, `(async () => {
      const qualityRow = document.getElementById('yqc-quality-row');
      // One click directly to 1080p
      qualityRow.querySelector('[data-yqc-quality="hd1080"]').click();
      await new Promise(r => setTimeout(r, 200));
      const applied1080 = qualityRow.querySelector('[aria-pressed="true"]')?.dataset?.yqcQuality;
      const autoAfter1080 = qualityRow.querySelector('[data-yqc-quality="auto"]')?.getAttribute('aria-pressed');

      // Simulate player refusing hd2160 while staying on hd1080
      window.__TEST_STATE__.refuseQuality = true;
      qualityRow.querySelector('[data-yqc-quality="hd2160"]').click();
      await new Promise(r => setTimeout(r, 1750));
      const tooltip = document.querySelector('#yqc-controls-host .yqc-tooltip');
      const refusedRes = {
        activeAfterRefusal: qualityRow.querySelector('[aria-pressed="true"]')?.dataset?.yqcQuality,
        refusedPressed: qualityRow.querySelector('[data-yqc-quality="hd2160"]')?.getAttribute('aria-pressed'),
        tooltipVisible: !tooltip.hidden,
        tooltipText: tooltip.innerText.trim()
      };
      window.__TEST_STATE__.refuseQuality = false;

      // Simulate limited video (360p/480p only, no Auto)
      window.__TEST_STATE__.levels = ['large', 'medium'];
      window.__TEST_STATE__.data = [];
      window.__TEST_STATE__.currentQuality = 'large';
      window.__TEST_STATE__.preferredQuality = 'large';
      await window.__YQC_CONTROLLER__.fetchAndUpdateQualityState({ tryApplyDefaults: false });
      const enabledOpts = Array.from(qualityRow.querySelectorAll('button.yqc-chip:not([aria-disabled="true"])')).map(b => b.dataset.yqcQuality);
      const disabledOpts = Array.from(qualityRow.querySelectorAll('button.yqc-chip[aria-disabled="true"]')).map(b => b.dataset.yqcQuality);

      // Clicking disabled option must be ignored
      qualityRow.querySelector('[data-yqc-quality="hd1080"]').click();
      await new Promise(r => setTimeout(r, 50));
      const still480AfterDisabledClick = qualityRow.querySelector('[aria-pressed="true"]')?.dataset?.yqcQuality;

      // Simulate still loading ([]) -> all slots disabled, no active pill
      window.__TEST_STATE__.levels = [];
      window.__TEST_STATE__.currentQuality = 'unknown';
      await window.__YQC_CONTROLLER__.fetchAndUpdateQualityState({ tryApplyDefaults: false });
      const loadingEnabledCount = qualityRow.querySelectorAll('button.yqc-chip:not([aria-disabled="true"])').length;
      const loadingPressedCount = qualityRow.querySelectorAll('button.yqc-chip[aria-pressed="true"]').length;

      return {
        applied1080,
        autoAfter1080,
        refusedRes,
        enabledOpts,
        disabledOpts,
        still480AfterDisabledClick,
        loadingEnabledCount,
        loadingPressedCount
      };
    })()`);

    assert.equal(qualityRes.applied1080, 'hd1080');
    assert.equal(qualityRes.autoAfter1080, 'false');
    assert.equal(qualityRes.refusedRes.activeAfterRefusal, 'hd1080', 'Must keep previous quality active on refusal');
    assert.equal(qualityRes.refusedRes.refusedPressed, 'false');
    assert.equal(qualityRes.refusedRes.tooltipVisible, true, 'Must display subtle error tooltip on refusal');
    assert.match(qualityRes.refusedRes.tooltipText, /⚠/);
    assert.deepEqual(qualityRes.enabledOpts, ['medium', 'large']);
    assert.ok(qualityRes.disabledOpts.includes('auto'));
    assert.ok(qualityRes.disabledOpts.includes('hd1080'));
    assert.equal(qualityRes.still480AfterDisabledClick, 'large');
    assert.equal(qualityRes.loadingEnabledCount, 0);
    assert.equal(qualityRes.loadingPressedCount, 0);

    // Restore full quality options for Fullscreen check
    await evalInPage(chrome.cdp, sessionId, `(async () => {
      window.__TEST_STATE__.levels = ['hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'auto'];
      window.__TEST_STATE__.data = [
        { quality: 'hd2160', qualityLabel: '2160p60', isPlayable: true },
        { quality: 'hd1440', qualityLabel: '1440p', isPlayable: true },
        { quality: 'hd1080', qualityLabel: '1080p', isPlayable: true },
        { quality: 'hd720', qualityLabel: '720p', isPlayable: true },
        { quality: 'large', qualityLabel: '480p', isPlayable: true },
        { quality: 'medium', qualityLabel: '360p', isPlayable: true },
        { quality: 'auto', qualityLabel: 'Auto', isPlayable: true }
      ];
      window.__TEST_STATE__.currentQuality = 'hd1080';
      window.__TEST_STATE__.preferredQuality = 'hd1080';
      await window.__YQC_CONTROLLER__.fetchAndUpdateQualityState({ tryApplyDefaults: false });
    })()`);

    // 4. Fullscreen Top Layer via real user gesture click
    const btnPos = await evalInPage(chrome.cdp, sessionId, `(() => {
      const r = document.getElementById('fs-gesture-trigger').getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    await chrome.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: btnPos.x, y: btnPos.y, button: 'left', clickCount: 1 }, sessionId);
    await chrome.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: btnPos.x, y: btnPos.y, button: 'left', clickCount: 1 }, sessionId);
    await new Promise((r) => setTimeout(r, 350));

    const fsDelhi = await evalInPage(chrome.cdp, sessionId, `(async () => {
      const fsEl = document.fullscreenElement;
      const host = document.getElementById('yqc-controls-host');
      const fsLike = fsEl?.querySelector('.ytp-fullscreen-quick-actions button[aria-label*="like" i]');
      const hRect = host?.getBoundingClientRect();
      const lRect = fsLike?.getBoundingClientRect();
      const fsVideo = fsEl?.querySelector('video');
      host?.querySelector('#yqc-speed-row [data-yqc-rate="2"]')?.click();
      const fsRateAfterClick = fsVideo?.playbackRate;
      host?.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 300));
      const activeHRect = host?.getBoundingClientRect();
      const panelRect = document.getElementById('yqc-controls-panel')?.getBoundingClientRect();
      console.log('DEBUG fsDelhi:', {
        hRect,
        activeHRect,
        panelRect,
        dataset: host ? { ...host.dataset } : null
      });
      fsEl?.classList.add('ytp-autohide');
      const autohideOpacity = host ? getComputedStyle(host).opacity : '';
      return {
        isFullscreen: Boolean(fsEl),
        insideTopLayer: Boolean(fsEl && host && fsEl.contains(host)),
        hostCount: document.querySelectorAll('#yqc-controls-host').length,
        mode: host?.dataset.yqcMode,
        fsPlacement: host?.dataset.yqcFsPlacement,
        hostBottom: Math.round(activeHRect?.bottom || 0),
        fsLikeTop: Math.round(lRect?.top || 0),
        collapsedWidth: Math.round(hRect?.width || 0),
        visibleWidth: Math.round(activeHRect?.width || 0),
        fsRateAfterClick,
        autohideOpacity,
        debug: {
          hRect,
          activeHRect,
          panelRect,
          dataset: host ? { ...host.dataset } : null
        }
      };
    })()`);

    assert.equal(fsDelhi.isFullscreen, true, 'Headless Chrome should enter real Fullscreen Top Layer');
    assert.equal(fsDelhi.insideTopLayer, true, 'Controls must live inside document.fullscreenElement');
    assert.equal(fsDelhi.hostCount, 1);
    assert.equal(fsDelhi.mode, 'fullscreen');
    assert.equal(fsDelhi.fsPlacement, 'above-like');
    assert.ok(fsDelhi.collapsedWidth <= 40, 'Fullscreen controls must collapse to compact star shape when not hovered');
    assert.ok(fsDelhi.visibleWidth > 50, 'Fullscreen controls must expand to full width on hover');
    assert.equal(fsDelhi.fsRateAfterClick, 2, 'Clicking speed chip in fullscreen must immediately change video playbackRate');
    assert.ok(fsDelhi.hostBottom <= fsDelhi.fsLikeTop + 2, `Fullscreen controls must sit directly ABOVE fullscreen Like button (${fsDelhi.hostBottom} <= ${fsDelhi.fsLikeTop})`);
    assert.equal(fsDelhi.autohideOpacity, '1', 'Hovered controls must remain visible even if .ytp-autohide toggles');

    // Auto-hide check inside Fullscreen Top Layer: pointerleave -> ~2.5s idle fade -> mousemove wake
    const fsIdleRes = await evalInPage(chrome.cdp, sessionId, `(async () => {
      const host = document.getElementById('yqc-controls-host');
      const fsEl = document.fullscreenElement;
      fsEl.classList.remove('ytp-autohide');
      host.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
      await new Promise(r => setTimeout(r, 2900));
      const hiddenState = {
        idleAttr: host.dataset.yqcIdle,
        opacity: getComputedStyle(host).opacity,
        pointerEvents: getComputedStyle(host).pointerEvents
      };
      fsEl.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      const syncClear = host.dataset.yqcIdle;
      await new Promise(r => setTimeout(r, 200));
      return {
        hiddenState,
        syncClear,
        restoredOpacity: getComputedStyle(host).opacity,
        restoredPointerEvents: getComputedStyle(host).pointerEvents
      };
    })()`);
    assert.equal(fsIdleRes.hiddenState.idleAttr, 'true');
    assert.equal(fsIdleRes.hiddenState.opacity, '0', 'Fullscreen controls must smoothly fade out after ~2.5s idle');
    assert.equal(fsIdleRes.hiddenState.pointerEvents, 'none');
    assert.equal(fsIdleRes.syncClear, undefined, 'Mouse movement on fullscreen player must immediately clear idle state');
    assert.equal(fsIdleRes.restoredOpacity, '1');
    assert.equal(fsIdleRes.restoredPointerEvents, 'auto');

    // Classic Fullscreen fallback test (remove .ytp-fullscreen-quick-actions)
    const fsClassic = await evalInPage(chrome.cdp, sessionId, `(() => {
      const qa = document.querySelector('.ytp-fullscreen-quick-actions');
      qa.remove();
      window.__YQC_CONTROLLER__.handleFullscreenTransition();
      const host = document.getElementById('yqc-controls-host');
      const chromeBottom = document.querySelector('.ytp-chrome-bottom');
      const hRect = host.getBoundingClientRect();
      const cRect = chromeBottom.getBoundingClientRect();
      return {
        fsPlacement: host.dataset.yqcFsPlacement,
        hostBottom: Math.round(hRect.bottom),
        chromeTop: Math.round(cRect.top),
        insideFs: document.fullscreenElement.contains(host)
      };
    })()`);
    assert.equal(fsClassic.fsPlacement, 'classic-overlay');
    assert.equal(fsClassic.insideFs, true);
    assert.ok(fsClassic.hostBottom <= fsClassic.chromeTop + 2, 'Classic fallback must not overlap .ytp-chrome-bottom');

    // Exit fullscreen -> verify Watch controls restored cleanly
    await evalInPage(chrome.cdp, sessionId, `(async () => { await document.exitFullscreen(); await new Promise(r => setTimeout(r, 200)); })()`);
    const postFsWatch = await evalInPage(chrome.cdp, sessionId, `({
      fs: document.fullscreenElement,
      hostCount: document.querySelectorAll('#yqc-controls-host').length,
      mode: document.getElementById('yqc-controls-host')?.dataset.yqcMode
    })`);
    assert.equal(postFsWatch.fs, null);
    assert.equal(postFsWatch.hostCount, 1);
    assert.equal(postFsWatch.mode, 'watch');

    // 4b. Normal Watch-mode Auto-Hide: ~2.5s idle fade -> #movie_player mousemove instant wake -> hover interaction hold
    const watchIdleRes = await evalInPage(chrome.cdp, sessionId, `(async () => {
      const host = document.getElementById('yqc-controls-host');
      const player = document.getElementById('movie_player');
      player.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      const visibleImmediately = {
        idleAttr: host.dataset.yqcIdle,
        opacity: getComputedStyle(host).opacity
      };

      // Idle 2.9s (2.5s delay + 280ms CSS fade-out) -> faded out cleanly with zero click interception
      await new Promise(r => setTimeout(r, 2900));
      const afterIdle = {
        idleAttr: host.dataset.yqcIdle,
        opacity: getComputedStyle(host).opacity,
        pointerEvents: getComputedStyle(host).pointerEvents
      };

      // Instant reappear on mouse move over player
      player.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      const wakeIdleAttr = host.dataset.yqcIdle;
      await new Promise(r => setTimeout(r, 200));
      const afterWakeOpacity = getComputedStyle(host).opacity;

      // Hovering over either control row keeps controls visible past idle window
      host.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
      await new Promise(r => setTimeout(r, 2650));
      const whileHoveredOpacity = getComputedStyle(host).opacity;
      const whileHoveredIdle = host.dataset.yqcIdle;

      // Leaving controls resumes idle countdown and hides smoothly again
      host.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
      await new Promise(r => setTimeout(r, 2900));
      const afterLeaveOpacity = getComputedStyle(host).opacity;

      // Wake once more before next step
      player.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      await new Promise(r => setTimeout(r, 200));

      return {
        visibleImmediately,
        afterIdle,
        wakeIdleAttr,
        afterWakeOpacity,
        whileHoveredOpacity,
        whileHoveredIdle,
        afterLeaveOpacity,
        postWakeOpacity: getComputedStyle(host).opacity
      };
    })()`);
    assert.equal(watchIdleRes.visibleImmediately.idleAttr, undefined);
    assert.equal(watchIdleRes.visibleImmediately.opacity, '1');
    assert.equal(watchIdleRes.afterIdle.idleAttr, 'true');
    assert.equal(watchIdleRes.afterIdle.opacity, '0', 'Normal mode controls must smoothly fade out after ~2.5s idle');
    assert.equal(watchIdleRes.afterIdle.pointerEvents, 'none');
    assert.equal(watchIdleRes.wakeIdleAttr, undefined, 'Mousemove on YouTube player must immediately clear idle state');
    assert.equal(watchIdleRes.afterWakeOpacity, '1');
    assert.equal(watchIdleRes.whileHoveredOpacity, '1', 'Hovering controls must keep both rows visible');
    assert.equal(watchIdleRes.whileHoveredIdle, undefined);
    assert.equal(watchIdleRes.afterLeaveOpacity, '0', 'Controls must fade out after leaving rows and staying idle');
    assert.equal(watchIdleRes.postWakeOpacity, '1');

    // 5. Shorts, SPA navigation, Auto-apply & Dark/Light theme styling on inline pill rows
    const spaThemeRes = await evalInPage(chrome.cdp, sessionId, `(async () => {
      // Enable non-1.0x defaultSpeed & defaultQuality in storage for next navigation auto-apply
      await chrome.storage.sync.set({ enabled: true, defaultSpeed: 1.5, defaultQuality: 'hd1440', autoApply: true });

      // Theme Light -> Dark live adaptation directly on inline pill buttons
      document.documentElement.removeAttribute('dark');
      await new Promise(r => setTimeout(r, 180));
      const activePill = document.querySelector('#yqc-speed-row .yqc-chip[aria-pressed="true"]');
      const inactivePill = document.querySelector('#yqc-speed-row .yqc-chip[aria-pressed="false"]');
      const lightActiveBg = getComputedStyle(activePill).backgroundColor;
      const lightInactiveBg = getComputedStyle(inactivePill).backgroundColor;
      document.documentElement.setAttribute('dark', '');
      await new Promise(r => setTimeout(r, 180));
      const darkActiveBg = getComputedStyle(activePill).backgroundColor;
      const darkInactiveBg = getComputedStyle(inactivePill).backgroundColor;

      // SPA Navigation: Watch -> Shorts
      window.dispatchEvent(new Event('yt-navigate-start'));
      document.getElementById('watch-stage').style.display = 'none';
      document.getElementById('shorts-stage').style.display = 'flex';
      history.pushState({}, '', '/shorts/reel1');
      window.dispatchEvent(new Event('yt-navigate-finish'));
      await new Promise(r => setTimeout(r, 200));

      const s1Host = document.getElementById('yqc-controls-host');
      const reel1 = document.getElementById('reel-1');
      const reel2 = document.getElementById('reel-2');
      const r1Vid = reel1.querySelector('video');
      const r2Vid = reel2.querySelector('video');
      const shorts1Result = {
        hostCount: document.querySelectorAll('#yqc-controls-host').length,
        mode: s1Host?.dataset.yqcMode,
        inActiveReel: reel1.contains(s1Host),
        r1Rate: r1Vid.playbackRate,
        r1ActiveSpeedText: s1Host?.querySelector('#yqc-speed-row [aria-pressed="true"]')?.textContent.trim(),
        r2RateUntouched: r2Vid.playbackRate
      };

      // Scroll Shorts reel1 -> reel2
      reel1.removeAttribute('is-active');
      reel2.setAttribute('is-active', '');
      history.pushState({}, '', '/shorts/reel2');
      window.dispatchEvent(new Event('yt-navigate-finish'));
      await new Promise(r => setTimeout(r, 200));
      const shorts2Result = {
        inReel2: reel2.contains(document.getElementById('yqc-controls-host')),
        r2Rate: r2Vid.playbackRate,
        hostCount: document.querySelectorAll('#yqc-controls-host').length
      };

      // Navigate to Home ('/') -> 0 hosts cleanly torn down
      window.dispatchEvent(new Event('yt-navigate-start'));
      document.getElementById('shorts-stage').style.display = 'none';
      history.pushState({}, '', '/');
      window.dispatchEvent(new Event('yt-navigate-finish'));
      await new Promise(r => setTimeout(r, 150));
      const homeHostCount = document.querySelectorAll('#yqc-controls-host').length;

      return { lightActiveBg, lightInactiveBg, darkActiveBg, darkInactiveBg, shorts1Result, shorts2Result, homeHostCount };
    })()`);

    assert.equal(spaThemeRes.lightActiveBg, 'rgb(15, 15, 15)');
    assert.equal(spaThemeRes.darkActiveBg, 'rgb(241, 241, 241)');
    assert.notEqual(spaThemeRes.lightInactiveBg, spaThemeRes.darkInactiveBg);

    assert.equal(spaThemeRes.shorts1Result.hostCount, 1);
    assert.equal(spaThemeRes.shorts1Result.mode, 'shorts');
    assert.equal(spaThemeRes.shorts1Result.inActiveReel, true);
    assert.equal(spaThemeRes.shorts1Result.r1Rate, 1.5, 'Auto-apply defaultSpeed applies on Shorts navigation');
    assert.equal(spaThemeRes.shorts1Result.r1ActiveSpeedText, '1.5x');
    assert.equal(spaThemeRes.shorts1Result.r2RateUntouched, 1.0, 'Offscreen Shorts reel must remain untouched');

    assert.equal(spaThemeRes.shorts2Result.inReel2, true);
    assert.equal(spaThemeRes.shorts2Result.r2Rate, 1.5);
    assert.equal(spaThemeRes.shorts2Result.hostCount, 1);
    assert.equal(spaThemeRes.homeHostCount, 0, 'Home feed must clean up controls cleanly');

    // 6. Real Popup UI test inside Chrome 156 with pre-injected chrome.storage before popup.js executes
    const popupTarget = await chrome.cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: popupSession } = await chrome.cdp.send('Target.attachToTarget', {
      targetId: popupTarget.targetId,
      flatten: true
    });
    await chrome.cdp.send('Page.enable', {}, popupSession);
    await chrome.cdp.send('Runtime.enable', {}, popupSession);
    await chrome.cdp.send(
      'Page.addScriptToEvaluateOnNewDocument',
      {
        source: `
          window.__POPUP_STORE__ = { enabled: true, defaultSpeed: 1.0, defaultQuality: 'auto', autoApply: true };
          window.__POPUP_FAIL_SYNC__ = false;
          window.chrome = {
            storage: {
              sync: {
                async get(def) { if (window.__POPUP_FAIL_SYNC__) throw new Error('sync off'); return { ...def, ...window.__POPUP_STORE__ }; },
                async set(next) { if (window.__POPUP_FAIL_SYNC__) throw new Error('sync off'); Object.assign(window.__POPUP_STORE__, next); }
              },
              local: {
                async get(def) { return { ...def, ...window.__POPUP_STORE__ }; },
                async set(next) { Object.assign(window.__POPUP_STORE__, next); }
              },
              onChanged: { addListener() {} }
            }
          };
        `
      },
      popupSession
    );
    await chrome.cdp.send('Page.navigate', { url: `${baseUrl}/popup.html` }, popupSession);
    await new Promise((r) => setTimeout(r, 300));

    const popupRes = await evalInPage(chrome.cdp, popupSession, `(async () => {
      const enabledEl = document.getElementById('setting-enabled');
      const speedSel = document.getElementById('setting-default-speed');
      const customWrap = document.getElementById('custom-speed-wrap');
      const customInput = document.getElementById('setting-custom-speed');
      const applyCustomBtn = document.getElementById('apply-custom-speed');
      const qualitySel = document.getElementById('setting-default-quality');
      const resetBtn = document.getElementById('reset-defaults');
      const statusEl = document.getElementById('status-banner');

      speedSel.value = '2.25';
      speedSel.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 40));
      const savedPresetSpeed = window.__POPUP_STORE__.defaultSpeed;

      speedSel.value = 'custom';
      speedSel.dispatchEvent(new Event('change'));
      const customVisible = !customWrap.hidden;
      customInput.value = '1.35';
      applyCustomBtn.click();
      await new Promise(r => setTimeout(r, 40));
      const savedCustomSpeed = window.__POPUP_STORE__.defaultSpeed;

      window.__POPUP_FAIL_SYNC__ = true;
      qualitySel.value = 'hd1080';
      qualitySel.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 40));
      const fallbackStatus = statusEl.innerText.trim();
      const savedQuality = window.__POPUP_STORE__.defaultQuality;

      enabledEl.checked = false;
      enabledEl.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 40));
      const disabledState = window.__POPUP_STORE__.enabled;

      window.__POPUP_FAIL_SYNC__ = false;
      resetBtn.click();
      await new Promise(r => setTimeout(r, 40));
      const afterReset = { ...window.__POPUP_STORE__ };

      return {
        speedOptions: Array.from(speedSel.options).map(o => o.value),
        qualityOptions: Array.from(qualitySel.options).map(o => o.value),
        savedPresetSpeed,
        customVisible,
        savedCustomSpeed,
        fallbackStatus,
        savedQuality,
        disabledState,
        afterReset
      };
    })()`);

    assert.ok(popupRes.speedOptions.includes('2.25'));
    assert.ok(popupRes.speedOptions.includes('custom'));
    assert.ok(popupRes.qualityOptions.includes('hd2160'));
    assert.ok(popupRes.qualityOptions.includes('auto'));
    assert.equal(popupRes.savedPresetSpeed, 2.25);
    assert.equal(popupRes.customVisible, true);
    assert.equal(popupRes.savedCustomSpeed, 1.35);
    assert.match(popupRes.fallbackStatus, /Saved locally/);
    assert.equal(popupRes.savedQuality, 'hd1080');
    assert.equal(popupRes.disabledState, false);
    assert.deepEqual(popupRes.afterReset, {
      enabled: true,
      defaultSpeed: 1.0,
      defaultQuality: 'auto',
      autoApply: true
    });
  } finally {
    await chrome.dispose();
    server.close();
  }
});

test(
  'Brave unpacked MV3 --load-extension E2E: service_worker & popup chrome.storage persistence',
  { skip: !fs.existsSync(BRAVE_BIN) },
  async () => {
    const brave = await launchBrowser(BRAVE_BIN, [
      `--disable-extensions-except=${EXT_DIR}`,
      `--load-extension=${EXT_DIR}`
    ]);

    try {
      let extOrigin = null;
      for (let attempt = 0; attempt < 25 && !extOrigin; attempt += 1) {
        const { targetInfos } = await brave.cdp.send('Target.getTargets');
        const swTarget = targetInfos.find(
          (t) => t.type === 'service_worker' && t.url.endsWith('/background.js')
        );
        if (swTarget) {
          extOrigin = swTarget.url.replace(/\/background\.js$/, '');
          break;
        }
        await new Promise((r) => setTimeout(r, 120));
      }
      assert.ok(extOrigin, 'MV3 background.js service worker must register under --load-extension');

      const { targetId } = await brave.cdp.send('Target.createTarget', {
        url: 'about:blank'
      });
      const { sessionId } = await brave.cdp.send('Target.attachToTarget', {
        targetId,
        flatten: true
      });
      await brave.cdp.send('Page.enable', {}, sessionId);
      await brave.cdp.send('Runtime.enable', {}, sessionId);
      await brave.cdp.send('Page.navigate', { url: `${extOrigin}/popup.html` }, sessionId);

      // Wait cleanly for popup.js async initPopup() to hydrate storage -> UI
      for (let i = 0; i < 30; i += 1) {
        const ready = await evalInPage(
          brave.cdp,
          sessionId,
          `['Synced', 'Local storage mode'].includes(document.querySelector('#status-banner .status-text')?.textContent?.trim())`
        );
        if (ready) break;
        await new Promise((r) => setTimeout(r, 50));
      }

      const beforeRes = await evalInPage(
        brave.cdp,
        sessionId,
        `(async () => {
          const speedSel = document.getElementById('setting-default-speed');
          const qualitySel = document.getElementById('setting-default-quality');
          const statusText = document.querySelector('#status-banner .status-text');
          const initialSpeed = speedSel.value;
          speedSel.value = '1.5';
          speedSel.dispatchEvent(new Event('change'));
          for (let i = 0; i < 40; i += 1) {
            const msg = statusText?.textContent?.toLowerCase() || '';
            if (msg.includes('saved')) break;
            await new Promise(r => setTimeout(r, 25));
          }
          qualitySel.value = 'hd1080';
          qualitySel.dispatchEvent(new Event('change'));
          await new Promise(r => setTimeout(r, 120));
          return { initialSpeed };
        })()`
      );
      assert.equal(beforeRes.initialSpeed, '1');

      await brave.cdp.send('Page.reload', {}, sessionId);
      await new Promise((r) => setTimeout(r, 120));
      for (let i = 0; i < 30; i += 1) {
        const ready = await evalInPage(
          brave.cdp,
          sessionId,
          `['Synced', 'Local storage mode'].includes(document.querySelector('#status-banner .status-text')?.textContent?.trim())`
        );
        if (ready) break;
        await new Promise((r) => setTimeout(r, 50));
      }
      const persisted = await evalInPage(
        brave.cdp,
        sessionId,
        `({
          speed: document.getElementById('setting-default-speed')?.value,
          quality: document.getElementById('setting-default-quality')?.value
        })`
      );
      assert.equal(persisted.speed, '1.5');
      assert.equal(persisted.quality, 'hd1080');
    } finally {
      await brave.dispose();
    }
  }
);
