import { useEffect, useMemo } from 'react'
import { useAnimations, useGLTF } from '@react-three/drei'
import useClipPlayback from './useClipPlayback'
import resolveAssetPath from './resolveAssetPath'

export default function GLTFActor({ modelPath, clips = [], config, playbackControls }) {
  const resolvedModelPath = useMemo(() => resolveAssetPath(modelPath), [modelPath])
  const { scene, animations } = useGLTF(resolvedModelPath)

  const clipAssetPath = config?.asset
  const resolvedClipAssetPath = useMemo(
    () => resolveAssetPath(clipAssetPath || modelPath),
    [clipAssetPath, modelPath]
  )
  const clipAsset = useGLTF(resolvedClipAssetPath)

  const mergedAnimations = useMemo(() => {
    const local = animations || []
    const external = clipAsset?.animations || []
    if (!external.length) return local

    const localByName = new Set(local.map((a) => a.name))
    return [...local, ...external.filter((a) => !localByName.has(a.name))]
  }, [animations, clipAsset?.animations])

  const { actions, mixer } = useAnimations(mergedAnimations, scene)
  useClipPlayback({ actions, clips, config, controls: playbackControls })

  useEffect(() => {
    if (!mixer) return undefined
    return () => mixer.stopAllAction()
  }, [mixer])

  return <primitive object={scene} />
}
