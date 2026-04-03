import { Suspense, useRef } from 'react'
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
        />
      </Canvas>
    </div>
  )
}
