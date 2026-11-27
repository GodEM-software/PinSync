# PinSync

> **Freeform infinite reference canvas for images, videos, webpages, audio, 30+ 3D/CAD model formats, free-draw sketches, flowcharts, and code — with built-in central server live sync and native OS drag-out.**

[![Build & Release](https://github.com/GodEM-software/PinSync/actions/workflows/release.yml/badge.svg)](https://github.com/GodEM-software/PinSync/actions/workflows/release.yml)
[![GitHub Pages](https://github.com/GodEM-software/PinSync/actions/workflows/pages.yml/badge.svg)](https://github.com/GodEM-software/PinSync/actions/workflows/pages.yml)

---

## Features

### 11 Board Content Types

- **Images** — PNG, JPG, WebP, GIF, BMP, SVG, AVIF + clipboard paste (`Ctrl+V`), non-destructive cropping (`Alt+Shift+Drag`), grayscale, and flip.
- **Videos** — MP4, WebM, MOV, MKV, OGG, AVI with scrubbing, loop, mute, and `0.5x–2x` speed.
- **Webpages** — Live embedded `<webview>` cards with URL bar, navigation, and double-click Interact Mode.
- **Sound / Audio** — MP3, WAV, FLAC, OGG, M4A, AAC, OPUS with live Web Audio waveform visualizer.
- **3D Models & CAD (30+ Formats)** — GLB, GLTF, OBJ, FBX, STL, DAE, PLY, 3DS, 3MF, AMF, LWO, USD/USDZ, WRL/VRML, VTK/VTP, XYZ, PCD, VOX, KMZ, GCODE, OFF, X3D, BVH, MD2, SPLAT/KSPLAT/SPZ, 3DM, STEP/IGES/BREP (via `occt-import-js`), and `.zip` asset bundles.
- **Inline Text** — Type directly anywhere on the canvas; click to open font, size, alignment, color, and card styling.
- **Free-Draw Pen (`Alt+D`)** — Smooth vector SVG strokes with color swatches, custom color picker, stroke width, and opacity.
- **Flowcharts & Arrows** — 6 flowchart node shapes with quick-connect ports; type `aaa` + `Space` (or `Alt+A`) to draw straight, curved, or elbow arrows.
- **Code Snippets** — Drop code files or paste code for syntax-highlighted cards with line numbers and word wrap.
- **Color Swatches** — Screen eyedropper (`Alt+I`) creates copyable hex swatch cards.

### Online Mode & Central Server

- **Built-in Central Server (`:4580`)** or standalone `npm run server` (`server/central-server.mjs`).
- **Central Asset Storage:** Images, videos, audio, and 3D models are deduplicated by SHA-1 and stored on the central server so collaborators automatically download and render every asset.
- **Live Collaboration:** Share a Room / Board ID (`board_xxxxxx`) so peers can join, view, and refine the board in real time over Server-Sent Events (SSE).

### Portable Save & Native Drag-Out

- **Self-Contained `.artbrd.json` Save:** Saving a board embeds all referenced local media files directly into the file so it opens cleanly on any other computer.
- **Native OS Drag-Out:** Click, hold, and drag any item past the edge of the PinSync window to drop it directly onto your Desktop, Explorer, Photoshop, Blender, or any other app.

---

## Quick Start

```bash
npm install
npm start
```

- **Dev mode with HMR:** `npm run dev`
- **Standalone Central Server:** `npm run server` (listens on `http://0.0.0.0:4580`, stores data in `server-data/`)

---

## Building Installers

- **Windows (`.exe` NSIS setup + portable `.exe`):**
  ```bash
  npm run build:win
  ```
- **Linux (`.AppImage`, `.deb` for Debian/Deepin, `.pacman` for Arch):**
  ```bash
  npm run build:linux
  ```
  _(Note: Linux `.deb`, `.pacman`, and `.AppImage` must be built on Linux/WSL or via the included GitHub Actions workflow `.github/workflows/release.yml`.)_

---

## Essential Controls

| Action               | Shortcut / Gesture                                       |
| -------------------- | -------------------------------------------------------- |
| Pan Canvas           | `Middle Drag`, `Alt + Left Drag`, or `Space + Left Drag` |
| Zoom Canvas          | `Mouse Wheel`                                            |
| Move Window          | `Right Mouse Drag`                                       |
| Context Menu         | `Right Click`                                            |
| Free-Draw Pen        | `Alt + D`                                                |
| Draw Arrow           | `Alt + A` or type `aaa` + `Space`                        |
| Screen Eyedropper    | `Alt + I`                                                |
| Arrange Optimal      | `Ctrl + P`                                               |
| Zen Mode (Hide Dock) | `Tab`                                                    |
| Jump / Search Items  | `Ctrl + K`                                               |
| Shortcut Settings    | `F1`                                                     |

---

## License

[MIT](LICENSE)
