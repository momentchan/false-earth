import { useEffect, useRef } from 'react';
import { useControls, folder } from 'leva'
import { useFrame, useThree } from '@react-three/fiber'
import { DEFAULT_GRID_SIZE, DEFAULT_PATCH_SIZE, BLADE_SEGMENTS } from './grass/constants'
import { seededRandom } from './grass/utils'
import { createGrassCompute } from './grass/compute/grassCompute'
import { createGrassMaterial } from './grass/materials/grassMaterial'
import { terrainMath } from './terrain/TerrainMath'
import * as THREE from 'three/webgpu';

import { instancedArray, struct } from 'three/tsl';
import { WebGPURenderer } from 'three/webgpu';


interface GrassProps {
  terrainParams?: {
    amplitude: number
    frequency: number
    seed: number
    color: string
  }
  patchSize?: number
  onPatchSizeChange?: (patchSize: number) => void
}

// Color presets for tipColor
const TIP_COLOR_PRESETS = [
  '#3e8d2f', // Default green
  '#4b4b4b', // Default gray
  '#8c502e', // Brown
  '#21546c', // Blue
  '#7c7c22', // Yellow
]

const grassStructure = struct({
  // Blade parameters
  bladeHeight: 'float',
  bladeWidth: 'float',
  bladeBend: 'float',
  bladeType: 'float',

  // Clump data
  toCenter: 'vec2',
  presence: 'float',
  clumpSeed01: 'float',

  // Motion seeds
  facingAngle01: 'float',
  perBladeHash01: 'float',
  windStrength01: 'float',
  lodSeed01: 'float',
})

export default function GrassWebGPU({ terrainParams, patchSize: initialPatchSize = DEFAULT_PATCH_SIZE }: GrassProps = {} as GrassProps) {
  const { gl, scene } = useThree()

  const grassComputeRef = useRef<any>(null)
  const computeUniformsRef = useRef<Record<string, any>>({})
  const materialUniformsRef = useRef<Record<string, any> | null>(null)
  const materialRef = useRef<THREE.MeshStandardNodeMaterial | null>(null)

  const [grassParams, setGrassParams] = useControls('Grass', () => ({
    Size: folder({
      gridSize: { value: DEFAULT_GRID_SIZE, min: 64, max: 512, step: 64 },
      patchSize: { value: initialPatchSize, min: 5, max: 50, step: 1 },
    }, { collapsed: true }),
    Geometry: folder({
      Shape: folder({
        bladeHeightMin: { value: 0.4, min: 0.1, max: 2.0, step: 0.01 },
        bladeHeightMax: { value: 0.8, min: 0.1, max: 2.0, step: 0.01 },
        bladeWidthMin: { value: 0.01, min: 0.01, max: 0.2, step: 0.001 },
        bladeWidthMax: { value: 0.05, min: 0.01, max: 0.2, step: 0.001 },
        bendAmountMin: { value: 0.2, min: 0.0, max: 1.0, step: 0.01 },
        bendAmountMax: { value: 0.6, min: 0.0, max: 1.0, step: 0.01 },
        bladeRandomness: { value: { x: 0.3, y: 0.3, z: 0.2 }, step: 0.01, min: 0.0, max: 1.0 },
        baseWidth: { value: 0.35, min: 0.0, max: 1.0, step: 0.01 },
        tipThin: { value: 0.9, min: 0.0, max: 2.0, step: 0.01 },
        thicknessStrength: { value: 0.02, min: 0.0, max: 0.1, step: 0.001 },
      }, { collapsed: true }),
      Clump: folder({
        clumpSize: { value: 0.8, min: 0.1, max: 5.0, step: 0.1 },
        clumpRadius: { value: 1.5, min: 0.3, max: 2.0, step: 0.1 },
        typeTrendScale: { value: 0.1, min: 0.01, max: 1.0, step: 0.01 },
      }, { collapsed: true }),
      Angle: folder({
        centerYaw: { value: 1.0, min: 0.0, max: 3.0, step: 0.1 },
        bladeYaw: { value: 1.2, min: 0.0, max: 3.0, step: 0.1 },
        clumpYaw: { value: 0.5, min: 0.0, max: 2.0, step: 0.1 },
      }, { collapsed: true }),
    }, { collapsed: true }),
    Appearance: folder({
      Color: folder({
        tipColor: { value: TIP_COLOR_PRESETS[0] },
        baseColor: { value: '#000000' },
        bladeSeedRange: { value: { x: 0.95, y: 1.03 }, step: 0.01, min: 0.5, max: 1.5 },
        clumpInternalRange: { value: { x: 0.95, y: 1.05 }, step: 0.01, min: 0.5, max: 1.5 },
        clumpSeedRange: { value: { x: 0.9, y: 1.1 }, step: 0.01, min: 0.5, max: 1.5 },
        aoPower: { value: 5, min: 0.1, max: 20.0, step: 0.1 },
      }, { collapsed: true }),
      Normal: folder({
        midSoft: { value: 0.25, min: 0.0, max: 1.0, step: 0.01 },
        rimPos: { value: 0.42, min: 0.0, max: 1.0, step: 0.01 },
        rimSoft: { value: 0.03, min: 0.0, max: 0.1, step: 0.001 },
      }, { collapsed: true }),
      Lighting: folder({
        backLightStrength: { value: 0.2, min: 0.0, max: 2.0, step: 0.1 },
      }, { collapsed: true }),
      Noise: folder({
        noiseFreqX: { value: 5, min: 0.1, max: 10.0, step: 0.1 },
        noiseFreqY: { value: 10, min: 0.1, max: 10.0, step: 0.1 },
        noiseRemapMin: { value: 0.7, min: 0.0, max: 1.0, step: 0.01 },
        noiseRemapMax: { value: 1.0, min: 0.0, max: 1.0, step: 0.01 },
      }, { collapsed: true }),
    }, { collapsed: true }),
    Animation: folder({
      Wind: folder({
        windDirX: { value: 1, min: -1, max: 1, step: 0.01 },
        windDirZ: { value: 0, min: -1, max: 1, step: 0.01 },
        windSpeed: { value: 0.2, min: 0, max: 3, step: 0.01 },
        windStrength: { value: 0.35, min: 0, max: 2, step: 0.01 },
        windScale: { value: 0.1, min: 0.01, max: 2, step: 0.01 },
        windFacing: { value: 0.6, min: 0.0, max: 1.0, step: 0.01 },
        swayFreqMin: { value: 0.4, min: 0.1, max: 10.0, step: 0.1 },
        swayFreqMax: { value: 1.5, min: 0.1, max: 10.0, step: 0.1 },
        swayStrength: { value: 0.1, min: 0.0, max: 0.5, step: 0.001 },
        windDistanceStart: { value: 10, min: 0, max: 100, step: 1 },
        windDistanceEnd: { value: 30, min: 0, max: 200, step: 1 },
      }, { collapsed: true }),
    }, { collapsed: true }),
    Performance: folder({
      LOD: folder({
        lodStart: { value: 5, min: 0, max: 50, step: 1 },
        lodEnd: { value: 15, min: 0, max: 50, step: 1 },
      }, { collapsed: true }),
      Culling: folder({
        cullStart: { value: 15, min: 0, max: 200, step: 1 },
        cullEnd: { value: 30, min: 0, max: 300, step: 1 },
        compensation: { value: 1.5, min: 1.0, max: 3.0, step: 0.1 },
      }, { collapsed: true }),
    }, { collapsed: true }),
    Material: folder({
      roughness: { value: 0.3, min: 0.0, max: 1.0, step: 0.01 },
      metalness: { value: 0.5, min: 0.0, max: 1.0, step: 0.01 },
      emissive: { value: '#000000' },
      envMapIntensity: { value: 0.5, min: 0.0, max: 3.0, step: 0.1 },
    }, { collapsed: true }),
  }), { collapsed: true })


  const patchSize = (grassParams as any).patchSize

  const gridSize = (grassParams as any).gridSize

  useEffect(() => {
    const bladeGeometry = new THREE.PlaneGeometry(
      1,
      1,
      1,
      BLADE_SEGMENTS
    )

    bladeGeometry.translate(0, 1 / 2, 0)
    const grassBlades = gridSize * gridSize;

    const positionArray = new Float32Array(grassBlades * 3)

    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        const id = x * gridSize + z;
        if (id >= grassBlades) break;
        const fx = x / gridSize - 0.5;
        const fz = z / gridSize - 0.5;

        const seed = (x * 7919 + z * 7919) * 0.0001;
        const jitterX = (seededRandom(seed) - 0.5) * 0.2;
        const jitterZ = (seededRandom(seed + 1.0) - 0.5) * 0.2;

        const px = fx * patchSize + jitterX;
        const pz = fz * patchSize + jitterZ;

        positionArray[id * 3 + 0] = px;
        positionArray[id * 3 + 1] = 0;
        positionArray[id * 3 + 2] = pz;
      }
    }

    const positions = instancedArray(positionArray, 'vec3')

    // Calculate grass struct size: 4 floats + 1 vec2 (2 floats) + 2 floats + 4 floats = 12 floats = 48 bytes
    const grassStructSize = 12
    const grassDataArray = new Float32Array(grassBlades * grassStructSize)
    grassDataArray.fill(0)
    const grassData = instancedArray(grassDataArray, grassStructure)

    // Get params from grassParams for initial values
    const params = grassParams as any
    const { computeFn, uniforms } = createGrassCompute(grassData, positions, {
      // Shape Parameters
      bladeHeightMin: params.bladeHeightMin,
      bladeHeightMax: params.bladeHeightMax,
      bladeWidthMin: params.bladeWidthMin,
      bladeWidthMax: params.bladeWidthMax,
      bendAmountMin: params.bendAmountMin,
      bendAmountMax: params.bendAmountMax,
      bladeRandomness: params.bladeRandomness,
      // Clump Parameters
      clumpSize: params.clumpSize,
      clumpRadius: params.clumpRadius,
      centerYaw: params.centerYaw,
      bladeYaw: params.bladeYaw,
      clumpYaw: params.clumpYaw,
      typeTrendScale: params.typeTrendScale,
      // Wind Parameters
      windTime: 0.0, // Will be updated in useFrame
      windScale: params.windScale ?? 0.25,
      windSpeed: params.windSpeed,
      windStrength: params.windStrength,
      windDir: { x: params.windDirX, y: params.windDirZ },
      windFacing: params.windFacing,
    })

    const grassCompute = computeFn().compute(grassBlades)
    computeUniformsRef.current = uniforms
    grassComputeRef.current = grassCompute

    // Create grass material
    const materialParams = params as any
    // Get ground color from terrainParams if available, otherwise use default
    const groundColor = terrainParams?.color || '#1a3319'
    
    // Get initial light direction and color from scene
    const light = scene.children.find((child) => child.type === 'DirectionalLight') as THREE.DirectionalLight | undefined
    const lightDirection = light ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 0, -1) // Default direction
    const lightColor = light ? light.color : new THREE.Color('#ffffff')
    
    const { material, uniforms: materialUniforms } = createGrassMaterial(grassData, positions, {
      baseWidth: materialParams.baseWidth,
      tipThin: materialParams.tipThin,
      windTime: 0.0, // Will be updated in useFrame
      windDir: { x: materialParams.windDirX, y: materialParams.windDirZ },
      swayFreqMin: materialParams.swayFreqMin,
      swayFreqMax: materialParams.swayFreqMax,
      swayStrength: materialParams.swayStrength,
      windDistanceStart: materialParams.windDistanceStart,
      windDistanceEnd: materialParams.windDistanceEnd,
      cullStart: materialParams.cullStart,
      cullEnd: materialParams.cullEnd,
      roughness: materialParams.roughness,
      metalness: materialParams.metalness,
      emissive: materialParams.emissive,
      envMapIntensity: materialParams.envMapIntensity,
      midSoft: materialParams.midSoft,
      rimPos: materialParams.rimPos,
      rimSoft: materialParams.rimSoft,
      // Color uniforms
      baseColor: materialParams.baseColor,
      tipColor: materialParams.tipColor,
      groundColor: groundColor,
      bladeSeedRange: materialParams.bladeSeedRange,
      clumpInternalRange: materialParams.clumpInternalRange,
      clumpSeedRange: materialParams.clumpSeedRange,
      aoPower: materialParams.aoPower,
      // Lighting uniforms
      lightDirection: lightDirection,
      lightColor: lightColor,
      lightBackStrength: materialParams.backLightStrength,
      // Noise uniforms
      noiseParams: {
        x: materialParams.noiseFreqX,
        y: materialParams.noiseFreqY,
        z: materialParams.noiseRemapMin,
        w: materialParams.noiseRemapMax,
      },
    })
    materialUniformsRef.current = materialUniforms
    materialRef.current = material

    const mesh = new THREE.Mesh(bladeGeometry, material);
    mesh.count = grassBlades;
    scene.add(mesh)

    // Set envMap from scene if available
    if (scene.environment) {
      material.envMap = scene.environment
    }

    return () => {
      scene.remove(mesh)
      bladeGeometry.dispose();
      material.dispose();
    }

  }, [gridSize, patchSize, scene])

  // Update compute uniforms when grassParams change (like birds example)
  useEffect(() => {
    if (!computeUniformsRef.current) return

    const params = grassParams as any
    const uniforms = computeUniformsRef.current

    // Update shape parameter uniforms from Leva controls
    uniforms.uBladeHeightMin.value = params.bladeHeightMin
    uniforms.uBladeHeightMax.value = params.bladeHeightMax
    uniforms.uBladeWidthMin.value = params.bladeWidthMin
    uniforms.uBladeWidthMax.value = params.bladeWidthMax
    uniforms.uBendAmountMin.value = params.bendAmountMin
    uniforms.uBendAmountMax.value = params.bendAmountMax
    uniforms.uBladeRandomness.value.set(
      params.bladeRandomness.x,
      params.bladeRandomness.y,
      params.bladeRandomness.z
    )

    // Update clump parameter uniforms
    uniforms.uClumpSize.value = params.clumpSize
    uniforms.uClumpRadius.value = params.clumpRadius
    uniforms.uCenterYaw.value = params.centerYaw
    uniforms.uBladeYaw.value = params.bladeYaw
    uniforms.uClumpYaw.value = params.clumpYaw
    uniforms.uTypeTrendScale.value = params.typeTrendScale

    // Update wind parameter uniforms (compute shader only has these)
    uniforms.uWindScale.value = params.windScale ?? 0.25
    uniforms.uWindSpeed.value = params.windSpeed
    uniforms.uWindStrength.value = params.windStrength
    uniforms.uWindDir.value.set(params.windDirX, params.windDirZ)
    uniforms.uWindFacing.value = params.windFacing

    // Update material wind parameter uniforms (vertex shader has these additional ones)
    if (materialUniformsRef.current) {
      materialUniformsRef.current.uWindDir.value.set(params.windDirX, params.windDirZ)
      materialUniformsRef.current.uWindSwayFreqMin.value = params.swayFreqMin
      materialUniformsRef.current.uWindSwayFreqMax.value = params.swayFreqMax
      materialUniformsRef.current.uWindSwayStrength.value = params.swayStrength
      materialUniformsRef.current.uWindDistanceStart.value = params.windDistanceStart
      materialUniformsRef.current.uWindDistanceEnd.value = params.windDistanceEnd
      materialUniformsRef.current.uCullStart.value = params.cullStart
      materialUniformsRef.current.uCullEnd.value = params.cullEnd
    }

    // Update material properties
    if (materialRef.current) {
      materialRef.current.roughness = params.roughness
      materialRef.current.metalness = params.metalness
      if (params.emissive) {
        materialRef.current.emissive = new THREE.Color(params.emissive)
      }
      materialRef.current.envMapIntensity = params.envMapIntensity
    }

    // Update material width shaping uniforms
    if (materialUniformsRef.current) {
      materialUniformsRef.current.uMidSoft.value = params.midSoft
      materialUniformsRef.current.uRimPos.value = params.rimPos
      materialUniformsRef.current.uRimSoft.value = params.rimSoft
      
      // Update color uniforms
      const baseColor = new THREE.Color(params.baseColor)
      materialUniformsRef.current.uBaseColor.value.set(baseColor.r, baseColor.g, baseColor.b)
      
      const tipColor = new THREE.Color(params.tipColor)
      materialUniformsRef.current.uTipColor.value.set(tipColor.r, tipColor.g, tipColor.b)
      
      const groundColor = terrainParams?.color || '#1a3319'
      const groundColorObj = new THREE.Color(groundColor)
      materialUniformsRef.current.uGroundColor.value.set(groundColorObj.r, groundColorObj.g, groundColorObj.b)
      
      materialUniformsRef.current.uBladeSeedRange.value.set(params.bladeSeedRange.x, params.bladeSeedRange.y)
      materialUniformsRef.current.uClumpInternalRange.value.set(params.clumpInternalRange.x, params.clumpInternalRange.y)
      materialUniformsRef.current.uClumpSeedRange.value.set(params.clumpSeedRange.x, params.clumpSeedRange.y)
      materialUniformsRef.current.uAOPower.value = params.aoPower
      
      // Update lighting uniforms
      materialUniformsRef.current.uLightBackStrength.value = params.backLightStrength
      
      // Update noise uniforms
      materialUniformsRef.current.uNoiseParams.value.set(
        params.noiseFreqX,
        params.noiseFreqY,
        params.noiseRemapMin,
        params.noiseRemapMax
      )
    }
  }, [grassParams, terrainParams])


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
