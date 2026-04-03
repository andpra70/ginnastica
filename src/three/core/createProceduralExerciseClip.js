import { AnimationClip, Euler, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three'

const DEFAULT_TIMES = [0, 0.5, 1, 1.5, 2]

function canonicalName(name = '') {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function collectBoneNames(model) {
  const names = []
  model.traverse((node) => {
    if (node.isBone) names.push(node.name)
  })
  return names
}

function resolveBoneName(bones, token) {
  const lowToken = token.toLowerCase()
  const exact = bones.find((name) => name.toLowerCase() === lowToken)
  if (exact) return exact
  return bones.find((name) => name.toLowerCase().endsWith(`:${lowToken}`) || name.toLowerCase().endsWith(lowToken))
}

function quatFromDegrees([x = 0, y = 0, z = 0]) {
  // Mixamo bones in this FBX use opposite sign on the main flexion axis vs authored poses.
  const euler = new Euler(((-x) * Math.PI) / 180, (y * Math.PI) / 180, (z * Math.PI) / 180, 'XYZ')
  const q = new Quaternion().setFromEuler(euler)
  return [q.x, q.y, q.z, q.w]
}

function buildTracks({ bones, times, poses, hipsOffsets = [] }) {
  const tokenSet = new Set()
  poses.forEach((pose) => {
    Object.keys(pose).forEach((token) => tokenSet.add(token))
  })

  const tracks = []
  tokenSet.forEach((token) => {
    const boneName = resolveBoneName(bones, token)
    if (!boneName) return

    const values = []
    for (let i = 0; i < times.length; i += 1) {
      const degrees = poses[i]?.[token] || [0, 0, 0]
      values.push(...quatFromDegrees(degrees))
    }
    tracks.push(new QuaternionKeyframeTrack(`${boneName}.quaternion`, times, values))
  })

  const hipsName = resolveBoneName(bones, 'Hips')
  if (hipsName && hipsOffsets.length === times.length) {
    const values = hipsOffsets.flatMap((y) => [0, y, 0])
    tracks.push(new VectorKeyframeTrack(`${hipsName}.position`, times, values))
  }

  return tracks
}

function clipSpecFor(clipName) {
  const key = canonicalName(clipName)
  const specs = {
    idle: {
      times: DEFAULT_TIMES,
      hips: [0, 0.01, 0, -0.01, 0],
      poses: [{ Spine: [1, 0, 0] }, { Spine: [2, 0, 0] }, { Spine: [1, 0, 0] }, { Spine: [0, 0, 0] }, { Spine: [1, 0, 0] }]
    },
    pushup: {
      times: DEFAULT_TIMES,
      hips: [0, -0.14, 0, -0.14, 0],
      poses: [
        { LeftArm: [-20, 0, 0], RightArm: [-20, 0, 0], LeftForeArm: [10, 0, 0], RightForeArm: [10, 0, 0] },
        { LeftArm: [10, 0, 0], RightArm: [10, 0, 0], LeftForeArm: [-60, 0, 0], RightForeArm: [-60, 0, 0] },
        { LeftArm: [-20, 0, 0], RightArm: [-20, 0, 0], LeftForeArm: [10, 0, 0], RightForeArm: [10, 0, 0] },
        { LeftArm: [10, 0, 0], RightArm: [10, 0, 0], LeftForeArm: [-60, 0, 0], RightForeArm: [-60, 0, 0] },
        { LeftArm: [-20, 0, 0], RightArm: [-20, 0, 0], LeftForeArm: [10, 0, 0], RightForeArm: [10, 0, 0] }
      ]
    },
    squat: {
      times: DEFAULT_TIMES,
      hips: [0, -0.3, 0, -0.3, 0],
      poses: [
        { LeftUpLeg: [5, 0, 0], RightUpLeg: [5, 0, 0], LeftLeg: [-5, 0, 0], RightLeg: [-5, 0, 0], Spine: [0, 0, 0] },
        { LeftUpLeg: [-45, 0, 0], RightUpLeg: [-45, 0, 0], LeftLeg: [75, 0, 0], RightLeg: [75, 0, 0], Spine: [25, 0, 0] },
        { LeftUpLeg: [5, 0, 0], RightUpLeg: [5, 0, 0], LeftLeg: [-5, 0, 0], RightLeg: [-5, 0, 0], Spine: [0, 0, 0] },
        { LeftUpLeg: [-45, 0, 0], RightUpLeg: [-45, 0, 0], LeftLeg: [75, 0, 0], RightLeg: [75, 0, 0], Spine: [25, 0, 0] },
        { LeftUpLeg: [5, 0, 0], RightUpLeg: [5, 0, 0], LeftLeg: [-5, 0, 0], RightLeg: [-5, 0, 0], Spine: [0, 0, 0] }
      ]
    },
    frontplank: {
      times: DEFAULT_TIMES,
      hips: [0, -0.02, 0, 0.02, 0],
      poses: [
        { Spine: [0, 0, 0], LeftUpLeg: [0, 0, 0], RightUpLeg: [0, 0, 0] },
        { Spine: [2, 0, 0], LeftUpLeg: [-2, 0, 0], RightUpLeg: [-2, 0, 0] },
        { Spine: [0, 0, 0], LeftUpLeg: [0, 0, 0], RightUpLeg: [0, 0, 0] },
        { Spine: [-2, 0, 0], LeftUpLeg: [2, 0, 0], RightUpLeg: [2, 0, 0] },
        { Spine: [0, 0, 0], LeftUpLeg: [0, 0, 0], RightUpLeg: [0, 0, 0] }
      ]
    },
    reverselunge: {
      times: DEFAULT_TIMES,
      hips: [0, -0.22, 0, -0.22, 0],
      poses: [
        { LeftUpLeg: [0, 0, 0], RightUpLeg: [0, 0, 0], LeftLeg: [0, 0, 0], RightLeg: [0, 0, 0], Spine: [0, 0, 0] },
        { LeftUpLeg: [30, 0, 0], RightUpLeg: [-30, 0, 0], LeftLeg: [-25, 0, 0], RightLeg: [45, 0, 0], Spine: [10, 0, 0] },
        { LeftUpLeg: [0, 0, 0], RightUpLeg: [0, 0, 0], LeftLeg: [0, 0, 0], RightLeg: [0, 0, 0], Spine: [0, 0, 0] },
        { LeftUpLeg: [-30, 0, 0], RightUpLeg: [30, 0, 0], LeftLeg: [45, 0, 0], RightLeg: [-25, 0, 0], Spine: [10, 0, 0] },
        { LeftUpLeg: [0, 0, 0], RightUpLeg: [0, 0, 0], LeftLeg: [0, 0, 0], RightLeg: [0, 0, 0], Spine: [0, 0, 0] }
      ]
    },
    pikepushup: {
      times: DEFAULT_TIMES,
      hips: [0.05, 0.22, 0.05, 0.22, 0.05],
      poses: [
        { Spine: [30, 0, 0], LeftArm: [-40, 0, 0], RightArm: [-40, 0, 0], LeftForeArm: [0, 0, 0], RightForeArm: [0, 0, 0] },
        { Spine: [45, 0, 0], LeftArm: [-15, 0, 0], RightArm: [-15, 0, 0], LeftForeArm: [-45, 0, 0], RightForeArm: [-45, 0, 0] },
        { Spine: [30, 0, 0], LeftArm: [-40, 0, 0], RightArm: [-40, 0, 0], LeftForeArm: [0, 0, 0], RightForeArm: [0, 0, 0] },
        { Spine: [45, 0, 0], LeftArm: [-15, 0, 0], RightArm: [-15, 0, 0], LeftForeArm: [-45, 0, 0], RightForeArm: [-45, 0, 0] },
        { Spine: [30, 0, 0], LeftArm: [-40, 0, 0], RightArm: [-40, 0, 0], LeftForeArm: [0, 0, 0], RightForeArm: [0, 0, 0] }
      ]
    },
    hollowhold: {
      times: DEFAULT_TIMES,
      hips: [-0.08, -0.1, -0.08, -0.1, -0.08],
      poses: [
        { Spine: [25, 0, 0], Neck: [10, 0, 0], LeftUpLeg: [-25, 0, 0], RightUpLeg: [-25, 0, 0], LeftArm: [-70, 0, 0], RightArm: [-70, 0, 0] },
        { Spine: [30, 0, 0], Neck: [12, 0, 0], LeftUpLeg: [-28, 0, 0], RightUpLeg: [-28, 0, 0], LeftArm: [-75, 0, 0], RightArm: [-75, 0, 0] },
        { Spine: [25, 0, 0], Neck: [10, 0, 0], LeftUpLeg: [-25, 0, 0], RightUpLeg: [-25, 0, 0], LeftArm: [-70, 0, 0], RightArm: [-70, 0, 0] },
        { Spine: [30, 0, 0], Neck: [12, 0, 0], LeftUpLeg: [-28, 0, 0], RightUpLeg: [-28, 0, 0], LeftArm: [-75, 0, 0], RightArm: [-75, 0, 0] },
        { Spine: [25, 0, 0], Neck: [10, 0, 0], LeftUpLeg: [-25, 0, 0], RightUpLeg: [-25, 0, 0], LeftArm: [-70, 0, 0], RightArm: [-70, 0, 0] }
      ]
    },
    australianrow: {
      times: DEFAULT_TIMES,
      hips: [-0.08, -0.03, -0.08, -0.03, -0.08],
      poses: [
        { LeftArm: [-10, 0, 0], RightArm: [-10, 0, 0], LeftForeArm: [20, 0, 0], RightForeArm: [20, 0, 0], Spine: [5, 0, 0] },
        { LeftArm: [25, 0, 0], RightArm: [25, 0, 0], LeftForeArm: [-55, 0, 0], RightForeArm: [-55, 0, 0], Spine: [20, 0, 0] },
        { LeftArm: [-10, 0, 0], RightArm: [-10, 0, 0], LeftForeArm: [20, 0, 0], RightForeArm: [20, 0, 0], Spine: [5, 0, 0] },
        { LeftArm: [25, 0, 0], RightArm: [25, 0, 0], LeftForeArm: [-55, 0, 0], RightForeArm: [-55, 0, 0], Spine: [20, 0, 0] },
        { LeftArm: [-10, 0, 0], RightArm: [-10, 0, 0], LeftForeArm: [20, 0, 0], RightForeArm: [20, 0, 0], Spine: [5, 0, 0] }
      ]
    },
    jumpsquat: {
      times: [0, 0.5, 1, 1.5, 2],
      hips: [0, -0.32, 0.22, -0.32, 0],
      poses: [
        { LeftUpLeg: [0, 0, 0], RightUpLeg: [0, 0, 0], LeftLeg: [0, 0, 0], RightLeg: [0, 0, 0], Spine: [0, 0, 0] },
        { LeftUpLeg: [-55, 0, 0], RightUpLeg: [-55, 0, 0], LeftLeg: [80, 0, 0], RightLeg: [80, 0, 0], Spine: [20, 0, 0] },
        { LeftUpLeg: [10, 0, 0], RightUpLeg: [10, 0, 0], LeftLeg: [-5, 0, 0], RightLeg: [-5, 0, 0], Spine: [-10, 0, 0] },
        { LeftUpLeg: [-55, 0, 0], RightUpLeg: [-55, 0, 0], LeftLeg: [80, 0, 0], RightLeg: [80, 0, 0], Spine: [20, 0, 0] },
        { LeftUpLeg: [0, 0, 0], RightUpLeg: [0, 0, 0], LeftLeg: [0, 0, 0], RightLeg: [0, 0, 0], Spine: [0, 0, 0] }
      ]
    },
    glutebridge: {
      times: DEFAULT_TIMES,
      hips: [-0.2, 0.14, -0.2, 0.14, -0.2],
      poses: [
        { LeftUpLeg: [45, 0, 0], RightUpLeg: [45, 0, 0], LeftLeg: [-70, 0, 0], RightLeg: [-70, 0, 0], Spine: [-10, 0, 0] },
        { LeftUpLeg: [35, 0, 0], RightUpLeg: [35, 0, 0], LeftLeg: [-65, 0, 0], RightLeg: [-65, 0, 0], Spine: [15, 0, 0] },
        { LeftUpLeg: [45, 0, 0], RightUpLeg: [45, 0, 0], LeftLeg: [-70, 0, 0], RightLeg: [-70, 0, 0], Spine: [-10, 0, 0] },
        { LeftUpLeg: [35, 0, 0], RightUpLeg: [35, 0, 0], LeftLeg: [-65, 0, 0], RightLeg: [-65, 0, 0], Spine: [15, 0, 0] },
        { LeftUpLeg: [45, 0, 0], RightUpLeg: [45, 0, 0], LeftLeg: [-70, 0, 0], RightLeg: [-70, 0, 0], Spine: [-10, 0, 0] }
      ]
    },
    mountainclimber: {
      times: DEFAULT_TIMES,
      hips: [0, -0.05, 0, -0.05, 0],
      poses: [
        { LeftUpLeg: [35, 0, 0], RightUpLeg: [-10, 0, 0], LeftLeg: [-35, 0, 0], RightLeg: [20, 0, 0], Spine: [5, 0, 0] },
        { LeftUpLeg: [-10, 0, 0], RightUpLeg: [35, 0, 0], LeftLeg: [20, 0, 0], RightLeg: [-35, 0, 0], Spine: [5, 0, 0] },
        { LeftUpLeg: [35, 0, 0], RightUpLeg: [-10, 0, 0], LeftLeg: [-35, 0, 0], RightLeg: [20, 0, 0], Spine: [5, 0, 0] },
        { LeftUpLeg: [-10, 0, 0], RightUpLeg: [35, 0, 0], LeftLeg: [20, 0, 0], RightLeg: [-35, 0, 0], Spine: [5, 0, 0] },
        { LeftUpLeg: [35, 0, 0], RightUpLeg: [-10, 0, 0], LeftLeg: [-35, 0, 0], RightLeg: [20, 0, 0], Spine: [5, 0, 0] }
      ]
    },
    deadbug: {
      times: DEFAULT_TIMES,
      hips: [-0.1, -0.1, -0.1, -0.1, -0.1],
      poses: [
        { LeftArm: [-70, 0, 0], RightArm: [-20, 0, 0], LeftUpLeg: [20, 0, 0], RightUpLeg: [45, 0, 0], LeftLeg: [-35, 0, 0], RightLeg: [-65, 0, 0], Spine: [10, 0, 0] },
        { LeftArm: [-20, 0, 0], RightArm: [-70, 0, 0], LeftUpLeg: [45, 0, 0], RightUpLeg: [20, 0, 0], LeftLeg: [-65, 0, 0], RightLeg: [-35, 0, 0], Spine: [10, 0, 0] },
        { LeftArm: [-70, 0, 0], RightArm: [-20, 0, 0], LeftUpLeg: [20, 0, 0], RightUpLeg: [45, 0, 0], LeftLeg: [-35, 0, 0], RightLeg: [-65, 0, 0], Spine: [10, 0, 0] },
        { LeftArm: [-20, 0, 0], RightArm: [-70, 0, 0], LeftUpLeg: [45, 0, 0], RightUpLeg: [20, 0, 0], LeftLeg: [-65, 0, 0], RightLeg: [-35, 0, 0], Spine: [10, 0, 0] },
        { LeftArm: [-70, 0, 0], RightArm: [-20, 0, 0], LeftUpLeg: [20, 0, 0], RightUpLeg: [45, 0, 0], LeftLeg: [-35, 0, 0], RightLeg: [-65, 0, 0], Spine: [10, 0, 0] }
      ]
    }
  }

  return specs[key] || null
}

export default function createProceduralExerciseClip(model, clipName) {
  const spec = clipSpecFor(clipName)
  if (!spec) return null

  const bones = collectBoneNames(model)
  if (!bones.length) return null

  const tracks = buildTracks({
    bones,
    times: spec.times,
    poses: spec.poses,
    hipsOffsets: spec.hips
  })

  if (!tracks.length) return null
  const duration = spec.times[spec.times.length - 1]
  return new AnimationClip(clipName, duration, tracks)
}
