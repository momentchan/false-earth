import { useEffect, useRef, useState, useMemo } from 'react'
import { useControls } from 'leva'
import { useFrame, useThree } from '@react-three/fiber'
import { WebGPURenderer } from 'three/webgpu'
import * as THREE from 'three/webgpu'
import { storage, uniform, vec2, vec3, vec4 } from 'three/tsl'
import { DEFAULT_PATCH_SIZE, DEFAULT_LOD_SEGMENTS_CONFIG, drawIndirectStructure } from './core/constants'
import { createGrassControls } from './core/grassControls'
import { createPositions, createGrassData, createVisibleIndicesBuffer, createBladeGeometry } from './core/grassGeometry'
import { createGrassCompute, createResetDrawBufferCompute } from './core/grassCompute'
import { updateComputeUniforms, updateMaterialUniforms } from './core/uniforms'
import { findDirectionalLight } from './core/utils'
import { GrassLOD } from './GrassLOD'
import type { GrassProps, LODBufferConfig } from './core/types'

export default function GrassWebGPU({ terrainUniforms, patchSize: initialPatchSize = DEFAULT_PATCH_SIZE }: GrassProps = {} as GrassProps) {
  const { gl, camera, scene } = useThree()

  const [grassParams] = useControls('Grass', () => createGrassControls({ initialPatchSize }), { collapsed: true })

  const grassComputeRef = useRef<any>(null)
  const resetComputeRef = useRef<any>(null)

  // Buffer refs (created at top level, passed to GrassLOD components)
  const grassDataRef = useRef<ReturnType<typeof createGrassData> | null>(null)
  const positionsRef = useRef<ReturnType<typeof createPositions> | null>(null)
  const [lodBuffers, setLodBuffers] = useState<LODBufferConfig[]>([])

  const materialUniforms = useMemo(() => {
    const light = findDirectionalLight(scene);
    const lightColor = light ? light.color : new THREE.Color('#ffffff');
    const lightDirection = new THREE.Vector3(0, 0, -1);
    const baseColorValue = new THREE.Color("#000000");
    const tipColorValue = new THREE.Color("#ffffff");
    const groundColorValue = new THREE.Color("#1a3319");
    const lightColorValue = lightColor;

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
      uLightDirection: uniform(vec3(lightDirection.x, lightDirection.y, lightDirection.z)),
      uLightColor: uniform(vec3(lightColorValue.r, lightColorValue.g, lightColorValue.b)),
      uLightBackStrength: uniform(0.6),
      uNoiseParams: uniform(vec4(1.0, 3.0, 0.7, 1.0)),
      uTerrainAmp: uniform(0.3),
      uTerrainFreq: uniform(0.4),
      uTerrainSeed: uniform(0.0),
      uBaseWidth: uniform(0.35),
      uTipThin: uniform(0.9),
      uThicknessStrength: uniform(0.10),
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
      // Camera matrices (updated in useFrame)
      uViewMatrix: uniform(new THREE.Matrix4()),
      uProjectionMatrix: uniform(new THREE.Matrix4()),
      uCameraPosition: uniform(new THREE.Vector3()),
      uModelMatrix: uniform(new THREE.Matrix4()),
    };
  }, []);

  // Create compute shader and shared buffers only when structural properties change
  useEffect(() => {
    const gridSize = grassParams.gridSize
    const patchSize = grassParams.patchSize
    const grassBlades = gridSize * gridSize

    // Create shared buffers
    const positions = createPositions(gridSize, patchSize)
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
  }, [grassParams.gridSize, grassParams.patchSize, computeUniforms])

  // Update compute uniforms when grassParams change (only updates uniforms, doesn't recreate shader)
  useEffect(() => {
    updateComputeUniforms(computeUniforms, grassParams)
  }, [computeUniforms, grassParams])

  // Update material uniforms when grassParams change (shared across all LODs)
  useEffect(() => {
    updateMaterialUniforms(materialUniforms, grassParams, terrainUniforms)
  }, [materialUniforms, grassParams, terrainUniforms])

  useFrame(({ clock }) => {
    const renderer = gl as unknown as WebGPURenderer
    if (!grassComputeRef.current || !resetComputeRef.current || !camera) return

    const elapsedTime = clock.getElapsedTime()
    
    // Update compute shader time
    computeUniforms.uTime.value = elapsedTime

    // Update material uniforms time (shared across all LODs)
    materialUniforms.uTime.value = elapsedTime

    // Update camera matrices for frustum culling
    camera.updateMatrixWorld()
    computeUniforms.uViewMatrix.value.copy(camera.matrixWorldInverse)
    computeUniforms.uProjectionMatrix.value.copy(camera.projectionMatrix)
    computeUniforms.uCameraPosition.value.copy(camera.position)
    computeUniforms.uModelMatrix.value.identity()

    // Execute compute shaders
    renderer.compute(resetComputeRef.current)
    renderer.compute(grassComputeRef.current)
  })

  return (
    <>
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
    </>
  )
}
