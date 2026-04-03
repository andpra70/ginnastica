import { useEffect, useMemo } from 'react'
import { useAnimations, useGLTF } from '@react-three/drei'
import useClipPlayback from './useClipPlayback'

export default function GLTFActor({ modelPath, clips = [], config }) {
  const { scene, animations } = useGLTF(modelPath)

  const clipAssetPath = config?.asset
  const clipAsset = useGLTF(clipAssetPath || modelPath)

  const mergedAnimations = useMemo(() => {
    const local = animations || []
    const external = clipAsset?.animations || []
    if (!external.length) return local

    const localByName = new Set(local.map((a) => a.name))
    return [...local, ...external.filter((a) => !localByName.has(a.name))]
  }, [animations, clipAsset?.animations])

  const { actions, mixer } = useAnimations(mergedAnimations, scene)
  useClipPlayback({ actions, clips, config })

  useEffect(() => {
    if (!mixer) return undefined
    return () => mixer.stopAllAction()
  }, [mixer])

  return <primitive object={scene} />
}
