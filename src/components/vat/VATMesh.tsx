import * as THREE from 'three'
import { useEffect, useRef, forwardRef } from 'react'
import { useThree } from '@react-three/fiber'
import CustomShaderMaterial from 'three-custom-shader-material/vanilla'
import { VATMeshProps } from './types'
import { extractGeometryFromScene, createVATMesh } from './utils'
import {
  useVATMaterialControls,
  useShaderCodeKey,
  useUpdateCustomUniforms,
  useUpdateMaterialProperties,
  useVATFrame,
  useStableRef,
} from './hooks'

export const VATMesh = forwardRef<THREE.Group, VATMeshProps>(function VATMesh({
  scene,
  posTex,
  nrmTex = null,
  metaData,
  vatSpeed = 1,
  paused = false,
  useDepthMaterial = true,
  frameRatio,
  id,
  shaders,
  customUniforms,
  meshConfig,
  materialConfig,
  ...rest
}: VATMeshProps, ref) {
  // Shared hooks
  const materialControls = useVATMaterialControls('VAT.Material', materialConfig)
  const shaderCodeKey = useShaderCodeKey(shaders)
  const meshConfigRef = useStableRef(meshConfig)
  const customUniformsRef = useStableRef(customUniforms)

  const groupRef = useRef<THREE.Group>(null!)
  const materialsRef = useRef<CustomShaderMaterial[]>([])
  const vatMeshRef = useRef<THREE.Mesh | null>(null)
  const { scene: r3fScene } = useThree()

  // Create VAT mesh (only when shader code changes)
  useEffect(() => {
    // Remove old mesh if exists
    if (vatMeshRef.current && groupRef.current) {
      groupRef.current.remove(vatMeshRef.current)
      vatMeshRef.current.geometry.dispose()
    }

    // Extract geometry from scene
    const geometry = extractGeometryFromScene(scene)
    if (!geometry) {
      console.error('VATMesh: Could not extract geometry from scene')
      return
    }

    const { mesh, materials } = createVATMesh(
      geometry,
      posTex,
      nrmTex,
      r3fScene.environment,
      metaData,
      materialControls,
      useDepthMaterial,
      shaders,
      customUniformsRef.current,
      meshConfigRef.current
    )

    materialsRef.current = materials
    vatMeshRef.current = mesh

    if (groupRef.current) {
      groupRef.current.add(mesh)
    }

    return () => {
      if (vatMeshRef.current && groupRef.current) {
        groupRef.current.remove(vatMeshRef.current)
        vatMeshRef.current.geometry.dispose()
      }
    }
  }, [scene, posTex, nrmTex, metaData, useDepthMaterial, shaderCodeKey, r3fScene.environment])

  // Shared update hooks
  useUpdateCustomUniforms(materialsRef, customUniforms)
  useUpdateMaterialProperties(materialsRef, materialControls)
  useVATFrame(materialsRef, metaData, vatSpeed, frameRatio, paused)

  return (
    <group ref={ref || groupRef} {...rest} />
  )
})
