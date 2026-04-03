import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, OrbitControls, useBounds } from '@react-three/drei'
import { Vector3 } from 'three'
import ModelActor from './ModelActor'
import animationCfg from '../../config/exerciseAnimations.json'

function normalizeView(raw) {
  if (!raw || typeof raw !== 'object') return null
  const camera = Array.isArray(raw.camera) ? raw.camera.map(Number) : null
  const target = Array.isArray(raw.target) ? raw.target.map(Number) : null
  if (!camera || !target || camera.length !== 3 || target.length !== 3) return null
  if (![...camera, ...target].every((v) => Number.isFinite(v))) return null
  return {
    camera: camera.map((v) => Number(v.toFixed(3))),
    target: target.map((v) => Number(v.toFixed(3)))
  }
}

function BoundsAutoFit({ signal }) {
  const bounds = useBounds()

  useEffect(() => {
    if (!signal) return
    bounds.refresh().clip().fit()
  }, [signal, bounds])

  return null
}

function debugCameraLog(step, payload) {
  // Keep logs concise and searchable in devtools
  console.debug(`[Trainer3D][Camera] ${step}`, payload)
}

export default function ExerciseStage({
  cardId,
  cameraView,
  onCameraSaved,
  clipName,
  onClipSelected,
  onClipOptions,
  theme,
  modelAsset,
  modelOptions,
  onModelAssetSelected
}) {
  const cfg = animationCfg.default || {}
  const viewerHostRef = useRef(null)
  const isFemaleTheme = theme === 'femmina'
  const normalizedModelOptions = useMemo(
    () => (Array.isArray(modelOptions) ? modelOptions.filter((value) => typeof value === 'string' && value.endsWith('.fbx')) : []),
    [modelOptions]
  )
  const fallbackFemaleModel = normalizedModelOptions[0] || '/assets3d/claudia/Woman.fbx'
  const selectedFemaleModel = modelAsset && modelAsset.endsWith('.fbx') ? modelAsset : fallbackFemaleModel
  const modelAssetPath = isFemaleTheme ? selectedFemaleModel : animationCfg.modelAsset
  const renderCfg = useMemo(() => {
    if (!isFemaleTheme) return cfg
    return {
      ...cfg,
      textures: {
        baseColor: '/assets3d/claudia/tex/rp_claudia_rigged_002_dif_opt.jpg',
        normal: '/assets3d/claudia/tex/rp_claudia_rigged_002_norm_opt.jpg',
        roughness: '/assets3d/claudia/tex/rp_claudia_rigged_002_gloss_opt.jpg'
      }
    }
  }, [cfg, isFemaleTheme])
  const controlsRef = useRef(null)
  const onCameraSavedRef = useRef(onCameraSaved)
  const onClipSelectedRef = useRef(onClipSelected)
  const onClipOptionsRef = useRef(onClipOptions)
  const scopedStorageKey = `ginnastica.camera.card.${cardId || 'default'}`
  const [showFbxJson, setShowFbxJson] = useState(false)
  const [fbxDebug, setFbxDebug] = useState(null)
  const [selectedClipName, setSelectedClipName] = useState(clipName || cfg.clip || '')
  const [autoFitSignal, setAutoFitSignal] = useState(0)

  const fbxJson = useMemo(() => {
    if (!fbxDebug) return ''
    return JSON.stringify(fbxDebug, null, 2)
  }, [fbxDebug])
  const isEditMode = useMemo(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('edit') === '1'
  }, [])

  const clipNames = useMemo(
    () => (fbxDebug?.clips || []).map((clip) => clip.name).filter(Boolean),
    [fbxDebug]
  )

  useEffect(() => {
    onCameraSavedRef.current = onCameraSaved
  }, [onCameraSaved])

  useEffect(() => {
    onClipSelectedRef.current = onClipSelected
  }, [onClipSelected])

  useEffect(() => {
    onClipOptionsRef.current = onClipOptions
  }, [onClipOptions])

  useEffect(() => {
    onClipOptionsRef.current?.(clipNames)
  }, [clipNames])

  useEffect(() => {
    setSelectedClipName(clipName || cfg.clip || '')
  }, [clipName, cfg.clip, cardId])

  useEffect(() => {
    if (!clipNames.length) return
    if (clipNames.includes(selectedClipName)) return
    const preferred = clipNames.includes(clipName) ? clipName : (clipNames.includes(cfg.clip) ? cfg.clip : clipNames[0])
    setSelectedClipName(preferred)
    onClipSelectedRef.current?.(preferred)
  }, [clipNames, selectedClipName, cfg.clip, clipName])

  const resolvedView = useMemo(() => {
    const fromProps = normalizeView(cameraView)
    if (fromProps) return fromProps
    if (typeof window === 'undefined') return null

    try {
      const scopedRaw = window.localStorage.getItem(scopedStorageKey)
      if (scopedRaw) {
        const scoped = normalizeView(JSON.parse(scopedRaw))
        if (scoped) return scoped
      }
    } catch {
      // Ignore malformed persisted view
    }
    return null
  }, [cameraView, scopedStorageKey])

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    const nextCamera = resolvedView?.camera || cfg.camera
    const nextTarget = resolvedView?.target || cfg.target
    controls.object.position.set(...nextCamera)
    controls.target.set(...nextTarget)
    controls.update()
    debugCameraLog('apply-view', { cardId, source: resolvedView ? 'resolvedView' : 'default', camera: nextCamera, target: nextTarget })
  }, [resolvedView, cardId, cfg.camera, cfg.target])

  const persistCameraView = useCallback((event, options = {}) => {
    const { notifyParent = true, reason = 'unknown' } = options
    const camera = event?.target?.object || controlsRef.current?.object
    const target = event?.target?.target || controlsRef.current?.target
    if (!camera || !target) return

    const position = [
      Number(camera.position.x.toFixed(3)),
      Number(camera.position.y.toFixed(3)),
      Number(camera.position.z.toFixed(3))
    ]
    const lookAt = [
      Number(target.x.toFixed(3)),
      Number(target.y.toFixed(3)),
      Number(target.z.toFixed(3))
    ]

    const payload = {
      cardId: cardId || null,
      savedAt: new Date().toISOString(),
      camera: position,
      target: lookAt,
      cameraLiteral: `[${position.join(', ')}]`,
      targetLiteral: `[${lookAt.join(', ')}]`
    }

    try {
      localStorage.setItem(scopedStorageKey, JSON.stringify(payload))
      localStorage.setItem('ginnastica.camera.last', JSON.stringify(payload))
    } catch {
      // Ignore storage errors (e.g. privacy mode)
    }
    debugCameraLog('save-view', { cardId, reason, camera: payload.camera, target: payload.target, notifyParent })
    if (notifyParent) onCameraSavedRef.current?.(payload)
  }, [scopedStorageKey, cardId])

  const handleWheelZoomInverted = useCallback((event) => {
    const controls = controlsRef.current
    if (!controls) return
    const camera = controls.object
    const target = controls.target
    if (!camera || !target) return

    event.preventDefault()
    event.stopPropagation()

    const delta = Number(event.deltaY || 0)
    const intensity = Math.min(0.4, Math.abs(delta) * 0.0015)
    if (!Number.isFinite(intensity) || intensity <= 0) return

    // Inverted wheel: scroll up => zoom out, scroll down => zoom in.
    const scaleFactor = delta < 0 ? (1 + intensity) : (1 - intensity)
    const direction = new Vector3().subVectors(camera.position, target)
    const currentDistance = Math.max(1e-6, direction.length())
    const minDistance = Number.isFinite(controls.minDistance) ? controls.minDistance : 0.1
    const maxDistance = Number.isFinite(controls.maxDistance) ? controls.maxDistance : 500
    const nextDistance = Math.min(maxDistance, Math.max(minDistance, currentDistance * scaleFactor))

    direction.setLength(nextDistance)
    camera.position.copy(target).add(direction)
    controls.update()
  }, [])

  useEffect(() => {
    const host = viewerHostRef.current
    if (!host) return undefined

    host.addEventListener('wheel', handleWheelZoomInverted, { passive: false })
    return () => host.removeEventListener('wheel', handleWheelZoomInverted)
  }, [handleWheelZoomInverted])

  return (
    <div className="figure-panel">
      <div className="figure-card figure-card-3d" ref={viewerHostRef}>
        <Canvas camera={{ position: resolvedView?.camera || cfg.camera, fov: 44, near: 0.001, far: 2000 }}>
          <color attach="background" args={['#ecf9ff']} />
          <hemisphereLight intensity={cfg.light} groundColor="#8ea0af" />
          <directionalLight position={[3, 4, 3]} intensity={1.2} castShadow />

          <Suspense fallback={null}>
            <Bounds clip margin={3.2}>
              <BoundsAutoFit signal={autoFitSignal} />
              <group key={cardId || 'viewer'}>
                <ModelActor
                  modelPath={modelAssetPath}
                  config={renderCfg}
                  onModelDebug={setFbxDebug}
                  playbackControls={{ clipName: selectedClipName, isPlaying: true }}
                />
              </group>
            </Bounds>
          </Suspense>

          <OrbitControls
            ref={controlsRef}
            makeDefault
            target={resolvedView?.target || cfg.target}
            enablePan
            screenSpacePanning
            enableZoom={false}
            minDistance={2}
            maxDistance={50}
          />
        </Canvas>
      </div>

      {isEditMode ? (
        <>
          <div className="fbx-debug-tools">
            <div className="fbx-play-controls">
              <label>
                Clip FBX
                <select
                  value={selectedClipName}
                  onChange={(event) => {
                    const nextClip = event.target.value
                    setSelectedClipName(nextClip)
                    onClipSelectedRef.current?.(nextClip)
                  }}
                  disabled={!clipNames.length}
                >
                  {clipNames.length ? (
                    clipNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))
                  ) : (
                    <option value="">Nessuna clip</option>
                  )}
                </select>
              </label>
              {isFemaleTheme ? (
                <label>
                  Modello FBX
                  <select
                    value={selectedFemaleModel}
                    onChange={(event) => onModelAssetSelected?.(event.target.value)}
                    disabled={!normalizedModelOptions.length}
                  >
                    {(normalizedModelOptions.length ? normalizedModelOptions : [fallbackFemaleModel]).map((path) => (
                      <option key={path} value={path}>{path.split('/').pop()}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                className="fbx-autofit-btn"
                title="AutoFit camera"
                aria-label="AutoFit camera"
                onClick={() => setAutoFitSignal((v) => v + 1)}
              >
                ⤢
              </button>
              <button
                type="button"
                className="fbx-saveview-btn"
                title="Salva view scheda"
                aria-label="Salva view scheda"
                onClick={() => persistCameraView(undefined, { notifyParent: true, reason: 'manual-save-view' })}
              >
                ⌖
              </button>
            </div>

            <button type="button" onClick={() => setShowFbxJson((v) => !v)}>
              {showFbxJson ? 'Nascondi Struttura FBX JSON' : 'Mostra Struttura FBX JSON'}
            </button>
          </div>

          {showFbxJson ? (
            <pre className="fbx-debug-json">{fbxJson || 'FBX non ancora caricato...'}</pre>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
