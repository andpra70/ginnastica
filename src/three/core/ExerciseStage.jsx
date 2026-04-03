import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, OrbitControls } from '@react-three/drei'
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

export default function ExerciseStage({ cardId, cameraView, onCameraSaved, clipName, onClipSelected, onClipOptions }) {
  const cfg = animationCfg.default || {}
  const controlsRef = useRef(null)
  const scopedStorageKey = `ginnastica.camera.card.${cardId || 'default'}`
  const [showFbxJson, setShowFbxJson] = useState(false)
  const [fbxDebug, setFbxDebug] = useState(null)
  const [selectedClipName, setSelectedClipName] = useState(clipName || cfg.clip || '')

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
    onClipOptions?.(clipNames)
  }, [clipNames, onClipOptions])

  useEffect(() => {
    setSelectedClipName(clipName || cfg.clip || '')
  }, [clipName, cfg.clip, cardId])

  useEffect(() => {
    if (!clipNames.length) return
    if (clipNames.includes(selectedClipName)) return
    const preferred = clipNames.includes(clipName) ? clipName : (clipNames.includes(cfg.clip) ? cfg.clip : clipNames[0])
    setSelectedClipName(preferred)
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
    if (!controls || !resolvedView) return
    controls.object.position.set(...resolvedView.camera)
    controls.target.set(...resolvedView.target)
    controls.update()
  }, [resolvedView, cardId])

  const persistCameraView = useCallback((event) => {
    const camera = event?.target?.object
    const target = event?.target?.target
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
    onCameraSaved?.(payload)
  }, [scopedStorageKey, cardId, onCameraSaved])

  return (
    <div className="figure-panel">
      <div className="figure-card figure-card-3d">
        <Canvas camera={{ position: resolvedView?.camera || cfg.camera, fov: 44, near: 0.001, far: 2000 }}>
          <color attach="background" args={['#ecf9ff']} />
          <hemisphereLight intensity={cfg.light} groundColor="#8ea0af" />
          <directionalLight position={[3, 4, 3]} intensity={1.2} castShadow />

          <Suspense fallback={null}>
            <Bounds fit clip observe margin={3.2}>
              <group key={cardId || 'viewer'}>
                <ModelActor
                  modelPath={animationCfg.modelAsset}
                  config={cfg}
                  onModelDebug={setFbxDebug}
                  playbackControls={{ clipName: selectedClipName, isPlaying: true }}
                />
              </group>
            </Bounds>
          </Suspense>

          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]} receiveShadow>
            <circleGeometry args={[2.6, 64]} />
            <meshStandardMaterial color="#dcebf2" />
          </mesh>

          <OrbitControls
            ref={controlsRef}
            makeDefault
            target={resolvedView?.target || cfg.target}
            enablePan={false}
            zoomSpeed={-1}
            minDistance={2}
            maxDistance={50}
            onEnd={persistCameraView}
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
                    onClipSelected?.(nextClip)
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
