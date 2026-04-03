import { useEffect } from 'react'
import FBXActor from './FBXActor'
import GLTFActor from './GLTFActor'

export default function ModelActor({ modelPath, clips = [], config, onModelDebug, playbackControls }) {
  const lower = modelPath.toLowerCase()
  const isFbx = lower.endsWith('.fbx')

  useEffect(() => {
    if (!isFbx && onModelDebug) onModelDebug(null)
  }, [isFbx, onModelDebug])

  if (isFbx) {
    return (
      <FBXActor
        modelPath={modelPath}
        clips={clips}
        config={config}
        onModelDebug={onModelDebug}
        playbackControls={playbackControls}
      />
    )
  }

  return <GLTFActor modelPath={modelPath} clips={clips} config={config} playbackControls={playbackControls} />
}
