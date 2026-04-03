import { Suspense, useCallback, useRef } from 'react'
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
  )
}
