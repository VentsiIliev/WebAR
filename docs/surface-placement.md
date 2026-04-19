# Surface Placement Plan

## Goal

Add a second AR interaction path that lets the user:

- see a circular reticle
- move the device until the reticle aligns to a floor or table
- tap to place a model on that surface
- interact with the placed model afterward

This must coexist with the current marker-driven and module-based architecture.

## Architecture

```text
WebAR App
├── Rubik Mode
├── Generic Model Mode
└── Surface Placement Mode
    ├── PlacementController
    ├── Reticle
    └── PlacementModule
```

## New Pieces

### PlacementController

Responsible for:

- creating and updating the reticle
- tracking a candidate placement pose
- exposing `place()` when the user taps
- later: owning WebXR hit testing

### Reticle

A simple ring mesh used as a visible placement circle.

### PlacementModule

A new module mode that:

- mounts a reticle
- loads a GLB model
- starts in `not placed` state
- places the model when the user taps
- later can switch from mock placement to real WebXR hit testing

## Migration Stages

### Stage 1

Implement a non-WebXR placement prototype:

- reticle shown in front of the camera
- tap to place model at reticle pose
- keep this fully module-driven

### Stage 2

Replace mock reticle updates with real WebXR hit testing:

- immersive-ar session
- hit-test source
- floor/table reticle
- tap/select to place model

## Files

```text
src/
├── placement/
│   ├── PlacementController.ts
│   └── Reticle.ts
├── modules/
│   └── PlacementModule.ts
```

## Notes

- Stage 1 is intentionally a safe structural implementation.
- Stage 2 should be added only after the module and reticle flow is stable.
- Existing marker tracking and generic model interactions should remain untouched.
