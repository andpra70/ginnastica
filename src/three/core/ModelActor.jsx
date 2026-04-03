import { useEffect } from 'react'
import FBXActor from './FBXActor'
import GLTFActor from './GLTFActor'

export default function ModelActor({ modelPath, config, onModelDebug, playbackControls }) {
  const lower = modelPath.toLowerCase()
  const isFbx = lower.endsWith('.fbx')

  useEffect(() => {
    if (!isFbx && onModelDebug) onModelDebug(null)
  }, [isFbx, onModelDebug])

  if (isFbx) {
    return (
      <FBXActor
        modelPath={modelPath}
        config={config}
        onModelDebug={onModelDebug}
        playbackControls={playbackControls}
      />
    )
  }

  return <GLTFActor modelPath={modelPath} config={config} playbackControls={playbackControls} />
}
