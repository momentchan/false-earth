import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { storage } from 'three/tsl'
import { createBladeGeometry, createPositions, createGrassData, createVisibleIndicesBuffer } from '../geometry'
import { findDirectionalLight } from '../utils/index'
import { createGrassCompute, createResetDrawBufferCompute } from '../compute/grassCompute'
import { createGrassMaterial } from '../materials/grassMaterial'
import { drawIndirectStructure } from '../constants'
import type { TerrainParams } from '../types'

interface UseGrassSetupParams {
  grassParams: any
  terrainParams?: TerrainParams
}

export function useGrassSetup({
  grassParams,
  terrainParams,
}: UseGrassSetupParams) {
  const gridSize = grassParams.gridSize
  const patchSize = grassParams.patchSize
  const { scene } = useThree()

  const grassComputeRef = useRef<any>(null)
  const resetComputeRef = useRef<any>(null)
  const computeUniformsRef = useRef<Record<string, any>>({})
  const materialUniformsRef = useRef<Record<string, any> | null>(null)
  const materialRef = useRef<THREE.MeshStandardNodeMaterial | null>(null)
  const meshRef = useRef<THREE.Mesh | null>(null)

  useEffect(() => {
    // Create geometry and data structures
    const bladeGeometry = createBladeGeometry()
    const grassBlades = gridSize * gridSize
    const positions = createPositions(gridSize, patchSize)
    const grassData = createGrassData(grassBlades)
    
    // Create culling buffers for indirect drawing
    const visibleIndicesBuffer = createVisibleIndicesBuffer(grassBlades)
    const vertexCount = bladeGeometry.attributes.position.count
    
    // Create indirect draw buffer for WebGPU indirect drawing
    // Structure: [vertexCount, instanceCount, firstVertex, firstInstance, baseVertex]
    const drawBuffer = new THREE.IndirectStorageBufferAttribute(
      new Uint32Array(5),
      5
    )
    const drawStorage = storage(drawBuffer, drawIndirectStructure, 1)
    bladeGeometry.setIndirect(drawBuffer)

    // Create compute shader
    const { computeFn, uniforms } = createGrassCompute(
      grassData, 
      positions, 
      visibleIndicesBuffer,
      drawStorage,
      {
      // Shape Parameters
      bladeHeightMin: grassParams.bladeHeightMin,
      bladeHeightMax: grassParams.bladeHeightMax,
      bladeWidthMin: grassParams.bladeWidthMin,
      bladeWidthMax: grassParams.bladeWidthMax,
      bendAmountMin: grassParams.bendAmountMin,
      bendAmountMax: grassParams.bendAmountMax,
      bladeRandomness: grassParams.bladeRandomness,
      // Clump Parameters
      clumpSize: grassParams.clumpSize,
      clumpRadius: grassParams.clumpRadius,
      centerYaw: grassParams.centerYaw,
      bladeYaw: grassParams.bladeYaw,
      clumpYaw: grassParams.clumpYaw,
      typeTrendScale: grassParams.typeTrendScale,
      // Wind Parameters
      windTime: 0.0, // Will be updated in useFrame
      windScale: grassParams.windScale ?? 0.25,
      windSpeed: grassParams.windSpeed,
      windStrength: grassParams.windStrength,
      windDir: { x: grassParams.windDirX, y: grassParams.windDirZ },
      windFacing: grassParams.windFacing,
      // Culling Parameters
      maxCullDistance: grassParams.maxCullDistance ?? 50.0,
      enableCulling: grassParams.enableCulling ?? true,
      cullOffset: grassParams.bladeHeightMax ?? 0.8
    })
    const grassCompute = computeFn().compute(grassBlades)
    computeUniformsRef.current = uniforms
    grassComputeRef.current = grassCompute

    // Create reset compute shader to reset draw buffer each frame
    const resetCompute = createResetDrawBufferCompute(drawStorage, vertexCount)
    resetComputeRef.current = resetCompute

    // Find light and create material
    const light = findDirectionalLight(scene)
    const groundColor = terrainParams?.color || '#1a3319'
    const lightDirection = light ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 0, -1) // Default direction
    const lightColor = light ? light.color : new THREE.Color('#ffffff')
    
    const { material, uniforms: materialUniforms } = createGrassMaterial(
      grassData, 
      positions, 
      visibleIndicesBuffer,
      {
      baseWidth: grassParams.baseWidth,
      tipThin: grassParams.tipThin,
      windTime: 0.0, // Will be updated in useFrame
      windDir: { x: grassParams.windDirX, y: grassParams.windDirZ },
      swayFreqMin: grassParams.swayFreqMin,
      swayFreqMax: grassParams.swayFreqMax,
      swayStrength: grassParams.swayStrength,
      windDistanceStart: grassParams.windDistanceStart,
      windDistanceEnd: grassParams.windDistanceEnd,
      cullStart: grassParams.cullStart,
      cullEnd: grassParams.cullEnd,
      roughness: grassParams.roughness,
      metalness: grassParams.metalness,
      emissive: grassParams.emissive,
      envMapIntensity: grassParams.envMapIntensity,
      midSoft: grassParams.midSoft,
      rimPos: grassParams.rimPos,
      rimSoft: grassParams.rimSoft,
      // Color uniforms
      baseColor: grassParams.baseColor,
      tipColor: grassParams.tipColor,
      groundColor: groundColor,
      bladeSeedRange: grassParams.bladeSeedRange,
      clumpSeedRange: grassParams.clumpSeedRange,
      aoPower: grassParams.aoPower,
      // Lighting uniforms
      lightDirection: lightDirection,
      lightColor: lightColor,
      lightBackStrength: grassParams.backLightStrength,
      // Noise uniforms
      noiseParams: {
        x: grassParams.noiseFreqX,
        y: grassParams.noiseFreqY,
        z: grassParams.noiseRemapMin,
        w: grassParams.noiseRemapMax,
      },
    })
    materialUniformsRef.current = materialUniforms
    materialRef.current = material

    // Create mesh and add to scene
    const mesh = new THREE.Mesh(bladeGeometry, material)
    mesh.count = grassBlades
    meshRef.current = mesh
    
    scene.add(mesh)

    if (scene.environment) {
      material.envMap = scene.environment
    }

    return () => {
      scene.remove(mesh)
      bladeGeometry.dispose()
      material.dispose()
    }
  }, [gridSize, patchSize, scene])

  return {
    grassComputeRef,
    resetComputeRef,
    computeUniformsRef,
    materialUniformsRef,
    materialRef,
    meshRef,
  }
}

