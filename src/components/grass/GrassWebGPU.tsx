import { useEffect, useRef, useState, useMemo } from 'react'
import { useControls } from 'leva'
import { useFrame, useThree } from '@react-three/fiber'
import { WebGPURenderer } from 'three/webgpu'
import * as THREE from 'three/webgpu'
import { storage, uniform, vec2, vec3, vec4 } from 'three/tsl'
import { DEFAULT_BLADES_PER_AXIS, DEFAULT_GRASS_AREA_SIZE, DEFAULT_GRID_DIVISIONS, DEFAULT_LOD_SEGMENTS_CONFIG, drawIndirectStructure } from './core/constants'
import { createGrassControls } from './core/grassControls'
import { createPositions, createGrassData, createVisibleIndicesBuffer, createBladeGeometry } from './core/grassGeometry'
import { createGrassCompute, createResetDrawBufferCompute } from './core/grassCompute'
import { updateComputeUniforms, updateMaterialUniforms } from './core/uniforms'
import { GrassLOD } from './GrassLOD'
import type { GrassProps, LODBufferConfig } from './core/types'

export default function GrassWebGPU({ terrainUniforms, cullCamera }: GrassProps = {} as GrassProps) {
  const { gl, camera: defaultCamera } = useThree()
  
  // Use cullCamera if provided, otherwise use default render camera
  const cameraToUse = cullCamera || defaultCamera

  const [grassParams] = useControls('Grass', () => createGrassControls(), { collapsed: true })

  // Use default constants for size parameters (not exposed in controls)
  const bladesPerAxis = DEFAULT_BLADES_PER_AXIS
  const grassAreaSize = DEFAULT_GRASS_AREA_SIZE
  const gridDivisions = DEFAULT_GRID_DIVISIONS
  const gridCellSize = grassAreaSize / gridDivisions

  const grassComputeRef = useRef<any>(null)
  const resetComputeRef = useRef<any>(null)
  const groupRef = useRef<THREE.Group>(null)

  // Buffer refs (created at top level, passed to GrassLOD components)
  const grassDataRef = useRef<ReturnType<typeof createGrassData> | null>(null)
  const positionsRef = useRef<ReturnType<typeof createPositions> | null>(null)
  const [lodBuffers, setLodBuffers] = useState<LODBufferConfig[]>([])

  // Track current grid cell to detect when player enters a new square
  const currentGridCellX = useRef<number>(0)
  const currentGridCellZ = useRef<number>(0)

  const materialUniforms = useMemo(() => {
    const baseColorValue = new THREE.Color("#000000");
    const tipColorValue = new THREE.Color("#ffffff");
    const groundColorValue = new THREE.Color("#1a3319");

    return {
      uTime: uniform(0.0),
      uWindDir: uniform(vec2(1.0, 0.0)),
      uWindSwayFreqMin: uniform(0.4),
      uWindSwayFreqMax: uniform(1.5),
      uWindSwayStrength: uniform(0.1),
      uWindDistanceStart: uniform(10.0),
      uWindDistanceEnd: uniform(30.0),
      uMidSoft: uniform(0.25),
      uRimPos: uniform(0.42),
      uRimSoft: uniform(0.03),
      uBaseColor: uniform(vec3(baseColorValue.r, baseColorValue.g, baseColorValue.b)),
      uTipColor: uniform(vec3(tipColorValue.r, tipColorValue.g, tipColorValue.b)),
      uGroundColor: uniform(vec3(groundColorValue.r, groundColorValue.g, groundColorValue.b)),
      uBladeSeedRange: uniform(vec2(0.95, 1.03)),
      uClumpSeedRange: uniform(vec2(0.9, 1.1)),
      uAOPower: uniform(0.6),
      uNoiseParams: uniform(vec4(1.0, 3.0, 0.7, 1.0)),
      uTerrainAmp: uniform(0.3),
      uTerrainFreq: uniform(0.4),
      uTerrainSeed: uniform(0.0),
      uBaseWidth: uniform(0.35),
      uTipThin: uniform(0.9),
      uThicknessStrength: uniform(0.10),
      uGroupOffset: uniform(new THREE.Vector3(0, 0, 0)), // For lighting coordinate system correction
    };
  }, []);

  const computeUniforms = useMemo(() => {
    return {
      // Shape Parameters
      uBladeHeightMin: uniform(0.4),
      uBladeHeightMax: uniform(0.8),
      uBladeWidthMin: uniform(0.01),
      uBladeWidthMax: uniform(0.05),
      uBendAmountMin: uniform(0.2),
      uBendAmountMax: uniform(0.6),
      uBladeRandomness: uniform(new THREE.Vector3(0.3, 0.3, 0.2)),
      // Clump Parameters
      uClumpSize: uniform(0.8),
      uClumpRadius: uniform(1.5),
      uCenterYaw: uniform(1.0),
      uBladeYaw: uniform(1.2),
      uClumpYaw: uniform(0.5),
      uTypeTrendScale: uniform(0.1),
      // Wind Parameters
      uTime: uniform(0.0),
      uWindScale: uniform(0.25),
      uWindSpeed: uniform(0.6),
      uWindStrength: uniform(0.35),
      uWindDir: uniform(new THREE.Vector2(1, 0)),
      uWindFacing: uniform(0.6),
      // Culling Parameters
      uCullOffset: uniform(0.8),
      // Grid Parameters (for jitter calculation)
      uBladesPerAxis: uniform(64.0), // Number of blades along one axis (e.g. 64 means 64x64 = 4096 blades)
      uGrassAreaSize: uniform(40.0), // Total width/height of grass area where blades are distributed
      uGridCellSize: uniform(2.0), // Size of world grid cell for infinite grass (grassAreaSize / gridDivisions)
      // Camera matrices (updated in useFrame)
      uViewMatrix: uniform(new THREE.Matrix4()),
      uProjectionMatrix: uniform(new THREE.Matrix4()),
      uCameraPosition: uniform(new THREE.Vector3()),
      uGroupOffset: uniform(new THREE.Vector3()), // Group's world position offset (for seed calculation consistency)
    };
  }, []);

  // Create compute shader and shared buffers
  useEffect(() => {
    const grassBlades = bladesPerAxis * bladesPerAxis

    // Create shared buffers
    const positions = createPositions(bladesPerAxis, grassAreaSize)
    const grassData = createGrassData(grassBlades)
    positionsRef.current = positions
    grassDataRef.current = grassData

    // Generate LOD buffers from segments config
    const lodConfigs: LODBufferConfig[] = DEFAULT_LOD_SEGMENTS_CONFIG.map((lodSegConfig) => {
      const bladeGeometry = createBladeGeometry(lodSegConfig.segments)
      const indexCount = bladeGeometry.index ? bladeGeometry.index.count : bladeGeometry.attributes.position.count
      const drawBuffer = new THREE.IndirectStorageBufferAttribute(new Uint32Array(5), 5)
      const drawStorage = storage(drawBuffer, drawIndirectStructure, 1)

      bladeGeometry.dispose()

      return {
        segments: lodSegConfig.segments,
        indices: createVisibleIndicesBuffer(grassBlades),
        drawBuffer,
        drawStorage,
        vertexCount: indexCount,
        minDistance: lodSegConfig.minDistance,
        maxDistance: lodSegConfig.maxDistance,
        debugColor: lodSegConfig.debugColor,
      }
    })

    setLodBuffers(lodConfigs)

    // Create compute shader with uniforms
    const { computeFn } = createGrassCompute(
      grassData,
      positions,
      lodConfigs,
      computeUniforms
    )
    const grassCompute = computeFn().compute(grassBlades)
    grassComputeRef.current = grassCompute

    // Create reset compute shader
    const resetCompute = createResetDrawBufferCompute(lodConfigs)
    resetComputeRef.current = resetCompute
  }, [bladesPerAxis, grassAreaSize])

  // Update compute uniforms
  useEffect(() => {
    updateComputeUniforms(computeUniforms, grassParams)
  }, [computeUniforms, grassParams])

  // Update material uniforms
  useEffect(() => {
    updateMaterialUniforms(materialUniforms, grassParams, terrainUniforms)
  }, [materialUniforms, grassParams, terrainUniforms])

  useFrame(({ clock }) => {
    const renderer = gl as unknown as WebGPURenderer
    if (!grassComputeRef.current || !resetComputeRef.current || !cameraToUse) return

    const elapsedTime = clock.getElapsedTime()

    computeUniforms.uTime.value = elapsedTime
    materialUniforms.uTime.value = elapsedTime

    // Infinite Grass Position Update
    if (groupRef.current) {
      // Use cullCamera position for snapping (follows player camera, not god view)
      const currentCellX = Math.floor(cameraToUse.position.x / gridCellSize)
      const currentCellZ = Math.floor(cameraToUse.position.z / gridCellSize)

      if (currentCellX !== currentGridCellX.current || currentCellZ !== currentGridCellZ.current) {
        const snappedX = currentCellX * gridCellSize
        const snappedZ = currentCellZ * gridCellSize

        groupRef.current.position.set(snappedX, 0, snappedZ)
        groupRef.current.updateMatrixWorld(true)

        currentGridCellX.current = currentCellX
        currentGridCellZ.current = currentCellZ
      }

      computeUniforms.uGroupOffset.value.setFromMatrixPosition(groupRef.current.matrixWorld)
      computeUniforms.uGridCellSize.value = gridCellSize
      
      materialUniforms.uGroupOffset.value.copy(computeUniforms.uGroupOffset.value)
    }

    // Update camera matrices (for Culling)
    // Use cullCamera if provided, otherwise use default render camera
    if (cameraToUse) {
      cameraToUse.updateMatrixWorld()
      computeUniforms.uViewMatrix.value.copy(cameraToUse.matrixWorldInverse)
      computeUniforms.uProjectionMatrix.value.copy(cameraToUse.projectionMatrix)
      computeUniforms.uCameraPosition.value.copy(cameraToUse.position)
    }

    // Execute Compute Shaders
    renderer.compute(resetComputeRef.current)
    renderer.compute(grassComputeRef.current)
  })

  return (
    <group ref={groupRef}>
      {lodBuffers.map((lodBuffer) => (
        <GrassLOD
          key={`lod-${lodBuffer.segments}-${lodBuffer.minDistance}-${lodBuffer.maxDistance}`}
          grassParams={grassParams}
          terrainUniforms={terrainUniforms}
          grassData={grassDataRef.current}
          positions={positionsRef.current}
          lodBuffer={lodBuffer}
          uniforms={materialUniforms}
        />
      ))}
    </group>
  )
}
