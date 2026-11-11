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

async function launchChrome() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yqc-e2e-'));
  const proc = spawn(
    CHROME_BIN,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1280,900',
      `--user-data-dir=${userDataDir}`,
      '--remote-debugging-port=0',
      'about:blank'
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  const wsUrl = await new Promise((resolve, reject) => {
    let stderr = '';
    const timer = setTimeout(() => reject(new Error(`Chrome start timeout: ${stderr}`)), 10000);
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

    // 1. Watch-page placement directly above Like button + target dimensions >= 24px
    const watchLayout = await evalInPage(chrome.cdp, sessionId, `(() => {
      const hosts = document.querySelectorAll('#yqc-controls-host');
      const host = hosts[0];
      const likeBtn = document.getElementById('watch-like-btn');
      const speedBtn = document.getElementById('yqc-speed-trigger');
      const qualityBtn = document.getElementById('yqc-quality-trigger');
      const hRect = host.getBoundingClientRect();
      const lRect = likeBtn.getBoundingClientRect();
      const sRect = speedBtn.getBoundingClientRect();
      const qRect = qualityBtn.getBoundingClientRect();
      likeBtn.click();
      return {
        hostCount: hosts.length,
        mode: host.dataset.yqcMode,
        hostBottom: Math.round(hRect.bottom),
        likeTop: Math.round(lRect.top),
        hostLeft: Math.round(hRect.left),
        likeLeft: Math.round(lRect.left),
        speedLabel: speedBtn.innerText.trim(),
        qualityLabel: qualityBtn.innerText.trim(),
        speedDims: [Math.round(sRect.width), Math.round(sRect.height)],
        qualityDims: [Math.round(qRect.width), Math.round(qRect.height)],
        likeClicks: window.__TEST_STATE__.likeClicks
      };
    })()`);

    assert.equal(watchLayout.hostCount, 1);
    assert.equal(watchLayout.mode, 'watch');
    assert.ok(watchLayout.hostBottom <= watchLayout.likeTop + 1, `Controls must render ABOVE Like button (${watchLayout.hostBottom} <= ${watchLayout.likeTop})`);
    assert.ok(Math.abs(watchLayout.hostLeft - watchLayout.likeLeft) <= 10, 'Controls must align with Like button left edge');
    assert.ok(watchLayout.speedDims[0] >= 24 && watchLayout.speedDims[1] >= 24);
    assert.ok(watchLayout.qualityDims[0] >= 24 && watchLayout.qualityDims[1] >= 24);
    assert.equal(watchLayout.likeClicks, 1, 'Native Like button click handler must stay intact');
    assert.equal(watchLayout.speedLabel, '1.0x');
    assert.equal(watchLayout.qualityLabel, 'Auto (720p)');

    // 2. Speed presets, custom YouTube-exposed rate, inline custom speed, ratechange sync & propagation isolation
    const speedRes = await evalInPage(chrome.cdp, sessionId, `(async () => {
      const video = document.querySelector('#movie_player video');
      const speedTrigger = document.getElementById('yqc-speed-trigger');
      speedTrigger.click();
      const rates = Array.from(document.querySelectorAll('#yqc-speed-menu .yqc-menu-item')).map(b => Number(b.dataset.yqcRate));
      document.querySelector('#yqc-speed-menu [data-yqc-rate="2.25"]').click();
      const after225 = { rate: video.playbackRate, pill: speedTrigger.innerText.trim() };

      // Custom YouTube exposed rate (1.15)
      document.querySelector('#yqc-speed-menu [data-yqc-rate="1.15"]').click();
      const afterCustomYt = { rate: video.playbackRate, pill: speedTrigger.innerText.trim() };

      // Inline custom rate via numeric input
      speedTrigger.click();
      const customInput = document.querySelector('#yqc-speed-menu .yqc-custom-input');
      customInput.value = '1.4';
      customInput.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      document.querySelector('#yqc-speed-menu .yqc-custom-apply').click();
      const afterInlineCustom = { rate: video.playbackRate, pill: speedTrigger.innerText.trim() };

      // External ratechange sync
      video.playbackRate = 1.75;
      video.dispatchEvent(new Event('ratechange'));
      await new Promise(r => setTimeout(r, 80));

      return {
        rates,
        after225,
        afterCustomYt,
        afterInlineCustom,
        afterExternal: speedTrigger.innerText.trim(),
        playerClicks: window.__TEST_STATE__.playerClicks,
        globalHotkeys: window.__TEST_STATE__.globalHotkeys
      };
    })()`);

    assert.equal(speedRes.rates.includes(2.25), true);
    assert.equal(speedRes.rates.includes(1.15), true);
    assert.equal(speedRes.after225.rate, 2.25);
    assert.equal(speedRes.afterCustomYt.rate, 1.15);
    assert.equal(speedRes.afterInlineCustom.rate, 1.4);
    assert.equal(speedRes.afterExternal, '1.75x');
    assert.equal(speedRes.playerClicks, 0, 'Clicking controls must not bubble clicks to #movie_player');
    assert.equal(speedRes.globalHotkeys, 0, 'Typing in custom speed input must not trigger YouTube hotkeys');

    // 3. Dynamic quality list, limited video, loading video, & refusal tooltip/rollback
    const qualityRes = await evalInPage(chrome.cdp, sessionId, `(async () => {
      const qTrigger = document.getElementById('yqc-quality-trigger');
      // Switch cleanly to 1080p
      qTrigger.click();
      document.querySelector('#yqc-quality-menu [data-yqc-quality="hd1080"]').click();
      await new Promise(r => setTimeout(r, 200));
      const applied1080 = qTrigger.innerText.trim();

      // Simulate player refusing hd2160 while staying on hd1080
      window.__TEST_STATE__.refuseQuality = true;
      qTrigger.click();
      document.querySelector('#yqc-quality-menu [data-yqc-quality="hd2160"]').click();
      await new Promise(r => setTimeout(r, 1750));
      const tooltip = document.querySelector('#yqc-controls-host .yqc-tooltip');
      const refusedRes = {
        pillAfterRefusal: qTrigger.innerText.trim(),
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
      const limitedOpts = Array.from(document.querySelectorAll('#yqc-quality-menu .yqc-menu-item')).map(b => b.dataset.yqcQuality);

      // Simulate still loading ([]) then ready
      window.__TEST_STATE__.levels = [];
      window.__TEST_STATE__.currentQuality = 'unknown';
      await window.__YQC_CONTROLLER__.fetchAndUpdateQualityState({ tryApplyDefaults: false });
      const loadingLabel = qTrigger.innerText.trim();

      return { applied1080, refusedRes, limitedOpts, loadingLabel };
    })()`);

    assert.equal(qualityRes.applied1080, '1080p60');
    assert.equal(qualityRes.refusedRes.pillAfterRefusal, '1080p60', 'Must keep previous quality visible on refusal');
    assert.equal(qualityRes.refusedRes.tooltipVisible, true, 'Must display subtle error tooltip on refusal');
    assert.match(qualityRes.refusedRes.tooltipText, /⚠/);
    assert.deepEqual(qualityRes.limitedOpts, ['large', 'medium']);
    assert.equal(qualityRes.loadingLabel, 'Loading...');

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

    const fsDelhi = await evalInPage(chrome.cdp, sessionId, `(() => {
      const fsEl = document.fullscreenElement;
      const host = document.getElementById('yqc-controls-host');
      const fsLike = fsEl?.querySelector('.ytp-fullscreen-quick-actions button[aria-label*="like" i]');
      const hRect = host?.getBoundingClientRect();
      const lRect = fsLike?.getBoundingClientRect();
      return {
        isFullscreen: Boolean(fsEl),
        insideTopLayer: Boolean(fsEl && host && fsEl.contains(host)),
        hostCount: document.querySelectorAll('#yqc-controls-host').length,
        mode: host?.dataset.yqcMode,
        fsPlacement: host?.dataset.yqcFsPlacement,
        hostBottom: Math.round(hRect?.bottom || 0),
        fsLikeTop: Math.round(lRect?.top || 0),
        visibleWidth: Math.round(hRect?.width || 0),
        autohideOpacity: (() => {
          document.getElementById('yqc-speed-trigger').click();
          fsEl.classList.add('ytp-autohide');
          return getComputedStyle(host).opacity;
        })()
      };
    })()`);

    assert.equal(fsDelhi.isFullscreen, true, 'Headless Chrome should enter real Fullscreen Top Layer');
    assert.equal(fsDelhi.insideTopLayer, true, 'Controls must live inside document.fullscreenElement');
    assert.equal(fsDelhi.hostCount, 1);
    assert.equal(fsDelhi.mode, 'fullscreen');
    assert.equal(fsDelhi.fsPlacement, 'above-like');
    assert.ok(fsDelhi.visibleWidth > 50);
    assert.ok(fsDelhi.hostBottom <= fsDelhi.fsLikeTop + 2, `Fullscreen controls must sit directly ABOVE fullscreen Like button (${fsDelhi.hostBottom} <= ${fsDelhi.fsLikeTop})`);
    assert.equal(fsDelhi.autohideOpacity, '1', 'Open menu must remain visible even if .ytp-autohide toggles');

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

    // 5. Shorts, SPA navigation, Auto-apply & Dark/Light theme + Outside Click & Escape
    const spaThemeRes = await evalInPage(chrome.cdp, sessionId, `(async () => {
      // Enable non-1.0x defaultSpeed & defaultQuality in storage for next navigation auto-apply
      await chrome.storage.sync.set({ enabled: true, defaultSpeed: 1.5, defaultQuality: 'hd1440', autoApply: true });

      // Theme Light -> Dark live adaptation
      document.documentElement.removeAttribute('dark');
      const qTrig = document.getElementById('yqc-quality-trigger');
      const qMenu = document.getElementById('yqc-quality-menu');
      qTrig.click();
      const lightMenuBg = getComputedStyle(qMenu).backgroundColor;
      document.documentElement.setAttribute('dark', '');
      const darkMenuBg = getComputedStyle(qMenu).backgroundColor;

      // Press Escape closes menu and returns focus to trigger
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const afterEsc = { expanded: qTrig.getAttribute('aria-expanded'), activeElId: document.activeElement?.id };

      // Outside click dismiss check
      qTrig.click();
      document.body.click();
      const afterOutside = qTrig.getAttribute('aria-expanded');

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

      return { lightMenuBg, darkMenuBg, afterEsc, afterOutside, shorts1Result, shorts2Result, homeHostCount };
    })()`);

    assert.equal(spaThemeRes.lightMenuBg, 'rgb(255, 255, 255)');
    assert.equal(spaThemeRes.darkMenuBg, 'rgb(40, 40, 40)');
    assert.equal(spaThemeRes.afterEsc.expanded, 'false');
    assert.equal(spaThemeRes.afterEsc.activeElId, 'yqc-quality-trigger');
    assert.equal(spaThemeRes.afterOutside, 'false');

    assert.equal(spaThemeRes.shorts1Result.hostCount, 1);
    assert.equal(spaThemeRes.shorts1Result.mode, 'shorts');
    assert.equal(spaThemeRes.shorts1Result.inActiveReel, true);
    assert.equal(spaThemeRes.shorts1Result.r1Rate, 1.5, 'Auto-apply defaultSpeed applies on Shorts navigation');
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
