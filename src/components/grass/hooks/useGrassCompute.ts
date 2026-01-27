import { useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { DEFAULT_GRASS_AREA_SIZE, DEFAULT_LOD_SEGMENTS_CONFIG, drawIndirectStructure, LODBufferConfig } from '../core/config'
import { createBladeGeometry, createVisibleIndicesBuffer } from '../core/grassGeometry'
import { DEFAULT_BLADES_PER_AXIS } from '../core/config'
import { storage } from 'three/tsl'
import { createPositions, createGrassData } from '../core/grassGeometry'
import { createGrassCompute, createResetDrawBufferCompute } from '../core/grassCompute'
import { WebGPURenderer } from 'three/webgpu'

export function useGrassCompute(
    uniforms: any,
    windUniforms: any,
    cameraToUse: THREE.Camera
) {
    const { gl } = useThree()
    const [lodBuffers, setLodBuffers] = useState<LODBufferConfig[]>([])

    const computeRefs = useRef<{ main: any, reset: any } | null>(null)
    const grassDataRef = useRef<ReturnType<typeof createGrassData> | null>(null)
    const positionsRef = useRef<ReturnType<typeof createPositions> | null>(null)

    useEffect(() => {
        if(!windUniforms) return

        const grassBlades = DEFAULT_BLADES_PER_AXIS * DEFAULT_BLADES_PER_AXIS

        // Create positions and grass data
        const positions = createPositions(DEFAULT_BLADES_PER_AXIS, DEFAULT_GRASS_AREA_SIZE)
        const grassData = createGrassData(grassBlades)
        positionsRef.current = positions
        grassDataRef.current = grassData

        // Generate LOD buffers from segments config
        const configs: LODBufferConfig[] = DEFAULT_LOD_SEGMENTS_CONFIG.map((cfg) => {
            const geo = createBladeGeometry(cfg.segments)
            const count = geo.index ? geo.index.count : geo.attributes.position.count
            const drawBuffer = new THREE.IndirectStorageBufferAttribute(new Uint32Array(5), 5)
            const drawStorage = storage(drawBuffer, drawIndirectStructure, 1)
            geo.dispose()

            return {
                ...cfg,
                indices: createVisibleIndicesBuffer(grassBlades),
                drawBuffer,
                drawStorage,
                vertexCount: count,
            }
        })
        setLodBuffers(configs)

        // Merge wind uniforms into compute uniforms if available
        const mergedUniforms = {
            ...uniforms.compute,
            ...(windUniforms ? {
                uWindDir: windUniforms.uWindDir,
                uWindScale: windUniforms.uWindScale,
                uWindSpeed: windUniforms.uWindSpeed,
                uWindStrength: windUniforms.uWindStrength,
                uWindFacing: windUniforms.uWindFacing,
            } : {})
        }

        computeRefs.current = {
            main: createGrassCompute(grassData, positions, configs, mergedUniforms).computeFn().compute(grassBlades),
            reset: createResetDrawBufferCompute(configs),
        }

        return () => {
            computeRefs.current = null
            grassDataRef.current = null
            positionsRef.current = null
        }
    }, [windUniforms])


    useFrame(({ clock }) => {
        if (!computeRefs.current) return
        
        const renderer = gl as unknown as WebGPURenderer

        uniforms.material.uTime.value = clock.getElapsedTime()
        uniforms.compute.uTime.value = clock.getElapsedTime()

        if (cameraToUse) {
            cameraToUse.updateMatrixWorld()
            uniforms.compute.uViewProjectionMatrix.value.copy(cameraToUse.projectionMatrix.clone().multiply(cameraToUse.matrixWorldInverse))
            uniforms.compute.uCameraPosition.value.copy(cameraToUse.position)
        }

        renderer.compute(computeRefs.current.reset)
        renderer.compute(computeRefs.current.main)
    })

    return {
        lodBuffers,
        grassData: grassDataRef.current,
        positions: positionsRef.current,
    }
}