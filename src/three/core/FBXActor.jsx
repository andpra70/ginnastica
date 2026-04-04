import { useEffect, useMemo, useState } from 'react'
import { Box3, Color, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector3 } from 'three'
import { useAnimations, useFBX } from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import useClipPlayback from './useClipPlayback'
import resolveAssetPath from './resolveAssetPath'

const DEFAULT_MAPS = Object.freeze({
  baseColor: null,
  normal: null,
  roughness: null,
  height: null
})

const TEXTURE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']

const TEXTURE_BASE_NAMES = {
  baseColor: 'base_color',
  normal: 'normal',
  roughness: 'roughness',
  height: 'height'
}

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

function disposeMaps(maps) {
  Object.values(maps || {}).forEach((map) => map?.dispose?.())
}

function deriveTextureCandidates(resolvedModelPath, configTextures, textureKey) {
  const explicitPath = configTextures?.[textureKey]
  if (typeof explicitPath === 'string' && explicitPath.trim()) return [resolveAssetPath(explicitPath.trim())]

  const slashIndex = resolvedModelPath.lastIndexOf('/')
  if (slashIndex < 0) return []
  const modelDir = resolvedModelPath.slice(0, slashIndex)
  const textureDir = `${modelDir}/textures`
  const baseName = TEXTURE_BASE_NAMES[textureKey]
  return TEXTURE_EXTENSIONS.map((ext) => `${textureDir}/${baseName}.${ext}`)
}

async function loadFirstTexture(textureLoader, candidates, isColor = false) {
  for (const path of candidates) {
    try {
      const texture = await textureLoader.loadAsync(path)
      configureMap(texture, isColor)
      return texture
    } catch {
      // Try next extension candidate.
    }
  }
  return null
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

  const texturePaths = config?.textures
  const textureLoader = useMemo(() => new TextureLoader(), [])
  const [maps, setMaps] = useState(DEFAULT_MAPS)

  const textureCandidates = useMemo(() => ({
    baseColor: deriveTextureCandidates(resolvedModelPath, texturePaths, 'baseColor'),
    normal: deriveTextureCandidates(resolvedModelPath, texturePaths, 'normal'),
    roughness: deriveTextureCandidates(resolvedModelPath, texturePaths, 'roughness'),
    height: deriveTextureCandidates(resolvedModelPath, texturePaths, 'height')
  }), [
    resolvedModelPath,
    texturePaths?.baseColor,
    texturePaths?.normal,
    texturePaths?.roughness,
    texturePaths?.height
  ])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const loadedMaps = {
        baseColor: await loadFirstTexture(textureLoader, textureCandidates.baseColor, true),
        normal: await loadFirstTexture(textureLoader, textureCandidates.normal),
        roughness: await loadFirstTexture(textureLoader, textureCandidates.roughness),
        height: await loadFirstTexture(textureLoader, textureCandidates.height)
      }

      if (cancelled) {
        disposeMaps(loadedMaps)
        return
      }

      setMaps((currentMaps) => {
        disposeMaps(currentMaps)
        return loadedMaps
      })
    }

    run()
    return () => {
      cancelled = true
    }
  }, [textureLoader, textureCandidates])

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

  useEffect(() => () => disposeMaps(maps), [maps])

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

useFBX.preload(resolveAssetPath('/assets3d/actors/man2/man2.fbx'))
useFBX.preload(resolveAssetPath('/assets3d/actors/woman/woman.fbx'))
