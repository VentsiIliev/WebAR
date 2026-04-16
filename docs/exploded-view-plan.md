# Exploded View Feature Plan

## Goal

Enable interactive exploded view for 3D models:

- Double tap → explode model into parts
- Double tap again → collapse back
- Smooth animated transitions

---

## Requirements

### Model Requirements

- Model must contain multiple meshes (separate parts)
- GLB format preferred
- Logical grouping of components recommended

---

## Architecture Integration

### Existing Flow

Camera → Tracker → Pose → Scene → Interaction

### New Component

Add:

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

### Step 1 – Load GLB Model

- Use GLTFLoader
- Add model to `anchor.userGroup`

---

### Step 2 – Register Model

```ts
explodeController.register(model);
```

---

### Step 3 – Hook Double Tap

Detect double tap:

```ts
let lastTap = 0;

function onTap() {
  const now = Date.now();
  if (now - lastTap < 300) {
    explodeController.toggle();
  }
  lastTap = now;
}
```

---

### Step 4 – Animate in Render Loop

```ts
explodeController.update(deltaTime);
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
- Easing (ease-out cubic recommended)
- Duration: ~300–500ms

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

This feature builds on the existing architecture without modifying:

- Camera layer
- Tracking layer
- Scene rendering

Only extends:

- Interaction layer

---

## Next Step

1. Add GLTFLoader
2. Load real model
3. Plug in ExplodeController
4. Add double tap detection
