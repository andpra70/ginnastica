import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, OrbitControls } from '@react-three/drei'
import ModelActor from './ModelActor'
import animationCfg from '../../config/exerciseAnimations.json'

function getCfg(type) {
  return {
    ...animationCfg.default,
    ...(animationCfg[type] ?? {})
  }
}

export default function ExerciseStage({ type, clips }) {
  const cfg = getCfg(type)
  const controlsRef = useRef(null)
  const storageKey = `ginnastica.camera.${type}`
  const [showFbxJson, setShowFbxJson] = useState(false)
  const [fbxDebug, setFbxDebug] = useState(null)
  const [selectedClipName, setSelectedClipName] = useState(cfg.clip || 'Idle')
  const [isPlayingClip, setIsPlayingClip] = useState(true)

  const fbxJson = useMemo(() => {
    if (!fbxDebug) return ''
    return JSON.stringify(fbxDebug, null, 2)
  }, [fbxDebug])

  const clipNames = useMemo(
    () => (fbxDebug?.clips || []).map((clip) => clip.name).filter(Boolean),
    [fbxDebug]
  )

  useEffect(() => {
    if (!clipNames.length) return
    if (clipNames.includes(selectedClipName)) return
    const preferred = clipNames.includes(cfg.clip) ? cfg.clip : clipNames[0]
    setSelectedClipName(preferred)
  }, [clipNames, selectedClipName, cfg.clip])

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
      type,
      savedAt: new Date().toISOString(),
      camera: position,
      target: lookAt,
      cameraLiteral: `[${position.join(', ')}]`,
      targetLiteral: `[${lookAt.join(', ')}]`
    }

    try {
      localStorage.setItem(storageKey, JSON.stringify(payload))
      localStorage.setItem('ginnastica.camera.last', JSON.stringify(payload))
    } catch {
      // Ignore storage errors (e.g. privacy mode)
    }
  }, [storageKey, type])

  return (
    <div className="figure-panel">
      <div className="figure-card figure-card-3d">
        <Canvas camera={{ position: cfg.camera, fov: 44, near: 0.001, far: 2000 }}>
          <color attach="background" args={['#ecf9ff']} />
          <hemisphereLight intensity={cfg.light} groundColor="#8ea0af" />
          <directionalLight position={[3, 4, 3]} intensity={1.2} castShadow />

          <Suspense fallback={null}>
            <Bounds fit clip observe margin={3.2}>
              <group key={type}>
                <ModelActor
                  modelPath={animationCfg.modelAsset}
                  clips={clips}
                  config={cfg}
                  onModelDebug={setFbxDebug}
                  playbackControls={{ clipName: selectedClipName, isPlaying: isPlayingClip }}
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
            target={cfg.target}
            enablePan={false}
            zoomSpeed={-1}
            minDistance={2}
            maxDistance={50}
            onEnd={persistCameraView}
          />
        </Canvas>
      </div>

      <div className="fbx-debug-tools">
        <div className="fbx-play-controls">
          <label>
            Clip FBX
            <select
              value={selectedClipName}
              onChange={(event) => {
                setSelectedClipName(event.target.value)
                setIsPlayingClip(true)
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
          <div className="fbx-play-buttons">
            <button type="button" onClick={() => setIsPlayingClip(true)} disabled={!clipNames.length}>Play</button>
            <button type="button" onClick={() => setIsPlayingClip(false)} disabled={!clipNames.length}>Stop</button>
          </div>
        </div>

        <button type="button" onClick={() => setShowFbxJson((v) => !v)}>
          {showFbxJson ? 'Nascondi Struttura FBX JSON' : 'Mostra Struttura FBX JSON'}
        </button>
      </div>

      {showFbxJson ? (
        <pre className="fbx-debug-json">{fbxJson || 'FBX non ancora caricato...'}</pre>
      ) : null}
    </div>
  )
}
