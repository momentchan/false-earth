import * as THREE from 'three'
import { useEffect, useRef, forwardRef } from 'react'
import { useThree } from '@react-three/fiber'
import CustomShaderMaterial from 'three-custom-shader-material/vanilla'
import { VATMeshProps } from './types'
import { extractGeometryFromScene, createVATInstancedMesh } from './utils'
import {
  useVATMaterialControls,
  useShaderCodeKey,
  useUpdateCustomUniforms,
  useUpdateMaterialProperties,
  useStableRef,
} from './hooks'

export interface VATInstancedMeshProps extends Omit<VATMeshProps, 'id'> {
  count: number
  positions?: Float32Array
  rotations?: Float32Array
  scales?: Float32Array
  frameTexture?: THREE.Texture // Optional: frame texture from useFrameCompute hook
}

export const VATInstancedMesh = forwardRef<THREE.Group, VATInstancedMeshProps>(function VATInstancedMesh({
  scene,
  posTex,
  nrmTex = null,
  metaData,
  vatSpeed = 1,
  paused = false,
  useDepthMaterial = true,
  frameRatio,
  count,
  positions,
  rotations,
  scales,
  shaders,
  customUniforms,
  meshConfig,
  materialConfig,
  frameTexture,
  ...rest
}: VATInstancedMeshProps, ref) {
  // Shared hooks
  const materialControls = useVATMaterialControls('VAT.Instanced.Material', materialConfig)
  const shaderCodeKey = useShaderCodeKey(shaders)
  const meshConfigRef = useStableRef(meshConfig)
  const customUniformsRef = useStableRef(customUniforms)

  const groupRef = useRef<THREE.Group>(null!)
  const materialsRef = useRef<CustomShaderMaterial[]>([])
  const instancedMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const dummyRef = useRef<THREE.Object3D>(new THREE.Object3D())
  const { scene: r3fScene } = useThree()

  // Create VAT instanced mesh (only when shader code changes)
  useEffect(() => {
    // Remove old instances if exist
    if (instancedMeshRef.current && groupRef.current) {
      groupRef.current.remove(instancedMeshRef.current)
      instancedMeshRef.current.dispose()
    }

    // Extract geometry from scene
    const geometry = extractGeometryFromScene(scene)
    if (!geometry) {
      console.error('VATInstancedMesh: Could not extract geometry from scene')
      return
    }

    // Create instanced mesh
    const { instancedMesh, materials } = createVATInstancedMesh(
      geometry,
      posTex,
      nrmTex,
      r3fScene.environment,
      metaData,
      materialControls,
      count,
      useDepthMaterial,
      shaders,
      customUniformsRef.current,
      meshConfigRef.current
    )

    materialsRef.current = materials
    instancedMeshRef.current = instancedMesh

    // Set instance matrices
    for (let i = 0; i < count; i++) {
      const x = positions ? positions[i * 3] : 0
      const y = positions ? positions[i * 3 + 1] : 0
      const z = positions ? positions[i * 3 + 2] : 0

      dummyRef.current.position.set(x, y, z)

      if (rotations) {
        dummyRef.current.rotation.set(rotations[i * 3], rotations[i * 3 + 1], rotations[i * 3 + 2])
      }

      if (scales) {
        dummyRef.current.scale.set(scales[i * 3], scales[i * 3 + 1], scales[i * 3 + 2])
      }

      dummyRef.current.updateMatrix()
      instancedMesh.setMatrixAt(i, dummyRef.current.matrix)
    }

    instancedMesh.instanceMatrix.needsUpdate = true

    if (groupRef.current) {
      groupRef.current.add(instancedMesh)
    }

    return () => {
      if (instancedMeshRef.current && groupRef.current) {
        groupRef.current.remove(instancedMeshRef.current)
        instancedMeshRef.current.dispose()
      }
    }
  }, [scene, posTex, nrmTex, metaData, useDepthMaterial, count, positions, rotations, scales, shaderCodeKey, r3fScene.environment])

  // Update frame texture uniform on materials
  useEffect(() => {
    if (!frameTexture) return
    
    for (const material of materialsRef.current) {
      if (material.uniforms) {
        if (!material.uniforms.uFrameTexture) {
          material.uniforms.uFrameTexture = { value: null }
        }
        material.uniforms.uFrameTexture.value = frameTexture
        material.uniforms.uInstanceCount = { value: count }
        material.needsUpdate = true
      }
    }
  }, [frameTexture, count])
  
  // Shared update hooks
  useUpdateCustomUniforms(materialsRef, customUniforms)
  useUpdateMaterialProperties(materialsRef, materialControls)

  return (
    <group ref={ref || groupRef} {...rest} />
  )
})

