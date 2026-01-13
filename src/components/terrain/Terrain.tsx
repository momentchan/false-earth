import * as THREE from 'three/webgpu'
import { useMemo, useEffect, useRef } from 'react'
import { useControls } from 'leva'
import { useFrame, useThree } from '@react-three/fiber'
import {
    Fn,
    vec3,
    vec2,
    vec4,
    float,
    uniform,
    positionLocal,
    modelWorldMatrix,
} from 'three/tsl'
import { DEFAULT_GRASS_AREA_SIZE } from '../grass/core/constants'
import {
    getTerrainHeight,
} from './terrainHelpers'

/**
 * Snaps a position to a grid to prevent popping artifacts
 */
function snapToGrid(value: number, gridSize: number): number {
    return Math.floor(value / gridSize) * gridSize
}

export function Terrain({
    onUniformsChange,
    grassAreaSize = DEFAULT_GRASS_AREA_SIZE
}: {
    onUniformsChange?: (uniforms: { uTerrainAmp: any; uTerrainFreq: any; uTerrainSeed: any; uColor: any }) => void
    grassAreaSize?: number
}) {
    const { camera } = useThree()
    const meshRef = useRef<THREE.Mesh>(null)
    const lastSnappedX = useRef<number>(0)
    const lastSnappedZ = useRef<number>(0)
    
    const terrainParams = useControls('Terrain', {
        amplitude: { value: 1.5, min: 0.1, max: 3.0, step: 0.1 },
        frequency: { value: 0.1, min: 0.01, max: 0.1, step: 0.01 },
        seed: { value: 0.0, min: 0.0, max: 100.0, step: 0.1 },
        color: { value: '#1a3310' }
    }, { collapsed: true })


    const uniforms = useMemo(() => {
        const colorValue = new THREE.Color(terrainParams.color);
        return {
            uTerrainAmp: uniform(terrainParams.amplitude),
            uTerrainFreq: uniform(terrainParams.frequency),
            uTerrainSeed: uniform(terrainParams.seed),
            uColor: uniform(vec3(colorValue.r, colorValue.g, colorValue.b))
        }
    }, [])

    // Expose uniforms to parent
    useEffect(() => {
        if (onUniformsChange) {
            onUniformsChange(uniforms)
        }
    }, [uniforms, onUniformsChange])

    // Create material with terrain functions
    const material = useMemo(() => {
        const terrainHeight = getTerrainHeight(uniforms.uTerrainAmp, uniforms.uTerrainFreq, uniforms.uTerrainSeed)

        const mat = new THREE.MeshBasicNodeMaterial()
        mat.side = THREE.DoubleSide
        mat.colorNode = vec4(uniforms.uColor, float(1.0))

        mat.positionNode = Fn(() => {
            const localPos = positionLocal
            const worldPos = modelWorldMatrix.mul(vec4(localPos, float(1.0))).xyz
            const h = terrainHeight(worldPos.xz)
            const displacedPos = vec3(localPos.x, localPos.y, localPos.z.add(h))
            return vec4(displacedPos, float(1.0))
        })()

        return mat
    }, [])

    // Update uniforms when terrainParams change
    useEffect(() => {
        uniforms.uTerrainAmp.value = terrainParams.amplitude
        uniforms.uTerrainFreq.value = terrainParams.frequency
        uniforms.uTerrainSeed.value = terrainParams.seed
        const colorObj = new THREE.Color(terrainParams.color)
        uniforms.uColor.value.set(colorObj.r, colorObj.g, colorObj.b)
    }, [terrainParams, uniforms])

    // Follow camera position with grid snapping for infinite terrain
    useFrame(() => {
        if (!meshRef.current || !camera) return

        const camX = camera.position.x
        const camZ = camera.position.z
        
        // Snap camera XZ to grid to prevent popping
        const snappedX = snapToGrid(camX, grassAreaSize / 20)
        const snappedZ = snapToGrid(camZ, grassAreaSize / 20)
        
        // Only update if position changed (to avoid unnecessary updates)
        if (snappedX !== lastSnappedX.current || snappedZ !== lastSnappedZ.current) {
            meshRef.current.position.set(snappedX, 0, snappedZ)
            lastSnappedX.current = snappedX
            lastSnappedZ.current = snappedZ
        }
    })
    return null

    return (
        // High segment count is needed for smooth FBM terrain
        <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[areaSize, areaSize, 20, 20]} />
            <primitive object={material} />
        </mesh>
    )
}

