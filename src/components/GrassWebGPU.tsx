import { useEffect, useRef } from 'react'
import { useControls } from 'leva'
import { useFrame, useThree } from '@react-three/fiber'
import { DEFAULT_PATCH_SIZE } from './grass/constants'
import { WebGPURenderer } from 'three/webgpu'
import * as THREE from 'three/webgpu'
import { createGrassControls } from './grass/controls'
import { useGrassSetup, useGrassUniforms } from './grass/hooks'
import type { GrassProps } from './grass/types'



export default function GrassWebGPU({ terrainParams, patchSize: initialPatchSize = DEFAULT_PATCH_SIZE }: GrassProps = {} as GrassProps) {
  const { gl, scene } = useThree()

  const [grassParams] = useControls('Grass', () => createGrassControls({ initialPatchSize }), { collapsed: true })

  const {
    grassComputeRef,
    computeUniformsRef,
    materialUniformsRef,
    materialRef,
  } = useGrassSetup({
    grassParams,
    terrainParams,
  })

  useGrassUniforms({
    grassParams,
    terrainParams,
    computeUniformsRef,
    materialUniformsRef,
    materialRef,
  })


  // Cache light reference to avoid searching scene every frame
  const lightRef = useRef<THREE.DirectionalLight | null>(null)
  const lightPosRef = useRef(new THREE.Vector3())
  const targetPosRef = useRef(new THREE.Vector3())
  const lightDirRef = useRef(new THREE.Vector3())

  // Find and cache light reference once
  useEffect(() => {
    const light = scene.children.find((child) => child.type === 'DirectionalLight') as THREE.DirectionalLight | undefined
    if (light) {
      lightRef.current = light
    }
  }, [scene])

  useFrame(({ clock }) => {
    const renderer = gl as unknown as WebGPURenderer
    if (!grassComputeRef.current || !computeUniformsRef.current) return

    const elapsedTime = clock.getElapsedTime()

    // Update windTime based on elapsed time
    computeUniformsRef.current.uWindTime.value = elapsedTime

    // Update material wind time uniform and light uniforms
    if (materialUniformsRef.current) {
      materialUniformsRef.current.uWindTime.value = elapsedTime

      // Update light direction and color from scene
      const light = lightRef.current
      if (light) {
        // Calculate light direction
        light.getWorldPosition(lightPosRef.current)
        light.target.getWorldPosition(targetPosRef.current)
        lightDirRef.current.subVectors(targetPosRef.current, lightPosRef.current).normalize()
        materialUniformsRef.current.uLightDirection.value.set(
          lightDirRef.current.x,
          lightDirRef.current.y,
          lightDirRef.current.z
        )

        // Update light color
        const color = light.color
        materialUniformsRef.current.uLightColor.value.set(color.r, color.g, color.b)
      }
    }

    renderer.compute(grassComputeRef.current)
  })

  return null
}
