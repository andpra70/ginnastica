import { useEffect, useMemo } from 'react'
import { Box3, Color, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector3 } from 'three'
import { useAnimations, useFBX } from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
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
  model.rotation.set(0, 0, 0)
  model.position.set(0, 0, 0)
  model.scale.set(1, 1, 1)
  model.updateMatrixWorld(true)

  const initialBox = new Box3().setFromObject(model)
  if (initialBox.isEmpty()) return

  const size = new Vector3()
  initialBox.getSize(size)
  const maxAxis = Math.max(size.x, size.y, size.z, 1e-6)
  const targetBoxSize = 10
  const uniformScale = targetBoxSize / maxAxis
  model.scale.setScalar(uniformScale)
  model.updateMatrixWorld(true)

  const centeredBox = new Box3().setFromObject(model)
  const center = new Vector3()
  centeredBox.getCenter(center)
  model.position.sub(center)
  model.updateMatrixWorld(true)
}

function buildNodeTree(node) {
  return {
    name: node.name || '',
    type: node.type || 'Object3D',
    children: (node.children || []).map(buildNodeTree)
  }
}

function summarizeFbx(model, animations, info) {
  const bones = []
  let meshCount = 0
  model.traverse((node) => {
    if (node.isBone) bones.push(node.name)
    if (node.isMesh) meshCount += 1
  })

  return {
    modelAsset: info.modelAsset,
    animationAsset: info.animationAsset,
    meshCount,
    boneCount: bones.length,
    bones,
    clips: (animations || []).map((clip) => ({
      name: clip.name,
      duration: Number((clip.duration || 0).toFixed(3)),
      tracks: clip.tracks?.length || 0
    })),
    hierarchy: buildNodeTree(model)
  }
}

export default function FBXActor({ modelPath, config, onModelDebug, playbackControls }) {
  const resolvedModelPath = useMemo(() => resolveAssetPath(modelPath), [modelPath])
  const sourceModel = useFBX(resolvedModelPath)
  const model = useMemo(() => cloneSkeleton(sourceModel), [sourceModel])

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

  const textureLoader = useMemo(() => new TextureLoader(), [])

  const maps = useMemo(() => {
    const base = baseColor ? textureLoader.load(baseColor) : null
    const norm = normal ? textureLoader.load(normal) : null
    const rough = roughness ? textureLoader.load(roughness) : null
    const h = height ? textureLoader.load(height) : null

    configureMap(base, true)
    configureMap(norm)
    configureMap(rough)
    configureMap(h)

    return { baseColor: base, normal: norm, roughness: rough, height: h }
  }, [textureLoader, baseColor, normal, roughness, height])

  const mergedAnimations = useMemo(() => {
    const local = model.animations || []
    const external = clipAsset?.animations || []
    const merged = [...local]
    const localByName = new Set(local.map((a) => a.name))
    if (external.length) {
      for (const clip of external) {
        if (localByName.has(clip.name)) continue
        merged.push(clip)
        localByName.add(clip.name)
      }
    }

    return merged
  }, [model, model.animations, clipAsset?.animations])

  const { actions, mixer } = useAnimations(mergedAnimations, model)
  useClipPlayback({ actions, config, controls: playbackControls })

  useEffect(() => {
    normalizeModelPose(model)
    applyPbrTextures(model, maps)
  }, [model, maps])

  useEffect(() => {
    if (!mixer) return undefined
    return () => mixer.stopAllAction()
  }, [mixer])

  const debugPayload = useMemo(
    () => summarizeFbx(model, mergedAnimations, { modelAsset: resolvedModelPath, animationAsset: resolvedClipAssetPath }),
    [model, mergedAnimations, resolvedModelPath, resolvedClipAssetPath]
  )

  useEffect(() => {
    if (!onModelDebug) return
    onModelDebug(debugPayload)
  }, [onModelDebug, debugPayload])

  return <primitive object={model} />
}

useFBX.preload(resolveAssetPath('/assets3d/Man2.fbx'))
useFBX.preload(resolveAssetPath('/assets3d/claudia/Woman.fbx'))
