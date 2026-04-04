# Exercise Animation Assets

Place animation clips compatible with `man-1812910.glb` in this folder.

Recommended:

- single GLB containing the base rig + multiple clips (same skeleton)
- clip names matching your exercise/card clip names

Examples of configured clip names:

- PushUp
- Squat
- FrontPlank
- ReverseLunge
- PikePushUp
- HollowHold
- AustralianRow
- JumpSquat
- GluteBridge
- MountainClimber
- DeadBug

Optional per-exercise external clip file:

- Set `asset` in the runtime clip config for a specific exercise type.
- The loader merges clips from the base model and this external asset by clip name.
