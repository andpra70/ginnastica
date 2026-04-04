# Model Asset (TurboSquid 1812910)

Conventional actor layout:

- `/assets3d/actors/<actor-name>/<actor-name>.fbx`
- `/assets3d/actors/<actor-name>/textures/base_color.<ext>`
- `/assets3d/actors/<actor-name>/textures/normal.<ext>`
- `/assets3d/actors/<actor-name>/textures/roughness.<ext>`
- `/assets3d/actors/<actor-name>/textures/height.<ext>` (optional)

The loader tries extensions in this order: `jpg`, `jpeg`, `png`, `webp`.
The setup now only needs `modelAsset` (FBX path); textures are auto-resolved by convention.
