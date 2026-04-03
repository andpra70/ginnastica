import { useEffect, useMemo } from 'react'
import { Box3, Color, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector3 } from 'three'
import { useAnimations, useFBX } from '@react-three/drei'
import useClipPlayback from './useClipPlayback'
import resolveAssetPath from './resolveAssetPath'

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

function normalizeModelPose(model) {
  const box = new Box3().setFromObject(model)
  if (box.isEmpty()) return

  const size = new Vector3()
  const center = new Vector3()
  box.getSize(size)

  // Some FBX assets are authored as Z-up: rotate once so camera and controls use Y-up.
  if (size.z > size.y * 1.15) {
    model.rotation.x = -Math.PI / 2
    model.updateMatrixWorld(true)
    box.setFromObject(model)
  }

  box.getCenter(center)
  model.position.x -= center.x
  model.position.z -= center.z
  model.position.y -= box.min.y
}

export default function FBXActor({ modelPath, clips = [], config }) {
  const resolvedModelPath = useMemo(() => resolveAssetPath(modelPath), [modelPath])
  const model = useFBX(resolvedModelPath)

  const clipAssetPath = config?.asset
  const resolvedClipAssetPath = useMemo(
    () => resolveAssetPath(clipAssetPath || modelPath),
    [clipAssetPath, modelPath]
  )
  const clipAsset = useFBX(resolvedClipAssetPath)

  const texturePaths = config?.textures || {}
  const textureList = [
    texturePaths.baseColor,
    texturePaths.normal,
    texturePaths.roughness,
    texturePaths.height
  ]

  const [baseColor, normal, roughness, height] = useMemo(
    () => textureList.map((path) => resolveAssetPath(path)),
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
    normalizeModelPose(model)
    applyPbrTextures(model, maps)
  }, [model, maps])

  useEffect(() => {
    if (!mixer) return undefined
    return () => mixer.stopAllAction()
  }, [mixer])

  return <primitive object={model} />
}

useFBX.preload(resolveAssetPath('/assets3d/Man2.fbx'))
