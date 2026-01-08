import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { storage } from 'three/tsl'
import { createBladeGeometry, createPositions, createGrassData, createVisibleIndicesBuffer } from '../geometry'
import { HIGH_DETAIL_SEGMENTS, LOW_DETAIL_SEGMENTS } from '../constants'
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
  const materialLowRef = useRef<THREE.MeshStandardNodeMaterial | null>(null)
  const meshRef = useRef<THREE.Mesh | null>(null)
  const meshLowRef = useRef<THREE.Mesh | null>(null)

  useEffect(() => {
    const lodDistance = grassParams.lodDistance ?? 15.0
    const highDetailSegments = grassParams.highDetailSegments ?? HIGH_DETAIL_SEGMENTS
    const lowDetailSegments = grassParams.lowDetailSegments ?? LOW_DETAIL_SEGMENTS
    
    const bladeGeometryHigh = createBladeGeometry(highDetailSegments)
    const bladeGeometryLow = createBladeGeometry(lowDetailSegments)
    
    const grassBlades = gridSize * gridSize
    const positions = createPositions(gridSize, patchSize)
    const grassData = createGrassData(grassBlades)
    
    // Create LOD buffers: High and Low detail index buffers
    const indicesHigh = createVisibleIndicesBuffer(grassBlades)
    const indicesLow = createVisibleIndicesBuffer(grassBlades)
    
    // Calculate counts for High and Low geometries
    const vertexCountHigh = bladeGeometryHigh.attributes.position.count
    const indexCountHigh = bladeGeometryHigh.index ? bladeGeometryHigh.index.count : vertexCountHigh
    const vertexCountLow = bladeGeometryLow.attributes.position.count
    const indexCountLow = bladeGeometryLow.index ? bladeGeometryLow.index.count : vertexCountLow
    
    // Create indirect draw buffers for High and Low detail
    const drawBufferArrayHigh = new Uint32Array(5)
    const drawBufferHigh = new THREE.IndirectStorageBufferAttribute(drawBufferArrayHigh, 5)
    const drawStorageHigh = storage(drawBufferHigh, drawIndirectStructure, 1)
    bladeGeometryHigh.setIndirect(drawBufferHigh)
    
    const drawBufferArrayLow = new Uint32Array(5)
    const drawBufferLow = new THREE.IndirectStorageBufferAttribute(drawBufferArrayLow, 5)
    const drawStorageLow = storage(drawBufferLow, drawIndirectStructure, 1)
    bladeGeometryLow.setIndirect(drawBufferLow)

    // Create compute shader with LOD support
    const { computeFn, uniforms } = createGrassCompute(
      grassData, 
      positions, 
      // LOD: High and Low buffers
      indicesHigh,
      indicesLow,
      drawStorageHigh,
      drawStorageLow,
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
      // Culling Parameters (always enabled)
      maxCullDistance: grassParams.maxCullDistance ?? 50.0,
      cullOffset: grassParams.bladeHeightMax ?? 0.8,
      // LOD Parameters
      lodDistance: lodDistance
    })
    const grassCompute = computeFn().compute(grassBlades)
    computeUniformsRef.current = uniforms
    grassComputeRef.current = grassCompute

    // Create reset compute shader to reset draw buffers each frame
    // Reset both High and Low buffers
    const resetCompute = createResetDrawBufferCompute(drawStorageHigh, indexCountHigh, drawStorageLow, indexCountLow)
    resetComputeRef.current = resetCompute

    // Find light and create material
    const light = findDirectionalLight(scene)
    const groundColor = terrainParams?.color || '#1a3319'
    const lightDirection = light ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 0, -1) // Default direction
    const lightColor = light ? light.color : new THREE.Color('#ffffff')
    
    // Create materials for High and Low detail
    // High detail material uses indicesHigh buffer
    const { material, uniforms: materialUniforms } = createGrassMaterial(
      grassData, 
      positions, 
      indicesHigh,
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

    // Create Low detail material (shares same uniforms as High detail material)
    const { material: materialLow } = createGrassMaterial(
      grassData,
      positions,
      indicesLow,
      {
        // Share uniforms from High detail material so they stay in sync
        sharedUniforms: materialUniforms,
      }
    )
    materialLowRef.current = materialLow

    // Create meshes and add to scene
    const mesh = new THREE.Mesh(bladeGeometryHigh, material)
    mesh.count = grassBlades
    meshRef.current = mesh
    scene.add(mesh)

    const meshLow = new THREE.Mesh(bladeGeometryLow, materialLow)
    meshLow.count = grassBlades
    meshLowRef.current = meshLow
    scene.add(meshLow)

    if (scene.environment) {
      material.envMap = scene.environment
      materialLow.envMap = scene.environment
    }

    return () => {
      scene.remove(mesh)
      scene.remove(meshLow)
      bladeGeometryHigh.dispose()
      bladeGeometryLow.dispose()
      material.dispose()
      materialLow.dispose()
    }
  }, [gridSize, patchSize, scene, grassParams.lodDistance, grassParams.highDetailSegments, grassParams.lowDetailSegments])

  return {
    grassComputeRef,
    resetComputeRef,
    computeUniformsRef,
    materialUniformsRef,
    materialRef,
    materialLowRef,
    meshRef,
    meshLowRef,
  }
}

