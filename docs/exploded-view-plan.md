# Exploded View Feature Plan

## Goal

Enable interactive exploded view for 3D models:

- Double tap → explode model into parts
- Double tap again → collapse back
- Smooth animated transitions

---

## FILE PLACEMENT (IMPORTANT)

### New Files

```
src/
├── interaction/
│   └── ExplodeController.ts
```

---

### Modified Files

```
src/
├── scene/
│   └── SceneManager.ts
├── app/
│   └── App.ts
```

---

### Model Location

```
public/models/
   your-model.glb
```

---

## Architecture Integration

### Existing Flow

Camera → Tracker → Pose → Scene → Interaction

### New Component

Interaction Layer → ExplodeController

```text
Anchor
 └── userGroup
      └── Model
           └── Parts (meshes)
```

---

## Controller Responsibilities

- Analyze model structure
- Compute explosion directions
- Store original + exploded positions
- Animate transitions
- Provide toggle API

---

## Interaction Design

| Gesture        | Action        |
|----------------|--------------|
| Drag           | Rotate model |
| Pinch          | Scale model  |
| Double Tap     | Explode/Collapse |

---

## Implementation Steps

### Step 1 – Prepare Model

- Model must contain multiple meshes
- Export as GLB
- Place in `/public/models/`

---

### Step 2 – Load GLB Model

(To be added next)

```ts
loader.load('/models/model.glb', (gltf) => {
  const model = gltf.scene;
  anchor.userGroup.add(model);
  explode.register(model);
});
```

---

### Step 3 – Register Model

Already handled in:

- `SceneManager.ts`

---

### Step 4 – Animate in Render Loop

Already implemented:

```ts
explode.update(deltaTime);
```

---

### Step 5 – Hook Double Tap

Implemented in:

- `App.ts`

```ts
if (now - lastTap < 300) {
  scene.toggleExplode();
}
```

---

## Explosion Logic

For each part:

1. Compute model center
2. Compute part center
3. Direction = normalize(partCenter - modelCenter)
4. explodedPosition = originalPosition + direction * distance

---

## Animation Strategy

- Linear interpolation (lerp)
- Ease-out cubic
- Duration: ~300–500ms

---

## Current Demo

A temporary multi-part cube structure is used:

- proves explode logic works
- will be replaced with real model

---

## Future Improvements

- Select part on tap
- Highlight hovered part
- Display metadata (labels, UI)
- Animated assembly sequence
- Physics-based explosion

---

## Risks

- Models with single mesh cannot explode properly
- Poor pivot/origin placement may cause odd movement
- Large models may affect performance

---

## Summary

This feature:

- Adds zero coupling to tracking
- Lives fully in interaction layer
- Is ready for real model integration

---

## Next Step

1. Add GLTFLoader
2. Load real model
3. Remove demo cubes
4. Register explode on real model
5. Test on mobile
