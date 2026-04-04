import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, OrbitControls, useBounds } from '@react-three/drei'
import { Vector3 } from 'three'
import ModelActor from './ModelActor'

const DEFAULT_STAGE_CONFIG = {
  modelAsset: '/assets3d/actors/man2/man2.fbx',
  default: {
    playbackRate: 1,
    loop: 'repeat',
    camera: [2.1, 1.6, 3.0],
    target: [0, 1.0, 0],
    light: 1.1
  }
}

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

function BoundsAutoFit({ request }) {
  const bounds = useBounds()

  useEffect(() => {
    if (!request?.seq) return
    // Fit first, then recompute clip planes; finally enlarge near/far a bit
    // so animated limbs don't get clipped at the frustum edges.
    const result = bounds.refresh().fit().clip()
    const camera = result?.camera
    if (camera) {
      camera.near = Math.max(0.001, camera.near * 0.5)
      camera.far = Math.max(camera.near + 1, camera.far * 1.5)
      camera.updateProjectionMatrix()
    }
  }, [request, bounds])

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
  modelAsset,
  modelOptions,
  onModelAssetSelected
}) {
  const cfg = DEFAULT_STAGE_CONFIG.default || {}
  const viewerHostRef = useRef(null)
  const normalizedModelOptions = useMemo(
    () => (Array.isArray(modelOptions) ? modelOptions.filter((value) => typeof value === 'string' && value.endsWith('.fbx')) : []),
    [modelOptions]
  )
  const fallbackModel = normalizedModelOptions[0] || DEFAULT_STAGE_CONFIG.modelAsset
  const selectedModel = modelAsset && modelAsset.endsWith('.fbx') ? modelAsset : fallbackModel
  const modelAssetPath = selectedModel
  const renderCfg = cfg
  const controlsRef = useRef(null)
  const onCameraSavedRef = useRef(onCameraSaved)
  const onClipSelectedRef = useRef(onClipSelected)
  const onClipOptionsRef = useRef(onClipOptions)
  const previousModelRef = useRef(null)
  const previousCardIdRef = useRef(cardId || null)
  const skipNextModelAutofitRef = useRef(false)
  const shouldAutoPickFirstClipRef = useRef(false)
  const scopedStorageKey = `ginnastica.camera.card.${cardId || 'default'}`
  const [showFbxJson, setShowFbxJson] = useState(false)
  const [fbxDebug, setFbxDebug] = useState(null)
  const [selectedClipName, setSelectedClipName] = useState(clipName || cfg.clip || '')
  const [autoFitRequest, setAutoFitRequest] = useState({ seq: 0 })

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
    const normalizedCardId = cardId || null
    if (previousCardIdRef.current === normalizedCardId) return
    previousCardIdRef.current = normalizedCardId
    skipNextModelAutofitRef.current = true
  }, [cardId])

  useEffect(() => {
    if (previousModelRef.current == null) {
      previousModelRef.current = selectedModel
      return
    }
    if (previousModelRef.current === selectedModel) return
    previousModelRef.current = selectedModel
    shouldAutoPickFirstClipRef.current = true
    setSelectedClipName('')
    setFbxDebug(null)
    if (skipNextModelAutofitRef.current) {
      skipNextModelAutofitRef.current = false
      return
    }
    setAutoFitRequest((prev) => ({ seq: prev.seq + 1 }))
  }, [selectedModel])

  useEffect(() => {
    setSelectedClipName(clipName || cfg.clip || '')
  }, [clipName, cfg.clip, cardId])

  useEffect(() => {
    if (!shouldAutoPickFirstClipRef.current) return
    if (!clipNames.length) return
    const firstClip = clipNames[0]
    shouldAutoPickFirstClipRef.current = false
    setSelectedClipName(firstClip)
    onClipSelectedRef.current?.(firstClip)
  }, [clipNames])

  useEffect(() => {
    if (!clipNames.length) return
    if (!selectedClipName) return
    if (clipNames.includes(selectedClipName)) return
    setSelectedClipName('')
    onClipSelectedRef.current?.('')
  }, [clipNames, selectedClipName])

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
            <Bounds margin={3.2}>
              <BoundsAutoFit request={autoFitRequest} />
              <group key={`${cardId || 'viewer'}:${selectedModel}`}>
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
                Modello FBX
                <select
                  value={selectedModel}
                  onChange={(event) => onModelAssetSelected?.(event.target.value)}
                  disabled={!normalizedModelOptions.length}
                >
                  {(normalizedModelOptions.length ? normalizedModelOptions : [fallbackModel]).map((path) => (
                    <option key={path} value={path}>{path.split('/').pop()}</option>
                  ))}
                </select>
              </label>
              <label>
                Clip FBX
                <select
                  value={selectedClipName}
                  onChange={(event) => {
                    const nextClip = event.target.value
                    setSelectedClipName(nextClip)
                    onClipSelectedRef.current?.(nextClip)
                  }}
                >
                  <option value="">Scegli...</option>
                  {clipNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="fbx-autofit-btn"
                title="AutoFit camera"
                aria-label="AutoFit camera"
                onClick={() => setAutoFitRequest((prev) => ({ seq: prev.seq + 1 }))}
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
