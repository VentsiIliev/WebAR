# WebAR

Browser-based augmented reality starter project designed for a clean migration path from **marker tracking** to **image tracking**.

## Overview

This repository is a TypeScript + Three.js foundation for a WebAR application that:

- requests camera access in the browser
- displays the live camera feed full-screen
- tracks a target in the background
- renders a 3D object anchored to that target
- keeps user interaction separate from tracking logic
- supports a future migration from marker-based tracking to image/business-card tracking

The current codebase includes:

- a working browser camera bootstrap
- a Three.js scene overlay
- a pluggable `Tracker` interface
- a `MarkerTracker` stub
- a simulated pose loop for testing the render pipeline

## Current Status

Implemented now:

- browser camera startup
- video background rendering through a normal HTML video element
- WebGL overlay via Three.js
- scene anchor abstraction
- tracker abstraction
- minimal app bootstrap with simulated pose updates
- Vite local development setup

Planned next:

- integrate real marker tracking
- add gesture controls for rotate / scale
- add model loading via GLTF/GLB
- introduce image tracking implementation

## Architecture Docs

- [`docs/architecture.md`](docs/architecture.md) — system architecture and migration strategy
- [`docs/requirements.md`](docs/requirements.md) — functional, non-functional, and compatibility requirements

## Project Structure

```text
src/
├── app/
│   └── App.ts
├── camera/
│   └── CameraManager.ts
├── scene/
│   ├── Anchor.ts
│   └── SceneManager.ts
├── tracking/
│   ├── MarkerTracker.ts
│   └── Tracker.ts
└── main.ts
```

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+
- modern browser with camera support

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

Open the local Vite URL in your browser.

## Camera Testing

When the app starts, the browser should:

1. request camera permission
2. show the rear/environment camera when available
3. render a Three.js canvas on top of the video
4. display the test object driven by a simulated pose

### Notes

- camera access requires **HTTPS** in production
- camera access works on **localhost** during development
- on mobile devices, test with the dev server exposed on your local network if needed
- `playsinline` is enabled to support in-page video on iOS

## Design Principles

- keep tracking isolated from rendering
- treat pose as input data
- make tracker implementations swappable
- validate cross-platform browser behavior early
- prefer portable browser APIs over platform-specific native SDKs for the MVP

## Migration Strategy

The repo starts with marker-oriented structure because it is easier to prototype and debug.

Later migration to image tracking should require changing only the tracking implementation, while keeping the camera, scene, interaction, and UI layers mostly intact.

## Target Platforms

The intended support baseline is:

- iOS Safari
- Android Chrome
- Windows Chrome
- Windows Edge

## Immediate Next Steps

1. replace the simulated pose source with a real marker tracker
2. add a visible GLB model instead of the test cube
3. introduce gesture controls
4. calibrate object scale and orientation
5. test across iPhone, Android, and desktop browsers

## License

To be decided.
