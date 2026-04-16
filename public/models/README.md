# 3D Models

This folder contains all 3D assets used by the WebAR application.

## Supported Formats

- `.glb` (recommended)
- `.gltf`

## Guidelines

- Keep model size under 5–10 MB for mobile performance
- Use compressed textures where possible
- Optimize polygon count for real-time rendering
- Ensure correct scale (meters recommended)

## Usage

Models placed here can be loaded at runtime using Three.js GLTFLoader.

Example path:

```
/public/models/example.glb
```

## Notes

This folder is served statically by Vite.
