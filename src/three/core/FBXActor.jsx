import { useEffect, useMemo } from 'react'
import { Color, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three'
import { useAnimations, useFBX } from '@react-three/drei'
import useClipPlayback from './useClipPlayback'

function applyPbrTextures(model, maps) {
  model.traverse((node) => {
    if (!node.isMesh) return

    node.castShadow = true
    node.receiveShadow = true

    const material = node.material
    if (!material) return

    material.color = new Color('#ffffff')
    material.map = maps.baseColor
    material.normalMap = maps.normal
    material.roughnessMap = maps.roughness
    material.displacementMap = maps.height
    material.displacementScale = 0.002
    material.roughness = 0.85
    material.metalness = 0
    material.needsUpdate = true
  })
}

function configureMap(texture, isColor = false) {
  if (!texture) return
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.flipY = true
  if (isColor) texture.colorSpace = SRGBColorSpace
}

export default function FBXActor({ modelPath, clips = [], config }) {
  const model = useFBX(modelPath)

  const clipAssetPath = config?.asset
  const clipAsset = useFBX(clipAssetPath || modelPath)

  const texturePaths = config?.textures || {}
  const textureList = [
    texturePaths.baseColor,
    texturePaths.normal,
    texturePaths.roughness,
    texturePaths.height
  ]

  const [baseColor, normal, roughness, height] = useMemo(
    () => textureList,
    [texturePaths.baseColor, texturePaths.normal, texturePaths.roughness, texturePaths.height]
  )

  const textures = new TextureLoader().load.bind(new TextureLoader())

  const maps = useMemo(() => {
    const base = baseColor ? textures(baseColor) : null
    const norm = normal ? textures(normal) : null
    const rough = roughness ? textures(roughness) : null
    const h = height ? textures(height) : null

    configureMap(base, true)
    configureMap(norm)
    configureMap(rough)
    configureMap(h)

    return { baseColor: base, normal: norm, roughness: rough, height: h }
  }, [textures, baseColor, normal, roughness, height])

  const mergedAnimations = useMemo(() => {
    const local = model.animations || []
    const external = clipAsset?.animations || []
    if (!external.length) return local

    const localByName = new Set(local.map((a) => a.name))
    return [...local, ...external.filter((a) => !localByName.has(a.name))]
  }, [model.animations, clipAsset?.animations])

  const { actions, mixer } = useAnimations(mergedAnimations, model)
  useClipPlayback({ actions, clips, config })

  useEffect(() => {
    applyPbrTextures(model, maps)
  }, [model, maps])

  useEffect(() => {
    if (!mixer) return undefined
    return () => mixer.stopAllAction()
  }, [mixer])

  return <primitive object={model} />
}

useFBX.preload('/ginnastica/assets3d/Man2.fbx')
