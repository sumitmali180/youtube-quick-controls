# YouTube Quick Controls (speedoq)

Production-ready **Manifest V3 Chrome Extension** adding two compact horizontal rows of one-click **Playback Speed** (`0.25x`–`3.0x`) and **Video Quality** (`Auto`, `144p`–`2160p`) pill controls directly above YouTube's Like button across standard watch pages, fullscreen mode, and YouTube Shorts.

## Extension Package

The standalone unpacked Chrome extension lives in [`youtube-quick-controls/`](youtube-quick-controls/):

- Load [`youtube-quick-controls/`](youtube-quick-controls/) directly in `chrome://extensions/` via **Load unpacked** (see [youtube-quick-controls/README.md](youtube-quick-controls/README.md)).

## Verification

Run the automated unit and real Google Chrome CDP verification suite:

```bash
node --test tests/*.test.mjs
```

