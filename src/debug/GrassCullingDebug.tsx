import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import * as THREE from 'three/webgpu'
import GrassWebGPU from '../grass/GrassWebGPU'
import { Terrain } from '../terrain/Terrain'

/**
 * Debug component for testing grass culling
 * 
 * Features:
 * - God Camera: Free camera controlled by OrbitControls (what you see)
 * - Player Camera: Simulated player camera that controls culling (yellow frustum)
 * - CameraHelper: Visualizes the player camera's frustum
 * 
 * Usage:
 * Replace <GrassWebGPU /> in your scene with <GrassCullingDebug />
 */
export function GrassCullingDebug() {
  const [terrainUniforms, setTerrainUniforms] = useState<{
    uTerrainAmp: any
    uTerrainFreq: any
    uTerrainSeed: any
    uColor: any
  } | undefined>(undefined)

  // Player camera (used for culling calculation)
  const playerCameraRef = useRef<THREE.PerspectiveCamera>(null!)
  const helperRef = useRef<THREE.CameraHelper | null>(null)

  // Initialize player camera
  useEffect(() => {
    if (!playerCameraRef.current) {
      playerCameraRef.current = new THREE.PerspectiveCamera(50, 1, 0.1, 50)
      playerCameraRef.current.position.set(0, 5, 20)
      playerCameraRef.current.lookAt(0, 0, 0)
    }

    // Create camera helper
    if (playerCameraRef.current && !helperRef.current) {
      helperRef.current = new THREE.CameraHelper(playerCameraRef.current)
    }

    return () => {
      helperRef.current?.dispose()
    }
  }, [])

  // Animate player camera to simulate player movement
  useFrame(({ clock, viewport }) => {
    if (playerCameraRef.current) {
      const t = clock.getElapsedTime() * 0.5
      // Make player camera orbit around the scene
      const radius = 20
      const height = 5
      playerCameraRef.current.position.set(
        Math.sin(t) * radius,
        height,
        Math.cos(t) * radius
      )
      playerCameraRef.current.lookAt(0, 0, 0)
      // Update aspect ratio based on viewport
      playerCameraRef.current.aspect = viewport.width / viewport.height
      playerCameraRef.current.updateProjectionMatrix()
      playerCameraRef.current.updateMatrixWorld()

      // Update helper
      if (helperRef.current) {
        helperRef.current.update()
      }
    }
  })

  return (
    <>
      {/* God Camera: Free camera controlled by OrbitControls (what you see) */}
      <CameraControls makeDefault dollySpeed={0.5} />

      {/* Visualize player camera frustum (yellow wireframe) */}
      {helperRef.current && <primitive object={helperRef.current} />}


      {/* Grass system uses player camera for culling */}
      <GrassWebGPU 
        cullCamera={playerCameraRef.current}
      />

      {/* Grid helper for reference */}
      {/* <gridHelper args={[100, 100]} /> */}
    </>
  )
}
