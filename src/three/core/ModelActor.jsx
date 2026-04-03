import FBXActor from './FBXActor'
import GLTFActor from './GLTFActor'

export default function ModelActor({ modelPath, clips = [], config }) {
  const lower = modelPath.toLowerCase()

  if (lower.endsWith('.fbx')) {
    return <FBXActor modelPath={modelPath} clips={clips} config={config} />
  }

  return <GLTFActor modelPath={modelPath} clips={clips} config={config} />
}
