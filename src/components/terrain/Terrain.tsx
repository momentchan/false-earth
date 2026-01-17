import * as THREE from 'three/webgpu'
import { useMemo, useEffect, useRef } from 'react'
import { useControls } from 'leva'
import { useFrame, useThree } from '@react-three/fiber'
import { WebGPURenderer } from 'three/webgpu'
import {
    Fn,
    vec2,
    vec3,
    vec4,
    float,
    uniform,
    positionLocal,
    uv,
    texture,
    textureStore,
    instanceIndex,
    uvec2,
} from 'three/tsl'
import { DEFAULT_GRASS_AREA_SIZE } from '../grass/core/constants'
import {
    getTerrainHeight,
    getTerrainNormal,
} from './terrainHelpers'
import { useGridSnapping } from './useGridSnapping'


export function Terrain({
    onHeightmapChange,
    grassAreaSize = DEFAULT_GRASS_AREA_SIZE,
    cullCamera
}: {
    onHeightmapChange?: (heightmap: THREE.StorageTexture) => void
    grassAreaSize?: number
    cullCamera?: THREE.PerspectiveCamera
}) {
    const { gl, camera: defaultCamera } = useThree()
    const cameraToUse = cullCamera || defaultCamera
    
    const meshRef = useRef<THREE.Mesh>(null)
    const computeRef = useRef<any>(null)
    
    const heightmapResolution = 1024
    
    const needsRecompute = useRef<boolean>(true)
    
    const terrainParams = useControls('Terrain', {
        amplitude: { value: 1.5, min: 0.1, max: 3.0, step: 0.1 },
        frequency: { value: 0.05, min: 0.01, max: 0.1, step: 0.01 },
        seed: { value: 0.0, min: 0.0, max: 100.0, step: 0.1 },
        color: { value: '#000000' }
    }, { collapsed: true })

    // Create storage texture for heightmap
    const heightmap = useMemo(() => {
        const tex = new THREE.StorageTexture(heightmapResolution, heightmapResolution)
        // Use LinearFilter for smoother vertex sampling, reducing aliasing
        tex.magFilter = THREE.LinearFilter
        tex.minFilter = THREE.LinearFilter
        return tex
    }, [])

    const uniforms = useMemo(() => {
        const colorValue = new THREE.Color(terrainParams.color);
        return {
            uTerrainAmp: uniform(terrainParams.amplitude),
            uTerrainFreq: uniform(terrainParams.frequency),
            uTerrainSeed: uniform(terrainParams.seed),
            uColor: uniform(vec3(colorValue.r, colorValue.g, colorValue.b))
        }
    }, [])

    // Compute uniforms for GPU heightmap generation
    const computeUniforms = useMemo(() => {
        return {
            uTerrainAmp: uniform(terrainParams.amplitude),
            uTerrainFreq: uniform(terrainParams.frequency),
            uTerrainSeed: uniform(terrainParams.seed),
            uOffset: uniform(vec2(0.0, 0.0)), // World offset for infinite terrain
            uResolution: uniform(float(heightmapResolution)),
            uGrassAreaSize: uniform(float(grassAreaSize)),
        }
    }, [grassAreaSize])

    // Expose heightmap texture to parent - use useLayoutEffect for synchronous update
    useEffect(() => {
        if (onHeightmapChange && heightmap) {
            onHeightmapChange(heightmap)
        }
    }, [heightmap, onHeightmapChange])

    // Create compute shader for heightmap generation
    useEffect(() => {
        const terrainHeightFn = getTerrainHeight(
            computeUniforms.uTerrainAmp,
            computeUniforms.uTerrainFreq,
            computeUniforms.uTerrainSeed
        )
        const terrainNormalFn = getTerrainNormal(terrainHeightFn)

        const computeFn = Fn(() => {
            // Calculate pixel position from instance index
            const res = computeUniforms.uResolution
            const posX = instanceIndex.mod(res)
            const posY = instanceIndex.div(res)
            const indexUV = uvec2(posX, posY)

            // Convert pixel coordinates to UV coordinates [0, 1]
            const uvX = float(posX).div(res.sub(float(1.0)))
            const uvY = float(posY).div(res.sub(float(1.0)))
            const uvCoord = vec2(uvX, uvY)

            // Convert UV to world position
            // UV goes from [0,1], world position goes from [-grassAreaSize/2, grassAreaSize/2]
            // World X Calculation (Standard Left-to-Right)
            const worldX = uvCoord.x.mul(computeUniforms.uGrassAreaSize).sub(computeUniforms.uGrassAreaSize.div(float(2.0)))
            
            // [FIX] World Z Calculation (Inverted to match PlaneGeometry UVs)
            // PlaneGeometry rotated -90deg X: UV.y=0 is +Z (Bottom), UV.y=1 is -Z (Top)
            const worldZ = float(1.0).sub(uvCoord.y).mul(computeUniforms.uGrassAreaSize).sub(computeUniforms.uGrassAreaSize.div(float(2.0)))

            // Add offset for infinite terrain
            const worldXZ = vec2(worldX, worldZ).add(computeUniforms.uOffset)

            // Calculate terrain height using the same function as before
            const h = terrainHeightFn(worldXZ)

            // Calculate terrain normal using the helper function
            const normal = terrainNormalFn(worldXZ)

            // Remap normal from [-1, 1] to [0, 1] for texture storage
            // Formula: (normal + 1.0) * 0.5
            const normalG = normal.x.mul(float(0.5)).add(float(0.5))
            const normalB = normal.y.mul(float(0.5)).add(float(0.5))
            const normalA = normal.z.mul(float(0.5)).add(float(0.5))

            // Store height in R channel, normal in GBA channels
            textureStore(heightmap, indexUV, vec4(h, normalG, normalB, normalA)).toWriteOnly()
        })

        const computeNode = computeFn().compute(heightmapResolution * heightmapResolution)
        computeRef.current = computeNode
        needsRecompute.current = true
    }, [heightmap, computeUniforms, grassAreaSize])

    // Create material with texture sampling
    const material = useMemo(() => {
        const mat = new THREE.MeshBasicNodeMaterial()
        mat.side = THREE.DoubleSide
        mat.colorNode = vec4(uniforms.uColor, float(1.0))

        mat.positionNode = Fn(() => {
            const localPos = positionLocal
            const uvCoord = uv()
            
            // Sample height from texture
            const heightmapSample = texture(heightmap, uvCoord)
            const h = heightmapSample.r
            
            const displacedPos = vec3(localPos.x, localPos.y, localPos.z.add(h))
            return vec4(displacedPos, float(1.0))
        })()

        return mat
    }, [heightmap, uniforms])

    // Update uniforms when terrainParams change
    useEffect(() => {
        uniforms.uTerrainAmp.value = terrainParams.amplitude
        uniforms.uTerrainFreq.value = terrainParams.frequency
        uniforms.uTerrainSeed.value = terrainParams.seed
        const colorObj = new THREE.Color(terrainParams.color)
        uniforms.uColor.value.set(colorObj.r, colorObj.g, colorObj.b)

        // Update compute uniforms
        computeUniforms.uTerrainAmp.value = terrainParams.amplitude
        computeUniforms.uTerrainFreq.value = terrainParams.frequency
        computeUniforms.uTerrainSeed.value = terrainParams.seed

        needsRecompute.current = true
    }, [terrainParams, uniforms, computeUniforms])

    // Use centralized grid snapping hook
    useGridSnapping({
        camera: cameraToUse,
        grassAreaSize,
        onSnap: ({ snappedX, snappedZ }) => {
            if (!meshRef.current) return;

            meshRef.current.position.set(snappedX, 0, snappedZ)
            meshRef.current.updateMatrixWorld(true)

            // Update offset for compute shader
            computeUniforms.uOffset.value.set(snappedX, snappedZ)
            needsRecompute.current = true
        },
    })

    // Re-run compute shader when needed
    useFrame(() => {
        if (needsRecompute.current && computeRef.current) {
            const renderer = gl as unknown as WebGPURenderer
            renderer.compute(computeRef.current)
            needsRecompute.current = false
        }
    })

    return (
        // High segment count is needed for smooth FBM terrain to match grass density
        <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[grassAreaSize, grassAreaSize, heightmapResolution, heightmapResolution]} />
            <primitive object={material} />
        </mesh>
    )
}

