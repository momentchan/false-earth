// ============================================================================
// Hook for Grass Compute Pass (Multiple Render Targets)
// ============================================================================
import { useMemo, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createPositionTexture } from '../utils'
import grassComputeShader from '../shaders/grassComputeShader.glsl?raw'
import fractal from '@packages/r3f-gist/shaders/cginc/noise/fractal.glsl'

export interface GrassComputeConfig {
    // Shape parameters
    bladeHeightMin: number
    bladeHeightMax: number
    bladeWidthMin: number
    bladeWidthMax: number
    bendAmountMin: number
    bendAmountMax: number
    clumpSize: number
    clumpRadius: number
    uCenterYaw: number
    uBladeYaw: number
    uClumpYaw: number
    uBladeRandomness: THREE.Vector3 // (height, width, bend) randomness multiplier
    uTypeTrendScale: number // Scale factor for type trend noise
    
    // Wind parameters
    uTime: number
    uWindScale: number
    uWindSpeed: number
    uWindDir: THREE.Vector2
    uWindFacing: number
    uWindStrength: number
}

export function useGrassCompute(config: GrassComputeConfig, gridSize: number, patchSize: number) {
    const gl = useThree((state) => state.gl)
    
    // Create position texture
    const positionTexture = useMemo(() => createPositionTexture(gridSize, patchSize), [gridSize, patchSize])

    // Create multiple render targets for compute pass (single pass, multiple outputs)
    const mrt = useMemo(() => {
        const renderTarget = new THREE.WebGLRenderTarget(gridSize, gridSize, {
            count: 3, // Multiple render targets: bladeParams, clumpData, additionalData
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
        })
        
        return renderTarget
    }, [gridSize])
    
    const bladeParamsRT = useMemo(() => ({ texture: mrt.textures[0] }), [mrt])
    const clumpDataRT = useMemo(() => ({ texture: mrt.textures[1] }), [mrt])
    const additionalDataRT = useMemo(() => ({ texture: mrt.textures[2] }), [mrt])

    // Create compute material for Multiple Render Targets
    const grassComputeMat = useMemo(() => new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3, // Enable WebGL2/GLSL ES 3.00 for Multiple Render Targets
        vertexShader: `
            void main() {
                gl_Position = vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            ${fractal}
            ${grassComputeShader}
        `,
        uniforms: {
            uResolution: { value: new THREE.Vector2(gridSize, gridSize) },
            uPositions: { value: positionTexture },
            uBladeHeightMin: { value: config.bladeHeightMin },
            uBladeHeightMax: { value: config.bladeHeightMax },
            uBladeWidthMin: { value: config.bladeWidthMin },
            uBladeWidthMax: { value: config.bladeWidthMax },
            uBendAmountMin: { value: config.bendAmountMin },
            uBendAmountMax: { value: config.bendAmountMax },
            uClumpSize: { value: config.clumpSize },
            uClumpRadius: { value: config.clumpRadius },
            uCenterYaw: { value: config.uCenterYaw },
            uBladeYaw: { value: config.uBladeYaw },
            uClumpYaw: { value: config.uClumpYaw },
            uBladeRandomness: { value: config.uBladeRandomness },
            uTypeTrendScale: { value: config.uTypeTrendScale },
            uWindTime: { value: config.uTime },
            uWindScale: { value: config.uWindScale },
            uWindSpeed: { value: config.uWindSpeed },
            uWindDir: { value: config.uWindDir },
            uWindFacing: { value: config.uWindFacing },
            uWindStrength: { value: config.uWindStrength },
        }
    }), [positionTexture, config, gridSize])

    // Create fullscreen quad for compute pass
    const computeScene = useMemo(() => {
        const scene = new THREE.Scene()
        const geometry = new THREE.PlaneGeometry(2, 2)
        scene.add(new THREE.Mesh(geometry, grassComputeMat))
        return scene
    }, [grassComputeMat])

    const computeCamera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), [])

    // Initialize compute pass once
    useEffect(() => {
        const currentRenderTarget = gl.getRenderTarget()
        
        // Render to multiple render targets in single pass
        gl.setRenderTarget(mrt)
        gl.render(computeScene, computeCamera)
        
        // Restore render target
        gl.setRenderTarget(currentRenderTarget)
    }, [gl, mrt, computeScene, computeCamera, grassComputeMat])

    // Update compute material uniforms when params change
    useEffect(() => {
        grassComputeMat.uniforms.uResolution.value.set(gridSize, gridSize)
        grassComputeMat.uniforms.uBladeHeightMin.value = config.bladeHeightMin
        grassComputeMat.uniforms.uBladeHeightMax.value = config.bladeHeightMax
        grassComputeMat.uniforms.uBladeWidthMin.value = config.bladeWidthMin
        grassComputeMat.uniforms.uBladeWidthMax.value = config.bladeWidthMax
        grassComputeMat.uniforms.uBendAmountMin.value = config.bendAmountMin
        grassComputeMat.uniforms.uBendAmountMax.value = config.bendAmountMax
        grassComputeMat.uniforms.uClumpSize.value = config.clumpSize
        grassComputeMat.uniforms.uClumpRadius.value = config.clumpRadius
        grassComputeMat.uniforms.uCenterYaw.value = config.uCenterYaw
        grassComputeMat.uniforms.uBladeYaw.value = config.uBladeYaw
        grassComputeMat.uniforms.uClumpYaw.value = config.uClumpYaw
        grassComputeMat.uniforms.uBladeRandomness.value = config.uBladeRandomness
        grassComputeMat.uniforms.uTypeTrendScale.value = config.uTypeTrendScale
        grassComputeMat.uniforms.uWindTime.value = config.uTime
        grassComputeMat.uniforms.uWindScale.value = config.uWindScale
        grassComputeMat.uniforms.uWindSpeed.value = config.uWindSpeed
        grassComputeMat.uniforms.uWindDir.value = config.uWindDir
        grassComputeMat.uniforms.uWindFacing.value = config.uWindFacing
        grassComputeMat.uniforms.uWindStrength.value = config.uWindStrength
    }, [config, grassComputeMat, gridSize])

    // Memoize compute function to avoid recreating it every render
    const compute = useMemo(() => {
        return () => {
            const currentRenderTarget = gl.getRenderTarget()
            gl.setRenderTarget(mrt)
            gl.render(computeScene, computeCamera)
            gl.setRenderTarget(currentRenderTarget)
        }
    }, [gl, mrt, computeScene, computeCamera])

    return {
        bladeParamsRT,
        clumpDataRT,
        additionalDataRT,
        computeMaterial: grassComputeMat,
        compute
    }
}

